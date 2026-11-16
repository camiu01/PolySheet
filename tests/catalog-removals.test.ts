// @vitest-environment node
/** @file Resource-array tombstones apply only to complete, independent catalog snapshots. */
import { afterEach, expect, it } from 'vitest';
import { prepareCatalog, prepareCatalogTemplate } from '../src/importing/catalog';
import { prepareSystem } from '../src/importing/system';
import { catalogSystem, classOriginal } from './fixtures/catalog';
import { SheetDatabase, createCharacter, installSystem, setCharacterValue } from '../src/persistence/db';
import { assignCatalog, installCatalogs, refreshCatalogIssues } from '../src/persistence/catalog';
import { exportBackup, restoreBackup } from '../src/persistence/backup';

const databases: SheetDatabase[] = [];
afterEach(async () => { for (const database of databases.splice(0)) await database.delete(); });

function snapshot(removeIds: unknown = ['retired-feature']) {
  const input = JSON.parse(classOriginal.slice(1));
  input.stats.features.remove_ids = removeIds;
  return '\ufeff' + JSON.stringify(input);
}

it('accepts validated removal history without losing any current children or exact source bytes', async () => {
  const system = await prepareSystem(JSON.stringify(catalogSystem), 'Original MIT system');
  const original = snapshot();
  const template = await prepareCatalogTemplate(original, 'snapshot.json', system);
  expect(template.resources[0].catalogIssue).toBeUndefined();
  const graph = await prepareCatalog(original, 'snapshot.json', system);
  expect(graph.resources).toHaveLength(2);
  expect(graph.resources.map(r => r.sourceId)).toEqual(['original-class', 'original-feature']);
  expect(graph.resources[0].catalogSource?.original).toBe(original);
  expect(graph.resources[1].values).toEqual({ name: 'Passo', amount: 2 });
  await expect(prepareCatalog(snapshot(Array.from({ length: 10000 }, (_, i) => `${i}`)), 'at-limit.json', system)).resolves.toBeDefined();
});

it('rejects malformed, ambiguous and non-resource removal wrappers instead of dropping their contents', async () => {
  const system = await prepareSystem(JSON.stringify(catalogSystem), 'Original MIT system');
  for (const removeIds of [null, 'retired-feature', {}, [1], [''], ['x'.repeat(501)],
    ['same', 'same'], ['original-feature'], Array.from({ length: 10001 }, (_, i) => `${i}`)]) {
    await expect(prepareCatalog(snapshot(removeIds), 'invalid.json', system)).rejects.toThrow();
  }
  const input = JSON.parse(snapshot().slice(1));
  for (const features of [
    { remove_ids: ['retired-feature'] },
    { value: null, remove_ids: ['retired-feature'] },
    { ...input.stats.features, merge: true }
  ]) {
    await expect(prepareCatalog(JSON.stringify({ ...input, stats: { ...input.stats, features } }), 'invalid.json', system)).rejects.toThrow();
  }
  input.stats.name.remove_ids = [];
  await expect(prepareCatalog(JSON.stringify(input), 'invalid.json', system)).rejects.toThrow();
});

it('refreshes old cached blockers without changing originals, pins, private graphs or concurrent edits', async () => {
  const database = new SheetDatabase('catalog-history-' + crypto.randomUUID()); databases.push(database);
  const system = await prepareSystem(JSON.stringify(catalogSystem), 'Original MIT system');
  await installSystem(system, database);
  const good = await prepareCatalogTemplate(snapshot(), 'snapshot.json', system);
  const bad = await prepareCatalogTemplate(snapshot(['original-feature']), 'ambiguous.json', system);
  const [id, badId] = await installCatalogs([good, bad], database);
  const original = (await database.resources.get(id))!;
  const character = await createCharacter(system, 'Preserved', database);
  await assignCatalog(character.id, id, 'classes', database);
  const privateRecords = (await database.resources.toArray()).filter(r => !r.catalogSource);
  await database.resources.update(id, { catalogIssue: 'Old parser did not support remove_ids' });
  await Promise.all([refreshCatalogIssues(database), refreshCatalogIssues(database), setCharacterValue(character.id, 'vigore', 7, database)]);
  expect(await database.resources.get(id)).toEqual(original);
  expect((await database.resources.get(badId))?.catalogIssue).toBeTruthy();
  expect((await database.resources.toArray()).filter(r => !r.catalogSource)).toEqual(privateRecords);
  expect((await database.characters.get(character.id))?.values.vigore).toBe(7);
  const backup = await exportBackup(database); await restoreBackup(backup, database);
  expect((await database.resources.get(id))?.catalogSource).toEqual(original.catalogSource);
  expect((await database.characters.get(character.id))?.systemKey).toBe(character.systemKey);
});

it('reimport refreshes derived compatibility without replacing IDs and assignment distrusts stale blockers', async () => {
  const database = new SheetDatabase('catalog-reimport-' + crypto.randomUUID()); databases.push(database);
  const system = await prepareSystem(JSON.stringify(catalogSystem), 'Original MIT system');
  await installSystem(system, database);
  const preview = await prepareCatalogTemplate(snapshot(), 'snapshot.json', system);
  const [id] = await installCatalogs([preview], database);
  await database.resources.update(id, { catalogIssue: 'Old cached blocker' });
  const character = await createCharacter(system, 'Existing import', database);
  await assignCatalog(character.id, id, 'classes', database);
  expect((await database.characters.get(character.id))?.values.classes).toHaveLength(1);
  expect(await installCatalogs([preview], database)).toEqual([id]);
  expect((await database.resources.get(id))?.catalogIssue).toBeUndefined();
  expect(await database.resources.count()).toBe(4);
});
