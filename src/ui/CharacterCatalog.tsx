/** @file Manual class, background and origin/subrace assignment without lifecycle effects. */
import { useId, useState } from 'react';
import { isResourceReference, type Character, type ResourceInstance, type StoredSystem } from '../domain/model';
import { assignCatalog, catalogFields, removeCharacterClass, setCharacterSubrace } from '../persistence/catalog';
import { commitCharacterView, commitResourceView } from '../persistence/views';
import { subraceFields, subraceOptions } from '../engine/character-origins';
import { CATALOG_ROOTS } from '../importing/catalog';
import { FieldInput } from './FieldInput';
import { it } from './it';
import { Warning, type Run } from './shared';

/** Assign private copies and edit only manual class levels. Unlinking retains data. */
export function CharacterCatalog({ character, system, resources, run }: {
  character: Character; system: StoredSystem; resources: ResourceInstance[]; run: Run;
}) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const subraceHelpId = useId();
  const fields = catalogFields(system.definition);
  if (!fields.classes && !fields.singular.length) return null;
  const subrace = subraceFields(system.definition);
  const options = subraceOptions(system.definition, character, resources);
  const subraceValue = subrace && character.values[subrace.selection.id];
  const race = subrace && character.values[subrace.race.id];
  const templates = resources.filter(r => !r.catalogIssue && (r.catalogSource || !r.catalogGroup));
  const classes = templates.filter(r => r.definitionId === 'class');
  // No implicit class: the first template would be added by a click the user did not aim at it.
  const chosen = classes.some(r => r.id === selected) ? selected : '';
  const current = fields.classes && character.values[fields.classes.id];
  const wrappers = Array.isArray(current) ? current.flatMap(v => isResourceReference(v)
    ? resources.filter(r => r.id === v.resourceId) : []) : [];
  async function save(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try { await run(work); } finally { setBusy(false); }
  }
  return <section className="aside-note">
    <h2>{it.catalog}</h2><Warning>{it.catalogWarning}</Warning>
    <fieldset disabled={busy} className="source-form-fields">
      {!templates.some(r => CATALOG_ROOTS.includes(r.definitionId)) && <p className="muted">{it.noCatalog}</p>}
      {fields.singular.map(field => {
        const value = character.values[field.id];
        const assigned = isResourceReference(value) ? resources.find(r => r.id === value.resourceId) : undefined;
        return <label className="field" key={field.id}><span>{field.name}</span>
          <select value={assigned?.id ?? ''} onChange={e => {
            const id = e.target.value;
            void save(() => id ? assignCatalog(character.id, id, field.id) : commitCharacterView(character.id, {
              [field.id]: null, ...(subrace?.race.id === field.id ? { [subrace.selection.id]: null } : {})
            }));
          }}>
            <option value="">{it.choose}</option>
            {assigned && <option value={assigned.id}>{assigned.name}</option>}
            {templates.filter(r => r.definitionId === field.resource_type && r.id !== assigned?.id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>;
      })}
      {subrace && <label className="field"><span>{subrace.selection.name}</span>
        <select aria-label={subrace.selection.name} aria-describedby={subraceHelpId}
          disabled={!isResourceReference(race)} value={typeof subraceValue === 'string' ? subraceValue : ''} onChange={e => {
          const value = e.target.value;
          if (isResourceReference(race)) void save(() => setCharacterSubrace(character.id, race.resourceId, value || null));
        }}>
          <option value="">{options.length ? it.choose : it.noSubraces}</option>
          {typeof subraceValue === 'string' && subraceValue && !options.some(o => o.id === subraceValue)
            && <option value={subraceValue}>{it.unknownSubrace} · {subraceValue}</option>}
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select><small id={subraceHelpId} className="muted">{it.subraceHelp}</small>
      </label>}
      {wrappers.map(wrapper => {
        const value = wrapper.values.class;
        const instance = isResourceReference(value) ? resources.find(r => r.id === value.resourceId) : undefined;
        const level = system.definition.resources.find(d => d.id === wrapper.definitionId)?.stats.find(s => s.id === 'class_level');
        return <div className="resource-card" key={wrapper.id}>
          <strong>{instance?.name ?? wrapper.name}</strong>
          {level && <FieldInput stat={{ ...level, name: `${it.classLevel} · ${instance?.name ?? wrapper.name}` }}
            value={wrapper.values.class_level} onSave={value => {
              void save(async () => {
                if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(it.invalidNumber);
                await commitResourceView(wrapper.id, { class_level: value });
              });
            }} />}
          <button className="link-button" onClick={() => void save(() => removeCharacterClass(character.id, wrapper.id))}>{it.removeClass} · {instance?.name ?? wrapper.name}</button>
        </div>;
      })}
      {fields.classes && <><label className="field"><span>{it.classChoice}</span>
        <select value={chosen} disabled={!classes.length} onChange={e => setSelected(e.target.value)}>
          <option value="">{classes.length ? it.choose : it.noCatalog}</option>
          {classes.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}
        </select>
      </label><button className="button secondary" disabled={!chosen} onClick={() => void save(() => assignCatalog(character.id, chosen, fields.classes!.id))}>{it.addClass}</button></>}
    </fieldset>
  </section>;
}
