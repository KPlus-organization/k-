import type { Condition, DocumentTemplate, DocumentValues } from './types';

export function matches(condition: Condition | undefined, fields: DocumentValues): boolean {
  return (
    !condition ||
    Object.entries(condition).every(([key, expected]) =>
      expected === '*'
        ? Boolean(fields[key]?.trim())
        : Array.isArray(expected)
          ? expected.includes(fields[key] ?? '')
          : fields[key] === expected,
    )
  );
}

export function activeValues(template: DocumentTemplate, values: DocumentValues) {
  const ids = new Set(template.fields.map((field) => field.id));
  const fields = Object.fromEntries(Object.entries(values).filter(([id]) => ids.has(id)));
  for (const field of template.fields) if (!matches(field.when, fields)) delete fields[field.id];
  return fields;
}

export function documentValue(
  template: DocumentTemplate,
  fields: DocumentValues,
  id: string,
): string {
  const amount = (value: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
  if (id === 'totalAmount') {
    const keys =
      fields.moneyType === 'losses'
        ? ['damage', 'lostProfit']
        : [fields.moneyType === 'copies' ? 'copiesCost' : 'licenseCost'];
    if (keys.some((key) => !fields[key])) return '[Сумма требования]';
    const cents = keys.reduce((sum, key) => sum + Math.round(Number(fields[key]) * 100), 0);
    return Number.isFinite(cents)
      ? amount((cents * (fields.moneyType === 'losses' ? 1 : 2)) / 100)
      : '[Сумма требования]';
  }
  const field = template.fields.find((item) => item.id === id);
  const value = fields[id];
  if (!value) return field?.required === false ? '' : `[${field?.label ?? id}]`;
  const option = field?.options?.find((item) => item.value === value);
  if (option) return option.text ?? option.label;
  if (field?.type === 'date') return value.split('-').reverse().join('.');
  if (field?.type === 'money' && Number.isFinite(Number(value))) return amount(Number(value));
  return value;
}
