// Site routes of content. The API knows nothing about them: ids are stable,
// routes are decided here.

const materialRoutes: Partial<Record<string, string>> = {
  checklist: '/protect/code',
  'database-registration': '/ownership/databases',
};

const objectRoutes: Partial<Record<string, string>> = {
  code: '/protect/code',
  databases: '/protect/databases',
  brand: '/protect/brand',
};

export function materialHref(id: string) {
  return materialRoutes[id] ?? `/articles/${id}`;
}

/** Objects with their own page; others are shown through the article catalog. */
export function objectHref(id: string) {
  return objectRoutes[id];
}

export function topicHref(id: string) {
  return objectHref(id) ?? `/articles?topic=${id}`;
}
