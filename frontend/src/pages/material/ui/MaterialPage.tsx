import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { apiUrl, isNotFound } from '@/shared/api';
import { cx, useDocumentTitle, type Open } from '@/shared/lib';
import { Icon, LoadState, ui } from '@/shared/ui';
import {
  materialLabels,
  HighlightedText,
  MaterialContent,
  ArticleButton,
  topicHref,
  useMaterial,
  useMaterials,
  useObjects,
  materialArea,
  materialAreaTitles,
  objectActionHref,
  objectJourney,
  type MaterialArea,
  type Material,
} from '@/entities/material';
import { useRecordVisit } from '@/features/history';
import { Breadcrumbs } from '@/widgets/page-heading';
import { LegalNotice } from '@/widgets/legal-notice';
import { ObjectSelector } from '@/widgets/object-selector';
import styles from './styles.module.css';

type Props = {
  materialId?: string;
  journeyArea?: MaterialArea;
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

const HIGHLIGHT_MS = 2500;

function ReadingSession({
  material,
  favorites,
  toggleFavorite,
  open,
  journeyArea,
}: Props & { material: Material }) {
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const [shownQuery, setShownQuery] = useState(query);
  useEffect(() => {
    if (!hash) return;
    let anchor: string;
    try {
      anchor = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const frame = requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [hash, material.id]);
  useEffect(() => {
    if (!query) return undefined;
    const frame = requestAnimationFrame(() => {
      document.querySelector('[data-search-hit]')?.scrollIntoView({ block: 'center' });
    });
    const timer = window.setTimeout(() => {
      setShownQuery('');
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, HIGHLIGHT_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [query, material.id, setParams]);
  const saved = favorites.includes(material.id);
  const object = useObjects().data?.find((item) => item.id === material.topic);
  const area = journeyArea ?? materialArea(material.id);
  const isOverview = ['protect-overview', 'defend-overview'].includes(material.id);
  const sourceNotice = material.intro.find(
    (block) => block.type === 'note' && block.anchor === 'legal-notice',
  );
  const noticeText =
    sourceNotice?.type === 'note'
      ? sourceNotice.runs
          .map((run) => run.text)
          .join('')
          .replace(/^Обратите внимание!\s*/, '')
      : undefined;
  const intro = material.intro.filter((block) => block !== sourceNotice);
  const topicMaterials = useMaterials(material.topic ?? undefined).data;
  const related = journeyArea
    ? objectJourney(material.topic ?? '', journeyArea).materials.flatMap((id) => {
        const item = (topicMaterials ?? material.related).find((entry) => entry.id === id);
        return item && item.id !== material.id && item.hasContent ? [item] : [];
      })
    : material.related;
  const parents = [
    { title: materialAreaTitles[area], href: `/${area}` },
    ...(object
      ? [{ title: object.title, href: objectActionHref(object.id, area) ?? topicHref(object.id) }]
      : []),
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
        <h1>
          <HighlightedText text={material.pageTitle} query={shownQuery} />
        </h1>
        <p>
          <HighlightedText text={material.description} query={shownQuery} />
        </p>
        {isOverview && (
          <a className={cx(ui['text-link'], 'mt-4 inline-block')} href="#objects">
            Перейти к выбору объекта ↓
          </a>
        )}
      </header>
      <div className={styles['layout']}>
        <article className={styles['article']} aria-label={material.title}>
          <MaterialContent blocks={intro} open={open} headingLevel={2} query={shownQuery} />
          <div className="grid gap-6">
            {material.sections.map((section) => (
              <section
                id={section.id}
                key={section.id}
                data-testid="guide-step"
                className={styles['step']}
              >
                <h2>
                  <HighlightedText text={section.title} query={shownQuery} />
                </h2>
                <MaterialContent blocks={section.blocks} open={open} query={shownQuery} />
              </section>
            ))}
          </div>
          {isOverview && <ObjectSelector area={area} />}
          <div className="mt-8">
            <LegalNotice open={open} compact text={noticeText} />
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
                Скачать файл ↓
              </a>
            )}
          </div>
          <h2>Разобраться в деталях</h2>
          <div className="mt-4 grid gap-4">
            {related.map((item) => (
              <ArticleButton key={item.id} item={item} open={open} />
            ))}
          </div>
          <Link
            className={cx(ui['text-link'], 'mt-5')}
            to={material.topic ? `/articles?topic=${material.topic}` : '/articles'}
          >
            {material.topic ? 'Все материалы по теме' : 'Все материалы'} →
          </Link>
        </aside>
      </div>
    </div>
  );
}
