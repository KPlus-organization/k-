// Site routes of content. The API knows nothing about them: ids are stable,
// routes are decided here.

const materialRoutes: Partial<Record<string, string>> = {
  'ownership-overview': '/ownership',
  'protect-overview': '/protect',
  'defend-overview': '/defend',
  checklist: '/protect/code',
  'database-registration': '/ownership/databases',
  'code-ownership': '/ownership/code',
  'code-defense': '/defend/code',
  'design-ownership': '/ownership/design',
  'design-protection': '/protect/design',
  'design-defense': '/defend/design',
  'database-claim': '/defend/databases',
  'brand-defense': '/defend/brand',
  'brand-ownership': '/ownership/brand',
  'visuals-ownership': '/ownership/visuals',
  'visuals-protection': '/protect/visuals',
  'visuals-defense': '/defend/visuals',
  'database-protection': '/protect/databases',
  'brand-protection': '/protect/brand',
};

const objectRoutes: Partial<Record<string, string>> = {
  code: '/protect/code',
  databases: '/protect/databases',
  brand: '/protect/brand',
  visuals: '/protect/visuals',
  design: '/protect/design',
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
      'ownership-overview',
      'database-registration',
      'database-rights',
      'database-coauthors',
      'code-ownership',
      'code-registration',
      'brand-ownership',
      'brand-start',
      'visuals-ownership',
      'visuals-ai',
      'design-ownership',
      'design-figma',
    ].includes(id)
  )
    return 'ownership';
  if (
    [
      'defend-overview',
      'database-claim',
      'database-fair-use',
      'brand-claim',
      'brand-defense',
      'visuals-defense',
      'visuals-claim',
      'text-rewrite',
      'code-defense',
      'code-contractor',
      'design-defense',
      'design-ui-kit',
      'design-contractor',
    ].includes(id)
  )
    return 'defend';
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
      design: {
        primary: 'design-protection',
        materials: ['design-protection', 'design-comparison', 'design-ownership', 'design-figma'],
      },
      databases: {
        primary: 'database-protection',
        materials: [
          'database-protection',
          'database-elements',
          'database-rights',
          'database-coauthors',
          'database-registration',
        ],
      },
      brand: { primary: 'brand-protection', materials: ['brand-protection', 'brand-article'] },
      visuals: {
        primary: 'visuals-protection',
        materials: ['visuals-protection', 'visuals-copying', 'visuals-ownership'],
      },
    },
    defend: {
      code: {
        primary: 'code-defense',
        materials: ['code-defense', 'code-0', 'code-contractor', 'code-expert', 'code-1'],
      },
      design: {
        primary: 'design-defense',
        materials: ['design-defense', 'design-ui-kit', 'design-contractor', 'design-comparison'],
      },
      databases: {
        primary: 'database-claim',
        materials: ['database-claim', 'database-fair-use', 'database-rights'],
      },
      brand: {
        primary: 'brand-defense',
        materials: ['brand-defense', 'brand-claim', 'brand-article'],
      },
      visuals: {
        primary: 'visuals-defense',
        materials: ['visuals-defense', 'visuals-claim', 'visuals-ownership'],
      },
    },
    ownership: {
      code: { primary: 'code-ownership', materials: ['code-ownership', 'code-registration'] },
      design: {
        primary: 'design-ownership',
        materials: ['design-ownership', 'design-figma', 'design-ui-kit'],
      },
      databases: {
        primary: 'database-registration',
        materials: ['database-registration', 'database-rights', 'database-coauthors'],
      },
      brand: { primary: 'brand-ownership', materials: ['brand-ownership', 'brand-start'] },
      visuals: { primary: 'visuals-ownership', materials: ['visuals-ownership', 'visuals-ai'] },
    },
  };
  return journeys[area][id] ?? { materials: [] };
}

/** Every protection/claim object opens; empty topics explain that content is in preparation. */
export function objectActionHref(id: string, area: MaterialArea): string | undefined {
  if (area === 'ownership' && !objectJourney(id, area).primary) return undefined;
  return `/${area}/${id}`;
}
