import { tools } from '@/shared/config';

export const modalTitles: Record<string, string> = {
  settings: 'Настройки профиля',
  favorites: 'Все избранные',
  privacy: 'Конфиденциальность',
  'personal-data-consent': 'Согласие на обработку персональных данных',
  reset: 'Восстановление пароля',
  help: 'Помощь',
  lawyer: 'Найти юриста',
  'lawyer-request': 'Обсудить задачу с нами',
  ownership: 'Оформить права',
  defend: 'Защититься',
  'definition:presumption': 'Что такое презумпция?',
};

/** Windows AppModal can show, e.g. for a link with ?modal=<id>. */
export function isModalId(id: string) {
  return (
    Object.hasOwn(modalTitles, id) ||
    tools.some((tool) => tool.id === id) ||
    /^(object|article):[^:]+$/.test(id)
  );
}
