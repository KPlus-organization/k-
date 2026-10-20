import { Link, useSearchParams } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon, LoadState, ui } from '@/shared/ui';
import { ArticleButton, objectHref, useContentSearch } from '@/entities/material';
import { useRecordVisit } from '@/features/history';
import { Breadcrumbs } from '@/widgets/page-heading';

export function SearchPage({
  favorites,
  toggleFavorite,
  open,
}: {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  open: Open;
}) {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() || '';
  const search = useContentSearch(query);
  useRecordVisit(query ? { type: 'search', target: query, title: `Поиск: ${query}` } : null);
  const foundObjects = search.data?.objects ?? [];
  const found = search.data?.materials ?? [];
  const total = foundObjects.length + found.length;
  return (
    <div className={cx(ui['container'], ui['listing-page'])}>
      <Breadcrumbs current="Поиск" />
      <h1>Результаты поиска</h1>
      <p>
        {!query
          ? 'Введите вопрос в строке поиска или выберите материал ниже.'
          : search.data
            ? `По запросу «${query}» найдено: ${total}`
            : `Ищем «${query}»…`}
      </p>
      {query && !search.data ? (
        <LoadState error={search.error} onRetry={search.reload} />
      ) : total === 0 ? (
        <div className={ui['empty-result']}>
          <Icon name="search" size={32} />
          <h2>Ничего не найдено</h2>
          <p>Попробуйте другой запрос: «код», «товарный знак» или «дизайн».</p>
        </div>
      ) : (
        <div className="mt-7.5 grid max-w-[1000px] gap-4">
          {foundObjects.map((item) => {
            const href = objectHref(item.id);
            return (
              <div className={ui['result-card']} key={item.id}>
                <span className={ui['tag']}>Объект защиты</span>
                {href ? (
                  <Link to={`${href}?q=${encodeURIComponent(query)}`}>
                    <h2>{item.title}</h2>
                  </Link>
                ) : (
                  <button onClick={() => open(`object:${item.id}`)}>
                    <h2>{item.title}</h2>
                  </button>
                )}
                <p>{item.description}</p>
              </div>
            );
          })}
          {found.map((item) => (
            <div className={ui['result-card']} key={item.id}>
              <ArticleButton
                item={item}
                open={open}
                className={ui['result-item']}
                searchQuery={query}
              />
              <button
                className={cx(ui['button'], ui['secondary'])}
                onClick={() => toggleFavorite(item.id)}
                aria-pressed={favorites.includes(item.id)}
              >
                <Icon name="bookmark" size={17} />
                {favorites.includes(item.id) ? 'В избранном' : 'В избранное'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
