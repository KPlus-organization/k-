import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '@/shared/api';
import { cx } from '@/shared/lib';
import { LoadState, ui } from '@/shared/ui';
import { removeDocument, useSavedDocuments } from '@/entities/document';

export function SavedDocuments({ userId }: { userId: string }) {
  const documents = useSavedDocuments(userId);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const remove = async (id: string) => {
    if (pending) return;
    setPending(true);
    try {
      await removeDocument(userId, id);
      setConfirmId(null);
      setError('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-label="Избранные документы" className="mt-6 border-t border-line pt-5">
      <h3 className="mb-3 text-lg">Избранные документы</h3>
      {documents.loading || documents.error ? (
        <LoadState error={documents.error} onRetry={documents.reload} />
      ) : documents.data?.length ? (
        <ul className="grid list-none gap-4 p-0">
          {documents.data.map((item) => (
            <li key={item.id} className="min-w-0 rounded-lg border border-line p-3">
              <Link
                className={cx(ui['text-link'], 'break-words')}
                to={`/documents/saved/${item.id}`}
              >
                {item.title}
              </Link>
              <p className="my-2 text-sm text-muted">
                {item.complete ? 'Заполнен' : 'Черновик'} ·{' '}
                {new Date(item.updatedAt).toLocaleDateString('ru-RU')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link className={ui['text-link']} to={`/documents/saved/${item.id}`}>
                  Открыть и скачать
                </Link>
                {confirmId === item.id ? (
                  <>
                    <button
                      className={ui['text-link']}
                      disabled={pending}
                      onClick={() => remove(item.id)}
                    >
                      Подтвердить удаление
                    </button>
                    <button
                      className={ui['text-link']}
                      disabled={pending}
                      onClick={() => setConfirmId(null)}
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                    className={ui['text-link']}
                    onClick={() => setConfirmId(item.id)}
                    aria-label={`Удалить документ: ${item.title}`}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Здесь появятся заполненные документы, которые вы сохраните в конструкторе.</p>
      )}
      {error && (
        <p role="alert" className={ui['form-error']}>
          {error}
        </p>
      )}
      <Link to="/documents" className={cx(ui['text-link'], 'mt-4 inline-flex')}>
        Создать документ →
      </Link>
    </section>
  );
}
