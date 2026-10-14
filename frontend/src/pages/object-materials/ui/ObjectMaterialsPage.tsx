import { Link } from 'react-router-dom';
import { cx, useDocumentTitle, type Open } from '@/shared/lib';
import { LoadState, ui } from '@/shared/ui';
import {
  ArticleButton,
  materialAreaTitles,
  materialLabels,
  objectJourney,
  useMaterials,
  useObjects,
  type MaterialArea,
} from '@/entities/material';
import { Breadcrumbs, PageIntro } from '@/widgets/page-heading';

export function ObjectMaterialsPage({
  topic,
  area,
  open,
}: {
  topic: string;
  area: MaterialArea;
  open: Open;
}) {
  const objects = useObjects();
  const materials = useMaterials(topic);
  const object = objects.data?.find((item) => item.id === topic);
  useDocumentTitle(object?.title);
  if (objects.data && !object)
    return (
      <section className={ui['empty-state']}>
        <h1>Объект не найден</h1>
        <Link to={`/${area}`} className={cx(ui['button'], ui['primary'])}>
          Выбрать объект
        </Link>
      </section>
    );
  if (!object || !materials.data)
    return (
      <LoadState
        error={objects.error ?? materials.error}
        onRetry={() => {
          objects.reload();
          materials.reload();
        }}
      />
    );
  const ids = objectJourney(topic, area).materials;
  const available = materials.data;
  const content = ids.flatMap((id) => {
    const material = available.find((item) => item.id === id && item.hasContent);
    return material ? [material] : [];
  });
  return (
    <div className={cx(ui['container'], 'pb-15')}>
      <Breadcrumbs
        current={object.title}
        parents={[{ title: materialAreaTitles[area], href: `/${area}` }]}
      />
      <PageIntro
        title={object.title}
        eyebrow={materialAreaTitles[area]}
        description={
          area === 'defend'
            ? 'Материалы, которые помогут разобраться в предъявленной претензии и подготовиться к её обсуждению с юристом.'
            : area === 'protect'
              ? 'Материалы о доказательствах нарушения и способах защиты ваших прав.'
              : 'Материалы о закреплении и оформлении прав на ваш продукт.'
        }
      />
      {content.length ? (
        <>
          <h2 className="mt-8 mb-5">Статьи и чек-листы</h2>
          <div className="grid gap-5 min-[951px]:grid-cols-2">
            {content.map((item) => (
              <section key={item.id} className={ui['result-card']}>
                <span className={cx(ui['tag'], 'mb-4')}>{materialLabels[item.kind]}</span>
                <ArticleButton item={item} open={open} />
              </section>
            ))}
          </div>
        </>
      ) : (
        <section className={cx(ui['result-card'], 'mt-8')}>
          <h2>Материалы по этому объекту готовятся</h2>
          <p className="mt-3 mb-6">
            Пока здесь нет подходящих статей и чек-листов. Вы можете описать свою ситуацию в заявке
            на консультацию.
          </p>
          <button
            className={cx(ui['button'], ui['primary'])}
            onClick={() => open('lawyer-request')}
          >
            Обсудить задачу с юристом
          </button>
        </section>
      )}
    </div>
  );
}
