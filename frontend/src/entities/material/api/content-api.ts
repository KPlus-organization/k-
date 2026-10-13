import { useCallback } from 'react';
import { apiRequest } from '@/shared/api';
import { useAsyncData } from '@/shared/lib';
import type { Material, MaterialSummary, ProtectionObject, SearchResult } from '../model/types';

const loadObjects = () =>
  apiRequest<{ items: ProtectionObject[] }>('/api/objects').then((response) => response.items);

export function useObjects() {
  return useAsyncData('objects', loadObjects);
}

/** All published materials, or those of one protection object. */
export function useMaterials(topic?: string) {
  const load = useCallback(
    () =>
      apiRequest<{ items: MaterialSummary[] }>(
        topic ? `/api/materials?topic=${encodeURIComponent(topic)}` : '/api/materials',
      ).then((response) => response.items),
    [topic],
  );
  return useAsyncData(`materials:${topic ?? ''}`, load);
}

export function useMaterial(id: string) {
  const load = useCallback(
    () => apiRequest<Material>(`/api/materials/${encodeURIComponent(id)}`),
    [id],
  );
  return useAsyncData(`material:${id}`, load);
}

export function useContentSearch(query: string) {
  const load = useCallback(
    () => apiRequest<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`),
    [query],
  );
  return useAsyncData(query ? `search:${query}` : null, load);
}
