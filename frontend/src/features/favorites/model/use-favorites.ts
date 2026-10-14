import { useCallback } from 'react';
import { type MaterialSummary } from '@/entities/material';
import { type Profile } from '@/entities/profile';
import { apiRequest } from '@/shared/api';
import { invalidateAsyncData, updateAsyncData, useAsyncData } from '@/shared/lib';

export type Favorite = { material: MaterialSummary; addedAt: string };

const loadFavorites = () =>
  apiRequest<{ items: Favorite[] }>('/api/favorites', { auth: true }).then(
    (response) => response.items,
  );

/** Favorites of the signed-in user; a guest has none. */
export function useFavorites(profile: Profile | null) {
  const key = profile ? `user:${profile.id}:favorites` : null;
  const { data } = useAsyncData(key, loadFavorites);
  const items = data ?? [];
  const favorites = items.map((item) => item.material.id);

  const addFavorite = useCallback(
    async (id: string) => {
      if (!key) throw new Error('addFavorite() requires a signed-in user');
      await apiRequest(`/api/favorites/${encodeURIComponent(id)}`, { method: 'PUT', auth: true });
      invalidateAsyncData((cached) => cached === key);
    },
    [key],
  );

  /** Adds or removes a material; resolves to true if it was added. */
  const toggleFavorite = useCallback(
    async (id: string) => {
      if (!key) throw new Error('toggleFavorite() requires a signed-in user');
      const adding = !favorites.includes(id);
      // Removal is shown at once; an addition appears when the list reloads.
      if (!adding)
        updateAsyncData<Favorite[]>(key, (list) =>
          (list ?? []).filter((item) => item.material.id !== id),
        );
      try {
        await apiRequest(`/api/favorites/${encodeURIComponent(id)}`, {
          method: adding ? 'PUT' : 'DELETE',
          auth: true,
        });
      } finally {
        invalidateAsyncData((cached) => cached === key);
      }
      return adding;
    },
    [key, favorites],
  );

  return { favorites, items, toggleFavorite, addFavorite };
}
