import { Link } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon } from '@/shared/ui';
import type { articles } from '../model/catalog';
import styles from './styles.module.css';

export function ArticleButton({
  item,
  open,
  className,
}: {
  item: (typeof articles)[number];
  open: Open;
  className?: string;
}) {
  const content = (
    <>
      <Icon name="bookmark" />
      <span>
        <strong>{item.title}</strong>
        <small>{item.description}</small>
      </span>
      <Icon name="chevron" size={18} />
    </>
  );
  return item.href ? (
    <Link className={cx(styles['favorite-item'], className)} to={item.href}>
      {content}
    </Link>
  ) : (
    <button
      className={cx(styles['favorite-item'], className)}
      onClick={() => open(`article:${item.id}`)}
    >
      {content}
    </button>
  );
}
