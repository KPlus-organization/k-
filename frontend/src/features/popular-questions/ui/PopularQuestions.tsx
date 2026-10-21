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
      <p className={styles['note']}>
        {data.hasPopularity ? 'Наиболее популярные' : 'С чего начать'}
      </p>
      <ul>
        {data.items.map((item) => (
          <li key={item.id}>
            <Link to={`/questions#${item.id}`}>{item.question}</Link>
          </li>
        ))}
      </ul>
      <Link className={styles['all']} to="/questions">
        Все вопросы <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}
