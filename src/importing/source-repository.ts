/** @file Bounded source retrieval and local composition; no CDN, proxy, native tool or remote code. */
import { githubRepository, type GithubSnapshot } from './github';
import { downloadBytes } from './url';
import { decodeUtf8, MAX_SYSTEM_BYTES, prepareSystem } from './system';
import { it } from '../ui/it';
import type { RepositorySystem } from './repository';

/** Retrieve system parts and transitive macro dependencies from one complete Git tree. */
export async function prepareSourceRepository(snapshot: GithubSnapshot, system: RepositorySystem) {
  const repository = githubRepository(snapshot.repository);
  if (!repository || !/^[a-f0-9]{40}$/i.test(snapshot.commit)) throw new Error(it.repositoryInvalid);
  const { compileSources, scriptImports } = await import('./rpgscript/compile');
  const candidates = snapshot.sourceFiles ?? snapshot.files;
  const directory = system.path.slice(0, system.path.lastIndexOf('/') + 1);
  const entries = new Map(candidates.map(file => [file.path, file]));
  const pending = new Set(candidates.filter(file => file.path.startsWith(directory)).map(file => file.path));
  const originals = new Map<string, string>();
  const base = 'https://raw.githubusercontent.com/' + repository.slice('https://github.com/'.length) + '/' + snapshot.commit + '/';
  let total = 0;
  if (system.original !== undefined) {
    const bytes = new TextEncoder().encode(system.original).length;
    if (bytes !== entries.get(system.path)?.size) throw new Error(it.repositoryChanged);
    originals.set(system.path, system.original); pending.delete(system.path); total += bytes;
  }
  while (pending.size) {
    if (pending.size + originals.size > 1000
      || total + [...pending].reduce((sum, path) => sum + (entries.get(path)?.size ?? 0), 0) > MAX_SYSTEM_BYTES)
      throw new Error(it.repositorySourceLimit);
    const batch = [...pending].slice(0, 4);
    batch.forEach(path => pending.delete(path));
    const downloaded = await Promise.all(batch.map(async path => {
      const entry = entries.get(path);
      if (!entry || entry.size > MAX_SYSTEM_BYTES) throw new Error(`${it.repositorySourceMissing}: ${path}`);
      const bytes = await downloadBytes(new URL(base + path.split('/').map(encodeURIComponent).join('/')));
      if (bytes.length !== entry.size) throw new Error(it.repositoryChanged);
      return { path, original: decodeUtf8(bytes), size: bytes.length };
    }));
    for (const file of downloaded) { originals.set(file.path, file.original); total += file.size; }
    for (const file of downloaded.filter(f => f.path.endsWith('.rpgs'))) {
      for (const dependency of scriptImports(file.original, file.path)) {
        if (!entries.has(dependency)) throw new Error(`${it.repositorySourceMissing}: ${dependency}`);
        if (!originals.has(dependency)) pending.add(dependency);
      }
    }
  }
  const definition = compileSources(originals, system.path);
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error(it.repositoryInvalid);
  const original = JSON.stringify({ ...definition, polysheet_source: {
    format: 'rpgscript-v1', root: system.path,
    files: [...originals].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, text]) => ({ path, original: text }))
  } });
  const prepared = await prepareSystem(original, base + system.path);
  if (prepared.definition.id !== system.id || prepared.definition.version !== system.version) throw new Error(it.repositoryLocalMismatch);
  return prepared;
}
