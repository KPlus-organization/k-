import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, errorMessage, isNotFound } from '@/shared/api';
import { cx, useDocumentTitle, type Open } from '@/shared/lib';
import { LoadState, ui } from '@/shared/ui';
import type { Profile } from '@/entities/profile';
import {
  activeValues,
  matches,
  renderDocument,
  useDocumentTemplate,
  useSavedDocument,
  saveDocument,
  downloadDocument,
  type DocumentTemplate,
  type DocumentValues,
  type SavedDocument,
  type TemplateField,
} from '@/entities/document';
import { Breadcrumbs } from '@/widgets/page-heading';
import styles from './styles.module.css';

type Props = { profile: Profile | null; status: 'loading' | 'guest' | 'user'; open: Open };
type Draft = {
  id: string;
  title: string;
  fields: DocumentValues;
  ownerId: string;
  templateVersion: number;
};
const DRAFT_KEY = 'moe-pravo:document:code-claim';
function readDraft(template: DocumentTemplate, ownerId: string): Draft | undefined {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    if (
      !draft ||
      draft.templateVersion !== template.version ||
      typeof draft.id !== 'string' ||
      typeof draft.title !== 'string' ||
      !draft.fields ||
      typeof draft.fields !== 'object'
    )
      return;
    if (draft.ownerId !== ownerId) return;
    if (!Object.values(draft.fields).every((value) => typeof value === 'string')) return;
    return draft;
  } catch {
    return;
  }
}
function writeDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
function forgetDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* The saved server copy is still available. */
  }
}

export function DocumentEditorPage({ profile, status, open }: Props) {
  const { kind, objectId, savedId } = useParams();
  const available = kind === 'claim' && objectId === 'code';
  const template = useDocumentTemplate(profile?.id, !savedId && available ? 'code-claim' : null);
  const saved = useSavedDocument(profile?.id, savedId);
  useDocumentTitle(savedId ? saved.data?.title : (template.data?.title ?? 'Шаблон документа'));
  if (status === 'loading' || !profile) return <LoadState />;
  if (savedId && isNotFound(saved.error))
    return (
      <section className={ui['empty-state']}>
        <h1>Документ не найден</h1>
        <p>Проверьте, что вы вошли в профиль, в котором сохраняли документ.</p>
        <Link to="/profile">В личный кабинет</Link>
      </section>
    );
  if (!savedId && !available)
    return (
      <div className={cx(ui['container'], styles['page'])}>
        <Breadcrumbs
          current="Шаблон готовится"
          parents={[{ title: 'Конструктор документов', href: '/documents' }]}
        />
        <section className={ui['empty-state']}>
          <h1>Этот шаблон готовится</h1>
          <p>Пока доступна претензия о нарушении прав на программный код.</p>
          <div className={ui['button-row']}>
            <Link className={cx(ui['button'], ui['primary'])} to="/documents/claim/code">
              Открыть претензию по коду
            </Link>
            <button
              className={cx(ui['button'], ui['secondary'])}
              onClick={() => open('lawyer-request')}
            >
              Обсудить задачу с юристом
            </button>
          </div>
        </section>
      </div>
    );
  const actual = savedId ? saved.data?.template : template.data;
  if (!actual)
    return (
      <LoadState
        error={savedId ? saved.error : template.error}
        onRetry={savedId ? saved.reload : template.reload}
      />
    );
  return (
    <DocumentEditor
      key={`${savedId ?? actual.id}:${profile.id}`}
      template={actual}
      saved={savedId ? saved.data : undefined}
      profile={profile}
      open={open}
    />
  );
}

