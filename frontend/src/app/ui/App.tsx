import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/shared/api';
import { tools } from '@/shared/config';
import { cx, type Open } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import { useSession, type ProfileChanges } from '@/features/session';
import { useFavorites } from '@/features/favorites';
import { recordVisit } from '@/features/history';
import { materialHref, useMaterials } from '@/entities/material';
import { SiteHeader } from '@/widgets/site-header';
import { Footer } from '@/widgets/site-footer';
import { AppModal } from '@/widgets/service-dialog';
import { Home } from '@/pages/home';
import { Protect } from '@/pages/protection';
import { MaterialPage } from '@/pages/material';
import { ObjectMaterialsPage, OwnershipPage } from '@/pages/object-materials';
import { Auth } from '@/pages/auth';
import { ProfilePage } from '@/pages/profile';
import { SearchPage } from '@/pages/search';
import { ArticlesPage } from '@/pages/articles';
import styles from './styles.module.css';

const staticTitles: Record<string, string> = {
  '/': 'Мой продукт. Мои права.',
  '/defend': 'Оспорить претензию о нарушении чужих прав',
  '/login': 'Войти в профиль',
  '/register': 'Создать профиль',
  '/profile': 'Личный кабинет',
  '/protect': 'Защитить нарушенные права',
  '/ownership': 'Оформить права',
  '/search': 'Поиск',
  '/articles': 'Информационные статьи',
};

export function App() {
  const [modalSelection, setModalSelection] = useState<{ id: string; key: string } | null>(null);
  const { profile, status, signedIn, login, register, logout, updateProfile } = useSession();
  const { favorites, items: favoriteItems, toggleFavorite: toggleSaved } = useFavorites(profile);
  const materials = useMaterials().data ?? [];
  const [toast, setToast] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const modal = modalSelection?.key === location.key ? modalSelection.id : null;
  const setModal = (id: string | null) => setModalSelection(id ? { id, key: location.key } : null);
  const isAuth = ['/login', '/register'].includes(location.pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Pages with loaded content (materials, objects) set their own titles.
    const title = staticTitles[location.pathname];
    if (title) document.title = `${title} — МоёПраво`;
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const open: Open = (id) => {
    const article = id.startsWith('article:')
      ? materials.find((item) => item.id === id.slice(8))
      : undefined;
    if (article?.hasContent) {
      navigate(materialHref(article.id));
      return;
    }
    if (id === 'ownership') {
      return;
    }
    const tool = tools.find((item) => item.id === id);
    if (tool) recordVisit({ type: 'tool', target: tool.id, title: tool.title });
    setModal(id);
  };
  const toggleFavorite = async (id: string) => {
    // Favorites belong to the personal account: a guest signs in and comes back here.
    if (!signedIn) {
      setToast('Войдите, чтобы сохранять материалы');
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    try {
      setToast((await toggleSaved(id)) ? 'Добавлено в избранное' : 'Удалено из избранного');
    } catch (error) {
      setToast(errorMessage(error));
    }
  };
  const saveProfile = async (changes: ProfileChanges) => {
    if (Object.keys(changes).length > 0) await updateProfile(changes);
    setModal(null);
    setToast('Настройки сохранены');
  };
  const toolAction = (id: string) => (id === 'articles' ? navigate('/articles') : open(id));

  return (
    <div
      className={cx(
        styles['app'],
        isAuth ? styles['auth-background'] : undefined,
        location.pathname === '/profile' ? styles['profile-background'] : undefined,
      )}
    >
      <a className={styles['skip-link']} href="#main">
        Перейти к содержимому
      </a>
      <SiteHeader key={location.key} profile={profile} signedIn={signedIn} onOpen={open} />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home open={open} toolAction={toolAction} />} />
          <Route path="/protect" element={<Protect />} />
          <Route path="/defend" element={<Protect defend />} />
          <Route
            path="/protect/code"
            element={
              <MaterialPage
                materialId="checklist"
                open={open}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            }
          />
          <Route
            path="/articles/:id"
            element={
              <MaterialPage open={open} favorites={favorites} toggleFavorite={toggleFavorite} />
            }
          />
          <Route
            path="/protect/brand"
            element={<ObjectMaterialsPage topic="brand" open={open} />}
          />
          <Route
            path="/protect/databases"
            element={<ObjectMaterialsPage topic="databases" open={open} />}
          />
          <Route path="/ownership" element={<OwnershipPage />} />
          <Route
            path="/ownership/databases"
            element={
              <MaterialPage
                materialId="database-registration"
                open={open}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            }
          />
          <Route
            path="/login"
            element={
              <Auth key="login" register={false} login={login} signUp={register} open={open} />
            }
          />
          <Route
            path="/register"
            element={<Auth key="register" register login={login} signUp={register} open={open} />}
          />
          <Route
            path="/profile"
            element={
              <ProfilePage
                profile={profile}
                status={status}
                favorites={favoriteItems}
                open={open}
                logout={logout}
              />
            }
          />
          <Route
            path="/search"
            element={
              <SearchPage favorites={favorites} toggleFavorite={toggleFavorite} open={open} />
            }
          />
          <Route
            path="/articles"
            element={
              <ArticlesPage favorites={favorites} toggleFavorite={toggleFavorite} open={open} />
            }
          />
          <Route
            path="*"
            element={
              <section className={ui['empty-state']}>
                <span className={ui['eyebrow']}>404</span>
                <h1>Страница не найдена</h1>
                <p>Проверьте адрес или вернитесь на главную.</p>
                <Link className={cx(ui['button'], ui['primary'])} to="/">
                  На главную <Icon name="arrowRight" />
                </Link>
              </section>
            }
          />
        </Routes>
      </main>
      {location.pathname !== '/' && location.pathname !== '/profile' && (
        <Footer auth={isAuth} open={open} />
      )}
      {modal && (
        <AppModal
          id={modal}
          profile={profile}
          open={open}
          onClose={() => setModal(null)}
          onSaveProfile={saveProfile}
          favorites={favoriteItems.map((item) => item.material)}
          toggleFavorite={toggleFavorite}
        />
      )}
      <div className={cx(styles['toast'], toast ? styles['visible'] : undefined)} role="status">
        {toast && (
          <>
            <Icon name="check" size={18} />
            {toast}
          </>
        )}
      </div>
    </div>
  );
}
