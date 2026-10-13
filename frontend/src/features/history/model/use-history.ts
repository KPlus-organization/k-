import { useEffect } from 'react';
import { type Profile } from '@/entities/profile';
import { apiRequest, hasSession } from '@/shared/api';
import { invalidateAsyncData, useAsyncData } from '@/shared/lib';

export type HistoryEntry = {
  id: string;
  type: 'material' | 'search' | 'tool';
  /** material: material id; search: query; tool: tool id */
  target: string;
  title: string;
  visitedAt: string;
};

type Visit = Pick<HistoryEntry, 'type' | 'target' | 'title'>;

const loadHistory = () =>
  apiRequest<{ items: HistoryEntry[] }>('/api/history?limit=20', { auth: true }).then(
    (response) => response.items,
  );

/** Recent navigation history of the signed-in user. */
export function useHistory(profile: Profile | null) {
  return useAsyncData(profile ? `user:${profile.id}:history` : null, loadHistory);
}

// Skips repeats of the same visit, e.g. a reload or React's double effects in development.
const REPEAT_WINDOW_MS = 10_000;
const lastVisits = new Map<string, number>();

/** Records a visit for a signed-in user. Failures are ignored: history is not essential. */
export function recordVisit(visit: Visit) {
  if (!hasSession()) return;
  const key = `${visit.type}:${visit.target}`;
  const now = Date.now();
  if (now - (lastVisits.get(key) ?? 0) < REPEAT_WINDOW_MS) return;
  lastVisits.set(key, now);

  apiRequest('/api/history', { method: 'POST', body: visit, auth: true })
    .then(() => invalidateAsyncData((cached) => cached.endsWith(':history')))
    .catch(() => undefined);
}

/** Records a visit once `visit` is known (pass null while loading). */
export function useRecordVisit(visit: Visit | null) {
  const type = visit?.type;
  const target = visit?.target;
  const title = visit?.title;
  useEffect(() => {
    if (type && target && title) recordVisit({ type, target, title });
  }, [type, target, title]);
}
