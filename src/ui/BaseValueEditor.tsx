/** @file On-demand manual values, separate from the source sheet's play controls. */
import { useState } from 'react';
import type { ResourceInstance, Stat } from '../domain/model';
import { FieldInput } from './FieldInput';
import { it } from './it';

/** Mount manual fields only while open; filter presentation, never stored values. */
export function BaseValueEditor({ stats, values, resources, onSave }: {
  stats: Stat[]; values: Record<string, unknown>; resources: ResourceInstance[];
  onSave: (id: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const search = query.trim().toLocaleLowerCase('it');
  const fields = stats.filter(s => s.type === 'base' && `${s.name} ${s.id}`.toLocaleLowerCase('it').includes(search));
  return <details className="base-editor sheet-anchor" id="sheet-base-values" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{it.baseValues}</summary>
    {open && <>
      <p className="muted">{it.baseHelp}</p>
      <label className="field"><span>{it.searchBaseValues}</span>
        <input type="search" name="base-value-search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      {!fields.length && <p role="status">{it.noMatchingFields}</p>}
      <div className="base-grid">{fields.map(stat => <FieldInput key={stat.id} stat={stat} value={values[stat.id]}
        resources={resources} onSave={value => onSave(stat.id, value)} />)}</div>
    </>}
  </details>;
}
