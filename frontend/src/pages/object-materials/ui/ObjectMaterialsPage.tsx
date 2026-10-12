import { Link } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import { objects, materials, ArticleButton, materialLabels } from '@/entities/material';
import { Breadcrumbs, PageIntro } from '@/widgets/page-heading';

export function ObjectMaterialsPage({ topic, open }: { topic: string; open: Open }) {
  const object = objects.find((item) => item.id === topic)!;
  const content = materials.filter((item) => item.topic === topic);
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

export function OwnershipPage() {
  const material = materials.find((item) => item.id === 'database-registration')!;
  return (
    <div className={cx(ui['container'], 'pb-15')}>
      <Breadcrumbs current="Оформить права" />
      <h1>Оформить права</h1>
      <p className="mt-4 mb-8">Материалы о закреплении прав на элементы вашего продукта.</p>
      <section className={cx(ui['result-card'], 'max-w-3xl')}>
        <span className={ui['tag']}>Базы данных</span>
        <h2>{material.title}</h2>
        <p className="mb-5">{material.description}</p>
        <Link to={material.href} className={cx(ui['button'], ui['primary'])}>
          Открыть чек-лист <Icon name="arrowRight" size={18} />
        </Link>
      </section>
    </div>
  );
}
