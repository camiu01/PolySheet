/** @file Browser-selected folders of compiled exports; unsupported files are never read. */
import type { StoredSystem } from '../domain/model';
import { prepareCatalogTemplate, type CatalogPreview } from './catalog';
import { MAX_TREE_ENTRIES } from './github';
import { prepareImport } from './package';
import { bundleCatalogFiles } from './repository';
import { decodeUtf8, MAX_SYSTEM_BYTES } from './system';
import { it } from '../ui/it';

export interface FolderEntry { path: string; size: number }
/** Lazy byte reader; discovery must stay metadata-only for large folders. */
export interface FolderFile extends FolderEntry { bytes: () => Promise<Uint8Array> }
export interface LocalFolderDiscovery { name: string; files: FolderEntry[]; systems: FolderEntry[]; catalogs: FolderEntry[] }
export interface LocalFolderBundle { system: StoredSystem; catalogs: CatalogPreview[] }

const systemName = /^(?:.*[._-])?system(?:\.rpg)?(?:\.json)?$/i;
const catalogDirectory = /(?:^|\/)(?:catalogs|resource_instances)\//i;
const catalogManifest = /^(?:manifest|index)\.json$/i;

function safePath(path: string) {
  return path.length > 0 && path.length <= 1024 && !/[\\\u0000-\u001f\u007f]/.test(path)
    && path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}

/**
 * List supported system and catalog files from folder metadata only.
 * @param input - Directory-picker files with slash-separated relative paths.
 * @throws On unsafe or duplicate paths, unsupported folder sizes or no system file.
 * @remarks Directory pickers expose File objects, not arbitrary filesystem paths;
 * a `C:\...` string can never be read by the page.
 */
export function scanLocalFolder(input: readonly FolderEntry[]): LocalFolderDiscovery {
  if (!input.length) throw new Error(it.folderNoSystem);
  if (input.length > MAX_TREE_ENTRIES) throw new Error(it.folderLimit);
  const paths = new Set<string>(), supported: FolderEntry[] = [];
  for (const entry of input) {
    if (!safePath(entry.path) || paths.has(entry.path) || !Number.isSafeInteger(entry.size) || entry.size < 0)
      throw new Error(it.folderInvalid);
    paths.add(entry.path);
    if (/\.(?:json|rpg)$/i.test(entry.path)) supported.push({ path: entry.path, size: entry.size });
  }
  const basename = (path: string) => path.split('/').at(-1)!;
  const systems = supported.filter(f => systemName.test(basename(f.path)));
  const catalogs = supported.filter(f => catalogDirectory.test(f.path) && !catalogManifest.test(basename(f.path)));
  return { name: input[0].path.split('/')[0] || it.localFolder, files: supported, systems, catalogs };
}

/** Require at least one system file before preparing a full bundle. */
export function discoverLocalFolder(input: readonly FolderEntry[]): LocalFolderDiscovery {
  const found = scanLocalFolder(input);
  if (!found.systems.length) throw new Error(it.folderNoSystem);
  if (found.systems.length > 100) throw new Error(it.folderTooMany);
  return found;
}

/**
 * Accept an add-on folder that only carries catalogs for an already installed system.
 * @throws When the folder contains no catalog JSON at all.
 */
export function discoverLocalCatalogFolder(input: readonly FolderEntry[]): LocalFolderDiscovery {
  const found = scanLocalFolder(input);
  if (!found.catalogs.length) throw new Error(it.folderNoSystem);
  return found;
}

/** Directory owning a system's catalogs: `systems/<id>/` when present, else the system's folder. */
export function catalogDirectoryOf(path: string) {
  const parts = path.split('/'), index = parts.indexOf('systems');
  if (index >= 0 && parts.length > index + 2) return parts.slice(0, index + 2).join('/') + '/';
  return path.slice(0, path.lastIndexOf('/') + 1);
}

/** Catalogs that belong to one selected system, excluding other systems in the same folder. */
export function folderCatalogs(found: LocalFolderDiscovery, path: string) {
  if (!found.systems.some(system => system.path === path)) throw new Error(it.folderInvalid);
  const base = catalogDirectoryOf(path);
  return found.catalogs.filter(file => file.path.startsWith(base));
}

async function readBytes(file: FolderFile | undefined, limit: number, missing: string) {
  if (!file || file.size > limit) throw new Error(missing);
  const bytes = await file.bytes();
  if (bytes.length !== file.size) throw new Error(it.folderChanged);
  return bytes;
}

/** Prepare one selected system file without writing; exact bytes feed the normal validation. */
export async function prepareLocalSystem(input: readonly FolderFile[], path: string): Promise<StoredSystem> {
  const entry = input.find(file => file.path === path);
  if (!entry || !systemName.test(path.split('/').at(-1)!)) throw new Error(it.folderInvalid);
  const bytes = await readBytes(entry, MAX_SYSTEM_BYTES, it.folderFileTooLarge);
  return prepareImport(bytes, path);
}

/**
 * Prepare the selected system and its reviewed catalogs before any write.
 * @remarks Catalog JSON is bounded by the same count and byte budgets as repository
 * bundles. A malformed catalog aborts with its path instead of being hidden.
 */
async function prepareCatalogs(input: readonly FolderFile[], entries: readonly FolderEntry[], system: StoredSystem,
  progress: (done: number, total: number) => void) {
  const files = bundleCatalogFiles([...entries]);
  const catalogs: CatalogPreview[] = [];
  let done = 0;
  progress(0, files.length);
  for (let i = 0; i < files.length; i += 4) {
    const batch = await Promise.all(files.slice(i, i + 4).map(async entry => {
      const file = input.find(candidate => candidate.path === entry.path);
      const bytes = await readBytes(file, MAX_SYSTEM_BYTES, `${it.folderFileTooLarge}: ${entry.path}`);
      try { return await prepareCatalogTemplate(decodeUtf8(bytes), entry.path, system); }
      catch (error) { throw new Error(`${entry.path}: ${error instanceof Error ? error.message : String(error)}`); }
    }));
    catalogs.push(...batch);
    done += batch.length;
    progress(done, files.length);
  }
  return catalogs;
}

export async function prepareLocalBundle(input: readonly FolderFile[], path: string,
  progress: (done: number, total: number) => void = () => {}): Promise<LocalFolderBundle> {
  const found = discoverLocalFolder(input);
  const system = await prepareLocalSystem(input, path);
  return { system, catalogs: await prepareCatalogs(input, folderCatalogs(found, path), system, progress) };
}

/**
 * Prepare an add-on catalog folder for an installed system without changing that system.
 * @remarks Used by the Hope & Fear add-on layout, which has no system file of its own.
 */
export async function prepareLocalCatalogFolder(input: readonly FolderFile[], system: StoredSystem,
  progress: (done: number, total: number) => void = () => {}): Promise<CatalogPreview[]> {
  const found = discoverLocalCatalogFolder(input);
  return prepareCatalogs(input, found.catalogs, system, progress);
}
