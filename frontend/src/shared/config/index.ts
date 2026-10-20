/**
 * Backend base URL, e.g. http://localhost:3001. Set VITE_API_URL in frontend/.env to change it.
 * "/" means the same origin as the site (production: Caddy proxies /api to the backend).
 */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export const tools = [
  {
    id: 'articles',
    title: 'Информационные статьи',
    description: 'Статьи о правах на элементы продукта, их использовании и защите.',
    icon: 'book',
  },
  {
    id: 'questions',
    title: 'Вопрос — ответ',
    description: 'Короткие ответы на частые вопросы разработчиков.',
    icon: 'messages',
  },
  {
    id: 'documents',
    title: 'Конструктор документов',
    description: 'Выберите макет и заполните сведения для вашей ситуации.',
    icon: 'files',
  },
  {
    id: 'calculator',
    title: 'Калькулятор госпошлины',
    description: 'Рассчитайте пошлины за товарный знак и регистрацию программы или базы данных.',
    icon: 'calculator',
  },
  {
    id: 'trademark',
    title: 'Проверка товарного знака',
    description: 'Найдите похожие обозначения перед использованием названия.',
    icon: 'searchCheck',
  },
] as const;

/** Tools kept in config (and on the backend) but not shown on the site for now. */
const hiddenToolIds: readonly string[] = ['trademark'];

export const visibleTools = tools.filter((tool) => !hiddenToolIds.includes(tool.id));
