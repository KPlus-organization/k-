import { Link, useParams } from 'react-router-dom';
import { cx, useDocumentTitle } from '@/shared/lib';
import { Icon, LoadState, ui } from '@/shared/ui';
import { useObjects } from '@/entities/material';
import { useDocumentTemplates } from '@/entities/document';
import { Breadcrumbs } from '@/widgets/page-heading';
import styles from './styles.module.css';

export function DocumentsPage({ userId }: { userId: string | undefined }) {
  const { kind } = useParams();
  const objects = useObjects();
  const templates = useDocumentTemplates(userId);
  const kindTitle = kind === 'claim' ? 'Претензия' : 'Договор';
  useDocumentTitle(kind ? `${kindTitle} — выбор объекта` : 'Конструктор документов');
  if (kind && !['claim', 'contract'].includes(kind))
    return (
      <div className={ui['empty-state']}>
        <h1>Раздел не найден</h1>
        <Link to="/documents">В конструктор</Link>
      </div>
    );
  return (
    <div className={cx(ui['container'], styles['page'])}>
      <Breadcrumbs
        current={kind ? kindTitle : 'Конструктор документов'}
        parents={kind ? [{ title: 'Конструктор документов', href: '/documents' }] : []}
      />
      <header className={styles['intro']}>
        <span className={ui['eyebrow']}>
          {kind ? 'ШАГ 2 · ВЫБЕРИТЕ ОБЪЕКТ' : 'ШАГ 1 · ВЫБЕРИТЕ ДОКУМЕНТ'}
        </span>
        <h1>
          {kind
            ? `Для какого объекта нужна ${kind === 'claim' ? 'претензия' : 'форма договора'}?`
            : 'Конструктор документов'}
        </h1>
        <p>
          {kind
            ? 'Сейчас доступна претензия по программному коду. Остальные шаблоны готовятся.'
            : 'Выберите документ и объект, заполните сведения и получите файл. Заполненную версию можно сохранить в избранное.'}
        </p>
      </header>
      {!kind ? (
        <div className={styles['cards']}>
          <Link to="/documents/contract" className={styles['card']}>
            <Icon name="file" size={28} />
            <h2>Договор</h2>
            <p>Оформление отношений и прав на результаты работы.</p>
            <span>Выбрать объект →</span>
          </Link>
          <Link to="/documents/claim" className={styles['card']}>
            <Icon name="shield" size={28} />
            <h2>Претензия</h2>
            <p>Обращение к тому, кто использует ваш продукт без разрешения.</p>
            <span>Выбрать объект →</span>
          </Link>
        </div>
      ) : !objects.data || !templates.data ? (
        <LoadState
          error={objects.error ?? templates.error}
          onRetry={() => {
            objects.reload();
            templates.reload();
          }}
        />
      ) : (
        <div className={styles['cards']}>
          {objects.data.map((object) => {
            const available = templates.data?.some(
              (item) => item.kind === kind && item.object === object.id,
            );
            return (
              <Link
                to={`/documents/${kind}/${object.id}`}
                key={object.id}
                className={styles['card']}
              >
                <h2>{object.title}</h2>
                <p>{object.description}</p>
                <span>{available ? 'Заполнить шаблон →' : 'Шаблон готовится'}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
