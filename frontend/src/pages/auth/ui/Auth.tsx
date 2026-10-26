import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, errorMessage } from '@/shared/api';
import { cx, validateForm, type Open } from '@/shared/lib';
import { Icon, type IconName, PasswordField, ui } from '@/shared/ui';
import { profileFieldHints } from '@/entities/profile';
import { type RegisterData } from '@/features/session';
import styles from './styles.module.css';

/** Where to go after signing in: ?next= if it is a path on this site, else the profile. */
function nextPath(next: string | null) {
  if (!next?.startsWith('/') || next.startsWith('//') || /[\\\s]/u.test(next)) return '/profile';
  try {
    const target = new URL(next, window.location.origin);
    const pathname = decodeURIComponent(target.pathname).replace(/\/+$/u, '').toLowerCase();
    if (target.origin !== window.location.origin || ['/login', '/register'].includes(pathname))
      return '/profile';
    return target.pathname + target.search + target.hash;
  } catch {
    return '/profile';
  }
}

function ConsentCheckbox({ open }: { open: Open }) {
  return (
    <label className={styles['consent']}>
      <input
        type="checkbox"
        required
        name="consent"
        data-required-message="Подтвердите согласие на обработку персональных данных."
      />
      <span>
        Я даю{' '}
        <button type="button" onClick={() => open('personal-data-consent')}>
          согласие на обработку персональных данных
        </button>{' '}
        и ознакомлен(а) с{' '}
        <button type="button" onClick={() => open('privacy')}>
          политикой конфиденциальности.
        </button>
      </span>
    </label>
  );
}

