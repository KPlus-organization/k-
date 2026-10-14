import { Link } from 'react-router-dom';
import { Icon, InfoTooltip, LoadState, ui } from '@/shared/ui';
import { useObjects, materialAreaTitles, objectActionHref } from '@/entities/material';
import { Breadcrumbs, PageIntro } from '@/widgets/page-heading';
import styles from './styles.module.css';

export function Protect({
  defend = false,
  ownership = false,
}: {
  defend?: boolean;
  ownership?: boolean;
}) {
  const area = ownership ? 'ownership' : defend ? 'defend' : 'protect';
  const title = materialAreaTitles[area];
  const objects = useObjects();
  return (
    <div className={ui['container']}>
      <Breadcrumbs current={title} />
      <PageIntro
        title={title}
        eyebrow={ownership ? 'ОФОРМЛЕНИЕ ПРАВ' : undefined}
        icon={ownership ? 'file' : undefined}
        description={
          ownership
            ? 'Разберитесь, кому принадлежат права на ваш продукт и как оформить необходимые документы.'
            : defend
              ? 'Вам предъявили претензию или иск о нарушении чужих прав? Подготовьте ответ.'
              : 'Ваш продукт или его часть используют без разрешения? Разберитесь, как действовать.'
        }
      />
      <section className={styles['objects-section']}>
        <h2>
          {ownership
            ? 'На какой объект оформить права?'
            : defend
              ? 'К какому объекту относится претензия?'
              : 'Какой объект защитить?'}
        </h2>
        <p>Пояснение к каждому объекту — под значком i.</p>
        {!objects.data && <LoadState error={objects.error} onRetry={objects.reload} />}
        <div className={styles['objects-grid']}>
          {objects.data?.map((item) => {
            const href = objectActionHref(item.id, area);
            return (
              <div key={item.id} className={styles['object-card']} data-testid="object-card">
                <div className={styles['object-heading']}>
                  {href ? (
                    <Link className={styles['object-title']} to={href}>
                      <h3>{item.title}</h3>
                      <Icon name="chevron" size={18} />
                    </Link>
                  ) : (
                    <h3 className={styles['object-title']}>{item.title}</h3>
                  )}
                  <InfoTooltip label={`Об объекте «${item.title}»`} text={item.description} />
                </div>
                {!href && <span className={styles['status']}>Раздел пока не готов</span>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
