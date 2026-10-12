import { useId, useState } from 'react';
import styles from './styles.module.css';

export function InfoTooltip({ label, text }: { label: string; text: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <span
      className={styles['wrapper']}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setVisible(false);
      }}
      onFocus={() => setVisible(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setVisible(false);
      }}
    >
      <button
        onKeyDown={(event) => {
          if (event.key === 'Escape') setVisible(false);
        }}
        type="button"
        className={styles['trigger']}
        aria-label={label}
        aria-describedby={visible ? id : undefined}
        onClick={() => setVisible(true)}
      >
        i
      </button>
      <span id={id} role="tooltip" hidden={!visible} className={styles['tooltip']}>
        <span>{text}</span>
      </span>
    </span>
  );
}
