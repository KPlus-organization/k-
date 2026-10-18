import { Link } from 'react-router-dom';
import { Icon, InfoTooltip, LoadState } from '@/shared/ui';
import { useObjects, objectActionHref, type MaterialArea } from '@/entities/material';
import styles from './styles.module.css';

export function ObjectSelector({ area }: { area: MaterialArea }) {
  const objects = useObjects();
  return (
    <section id="objects" className={styles['section']} aria-labelledby="objects-title">
      <h2 id="objects-title">
        {area === 'defend'
          ? 'К какому объекту относится претензия?'
          : area === 'protect'
            ? 'Какой объект защитить?'
            : 'На какой объект оформить права?'}
      </h2>
      <p>Перейдите к материалам по вашему объекту. Пояснения — под значком i.</p>
      {!objects.data && <LoadState error={objects.error} onRetry={objects.reload} />}
      <div className={styles['grid']}>
        {objects.data?.map((item) => {
          const href = objectActionHref(item.id, area);
          return (
            <div key={item.id} className={styles['card']} data-testid="object-card">
              <div className={styles['heading']}>
                {href ? (
                  <Link className={styles['title']} to={href}>
                    <h3>{item.title}</h3>
                    <Icon name="chevron" size={18} />
                  </Link>
                ) : (
                  <h3 className={styles['title']}>{item.title}</h3>
                )}
                <InfoTooltip label={`Об объекте «${item.title}»`} text={item.description} />
              </div>
              {!href && <span className={styles['status']}>Раздел пока не готов</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
