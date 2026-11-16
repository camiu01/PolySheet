/** @file Reviewed local/link catalog imports and immutable-original provenance. */
import { useRef, useState } from 'react';
import type { StoredSystem } from '../domain/model';
import { prepareCatalogTemplate, type CatalogPreview } from '../importing/catalog';
import { importCatalogUrl } from '../importing/catalog-url';
import { installCatalogs, installRepositoryBundle } from '../persistence/catalog';
import { it } from './it';
import { Modal, Warning, readFile, type Run } from './shared';

/** Show a preview before any catalog data is written. */
export function CatalogImport({ system, run }: { system: StoredSystem; run: Run }) {
  const file = useRef<HTMLInputElement>(null), busy = useRef(false);
  const [previews, setPreviews] = useState<CatalogPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState(false);
  const [url, setUrl] = useState(''), [ref, setRef] = useState('');
  async function load(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setLoading(true);
    try { await action(); } finally { busy.current = false; setLoading(false); }
  }
  return <div className="import-panel">
    <h2>{it.importCatalog}</h2><p className="muted">{it.catalogUrlHelp}</p>
    <form onSubmit={event => {
      event.preventDefault();
      void run(() => load(async () => {
        const next = await importCatalogUrl(url, system, ref);
        setRemote(true); setPreviews(next);
      }));
    }}>
      <label className="field"><span>{it.catalogUrl}</span><input type="text" inputMode="url" autoCapitalize="none" spellCheck={false}
        required value={url} disabled={loading} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repository/tree/main/catalogs" /></label>
      <label className="field"><span>{it.repositoryRef}</span><input value={ref} disabled={loading} maxLength={200}
        onChange={e => setRef(e.target.value)} placeholder={it.repositoryDefault} /></label>
      <button className="button primary" disabled={loading}>{loading ? it.loading : it.catalogFromUrl}</button>
      <details><summary>index.json</summary><p className="muted">{it.catalogIndexHelp}</p></details>
    </form>
    <p className="muted">{it.catalogHelp}</p>
    <button className="button secondary" disabled={loading} onClick={() => file.current?.click()}>{it.importCatalog}</button>
    <input ref={file} type="file" multiple accept=".json,application/json" className="sr-only" aria-label={it.catalogFiles} disabled={loading} onChange={event => {
      const files = Array.from(event.target.files ?? []); event.target.value = '';
      if (!files.length) return;
      void run(() => load(async () => {
        if (files.length > 100 || files.reduce((n, f) => n + f.size, 0) > 8 * 1024 * 1024) throw new Error(it.catalogLimit);
        const next: CatalogPreview[] = [];
        for (const f of files) {
          if (!/\.json$/i.test(f.name)) throw new Error(it.catalogFormat);
          next.push(await prepareCatalogTemplate(await readFile(f, 8 * 1024 * 1024), f.name, system));
        }
        setRemote(false); setPreviews(next);
      }));
    }} />
    {previews.length > 0 && <Modal title={it.catalogPreview} onClose={() => !busy.current && setPreviews([])}>
      <Warning>{it.catalogWarning}</Warning>
      <ul>{previews.map(p => <li key={p.rootId}>{p.resources[0].name} · {p.resources[0].definitionId}
        {p.resources[0].catalogIssue && <p className="error-text">{it.catalogUnavailable}: {p.resources[0].catalogIssue}</p>}
        <p className="muted">{p.resources[0].catalogSource?.source}</p>
      </li>)}</ul>
      <p>{previews.length} {it.catalogInstances}</p>
      <div className="modal-actions">
        <button className="button secondary" disabled={loading} onClick={() => setPreviews([])}>{it.cancel}</button>
        <button className="button primary" disabled={loading} onClick={() => void run(() => load(async () => {
          if (remote) await installRepositoryBundle(system, previews);
          else await installCatalogs(previews);
          setPreviews([]);
        }), it.catalogImported)}>{it.confirmImport}</button>
      </div>
    </Modal>}
  </div>;
}
