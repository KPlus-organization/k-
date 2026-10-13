import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Open } from '@/shared/lib';
import type { ContentBlock, TextRun } from '../model/types';
import styles from './content.module.css';

function InlineText({ runs, open }: { runs: TextRun[]; open: Open }) {
  return runs.map((run, index) => {
    let text: ReactNode = run.text;
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
}: {
  blocks: ContentBlock[];
  open: Open;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={styles['content']}>
      {blocks.map((block, index) => {
        if (block.type === 'heading')
          return (
            <Heading key={index}>
              <InlineText runs={block.runs} open={open} />
            </Heading>
          );
        if (block.type === 'note')
          return (
            <aside className={styles['note']} key={index}>
              <p>
                <InlineText runs={block.runs} open={open} />
              </p>
            </aside>
          );
        if (block.type === 'paragraph')
          return (
            <p key={index}>
              <InlineText runs={block.runs} open={open} />
            </p>
          );
        if (block.type === 'action')
          return (
            <button className={styles['action']} key={index} onClick={() => open(block.action)}>
              {block.text} →
            </button>
          );
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={index}>
              {block.items.map((runs, item) => (
                <li key={item}>
                  <InlineText runs={runs} open={open} />
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
                        <InlineText runs={runs} open={open} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((runs, cell) => (
                        <td key={cell}>
                          <InlineText runs={runs} open={open} />
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