function DocumentEditor({
  template,
  saved,
  profile,
  open,
}: {
  template: DocumentTemplate;
  saved?: SavedDocument;
  profile: Profile;
  open: Open;
}) {
  const navigate = useNavigate();
  const [initial] = useState(() => (saved ? undefined : readDraft(template, profile.id)));
  const [id] = useState(() => saved?.id ?? initial?.id ?? crypto.randomUUID());
  const [title, setTitle] = useState(saved?.title ?? initial?.title ?? template.title);
  const [fields, setFields] = useState<DocumentValues>(() => ({
    ...defaultValues(template),
    ...(saved?.fields ?? initial?.fields ?? {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const persisted = useRef(false);
  const [dirty, setDirty] = useState(false);
  const active = activeValues(template, fields);
  const shownFields = template.fields.filter((field) => matches(field.when, active));
  const required = shownFields.filter((field) => field.required);
  const remaining = required.filter((field) => !fields[field.id]?.trim()).length;
  const paragraphs = renderDocument(template, fields);

  useEffect(() => {
    if (!saved && !persisted.current)
      writeDraft({
        id,
        title,
        fields,
        ownerId: profile.id,
        templateVersion: template.version,
      });
  }, [fields, id, profile.id, saved, template.version, title]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const showError = useCallback((error: unknown) => {
    setFailed(true);
    const issues =
      error instanceof ApiError && error.code === 'VALIDATION_ERROR' ? error.details : [];
    setErrors(Object.fromEntries(issues.map((issue) => [issue.field, issue.message])));
    setMessage(issues.length ? 'Проверьте отмеченные поля.' : errorMessage(error));
  }, []);

  useEffect(() => {
    const first = Object.keys(errors)[0];
    if (!busy && first) document.getElementById(`document-${first}`)?.focus();
  }, [busy, errors]);

  const save = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    setFailed(false);
    setErrors({});
    try {
      const result = await saveDocument(profile.id, id, template, title, fields);
      persisted.current = true;
      if (!saved) forgetDraft();
      setDirty(false);
      setMessage(
        result.complete
          ? 'Документ сохранён в избранном.'
          : 'Черновик сохранён в избранном. Для скачивания заполните обязательные поля.',
      );
      if (!saved)
        navigate(`/documents/saved/${id}`, { replace: true, state: { documentSaved: true } });
    } catch (error) {
      showError(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [fields, id, navigate, profile, saved, showError, template, title]);

  const download = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setErrors({});
    setMessage('');
    setFailed(false);
    try {
      await downloadDocument(template, fields, saved?.id);
      setMessage('Файл подготовлен к скачиванию.');
    } catch (error) {
      showError(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const update = (field: string, value: string) => {
    setFields((previous) => ({ ...previous, [field]: value }));
    setDirty(true);
    setMessage('');
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const clear = () => {
    if (pending.current) return;
    setFields(defaultValues(template));
    setTitle(template.title);
    setErrors({});
    setFailed(false);
    setDirty(Boolean(saved));
    if (!saved) forgetDraft();
    setMessage(
      saved
        ? 'Форма очищена. Чтобы обновить документ в избранном, сохраните изменения.'
        : 'Форма очищена. Можно заполнить её заново.',
    );
  };

  return (
    <div className={cx(ui['container'], styles['page'])}>
      <Breadcrumbs
        current="Заполнение претензии"
        parents={[
          { title: 'Конструктор документов', href: '/documents' },
          { title: 'Претензия', href: '/documents/claim' },
        ]}
      />
      <header className={styles['intro']}>
        <span className={ui['eyebrow']}>ПРОГРАММНЫЙ КОД · ЗАПОЛНЕНИЕ</span>
        <h1>{template.title}</h1>
        <p>{template.description}</p>
      </header>
      <div className={styles['toolbar']}>
        <div>
          <strong>
            {remaining
              ? `Осталось обязательных полей: ${remaining}`
              : 'Обязательные поля заполнены'}
          </strong>
          <p>
            {saved
              ? dirty
                ? 'Есть несохранённые изменения.'
                : 'Документ в избранном. Можно продолжить редактирование.'
              : 'Можно сохранить черновик и вернуться к заполнению позже.'}
          </p>
        </div>
        <div className={ui['button-row']}>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className={cx(ui['button'], ui['secondary'])}
          >
            {busy ? 'Подождите…' : saved ? 'Сохранить изменения' : 'Сохранить в избранное'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={download}
            className={cx(ui['button'], ui['primary'])}
          >
            Скачать DOCX
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clear}
            className={cx(ui['button'], ui['secondary'])}
          >
            Очистить форму
          </button>
        </div>
        <a href="#document-preview" className={ui['text-link']}>
          Посмотреть текст документа ↓
        </a>
        {saved && (
          <Link to="/profile" className={ui['text-link']}>
            В избранные документы →
          </Link>
        )}
      </div>
      {message && (
        <p role={failed ? 'alert' : 'status'} className={styles['message']}>
          {message}
        </p>
      )}
      <div className={styles['editor-layout']}>
        <form
          className={styles['form']}
          onSubmit={(event) => {
            event.preventDefault();
            void download();
          }}
          noValidate
        >
          <label className={ui['field']}>
            Название для избранного
            <input
              id="document-title"
              value={title}
              disabled={busy}
              maxLength={160}
              onChange={(event) => {
                setTitle(event.target.value);
                setDirty(true);
              }}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && <span className={styles['error']}>{errors.title}</span>}
          </label>
          <p className={styles['hint']}>
            Поля со звёздочкой обязательны для скачивания. Подсказки и невыбранные варианты в файл
            не попадут.
          </p>
          {template.groups.map((group) => {
            const items = shownFields.filter((field) => field.group === group.id);
            if (!items.length) return null;
            return (
              <fieldset key={group.id} className={styles['group']}>
                <legend>{group.title}</legend>
                <p className={styles['hint']}>{group.description}</p>
                {group.id === 'money' && (
                  <div className={styles['reference']}>
                    <strong>Обратите внимание!</strong>
                    <p>Перед выбором денежного требования обратитесь к статье:</p>
                    <Link
                      className={ui['text-link']}
                      to="/articles/code-1"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Убытки или компенсация: что требовать при копировании программы? ↗
                    </Link>
                  </div>
                )}
                {items.map((field) => (
                  <DocumentField
                    key={field.id}
                    field={field}
                    value={fields[field.id] ?? ''}
                    error={errors[field.id]}
                    onChange={(value) => update(field.id, value)}
                    disabled={busy}
                  />
                ))}
              </fieldset>
            );
          })}
          <div className={ui['button-row']}>
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className={cx(ui['button'], ui['secondary'])}
            >
              {saved ? 'Сохранить изменения' : 'Сохранить в избранное'}
            </button>
            <button disabled={busy} type="submit" className={cx(ui['button'], ui['primary'])}>
              Скачать DOCX
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={clear}
              className={cx(ui['button'], ui['secondary'])}
            >
              Очистить форму
            </button>
          </div>
        </form>
        <aside
          className={styles['preview']}
          id="document-preview"
          aria-label="Предпросмотр документа"
        >
          <h2>Ваш документ</h2>
          <p className={styles['hint']}>
            Текст обновляется при заполнении. Значения в квадратных скобках нужно заполнить.
          </p>
          <div className={styles['paper']}>
            {paragraphs.map((paragraph, index) =>
              paragraph.heading ? (
                <h3 key={index}>{paragraph.text}</h3>
              ) : (
                <p key={index}>{paragraph.text}</p>
              ),
            )}
          </div>
        </aside>
      </div>
      <section className={styles['notice']}>
        <strong>Обратите внимание!</strong>
        <p>
          Документ формируется по шаблону. Проверьте сведения, доказательства и выбранные требования
          перед направлением адресату. Заполнение формы не заменяет консультацию юриста по вашему
          делу.
        </p>
        <button
          className={cx(ui['button'], ui['secondary'])}
          onClick={() => open('lawyer-request')}
        >
          Обсудить задачу с юристом
        </button>
      </section>
    </div>
  );
}

function defaultValues(template: DocumentTemplate): DocumentValues {
  return Object.fromEntries(
    template.fields
      .filter((field) => field.defaultValue !== undefined)
      .map((field) => [field.id, field.defaultValue!]),
  );
}

function DocumentField({
  field,
  value,
  error,
  onChange,
  disabled,
}: {
  field: TemplateField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const props = {
    id: `document-${field.id}`,
    name: field.id,
    value,
    disabled,
    required: field.required,
    'aria-invalid': Boolean(error),
    'aria-describedby': field.hint || error ? `document-hint-${field.id}` : undefined,
  };
  return (
    <div className={styles['field']}>
      <label htmlFor={props.id}>
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {field.type === 'select' ? (
        <select {...props} onChange={(event) => onChange(event.target.value)}>
          <option value="">Выберите вариант</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          {...props}
          rows={3}
          maxLength={field.maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...props}
          type={field.type === 'money' ? 'number' : field.type}
          min={field.min}
          max={field.max}
          step={field.type === 'money' ? '0.01' : field.type === 'number' ? '1' : undefined}
          maxLength={field.maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {(field.hint || error) && (
        <p id={`document-hint-${field.id}`} className={error ? styles['error'] : styles['hint']}>
          {error ?? field.hint}
        </p>
      )}
    </div>
  );
}
