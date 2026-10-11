import { useNavigate } from 'react-router-dom';
import { demoProfile, type Profile } from '@/entities/profile';
import { usePersistentState } from '@/shared/lib';
export function useSession() {
  const [profile, updateProfile] = usePersistentState('profile', demoProfile);
  const [signedIn, setSignedIn] = usePersistentState('signed-in', false);
  const navigate = useNavigate();
  const login = (value?: Profile) => {
    if (value) updateProfile(value);
    setSignedIn(true);
    navigate('/profile');
  };
  const logout = () => {
    setSignedIn(false);
    navigate('/login');
  };
  return { profile, signedIn, login, logout, updateProfile };
}
