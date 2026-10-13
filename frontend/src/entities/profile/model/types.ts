/** The signed-in user; see docs/api.md, type User. */
export type Profile = {
  id: string;
  name: string;
  login: string;
  email: string;
  /** ISO 8601 */
  registeredAt: string;
};

/** Hints for validation errors of profile fields, matching the server rules. */
export const profileFieldHints: Record<string, string> = {
  login: 'Логин: от 3 до 32 символов — буквы, цифры, «.», «_» или «-», без пробелов.',
  email: 'Укажите корректный адрес электронной почты.',
  password: 'Пароль: от 8 до 128 символов.',
  name: 'Имя: от 1 до 100 символов.',
  consent: 'Нужно согласие на обработку персональных данных.',
};
