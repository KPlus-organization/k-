import { Link } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon } from '@/shared/ui';
import { materialHref } from '../model/routes';
import type { MaterialSummary } from '../model/types';
import styles from './styles.module.css';

export function ArticleButton({
  item,
  open,
  className,
  searchQuery,
}: {
  item: MaterialSummary;
  open: Open;
  className?: string;
  searchQuery?: string;
}) {
  const href = searchQuery
    ? `${materialHref(item.id)}?q=${encodeURIComponent(searchQuery)}`
    : materialHref(item.id);
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
  // Materials without published text open a card in a dialog instead of a page.
  return item.hasContent ? (
    <Link className={cx(styles['favorite-item'], className)} to={href}>
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
