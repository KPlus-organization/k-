import { Link } from 'react-router-dom';
import { cx, useDocumentTitle, type Open } from '@/shared/lib';
import { Icon, LoadState, ui } from '@/shared/ui';
import {
  ArticleButton,
  materialHref,
  materialLabels,
  useMaterials,
  useObjects,
} from '@/entities/material';
import { Breadcrumbs, PageIntro } from '@/widgets/page-heading';

export function ObjectMaterialsPage({ topic, open }: { topic: string; open: Open }) {
  const objects = useObjects();
  const materials = useMaterials(topic);
  const object = objects.data?.find((item) => item.id === topic);
  useDocumentTitle(object?.title);
  if (!object || !materials.data)
    return (
      <LoadState
        error={objects.error ?? materials.error ?? (objects.data && !object)}
        onRetry={() => {
          objects.reload();
          materials.reload();
        }}
      />
    );
  // Announced materials without text are listed in the catalog, not on the object page.
  const content = materials.data.filter((item) => item.hasContent);
  return (
    <div className={cx(ui['container'], 'pb-15')}>
      <Breadcrumbs current={object.title} article />
      <PageIntro title={object.title} description={object.description} />
      <h2 className="mt-8 mb-5">Статьи и чек-листы</h2>
      <div className="grid gap-5 min-[951px]:grid-cols-2">
        {content.map((item) => (
          <section key={item.id} className={ui['result-card']}>
            <span className={cx(ui['tag'], 'mb-4')}>{materialLabels[item.kind]}</span>
            <ArticleButton item={item} open={open} />
          </section>
        ))}
      </div>
    </div>
  );
}

const OWNERSHIP_MATERIAL = 'database-registration';

export function OwnershipPage() {
  const materials = useMaterials();
  const material = materials.data?.find((item) => item.id === OWNERSHIP_MATERIAL);
  return (
    <div className={cx(ui['container'], 'pb-15')}>
      <Breadcrumbs current="Оформить права" />
      <h1>Оформить права</h1>
      <p className="mt-4 mb-8">Материалы о закреплении прав на элементы вашего продукта.</p>
      {material ? (
        <section className={cx(ui['result-card'], 'max-w-3xl')}>
          <span className={ui['tag']}>Базы данных</span>
          <h2>{material.title}</h2>
          <p className="mb-5">{material.description}</p>
          <Link to={materialHref(material.id)} className={cx(ui['button'], ui['primary'])}>
            Открыть чек-лист <Icon name="arrowRight" size={18} />
          </Link>
        </section>
      ) : (
        materials.data === undefined && (
          <LoadState error={materials.error} onRetry={materials.reload} />
        )
      )}
    </div>
  );
}
