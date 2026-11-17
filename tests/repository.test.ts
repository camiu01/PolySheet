// @vitest-environment node
/** @file Source discovery and automatic catalogs with an explicitly chosen local system. */
import { afterEach, expect, it, vi } from 'vitest';
import { discoverRepository, prepareRepositoryBundle, repositorySystemDownload } from '../src/importing/repository';
import { MAX_REPOSITORY_CATALOG_BYTES } from '../src/importing/catalog';
import { prepareSystem } from '../src/importing/system';
import { catalogSystem, classOriginal, raceOriginal } from './fixtures/catalog';
import { SheetDatabase } from '../src/persistence/db';
import { installRepositoryBundle } from '../src/persistence/catalog';

const repository = 'https://github.com/blastervla/rpg-companion-app-systems';
const commit = '1'.repeat(40), treeSha = '2'.repeat(40), ids = ['5e', '5e2024', 'pf2e'];
const originals = new Map<string, string>();
for (const id of ids) {
  originals.set(`systems/${id}/system/system.rpg.json`, JSON.stringify({ id, name: id === '5e2024' ? '5.5e' : id, version: '1.0.0' }));
  originals.set(`systems/${id}/resource_instances/class_original.rpg.json`, classOriginal.replace('catalog-original', id));
  originals.set(`systems/${id}/resource_instances/race_original.rpg.json`, raceOriginal);
}
const entries = () => [...originals].map(([path, text]) => ({ path, size: Buffer.byteLength(text), type: 'blob', mode: '100644' }));
const localSystem = (id: string, version = '1.0.0') => prepareSystem(JSON.stringify({ ...catalogSystem, id, version }), 'Local compiled original');
function fixture(options: { entries?: unknown[]; fail?: string } = {}) {
  const fetch = vi.fn(async (url: URL) => {
    if (url.hostname === 'api.github.com') return Response.json(url.pathname.endsWith('/commits')
      ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
      : { sha: treeSha, truncated: false, tree: options.entries ?? entries() });
    if (url.hostname === 'raw.githubusercontent.com') {
      expect(url.pathname).toContain('/' + commit + '/');
      if (options.fail && url.pathname.endsWith(options.fail)) return new Response('', { status: 404 });
      const text = originals.get(decodeURIComponent(url.pathname.split('/' + commit + '/')[1]));
      return text === undefined ? new Response('', { status: 404 }) : new Response(text);
    }
    throw new Error('Unexpected host: no CDN or proxy allowed: ' + url.hostname);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('discovers 5e, 5.5e and PF2e from pinned metadata without requesting the CORS-blocked CDN', async () => {
  const fetch = fixture(), found = await discoverRepository(repository + '.git');
  expect(found.systems.map(r => r.name)).toEqual(['5e', '5.5e', 'pf2e']);
  expect(found.snapshot.catalogFiles).toHaveLength(6);
  expect(fetch).toHaveBeenCalledTimes(5);
  expect(fetch.mock.calls.filter(([url]) => url.hostname === 'raw.githubusercontent.com')).toHaveLength(3);
  expect(fetch.mock.calls.every(([url]) => !url.pathname.includes('resource_instances'))).toBe(true);
  expect(repositorySystemDownload(found, '5e2024')).toBe('https://d2dmd8x0lyn9l8.cloudfront.net/5e2024/system.rpg');
  expect(repositorySystemDownload(found, '../other')).toBeUndefined();
});
it.each(ids)('prepares all %s catalogs using the user-selected system, before atomic confirmation', async id => {
  const fetch = fixture(), found = await discoverRepository(repository), system = await localSystem(id);
  const progress: number[] = [];
  const bundle = await prepareRepositoryBundle(found, id, system, done => progress.push(done));
  expect(bundle.system).toBe(system);
  expect(bundle.catalogs).toHaveLength(2);
  expect(bundle.catalogs.every(p => p.resources.length === 1 && !p.resources[0].catalogIssue)).toBe(true);
  expect(bundle.catalogs[0].resources[0].catalogSource?.original).toBe(originals.get(`systems/${id}/resource_instances/class_original.rpg.json`));
  expect(bundle.catalogs[0].resources[0].catalogSource?.source).toContain(`/${commit}/systems/${id}/`);
  expect(progress).toEqual([0, 1, 2]);
  const downloaded = fetch.mock.calls.filter(([url]) => url.pathname.includes('resource_instances'));
  expect(downloaded).toHaveLength(2);
  expect(downloaded.every(([url]) => url.pathname.includes('/systems/' + id + '/'))).toBe(true);
  const database = new SheetDatabase('repository-' + crypto.randomUUID());
  try {
    expect(await database.systems.count()).toBe(0); expect(await database.resources.count()).toBe(0);
    await installRepositoryBundle(bundle.system, bundle.catalogs, database);
    expect(await database.systems.count()).toBe(1); expect(await database.resources.count()).toBe(2);
    await installRepositoryBundle(bundle.system, bundle.catalogs, database);
    expect(await database.resources.count()).toBe(2);
  } finally { await database.delete(); }
});
it('supports another repository with the same source/catalog layout without guessing a download host', async () => {
  const fetch = fixture(), found = await discoverRepository('https://github.com/other/repo');
  expect(found.systems).toHaveLength(3); expect(repositorySystemDownload(found, '5e')).toBeUndefined();
  expect(fetch.mock.calls.every(([url]) => ['api.github.com', 'raw.githubusercontent.com'].includes(url.hostname))).toBe(true);
});
it('keeps ordinary monolithic repositories on file selection without requesting unrelated metadata', async () => {
  const fetch = fixture({ entries: [{ path: '5e/system.rpg', size: 50, type: 'blob', mode: '100644' }] });
  const found = await discoverRepository('https://github.com/other/repo');
  expect(found.systems).toEqual([]); expect(fetch).toHaveBeenCalledTimes(2);
});
it('rejects malformed source identity and metadata rather than silently rewriting it', async () => {
  const key = 'systems/5e/system/system.rpg.json', previous = originals.get(key)!;
  try {
    for (const input of [{ id: 'foreign', name: 'Wrong', version: '1' }, { id: '5e', name: '', version: '1' }, { id: '5e', name: 'Name' }]) {
      originals.set(key, JSON.stringify(input)); fixture();
      await expect(discoverRepository(repository)).rejects.toThrow();
    }
  } finally { originals.set(key, previous); }
});
it('validates a supplied local system and never fetches the CDN as a fallback', async () => {
  const fetch = fixture(), found = await discoverRepository(repository); fetch.mockClear();
  await expect(prepareRepositoryBundle(found, '5e', await localSystem('5e2024'))).rejects.toThrow('stesso ID');
  await expect(prepareRepositoryBundle(found, '5e', await localSystem('5e', '2'))).rejects.toThrow('stesso ID');
  expect(fetch).not.toHaveBeenCalled();
});
it('aborts on any missing or size-mismatched catalog rather than presenting incomplete success', async () => {
  fixture({ fail: 'race_original.rpg.json' });
  await expect(prepareRepositoryBundle(await discoverRepository(repository), '5e', await localSystem('5e'))).rejects.toThrow('HTTP 404');
  fixture({ entries: entries().map(e => e.path.endsWith('race_original.rpg.json') ? { ...e, size: e.size + 1 } : e) });
  await expect(prepareRepositoryBundle(await discoverRepository(repository), '5e', await localSystem('5e'))).rejects.toThrow('Dimensione');
});
it('checks count and byte limits at the boundary before downloading catalog files', async () => {
  const metadata = entries().filter(e => !e.path.includes('resource_instances'));
  for (const [count, size, expected] of [
    [4, MAX_REPOSITORY_CATALOG_BYTES / 4 + 1, '24 MiB'],
    [3, MAX_REPOSITORY_CATALOG_BYTES / 3, 'HTTP 404'],
    [1001, 1, '24 MiB'],
    [1000, 1, 'HTTP 404']
  ] as const) {
    const fetch = fixture({ entries: [...metadata, ...Array.from({ length: count }, (_, i) => ({
      path: `systems/5e/resource_instances/class_${i}.rpg.json`, size, mode: '100644', type: 'blob'
    }))] });
    await expect(prepareRepositoryBundle(await discoverRepository(repository), '5e', await localSystem('5e'))).rejects.toThrow(expected);
    if (expected === '24 MiB') expect(fetch.mock.calls.filter(([url]) => url.pathname.includes('resource_instances'))).toHaveLength(0);
  }
});
