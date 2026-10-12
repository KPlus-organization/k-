import { Link, useSearchParams } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import { articles, objects, ArticleButton } from '@/entities/material';
import { Breadcrumbs } from '@/widgets/page-heading';

export function ArticlesPage({
  favorites,
  toggleFavorite,
  open,
}: {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  open: Open;
}) {
  const [params] = useSearchParams();
  const topic = objects.find((item) => item.id === params.get('topic'));
  const shown = topic ? articles.filter((item) => item.topic === topic.id) : articles;
  return (
    <div className={cx(ui['container'], ui['listing-page'])}>
      <Breadcrumbs current="Информационные статьи" />
      <h1>{topic ? topic.title : 'Информационные статьи'}</h1>
      <p>
        {topic?.description ||
          'Материалы о правах на элементы продукта, их использовании и защите.'}
      </p>
      <div className={ui['topic-filters']}>
        <Link className={!topic ? ui['selected'] : undefined} to="/articles">
          Все материалы
        </Link>
        {objects.map((item) => (
          <Link
            className={topic?.id === item.id ? ui['selected'] : undefined}
            key={item.id}
            to={`/articles?topic=${item.id}`}
          >
            {item.title}
          </Link>
        ))}
      </div>
      {shown.length ? (
        <div className="grid grid-cols-1 gap-5 min-[951px]:grid-cols-2">
          {shown.map((item) => (
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
      ) : (
        <div className={ui['empty-result']}>
          <Icon name="book" size={32} />
          <h2>Материалы готовятся</h2>
          <p>Пока можно познакомиться с другими разделами.</p>
          <Link to="/articles" className={cx(ui['button'], ui['secondary'])}>
            Все материалы
          </Link>
        </div>
      )}
    </div>
  );
}
