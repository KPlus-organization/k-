import { useState } from 'react';
import { Link } from 'react-router-dom';
import { materialHref, materialLabels } from '@/entities/material';
import { cx, type Open } from '@/shared/lib';
import { Icon, LoadState, ui } from '@/shared/ui';
import { Breadcrumbs } from '@/widgets/page-heading';
import { LegalNotice } from '@/widgets/legal-notice';
import { useQuestions } from '../model/use-questions';
import styles from './styles.module.css';

const PAGE_SIZE = 8;

export function QuestionsPage({
  userId,
  ready,
  open,
}: {
  userId?: string;
  ready: boolean;
  open: Open;
}) {
  const { data, error, reload } = useQuestions(userId, ready);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  if (!data) return <LoadState error={error} onRetry={reload} />;
  const topics = [...new Map(data.items.map((item) => [item.topic, item.topicTitle])).entries()];
  const search = query.trim().toLocaleLowerCase('ru');
  const filtered = data.items.filter(
    (item) =>
      (!topic || item.topic === topic) &&
      `${item.question} ${item.answer} ${item.reference}`.toLocaleLowerCase('ru').includes(search),
  );
  const visible = filtered.slice(0, limit);
  const personal = data.mode === 'personalized';
  return (
    <div className={cx(ui['container'], styles['page'])}>
      <Breadcrumbs current="Вопрос — ответ" />
      <header className={styles['intro']}>
        <span className={styles['badge']}>
          <Icon name="messages" size={18} /> Разберёмся вместе
        </span>
        <h1>Вопрос — ответ</h1>
        <p>
          Короткие ответы на вопросы о правах на ваш продукт. Статьи и чек-листы помогут разобраться
          в деталях.
        </p>
      </header>
      <div className={styles['filters']}>
        <label className={styles['search']} htmlFor="question-search">
          <span>Найти вопрос</span>
          <input
            id="question-search"
            type="search"
            value={query}
            placeholder="Например, скопировали код"
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          />
        </label>
        <label htmlFor="question-topic">
          <span>Тема</span>
          <select
            id="question-topic"
            aria-label="Тема"
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="">Все темы</option>
            {topics.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section aria-labelledby="questions-heading">
        <div className={styles['selection']}>
          <h2 id="questions-heading">
            {query || topic
              ? 'Подходящие вопросы'
              : personal
                ? 'По вашим интересам'
                : data.hasPopularity
                  ? 'Чаще читают'
                  : 'С чего начать'}
          </h2>
          <p>
            {personal
              ? 'Подборка по темам статей и чек-листов, которые вы уже читали.'
              : data.hasPopularity
                ? 'Выше — вопросы, связанные с самыми читаемыми статьями и чек-листами.'
                : 'Начните с вопросов, к которым уже доступны подробные материалы.'}
          </p>
        </div>
        <div className={styles['list']}>
          {visible.map((item) => (
            <details key={item.id} className={styles['question']}>
              <summary>
                <span>
                  <span className={styles['topic']}>{item.topicTitle}</span>
                  <span className={styles['question-title']}>{item.question}</span>
                </span>
                <Icon name="chevron" size={22} />
              </summary>
              <div className={styles['answer']}>
                <p>{item.answer}</p>
                {item.material ? (
                  <Link className={styles['material']} to={materialHref(item.material.id)}>
                    <Icon name="book" size={20} />
                    <span>
                      <span className={styles['topic']}>
                        {materialLabels[item.material.kind]} по теме
                      </span>
                      {item.material.title}
                    </span>
                    <Icon name="arrowRight" size={19} />
                  </Link>
                ) : (
                  <div className={styles['pending']}>
                    <span>Подробный материал готовится</span>
                    <p>{item.reference}</p>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className={ui['empty-result']}>
            <h2>Вопросы не найдены</h2>
            <p>Попробуйте другое слово или выберите другую тему.</p>
            <button
              className={cx(ui['button'], ui['secondary'])}
              onClick={() => {
                setQuery('');
                setTopic('');
                setLimit(PAGE_SIZE);
              }}
            >
              Сбросить поиск
            </button>
          </div>
        )}
        {filtered.length > 0 && (
          <div className={styles['more']}>
            <p role="status">
              Показано {visible.length} из {filtered.length}
            </p>
            {limit < filtered.length && (
              <button
                className={cx(ui['button'], ui['secondary'])}
                onClick={() => setLimit(limit + PAGE_SIZE)}
              >
                Показать ещё {Math.min(PAGE_SIZE, filtered.length - limit)}
              </button>
            )}
          </div>
        )}
      </section>
      <LegalNotice open={open} />
    </div>
  );
}
