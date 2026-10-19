import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { tools } from '@/shared/config';
import { Icon, ui } from '@/shared/ui';
import { type Profile } from '@/entities/profile';
import { topicHref, useObjects } from '@/entities/material';
import { SearchForm } from '@/features/search';
import styles from './styles.module.css';

export function SiteHeader({
  profile,
  signedIn,
  onOpen,
}: {
  profile: Profile | null;
  signedIn: boolean;
  onOpen: Open;
}) {
  const [menu, setMenu] = useState(false);
  const objects = useObjects().data ?? [];
  const menuRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const open: Open = (id) => {
    setMenu(false);
    onOpen(id);
  };
  const toolAction = (id: string) => (id === 'articles' ? navigate('/articles') : open(id));
  useEffect(() => {
    if (!menu) return;
    navRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false);
        menuRef.current?.focus();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [menu]);
  return (
    <>
      {' '}
      <header className={styles['site-header']}>
        <button
          ref={menuRef}
          className={cx(
            cx(styles['menu-button'], ui['icon-button']),
            menu ? styles['active'] : undefined,
          )}
          aria-label={menu ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menu}
          aria-controls="site-navigation"
          onClick={() => setMenu(!menu)}
        >
          <Icon name="menu" size={22} />
        </button>
        <Link to="/" className={styles['brand']} aria-label="МоёПраво — главная">
          Мо<span>ё</span>Право
        </Link>
        <SearchForm />
        <Link
          className={styles['account-link']}
          aria-labelledby="account-label"
          to={signedIn ? '/profile' : '/login'}
        >
          <span id="account-label">{signedIn && profile ? profile.name : 'Личный кабинет'}</span>
          <span className={styles['avatar']}>
            {signedIn && profile ? (
              profile.name
                .split(' ')
                .map((word) => word[0])
                .slice(0, 2)
                .join('')
            ) : (
              <Icon name="user" />
            )}
          </span>
        </Link>
      </header>
      {menu && (
        <>
          <button
            className={styles['menu-outside']}
            tabIndex={-1}
            aria-label="Закрыть меню"
            onClick={() => setMenu(false)}
          />
          <nav
            ref={navRef}
            id="site-navigation"
            className={styles['side-menu']}
            aria-label="Основная навигация"
          >
            <h2>
              <Link to="/articles">Информационные статьи на тему:</Link>
            </h2>
            <div className={styles['menu-links']}>
              {objects.map((item) => (
                <Link key={item.id} to={topicHref(item.id)}>
                  {item.title}
                  {item.id === 'brand'
                    ? ' (логотип, название, коммерческое обозначение и фирменное наименование, домен)'
                    : item.id === 'visuals'
                      ? ' (используемые рисунки, картинки, фото, видео)'
                      : ''}
                </Link>
              ))}
            </div>
            <h2>Инструменты</h2>
            <div className={styles['menu-links']}>
              {[tools[3], tools[2]].map((tool) => (
                <button key={tool.id} onClick={() => toolAction(tool.id)}>
                  {tool.title}
                </button>
              ))}
            </div>
            <h2>
              <button onClick={() => open('questions')}>Вопрос — ответ</button>
            </h2>
          </nav>
        </>
      )}
    </>
  );
}
