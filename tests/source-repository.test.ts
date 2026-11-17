// @vitest-environment node
/** @file File-free, commit-pinned source preparation and exact-source backup integrity. */
import { afterEach, expect, it, vi } from 'vitest';
import { discoverRepository, prepareRepositoryBundle } from '../src/importing/repository';
import { MAX_SYSTEM_BYTES } from '../src/importing/system';
import { object } from '../src/domain/model';
import { SheetDatabase } from '../src/persistence/db';
import { installRepositoryBundle } from '../src/persistence/catalog';
import { exportBackup, validateBackup } from '../src/persistence/backup';
import { catalogSystem, classOriginal } from './fixtures/catalog';

const repository = 'https://github.com/blastervla/rpg-companion-app-systems';
const commit = 'a'.repeat(40), treeSha = 'b'.repeat(40);
const root = 'systems/5e/system/system.rpg.json', script = 'systems/5e/system/character_stats.rpgs';
function sources() {
  return new Map([
    [root, '\ufeff' + JSON.stringify({ ...catalogSystem, id: '5e' }, null, 2)],
    [script, 'import "../../_stdlib/math.rpgs";\r\nbase integer source_seed(name="Seed") = 3;\r\ncalc integer source_total(name="Total") = twice(value=source_seed);'],
    ['systems/_stdlib/math.rpgs', 'import "./constants.rpgs"; define twice(value) = value * factor;'],
    ['systems/_stdlib/constants.rpgs', 'define factor() = 2;'],
    ['systems/5e/resource_instances/class_one.rpg.json', classOriginal.replace('catalog-original', '5e')],
    ['systems/other/system/invalid.rpgs', 'not valid syntax']
  ]);
}
function fixture(files: Map<string, string>, options: { sizes?: Map<string, number>; fail?: string } = {}) {
  let concurrent = 0, maximum = 0;
  const fetch = vi.fn(async (url: URL) => {
    if (url.hostname === 'api.github.com') return Response.json(url.pathname.endsWith('/commits')
      ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
      : { sha: treeSha, truncated: false, tree: [...files].map(([path, text]) => ({
        path, size: options.sizes?.get(path) ?? Buffer.byteLength(text), type: 'blob', mode: '100644'
      })) });
    expect(url.hostname).toBe('raw.githubusercontent.com');
    expect(url.pathname).toContain('/' + commit + '/');
    expect(url.search).toBe('');
    const path = decodeURIComponent(url.pathname.split('/' + commit + '/')[1]);
    concurrent++; maximum = Math.max(maximum, concurrent);
    await Promise.resolve(); concurrent--;
    const text = files.get(path);
    return text === undefined || path === options.fail ? new Response('', { status: 404 }) : new Response(text);
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, maximum: () => maximum };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('compiles JSON and transitive shared macros without a local file, preserving exact sources through backup', async () => {
  const files = sources(), network = fixture(files);
  const found = await discoverRepository(repository);
  const bundle = await prepareRepositoryBundle(found, '5e');
  const total = bundle.system.definition.character_stats.find(s => s.id === 'source_total');
  expect(total?.components).toEqual({ type: 'multiply', components: { type: 'list', components: [
    { type: 'stat', stat: 'source_seed' }, { type: 'constant', value_type: 'integer', value: 2 }
  ] } });
  expect(bundle.system.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  expect(bundle.system.source).toContain(`/${commit}/${root}`);
  const snapshot = object(bundle.system.definition.polysheet_source);
  expect(snapshot.format).toBe('rpgscript-v1'); expect(snapshot.root).toBe(root);
  const originals = snapshot.files as { path: string; original: string }[];
  expect(originals).toHaveLength(4);
  for (const file of originals) expect(file.original).toBe(files.get(file.path));
  expect(network.maximum()).toBeLessThanOrEqual(4);
  expect(network.fetch.mock.calls.filter(([url]) => url.pathname.endsWith(root))).toHaveLength(1);
  expect(network.fetch.mock.calls.some(([url]) => url.pathname.includes('/other/'))).toBe(false);
  const database = new SheetDatabase('source-' + crypto.randomUUID());
  try {
    expect(await database.systems.count()).toBe(0);
    await installRepositoryBundle(bundle.system, bundle.catalogs, database);
    const backup = await exportBackup(database), restored = await validateBackup(backup);
    expect(restored.systems[0].original).toBe(bundle.system.original);
    expect(restored.systems[0].definition.polysheet_source).toEqual(snapshot);
    const tampered = JSON.parse(backup);
    tampered.systems[0].original = tampered.systems[0].original.replace('source_seed', 'source_seed_changed');
    await expect(validateBackup(JSON.stringify(tampered))).rejects.toThrow('alterato');
    expect(await database.systems.count()).toBe(1);
  } finally { await database.delete(); }
});

it('fails visibly on any missing dependency, malformed source, unknown constructor or changed size', async () => {
  for (const problem of ['missing', 'syntax', 'constructor', 'size', 'network']) {
    const files = sources();
    if (problem === 'missing') files.delete('systems/_stdlib/constants.rpgs');
    if (problem === 'syntax') files.set(script, 'calc integer invalid() = 1);');
    if (problem === 'constructor') files.set(script, 'calc integer invalid(name="Invalid") = unknownRule(1);');
    const sizes = problem === 'size' ? new Map([[script, Buffer.byteLength(files.get(script)!) + 1]]) : undefined;
    fixture(files, { sizes, fail: problem === 'network' ? script : undefined });
    const found = await discoverRepository(repository);
    await expect(prepareRepositoryBundle(found, '5e')).rejects.toThrow(
      problem === 'missing' ? 'Dipendenza' : problem === 'size' ? 'Dimensione' : problem === 'network' ? 'HTTP 404' : script
    );
  }
});

it('bounds source bytes and file count before downloading the parts', async () => {
  for (const boundary of ['bytes', 'count']) {
    const files = sources();
    if (boundary === 'count') for (let index = 0; index < 1000; index++)
      files.set(`systems/5e/system/extra_${index}.rpgs`, '');
    const sizes = boundary === 'bytes' ? new Map([[script, MAX_SYSTEM_BYTES]]) : undefined;
    const { fetch } = fixture(files, { sizes }), found = await discoverRepository(repository);
    fetch.mockClear();
    await expect(prepareRepositoryBundle(found, '5e')).rejects.toThrow('Sorgenti oltre il limite');
    expect(fetch).not.toHaveBeenCalled();
  }
});
