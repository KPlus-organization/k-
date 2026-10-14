// Site routes of content. The API knows nothing about them: ids are stable,
// routes are decided here.

const materialRoutes: Partial<Record<string, string>> = {
  checklist: '/protect/code',
  'database-registration': '/ownership/databases',
  'code-ownership': '/ownership/code',
  'database-claim': '/defend/databases',
  'brand-claim': '/defend/brand',
  'database-protection': '/protect/databases',
  'brand-protection': '/protect/brand',
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

export type MaterialArea = 'ownership' | 'protect' | 'defend';

export const materialAreaTitles: Record<MaterialArea, string> = {
  ownership: 'Оформить права',
  protect: 'Защитить нарушенные права',
  defend: 'Оспорить претензию о нарушении чужих прав',
};

export function materialArea(id: string): MaterialArea {
  if (
    [
      'database-registration',
      'database-rights',
      'database-coauthors',
      'code-ownership',
      'code-registration',
    ].includes(id)
  )
    return 'ownership';
  if (['database-claim', 'brand-claim'].includes(id)) return 'defend';
  return 'protect';
}

/** Materials relevant to the user's task, rather than every article on the same topic. */
export function objectJourney(
  id: string,
  area: MaterialArea,
): { primary?: string; materials: string[] } {
  const journeys: Record<
    MaterialArea,
    Record<string, { primary?: string; materials: string[] }>
  > = {
    protect: {
      code: { primary: 'checklist', materials: ['checklist', 'code-0', 'code-1', 'code-expert'] },
      databases: {
        primary: 'database-protection',
        materials: [
          'database-protection',
          'database-rights',
          'database-coauthors',
          'database-registration',
        ],
      },
      brand: { primary: 'brand-protection', materials: ['brand-protection', 'brand-article'] },
    },
    defend: {
      code: { materials: ['code-0', 'code-expert', 'code-1'] },
      databases: { primary: 'database-claim', materials: ['database-claim', 'database-rights'] },
      brand: { primary: 'brand-claim', materials: ['brand-claim', 'brand-article'] },
    },
    ownership: {
      code: { primary: 'code-ownership', materials: ['code-ownership', 'code-registration'] },
      databases: {
        primary: 'database-registration',
        materials: ['database-registration', 'database-rights', 'database-coauthors'],
      },
    },
  };
  return journeys[area][id] ?? { materials: [] };
}

/** Every protection/claim object opens; empty topics explain that content is in preparation. */
export function objectActionHref(id: string, area: MaterialArea): string | undefined {
  if (area === 'ownership' && !objectJourney(id, area).primary) return undefined;
  return `/${area}/${id}`;
}
