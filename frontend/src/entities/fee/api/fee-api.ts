import { useCallback } from 'react';
import { apiRequest } from '@/shared/api';
import { useAsyncData } from '@/shared/lib';
import type { FeeResult, FeeSchedule, FeeScheduleSummary, FeeValues } from '../model/types';

const loadSchedules = () =>
  apiRequest<{ items: FeeScheduleSummary[] }>('/api/fees').then((response) => response.items);

export function useFeeSchedules() {
  return useAsyncData('fees', loadSchedules);
}

export function useFeeSchedule(id: string | undefined) {
  const load = useCallback(
    () => apiRequest<FeeSchedule>(`/api/fees/${encodeURIComponent(id ?? '')}`),
    [id],
  );
  return useAsyncData(id ? `fees:${id}` : null, load);
}

/** The calculation is done by the server, which holds the current rates. */
export function calculateFee(scheduleId: string, fee: string, values: FeeValues) {
  return apiRequest<FeeResult>(`/api/fees/${encodeURIComponent(scheduleId)}/calculate`, {
    method: 'POST',
    body: { fee, values },
  });
}
