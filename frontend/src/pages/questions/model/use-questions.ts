import { useCallback, useEffect } from 'react';
import type { MaterialSummary } from '@/entities/material';
import { apiRequest } from '@/shared/api';
import { clearAsyncData, useAsyncData } from '@/shared/lib';

export type Question = {
  id: string;
  topic: string;
  topicTitle: string;
  question: string;
  answer: string;
  /** Parts of the answer that link to legal acts, in the order they occur in it. */
  answerLinks: { text: string; href: string }[];
  reference: string;
  material: MaterialSummary | null;
};

export function useQuestions(userId: string | undefined, ready: boolean) {
  const authenticated = Boolean(userId);
  const loader = useCallback(
    () =>
      apiRequest<{
        mode: 'popular' | 'personalized';
        hasPopularity: boolean;
        total: number;
        items: Question[];
      }>('/api/questions?limit=100', { auth: authenticated }),
    [authenticated],
  );
  const key = ready ? `${userId ? `user:${userId}` : 'public'}:questions` : null;
  const result = useAsyncData(key, loader);
  // Fetch a fresh ranking next time this page opens, including other readers' views.
  useEffect(
    () => () => {
      if (key) clearAsyncData((cached) => cached === key);
    },
    [key],
  );
  return result;
}