export function Auth({
  register,
  status,
  login,
  signUp,
  open,
}: {
  register: boolean;
  status: 'loading' | 'guest' | 'user';
  login: (identifier: string, password: string, consent?: boolean) => Promise<void>;
  signUp: (data: RegisterData) => Promise<void>;
  open: Open;
}) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  // The account's consent was withdrawn: signing in requires giving it again.
  const [consentRequired, setConsentRequired] = useState(false);
  const submitting = useRef(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next');
  const restoring = status === 'loading';
  const busy = pending || restoring;
  const destination = nextPath(next);
  const enteringConstructor = destination === '/documents' || destination.startsWith('/documents/');
  const keepNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || restoring) return;
    const invalid = validateForm(event.currentTarget);
    if (invalid) {
      setError(invalid);
      return;
    }
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (register && password !== data.get('confirm')) {
      const confirmation = event.currentTarget.elements.namedItem('confirm');
      if (confirmation instanceof HTMLInputElement) {
        confirmation.setAttribute('aria-invalid', 'true');
        confirmation.focus();
      }
      setError('Пароли не совпадают. Проверьте повторный ввод.');
      return;
    }
    setError('');
    submitting.current = true;
    setPending(true);
    try {
      if (register)
        await signUp({
          login: String(data.get('login')).trim(),
          email: String(data.get('email')).trim(),
          password,
          consent: true,
        });
      else await login(String(data.get('email')).trim(), password, consentRequired);
      navigate(destination, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'CONSENT_REQUIRED')
        setConsentRequired(true);
      setError(errorMessage(caught, profileFieldHints));
      setPending(false);
      submitting.current = false;
    }
  };
  if (status === 'user') return <Navigate to={destination} replace />;
  return (
    <div className={styles['auth-page']}>
      {enteringConstructor && (
        <p role="status">
          Чтобы пользоваться конструктором документов, войдите в профиль или зарегистрируйтесь.
        </p>
      )}
      <Link className={ui['back-link']} to="/">
        <Icon name="arrowLeft" size={18} />
        На главную
      </Link>
      <div className={styles['auth-grid']}>
        <section className={styles['auth-benefits']}>
          <div className={cx(ui['eyebrow'], styles['eyebrow'])}>ВАШ ЛИЧНЫЙ КАБИНЕТ</div>
          <h2>
            Мой продукт
            <br />
            Мои права
          </h2>
          <p>Всё важное об интеллектуальной собственности — в вашем личном кабинете.</p>
          <img
            src="/images/digital-rights.svg"
            alt="Авторские права на цифровой продукт"
            width={360}
            height={200}
          />
          <div className={styles['benefits']}>
            {(
              [
                {
                  icon: 'bookmark',
                  title: 'Сохраняйте полезные материалы',
                  text: 'Статьи и ответы — всегда под рукой.',
                },
                {
                  icon: 'history',
                  title: 'Возвращайтесь к своим вопросам',
                  text: 'История работы с сервисом в одном месте.',
                },
                {
                  icon: 'user',
                  title: 'Управляйте своим профилем',
                  text: 'Личные данные и настройки в одном месте.',
                },
              ] as { icon: IconName; title: string; text: string }[]
            ).map((item) => (
              <div key={item.title}>
                <span className={cx(ui['icon-tile'], styles['icon-tile'])}>
                  <Icon name={item.icon} size={19} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className={styles['auth-panel']} aria-labelledby="auth-title">
          <nav className={styles['auth-tabs']} aria-label="Вход и регистрация">
            <Link
              className={!register ? cx(ui['selected'], styles['selected']) : undefined}
              to={keepNext('/login')}
              aria-current={!register ? 'page' : undefined}
            >
              Войти в профиль
            </Link>
            <Link
              className={register ? cx(ui['selected'], styles['selected']) : undefined}
              to={keepNext('/register')}
              aria-current={register ? 'page' : undefined}
            >
              Создать профиль
            </Link>
          </nav>
          <form
            className={styles['auth-form']}
            onSubmit={submit}
            aria-busy={busy}
            aria-describedby={error ? 'auth-error' : undefined}
            noValidate
          >
            <span className={styles['form-icon']}>
              <Icon name={register ? 'user' : 'lock'} size={23} />
            </span>
            <h1 id="auth-title">{register ? 'Создать профиль' : 'Войти в профиль'}</h1>
            <p>
              {register
                ? 'Сохраните всё важное в личном кабинете.'
                : 'Рады видеть вас снова. Ваши материалы и история уже ждут вас.'}
            </p>
            <fieldset className={styles['form-controls']} disabled={busy}>
              <legend className={styles['sr-only']}>
                {register ? 'Данные нового профиля' : 'Данные для входа'}
              </legend>
              <div className={styles['form-fields']}>
                {register && (
                  <label className={ui['field']}>
                    Логин
                    <input
                      required
                      name="login"
                      placeholder="Придумайте логин"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      minLength={3}
                      maxLength={32}
                      pattern="[\p{L}\p{N}._\-]+"
                      title={profileFieldHints['login']}
                    />
                  </label>
                )}
                <label className={ui['field']}>
                  {register ? 'Электронная почта' : 'Электронная почта или логин'}
                  <input
                    name="email"
                    type={register ? 'email' : 'text'}
                    required
                    placeholder={register ? 'Введите email' : 'Введите email или логин'}
                    autoComplete={register ? 'email' : 'username'}
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
                  />
                </label>
                <PasswordField
                  register={register}
                  placeholder={register ? 'Не менее 8 символов' : 'Введите пароль'}
                />
                {register && (
                  <PasswordField
                    register
                    label="Подтверждение пароля"
                    name="confirm"
                    placeholder="Повторите пароль"
                  />
                )}
              </div>
              {register && (
                <p className={styles['password-hint']}>Пароль — от 8 до 128 символов.</p>
              )}
              {(register || consentRequired) && <ConsentCheckbox open={open} />}
              {!register && (
                <button className={styles['forgot']} type="button" onClick={() => open('reset')}>
                  Забыли пароль?
                </button>
              )}
            </fieldset>
            {error && (
              <p id="auth-error" className={ui['form-error']} role="alert">
                {error}
              </p>
            )}
            <button
              className={cx(ui['button'], ui['primary'], styles['submit'])}
              type="submit"
              disabled={busy}
            >
              {busy ? <span className={styles['spinner']} aria-hidden="true" /> : null}
              {restoring
                ? 'Восстанавливаем сессию…'
                : pending
                  ? register
                    ? 'Создаём профиль…'
                    : 'Входим…'
                  : register
                    ? 'Создать профиль'
                    : 'Войти в профиль'}
              {!busy && <Icon name="arrowRight" size={18} />}
            </button>
            <span className={styles['sr-only']} role="status">
              {busy ? 'Пожалуйста, подождите.' : ''}
            </span>
            <div className={styles['auth-switch']}>
              {register ? 'Уже есть профиль?' : 'Ещё нет профиля?'}{' '}
              <Link to={keepNext(register ? '/login' : '/register')}>
                {register ? 'Войти' : 'Создать профиль'}
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
