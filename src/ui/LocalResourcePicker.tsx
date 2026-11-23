/** @file Search every eligible local instance while bounding mounted option controls. */
import { Fragment, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ResourceDefinition, ResourceInstance } from '../domain/model';
import type { EvaluationEnvironment } from '../engine/formulas';
import { sortOptions, sortResources } from '../engine/resource-sort';
import { currentLocale, it } from './it';

const pageSize = 50;

/** Source sort options for one resource type, when the caller knows it. */
export interface ResourceSorting { definition: ResourceDefinition; environment: EvaluationEnvironment }

/** "Sort by" select over the source options; the empty value keeps the caller's default order. */
export function SortSelect({ options, value, disabled, onChange }: {
  options: { name: string }[]; value: string; disabled?: boolean; onChange: (value: string) => void;
}) {
  if (!options.length) return null;
  return <label className="field"><span>{it.sortBy}</span><select value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
    <option value="">{it.sortDefault}</option>
    {options.map((option, index) => <option key={index} value={String(index)}>{option.name}</option>)}
  </select></label>;
}

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

/**
 * 5e spell level from a private copy (`values.level`) or a catalog template's retained original
 * (`stats.level.value`), both holding the source's `spell_level_N` id; anything else has no level.
 */
export function spellLevel(record: ResourceInstance) {
  if (record.definitionId !== 'spell') return undefined;
  let level = record.values.level;
  if (level == null && record.catalogSource) {
    try { level = JSON.parse(record.catalogSource.original)?.stats?.level?.value; } catch { return undefined; }
  }
  const match = typeof level === 'string' ? /^spell_level_(\d)$/.exec(level) : null;
  return match ? Number(match[1]) : undefined;
}

/** Keep search/page state local; selection still uses the owner's atomic command. */
export function LocalResourcePicker({ resources, busy, onSelect, sorting }: {
  resources: ResourceInstance[]; busy: boolean; onSelect: (record: ResourceInstance) => void; sorting?: ResourceSorting;
}) {
  const number = new Intl.NumberFormat(currentLocale());
  const [query, setQuery] = useState('');
  const [sortIndex, setSortIndex] = useState('');
  const options = useMemo(() => sorting ? sortOptions(sorting.definition, sorting.environment.enumerations as unknown[]) : [], [sorting]);
  const option = sortIndex ? options[Number(sortIndex)] : undefined;
  const [page, setPage] = useState(0);
  const startRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const levels = useMemo(() => new Map(resources.map(r => [r.id, spellLevel(r)])), [resources]);
  const matches = useMemo(() => {
    const normalize = (text: string) => text.trim().toLocaleLowerCase('it').replace(/[_\s]+/g, ' ');
    const search = normalize(query);
    const found = search ? resources.filter(r => normalize(r.name).includes(search)) : resources;
    // Spells read by level first; entries without a level keep alphabetical order after them.
    if (option && sorting) return sortResources(found, sorting.definition, option, sorting.environment, it.notStat);
    const rank = (r: ResourceInstance) => levels.get(r.id) ?? 10;
    return [...found].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, currentLocale()))
      .map(record => ({ record, group: null as string | null }));
  }, [resources, query, levels, option, sorting]);
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
      <SortSelect options={options} value={sortIndex} disabled={busy} onChange={value => { setSortIndex(value); setPage(0); }} />
      <p role="status">{matches.length ? `${number.format(start + 1)}–${number.format(Math.min(start + pageSize, matches.length))} / ${number.format(matches.length)}` : it.noMatchingResources}</p>
      {!matches.length && query && <button type="button" className="link-button" disabled={busy}
        onClick={() => { setQuery(''); setPage(0); searchRef.current?.focus(); }}>{it.clearResourceSearch}</button>}
    </div>
    <div className="local-resource-options">{matches.slice(start, start + pageSize).map(({ record, group }, index, page) => <Fragment key={record.id}>
      {group !== null && group !== (index ? page[index - 1].group : matches[start - 1]?.group ?? null) && <h3 className="resource-group">{group}</h3>}
      <button type="button" className="button secondary" disabled={busy} onClick={() => onSelect(record)}>
        <span>{record.name}{levels.get(record.id) != null && <small className="resource-source-label">{it.spellLevelLabel(levels.get(record.id)!)}</small>}
          {sources.has(record.id) && <small className="resource-source-label">{sources.get(record.id)}</small>}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </Fragment>)}</div>
    {pages > 1 && <nav className="button-row" aria-label={it.pages}>
      <button type="button" className="button secondary" disabled={busy || current === 0} onClick={() => changePage(current - 1)}>{it.previousPage}</button>
      <span>{number.format(current + 1)} / {number.format(pages)}</span>
      <button type="button" className="button secondary" disabled={busy || current === pages - 1} onClick={() => changePage(current + 1)}>{it.nextPage}</button>
    </nav>}
  </div>;
}
