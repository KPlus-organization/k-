import { cx } from '@/shared/lib';
import styles from './styles.module.css';

export function Footer({ auth = false, open }: { auth?: boolean; open: (id: string) => void }) {
  return (
    <footer className={cx(styles['footer'], auth ? styles['auth'] : undefined)}>
      <span>© 2026 МоёПраво</span>
      {auth ? (
        <div>
          <button onClick={() => open('privacy')}>Политика конфиденциальности</button>
          <button className="text-brand" onClick={() => open('help')}>
            Нужна помощь?
          </button>
        </div>
      ) : (
        <span>Интеллектуальные права простым языком</span>
      )}
    </footer>
  );
}
