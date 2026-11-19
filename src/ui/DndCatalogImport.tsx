/** @file Search bounded 5e/PF2e catalog metadata before downloading one reviewed original. */
import { useRef, useState } from 'react';
import type { StoredSystem } from '../domain/model';
import type { CatalogPreview } from '../importing/catalog';
import { DND_CATALOG_KINDS, discoverDndCatalogs, dndCatalogKind, isDndCatalogSystem, prepareDndCatalog, type DndCatalogKind } from '../importing/dnd-catalogs';
import { LocalResourcePicker } from './LocalResourcePicker';
import { Modal, type Run } from './shared';
import { it } from './it';

/** Share catalog review without writes; keep download errors visible inside the modal for retry. */
export function DndCatalogImport({ system, run, onPreview, disabled, onBusyChange }: {
  system: StoredSystem; run: Run; onPreview: (preview: CatalogPreview) => void;
  disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof discoverDndCatalogs>>>();
  const [selected, setSelected] = useState<DndCatalogKind>('monster');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function load(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true);
    setError('');
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); throw error; }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  const kinds = DND_CATALOG_KINDS.filter(kind => system.definition.resources.some(r => r.id === kind));
  const kind = kinds.find(kind => kind === selected) ?? kinds[0];
  const systemId = system.definition.id;
  if (!isDndCatalogSystem(systemId) || !kind) return null;
  const records = snapshot?.files.filter(file => dndCatalogKind(file.path, systemId) === kind).map(file => ({
    id: file.path, systemKey: system.key, definitionId: kind, values: {},
    name: file.path.split('/').at(-1)!
  })) ?? [];
  return <>
    <button type="button" className="button secondary" disabled={busy || disabled}
      onClick={() => void run(() => load(async () => setSnapshot(await discoverDndCatalogs(systemId))))}>
      {busy ? it.loading : it.dndCatalogImport}
    </button>
    {snapshot && <Modal title={it.dndCatalogImport} onClose={() => !lock.current && setSnapshot(undefined)}>
      <div className="source-form"><div className="source-form-fields">
        {error && <p role="alert" className="error-text">{error}</p>}
        <p className="muted">{it.dndCatalogImportHelp}</p>
        <label className="field"><span>{it.dndCatalogKind}</span><select value={kind} disabled={busy}
          onChange={event => { const next = kinds.find(kind => kind === event.target.value); if (next) { setSelected(next); setError(''); } }}>
          {kinds.map(kind => <option key={kind} value={kind}>{it.dndCatalogKinds[kind]}</option>)}
        </select></label>
        <LocalResourcePicker key={kind} resources={records} busy={busy} onSelect={record => void run(() => load(async () => {
          const preview = await prepareDndCatalog(snapshot, record.id, system);
          onPreview(preview); setSnapshot(undefined);
        }))} />
      </div><div className="modal-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={() => setSnapshot(undefined)}>{it.cancel}</button>
      </div></div>
    </Modal>}
  </>;
}
