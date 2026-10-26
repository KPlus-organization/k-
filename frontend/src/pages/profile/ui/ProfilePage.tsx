import { Link } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon, LoadState, ui } from '@/shared/ui';
import { type Profile } from '@/entities/profile';
import { ArticleButton, materialHref } from '@/entities/material';
import { type Favorite } from '@/features/favorites';
import { useHistory, type HistoryEntry } from '@/features/history';
import { SavedDocuments } from '@/features/saved-documents';
import styles from './styles.module.css';

const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** «Сегодня, 14:20», «Вчера, 9:00» or «11 сентября, 9:00». */
function visitLabel(date: Date) {
  const days = Math.round(
    (new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  const day = days === 0 ? 'Сегодня' : days === 1 ? 'Вчера' : dayFormat.format(date);
  return `${day}, ${timeFormat.format(date)}`;
}

/** Groups entries by calendar day; each group is labelled with its latest visit. */
function groupByDay(entries: HistoryEntry[]) {
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const day = new Date(entry.visitedAt).toDateString();
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return [...groups.values()];
}

function HistoryItem({ entry, open }: { entry: HistoryEntry; open: Open }) {
  if (entry.type === 'material') return <Link to={materialHref(entry.target)}>{entry.title}</Link>;
  if (entry.type === 'search')
    return <Link to={`/search?q=${encodeURIComponent(entry.target)}`}>{entry.title}</Link>;
  return <button onClick={() => open(entry.target)}>{entry.title}</button>;
}

function NavigationHistory({ profile, open }: { profile: Profile; open: Open }) {
  const history = useHistory(profile);
  const entries = history.data ?? [];
  return (
    <section
      className={cx(styles['panel'], styles['history-panel'])}
      aria-labelledby="history-heading"
    >
      <h2 id="history-heading">История навигации</h2>
      {history.loading ? (
        <p>Загрузка…</p>
      ) : history.error ? (
        <p>Не удалось загрузить историю.</p>
      ) : entries.length === 0 ? (
        <p>Здесь появятся открытые материалы, поисковые запросы и инструменты.</p>
      ) : (
        groupByDay(entries).map((group) => (
          <div className={styles['history-group']} key={group[0]!.id}>
            <p>
              <Icon name="clock" size={18} />
              {visitLabel(new Date(group[0]!.visitedAt))}
            </p>
            {group.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} open={open} />
            ))}
          </div>
        ))
      )}
    </section>
  );
}

export function ProfilePage({
  profile,
  status,
  favorites,
  open,
  logout,
}: {
  profile: Profile | null;
  status: 'loading' | 'guest' | 'user';
  favorites: Favorite[];
  open: Open;
  logout: () => void;
}) {
  if (status === 'loading') return <LoadState />;
  if (!profile)
    return (
      <section className={ui['empty-state']}>
        <span className={ui['icon-tile']}>
          <Icon name="user" />
        </span>
        <h1>Ваш личный кабинет</h1>
        <p>Войдите в профиль или создайте новый, чтобы сохранять материалы.</p>
        <div className={ui['button-row']}>
          <Link
            to="/login?next=/profile"
            className={cx(ui['button'], styles['button'], ui['primary'])}
          >
            Войти в профиль
          </Link>
          <Link to="/register" className={cx(ui['button'], styles['button'], ui['secondary'])}>
            Создать профиль
          </Link>
        </div>
      </section>
    );
  return (
    <div className={cx(ui['container'], styles['dashboard'])}>
      <div className={styles['dashboard-heading']}>
        <div>
          <h1>Добро пожаловать, {profile.name.split(' ')[0]}</h1>
          <p>Это Ваш личный кабинет</p>
        </div>
        <Link className={ui['back-link']} to="/">
          <Icon name="arrowLeft" size={18} />
          На главную
        </Link>
        <button className={cx(ui['button'], styles['button'], ui['neutral'])} onClick={logout}>
          <Icon name="logout" />
          Выйти из профиля
        </button>
      </div>
      <div className={styles['dashboard-grid']}>
        <section className={cx(styles['panel'], styles['personal-panel'])}>
          <div className={styles['panel-heading']}>
            <h2>Персональная информация</h2>
            <button
              className={cx(ui['button'], styles['button'], ui['neutral'])}
              onClick={() => open('settings')}
            >
              <Icon name="settings" size={17} />
              Настройки
            </button>
          </div>
          <dl>
            <dt>Логин</dt>
            <dd>{profile.login}</dd>
            <dt>Электронная почта</dt>
            <dd>{profile.email}</dd>
            <dt>Дата регистрации</dt>
            <dd>{new Date(profile.registeredAt).toLocaleDateString('ru-RU')}</dd>
          </dl>
        </section>
        <section className={cx(styles['panel'], styles['favorites-panel'])}>
          <div className={styles['panel-heading']}>
            <h2>Избранное</h2>
            <button
              className={cx(ui['button'], styles['button'], ui['tinted'])}
              onClick={() => open('favorites')}
            >
              Все избранные <Icon name="arrowUp" size={17} />
            </button>
          </div>
          <div className={ui['favorite-list']}>
            {favorites.length ? (
              favorites
                .slice(0, 3)
                .map((item) => (
                  <ArticleButton key={item.material.id} item={item.material} open={open} />
                ))
            ) : (
              <p>Пока здесь пусто. Сохраняйте статьи и чек-листы, чтобы вернуться к ним позже.</p>
            )}
          </div>
          <SavedDocuments userId={profile.id} />
        </section>
        <NavigationHistory profile={profile} open={open} />
      </div>
      <footer className={styles['dashboard-footer']}>
        <button onClick={() => open('privacy')}>Политика конфиденциальности</button>
      </footer>
    </div>
  );
}
