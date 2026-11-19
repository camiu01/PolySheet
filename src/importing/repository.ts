/** @file Commit-pinned source discovery, local source preparation and automatic catalogs. */
import { object, type StoredSystem } from '../domain/model';
import { discoverGithub, githubRepository, importGithubFile, type GithubSnapshot } from './github';
import { boundedJson, decodeUtf8 } from './system';
import { downloadBytes } from './url';
import { prepareCatalogTemplate, MAX_REPOSITORY_CATALOG_BYTES, MAX_REPOSITORY_CATALOG_FILES, type CatalogPreview } from './catalog';
import { it } from '../ui/it';
import { prepareSourceRepository } from './source-repository';

export interface RepositorySystem { id: string; name: string; version: string; path: string; original?: string }
export interface RepositoryDiscovery { snapshot: GithubSnapshot; systems: RepositorySystem[] }
export interface RepositoryBundle { system: StoredSystem; catalogs: CatalogPreview[] }

function rawBase(snapshot: GithubSnapshot) {
  const repository = githubRepository(snapshot.repository);
  if (!repository || !/^[a-f0-9]{40}$/i.test(snapshot.commit)) throw new Error(it.repositoryInvalid);
  return 'https://raw.githubusercontent.com/' + repository.slice('https://github.com/'.length) + '/' + snapshot.commit + '/';
}
/**
 * Discover conventional source systems and retain their exact root JSON for preparation.
 * @remarks Repositories without the source/catalog layout keep normal file selection.
 * Read metadata only here; source compilation happens after explicit system selection.
 */
export async function discoverRepository(input: string, ref = ''): Promise<RepositoryDiscovery> {
  const snapshot = await discoverGithub(input, ref);
  const files = snapshot.files.filter(f => /^systems\/[a-z0-9_-]+\/system\/system\.rpg\.json$/i.test(f.path)
    && snapshot.catalogFiles?.some(c => c.path.startsWith(f.path.slice(0, f.path.indexOf('/system/')) + '/resource_instances/')));
  const systems: RepositorySystem[] = [];
  for (let i = 0; i < files.length; i += 4) {
    const batch = await Promise.all(files.slice(i, i + 4).map(async file => {
      const bytes = await downloadBytes(new URL(rawBase(snapshot) + file.path.split('/').map(encodeURIComponent).join('/')));
      if (bytes.length !== file.size) throw new Error(it.repositoryChanged);
      const input = object(boundedJson(decodeUtf8(bytes))), id = file.path.split('/')[1];
      if (input.id !== id || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 500
        || typeof input.version !== 'string' || !input.version.length || input.version.length > 100)
        throw new Error(it.repositoryInvalid);
      return { id, name: input.name, version: input.version, path: file.path, original: decodeUtf8(bytes) };
    }));
    systems.push(...batch);
  }
  return { snapshot, systems };
}
/** The known publisher's compiled `.rpg` for one system id, offered only as a user-initiated download. */
export function officialSystemDownload(id: string) {
  return `https://d2dmd8x0lyn9l8.cloudfront.net/${encodeURIComponent(id)}/system.rpg`;
}
/** Offer a normal user-initiated download for the known publisher; no cross-origin fetch. */
export function repositorySystemDownload(discovery: RepositoryDiscovery, selected: string) {
  if (discovery.snapshot.repository.toLowerCase() !== 'https://github.com/blastervla/rpg-companion-app-systems'
    || !discovery.systems.some(s => s.id === selected)) return undefined;
  return officialSystemDownload(selected);
}
/**
 * Prepare the selected repository's sources, or reuse an explicitly matching local system.
 * @remarks Source ID/version must match. No local record changes until confirmation;
 * network failures abort the entire preview rather than hiding missing files.
 */
export async function prepareRepositoryBundle(discovery: RepositoryDiscovery, selected: string, localSystem?: StoredSystem,
  progress: (done: number, total: number) => void = () => {}): Promise<RepositoryBundle> {
  const { snapshot } = discovery;
  if (!discovery.systems.length) return { system: await importGithubFile(snapshot, selected), catalogs: [] };
  const source = discovery.systems.find(s => s.id === selected);
  if (!source) throw new Error(it.repositoryInvalid);
  localSystem ??= await prepareSourceRepository(snapshot, source);
  if (localSystem.definition.id !== source.id || localSystem.definition.version !== source.version
    || localSystem.diagnostics.some(d => d.severity === 'error')) throw new Error(it.repositoryLocalMismatch);
  const base = rawBase(snapshot);
  const files = (snapshot.catalogFiles ?? []).filter(f => f.path.startsWith(`systems/${source.id}/resource_instances/`));
  if (files.length > MAX_REPOSITORY_CATALOG_FILES || files.reduce((n, f) => n + f.size, 0) > MAX_REPOSITORY_CATALOG_BYTES)
    throw new Error(it.repositoryCatalogLimit);
  const catalogs: CatalogPreview[] = [];
  let done = 0;
  progress(0, files.length);
  for (let i = 0; i < files.length; i += 4) {
    const batch = await Promise.all(files.slice(i, i + 4).map(async file => {
      const url = new URL(base + file.path.split('/').map(encodeURIComponent).join('/'));
      const bytes = await downloadBytes(url);
      if (bytes.length !== file.size) throw new Error(it.repositoryChanged);
      const preview = await prepareCatalogTemplate(decodeUtf8(bytes), url.href, localSystem);
      progress(++done, files.length);
      return preview;
    }));
    catalogs.push(...batch);
  }
  return { system: localSystem, catalogs };
}
