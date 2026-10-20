import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Open } from '@/shared/lib';
import type { ContentBlock, TextRun } from '../model/types';
import styles from './content.module.css';

function searchTerms(query: string): string[] {
  const unique = new Map<string, string>();
  for (const word of query.trim().split(/\s+/)) {
    const key = word.toLocaleLowerCase('ru');
    if (key && !unique.has(key)) unique.set(key, word);
  }
  return [...unique.values()].sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Marks each query word, including when it sits inside a longer word. */
export function HighlightedText({ text, query }: { text: string; query: string }) {
  const terms = searchTerms(query);
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu');
  return text.split(pattern).map((part, index) =>
    part && terms.some((term) => part.toLocaleLowerCase('ru') === term.toLocaleLowerCase('ru')) ? (
      <mark key={index} className={styles['search-hit']} data-search-hit="">
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function InlineText({ runs, open, query }: { runs: TextRun[]; open: Open; query: string }) {
  return runs.map((run, index) => {
    let text: ReactNode = <HighlightedText text={run.text} query={query} />;
    if (run.bold) text = <strong>{text}</strong>;
    if (run.italic) text = <em>{text}</em>;
    if (run.action)
      text = (
        <button className={styles['inline-link']} onClick={() => open(run.action!)}>
          {text}
        </button>
      );
    else if (run.href?.startsWith('/')) text = <Link to={run.href}>{text}</Link>;
    else if (run.href && /^https?:\/\//.test(run.href))
      text = (
        <a href={run.href} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    return <Fragment key={index}>{text}</Fragment>;
  });
}

export function MaterialContent({
  blocks,
  open,
  headingLevel = 3,
  query = '',
}: {
  blocks: ContentBlock[];
  open: Open;
  headingLevel?: 2 | 3;
  query?: string;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={styles['content']}>
      {blocks.map((block, index) => {
        if (block.type === 'heading')
          return (
            <Heading key={index} id={block.anchor}>
              <InlineText runs={block.runs} open={open} query={query} />
            </Heading>
          );
        if (block.type === 'note')
          return (
            <aside className={styles['note']} key={index}>
              <p>
                <InlineText runs={block.runs} open={open} query={query} />
              </p>
            </aside>
          );
        if (block.type === 'paragraph')
          return (
            <p key={index}>
              <InlineText runs={block.runs} open={open} query={query} />
            </p>
          );
        if (block.type === 'action')
          return (
            <button className={styles['action']} key={index} onClick={() => open(block.action)}>
              <HighlightedText text={block.text} query={query} /> →
            </button>
          );
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={index}>
              {block.items.map((runs, item) => (
                <li key={item}>
                  <InlineText runs={runs} open={open} query={query} />
                </li>
              ))}
            </List>
          );
        }
        // Wide tables are focusable so keyboard users can scroll the region.
        /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
        if (block.type === 'table')
          return (
            <div
              key={index}
              className={styles['table-scroll']}
              tabIndex={0}
              role="region"
              aria-label="Таблица материала: прокрутка по горизонтали"
            >
              <table>
                <thead>
                  <tr>
                    {block.rows[0].map((runs, cell) => (
                      <th scope="col" key={cell}>
                        <InlineText runs={runs} open={open} query={query} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((runs, cell) => (
                        <td key={cell}>
                          <InlineText runs={runs} open={open} query={query} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
        return null;
      })}
    </div>
  );
}
