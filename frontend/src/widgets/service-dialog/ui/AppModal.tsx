import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { tools } from '@/shared/config';
import { Icon, Modal, ui } from '@/shared/ui';
import { type Profile } from '@/entities/profile';
import {
  ArticleButton,
  objectHref,
  useMaterials,
  useObjects,
  type MaterialSummary,
} from '@/entities/material';
import { ProfileSettings } from '@/features/profile-settings';
import { LawyerRequest } from '@/features/lawyer-request';
import { SavedDocuments } from '@/features/saved-documents';
import { modalTitles } from '../model/modal-ids';
import { personalDataConsent } from '../model/personal-data-consent';
import styles from './styles.module.css';

export function AppModal({
  id,
  profile,
  open,
  onClose,
  onSaveProfile,
  onRequestSubmitted,
  favorites,
  toggleFavorite,
}: {
  id: string;
  profile: Profile | null;
  open: Open;
  onClose: () => void;
  onSaveProfile: (changes: Partial<Pick<Profile, 'name' | 'login' | 'email'>>) => Promise<void>;
  onRequestSubmitted: () => void;
  favorites: MaterialSummary[];
  toggleFavorite: (id: string) => void;
}) {
  const objects = useObjects().data ?? [];
  const materials = useMaterials().data ?? [];
  const object = id.startsWith('object:')
    ? objects.find((item) => item.id === id.split(':')[1])
    : undefined;
  const objectPage = object && objectHref(object.id);
  const article = id.startsWith('article:')
    ? materials.find((item) => item.id === id.split(':')[1])
    : undefined;
  const saved = (materialId: string) => favorites.some((item) => item.id === materialId);
  const tool = tools.find((item) => item.id === id);
  const title = object?.title || article?.title || tool?.title || modalTitles[id] || 'Материал';
  let body: ReactNode;
  if (id === 'definition:presumption')
    body = <p>Суд считает утверждение истинным, пока не доказано обратное.</p>;
  else if (id === 'lawyer-request')
    body = (
      <LawyerRequest
        key={profile?.id ?? 'guest'}
        profile={profile}
        onSubmitted={onRequestSubmitted}
      />
    );
  else if (id === 'settings')
    body = profile ? (
      <ProfileSettings profile={profile} onSave={onSaveProfile} />
    ) : (
      <p>Войдите в профиль, чтобы изменить настройки.</p>
    );
  else if (id === 'favorites')
    body = (
      <div className={ui['favorite-list']}>
        {profile && <SavedDocuments userId={profile.id} />}
        {favorites.length ? (
          favorites.map((item) => (
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
        {objectPage ? (
          <Link className={cx(ui['button'], ui['primary'])} to={objectPage}>
            {object.id === 'code' ? 'Открыть чек-лист' : 'Статьи и чек-листы'}{' '}
            <Icon name="arrowRight" />
          </Link>
        ) : (
          <>
            <p className="text-muted">Подробный чек-лист для этого объекта готовится.</p>
            <Link className={cx(ui['button'], ui['secondary'])} to={`/articles?topic=${object.id}`}>
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
          aria-pressed={saved(article.id)}
          onClick={() => toggleFavorite(article.id)}
        >
          <Icon name="bookmark" size={18} />
          {saved(article.id) ? 'Убрать из избранного' : 'Сохранить в избранное'}
        </button>
        {article.id.startsWith('code') && (
          <Link className={ui['text-link']} to="/protect/code">
            Открыть чек-лист по защите кода →
          </Link>
        )}
      </>
    );
  else if (id === 'personal-data-consent')
    body = (
      <div className={styles['consent-document']}>
        <p>(далее — Согласие)</p>
        <p>{personalDataConsent.intro}</p>
        <ul>
          {personalDataConsent.purposes.map((purpose) => (
            <li key={purpose}>{purpose}</li>
          ))}
        </ul>
        {personalDataConsent.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>{personalDataConsent.date}</p>
        <button className={cx(ui['button'], ui['primary'])} onClick={onClose}>
          Вернуться к регистрации
        </button>
      </div>
    );
  else if (id === 'privacy')
    body = (
      <>
        <p>
          Данные профиля (логин, email, имя), избранное и история навигации хранятся на сервере
          «МоёПраво» и используются только для работы личного кабинета.
        </p>
        <p>
          Пароль хранится в виде криптографического хеша: восстановить его по сохранённым данным
          нельзя. Полный текст политики конфиденциальности готовится.
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
          Восстановление пароля по email пока недоступно: сервис ещё не отправляет письма. Войти
          можно по логину или email с текущим паролем.
        </p>
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
          Избранное и история сохраняются в личном кабинете. Найти материалы можно через поиск
          вверху страницы.
        </p>
        <Link className={cx(ui['button'], ui['primary'])} to="/protect">
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
        <Link className={cx(ui['button'], ui['primary'])} to="/protect/code">
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
