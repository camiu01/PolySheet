/** @file Local-first system imports with a review-before-write boundary. */
import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, FileJson, Trash2 } from 'lucide-react';
import type { StoredSystem } from '../domain/model';
import { demoOriginal } from '../demo';
import { MAX_SYSTEM_BYTES, prepareSystem } from '../importing/system';
import { artifactBytes, prepareImport } from '../importing/package';
import { importFromUrl } from '../importing/url';
import { githubRepository } from '../importing/github';
import { discoverRepository, prepareRepositoryBundle, repositorySystemDownload, type RepositoryDiscovery } from '../importing/repository';
import { folderCatalogs as systemFolderCatalogs, scanLocalFolder, prepareLocalBundle, prepareLocalCatalogFolder, type FolderFile, type LocalFolderDiscovery } from '../importing/local-folder';
import type { CatalogPreview } from '../importing/catalog';
import { installRepositoryBundle } from '../persistence/catalog';
import { deleteSystem, installSystem } from '../persistence/db';
import { it } from './it';
import { CompatibilityBadge, Modal, PageHeading, Warning, download, downloadBlob, type Run } from './shared';
import { useUi } from './store';
import { ImportDiagnostics, SystemImportOptions } from './SystemImport';
import { GameChoices, type GameProgress } from './GameChoices';
import './library.css';

/** Guide source selection and review before installing; preserve exact originals and validation limits. */
/** Games whose pinned public source cannot be compiled here; they use the publisher's compiled file. */
const compiledOnly = new Set(['pf2e']);

