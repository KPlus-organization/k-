import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { tools } from '@/shared/config';
import { Icon, Modal, ui } from '@/shared/ui';
import { type Profile } from '@/entities/profile';
import { articles, objects, ArticleButton } from '@/entities/material';
import { ProfileSettings } from '@/features/profile-settings';
import styles from './styles.module.css';

export function AppModal({
  id,
  profile,
  open,
  onClose,
  onSaveProfile,
  favorites,
  toggleFavorite,
}: {
  id: string;
  profile: Profile;
  open: Open;
  onClose: () => void;
  onSaveProfile: (profile: Profile) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}) {
  const object = id.startsWith('object:')
    ? objects.find((item) => item.id === id.split(':')[1])
    : undefined;
  const article = id.startsWith('article:')
    ? articles.find((item) => item.id === id.split(':')[1])
    : undefined;
  const titles: Record<string, string> = {
    settings: 'Настройки профиля',
    favorites: 'Все избранные',
    privacy: 'Конфиденциальность',
    reset: 'Восстановление пароля',
    help: 'Помощь',
    lawyer: 'Найти юриста',
    ownership: 'Оформить права',
    risks: 'Рассчитать риски',
    defend: 'Защититься',
    'definition:presumption': 'Что такое презумпция?',
  };
  const tool = tools.find((item) => item.id === id);
  const title = object?.title || article?.title || tool?.title || titles[id] || 'Материал';
  let body: ReactNode;
  if (id === 'definition:presumption')
    body = <p>Суд считает утверждение истинным, пока не доказано обратное.</p>;
  else if (id === 'settings') body = <ProfileSettings profile={profile} onSave={onSaveProfile} />;
  else if (id === 'favorites')
    body = (
      <div className={ui['favorite-list']}>
        {favorites.length ? (
          articles
            .filter((item) => favorites.includes(item.id))
            .map((item) => (
              <div className={styles['saved-row']} data-testid="saved-row" key={item.id}>
                <ArticleButton item={item} open={open} />
                <button
                  className={cx(ui['icon-button'], styles['icon-button'])}
                  aria-label={`Удалить из избранного: ${item.title}`}
                  onClick={() => toggleFavorite(item.id)}
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
            ))
        ) : (
          <p>Пока нет сохранённых материалов.</p>
        )}
      </div>
    );
  else if (object)
    body = (
      <>
        <p>{object.description}</p>
        {object.href ? (
          <Link className={cx(ui['button'], ui['primary'])} onClick={onClose} to={object.href}>
            {object.id === 'code' ? 'Открыть чек-лист' : 'Статьи и чек-листы'}{' '}
            <Icon name="arrowRight" />
          </Link>
        ) : (
          <>
            <p className="text-muted">Подробный чек-лист для этого объекта готовится.</p>
            <Link
              className={cx(ui['button'], ui['secondary'])}
              onClick={onClose}
              to={`/articles?topic=${object.id}`}
            >
              Материалы по теме
            </Link>
          </>
        )}
      </>
    );
  else if (article)
    body = (
      <>
        <p>{article.description}</p>
        <div className={styles['availability-note']}>
          <Icon name="book" />
          <p>
            Полный текст статьи пока не опубликован. Сохраните материал, чтобы вернуться к нему
            позже.
          </p>
        </div>
        <button
          className={cx(ui['button'], ui['secondary'])}
          aria-pressed={favorites.includes(article.id)}
          onClick={() => toggleFavorite(article.id)}
        >
          <Icon name="bookmark" size={18} />
          {favorites.includes(article.id) ? 'Убрать из избранного' : 'Сохранить в избранное'}
        </button>
        {article.id.startsWith('code') && (
          <Link onClick={onClose} className={ui['text-link']} to="/protect/code">
            Открыть чек-лист по защите кода →
          </Link>
        )}
      </>
    );
  else if (id === 'privacy')
    body = (
      <>
        <p>
          Это демонстрационная версия «МоёПраво». Данные профиля и избранное сохраняются только в
          этом браузере.
        </p>
        <p>
          Пароли не сохраняются и не отправляются на сервер. Политика для рабочего сервиса будет
          доступна после запуска регистрации.
        </p>
        <button className={cx(ui['button'], ui['primary'])} onClick={onClose}>
          Понятно
        </button>
      </>
    );
  else if (id === 'reset')
    body = (
      <>
        <p>
          В демонстрационной версии восстановление не требуется: для входа можно использовать любой
          логин и пароль от 8 символов.
        </p>
        <p className="text-muted">Письма не отправляются.</p>
        <button className={cx(ui['button'], ui['primary'])} onClick={onClose}>
          Вернуться ко входу
        </button>
      </>
    );
  else if (id === 'help')
    body = (
      <>
        <p>
          Начните с раздела «Защитить»: выберите программный код и откройте чек-лист. Для перехода к
          нужному шагу используйте оглавление.
        </p>
        <p>
          Избранное сохраняется в вашем браузере. Найти материалы можно через поиск вверху страницы.
        </p>
        <Link className={cx(ui['button'], ui['primary'])} onClick={onClose} to="/protect">
          Перейти к защите прав
        </Link>
      </>
    );
  else
    body = (
      <>
        {tool && <p>{tool.description}</p>}
        <div className={styles['availability-note']}>
          <Icon name={id === 'lawyer' ? 'user' : 'files'} />
          <p>
            {id === 'lawyer'
              ? 'Каталог юристов пока недоступен. Можно подготовить материалы к консультации с помощью чек-листа.'
              : 'Этот раздел готовится. Пока доступны материалы и чек-лист по защите программного кода.'}
          </p>
        </div>
        <Link className={cx(ui['button'], ui['primary'])} onClick={onClose} to="/protect/code">
          Открыть чек-лист <Icon name="arrowRight" size={18} />
        </Link>
      </>
    );
  return (
    <Modal title={title} onClose={onClose}>
      {body}
    </Modal>
  );
}
