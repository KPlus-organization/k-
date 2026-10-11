import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '@/shared/lib';
import { Icon } from '../icon/Icon';
import ui from '../styles.module.css';
import styles from './styles.module.css';

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles['modal']}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onPointerDown={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={styles['modal-heading']}>
        <h2 id="modal-title">{title}</h2>
        <button
          className={cx(ui['icon-button'], styles['icon-button'])}
          aria-label="Закрыть"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
