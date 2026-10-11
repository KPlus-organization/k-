import { Link, useSearchParams } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import { articles, objects, ArticleButton, materialSearchText } from '@/entities/material';
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
  const normalized = query.toLocaleLowerCase('ru');
  const found = articles.filter((item) =>
    (
      materialSearchText[item.id] || `${item.title} ${item.description}`.toLocaleLowerCase('ru')
    ).includes(normalized),
  );
  const foundObjects = objects.filter((item) =>
    `${item.title} ${item.description}`.toLocaleLowerCase('ru').includes(normalized),
  );
  return (
    <div className={cx(ui['container'], ui['listing-page'])}>
      <Breadcrumbs current="Поиск" />
      <h1>Результаты поиска</h1>
      <p>
        {query
          ? `По запросу «${query}» найдено: ${found.length + foundObjects.length}`
          : 'Введите вопрос в строке поиска или выберите материал ниже.'}
      </p>
      {found.length + foundObjects.length === 0 ? (
        <div className={ui['empty-result']}>
          <Icon name="search" size={32} />
          <h2>Ничего не найдено</h2>
          <p>Попробуйте другой запрос: «код», «товарный знак» или «дизайн».</p>
        </div>
      ) : (
        <div className="mt-7.5 grid max-w-[1000px] gap-4">
          {foundObjects.map((item) => (
            <div className={ui['result-card']} key={item.id}>
              <span className={ui['tag']}>Объект защиты</span>
              {item.href ? (
                <Link to={item.href}>
                  <h2>{item.title}</h2>
                </Link>
              ) : (
                <button onClick={() => open(`object:${item.id}`)}>
                  <h2>{item.title}</h2>
                </button>
              )}
              <p>{item.description}</p>
            </div>
          ))}
          {found.map((item) => (
            <div className={ui['result-card']} key={item.id}>
              <ArticleButton item={item} open={open} className={ui['result-item']} />
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
