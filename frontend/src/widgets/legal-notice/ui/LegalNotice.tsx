import { useEffect, useState } from 'react';
import { cx } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import styles from './styles.module.css';

// «…материал актуален на 21.10.26» or «…на 21.10.2026» in the default text and in the
// notes of materials: the date shown is always today's, in the same format.
const RELEVANCE_DATE = /(актуален на )\d{2}\.\d{2}\.(\d{4}|\d{2})/u;

/** Today's date; changes at midnight while the page stays open. */
function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const midnight = new Date(today);
    midnight.setHours(24, 0, 0, 0);
    const timer = setTimeout(() => setToday(new Date()), midnight.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [today]);
  return today;
}

function withRelevanceDate(text: string, today: Date) {
  return text.replace(RELEVANCE_DATE, (_, prefix: string, year: string) => {
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${prefix}${day}.${month}.${String(today.getFullYear()).slice(-year.length)}`;
  });
}

export function LegalNotice({
  open,
  compact = false,
  text,
}: {
  open: (id: string) => void;
  compact?: boolean;
  text?: string;
}) {
  const today = useToday();
  return (
    <aside
      className={cx(styles['legal-notice'], compact ? styles['compact'] : undefined)}
      aria-label="Обратите внимание"
    >
      <Icon name="info" />
      <div className={styles['copy']}>
        <strong>Обратите внимание!</strong>
        <p>
          {withRelevanceDate(
            text ??
              (compact
                ? 'Материал носит общий характер и не заменяет консультацию юриста по вашему делу. Правовые нормы сверены с актуальной редакцией, и данный материал актуален на 21.10.26.'
                : 'Материал носит общий информационный характер и не заменяет консультации юриста.'),
            today,
          )}
        </p>
      </div>
      <div className={styles['actions']}>
        <button className={cx(ui['button'], ui['secondary'])} onClick={() => open('lawyer')}>
          Найти юриста <Icon name="arrowUp" size={18} />
        </button>
        <button className={cx(ui['button'], ui['primary'])} onClick={() => open('lawyer-request')}>
          Обсудить задачу с нами <Icon name="messages" size={18} />
        </button>
      </div>
    </aside>
  );
}
