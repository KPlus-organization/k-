import { Link, useParams } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import {
  materials,
  materialLabels,
  objects,
  MaterialContent,
  ArticleButton,
  type Material,
} from '@/entities/material';
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
  const material = materials.find((item) => item.id === (props.materialId || id));
  if (!material)
    return (
      <section className={ui['empty-state']}>
        <span className={ui['eyebrow']}>404</span>
        <h1>Материал не найден</h1>
        <Link to="/articles" className={cx(ui['button'], ui['primary'])}>
          Все материалы
        </Link>
      </section>
    );
  return <ReadingSession key={material.id} {...props} material={material} />;
}

function ReadingSession({
  material,
  favorites,
  toggleFavorite,
  open,
}: Props & { material: Material }) {
  const saved = favorites.includes(material.id);
  const object = objects.find((item) => item.id === material.topic)!;
  const related = material.related.map((id) => materials.find((item) => item.id === id)!);
  return (
    <div className={cx(ui['container'], styles['page'])}>
      <Breadcrumbs
        current={materialLabels[material.kind]}
        parents={[
          {
            title:
              material.id === 'database-registration'
                ? 'Оформить права'
                : 'Защитить нарушенные права',
            href: material.id === 'database-registration' ? '/ownership' : '/protect',
          },
          { title: object.title, href: object.href || `/articles?topic=${object.id}` },
        ]}
      />
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
            <a
              className={styles['download']}
              href={material.download}
              download={material.sourceFile}
            >
              Скачать исходный DOCX ↓
            </a>
          </div>
          <h2>Разобраться в деталях</h2>
          <div className="mt-4 grid gap-4">
            {related.map((item) => (
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
