import { Link, useParams } from 'react-router-dom';
import { apiUrl, isNotFound } from '@/shared/api';
import { cx, useDocumentTitle, type Open } from '@/shared/lib';
import { Icon, LoadState, ui } from '@/shared/ui';
import {
  materialLabels,
  MaterialContent,
  ArticleButton,
  topicHref,
  useMaterial,
  useObjects,
  type Material,
} from '@/entities/material';
import { useRecordVisit } from '@/features/history';
import { Breadcrumbs } from '@/widgets/page-heading';
import { LegalNotice } from '@/widgets/legal-notice';
import styles from './styles.module.css';

type Props = {
  materialId?: string;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  open: Open;
};

export function MaterialPage(props: Props) {
  const { id } = useParams();
  const { data: material, error, reload } = useMaterial(props.materialId ?? id ?? '');
  useDocumentTitle(material?.pageTitle);
  useRecordVisit(
    material
      ? {
          type: 'material',
          target: material.id,
          title: `${materialLabels[material.kind]}: ${material.title}`,
        }
      : null,
  );
  if (isNotFound(error))
    return (
      <section className={ui['empty-state']}>
        <span className={ui['eyebrow']}>404</span>
        <h1>Материал не найден</h1>
        <Link to="/articles" className={cx(ui['button'], ui['primary'])}>
          Все материалы
        </Link>
      </section>
    );
  if (!material) return <LoadState error={error} onRetry={reload} />;
  return <ReadingSession key={material.id} {...props} material={material} />;
}

function ReadingSession({
  material,
  favorites,
  toggleFavorite,
  open,
}: Props & { material: Material }) {
  const saved = favorites.includes(material.id);
  const object = useObjects().data?.find((item) => item.id === material.topic);
  const parents = [
    material.id === 'database-registration'
      ? { title: 'Оформить права', href: '/ownership' }
      : { title: 'Защитить нарушенные права', href: '/protect' },
    ...(object ? [{ title: object.title, href: topicHref(object.id) }] : []),
  ];
  return (
    <div className={cx(ui['container'], styles['page'])}>
      <Breadcrumbs current={materialLabels[material.kind]} parents={parents} />
      <header className={styles['intro']}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className={ui['tag']}>{materialLabels[material.kind]}</span>
          {material.sections.length > 0 && (
            <span className="text-sm text-muted">Шагов: {material.sections.length}</span>
          )}
        </div>
        <h1>{material.pageTitle}</h1>
        <p>{material.description}</p>
      </header>
      <div className={styles['layout']}>
        <article className={styles['article']} aria-label={material.title}>
          <MaterialContent blocks={material.intro} open={open} headingLevel={2} />
          <div className="grid gap-6">
            {material.sections.map((section) => (
              <section
                id={section.id}
                key={section.id}
                data-testid="guide-step"
                className={styles['step']}
              >
                <h2>{section.title}</h2>
                <MaterialContent blocks={section.blocks} open={open} />
              </section>
            ))}
          </div>
          <div className="mt-8">
            <LegalNotice open={open} compact />
          </div>
        </article>
        <aside className={styles['sidebar']}>
          <div className={styles['toc']}>
            <h2>{material.sections.length ? 'В этом чек-листе' : 'Сохранить материал'}</h2>
            {material.sections.length > 0 && (
              <>
                <nav aria-label="Шаги чек-листа" className="mt-5 grid gap-4">
                  {material.sections.map((section, index) => (
                    <a key={section.id} href={`#${section.id}`}>
                      <span>{index + 1}</span>
                      {section.toc}
                    </a>
                  ))}
                </nav>
              </>
            )}
            <button
              className={cx(ui['button'], ui['secondary'], 'mt-4 w-full')}
              onClick={() => toggleFavorite(material.id)}
              aria-pressed={saved}
            >
              <Icon name="bookmark" size={17} />
              {saved
                ? 'В избранном'
                : material.kind === 'checklist'
                  ? 'Сохранить чек-лист'
                  : 'Сохранить материал'}
            </button>
            {material.download && (
              <a className={styles['download']} href={apiUrl(material.download.url)}>
                Скачать исходный DOCX ↓
              </a>
            )}
          </div>
          <h2>Разобраться в деталях</h2>
          <div className="mt-4 grid gap-4">
            {material.related.map((item) => (
              <ArticleButton key={item.id} item={item} open={open} />
            ))}
          </div>
          <Link className={cx(ui['text-link'], 'mt-5')} to={`/articles?topic=${material.topic}`}>
            Все материалы по теме →
          </Link>
        </aside>
      </div>
    </div>
  );
}
