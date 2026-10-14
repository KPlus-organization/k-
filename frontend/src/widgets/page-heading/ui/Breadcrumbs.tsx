import { Link } from 'react-router-dom';
import { Fragment } from 'react';
import { cx } from '@/shared/lib';
import { Icon, ui, type IconName } from '@/shared/ui';
import styles from './styles.module.css';

export function Breadcrumbs({
  current,
  article = false,
  parents = [],
}: {
  current: string;
  article?: boolean;
  parents?: { title: string; href: string }[];
}) {
  return (
    <nav className={styles['breadcrumbs']} aria-label="Навигационная цепочка">
      <Link to="/">Главная</Link>
      <Icon name="chevron" size={16} />
      {article && (
        <>
          <Link to="/protect">Защитить нарушенные права</Link>
          <Icon name="chevron" size={16} />
        </>
      )}
      {parents.map((parent) => (
        <Fragment key={parent.href}>
          <Link to={parent.href}>{parent.title}</Link>
          <Icon name="chevron" size={16} />
        </Fragment>
      ))}
      <span aria-current="page">{current}</span>
    </nav>
  );
}
export function PageIntro({
  title,
  description,
  className,
  eyebrow = 'НАРУШЕНИЯ И ПРЕТЕНЗИИ',
  icon = 'shield',
}: {
  title: string;
  description: string;
  className?: string;
  eyebrow?: string;
  icon?: IconName;
}) {
  return (
    <section className={cx(styles['page-intro'], className)}>
      <div className={cx(ui['eyebrow'], styles['eyebrow'])}>
        <span className={cx(ui['icon-tile'], ui['filled'], ui['small'])}>
          <Icon name={icon} />
        </span>
        {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
