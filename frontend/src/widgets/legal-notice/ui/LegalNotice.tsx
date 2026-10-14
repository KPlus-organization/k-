import { cx } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import styles from './styles.module.css';

export function LegalNotice({
  open,
  compact = false,
}: {
  open: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <aside
      className={cx(styles['legal-notice'], compact ? styles['compact'] : undefined)}
      aria-label="Обратите внимание"
    >
      <Icon name="info" />
      <div className={styles['copy']}>
        <strong>Обратите внимание!</strong>
        <p>
          {compact
            ? 'Материал носит общий характер и не заменяет консультацию юриста по вашему делу. Правовые нормы сверены с актуальной редакцией, и данный материал актуален на 13.10.26.'
            : 'Материал носит общий информационный характер и не заменяет консультации юриста.'}
        </p>
      </div>
      <div className={styles['actions']}>
        <button className={cx(ui['button'], ui['secondary'])} onClick={() => open('lawyer')}>
          Найти юриста <Icon name="arrowUp" size={18} />
        </button>
        <button className={cx(ui['button'], ui['primary'])} onClick={() => open('lawyer-request')}>
          Обсудить задачу с юристом <Icon name="messages" size={18} />
        </button>
      </div>
    </aside>
  );
}
