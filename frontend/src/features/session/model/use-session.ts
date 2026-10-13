import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Profile } from '@/entities/profile';
import {
  ApiError,
  apiRequest,
  endSession,
  hasSession,
  onSessionExpired,
  startSession,
  storedRefreshToken,
  type AuthTokens,
} from '@/shared/api';
import { clearAsyncData } from '@/shared/lib';

type AuthSession = AuthTokens & { user: Profile };
type SessionState =
  | { status: 'loading'; profile: null }
  | { status: 'guest'; profile: null }
  | { status: 'user'; profile: Profile };

export type RegisterData = { login: string; email: string; password: string; consent: true };
export type ProfileChanges = Partial<Pick<Profile, 'name' | 'login' | 'email'>>;

const guest: SessionState = { status: 'guest', profile: null };

// Data cached per user (favorites, history) must not outlive the session.
const forgetUserData = () => clearAsyncData((key) => key.startsWith('user:'));

export function useSession() {
  const [state, setState] = useState<SessionState>(() =>
    hasSession() ? { status: 'loading', profile: null } : guest,
  );
  const navigate = useNavigate();

  // Restores the session after a reload from the stored refresh token.
  useEffect(() => {
    if (!hasSession()) return;
    let active = true;
    apiRequest<{ user: Profile }>('/api/profile', { auth: true }).then(
      ({ user }) => active && setState({ status: 'user', profile: user }),
      (error: unknown) => {
        if (!active) return;
        // Only an auth failure ends the session; a network error keeps it for the next visit.
        if (error instanceof ApiError && error.status === 401) endSession();
        setState(guest);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        forgetUserData();
        setState(guest);
      }),
    [],
  );

  const signIn = (session: AuthSession) => {
    forgetUserData();
    startSession(session);
    setState({ status: 'user', profile: session.user });
  };

  const login = async (identifier: string, password: string) =>
    signIn(
      await apiRequest<AuthSession>('/api/auth/login', {
        method: 'POST',
        body: { identifier, password },
      }),
    );

  const register = async (data: RegisterData) =>
    signIn(await apiRequest<AuthSession>('/api/auth/register', { method: 'POST', body: data }));

  const logout = async () => {
    const refreshToken = storedRefreshToken();
    endSession();
    forgetUserData();
    setState(guest);
    navigate('/login');
    // The access token expires by itself; revoking the refresh token ends the session.
    if (refreshToken)
      await apiRequest('/api/auth/logout', { method: 'POST', body: { refreshToken } }).catch(
        () => undefined,
      );
  };

  const updateProfile = async (changes: ProfileChanges) => {
    const { user } = await apiRequest<{ user: Profile }>('/api/profile', {
      method: 'PATCH',
      body: changes,
      auth: true,
    });
    setState({ status: 'user', profile: user });
  };

  return {
    profile: state.profile,
    status: state.status,
    signedIn: state.status === 'user',
    login,
    register,
    logout,
    updateProfile,
  };
}
