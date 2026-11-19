/**
 * @file Local resource, dice, compatibility, and backup screens.
 * @remarks Resource links are PolySheet notebook metadata, not RPG rule effects.
 */
import { useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownToLine, Dices, FileCheck2, HardDrive, Moon, Plus, ShieldCheck, Sun, Trash2, Upload } from 'lucide-react';
import { type Character, type Preferences, type ResourceInstance, type StoredSystem } from '../domain/model';
import { rollDice } from '../engine/dice';
import { db, attachResource, saveRoll } from '../persistence/db';
import { deleteResource } from '../persistence/resources';
import { ResourceEditor } from './ResourceEditor';
import { exportBackup, restoreBackup, validateBackup, type ValidBackup } from '../persistence/backup';
import { RenderView } from './renderer';
import { CompatibilityBadge, Empty, Modal, PageHeading, SystemSelect, Warning, download, readFile, type Run } from './shared';
import { useUi } from './store';
import { it } from './it';
import { CatalogImport } from './CatalogImport';
import { groupDiagnostics } from '../importing/diagnostic-groups';

interface SystemPageProps { systems: StoredSystem[]; system?: StoredSystem; run: Run }
function Selector({ systems, system }: Omit<SystemPageProps, 'run'>) {
  return <SystemSelect systems={systems} value={system?.key ?? ''} onChange={useUi.getState().selectSystem} />;
}
/** Manage local resource instances without executing resource mechanics. */
export function Resources({ systems, system, characters, run }: SystemPageProps & { characters: Character[] }) {
  const resources = useLiveQuery(() => system ? db.resources.where('systemKey').equals(system.key).toArray() : [], [system?.key]) ?? [];
  const [editing, setEditing] = useState<ResourceInstance | 'new' | null>(null);
  const [resourceBusy, setResourceBusy] = useState(false);
  const [definitionId, setDefinitionId] = useState('');
  const [deleting, setDeleting] = useState<ResourceInstance | null>(null);
  const [characterId, setCharacterId] = useState('');
  const defs = system?.definition.resources ?? [];
  const chosenId = definitionId || defs[0]?.id;
  const definition = defs.find(r => r.id === chosenId);
  const eligible = characters.filter(c => c.systemKey === system?.key);
  const selectedCharacter = eligible.some(c => c.id === characterId) ? characterId : eligible[0]?.id ?? '';
  return <>
    <PageHeading title={it.resources} description={it.resourceSubtitle}
      action={<button className="button primary" disabled={!defs.length} onClick={() => { setDefinitionId(defs[0]?.id ?? ''); setEditing('new'); }}><Plus size={18} />{it.newResource}</button>} />
    <Selector systems={systems} system={system} />
    {!system ? <Empty title={it.noSystemSelected} /> : resources.length ? <ResourceArchive key={system.key} defs={defs}
      records={resources.filter(r => !r.catalogGroup || r.catalogGroup === r.id)} render={r => {
      const d = defs.find(d => d.id === r.definitionId);
      return <article key={r.id} className="resource-card"><div className="card-title-row"><span className="eyebrow">{d?.name}</span><button className="icon-button danger-text" aria-label={`${it.delete} ${r.name}`} onClick={() => setDeleting(r)}><Trash2 size={17} /></button></div>
        <h2>{r.name}</h2>{r.catalogSource ? <><p className="muted">{it.catalogEntry}</p>
          {r.catalogIssue && <Warning>{it.catalogUnavailable}: {r.catalogIssue}</Warning>}</> : d?.display_view ? <RenderView input={d.display_view} context={{
          systemKey: system.key, stats: d.stats, values: r.values, createdAt: r.createdAt, instanceId: r.sourceId ?? r.id, resources, resourceDefinitions: defs,
          enumerations: system.definition.enumerated_types
        }} /> : <p className="muted">{it.noResourceView}</p>}
        {r.catalogSource ? <button className="link-button" onClick={() => download(r.catalogSource!.original, `${r.definitionId}.rpg.json`)}>{it.exportCatalog}</button>
          : <button className="link-button" onClick={() => { setDefinitionId(r.definitionId); setEditing(r); }}>{it.edit}</button>}
        {!r.catalogSource && eligible.length > 0 && <div className="resource-attach"><label className="field"><span>{it.characters}</span><select aria-label={`${it.characters} · ${r.name}`} value={selectedCharacter} onChange={e => setCharacterId(e.target.value)}>{eligible.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <button className="button secondary" onClick={() => void run(() => attachResource(selectedCharacter, r.id))}>{it.attach}</button></div>}
      </article>;
    }} /> : <Empty title={it.noResources}>{it.resourceHelp}</Empty>}
    {system && <details className="catalog-import-disclosure"><summary>{it.importCatalog}</summary>
      <CatalogImport key={system.key} system={system} run={run} /></details>}
    {editing && system && <Modal title={editing === 'new' ? it.newResource : it.edit} onClose={() => !resourceBusy && setEditing(null)}>
      {definition && <ResourceEditor key={chosenId} system={system} definition={definition} editing={editing} resources={resources}
        onSelect={setDefinitionId} onDone={() => setEditing(null)} onBusyChange={setResourceBusy} run={run} />}
    </Modal>}
    {deleting && <Modal title={it.deleteResource} onClose={() => setDeleting(null)}><div className="modal-actions"><button className="button secondary" onClick={() => setDeleting(null)}>{it.cancel}</button><button className="button danger" onClick={() => void run(async () => {
      await deleteResource(deleting.id); setDeleting(null);
    })}>{it.delete}</button></div></Modal>}
  </>;
}
/** Roll bounded manual expressions using the selected system's dice, when present. */
export function DicePage({ systems, system, preferences, run }: SystemPageProps & { preferences: Preferences }) {
  const [expression, setExpression] = useState('1d6');
  const [syntax, setSyntax] = useState('');
  const rolls = useLiveQuery(() => system ? db.rolls.where('systemKey').equals(system.key).toArray() : [], [system?.key]) ?? [];
  const sorted = [...rolls].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];
  function roll(formula: string) {
    if (!system) return;
    // A formula mistake belongs beside the field; only storage failures use the app-wide notice.
    let result: ReturnType<typeof rollDice>;
    try { result = rollDice(formula, system.definition.dice?.map(d => d.faces)); }
    catch (error) { setSyntax(error instanceof Error ? error.message : String(error)); return; }
    setSyntax('');
    void run(async () => {
      await saveRoll({ id: crypto.randomUUID(), systemKey: system.key, formula: formula.trim(), ...result, createdAt: new Date().toISOString() }, preferences.historyLimit);
    });
  }
  return <>
    <PageHeading title={it.dice} description={it.diceSubtitle} /><Selector systems={systems} system={system} />
    <div className="dice-layout"><section className="dice-panel"><Dices size={36} /><h2>{it.roll}</h2><p className="muted">{it.manualDice}</p>
      {system && !system.definition.dice && <Warning>{it.noDice}</Warning>}
      <form onSubmit={e => { e.preventDefault(); roll(expression); }}>
        <label className="field"><span>{it.formula}</span><input value={expression} onChange={e => { setExpression(e.target.value); setSyntax(''); }} maxLength={100} placeholder="2d6 + 3"
          aria-invalid={!!syntax} aria-describedby={syntax ? 'dice-formula-error' : undefined} />
          {syntax && <small id="dice-formula-error" role="alert" className="error-text">{syntax}</small>}</label>
        <div className="die-buttons">{(system?.definition.dice ?? []).map(d => <button className="button die-button" key={d.id} type="button" disabled={!system}
          aria-label={`${it.roll} ${d.name}`} onClick={() => { setExpression(`1d${d.faces}`); roll(`1d${d.faces}`); }}>{d.name}</button>)}</div>
        <button className="button primary" disabled={!system}><Dices size={18} />{it.roll}</button>
      </form>
      {latest && <div className="dice-result" aria-live="polite"><span className="eyebrow">{it.result}</span><output>{latest.total}</output><span>{latest.formula} · [{latest.results.join(', ')}]</span></div>}
    </section><section className="history-panel"><div className="section-title"><h2>{it.history}</h2><span className="count">{sorted.length}</span></div>
      {!sorted.length && <Empty title={it.noRolls} />}
      {sorted.slice(0, 100).map(r => <div className="roll-row" key={r.id}><span className="roll-icon"><Dices size={18} /></span><div><strong>{r.formula}</strong><small className="muted">[{r.results.join(', ')}] · {new Date(r.createdAt).toLocaleString('it')}</small></div><output>{r.total}</output></div>)}
    </section></div>
  </>;
}
/** Display precise import diagnostics without claiming whole-system compatibility. */
export function Diagnostics({ systems, system }: Omit<SystemPageProps, 'run'>) {
  return <>
    <PageHeading title={it.diagnostics} description={it.diagnosticSubtitle} /><Selector systems={systems} system={system} />
    <div className="notice"><ShieldCheck size={21} /><p>{it.diagnosticHelp}</p></div>
    {system ? <><div className="diagnostic-summary"><FileCheck2 size={26} /><div><h2>{system.definition.name} · v{system.definition.version}</h2><p className="muted">{system.diagnostics.length} {it.issues} · SHA-256 <code>{system.digest.slice(0, 16)}…</code></p></div><CompatibilityBadge system={system} /></div>
      <p className="muted">{it.provenance}: {system.source}</p>
      {system.diagnostics.length ? <><Warning>{it.rulesWarning}</Warning>
        <p className="muted diagnostic-intro">{it.diagnosticGroupsHelp}</p>
        {groupDiagnostics(system.diagnostics).map(group => <details className="diagnostic-group" key={group.category} open={group.category === 'error'}>
          <summary><span className={`badge ${group.category === 'error' ? 'badge-error' : 'badge-warning'}`}>{group.items.length}</span>
            <span><strong>{it.diagnosticGroups[group.category]}</strong><small className="muted">{it.diagnosticGroupNotes[group.category]}</small></span></summary>
          <div className="diagnostic-list">{group.items.slice(0, 100).map((d, i) => <article key={i}><div><code>{d.path}</code><p>{d.message}</p></div></article>)}</div>
          {group.items.length > 100 && <p className="muted">{it.displayedDiagnostics}</p>}
        </details>)}</> : <div className="notice notice-success"><ShieldCheck size={20} /><p>{it.noDiagnostics}</p></div>}
    </> : <Empty title={it.noSystemSelected} />}
  </>;
}
/** Export coherent snapshots and require confirmation before atomic replacement. */
export function Settings({ preferences, run }: { preferences: Preferences; run: Run }) {
  const file = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<{ text: string; data: ValidBackup } | null>(null);
  const [restoring, setRestoring] = useState(false);
  return <>
    <PageHeading title={it.settings} description={it.settingsSubtitle} />
    <div className="settings-grid"><section className="settings-panel"><h2>{it.appearance}</h2><div className="theme-options">{(['light', 'dark'] as const).map(theme => <button key={theme} className={`theme-option ${preferences.theme === theme ? 'selected' : ''}`} aria-pressed={preferences.theme === theme} onClick={() => void run(() => db.preferences.put({ ...preferences, theme }))}>{theme === 'light' ? <Sun /> : <Moon />}{theme === 'light' ? it.light : it.dark}</button>)}</div>
      <label className="field"><span>{it.historyLimit}</span><input type="number" min={1} max={1000} defaultValue={preferences.historyLimit} key={preferences.historyLimit} onBlur={e => {
        const historyLimit = Number(e.target.value);
        void run(async () => {
          if (!Number.isInteger(historyLimit) || historyLimit < 1 || historyLimit > 1000) throw new Error(it.invalidHistoryLimit);
          await db.transaction('rw', db.preferences, db.rolls, async () => {
            await db.preferences.put({ ...preferences, historyLimit });
            const ids = await db.rolls.orderBy('createdAt').reverse().primaryKeys();
            await db.rolls.bulkDelete(ids.slice(historyLimit));
          });
        });
      }} /></label><p className="muted">{it.installHelp}</p></section>
      <section className="settings-panel backup-panel"><div className="panel-icon"><HardDrive size={24} /></div><h2>{it.backup}</h2><p className="muted">{it.backupHelp}</p><div className="button-row"><button className="button primary" onClick={() => void run(async () => download(await exportBackup(), `polysheet-${new Date().toISOString().slice(0, 10)}.json`))}><ArrowDownToLine size={17} />{it.export}</button><button className="button secondary" onClick={() => file.current?.click()}><Upload size={17} />{it.restore}</button></div>
        <input ref={file} type="file" accept=".json,application/json" aria-label={it.restore} className="sr-only" onChange={e => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (f) void run(async () => { const text = await readFile(f, 32 * 1024 * 1024); setBackup({ text, data: await validateBackup(text) }); });
        }} />
      </section></div>
    {backup && <Modal title={it.restoreTitle} onClose={() => !restoring && setBackup(null)}><p>{it.restoreHelp}</p><p>{backup.data.systems.length} {it.systems} · {backup.data.characters.length} {it.characters} · {backup.data.resources.length} {it.resources} · {backup.data.rolls.length} {it.rollsLabel}</p><div className="modal-actions"><button className="button secondary" disabled={restoring} onClick={() => setBackup(null)}>{it.cancel}</button><button className="button danger" disabled={restoring} onClick={() => {
      setRestoring(true); void run(async () => {
        try { await restoreBackup(backup.text); setBackup(null); useUi.getState().navigate('characters'); } finally { setRestoring(false); }
      }, it.restored);
    }}>{it.confirmRestore}</button></div></Modal>}
  </>;
}

