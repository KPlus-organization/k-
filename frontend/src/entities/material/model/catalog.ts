import design from './design.json';
import { materials } from './materials';

export { design };
const objectIds = [
  'code',
  'algorithms',
  'design',
  'databases',
  'brand',
  'visuals',
  'fonts',
  'texts',
];
const objectRoutes: Partial<Record<string, string>> = {
  code: '/protect/code',
  databases: '/protect/databases',
  brand: '/protect/brand',
};
export const objects = design.objects
  .map((item, index) => ({
    ...item,
    id: objectIds[index],
    href: objectRoutes[objectIds[index]],
  }))
  .filter((item) => item.id !== 'texts');
export type Article = {
  id: string;
  title: string;
  description: string;
  topic: string;
  href?: string;
};
export const articles: Article[] = [
  ...materials,
  {
    id: 'application',
    topic: 'brand',
    title: 'Как правильно заполнить заявку на товарный знак',
    description: 'Юридические советы • 5 мин чтения',
  },
  {
    id: 'deadlines',
    topic: 'brand',
    title: 'Сроки регистрации товарного знака в Роспатенте',
    description: 'Практика • 3 мин чтения',
  },
  {
    id: 'classes',
    topic: 'brand',
    title: 'Что такое МКТУ и как правильно выбрать классы',
    description: 'Базовые знания • 7 мин чтения',
  },
];

export type DesignNode = { id: string; name: string; text?: string; children?: DesignNode[] };
