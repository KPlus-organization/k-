import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  activeValues,
  documentValue,
  matches,
  type DocumentTemplate,
  type DocumentValues,
  type TemplateField,
} from '@/entities/document';
import { cx } from '@/shared/lib';
import { ui } from '@/shared/ui';
import styles from './styles.module.css';

type Props = {
  template: DocumentTemplate;
  fields: DocumentValues;
  errors: Record<string, string>;
  busy: boolean;
  update: (id: string, value: string) => void;
};

/** Plain document text is immutable; only schema-defined slots are controls. */
export function InlineDocument({ template, fields, errors, busy, update }: Props) {
  const [help, setHelp] = useState<{ paragraph: number; field: string } | null>(null);
  const active = activeValues(template, fields);
  const occurrences = new Map<string, number>();
  const fieldById = new Map(template.fields.map((field) => [field.id, field]));
  const renderField = (id: string, paragraph: number) => {
    const field = fieldById.get(id);
    if (!field) return <output key={id}>{documentValue(template, active, id)}</output>;
    if (!matches(field.when, active)) return null;
    const occurrence = occurrences.get(id) ?? 0;
    occurrences.set(id, occurrence + 1);
    const controlId = `document-${id}${occurrence ? `-${occurrence}` : ''}`;
    return (
      <InlineField
        key={controlId}
        id={controlId}
        field={field}
        value={fields[id] ?? ''}
        error={errors[id]}
        disabled={busy}
        onChange={(value) => update(id, value)}
        onHelp={() => setHelp(field.hint ? { paragraph, field: id } : null)}
      />
    );
  };
  return (
    <article
      className={styles['document-paper']}
      aria-label="Заполнение документа"
      id="document-body"
    >
      {template.paragraphs.map((paragraph, index) => {
        // Optional blanks must remain editable before a value has been entered.
        const optionalBlanks = new Set(
          [...paragraph.text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]),
        );
        const editorCondition =
          paragraph.when &&
          Object.fromEntries(
            Object.entries(paragraph.when).filter(
              ([id, value]) => !(value === '*' && optionalBlanks.has(id)),
            ),
          );
        const visible =
          matches(editorCondition, active) &&
          (!paragraph.unless || !matches(paragraph.unless, active));
        const choices = (paragraph.controlsBefore ?? []).filter((id) =>
          matches(fieldById.get(id)?.when, active),
        );
        if (!visible && !choices.length) return null;
        const hintField = help?.paragraph === index ? fieldById.get(help.field) : undefined;
        const parts = paragraph.text.split(/(\{\{\w+\}\})/g);
        return (
          <Fragment key={index}>
            {choices.map((id) => (
              <div className={styles['document-choice']} key={id}>
                <span>{fieldById.get(id)?.label}: </span>
                {renderField(id, index)}
              </div>
            ))}
            {choices.includes('moneyType') && Boolean(template.references?.length) && (
              <div className={styles['reference']}>
                <strong>Полезные материалы</strong>
                {template.references?.map((reference) => (
                  <div key={reference.href}>
                    <Link
                      className={ui['text-link']}
                      to={reference.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {reference.title} ↗
                    </Link>
                    {reference.note && <p>{reference.note}</p>}
                  </div>
                ))}
              </div>
            )}
            {visible && (
              <div
                className={cx(
                  styles['document-paragraph'],
                  paragraph.layout === 'address' ? styles['document-address'] : undefined,
                  paragraph.layout === 'center' ? styles['document-center'] : undefined,
                  paragraph.heading ? styles['document-heading'] : undefined,
                )}
                data-document-paragraph={index}
              >
                {parts.map((part, partIndex) =>
                  part.startsWith('{{') ? (
                    renderField(part.slice(2, -2), index)
                  ) : (
                    <span key={`text-${partIndex}`}>{part}</span>
                  ),
                )}
              </div>
            )}
            {hintField?.hint && matches(hintField.when, active) && (
              <div
                className={styles['field-help']}
                role="note"
                aria-label={`Подсказка: ${hintField.label}`}
              >
                <p>{hintField.hint}</p>
              </div>
            )}
          </Fragment>
        );
      })}
    </article>
  );
}

function InlineField({
  id,
  field,
  value,
  error,
  disabled,
  onChange,
  onHelp,
}: {
  id: string;
  field: TemplateField;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onHelp: () => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const resize = () => {
      if (!textarea.current) return;
      textarea.current.style.height = 'auto';
      textarea.current.style.height = `${textarea.current.scrollHeight + 2}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [value]);
  const option = field.options?.find((item) => item.value === value);
  const length = (option?.label ?? value).length || field.label.length;
  const props = {
    id,
    name: field.id,
    value,
    disabled,
    required: field.required,
    'aria-label': field.label,
    'aria-invalid': Boolean(error),
    'aria-describedby':
      [field.hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') ||
      undefined,
    onFocus: onHelp,
  };
  return (
    <span
      className={cx(
        styles['inline-field'],
        field.type === 'textarea' ? styles['inline-long'] : undefined,
      )}
      style={
        {
          '--slot-width': `${Math.max(18, Math.min(length + (field.hint ? 10 : 6), 52))}ch`,
        } as CSSProperties
      }
    >
      <span className={styles['slot-row']}>
        {field.type === 'select' ? (
          <select {...props} onChange={(event) => onChange(event.target.value)}>
            <option value="">
              {field.label}
              {field.required ? ' *' : ''}
            </option>
            {field.options?.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea
            {...props}
            ref={textarea}
            rows={1}
            placeholder={`${field.label}${field.required ? ' *' : ''}`}
            maxLength={field.maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            {...props}
            type={field.type === 'money' ? 'number' : field.type}
            placeholder={`${field.label}${field.required ? ' *' : ''}`}
            min={field.min}
            max={field.max}
            step={field.type === 'money' ? '0.01' : field.type === 'number' ? '1' : undefined}
            maxLength={field.maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        {field.hint && (
          <button
            type="button"
            disabled={disabled}
            className={styles['hint-button']}
            aria-label={`Подсказка: ${field.label}`}
            onClick={onHelp}
          >
            i
          </button>
        )}
      </span>
      {field.hint && (
        <span id={`${id}-hint`} className={styles['sr-only']}>
          {field.hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles['error']}>
          {error}
        </span>
      )}
    </span>
  );
}
