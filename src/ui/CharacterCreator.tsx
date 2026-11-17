/** @file Atomic guided setup with optional explicit first-level health initialization. */
import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Character, ResourceInstance, StoredSystem } from '../domain/model';
import { db, initialValues } from '../persistence/db';
import { catalogFields, configureCharacter } from '../persistence/catalog';
import { setupStats } from '../engine/character-setup';
import { supportsInitialHealth } from '../engine/initial-health';
import { InitialValues } from './InitialValues';
import { Modal, SystemSelect, Warning, type Run } from './shared';
import { it } from './it';
import { CharacterInventory } from './CharacterInventory';
import { RuntimeResource } from '../engine/formulas';
import { useUi } from './store';

/** Keep every choice in a local draft; cancel/failure writes no partial character or graph. */
export function CharacterCreator({ systems, onSystemChange, character, run, onDone, onClose }: {
  systems: StoredSystem[]; onSystemChange: (key: string) => void;
  character?: Character; run: Run; onDone: (id: string) => void; onClose: () => void;
}) {
  const [chosenKey, setChosenKey] = useState('');
  const system = systems.find(s => s.key === (character?.systemKey ?? chosenKey));
  const chooseSystem = (key: string) => { setChosenKey(key); onSystemChange(key); };
  const [busy, setBusy] = useState(false);
  return <Modal title={character ? it.characterSetup : it.newCharacter} onClose={() => !busy && onClose()}>
    {system ? <SetupForm key={system.key} system={system} systems={systems} onSystemChange={chooseSystem}
      character={character} busy={busy} setBusy={setBusy} run={run} onDone={onDone} onClose={onClose} />
      : <><p>{it.chooseGameHelp}</p><SystemSelect systems={systems} value="" onChange={chooseSystem} />
        <div className="modal-actions"><button className="button secondary" onClick={onClose}>{it.cancel}</button></div></>}
  </Modal>;
}

/** Reuse source creation fields, or declared numeric bases when no creation form exists; never run page hooks. */
function SetupForm({ system, systems, onSystemChange, character, busy, setBusy, run, onDone, onClose }: {
  system: StoredSystem; systems: StoredSystem[]; onSystemChange: (key: string) => void;
  character?: Character; busy: boolean; setBusy: (value: boolean) => void;
  run: Run; onDone: (id: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(character?.name ?? '');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pendingScores, setPendingScores] = useState(false);
  const [automaticHealth, setAutomaticHealth] = useState(true);
  const [additions, setAdditions] = useState<ResourceInstance[]>([]);
  const latestValues = useRef<Record<string, unknown>>({});
  const draftValues = { ...initialValues(system.definition.character_stats), ...character?.values, ...values };
  latestValues.current = draftValues;
  const records = useLiveQuery(() => db.resources.where('systemKey').equals(system.key).toArray(), [system.key]) ?? [];
  const templates = records.filter(r => !r.catalogIssue && (r.catalogSource || !r.catalogGroup));
  const fields = catalogFields(system.definition);
  const canInitializeHealth = !character && supportsInitialHealth(system.definition);
  const initializeHealth = canInitializeHealth && automaticHealth && Boolean(fields.classes && selections[fields.classes.id]);
  const choices = [...(fields.classes ? [{ ...fields.classes, resource_type: 'class', name: character ? it.classChoice : it.setupClass }] : []), ...fields.singular];
  const stats = useMemo(() => {
    const declared = setupStats(system.definition);
    return declared.length ? declared : system.definition.character_stats.filter(stat =>
      stat.type === 'base' && ['integer', 'decimal'].includes(stat.value_type));
  }, [system.definition]);
  return <form className="source-form" onSubmit={event => {
    event.preventDefault(); if (busy || pendingScores || event.currentTarget.querySelector('[aria-invalid="true"]')) return;
    setBusy(true); setError('');
    void run(async () => {
      try {
        const result = await configureCharacter(system, name, values, selections, character?.id, db, initializeHealth, additions);
        onDone(result.id);
      } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); throw cause; }
      finally { setBusy(false); }
    });
  }}>
    <div className="source-form-fields"><fieldset className="source-form-controls" disabled={busy}>
      <p>{character ? it.characterSetup : it.manual}</p>
      <h3>{system.definition.name}</h3>
      {system.definition.id === 'polysheet-sentieri' && <Warning>{it.demoDescription}</Warning>}
      <p className="muted">{character ? it.editSetupHelp : it.setupHelp}</p>
      {!character && <>
        <SystemSelect systems={systems} value={system.key} onChange={onSystemChange} />
        <label className="field"><span>{it.name}</span><input name="character-name" autoComplete="off" value={name}
          onChange={event => setName(event.target.value)} maxLength={100} required placeholder={it.namePlaceholder} /></label>
      </>}
      {choices.length > 0 && <section className="setup-group"><h3>{it.catalog}</h3>
        {!choices.some(field => templates.some(record => record.definitionId === field.resource_type)) && <div className="setup-empty">
          <p className="muted">{it.setupNoCatalog}</p>
          <button type="button" className="button secondary" onClick={() => {
            useUi.getState().selectSystem(system.key); useUi.getState().navigate('resources'); onClose();
          }}>{it.goToCatalogs}</button>
        </div>}
        {choices.map(field => <label className="field" key={field.id}><span>{field.name}</span>
          <select name={`setup-${field.id}`} value={selections[field.id] ?? ''}
            onChange={event => setSelections(previous => ({ ...previous, [field.id]: event.target.value }))}>
            <option value="">{character ? it.keepCurrent : it.choose}</option>
            {templates.filter(r => r.definitionId === field.resource_type).map(record => <option value={record.id} key={record.id}>{record.name}</option>)}
          </select>
        </label>)}
        {!character && choices.some(field => !selections[field.id]) && <Warning>{it.setupIncomplete}</Warning>}
      </section>}
      {canInitializeHealth && <section className="setup-group">
        <label className="check-field"><input type="checkbox" checked={automaticHealth}
          onChange={event => setAutomaticHealth(event.target.checked)} />{it.setupAutoHp}</label>
        {automaticHealth && !initializeHealth && <p className="muted">{it.setupAutoHpChoose}</p>}
      </section>}
      {stats.length > 0 && <InitialValues system={system.definition} stats={stats} automaticHealth={initializeHealth}
        values={{ ...Object.fromEntries(stats.map(stat => [stat.id, stat.default_value])), ...character?.values, ...values }}
        onChange={patch => setValues(previous => ({ ...previous, ...patch }))} onPending={setPendingScores} />}
      <CharacterInventory context={{
        stats: system.definition.character_stats, values: draftValues, systemKey: system.key, drafts: {},
        resources: [...records, ...additions], resourceDefinitions: system.definition.resources,
        enumerations: system.definition.enumerated_types,
        character: new RuntimeResource('character:setup', system.definition.character_stats, draftValues),
        onCommit: async (patch, created = []) => {
          const changes = typeof patch === 'function' ? patch(latestValues.current) : patch;
          latestValues.current = { ...latestValues.current, ...changes };
          setValues(previous => ({ ...previous, ...changes }));
          setAdditions(previous => [...previous, ...created]);
        }
      }} />
    </fieldset></div>
    {error && <p role="alert" className="error-text">{error}</p>}
    <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>{it.cancel}</button>
      <button type="submit" className="button primary" disabled={busy || pendingScores}>{busy ? it.saving : character ? it.save : it.create}</button></div>
  </form>;
}
