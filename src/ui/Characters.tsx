/** @file Manual character creation and source-generated character sheets. */
import { memo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ListChecks, Plus, ScrollText, Search, Trash2 } from 'lucide-react';
import { isResourceReference, object, type Character, type StoredSystem, type View } from '../domain/model';
import { db, detachResource, setCharacterValue } from '../persistence/db';
import { CompatibilityBadge, Empty, Modal, PageHeading, Warning, type Run } from './shared';
import { it } from './it';
import { useUi } from './store';
import { commitCharacterView, commitResourceView } from '../persistence/views';
import { setResourceOverride } from '../persistence/resources';
import { ViewErrorGroup } from './ViewErrors';
import { manualFieldGroup, sessionViews } from '../engine/view-session';
import { SourceForm } from './SourceForm';
import { CharacterCatalog } from './CharacterCatalog';
import { SheetSections } from './SheetSections';
import { BaseValueEditor } from './BaseValueEditor';
import { RuntimeResource } from '../engine/formulas';
import { CharacterCreator } from './CharacterCreator';
import { useCharacterEvents } from './CharacterEvents';
import { resolveCharacterOverrides } from '../engine/overrides';
import { CharacterProgression } from './CharacterProgression';
import { catalogFields } from '../persistence/catalog';

/** Name the declared class/origin fields that have no assigned resource yet; nothing is assigned or inferred here. */
function missingSetup(system: StoredSystem, character: Character): string[] {
  const fields = catalogFields(system.definition);
  const classes = fields.classes ? character.values[fields.classes.id] : undefined;
  return [
    ...(fields.classes && !(Array.isArray(classes) && classes.length > 0) ? [it.setupClassShort] : []),
    ...fields.singular.filter(field => !isResourceReference(character.values[field.id])).map(field => field.name)
  ];
}

