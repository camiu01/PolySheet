// @vitest-environment node
/** @file Link import contracts, folder confinement and accepted byte/file boundaries. */
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { StoredSystem } from '../src/domain/model';
import { importCatalogUrl } from '../src/importing/catalog-url';
import { prepareSystem, MAX_SYSTEM_BYTES } from '../src/importing/system';
import { MAX_REPOSITORY_CATALOG_BYTES } from '../src/importing/catalog';
import { catalogSystem, classOriginal, raceOriginal } from './fixtures/catalog';

let system: StoredSystem;
const commit = '1'.repeat(40), treeSha = '2'.repeat(40);
const length = (text: string) => new TextEncoder().encode(text).length;
const entry = (path: string, size = length(classOriginal)) => ({ path, size, type: 'blob', mode: '100644' });
beforeAll(async () => { system = await prepareSystem(JSON.stringify(catalogSystem), 'Original MIT example'); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function github(entries = [entry('catalog/class.json')], originals: Record<string, string> = {}) {
  const fetch = vi.fn(async (url: URL) => {
    if (url.hostname === 'api.github.com') return Response.json(url.pathname.endsWith('/commits')
      ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
      : { sha: treeSha, truncated: false, tree: entries });
    if (url.hostname === 'raw.githubusercontent.com') return new Response(originals[decodeURIComponent(url.pathname.split('/').slice(4).join('/'))] ?? classOriginal);
    throw new Error('Unexpected host');
  });
  vi.stubGlobal('fetch', fetch); return fetch;
}

it('downloads a direct JSON with exact BOM and query-free provenance without cookies', async () => {
  const fetch = vi.fn(async () => new Response(classOriginal)); vi.stubGlobal('fetch', fetch);
  const [preview] = await importCatalogUrl('https://catalog.test/class.json?key=private#section', system);
  expect(preview.resources[0].catalogSource?.original).toBe(classOriginal);
  expect(preview.resources[0].catalogSource?.source).toBe('https://catalog.test/class.json');
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }));
});

it('reads a web folder index once and follows only bounded relative JSON paths, without recursion', async () => {
  const fetch = vi.fn(async (url: URL) => url.pathname.endsWith('index.json')
    ? Response.json({ files: ['class.json', 'nested/race.json'] })
    : new Response(url.pathname.endsWith('race.json') ? raceOriginal : classOriginal));
  vi.stubGlobal('fetch', fetch);
  const previews = await importCatalogUrl('https://catalog.test/books', system);
  expect(previews.map(p => p.resources[0].definitionId)).toEqual(['class', 'race']);
  expect(fetch.mock.calls.map(([u]) => u.href)).toEqual([
    'https://catalog.test/books/index.json', 'https://catalog.test/books/class.json', 'https://catalog.test/books/nested/race.json'
  ]);
});

it('validates every index path before fetching any entry or disclosing a URL to another host', async () => {
  for (const files of [
    ['../class.json'], ['%2e%2e/class.json'], ['nested/../../class.json'], ['/class.json'],
    ['https://evil.test/class.json'], ['//evil.test/class.json'], ['javascript:class.json'],
    ['a\\class.json'], ['a.json?token=x'], ['a.json#fragment'], ['%252e%252e/class.json'],
    ['class.json', 'class.json'], ['class.json', '%63lass.json'], ['%GG.json'], ['index.json/'], [12]
  ]) {
    const fetch = vi.fn(async () => Response.json({ files })); vi.stubGlobal('fetch', fetch);
    await expect(importCatalogUrl('https://catalog.test/books/', system)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  }
  for (const value of [{ files: 'class.json' }, { files: ['class.json'], unsafe: true }, { files: [] }]) {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(value)));
    await expect(importCatalogUrl('https://catalog.test/index.json', system)).rejects.toThrow();
  }
});

it('aborts the complete web preview on a later HTTP failure or nested index', async () => {
  for (const nested of [false, true]) {
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => url.pathname.endsWith('index.json')
      ? Response.json({ files: ['class.json', 'other.json'] })
      : url.pathname.endsWith('class.json') ? new Response(classOriginal)
        : nested ? Response.json({ files: ['class.json'] }) : new Response('', { status: 500 })));
    await expect(importCatalogUrl('https://catalog.test/', system)).rejects.toThrow();
  }
});

