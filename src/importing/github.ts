/** @file Public GitHub discovery, immutable commit selection; never clone or execute. */
import { object } from '../domain/model';
import { prepareImport } from './package';
import { boundedJson, decodeUtf8, MAX_SYSTEM_BYTES } from './system';
import { downloadBytes } from './url';
import { it } from '../ui/it';

export interface GithubSnapshot {
  repository: string;
  commit: string;
  files: { path: string; size: number }[];
  catalogFiles?: { path: string; size: number }[];
}
const shaPattern = /^[a-f0-9]{40}$/i;
const systemName = /^(system\.rpg|system\.rpg\.json|system\.json)$/i;
/**
 * Upper bound on recursive tree entries, sized so a complete tree still fits
 * the 8 MiB streamed response ceiling (~20,000 GitHub entries of metadata).
 * @remarks GitHub truncates larger trees itself; that case is rejected rather
 * than scanned partially, so this is a payload bound, not a completeness test.
 */
export const MAX_TREE_ENTRIES = 20000;

/** Normalize public GitHub root HTTPS/clone links; other hosts are never Git clients. */
export function githubRepository(input: string): string | null {
  let value = input.trim();
  const scp = /^git@github\.com:([^?#]+)$/i.exec(value);
  if (scp) value = `https://github.com/${scp[1]}`;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!['https:', 'ssh:', 'git:'].includes(url.protocol) || !['github.com', 'www.github.com'].includes(url.hostname)) return null;
  if (url.port || url.password || (url.username && !(url.protocol === 'ssh:' && url.username === 'git'))) throw new Error(it.invalidUrl);
  const parts = url.pathname.replace(/\/+$/, '').split('/').slice(1);
  if (parts.length !== 2) throw new Error(it.githubPage);
  const [owner, name] = parts;
  const repo = name.replace(/\.git$/i, '');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38})$/i.test(owner) || !/^[a-z0-9_.-]{1,100}$/i.test(repo) || ['.', '..'].includes(repo))
    throw new Error(it.invalidUrl);
  return `https://github.com/${owner}/${repo}`;
}

function safePath(path: unknown): path is string {
  return typeof path === 'string' && path.length <= 1024 && !/[\\\u0000-\u001f\u007f]/.test(path) &&
    path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}
async function apiJson(url: URL) {
  return boundedJson(decodeUtf8(await downloadBytes(url, true)));
}

/**
 * Resolve a branch/default branch and list all regular files at one immutable commit.
 * @remarks Two bounded public API reads; no token, submodule traversal or partial trees.
 * A filename is a candidate, never proof of a valid monolithic system.
 */
export async function listGithubFiles(input: string, ref = ''): Promise<GithubSnapshot> {
  const repository = githubRepository(input);
  if (!repository) throw new Error(it.repositoryUnsupported);
  if (ref.length > 200 || /[\u0000-\u001f\u007f]/.test(ref)) throw new Error(it.repositoryInvalid);
  const api = 'https://api.github.com/repos/' + repository.slice('https://github.com/'.length);
  const commitsUrl = new URL(api + '/commits');
  commitsUrl.searchParams.set('per_page', '1');
  if (ref.trim()) commitsUrl.searchParams.set('sha', ref.trim());
  const commits = await apiJson(commitsUrl);
  if (!Array.isArray(commits) || commits.length !== 1) throw new Error(it.repositoryEmpty);
  const first = object(commits[0]), commit = first.sha;
  const treeSha = object(object(first.commit).tree).sha;
  if (typeof commit !== 'string' || !shaPattern.test(commit) || typeof treeSha !== 'string' || !shaPattern.test(treeSha))
    throw new Error(it.repositoryInvalid);
  const tree = object(await apiJson(new URL(`${api}/git/trees/${treeSha}?recursive=1`)));
  if (tree.truncated === true) throw new Error(it.repositoryTruncated);
  if (tree.truncated !== false || tree.sha !== treeSha || !Array.isArray(tree.tree) || tree.tree.length > MAX_TREE_ENTRIES)
    throw new Error(it.repositoryInvalid);
  const files: GithubSnapshot['files'] = [];
  const paths = new Set<string>();
  for (const input of tree.tree) {
    const entry = object(input);
    if (entry.type !== 'blob' || !['100644', '100755'].includes(String(entry.mode))) continue;
    if (!safePath(entry.path)) throw new Error(it.repositoryInvalid);
    if (paths.has(entry.path) || typeof entry.size !== 'number' || !Number.isSafeInteger(entry.size) || entry.size < 0)
      throw new Error(it.repositoryInvalid);
    paths.add(entry.path);
    files.push({ path: entry.path, size: entry.size });
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { repository, commit: commit.toLowerCase(), files };
}

/** Discover conventional systems and source catalogs without requiring a repository clone. */
export async function discoverGithub(input: string, ref = ''): Promise<GithubSnapshot> {
  const snapshot = await listGithubFiles(input, ref);
  const files = snapshot.files.filter(f => systemName.test(f.path.split('/').at(-1)!));
  const catalogFiles = snapshot.files.filter(f => /^systems\/[a-z0-9_-]+\/resource_instances\/(?:class|race|species|ancestry|heritage|background)_[^/]+\.rpg\.json$/i.test(f.path));
  if ([...files, ...catalogFiles].some(f => f.size > MAX_SYSTEM_BYTES)) throw new Error(it.repositoryFileTooLarge);
  if (files.length > 100) throw new Error(it.repositoryTooMany);
  if (!files.length) throw new Error(it.repositoryNoSystems);
  return { ...snapshot, files, ...(catalogFiles.length ? { catalogFiles } : {}) };
}

/** Download only the selected file at the discovered commit, then apply normal validation. */
export async function importGithubFile(snapshot: GithubSnapshot, path: string) {
  const repository = githubRepository(snapshot.repository);
  const file = snapshot.files.find(file => file.path === path);
  if (!repository || !shaPattern.test(snapshot.commit) || !safePath(path) || !systemName.test(path.split('/').at(-1)!) || !file)
    throw new Error(it.repositoryInvalid);
  const url = new URL('https://raw.githubusercontent.com/' + repository.slice('https://github.com/'.length) +
    '/' + snapshot.commit + '/' + path.split('/').map(encodeURIComponent).join('/'));
  const bytes = await downloadBytes(url);
  if (bytes.length !== file.size) throw new Error(it.repositoryChanged);
  return prepareImport(bytes, url.href);
}
