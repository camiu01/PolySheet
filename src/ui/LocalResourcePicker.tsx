/** @file Search every eligible local instance while bounding mounted option controls. */
import { useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ResourceInstance } from '../domain/model';
import { it } from './it';

const pageSize = 50;
const number = new Intl.NumberFormat('it');

function readableSource(source: string) {
  try {
    return decodeURIComponent(source);
  } catch (error) {
    if (error instanceof URIError) return source;
    throw error;
  }
}

/** Source-book code of an upstream file name such as `race_tortle_tortle__mom_.rpg.json` (MOM). */
function bookCode(path: string[]) {
  return /__([a-z0-9]{1,12})_(?:\.rpg)?(?:\.json)?$/i.exec(path[path.length - 1])?.[1].toLocaleUpperCase('it');
}

/**
 * Distinguish catalog entries that share a name by the differing tail of their import source.
 * When the file names carry upstream source-book codes, the code alone is shown and an entry
 * without one stays unlabeled. Entries without a source, or whose sources are identical,
 * receive no label rather than an invented one.
 */
export function duplicateSourceLabels(resources: ResourceInstance[]) {
  const groups = new Map<string, ResourceInstance[]>();
  for (const record of resources) {
    const key = record.name.trim().toLocaleLowerCase('it');
    groups.set(key, [...groups.get(key) ?? [], record]);
  }
  const labels = new Map<string, string>();
  for (const group of groups.values()) {
    const sourced = group.filter(record => record.catalogSource?.source);
    if (sourced.length < 2) continue;
    const paths = sourced.map(record => readableSource(record.catalogSource!.source).split('/'));
    let common = 0;
    while (paths.every(path => common < path.length - 1 && path[common] === paths[0][common])) common++;
    const codes = paths.map(bookCode);
    for (const [index, record] of sourced.entries()) {
      const label = codes.some(Boolean) ? codes[index] ?? ''
        : paths[index].slice(common).join('/').replace(/(?:\.rpg)?\.json$/i, '');
      if (label && paths.some((path, other) => other !== index && path.join('/') !== paths[index].join('/'))) labels.set(record.id, label);
    }
  }
  return labels;
}

/** Keep search/page state local; selection still uses the owner's atomic command. */
export function LocalResourcePicker({ resources, busy, onSelect }: {
  resources: ResourceInstance[]; busy: boolean; onSelect: (record: ResourceInstance) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const startRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => {
    const normalize = (text: string) => text.trim().toLocaleLowerCase('it').replace(/[_\s]+/g, ' ');
    const search = normalize(query);
    const found = search ? resources.filter(r => normalize(r.name).includes(search)) : resources;
    return [...found].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [resources, query]);
  const sources = useMemo(() => duplicateSourceLabels(resources), [resources]);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(page, pages - 1), start = current * pageSize;
  function changePage(next: number) {
    setPage(next);
    searchRef.current?.focus();
    startRef.current?.scrollIntoView({ block: 'start' });
  }
  return <div className="local-resource-picker" ref={startRef}>
    <div className="local-resource-toolbar">
      <label className="field"><span>{it.searchLocalResource}</span>
        <input ref={searchRef} type="search" name="local-resource-search" autoComplete="off" value={query} disabled={busy}
          placeholder={it.resourceSearchPlaceholder}
          onChange={event => { setQuery(event.target.value); setPage(0); }} />
      </label>
      <p role="status">{matches.length ? `${number.format(start + 1)}–${number.format(Math.min(start + pageSize, matches.length))} / ${number.format(matches.length)}` : it.noMatchingResources}</p>
      {!matches.length && query && <button type="button" className="link-button" disabled={busy}
        onClick={() => { setQuery(''); setPage(0); searchRef.current?.focus(); }}>{it.clearResourceSearch}</button>}
    </div>
    <div className="local-resource-options">{matches.slice(start, start + pageSize).map(record =>
      <button type="button" key={record.id} className="button secondary" disabled={busy} onClick={() => onSelect(record)}>
        <span>{record.name}{sources.has(record.id) && <small className="resource-source-label">{sources.get(record.id)}</small>}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    )}</div>
    {pages > 1 && <nav className="button-row" aria-label={it.pages}>
      <button type="button" className="button secondary" disabled={busy || current === 0} onClick={() => changePage(current - 1)}>{it.previousPage}</button>
      <span>{number.format(current + 1)} / {number.format(pages)}</span>
      <button type="button" className="button secondary" disabled={busy || current === pages - 1} onClick={() => changePage(current + 1)}>{it.nextPage}</button>
    </nav>}
  </div>;
}
