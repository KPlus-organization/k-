import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SignJWT } from 'jose';

import { pool } from '../src/config/db';
import { env } from '../src/config/env';
import { deleteWithdrawnAccounts } from '../src/services/users';
import { api, registerUser, setupApi, TEST_PASSWORD, trackLogin, uniqueLogin } from './helpers';

setupApi();

test('register returns 201 with tokens and the user', async () => {
  const login = uniqueLogin();
  trackLogin(login);
  const res = await api('POST', '/api/auth/register', {
    body: { login, email: `${login.toUpperCase()}@Example.test`, password: TEST_PASSWORD, consent: true },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.tokenType, 'Bearer');
  assert.equal(res.body.expiresIn, env.accessTokenTtlSeconds);
  assert.equal(typeof res.body.accessToken, 'string');
  assert.equal(typeof res.body.refreshToken, 'string');
  assert.ok(Date.parse(res.body.refreshTokenExpiresAt) > Date.now());
  assert.equal(res.body.user.login, login);
  assert.equal(res.body.user.name, login);
  assert.ok(!('passwordHash' in res.body.user));
});

test('register validates every field and reports all problems at once', async () => {
  const res = await api('POST', '/api/auth/register', {
    body: { login: 'a b', email: 'not-an-email', password: 'short', consent: false },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.deepEqual(
    res.body.error.details.map((d: { field: string }) => d.field).sort(),
    ['consent', 'email', 'login', 'password'],
  );
});

test('register rejects a taken login or email regardless of case', async () => {
  const { user } = await registerUser();
  const sameLogin = await api('POST', '/api/auth/register', {
    body: { login: user.login.toUpperCase(), email: `${uniqueLogin()}@example.test`, password: TEST_PASSWORD, consent: true },
  });
  assert.equal(sameLogin.status, 409);
  assert.equal(sameLogin.body.error.code, 'LOGIN_TAKEN');

  const otherLogin = uniqueLogin();
  trackLogin(otherLogin);
  const sameEmail = await api('POST', '/api/auth/register', {
    body: { login: otherLogin, email: user.email.toUpperCase(), password: TEST_PASSWORD, consent: true },
  });
  assert.equal(sameEmail.status, 409);
  assert.equal(sameEmail.body.error.code, 'EMAIL_TAKEN');
});

test('login accepts login or email and rejects wrong credentials identically', async () => {
  const { user } = await registerUser();
  for (const identifier of [user.login, user.email.toUpperCase()]) {
    const res = await api('POST', '/api/auth/login', { body: { identifier, password: TEST_PASSWORD } });
    assert.equal(res.status, 200, identifier);
    assert.equal(res.body.user.id, user.id);
  }

  const wrongPassword = await api('POST', '/api/auth/login', { body: { identifier: user.login, password: 'wrong-password' } });
  const unknownUser = await api('POST', '/api/auth/login', { body: { identifier: uniqueLogin(), password: TEST_PASSWORD } });
  for (const res of [wrongPassword, unknownUser]) {
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid login or password' } });
  }
});

test('the seeded demo user can log in when SEED_DEMO_PASSWORD is set', { skip: !process.env['SEED_DEMO_PASSWORD'] }, async () => {
  const res = await api('POST', '/api/auth/login', {
    body: { identifier: 'anna_kuznetsova', password: process.env['SEED_DEMO_PASSWORD'] },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.name, 'Анна Кузнецова');
  assert.equal(res.body.user.registeredAt, '2023-10-12T00:00:00.000Z');
});

test('protected routes require a valid, unexpired Bearer token', async () => {
  const { accessToken, user } = await registerUser();

  const missing = await api('GET', '/api/profile');
  assert.equal(missing.status, 401);
  assert.equal(missing.body.error.code, 'AUTH_REQUIRED');

  const garbage = await api('GET', '/api/profile', { token: 'not.a.jwt' });
  assert.equal(garbage.body.error.code, 'INVALID_TOKEN');

  const forged = await new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer('k-backend')
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode('x'.repeat(48)));
  assert.equal((await api('GET', '/api/profile', { token: forged })).body.error.code, 'INVALID_TOKEN');

  const expired = await new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer('k-backend')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(env.jwtSecret));
  const expiredRes = await api('GET', '/api/profile', { token: expired });
  assert.equal(expiredRes.status, 401);
  assert.equal(expiredRes.body.error.code, 'TOKEN_EXPIRED');

  const ok = await api('GET', '/api/profile', { token: accessToken });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.user, user);
});

test('refresh rotates tokens, and reusing an old refresh token revokes the session family', async () => {
  const first = await registerUser();

  const second = await api('POST', '/api/auth/refresh', { body: { refreshToken: first.refreshToken } });
  assert.equal(second.status, 200);
  assert.notEqual(second.body.refreshToken, first.refreshToken);
  assert.equal(second.body.user.id, first.user.id);

  // The old token is now revoked; presenting it again is treated as theft.
  const reused = await api('POST', '/api/auth/refresh', { body: { refreshToken: first.refreshToken } });
  assert.equal(reused.status, 401);
  assert.equal(reused.body.error.code, 'INVALID_REFRESH_TOKEN');

  const afterReuse = await api('POST', '/api/auth/refresh', { body: { refreshToken: second.body.refreshToken } });
  assert.equal(afterReuse.status, 401);
});

test('logout revokes the refresh token and is idempotent', async () => {
  const { refreshToken } = await registerUser();
  assert.equal((await api('POST', '/api/auth/logout', { body: { refreshToken } })).status, 204);
  assert.equal((await api('POST', '/api/auth/logout', { body: { refreshToken } })).status, 204);
  assert.equal((await api('POST', '/api/auth/refresh', { body: { refreshToken } })).status, 401);
  assert.equal((await api('POST', '/api/auth/logout', { body: {} })).status, 400);
});

test('PATCH /api/profile updates allowed fields and enforces uniqueness', async () => {
  const { accessToken, user } = await registerUser();
  const other = await registerUser();

  const newLogin = uniqueLogin();
  trackLogin(newLogin);
  const updated = await api('PATCH', '/api/profile', {
    token: accessToken,
    body: { name: '  Анна  ', login: newLogin },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.name, 'Анна');
  assert.equal(updated.body.user.login, newLogin);
  assert.equal(updated.body.user.email, user.email);

  const taken = await api('PATCH', '/api/profile', { token: accessToken, body: { email: other.user.email } });
  assert.equal(taken.status, 409);
  assert.equal(taken.body.error.code, 'EMAIL_TAKEN');

  const forbidden = await api('PATCH', '/api/profile', { token: accessToken, body: { registeredAt: '2000-01-01' } });
  assert.equal(forbidden.status, 400);
  assert.equal(forbidden.body.error.details[0].field, 'registeredAt');

  const empty = await api('PATCH', '/api/profile', { token: accessToken, body: {} });
  assert.equal(empty.status, 400);
});

test('withdrawing consent blocks the account until the consent is given again at sign-in', async () => {
  const { accessToken, refreshToken, user } = await registerUser();
  assert.equal((await api('POST', '/api/profile/consent/withdraw')).status, 401);

  assert.equal((await api('POST', '/api/profile/consent/withdraw', { token: accessToken })).status, 204);

  // Tokens issued before the withdrawal stop working at once.
  const profile = await api('GET', '/api/profile', { token: accessToken });
  assert.equal(profile.status, 401);
  assert.equal(profile.body.error.code, 'CONSENT_WITHDRAWN');
  assert.equal((await api('POST', '/api/auth/refresh', { body: { refreshToken } })).status, 401);

  // The password is checked before the consent is asked for.
  const wrongPassword = await api('POST', '/api/auth/login', { body: { identifier: user.login, password: 'wrong-password' } });
  assert.equal(wrongPassword.body.error.code, 'INVALID_CREDENTIALS');
  const blocked = await api('POST', '/api/auth/login', { body: { identifier: user.login, password: TEST_PASSWORD } });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, 'CONSENT_REQUIRED');
  const invalid = await api('POST', '/api/auth/login', {
    body: { identifier: user.login, password: TEST_PASSWORD, consent: 'yes' },
  });
  assert.equal(invalid.status, 400);

  // The account was kept with its data and works again after the consent is renewed.
  const renewed = await api('POST', '/api/auth/login', {
    body: { identifier: user.email, password: TEST_PASSWORD, consent: true },
  });
  assert.equal(renewed.status, 200);
  assert.deepEqual(renewed.body.user, (await api('GET', '/api/profile', { token: renewed.body.accessToken })).body.user);
  assert.equal(renewed.body.user.id, user.id);
  const again = await api('POST', '/api/auth/login', { body: { identifier: user.login, password: TEST_PASSWORD } });
  assert.equal(again.status, 200);
});

test('accounts are deleted with their data 30 days after the consent was withdrawn', async () => {
  const expired = await registerUser();
  const recent = await registerUser();
  const renewed = await registerUser();
  assert.equal((await api('PUT', '/api/favorites/checklist', { token: expired.accessToken })).status, 204);
  for (const { accessToken } of [expired, recent, renewed]) {
    await api('POST', '/api/profile/consent/withdraw', { token: accessToken });
  }
  const backdate = (id: string, days: number) =>
    pool.query(`UPDATE users SET consent_withdrawn_at = now() - $2::interval WHERE id = $1`, [id, `${days} days`]);
  await backdate(expired.user.id, 31);
  await backdate(recent.user.id, 29);
  await backdate(renewed.user.id, 31);
  const login = await api('POST', '/api/auth/login', {
    body: { identifier: renewed.user.login, password: TEST_PASSWORD, consent: true },
  });
  assert.equal(login.status, 200);

  assert.ok((await deleteWithdrawnAccounts('30 days')) >= 1);
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM users WHERE id = ANY($1)', [
    [expired.user.id, recent.user.id, renewed.user.id],
  ]);
  assert.deepEqual(rows.map((row) => row.id).sort(), [recent.user.id, renewed.user.id].sort());
  const favorites = await pool.query('SELECT 1 FROM favorites WHERE user_id = $1', [expired.user.id]);
  assert.equal(favorites.rowCount, 0);
  const gone = await api('POST', '/api/auth/login', { body: { identifier: expired.user.login, password: TEST_PASSWORD } });
  assert.equal(gone.body.error.code, 'INVALID_CREDENTIALS');
});
