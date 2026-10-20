import { useEffect } from 'react';
import { type Profile } from '@/entities/profile';
import { apiRequest, hasSession } from '@/shared/api';
import {
  invalidateAsyncData,
  randomUuid,
  readStored,
  writeStored,
  useAsyncData,
} from '@/shared/lib';

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

let visitorId: string | undefined;
function readerId() {
  if (visitorId) return visitorId;
  const stored = readStored<string>('reader-id', '');
  visitorId = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(stored)
    ? stored
    : randomUuid();
  writeStored('reader-id', visitorId);
  return visitorId;
}

/** Material openings count for everyone; only signed-in visits enter personal history. */
export function recordVisit(visit: Visit) {
  if (visit.type === 'material') {
    // The server atomically deduplicates repeated effects, tabs and reloads.
    apiRequest(`/api/materials/${encodeURIComponent(visit.target)}/view`, {
      method: 'POST',
      body: { visitorId: readerId() },
      auth: hasSession(),
    })
      .then(() =>
        invalidateAsyncData(
          (cached) => cached.endsWith(':history') || cached.endsWith(':questions'),
        ),
      )
      .catch(() => undefined);
    return;
  }
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
