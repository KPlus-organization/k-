import { ApiError } from './client';

const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Сервер недоступен. Проверьте подключение и попробуйте ещё раз.',
  DATABASE_UNAVAILABLE: 'Сервис временно недоступен. Попробуйте позже.',
  INTERNAL_ERROR: 'Что-то пошло не так. Попробуйте позже.',
  INVALID_CREDENTIALS: 'Неверный логин, email или пароль.',
  LOGIN_TAKEN: 'Этот логин уже занят.',
  EMAIL_TAKEN: 'Этот email уже зарегистрирован.',
  AUTH_REQUIRED: 'Войдите в профиль, чтобы продолжить.',
  INVALID_REFRESH_TOKEN: 'Сессия завершилась. Войдите снова.',
  TOKEN_EXPIRED: 'Сессия завершилась. Войдите снова.',
  INVALID_TOKEN: 'Сессия завершилась. Войдите снова.',
  CONSENT_WITHDRAWN: 'Согласие на обработку персональных данных отозвано. Войдите снова.',
  CONSENT_REQUIRED:
    'Вы отозвали согласие на обработку персональных данных. Чтобы войти, дайте согласие снова.',
  DOCUMENT_NOT_FOUND: 'Документ не найден или недоступен в этом профиле.',
  DOCUMENT_TEMPLATE_NOT_FOUND: 'Этот шаблон пока недоступен.',
  DOCUMENT_VERSION_CHANGED: 'Шаблон обновился. Откройте его заново перед сохранением.',
};

/**
 * A message for the user. Validation problems are described with `fieldHints`
 * (field name → hint); the server's English messages are never shown as is.
 */
export function errorMessage(error: unknown, fieldHints: Record<string, string> = {}): string {
  if (!(error instanceof ApiError)) return MESSAGES['INTERNAL_ERROR']!;
  if (error.code === 'VALIDATION_ERROR') {
    const hints = error.details.map((issue) => fieldHints[issue.field]).filter(Boolean);
    return hints.length > 0 ? hints.join(' ') : 'Проверьте введённые данные.';
  }
  return MESSAGES[error.code] ?? MESSAGES['INTERNAL_ERROR']!;
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}
