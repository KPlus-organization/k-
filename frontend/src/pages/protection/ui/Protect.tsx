import { Link } from 'react-router-dom';
import { Icon, InfoTooltip, ui } from '@/shared/ui';
import { objects } from '@/entities/material';
import { Breadcrumbs, PageIntro } from '@/widgets/page-heading';
import styles from './styles.module.css';

export function Protect({ defend = false }: { defend?: boolean }) {
  const title = defend ? 'Оспорить претензию о нарушении чужих прав' : 'Защитить нарушенные права';
  return (
    <div className={ui['container']}>
      <Breadcrumbs current={title} />
      <PageIntro
        title={title}
        description={
          defend
            ? 'Вам предъявили претензию или иск о нарушении чужих прав? Подготовьте ответ.'
            : 'Ваш продукт или его часть используют без разрешения? Разберитесь, как действовать.'
        }
      />
      <section className={styles['objects-section']}>
        <h2>{defend ? 'К какому объекту относится претензия?' : 'Какой объект защитить?'}</h2>
        <p>Пояснение к каждому объекту — под значком i.</p>
        <div className={styles['objects-grid']}>
          {objects.map((item) => {
            const available = !defend && item.id === 'code';
            return (
              <div key={item.id} className={styles['object-card']} data-testid="object-card">
                <div className={styles['object-heading']}>
                  {available ? (
                    <Link className={styles['object-title']} to="/protect/code">
                      <h3>{item.title}</h3>
                      <Icon name="chevron" size={18} />
                    </Link>
                  ) : (
                    <h3 className={styles['object-title']}>{item.title}</h3>
                  )}
                  <InfoTooltip label={`Об объекте «${item.title}»`} text={item.description} />
                </div>
                {!available && <span className={styles['status']}>Раздел пока не готов</span>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
