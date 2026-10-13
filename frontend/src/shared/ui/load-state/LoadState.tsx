import { errorMessage } from '@/shared/api';
import { cx } from '@/shared/lib';
import { Icon } from '../icon/Icon';
import ui from '../styles.module.css';

/** Placeholder while data loads, or an error with a retry button. */
export function LoadState({
  error,
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}) {
  if (!error)
    return (
      <p className="py-24 text-center text-muted" role="status">
        Загрузка…
      </p>
    );
  return (
    <section className={ui['empty-state']} role="alert">
      <span className={ui['icon-tile']}>
        <Icon name="info" />
      </span>
      <h1>Не удалось загрузить данные</h1>
      <p>{message ?? errorMessage(error)}</p>
      {onRetry && (
        <button className={cx(ui['button'], ui['primary'])} onClick={onRetry}>
          Повторить
        </button>
      )}
    </section>
  );
}
