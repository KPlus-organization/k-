import { useCallback } from 'react';
import { apiRequest } from '@/shared/api';
import { invalidateAsyncData, useAsyncData } from '@/shared/lib';
import type {
  DocumentTemplate,
  DocumentValues,
  SavedDocument,
  SavedDocumentSummary,
  TemplateSummary,
} from '../model/types';

const loadTemplates = () =>
  apiRequest<{ items: TemplateSummary[] }>('/api/document-templates', { auth: true }).then(
    (result) => result.items,
  );
export const useDocumentTemplates = (userId: string | undefined) =>
  useAsyncData(userId ? `user:${userId}:document-templates` : null, loadTemplates);
export function useDocumentTemplate(userId: string | undefined, id: string | null) {
  const load = useCallback(
    () => apiRequest<DocumentTemplate>(`/api/document-templates/${id}`, { auth: true }),
    [id],
  );
  return useAsyncData(userId && id ? `user:${userId}:document-template:${id}` : null, load);
}
export function useSavedDocuments(userId: string | undefined) {
  const load = useCallback(
    () =>
      apiRequest<{ items: SavedDocumentSummary[] }>('/api/documents', { auth: true }).then(
        (result) => result.items,
      ),
    [],
  );
  return useAsyncData(userId ? `user:${userId}:documents` : null, load);
}
export function useSavedDocument(userId: string | undefined, id?: string) {
  const load = useCallback(
    () =>
      apiRequest<SavedDocument>(`/api/documents/${encodeURIComponent(id ?? '')}`, { auth: true }),
    [id],
  );
  return useAsyncData(userId && id ? `user:${userId}:document:${id}` : null, load);
}
export async function saveDocument(
  userId: string,
  id: string,
  template: DocumentTemplate,
  title: string,
  fields: DocumentValues,
) {
  const result = await apiRequest<SavedDocument>(`/api/documents/${id}`, {
    method: 'PUT',
    auth: true,
    body: { templateId: template.id, templateVersion: template.version, title, fields },
  });
  invalidateAsyncData(
    (key) => key === `user:${userId}:documents` || key === `user:${userId}:document:${id}`,
  );
  return result;
}
export async function removeDocument(userId: string, id: string) {
  await apiRequest(`/api/documents/${id}`, { method: 'DELETE', auth: true });
  invalidateAsyncData(
    (key) => key === `user:${userId}:documents` || key === `user:${userId}:document:${id}`,
  );
}
export async function downloadDocument(
  template: DocumentTemplate,
  fields: DocumentValues,
  savedId?: string,
) {
  const blob = await apiRequest<Blob>(
    savedId
      ? `/api/documents/${savedId}/download`
      : `/api/document-templates/${template.id}/download`,
    {
      method: 'POST',
      auth: true,
      response: 'blob',
      body: { fields },
    },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'Претензия — программный код.docx';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
