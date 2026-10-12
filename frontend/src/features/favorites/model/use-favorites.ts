import { usePersistentState } from '@/shared/lib';
export function useFavorites() {
  const [favorites, setFavorites] = usePersistentState<string[]>('favorites', [
    'application',
    'deadlines',
    'classes',
  ]);
  const toggleFavorite = (id: string) => {
    const adding = !favorites.includes(id);
    setFavorites((current) => (adding ? [...current, id] : current.filter((item) => item !== id)));
    return adding;
  };
  return { favorites, toggleFavorite };
}