export function Library({ systems, run }: { systems: StoredSystem[]; run: Run }) {
  const file = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const repositoryFile = useRef<HTMLInputElement>(null);
  const [folderPick, setFolderPick] = useState<{ found: LocalFolderDiscovery; files: FolderFile[] } | null>(null);
  const [folderPath, setFolderPath] = useState('');
  const [catalogFolder, setCatalogFolder] = useState<{ found: LocalFolderDiscovery; files: FolderFile[] } | null>(null);
  const [catalogSystem, setCatalogSystem] = useState('');
  const [folderCatalogPreviews, setFolderCatalogPreviews] = useState<CatalogPreview[] | null>(null);
  const [preview, setPreview] = useState<StoredSystem | null>(null);
  const [deleting, setDeleting] = useState<StoredSystem | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [game, setGame] = useState<GameProgress | null>(null);
  const [gameError, setGameError] = useState<{ id: string; message: string } | null>(null);
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
  const localSystem = repositoryUpload ?? matchingSystems.find(s => s.key === repositoryLocalKey);
  const systemDownload = repository && repositorySystemDownload(repository, repositoryPath);
  const { navigate, selectSystem, systemKey } = useUi();
  async function prepare(original: string, source: string) { setCatalogs([]); setPreview(await prepareSystem(original, source)); }
  async function prepareFolder(files: FolderFile[], path: string) {
    setCatalogProgress(`${it.repositoryCatalogProgress}: 0`);
    try {
      const bundle = await prepareLocalBundle(files, path, (done, total) =>
        setCatalogProgress(`${it.repositoryCatalogProgress}: ${done}/${total}`));
      setCatalogs(bundle.catalogs); setPreview(bundle.system); setFolderPick(null);
    } finally { setCatalogProgress(''); }
  }
  async function fromFolder(picked: File[]) {
    const files: FolderFile[] = picked.map(item => {
      const path = item.webkitRelativePath || item.name;
      return { path, size: item.size, bytes: async () => new Uint8Array(await item.arrayBuffer()) };
    });
    const found = scanLocalFolder(files);
    if (!found.systems.length) {
      if (!found.catalogs.length) throw new Error(it.folderNoSystem);
      if (!systems.length) throw new Error(it.folderCatalogsNeedSystem);
      setCatalogSystem(systems.find(s => s.key === systemKey)?.key ?? systems[0].key);
      setFolderCatalogPreviews(null);
      setCatalogFolder({ found, files });
      return;
    }
    if (found.systems.length === 1) { await prepareFolder(files, found.systems[0].path); return; }
    setFolderPath(found.systems[0].path);
    setFolderPick({ found, files });
  }
  async function prepareCatalogFolder() {
    const target = systems.find(s => s.key === catalogSystem);
    if (!target || !catalogFolder) throw new Error(it.folderCatalogsNeedSystem);
    setCatalogProgress(`${it.repositoryCatalogProgress}: 0`);
    try {
      const prepared = await prepareLocalCatalogFolder(catalogFolder.files, target, (done, total) =>
        setCatalogProgress(`${it.repositoryCatalogProgress}: ${done}/${total}`));
      setFolderCatalogPreviews(prepared);
    } finally { setCatalogProgress(''); }
  }
  async function installCatalogFolder() {
    const target = systems.find(s => s.key === catalogSystem);
    if (!target || !folderCatalogPreviews) throw new Error(it.folderCatalogsNeedSystem);
    await installRepositoryBundle(target, folderCatalogPreviews);
    setCatalogFolder(null); setFolderCatalogPreviews(null);
  }
  async function load(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true); setImportError('');
    try { await action(); }
    catch (error) { setImportError(error instanceof Error ? error.message : String(error)); throw error; }
    finally { busy.current = false; setLoading(false); }
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
    await load(() => prepareBundle(repository, repositoryPath, localSystem));
  }
  async function prepareBundle(discovery: RepositoryDiscovery, selected: string, installed?: StoredSystem) {
    setCatalogProgress(installed ? '' : it.repositorySourceLoading);
    if (!installed) setGame(current => current && { ...current, phase: it.repositorySourceLoading });
    const bundle = await prepareRepositoryBundle(discovery, selected, installed, (done, total) => {
      setCatalogProgress(`${it.repositoryCatalogProgress}: ${done}/${total}`);
      setGame(current => current && { ...current, phase: it.repositoryCatalogProgress, done, total });
    });
    setPreview(bundle.system); setCatalogs(bundle.catalogs); setCatalogProgress('');
    setRepository(null); setShowUrl(false);
  }
  async function fromGame(id: string) {
    await load(async () => {
      setGame({ id, phase: it.gameDiscovering }); setGameError(null); setCatalogProgress(it.gamePreparing);
      try {
        const discovered = await discoverRepository('https://github.com/blastervla/rpg-companion-app-systems',
          '8788e3b18099e4a1b3510f02869d97f1488586b4');
        // The public PF2e source does not compile (weapon/stats.rpgs:928): open the repository step,
        // where the publisher's compiled file is uploaded and the catalogs still come from the commit.
        if (compiledOnly.has(id)) {
          setRepository(discovered); setRepositoryPath(id); setRepositoryUpload(null); setRepositoryLocalKey('');
          setShowUrl(true); return;
        }
        await prepareBundle(discovered, id);
      } catch (error) {
        setGameError({ id, message: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally { setGame(null); setCatalogProgress(''); }
    });
  }
  return <>
    <PageHeading title={it.systems} description={it.systemSubtitle} />
    <input ref={file} type="file" accept=".json,.rpg,application/json,application/gzip" className="sr-only" aria-label={it.localFile} onChange={e => {
      const f = e.target.files?.[0]; e.target.value = '';
      if (f) void run(() => load(async () => {
        if (!/\.(json|rpg)$/i.test(f.name)) throw new Error(it.invalidFile);
        if (f.size > MAX_SYSTEM_BYTES) throw new Error('File troppo grande: massimo 8 MB.');
        setCatalogs([]); setPreview(await prepareImport(new Uint8Array(await f.arrayBuffer()), f.name));
      }));
    }} />
    <input ref={folderInput} type="file" multiple {...{ webkitdirectory: '' }} className="sr-only" aria-label={it.localFolder}
      disabled={loading} onChange={e => {
        const picked = Array.from(e.target.files ?? []); e.target.value = '';
        if (picked.length) void run(() => load(() => fromFolder(picked)));
      }} />
    {systems.length > 0 && <>
    <div className="section-title"><h2>{systems.length ? it.libraryTitle : it.noSystems}</h2><span className="muted">{systems.length} {systems.length === 1 ? it.savedVersion : it.savedVersions}</span></div>
    <div className="system-grid">
      {systems.map(s => <article className="system-card" key={s.key}>
        <div className="system-card-top"><span className="system-emblem">{s.definition.abbreviation.slice(0, 4)}</span><CompatibilityBadge system={s} /></div>
        <h3>{s.definition.name}</h3><span className="muted">v{s.definition.version} <span className="mono">{s.digest.slice(0, 6)}</span></span>
        {s.definition.id === 'polysheet-sentieri' && <p className="badge badge-warning">{it.demoBadge}</p>}
        <div className="system-counts"><span>{s.definition.character_stats.length} {s.definition.character_stats.length === 1 ? it.stat : it.stats}</span><span>{s.definition.character_sheet_sections.length} {s.definition.character_sheet_sections.length === 1 ? it.section : it.sections}</span></div>
        <div className="card-footer"><span className="offline-label"><i />{it.stored}</span><button className="link-button" aria-label={`${it.details} ${s.definition.name}`} onClick={() => { selectSystem(s.key); navigate('diagnostics'); }}>{it.diagnostics}<ArrowRight size={15} aria-hidden="true" /></button></div>
        <button className="button primary system-card-main" onClick={() => { selectSystem(s.key); navigate('characters'); }}>{it.useGame}</button>
        <div className="system-card-actions"><button className="link-button" onClick={() => void run(async () => {
          const name = s.definition.id.replace(/[^\w-]/g, '_');
          if (s.artifact) downloadBlob(new Blob([artifactBytes(s.artifact.base64)], { type: 'application/gzip' }), `${name}.rpg`);
          else download(s.original, `${name}.rpg.json`);
        })}><FileJson size={15} />{s.artifact ? it.exportPackage : s.definition.polysheet_source ? it.repositoryExportSources : it.exportSystem}</button>
        <button className="link-button danger-text" aria-label={`${it.removeSystem} ${s.definition.name} · ${s.digest.slice(0, 6)}`}
          disabled={loading} onClick={() => setDeleting(s)}><Trash2 size={15} />{it.removeSystem}</button></div>
      </article>)}
    </div>
    </>}
    <GameChoices busy={loading} progress={game} error={gameError} onChoose={id => void run(() => fromGame(id))}
      installed={systems.map(s => s.definition.id)}
      onUse={id => { const latest = systems.find(s => s.definition.id === id); if (latest) { selectSystem(latest.key); navigate('characters'); } }} />
    <SystemImportOptions busy={loading} onFile={() => file.current?.click()}
      onFolder={() => { setImportError(''); folderInput.current?.click(); }}
      onLink={() => { setRepository(null); setImportError(''); setShowUrl(true); }}
      onDemo={systems.some(s => s.definition.id === 'polysheet-sentieri') ? undefined
        : () => void run(() => prepare(demoOriginal, 'PolySheet · contenuto originale MIT'))} />
    {loading && catalogProgress && !showUrl && !preview && <p role="status" className="muted">{catalogProgress}</p>}
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
    {showUrl && <Modal title={repository ? it.repositoryChooseTitle : it.importUrl} onClose={() => { if (!busy.current) { setShowUrl(false); setRepository(null); } }}>
      {repository ? <form className="system-import-dialog" onSubmit={e => { e.preventDefault(); void run(fromRepository); }}>
        <div className="system-import-dialog-fields">
        {importError && <p role="alert" className="error-text">{importError}</p>}
        <section className="import-repository-step">
        <h3>{repository.systems.length ? it.repositorySystemStep : it.repositoryFile}</h3>
        <p>{!repository.systems.length ? it.repositoryHelp : sourceSystem && compiledOnly.has(sourceSystem.id) ? it.pathfinderBundleHelp : it.repositoryBundleHelp}</p>
        <label className="field"><span>{repository.systems.length ? it.repositorySystem : it.repositoryFile}</span><select value={repositoryPath} disabled={loading} onChange={e => {
          setRepositoryPath(e.target.value); setRepositoryUpload(null); setRepositoryLocalKey(''); setImportError('');
        }}>
          {repository.systems.length ? repository.systems.map(system => <option key={system.id} value={system.id}>{system.name} · v{system.version}</option>)
            : repository.snapshot.files.map(file => <option key={file.path} value={file.path}>{file.path} · {file.size} B</option>)}
        </select></label>
        </section>
        {sourceSystem && <>
          <section className="import-repository-step">
          <h3>{compiledOnly.has(sourceSystem.id) ? it.pathfinderFileStep : it.repositoryFileStep}</h3>
          <p>{matchingSystems.length ? it.repositoryReuseHelp : compiledOnly.has(sourceSystem.id) ? it.pathfinderLocalHelp : it.repositoryLocalHelp}</p>
          {matchingSystems.length > 0 && <label className="field"><span>{it.repositoryLocalSystem}</span>
            <select disabled={loading} value={repositoryUpload ? '' : localSystem?.key ?? ''} onChange={e => {
              setRepositoryUpload(null); setRepositoryLocalKey(e.target.value);
            }}>
              <option value="">{repositoryUpload ? repositoryUpload.source : it.repositoryUseSources}</option>
              {matchingSystems.map(s => <option key={s.key} value={s.key}>{s.definition.name} · v{s.definition.version} · {s.digest.slice(0, 12)}</option>)}
            </select>
          </label>}
          {repositoryUpload && <p>{it.repositoryCompiledFile}: <strong>{repositoryUpload.source}</strong></p>}
          <details className="import-advanced" open={compiledOnly.has(sourceSystem.id) || undefined}><summary>{compiledOnly.has(sourceSystem.id) ? it.pathfinderSourceAdvanced : it.repositorySourceAdvanced}</summary>
          {compiledOnly.has(sourceSystem.id) && <p className="muted">{it.pathfinderSourceHelp}</p>}
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
          <div className="button-row">
            {systemDownload && <a className="link-button" href={systemDownload} target="_blank" rel="noopener noreferrer">
              {compiledOnly.has(sourceSystem.id) ? it.pathfinderDownload : it.repositoryDownloadSystem}</a>}
            <button className="button secondary" type="button" disabled={loading}
              onClick={() => repositoryFile.current?.click()}>{compiledOnly.has(sourceSystem.id) ? it.pathfinderUpload : it.repositoryChooseSystem}</button>
          </div>
          </details>
          {localSystem && <p className="repository-ready" role="status">{it.repositoryReady}</p>}
          </section>
        </>}
        <details className="import-source-details"><summary>{it.repositoryResolved}</summary>
          <p className="repository-address"><strong>{repository.snapshot.repository}</strong><br /><code>{repository.snapshot.commit}</code></p>
        </details>
        <p className="import-confirm-help">{it.importBeforeConfirm}</p>
        {loading && <p role="status">{catalogProgress || it.loading}</p>}
        </div>
        <div className="modal-actions"><button className="button secondary" type="button" disabled={loading} onClick={() => setRepository(null)}>{it.repositoryChange}</button>
          <button className="button primary" disabled={loading || Boolean(sourceSystem && compiledOnly.has(sourceSystem.id) && !localSystem)}>
            {loading ? it.loading : repository.systems.length ? it.repositoryLoadBundle : it.repositoryLoad}</button></div>
      </form> : <form className="system-import-dialog" onSubmit={e => { e.preventDefault(); void run(fromUrl); }}>
        <div className="system-import-dialog-fields">
        {importError && <p role="alert" className="error-text">{importError}</p>}
        <p className="import-link-intro">{it.importLinkIntro}</p>
        <ul className="import-link-help"><li>{it.importDirectLink}</li><li>{it.importRepositoryLink}</li></ul>
        <label className="field"><span>{it.url}</span><input type="text" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} disabled={loading} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repository.git" required /></label>
        {/^\s*(?:(?:https|ssh|git):\/\/(?:git@)?(?:www\.)?github\.com(?:\/|$)|git@github\.com:)/i.test(url) && <details className="import-advanced">
          <summary>{it.importAdvanced}</summary>
          <label className="field"><span>{it.repositoryRef}</span><input value={repositoryRef} maxLength={200} disabled={loading} onChange={e => setRepositoryRef(e.target.value)} placeholder={it.repositoryDefault} /></label>
          <p className="field-help">{it.importReferenceHelp}</p>
        </details>}
        <p className="field-help">{it.importNetworkHelp}</p>
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" disabled={loading} onClick={() => setShowUrl(false)}>{it.cancel}</button>
          <button className="button primary" disabled={loading}>{loading ? it.loading : it.fetch}</button></div>
      </form>}
    </Modal>}
    {folderPick && <Modal title={it.folderPreviewTitle} onClose={() => { if (!busy.current) setFolderPick(null); }}>
      <form className="system-import-dialog" onSubmit={e => {
        e.preventDefault(); void run(() => load(() => prepareFolder(folderPick.files, folderPath)));
      }}>
        <div className="system-import-dialog-fields">
          {importError && <p role="alert" className="error-text">{importError}</p>}
          <p className="muted">{folderPick.found.name}</p>
          <label className="field"><span>{it.folderSelect}</span>
            <select value={folderPath} disabled={loading} onChange={e => { setFolderPath(e.target.value); setImportError(''); }}>
              {folderPick.found.systems.map(system => <option key={system.path} value={system.path}>{system.path} · {system.size} B</option>)}
            </select></label>
          <p className="muted">{systemFolderCatalogs(folderPick.found, folderPath).length} {it.folderCatalogs}</p>
          {loading && catalogProgress && <p role="status">{catalogProgress}</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={loading} onClick={() => setFolderPick(null)}>{it.cancel}</button>
          <button className="button primary" disabled={loading}>{loading ? it.loading : it.folderLoad}</button>
        </div>
      </form>
    </Modal>}
    {catalogFolder && <Modal title={it.folderCatalogsTitle} onClose={() => { if (!busy.current) { setCatalogFolder(null); setFolderCatalogPreviews(null); } }}>
      <form className="system-import-dialog" onSubmit={e => { e.preventDefault(); void run(() => load(prepareCatalogFolder)); }}>
        <div className="system-import-dialog-fields">
          {importError && <p role="alert" className="error-text">{importError}</p>}
          <p className="muted">{catalogFolder.found.name}</p>
          {!folderCatalogPreviews ? <>
            <p>{it.folderCatalogsHelp}</p>
            <label className="field"><span>{it.folderCatalogsSystem}</span>
              <select value={catalogSystem} disabled={loading} onChange={e => setCatalogSystem(e.target.value)}>
                {systems.map(system => <option key={system.key} value={system.key}>{system.definition.name} · v{system.definition.version} · {system.digest.slice(0, 12)}</option>)}
              </select></label>
            <p className="muted">{catalogFolder.found.catalogs.length} {it.folderCatalogs}</p>
          </> : <>
            <Warning>{it.catalogWarning}</Warning>
            <p>{folderCatalogPreviews.length} {it.catalogInstances}</p>
            <details><summary>{it.repositoryCatalogs}</summary><ul>{folderCatalogPreviews.map(preview => <li key={preview.rootId}>
              {preview.resources[0].name} · {preview.resources[0].definitionId}
              {preview.resources[0].catalogIssue && <p className="error-text">{it.catalogUnavailable}: {preview.resources[0].catalogIssue}</p>}
            </li>)}</ul></details>
          </>}
          {loading && catalogProgress && <p role="status">{catalogProgress}</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={loading} onClick={() => { setCatalogFolder(null); setFolderCatalogPreviews(null); }}>{it.cancel}</button>
          {folderCatalogPreviews ? <button type="button" className="button primary" disabled={loading}
            onClick={() => void run(() => load(installCatalogFolder), it.catalogImported)}>{loading ? it.loading : it.confirmImport}</button>
            : <button className="button primary" disabled={loading}>{loading ? it.loading : it.folderCatalogsLoad}</button>}
        </div>
      </form>
    </Modal>}
    {preview && <Modal title={it.importPreview} onClose={() => { if (!busy.current) { setPreview(null); setCatalogs([]); } }}>
      <div className="system-import-dialog"><div className="system-import-dialog-fields">
      <p className="import-review-help">{it.importReviewHelp}</p>
      <h3>{preview.definition.name} <small className="muted">v{preview.definition.version}</small></h3>
      {preview.definition.id === 'polysheet-sentieri' && <Warning>{it.demoDescription}</Warning>}
      <p>{preview.definition.character_stats.length} {preview.definition.character_stats.length === 1 ? it.stat : it.stats} · {preview.definition.character_sheet_sections.length} {preview.definition.character_sheet_sections.length === 1 ? it.section : it.sections} · {preview.definition.resources.length} {preview.definition.resources.length === 1 ? it.resourceTypeCount : it.resourceTypes}</p>
      <CompatibilityBadge system={preview} />
      {Boolean(preview.definition.polysheet_source) && <p>{it.repositorySourceNotice}</p>}
      {systems.some(s => s.definition.id === preview.definition.id) && <p className="muted">{it.versionHelp}</p>}
      {preview.diagnostics.length > 0 && <Warning>{it.rulesWarning}<br />{preview.diagnostics.length} {it.issues}</Warning>}
      {preview.diagnostics.some(d => d.severity === 'error') && <p className="error-text" role="alert">{it.blockingErrors}</p>}
      <ImportDiagnostics diagnostics={preview.diagnostics} />
      {catalogs.length > 0 && <>
        <Warning>{it.catalogWarning}</Warning>
        <p>{it.repositoryCatalogs}: {catalogs.length} · {it.repositoryCatalogIssues}: {catalogs.filter(c => c.resources[0].catalogIssue).length}</p>
        <details><summary>{it.repositoryCatalogs}</summary><ul>{catalogs.map(c => <li key={c.rootId}>
          {c.resources[0].name} · {c.resources[0].definitionId}
          {c.resources[0].catalogIssue && <p className="error-text">{it.catalogUnavailable}: {c.resources[0].catalogIssue}</p>}
          <p className="muted">{c.resources[0].catalogSource?.source}</p>
        </li>)}</ul></details>
      </>}
      <details className="import-source-details"><summary>{it.importTechnicalDetails}</summary>
        <p><strong>{it.provenance}:</strong> {preview.source}</p>
        {preview.definition.min_app_version && <p>min_app_version: {preview.definition.min_app_version}. {it.importedVersionNotice}</p>}
      </details>
      <p className="import-confirm-help">{it.importConfirmHelp}</p>
      </div>
      <div className="modal-actions"><button className="button secondary" disabled={loading} onClick={() => { setPreview(null); setCatalogs([]); }}>{it.cancel}</button>
        <button className="button primary" disabled={loading || preview.diagnostics.some(d => d.severity === 'error')} onClick={() => void run(() => load(async () => {
          if (catalogs.length) await installRepositoryBundle(preview, catalogs);
          else await installSystem(preview);
          selectSystem(preview.key); setPreview(null); setCatalogs([]);
        }), it.imported)}>{loading ? it.loading : it.confirmImport}</button></div>
      </div>
    </Modal>}
  </>;
}
