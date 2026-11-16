/** @file Search every eligible local instance while bounding mounted option controls. */
import { useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ResourceInstance } from '../domain/model';
import { it } from './it';

const pageSize = 50;
const number = new Intl.NumberFormat('it');

/** Keep search/page state local; selection still uses the owner's atomic command. */
export function LocalResourcePicker({ resources, busy, onSelect }: {
  resources: ResourceInstance[]; busy: boolean; onSelect: (record: ResourceInstance) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const startRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('it');
    return search ? resources.filter(r => r.name.toLocaleLowerCase('it').includes(search)) : resources;
  }, [resources, query]);
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
        <span>{record.name}</span><ChevronRight size={16} aria-hidden="true" />
      </button>
    )}</div>
    {pages > 1 && <nav className="button-row" aria-label={it.pages}>
      <button type="button" className="button secondary" disabled={busy || current === 0} onClick={() => changePage(current - 1)}>{it.previousPage}</button>
      <span>{number.format(current + 1)} / {number.format(pages)}</span>
      <button type="button" className="button secondary" disabled={busy || current === pages - 1} onClick={() => changePage(current + 1)}>{it.nextPage}</button>
    </nav>}
  </div>;
}
