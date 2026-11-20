/**
 * @file Bounded markdown for source `text` views with `markdown = true`.
 * @remarks Built as React elements only, never HTML: paragraphs, `-`/`*` lists, pipe tables,
 * `**bold**` and `*italic*`/`_italic_`, the constructs official 5e descriptions use. Anything else stays literal text.
 */
import type { ReactNode } from 'react';

const MAX_TEXT = 50000;

/** Inline emphasis only; unmatched markers are kept as written. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).filter(Boolean).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={index}>{part.slice(2, -2)}</strong>
      : /^([*_]).+\1$/.test(part) ? <em key={index}>{part.slice(1, -1)}</em> : part);
}

function cells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

/** Split lines into blocks: consecutive table rows, consecutive list items, or a paragraph. */
function blocks(text: string) {
  const result: { kind: 'table' | 'list' | 'paragraph'; lines: string[] }[] = [];
  for (const line of text.slice(0, MAX_TEXT).split(/\r?\n/)) {
    const kind = /^\s*\|.*\|\s*$/.test(line) ? 'table' : /^\s*[-*]\s+/.test(line) ? 'list' : line.trim() ? 'paragraph' : undefined;
    const last = result.at(-1);
    if (!kind) { result.push({ kind: 'paragraph', lines: [] }); continue; }
    if (last && last.kind === kind) last.lines.push(line);
    else result.push({ kind, lines: [line] });
  }
  return result.filter(block => block.lines.length);
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={['markdown', className].filter(Boolean).join(' ')}>{blocks(text).map((block, index) => {
    if (block.kind === 'list') return <ul key={index}>{block.lines.map((line, item) =>
      <li key={item}>{inline(line.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>;
    if (block.kind === 'table') {
      const separator = block.lines.length > 1 && cells(block.lines[1]).every(cell => /^:?-{3,}:?$/.test(cell));
      const head = separator ? cells(block.lines[0]) : undefined;
      const rows = block.lines.slice(separator ? 2 : 0).map(cells);
      return <div key={index} className="markdown-table"><table>
        {head && <thead><tr>{head.map((cell, i) => <th key={i} scope="col">{inline(cell)}</th>)}</tr></thead>}
        <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i}>{inline(cell)}</td>)}</tr>)}</tbody>
      </table></div>;
    }
    return <p key={index}>{block.lines.flatMap((line, i) => i ? [<br key={`b${i}`} />, ...inline(line)] : inline(line))}</p>;
  })}</div>;
}
