// Browsers describe failed HTML constraints (required, minLength, type="email", pattern)
// in their own UI language, so forms use noValidate and show these Russian messages
// instead. The rules themselves stay on the inputs as HTML attributes.

function characters(count: number) {
  return count % 10 === 1 && count % 100 !== 11 ? 'символа' : 'символов';
}

type FormField = HTMLInputElement | HTMLTextAreaElement;

function fieldLabel(input: FormField) {
  return input.dataset['label'] ?? input.labels?.[0]?.textContent?.trim() ?? 'Поле';
}

/** Russian description of why `input` is invalid, or null if it is valid. */
export function fieldError(input: FormField): string | null {
  const label = fieldLabel(input);
  const length = [...input.value].length;
  // Text typed into a number field: the browser reports it as empty.
  if (input.validity.badInput) return `${label}: введите число.`;
  if (input.validity.valueMissing)
    return input.type === 'checkbox'
      ? (input.dataset['requiredMessage'] ?? 'Отметьте обязательный пункт.')
      : `Заполните поле «${label}».`;
  if (input.validity.typeMismatch && input.type === 'email')
    return 'Укажите корректный адрес электронной почты.';
  // Checked by hand: browsers report tooShort only for values typed by the user.
  if (input.minLength > 0 && length > 0 && length < input.minLength)
    return `${label}: не менее ${input.minLength} ${characters(input.minLength)}.`;
  if (input.maxLength > 0 && length > input.maxLength)
    return `${label}: не более ${input.maxLength} ${characters(input.maxLength)}.`;
  if (input instanceof HTMLInputElement) {
    if (input.validity.rangeUnderflow) return `${label}: не меньше ${input.min}.`;
    if (input.validity.rangeOverflow) return `${label}: не больше ${input.max}.`;
    if (input.validity.stepMismatch) return `${label}: нужно целое число.`;
  }
  if (input.validity.patternMismatch)
    return input.title || `Поле «${label}» заполнено в неверном формате.`;
  if (!input.validity.valid) return `Проверьте поле «${label}».`;
  return null;
}

/**
 * Checks every input of a form with noValidate. Marks invalid inputs with
 * aria-invalid, focuses the first one and returns its message (null if all are valid).
 */
export function validateForm(form: HTMLFormElement): string | null {
  let first: { input: FormField; message: string } | undefined;
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) continue;
    const message = fieldError(element);
    if (message) element.setAttribute('aria-invalid', 'true');
    else element.removeAttribute('aria-invalid');
    if (message && !first) first = { input: element, message };
  }
  first?.input.focus();
  return first?.message ?? null;
}