it('surfaces HTML, CORS, timeout and invalid URLs instead of crawling or bypassing them', async () => {
  for (const url of ['http://catalog.test/class.json', 'https://user:secret@catalog.test/class.json', 'not a URL', 'https://catalog.test/resources.gzip']) {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(importCatalogUrl(url, system)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  }
  for (const [error, message] of [[new TypeError('Network'), 'CORS'], [new DOMException('Timeout', 'TimeoutError'), '15 secondi']] as const) {
    vi.stubGlobal('fetch', vi.fn(async () => { throw error; }));
    await expect(importCatalogUrl('https://catalog.test/class.json', system)).rejects.toThrow(message);
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>listing</html>', { headers: { 'content-type': 'text/html' } })));
  await expect(importCatalogUrl('https://catalog.test/books/', system)).rejects.toThrow('HTML');
});

it('imports a catalog-only GitHub root and clone URL without requiring a system file', async () => {
  for (const url of ['https://github.com/owner/repo', 'git@github.com:owner/repo.git', 'ssh://git@github.com/owner/repo.git']) {
    const fetch = github();
    const [preview] = await importCatalogUrl(url, system);
    expect(preview.resources[0].catalogSource?.source).toBe(`https://raw.githubusercontent.com/owner/repo/${commit}/catalog/class.json`);
    expect(fetch).toHaveBeenCalledTimes(3);
  }
});

it('accepts GitHub folder and blob links while pinning every read and excluding siblings and symlinks', async () => {
  for (const [url, count] of [
    ['https://github.com/owner/repo/tree/main/catalog', 2],
    ['https://github.com/owner/repo/blob/main/catalog/class.json', 1]
  ] as const) {
    const fetch = github([entry('catalog/class.json'), entry('catalog/race.json', length(raceOriginal)),
      entry('catalogue/other.json'), { ...entry('catalog/link.json'), mode: '120000' }],
    { 'catalog/race.json': raceOriginal });
    expect(await importCatalogUrl(url, system)).toHaveLength(count);
    expect(fetch).toHaveBeenCalledTimes(2 + count);
    expect(fetch.mock.calls[0][0].searchParams.get('sha')).toBe('main');
    for (const [u] of fetch.mock.calls.slice(2)) expect(u.pathname).toContain('/' + commit + '/catalog/');
  }
});

it('disambiguates slash-containing branches using the explicit reference field', async () => {
  const fetch = github();
  expect(await importCatalogUrl('https://github.com/owner/repo/tree/feature/catalogs/catalog', system, 'feature/catalogs')).toHaveLength(1);
  expect(fetch.mock.calls[0][0].searchParams.get('sha')).toBe('feature/catalogs');
  await expect(importCatalogUrl('https://github.com/owner/repo/tree/main/catalog', system, 'other')).rejects.toThrow('riferimento');
});

it('uses only matching supported catalogs in a conventional multi-system source repository', async () => {
  const root = `systems/${catalogSystem.id}/resource_instances/`;
  const fetch = github([entry(root + 'class_wanderer.rpg.json'), entry(root + 'spell_other.rpg.json'),
    entry('systems/other/resource_instances/race_other.rpg.json'), entry('package.json')]);
  for (const url of ['https://github.com/owner/repo', `https://github.com/owner/repo/tree/main/${root}`])
    expect(await importCatalogUrl(url, system)).toHaveLength(1);
  expect(fetch.mock.calls.filter(([u]) => u.hostname === 'raw.githubusercontent.com').every(([u]) => u.pathname.endsWith('class_wanderer.rpg.json'))).toBe(true);
});

it('rejects missing files and wrong byte sizes rather than installing a partial GitHub folder', async () => {
  github([entry('other.txt')]);
  await expect(importCatalogUrl('https://github.com/owner/repo/tree/main/catalog', system)).rejects.toThrow('Nessun catalogo');
  github([entry('catalog/class.json', 1)]);
  await expect(importCatalogUrl('https://github.com/owner/repo/tree/main/catalog', system)).rejects.toThrow('Dimensione');
});

it('accepts exactly 1000 GitHub JSON files and rejects 1001 before source downloads', async () => {
  github(Array.from({ length: 1000 }, (_, i) => entry(`catalog/${i}.json`)));
  expect(await importCatalogUrl('https://github.com/owner/repo/tree/main/catalog', system)).toHaveLength(1000);
  const fetch = github(Array.from({ length: 1001 }, (_, i) => entry(`catalog/${i}.json`)));
  await expect(importCatalogUrl('https://github.com/owner/repo', system)).rejects.toThrow('1.000');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('accepts exactly 24 MiB in three files and rejects aggregate or individual excess before downloading', async () => {
  const padded = classOriginal + ' '.repeat(MAX_SYSTEM_BYTES - length(classOriginal));
  github([entry('a.json', MAX_SYSTEM_BYTES), entry('b.json', MAX_SYSTEM_BYTES), entry('c.json', MAX_SYSTEM_BYTES)],
    { 'a.json': padded, 'b.json': padded, 'c.json': padded });
  const previews = await importCatalogUrl('https://github.com/owner/repo', system);
  expect(previews.reduce((n, p) => n + length(p.resources[0].catalogSource!.original), 0)).toBe(MAX_REPOSITORY_CATALOG_BYTES);
  for (const entries of [
    [entry('a.json', MAX_SYSTEM_BYTES + 1)],
    Array.from({ length: 4 }, (_, i) => entry(`${i}.json`, MAX_REPOSITORY_CATALOG_BYTES / 4 + (i === 3 ? 1 : 0)))
  ]) {
    const fetch = github(entries);
    await expect(importCatalogUrl('https://github.com/owner/repo', system)).rejects.toThrow('limite');
    expect(fetch).toHaveBeenCalledTimes(2);
  }
});

it('caps unknown web file sizes against the remaining 24 MiB including the index', async () => {
  const padded = classOriginal + ' '.repeat(MAX_SYSTEM_BYTES - length(classOriginal));
  const fetch = vi.fn(async (url: URL) => url.pathname.endsWith('index.json')
    ? Response.json({ files: ['a.json', 'b.json', 'c.json'] })
    : new Response(padded, { headers: { 'content-length': String(MAX_SYSTEM_BYTES) } }));
  vi.stubGlobal('fetch', fetch);
  await expect(importCatalogUrl('https://catalog.test/', system)).rejects.toThrow('troppo grande');
  expect(fetch).toHaveBeenCalledTimes(4);
});
