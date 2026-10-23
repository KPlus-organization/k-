import { Link } from 'react-router-dom';
import { Icon } from '@/shared/ui';
import { usePopularQuestions } from '../model/use-popular-questions';
import styles from './styles.module.css';

/** Three most read questions with a link to the full list; nothing while loading or on error. */
export function PopularQuestions() {
  const { data } = usePopularQuestions();
  if (!data?.items.length) return null;
  return (
    <div className={styles['popular']}>
      <ul>
        {data.items.map((item) => (
          <li key={item.id}>
            <Link className={styles['question']} to={`/questions#${item.id}`}>
              <span>{item.question}</span>
              <Icon name="chevron" size={18} />
            </Link>
          </li>
        ))}
      </ul>
      <Link className={styles['all']} to="/questions">
        Все вопросы <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}