/** List persisted characters; creation never claims to execute the official flow. */
export function Characters({ systems, characters, run }: { systems: StoredSystem[]; characters: Character[]; run: Run }) {
  const { search, setSearch, openCharacter, navigate, selectSystem } = useUi();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('');
  const filtered = characters.filter(c => (!filter || c.systemKey === filter)
    && c.name.toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it')));
  // Search and system filters only earn their space once there is something to narrow down.
  const rosterSystems = systems.filter(s => characters.some(c => c.systemKey === s.key));
  const searchable = characters.length >= 4 || !!search;
  const highlightRecent = characters.length > 1 && !search && !filter;
  const onlyDemo = characters.every(c => systems.find(s => s.key === c.systemKey)?.definition.id === 'polysheet-sentieri');
  return <>
    <PageHeading title={it.allCharacters} description={it.characterSubtitle}
      action={<button className="button primary" onClick={() => systems.length ? setCreating(true) : navigate('systems')}><Plus size={18} />{it.newCharacter}</button>} />
    {searchable && <div className="character-toolbar"><div className="tab-label"><span className="tab-dot" />{it.allCharactersTab} <span className="count">{characters.length}</span></div>
      <label className="search"><Search size={17} /><input aria-label={it.search} placeholder={it.search} value={search} onChange={e => setSearch(e.target.value)} /></label></div>}
    {rosterSystems.length > 1 && <div className="roster-filters" role="group" aria-label={it.chooseSystem}>
      <button aria-pressed={!filter} onClick={() => setFilter('')}>{it.allSystems} <span>{characters.length}</span></button>
      {rosterSystems.map(s => <button key={s.key}
        aria-pressed={filter === s.key} onClick={() => setFilter(s.key)}>{s.definition.name} <span>{characters.filter(c => c.systemKey === s.key).length}</span></button>)}
    </div>}
    {characters.length === 0 ? <Empty title={it.emptyCharacters} icon={<ScrollText size={26} />}
      action={<button className="button secondary" onClick={() => navigate('systems')}><BookOpen size={17} />{it.importSystem}</button>}>{it.emptyCharactersHelp}</Empty>
      : filtered.length ? <div className="character-grid">{filtered.map((c, index) => {
      const s = systems.find(s => s.key === c.systemKey);
      return <button className={`character-card ${highlightRecent && index === 0 ? 'character-recent' : ''}`} key={c.id} onClick={() => openCharacter(c.id)}>
        {highlightRecent && index === 0 && <span className="recent-label">{it.recentCharacter}</span>}
        <div className="character-art" aria-hidden="true"><div className="character-monogram">{c.name.slice(0, 2).toLocaleUpperCase('it')}</div><span className="character-system">{s?.definition.abbreviation ?? '?'}</span></div>
        <div className="character-card-body"><div className="card-title-row"><h2>{c.name}</h2></div><p className="muted">{s?.definition.name} · v{s?.definition.version}</p>
          {s?.definition.id === 'polysheet-sentieri' && <p className="badge badge-warning">{it.demoBadge}</p>}
          <div className="character-card-meta"><span><i />{it.saved}</span><small>{new Date(c.updatedAt).toLocaleDateString('it')}</small></div>
          <div className="card-open-row">{s && s.diagnostics.length > 0 && <CompatibilityBadge system={s} />}<span>{it.openSheet}<ArrowUpRight size={15} /></span></div></div>
      </button>;
    })}<button className="add-character-card" onClick={() => setCreating(true)}><Plus size={28} /><span>{it.newCharacter}</span><small>{it.anotherStory}</small></button></div> : <Empty title={it.noResults} />}
    <div className="privacy-strip"><Check size={16} /><span>{it.local}.</span><span className="muted">{it.noAccount}</span></div>
    {characters.length > 0 && onlyDemo && <div className="getting-started"><BookOpen size={24} /><div><strong>{it.chooseRules}</strong><p className="muted">{it.chooseRulesHelp}</p></div><button className="button secondary" onClick={() => navigate('systems')}>{it.systems}</button></div>}
    {creating && <CharacterCreator systems={systems} onSystemChange={selectSystem} run={run}
      onClose={() => setCreating(false)} onDone={id => { setCreating(false); openCharacter(id); }} />}
  </>;
}
/** Render the pinned snapshot, not unrelated shell save-status changes; writes patch the latest record. */
export const CharacterSheet = memo(function CharacterSheet({ character, system, run }: { character: Character; system: StoredSystem; run: Run }) {
  const { navigate } = useUi();
  const [deleting, setDeleting] = useState(false);
  const [sourceGroup, setSourceGroup] = useState<View | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [progression, setProgression] = useState(false);
  const events = useCharacterEvents(system, character);
  // Unsaved card selections live with this sheet only; a reload starts from the saved values.
  const cardInputs = useRef(new Map<string, Record<string, unknown>>());
  const resources = useLiveQuery(() => db.resources.where('systemKey').equals(system.key).toArray(), [system.key]) ?? [];
  const overrides = resolveCharacterOverrides(character.overrides);
  const change = (id: string, value: unknown) => { void run(() => setCharacterValue(character.id, id, value)); };
  const context = {
    canEvent: events.canEvent, onEvent: events.onEvent, eventBusy: events.eventBusy,
    canResourceEvent: events.canResourceEvent, onResourceEvent: events.onResourceEvent, cardInputs: cardInputs.current,
    onResourceChange: (resourceId: string, statId: string, value: unknown) => { void run(() => commitResourceView(resourceId, { [statId]: value })); },
    onResourceOverride: (resourceId: string, statId: string, value: number) => { void run(() => setResourceOverride(resourceId, statId, value)); },
    character: new RuntimeResource(`character:${character.id}`, system.definition.character_stats,
      character.values, character.createdAt, {}, overrides.values, undefined, overrides.modifiers),
    stats: system.definition.character_stats, values: character.values,
    overrides: overrides.values, modifiers: overrides.modifiers, onChange: change,
    systemKey: system.key, createdAt: character.createdAt, resources, resourceDefinitions: system.definition.resources,
    enumerations: system.definition.enumerated_types,
    onCommit: (patch: import('../persistence/views').ValuePatch, additions?: import('../domain/model').ResourceInstance[]) => commitCharacterView(character.id, patch, additions)
  };
  const missing = missingSetup(system, character);
  const groups = system.definition.character_creation_flow.flatMap(page => {
    try { return sessionViews(object(page).view).filter(v => v.type === 'section' && Array.isArray(v.content) && v.content.some(c => object(c).type === 'stat')); }
    catch { return []; }
  });
  return <>
    {events.dialog}
    <button className="link-button back-link" onClick={() => navigate('characters')}><ArrowLeft size={17} />{it.back}</button>
    <PageHeading title={character.name}
      description={`${system.definition.name} · v${system.definition.version} · ${system.digest.slice(0, 8)} · ${it.sheet}`}
      action={<div className="button-row character-sheet-actions">
        {system.definition.progression_systems.experience_levelling_system != null
          && <button type="button" className="button secondary" onClick={() => setProgression(true)}>{it.progression}</button>}
        <button type="button" className="button primary" onClick={() => setSetup(true)}>{it.characterSetup}</button>
        <button type="button" className="icon-button danger-text" aria-label={it.delete} title={it.deleteCharacter}
          onClick={() => setDeleting(true)}><Trash2 size={17} /></button>
      </div>} />
    {system.definition.id === 'polysheet-sentieri' && <Warning>{it.demoDescription}</Warning>}
    {system.diagnostics.length > 0 && <Warning>{it.rulesWarning} <button className="link-button" onClick={() => { useUi.getState().selectSystem(system.key); navigate('diagnostics'); }}>{it.diagnostics}</button></Warning>}
    {missing.length > 0 && <div className="notice setup-notice" role="note"><ListChecks size={20} aria-hidden="true" />
      <div><strong>{it.sheetIncomplete}</strong><p>{it.sheetIncompleteHelp} <b>{missing.join(', ')}</b>. {it.sheetIncompleteWhy}</p></div>
      <button type="button" className="button secondary" onClick={() => setSetup(true)}>{it.completeSetup}</button></div>}
    {setup && <CharacterCreator systems={[system]} character={character} onSystemChange={() => undefined}
      run={run} onClose={() => setSetup(false)} onDone={() => setSetup(false)} />}
    {progression && <CharacterProgression character={character} system={system} resources={resources} sheet={context} onClose={() => setProgression(false)} />}
    <div className="sheet-layout"><div className="sheet-main">
      <h2 className="sr-only">{it.sheet}</h2>
      <ViewErrorGroup><SheetSections sections={system.definition.character_sheet_sections} context={context} /></ViewErrorGroup>
      {groups.length > 0 && <details className="base-editor"><summary>{it.sourceFormGroups}</summary><p className="muted">{it.sourceFormHelp}</p>
        {groups.map((v, i) => <button className="button secondary" key={`${v.id}:${i}`} onClick={() => setSourceGroup(v)}>{it.edit} · {v.id}</button>)}
      </details>}
      {sourceGroup && <Modal title={`${it.edit} · ${sourceGroup.id}`} onClose={() => !formBusy && setSourceGroup(null)}>
        <p className="muted">{it.sourceFormHelp}</p><SourceForm input={manualFieldGroup(sourceGroup)} context={context} onBusyChange={setFormBusy} onDone={() => setSourceGroup(null)} />
      </Modal>}
      {!system.definition.character_sheet_sections.length && <Warning>{it.noSections}</Warning>}
      <BaseValueEditor stats={system.definition.character_stats} values={character.values} resources={resources} onSave={change} />
    </div><aside className="sheet-aside sheet-anchor" id="sheet-related-resources" tabIndex={-1}><CharacterCatalog key={character.id} character={character} system={system} resources={resources} run={run} /><div className="aside-note"><h2>{it.assigned}</h2><p className="muted">{it.resourceHelp}</p>
      {!character.resourceIds.length && <p>{it.noAssigned}</p>}
      {character.resourceIds.map(id => {
        const resource = resources.find(r => r.id === id);
        return <div className="attached-resource" key={id}><strong>{resource?.name ?? id}</strong><button className="link-button" onClick={() => void run(() => detachResource(character.id, id))}>{it.detach}</button></div>;
      })}
      <button className="button secondary" onClick={() => { useUi.getState().selectSystem(system.key); navigate('resources'); }}><Plus size={16} />{it.resources}</button>
    </div><p className="aside-caption">{it.savingHelp}</p></aside></div>
    {deleting && <Modal title={it.deleteCharacter} onClose={() => setDeleting(false)}><div className="modal-actions">
      <button className="button secondary" onClick={() => setDeleting(false)}>{it.cancel}</button>
      <button className="button danger" onClick={() => void run(async () => {
        await db.transaction('rw', db.characters, db.rolls, db.combats, async () => {
          if ((await db.combats.where('systemKey').equals(character.systemKey).toArray()).some(c => c.combatants.some(f => f.characterId === character.id)))
            throw new Error('Personaggio usato in un incontro: rimuovilo prima dal combattimento.');
          await db.characters.delete(character.id);
          await db.rolls.filter(r => r.characterId === character.id).delete();
        }); navigate('characters');
      })}>{it.delete}</button>
    </div></Modal>}
  </>;
});
