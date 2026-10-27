import { type ReactNode } from 'react';
import styles from './styles.module.css';

/** A reference to a legal act: opens its text in a new tab, or is plain text without a link. */
export function LawLink({
  href,
  children,
}: {
  href: string | null | undefined;
  children: ReactNode;
}) {
  if (!href) return children;
  return (
    <a className={styles['law-link']} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
