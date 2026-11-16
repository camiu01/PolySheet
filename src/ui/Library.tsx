/** @file Local-first system imports with a review-before-write boundary. */
import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, FileJson, FolderInput, Globe, Plus, Trash2, Upload } from 'lucide-react';
import type { StoredSystem } from '../domain/model';
import { demoOriginal } from '../demo';
import { MAX_SYSTEM_BYTES, prepareSystem } from '../importing/system';
import { artifactBytes, prepareImport } from '../importing/package';
import { importFromUrl } from '../importing/url';
import { githubRepository } from '../importing/github';
import { discoverRepository, prepareRepositoryBundle, repositorySystemDownload, type RepositoryDiscovery } from '../importing/repository';
import type { CatalogPreview } from '../importing/catalog';
import { installRepositoryBundle } from '../persistence/catalog';
import { deleteSystem, installSystem } from '../persistence/db';
import { it } from './it';
import { CompatibilityBadge, Modal, PageHeading, Warning, download, downloadBlob, type Run } from './shared';
import { useUi } from './store';

/** Preserve exact source text and let users review compatibility before installing. */
export function Library({ systems, run }: { systems: StoredSystem[]; run: Run }) {
  const file = useRef<HTMLInputElement>(null);
  const repositoryFile = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<StoredSystem | null>(null);
  const [deleting, setDeleting] = useState<StoredSystem | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const [repository, setRepository] = useState<RepositoryDiscovery | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogPreview[]>([]);
  const [catalogProgress, setCatalogProgress] = useState('');
  const [repositoryRef, setRepositoryRef] = useState('');
  const [repositoryPath, setRepositoryPath] = useState('');
  const [repositoryUpload, setRepositoryUpload] = useState<StoredSystem | null>(null);
  const [repositoryLocalKey, setRepositoryLocalKey] = useState('');
  const sourceSystem = repository?.systems.find(s => s.id === repositoryPath);
  const matchingSystems = systems.filter(s => s.definition.id === sourceSystem?.id && s.definition.version === sourceSystem.version);
  const localSystem = repositoryUpload ?? matchingSystems.find(s => s.key === repositoryLocalKey) ?? matchingSystems[0];
  const systemDownload = repository && repositorySystemDownload(repository, repositoryPath);
  const { navigate, selectSystem } = useUi();
  async function prepare(original: string, source: string) { setCatalogs([]); setPreview(await prepareSystem(original, source)); }
  async function load(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try { await action(); } finally { busy.current = false; setLoading(false); }
  }
  async function fromUrl() {
    await load(async () => {
      if (githubRepository(url)) {
        const discovered = await discoverRepository(url, repositoryRef);
        setRepository(discovered); setRepositoryPath(discovered.systems[0]?.id ?? discovered.snapshot.files[0].path);
        setRepositoryUpload(null); setRepositoryLocalKey('');
      } else {
        setCatalogs([]);
        setPreview(await importFromUrl(url.trim())); setShowUrl(false);
      }
    });
  }
  async function fromRepository() {
    if (!repository) return;
    await load(async () => {
      const bundle = await prepareRepositoryBundle(repository, repositoryPath, localSystem,
        (done, total) => setCatalogProgress(`${it.repositoryCatalogProgress}: ${done}/${total}`));
      setPreview(bundle.system); setCatalogs(bundle.catalogs); setCatalogProgress('');
      setRepository(null); setShowUrl(false);
    });
  }
  return <>
    <PageHeading title={it.systems} description={it.systemSubtitle}
      action={<button className="button primary" onClick={() => file.current?.click()}><Plus size={18} />{it.importSystem}</button>} />
    <input ref={file} type="file" accept=".json,.rpg,application/json,application/gzip" className="sr-only" aria-label={it.localFile} onChange={e => {
      const f = e.target.files?.[0]; e.target.value = '';
      if (f) void run(async () => {
        if (!/\.(json|rpg)$/i.test(f.name)) throw new Error(it.invalidFile);
        if (f.size > MAX_SYSTEM_BYTES) throw new Error('File troppo grande: massimo 8 MB.');
        setCatalogs([]); setPreview(await prepareImport(new Uint8Array(await f.arrayBuffer()), f.name));
      });
    }} />
    <div className="library-intro">
      <div className="import-panel">
        <div className="panel-icon"><FolderInput size={24} /></div><h2>{it.importSystem}</h2><p className="muted">{it.importHelp}</p>
        <div className="button-row"><button className="button secondary" onClick={() => file.current?.click()}><Upload size={17} />{it.localFile}</button>
          <button className="button text-button" onClick={() => { setRepository(null); setShowUrl(true); }}><Globe size={16} />{it.importUrl}</button></div>
        <small className="muted">{it.jsonSafety}</small>
      </div>
      <div className="demo-panel">
        <BookOpen className="demo-art" size={120} strokeWidth={1} aria-hidden="true" />
        <h2>{it.demoTitle}</h2><p>{it.demoDescription}</p>
        <button className="button demo-button" onClick={() => void run(() => prepare(demoOriginal, 'PolySheet · contenuto originale MIT'))}>{it.demoAction}<ArrowRight size={17} /></button>
      </div>
    </div>
    <div className="section-title"><h2>{systems.length ? it.libraryTitle : it.noSystems}</h2><span className="muted">{systems.length} {systems.length === 1 ? it.savedVersion : it.savedVersions}</span></div>
    <div className="system-grid">
      {systems.map(s => <article className="system-card" key={s.key}>
        <div className="system-card-top"><span className="system-emblem">{s.definition.abbreviation.slice(0, 4)}</span><CompatibilityBadge system={s} /></div>
        <h3>{s.definition.name}</h3><span className="muted">v{s.definition.version} <span className="mono">{s.digest.slice(0, 6)}</span></span>
        <div className="system-counts"><span>{s.definition.character_stats.length} {it.stats}</span><span>{s.definition.character_sheet_sections.length} {it.sections}</span></div>
        <div className="card-footer"><span className="offline-label"><i />{it.stored}</span><button className="icon-button" aria-label={`${it.details} ${s.definition.name}`} onClick={() => { selectSystem(s.key); navigate('diagnostics'); }}><ArrowRight size={20} /></button></div>
        <button className="link-button" onClick={() => void run(async () => {
          const name = s.definition.id.replace(/[^\w-]/g, '_');
          if (s.artifact) downloadBlob(new Blob([artifactBytes(s.artifact.base64)], { type: 'application/gzip' }), `${name}.rpg`);
          else download(s.original, `${name}.rpg.json`);
        })}><FileJson size={15} />{s.artifact ? it.exportPackage : it.exportSystem}</button>
        <button className="link-button danger-text" aria-label={`${it.removeSystem} ${s.definition.name} · ${s.digest.slice(0, 6)}`}
          disabled={loading} onClick={() => setDeleting(s)}><Trash2 size={15} />{it.removeSystem}</button>
      </article>)}
    </div>
    <div className="footnote"><BookOpen size={18} /><div><strong>{it.versions}</strong><p>{it.versionHelp}</p></div></div>
    {deleting && <Modal title={it.removeSystemTitle} onClose={() => !busy.current && setDeleting(null)}>
      <h3>{deleting.definition.name} · v{deleting.definition.version}</h3>
      <p className="mono">{deleting.digest}</p><Warning>{it.removeSystemHelp}</Warning>
      <div className="modal-actions"><button className="button secondary" disabled={loading} onClick={() => setDeleting(null)}>{it.cancel}</button>
        <button className="button danger" disabled={loading} onClick={() => void run(() => load(async () => {
          try {
            await deleteSystem(deleting.key);
            if (useUi.getState().systemKey === deleting.key) selectSystem(systems.find(s => s.key !== deleting.key)?.key ?? '');
          } finally { setDeleting(null); }
        }), it.systemRemoved)}>{it.removeSystem}</button></div>
    </Modal>}
    {showUrl && <Modal title={it.importUrl} onClose={() => { if (!busy.current) { setShowUrl(false); setRepository(null); } }}>
      {repository ? <form onSubmit={e => { e.preventDefault(); void run(fromRepository); }}>
        <p className="muted">{it.repositoryResolved}</p>
        <p className="repository-address"><strong>{repository.snapshot.repository}</strong><br /><code>{repository.snapshot.commit}</code></p>
        <p className="muted">{repository.systems.length ? it.repositoryBundleHelp : it.repositoryHelp}</p>
        <label className="field"><span>{repository.systems.length ? it.repositorySystem : it.repositoryFile}</span><select value={repositoryPath} disabled={loading} onChange={e => {
          setRepositoryPath(e.target.value); setRepositoryUpload(null); setRepositoryLocalKey('');
        }}>
          {repository.systems.length ? repository.systems.map(system => <option key={system.id} value={system.id}>{system.name} · v{system.version}</option>)
            : repository.snapshot.files.map(file => <option key={file.path} value={file.path}>{file.path} · {file.size} B</option>)}
        </select></label>
        {sourceSystem && <>
          <p className="muted">{it.repositoryLocalHelp}</p>
          {matchingSystems.length > 0 && <label className="field"><span>{it.repositoryLocalSystem}</span>
            <select disabled={loading} value={repositoryUpload ? '' : localSystem?.key ?? ''} onChange={e => {
              setRepositoryUpload(null); setRepositoryLocalKey(e.target.value);
            }}>
              {repositoryUpload && <option value="">{repositoryUpload.source}</option>}
              {matchingSystems.map(s => <option key={s.key} value={s.key}>{s.definition.name} · v{s.definition.version} · {s.digest.slice(0, 12)}</option>)}
            </select>
          </label>}
          {repositoryUpload && <p>{it.repositoryLocalSystem}: {repositoryUpload.source} · {repositoryUpload.digest.slice(0, 12)}</p>}
          <input ref={repositoryFile} type="file" accept=".json,.rpg,application/json,application/gzip" className="sr-only"
            aria-label={it.repositoryCompiledFile} disabled={loading} onChange={e => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (f) void run(() => load(async () => {
                if (!/\.(json|rpg)$/i.test(f.name)) throw new Error(it.invalidFile);
                if (f.size > MAX_SYSTEM_BYTES) throw new Error('File troppo grande: massimo 8 MB.');
                const prepared = await prepareImport(new Uint8Array(await f.arrayBuffer()), f.name);
                if (prepared.definition.id !== sourceSystem.id || prepared.definition.version !== sourceSystem.version
                  || prepared.diagnostics.some(d => d.severity === 'error')) throw new Error(it.repositoryLocalMismatch);
                setRepositoryUpload(prepared);
              }));
            }} />
          <div className="button-row"><button className="button secondary" type="button" disabled={loading}
            onClick={() => repositoryFile.current?.click()}>{it.repositoryChooseSystem}</button>
            {systemDownload && <a className="link-button" href={systemDownload} target="_blank" rel="noopener noreferrer">{it.repositoryDownloadSystem}</a>}
          </div>
        </>}
        {loading && <p role="status">{catalogProgress || it.loading}</p>}
        <div className="modal-actions"><button className="button secondary" type="button" disabled={loading} onClick={() => setRepository(null)}>{it.repositoryChange}</button>
          <button className="button primary" disabled={loading || Boolean(sourceSystem && !localSystem)}>{loading ? it.loading : repository.systems.length ? it.repositoryLoadBundle : it.repositoryLoad}</button></div>
      </form> : <form onSubmit={e => { e.preventDefault(); void run(fromUrl); }}>
        <label className="field"><span>{it.url}</span><input type="text" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} disabled={loading} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repository.git" required /></label>
        <label className="field"><span>{it.repositoryRef}</span><input value={repositoryRef} maxLength={200} disabled={loading} onChange={e => setRepositoryRef(e.target.value)} placeholder={it.repositoryDefault} /></label>
        <p className="muted">{it.corsHelp}</p>
        <button className="button primary" disabled={loading}>{loading ? it.loading : it.fetch}</button>
      </form>}
    </Modal>}
    {preview && <Modal title={it.importPreview} onClose={() => { if (!busy.current) { setPreview(null); setCatalogs([]); } }}>
      <h3>{preview.definition.name} <small className="muted">v{preview.definition.version}</small></h3>
      <p>{preview.definition.character_stats.length} {it.stats} · {preview.definition.character_sheet_sections.length} {it.sections} · {preview.definition.resources.length} {it.resourceTypes}</p>
      <CompatibilityBadge system={preview} />
      {preview.definition.min_app_version && <p className="muted">min_app_version: {preview.definition.min_app_version}. {it.importedVersionNotice}</p>}
      {systems.some(s => s.definition.id === preview.definition.id) && <p className="muted">{it.versionHelp}</p>}
      {preview.diagnostics.some(d => d.message === it.sortOrderDefault) && <Warning>{it.sortOrderDefault}</Warning>}
      {preview.diagnostics.length > 0 && <Warning>{it.rulesWarning}<br />{preview.diagnostics.length} {it.issues}</Warning>}
      <div className="diagnostic-preview">{preview.diagnostics.slice(0, 12).map((d, i) => <p key={i} className={d.severity === 'error' ? 'error-text' : ''}><code>{d.path}</code><br />{d.message}</p>)}</div>
      <p className="muted"><strong>{it.provenance}:</strong> {preview.source}</p>
      {catalogs.length > 0 && <>
        <Warning>{it.catalogWarning}</Warning>
        <p>{it.repositoryCatalogs}: {catalogs.length} · {it.repositoryCatalogIssues}: {catalogs.filter(c => c.resources[0].catalogIssue).length}</p>
        <details><summary>{it.repositoryCatalogs}</summary><ul>{catalogs.map(c => <li key={c.rootId}>
          {c.resources[0].name} · {c.resources[0].definitionId}
          {c.resources[0].catalogIssue && <p className="error-text">{it.catalogUnavailable}: {c.resources[0].catalogIssue}</p>}
          <p className="muted">{c.resources[0].catalogSource?.source}</p>
        </li>)}</ul></details>
      </>}
      <div className="modal-actions"><button className="button secondary" disabled={loading} onClick={() => { setPreview(null); setCatalogs([]); }}>{it.cancel}</button>
        <button className="button primary" disabled={loading || preview.diagnostics.some(d => d.severity === 'error')} onClick={() => void run(() => load(async () => {
          if (catalogs.length) await installRepositoryBundle(preview, catalogs);
          else await installSystem(preview);
          selectSystem(preview.key); setPreview(null); setCatalogs([]);
        }), it.imported)}>{loading ? it.loading : it.confirmImport}</button></div>
    </Modal>}
  </>;
}
