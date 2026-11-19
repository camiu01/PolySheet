/** @file Metadata-only 5e/PF2e catalog discovery; download one explicitly chosen, commit-pinned original. */
import type { StoredSystem } from '../domain/model';
import { listGithubFiles, type GithubSnapshot } from './github';
import { prepareCatalogTemplate } from './catalog';
import { decodeUtf8, MAX_SYSTEM_BYTES } from './system';
import { downloadBytes } from './url';
import { it } from '../ui/it';

const repository = 'https://github.com/blastervla/rpg-companion-app-systems';
export const DND_CATALOG_KINDS = ['monster', 'spell', 'weapon', 'armor', 'item'] as const;
export type DndCatalogKind = typeof DND_CATALOG_KINDS[number];
export const DND_CATALOG_SYSTEMS = ['5e', 'pf2e'] as const;
export type DndCatalogSystem = typeof DND_CATALOG_SYSTEMS[number];
const catalogPath = /^systems\/(5e|pf2e)\/resource_instances\/(monster|spell|weapon|armor|item)_[^/\\\u0000-\u001f\u007f]+(?:\.rpg)?\.json$/i;

/** Systems whose public tree shares the flat `resource_instances` layout and resource IDs. */
export function isDndCatalogSystem(id: string): id is DndCatalogSystem {
  return DND_CATALOG_SYSTEMS.some(system => system === id);
}

/** Classify only regular catalog paths in the selected system's source directory. */
export function dndCatalogKind(path: string, system: DndCatalogSystem) {
  const match = catalogPath.exec(path);
  if (match?.[1] !== system) return undefined;
  const kind = match[2].toLowerCase();
  return DND_CATALOG_KINDS.find(candidate => candidate === kind);
}

/** Read only public file metadata; the complete bestiary exceeds the normal batch budget. */
export async function discoverDndCatalogs(system: DndCatalogSystem) {
  const snapshot = await listGithubFiles(repository);
  return { ...snapshot, files: snapshot.files.filter(file => dndCatalogKind(file.path, system)) };
}

/** Recheck the selected metadata and preserve exact bytes; never import the entire bestiary implicitly. */
export async function prepareDndCatalog(snapshot: GithubSnapshot, path: string, system: StoredSystem) {
  const file = snapshot.files.find(file => file.path === path);
  const id = system.definition.id;
  const kind = isDndCatalogSystem(id) ? dndCatalogKind(path, id) : undefined;
  if (!kind || !system.definition.resources.some(r => r.id === kind)
    || snapshot.repository !== repository || !/^[a-f0-9]{40}$/i.test(snapshot.commit)
    || !file) throw new Error(it.catalogFormat);
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_SYSTEM_BYTES) throw new Error(it.repositoryFileTooLarge);
  const url = new URL(`https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/${snapshot.commit}/${path.split('/').map(encodeURIComponent).join('/')}`);
  const bytes = await downloadBytes(url);
  if (bytes.length !== file.size) throw new Error(it.repositoryChanged);
  const preview = await prepareCatalogTemplate(decodeUtf8(bytes), url.href, system);
  if (preview.resources[0].definitionId !== kind) throw new Error(it.catalogFormat);
  return preview;
}