const archivePage = 50;
const folded = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('it');

/**
 * Search, filter and page the archive; only one page of cards is mounted.
 * @remarks Keyed by system, so filters reset when the system changes. Catalog entries are the
 * records that keep an imported original (`catalogSource`), not private copies of a catalog graph.
 */
function ResourceArchive({ records, defs, render }: {
  records: ResourceInstance[]; defs: StoredSystem['definition']['resources']; render: (record: ResourceInstance) => ReactNode;
}) {
  const [query, setQuery] = useState(''), [type, setType] = useState(''), [origin, setOrigin] = useState('');
  const [page, setPage] = useState(0);
  const needle = folded(query.trim());
  const matches = records.filter(r => (!needle || folded(r.name).includes(needle)) && (!type || r.definitionId === type)
    && (!origin || (origin === 'catalog') === !!r.catalogSource));
  const pages = Math.max(1, Math.ceil(matches.length / archivePage)), current = Math.min(page, pages - 1);
  const types = defs.filter(d => records.some(r => r.definitionId === d.id));
  const filtered = !!needle || !!type || !!origin;
  const reset = () => { setQuery(''); setType(''); setOrigin(''); setPage(0); };
  return <>
    <div className="archive-filters" role="search">
      <label className="field"><span>{it.searchResources}</span>
        <input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
      <label className="field"><span>{it.resourceType}</span>
        <select value={type} onChange={e => { setType(e.target.value); setPage(0); }}>
          <option value="">{it.allTypes}</option>
          {types.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select></label>
      <label className="field"><span>{it.resourceOrigin}</span>
        <select value={origin} onChange={e => { setOrigin(e.target.value); setPage(0); }}>
          <option value="">{it.allOrigins}</option>
          <option value="catalog">{it.originCatalog}</option>
          <option value="local">{it.originLocal}</option>
        </select></label>
      {filtered && <button type="button" className="button secondary" onClick={reset}>{it.clearFilters}</button>}
    </div>
    <p className="muted" role="status" data-testid="resource-count">{it.resourceResults(matches.length, records.length)}</p>
    {matches.length ? <div className="resource-grid">{matches.slice(current * archivePage, (current + 1) * archivePage).map(render)}</div>
      : <Empty title={it.noResourceMatches}><button type="button" className="button secondary" onClick={reset}>{it.clearFilters}</button></Empty>}
    {pages > 1 && <nav className="archive-pages" aria-label={it.resourcePages}>
      <button type="button" className="button secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>{it.previousPage}</button>
      <span>{it.pageOf(current + 1, pages)}</span>
      <button type="button" className="button secondary" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>{it.nextPage}</button>
    </nav>}
  </>;
}
