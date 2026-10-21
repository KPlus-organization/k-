import { useCallback } from 'react';
import { apiRequest } from '@/shared/api';
import { useAsyncData } from '@/shared/lib';

export type PopularQuestion = { id: string; question: string };

const COUNT = 3;

/** The most read questions for everyone, regardless of the visitor's own history. */
export function usePopularQuestions() {
  const loader = useCallback(
    () =>
      apiRequest<{ hasPopularity: boolean; items: PopularQuestion[] }>(
        `/api/questions?order=popular&limit=${COUNT}`,
      ),
    [],
  );
  return useAsyncData('popular-questions', loader);
}
