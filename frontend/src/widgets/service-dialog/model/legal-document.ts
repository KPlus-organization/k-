/** Text of a legal document shown in a window: paragraphs, bulleted lists and section headings. */
export type LegalBlock = { heading: string } | { paragraph: string } | { list: string[] };

export type LegalDocument = { blocks: LegalBlock[] };
