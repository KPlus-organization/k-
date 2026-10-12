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
    <aside className={cx(styles['legal-notice'], compact ? styles['compact'] : undefined)}>
      <Icon name="info" />
      <div>
        <strong>Информация помогает сориентироваться, но не заменяет юриста</strong>
        <p>
          Материалы сервиса не являются на 100% точной рекомендацией для вашей ситуации. Для решения
          конкретного вопроса рекомендуем обратиться к нашим юристам-партнёрам.
        </p>
      </div>
      {!compact && (
        <button
          className={cx(ui['button'], styles['button'], ui['primary'])}
          onClick={() => open('lawyer')}
        >
          Найти юриста <Icon name="arrowUp" size={18} />
        </button>
      )}
    </aside>
  );
}
