import { Link } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import { type Profile } from '@/entities/profile';
import { articles, ArticleButton } from '@/entities/material';
import styles from './styles.module.css';

export function ProfilePage({
  profile,
  favorites,
  open,
  logout,
  signedIn,
  login,
}: {
  profile: Profile;
  favorites: string[];
  open: Open;
  logout: () => void;
  signedIn: boolean;
  login: () => void;
}) {
  if (!signedIn)
    return (
      <section className={ui['empty-state']}>
        <span className={ui['icon-tile']}>
          <Icon name="user" />
        </span>
        <h1>Ваш личный кабинет</h1>
        <p>Войдите в профиль или посмотрите, как устроен кабинет.</p>
        <div className={ui['button-row']}>
          <Link to="/login" className={cx(ui['button'], styles['button'], ui['primary'])}>
            Войти в профиль
          </Link>
          <button className={cx(ui['button'], styles['button'], ui['secondary'])} onClick={login}>
            Открыть демо-профиль
          </button>
        </div>
      </section>
    );
  const saved = articles.filter((item) => favorites.includes(item.id));
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
            <dt>Email</dt>
            <dd>{profile.email}</dd>
            <dt>Дата регистрации</dt>
            <dd>{profile.registered}</dd>
          </dl>
        </section>
        <section className={cx(styles['panel'], styles['favorites-panel'])}>
          <div className={styles['panel-heading']}>
            <h2>Избранные статьи</h2>
            <button
              className={cx(ui['button'], styles['button'], ui['tinted'])}
              onClick={() => open('favorites')}
            >
              Все избранные <Icon name="arrowUp" size={17} />
            </button>
          </div>
          <div className={ui['favorite-list']}>
            {saved.length ? (
              saved
                .slice(0, 3)
                .map((item) => <ArticleButton key={item.id} item={item} open={open} />)
            ) : (
              <p>Пока здесь пусто. Сохраняйте статьи и чек-листы, чтобы вернуться к ним позже.</p>
            )}
          </div>
        </section>
        <section className={cx(styles['panel'], styles['history-panel'])}>
          <h2>История навигации</h2>
          <div className={styles['history-group']}>
            <p>
              <Icon name="clock" size={18} />
              Сегодня, 14:20
            </p>
            <button onClick={() => open('calculator')}>Калькулятор пошлин</button>
            <Link to="/protect/code">Чек-лист: Защитить программный код</Link>
            <button onClick={() => open('documents')}>
              Конструктор документов: заявка на регистрацию товарного знака
            </button>
          </div>
          <div className={styles['history-group']}>
            <p>
              <Icon name="clock" size={18} />
              11 сентября, 9:00
            </p>
            <button onClick={() => open('trademark')}>Проверка товарных знаков</button>
            <button onClick={() => open('article:classes')}>
              Статья: Что такое МКТУ и как правильно выбрать классы
            </button>
            <Link to="/search?q=МКТУ">Поиск: что такое МКТУ?</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
