import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/shared/api';
import { tools } from '@/shared/config';
import { cx, type Open } from '@/shared/lib';
import { Icon, LoadState, ui } from '@/shared/ui';
import { useSession, type ProfileChanges } from '@/features/session';
import { useFavorites, rememberPendingFavorite, resumePendingFavorite } from '@/features/favorites';
import { recordVisit } from '@/features/history';
import { materialHref, useMaterials } from '@/entities/material';
import { SiteHeader } from '@/widgets/site-header';
import { Footer } from '@/widgets/site-footer';
import { AppModal } from '@/widgets/service-dialog';
import { Home } from '@/pages/home';
import { MaterialPage } from '@/pages/material';
import { Auth } from '@/pages/auth';
import { ProfilePage } from '@/pages/profile';
import { SearchPage } from '@/pages/search';
import { ArticlesPage } from '@/pages/articles';
import { QuestionsPage } from '@/pages/questions';
import { CalculatorPage } from '@/pages/calculator';
import { DocumentsPage, DocumentEditorPage } from '@/pages/documents';
import styles from './styles.module.css';
import { ObjectJourneyRoute } from './ObjectJourneyRoute';

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
  '/questions': 'Вопрос — ответ',
  '/tools/calculator': 'Калькулятор пошлин',
};

export function App() {
  const [modalSelection, setModalSelection] = useState<{ id: string; key: string } | null>(null);
  const { profile, status, signedIn, login, register, logout, updateProfile } = useSession();
  const {
    favorites,
    items: favoriteItems,
    toggleFavorite: toggleSaved,
    addFavorite,
  } = useFavorites(profile);
  const materials = useMaterials().data ?? [];
  const [toast, setToast] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const modal = modalSelection?.key === location.key ? modalSelection.id : null;
  const setModal = (id: string | null) => setModalSelection(id ? { id, key: location.key } : null);
  const isAuth = ['/login', '/register'].includes(location.pathname);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    resumePendingFavorite(profile.id, addFavorite).then(
      (added) => {
        if (active && added) setToast('Добавлено в избранное');
      },
      (error: unknown) => {
        if (active) setToast(`Не удалось добавить материал в избранное. ${errorMessage(error)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [profile?.id, addFavorite]);

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
      navigate('/ownership');
      return;
    }
    if (id === 'questions') {
      navigate('/questions');
      return;
    }
    if (id === 'calculator') {
      navigate('/tools/calculator');
      return;
    }
    if (id === 'documents') {
      recordVisit({ type: 'tool', target: 'documents', title: 'Конструктор документов' });
      navigate('/documents');
      return;
    }
    const tool = tools.find((item) => item.id === id);
    if (tool) recordVisit({ type: 'tool', target: tool.id, title: tool.title });
    setModal(id);
  };
  const toggleFavorite = async (id: string) => {
    // Favorites belong to the personal account: a guest signs in and comes back here.
    if (!signedIn) {
      rememberPendingFavorite(id);
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
          <Route
            path="/protect"
            element={
              <MaterialPage
                materialId="protect-overview"
                open={open}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            }
          />
          <Route
            path="/defend"
            element={
              <MaterialPage
                materialId="defend-overview"
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
            path="/ownership"
            element={
              <MaterialPage
                materialId="ownership-overview"
                open={open}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            }
          />
          {(['protect', 'defend', 'ownership'] as const).map((area) => (
            <Route
              key={area}
              path={`/${area}/:objectId`}
              element={
                <ObjectJourneyRoute
                  area={area}
                  open={open}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                />
              }
            />
          ))}
          <Route
            path="/login"
            element={
              <Auth
                key="login"
                register={false}
                status={status}
                login={login}
                signUp={register}
                open={open}
              />
            }
          />
          <Route
            path="/register"
            element={
              <Auth
                key="register"
                register
                status={status}
                login={login}
                signUp={register}
                open={open}
              />
            }
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
          <Route path="/tools/calculator" element={<CalculatorPage />} />
          <Route
            path="/questions"
            element={
              <QuestionsPage
                key={profile?.id ?? 'guest'}
                userId={profile?.id}
                ready={status !== 'loading'}
                open={open}
              />
            }
          />
          <Route element={<RequireProfile status={status} />}>
            <Route path="/documents" element={<DocumentsPage userId={profile?.id} />} />
            <Route path="/documents/:kind" element={<DocumentsPage userId={profile?.id} />} />
            <Route
              path="/documents/:kind/:objectId"
              element={<DocumentEditorPage profile={profile} status={status} open={open} />}
            />
            <Route
              path="/documents/saved/:savedId"
              element={<DocumentEditorPage profile={profile} status={status} open={open} />}
            />
          </Route>
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
          onRequestSubmitted={() => {
            setModal(null);
            setToast('Заявка отправлена');
          }}
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

function RequireProfile({ status }: { status: 'loading' | 'guest' | 'user' }) {
  const location = useLocation();
  if (status === 'loading') return <LoadState />;
  if (status === 'guest') {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
