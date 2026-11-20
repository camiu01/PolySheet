// @vitest-environment node
/** @file Local folder imports stay metadata-first, bounded and exact. */
import { expect, it } from 'vitest';
import {
  catalogDirectoryOf, discoverLocalFolder, folderCatalogs, prepareLocalBundle, prepareLocalSystem, type FolderFile
} from '../src/importing/local-folder';
import { MAX_TREE_ENTRIES } from '../src/importing/github';
import { MAX_SYSTEM_BYTES } from '../src/importing/system';
import { it as copy } from '../src/ui/it';
import { catalogSystem, classOriginal, raceOriginal } from './fixtures/catalog';

const systemText = JSON.stringify(catalogSystem);
const entry = (path: string, text: string): FolderFile =>
  ({ path, size: Buffer.byteLength(text), bytes: async () => new TextEncoder().encode(text) });
const folder = () => [
  entry('export/song.system.json', systemText),
  entry('export/catalogs/class/viandante.json', classOriginal),
  entry('export/catalogs/race/collina.json', raceOriginal),
  entry('export/catalogs/manifest.json', JSON.stringify({ total: 2 }))
];

it('lists only supported system and catalog metadata from a folder', () => {
  const found = discoverLocalFolder([...folder(), { path: 'export/Core Rulebook.pdf', size: 254744036 }]);
  expect(found.name).toBe('export');
  expect(found.systems.map(file => file.path)).toEqual(['export/song.system.json']);
  expect(found.catalogs.map(file => file.path)).toEqual([
    'export/catalogs/class/viandante.json', 'export/catalogs/race/collina.json'
  ]);
  expect(found.files.some(file => file.path.endsWith('.pdf'))).toBe(false);
});

it('prepares the selected system with its catalogs before any write', async () => {
  const files = folder(), progress: number[] = [];
  const bundle = await prepareLocalBundle(files, 'export/song.system.json', (done, total) => progress.push(done, total));
  expect(bundle.system.definition.id).toBe('catalog-original');
  expect(bundle.system.source).toBe('export/song.system.json');
  expect(bundle.catalogs).toHaveLength(2);
  expect(progress).toEqual([0, 2, 2, 2]);
  expect(bundle.catalogs[0].resources[0].catalogSource?.original).toBe(classOriginal);
  expect(bundle.catalogs[0].resources[0].catalogSource?.source).toBe('export/catalogs/class/viandante.json');
});

it('keeps catalogs scoped to the selected system in a multi-system folder', async () => {
  const systems = ['a', 'b'].map(id => ({
    path: `repo/systems/${id}/system/system.rpg.json`,
    text: JSON.stringify({ ...catalogSystem, id })
  }));
  const files: FolderFile[] = [
    ...systems.map(system => entry(system.path, system.text)),
    entry('repo/systems/a/resource_instances/class_a.rpg.json', classOriginal.replace('catalog-original', 'a')),
    entry('repo/systems/b/resource_instances/class_b.rpg.json', classOriginal.replace('catalog-original', 'b'))
  ];
  const found = discoverLocalFolder(files);
  expect(found.systems).toHaveLength(2);
  expect(catalogDirectoryOf(systems[0].path)).toBe('repo/systems/a/');
  expect(folderCatalogs(found, systems[0].path).map(file => file.path)).toEqual(['repo/systems/a/resource_instances/class_a.rpg.json']);
  const bundle = await prepareLocalBundle(files, systems[1].path);
  expect(bundle.system.definition.id).toBe('b');
  expect(bundle.catalogs).toHaveLength(1);
});

it('rejects folders without a system, unsafe paths and oversized metadata', async () => {
  expect(() => discoverLocalFolder([])).toThrow(copy.folderNoSystem);
  expect(() => discoverLocalFolder([entry('export/readme.md', 'x')])).toThrow(copy.folderNoSystem);
  expect(() => discoverLocalFolder([entry('export/../system.json', systemText)])).toThrow(copy.folderInvalid);
  expect(() => discoverLocalFolder([entry('export/system.json', systemText), entry('export/system.json', systemText)])).toThrow(copy.folderInvalid);
  expect(() => discoverLocalFolder(Array.from({ length: MAX_TREE_ENTRIES + 1 }, (_, index) => entry(`export/${index}.md`, 'x'))))
    .toThrow(copy.folderLimit);
  expect(() => discoverLocalFolder([
    ...Array.from({ length: 101 }, (_, index) => entry(`export/${index}.system.json`, systemText))
  ])).toThrow(copy.folderTooMany);
  const oversized = [{ path: 'export/system.json', size: MAX_SYSTEM_BYTES + 1, bytes: async () => new Uint8Array() }];
  return expect(prepareLocalSystem(oversized, 'export/system.json')).rejects.toThrow(copy.folderFileTooLarge);
});

it('surfaces the failing catalog path and changed bytes instead of hiding them', async () => {
  const files = [...folder(), entry('export/catalogs/class/broken.json', '{}')];
  await expect(prepareLocalBundle(files, 'export/song.system.json')).rejects.toThrow('export/catalogs/class/broken.json');
  const changed: FolderFile[] = [{ path: 'export/song.system.json', size: 1, bytes: async () => new TextEncoder().encode(systemText) }];
  await expect(prepareLocalSystem(changed, 'export/song.system.json')).rejects.toThrow(copy.folderChanged);
  await expect(prepareLocalSystem(folder(), 'export/catalogs/manifest.json')).rejects.toThrow(copy.folderInvalid);
});
