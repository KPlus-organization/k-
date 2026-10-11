import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/shared/ui';
import styles from './styles.module.css';

export function SearchForm() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  return (
    <form
      className={styles['search-box']}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <button type="submit" aria-label="Найти">
        <Icon name="search" />
      </button>
      <input
        ref={searchRef}
        aria-label="Поиск по сайту"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти ответ о коде, дизайне, правах…"
      />
    </form>
  );
}
