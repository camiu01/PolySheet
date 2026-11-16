// @vitest-environment node
/** @file Private backgrounds, upstream subrace identity, stale selections and backup round trips. */
import { afterEach, expect, it } from 'vitest';
import { SheetDatabase, createCharacter, installSystem, setCharacterValue } from '../src/persistence/db';
import { assignCatalog, installCatalogs, setCharacterSubrace } from '../src/persistence/catalog';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { prepareSystem } from '../src/importing/system';
import { exportBackup, restoreBackup } from '../src/persistence/backup';
import { subraceFields, subraceOptions } from '../src/engine/character-origins';
import { createEvaluator } from '../src/engine/formulas';
import { catalogSystem, backgroundOriginal, subraceOriginal, raceOriginal } from './fixtures/catalog';

const databases: SheetDatabase[] = [];
afterEach(async () => { for (const database of databases.splice(0)) await database.delete(); });
async function setup() {
  const database = new SheetDatabase('origins-' + crypto.randomUUID()); databases.push(database);
  const system = await prepareSystem(JSON.stringify(catalogSystem), 'Original MIT fixture');
  await installSystem(system, database);
  const previews = await Promise.all([backgroundOriginal, subraceOriginal, raceOriginal]
    .map(text => prepareCatalogTemplate(text, 'original.json', system)));
  const [background, race, otherRace] = await installCatalogs(previews, database);
  const character = await createCharacter(system, 'Archivio', database);
  return { database, system, background, race, otherRace, character };
}
it('assigns independent background graphs without granting effects and retains exact originals through backup', async () => {
  const { database, system, character, background } = await setup();
  const other = await createCharacter(system, 'Altro', database);
  await Promise.all([assignCatalog(character.id, background, 'background', database),
    assignCatalog(other.id, background, 'background', database), setCharacterValue(character.id, 'vigore', 8, database)]);
  const a = (await database.characters.get(character.id))!, b = (await database.characters.get(other.id))!;
  expect(a.values.background).not.toEqual(b.values.background);
  expect(a.values.background).not.toEqual({ resourceId: background });
  expect(a.values.vigore).toBe(8);
  const resources = await database.resources.toArray();
  expect(createEvaluator(system.definition.character_stats, a.values, undefined, {
    resources, resourceDefinitions: system.definition.resources
  }).get('background.features')).toHaveLength(1);
  await expect(assignCatalog(character.id, background, 'race', database)).rejects.toThrow();
  await restoreBackup(await exportBackup(database), database);
  expect((await database.resources.get(background))?.catalogSource?.original).toBe(backgroundOriginal);
  expect((await database.characters.get(character.id))?.values.background).toEqual(a.values.background);
});
it('offers only assigned-race children and saves the original scalar ID, not the local UUID', async () => {
  const { database, system, character, race } = await setup();
  expect(subraceOptions(system.definition, character, await database.resources.toArray())).toEqual([]);
  await assignCatalog(character.id, race, 'race', database);
  const current = (await database.characters.get(character.id))!;
  const raceId = (current.values.race as { resourceId: string }).resourceId;
  const resources = await database.resources.toArray();
  expect(subraceOptions(system.definition, current, resources)).toEqual([{ id: 'upstream-subrace', name: 'Riva' }]);
  const child = resources.find(r => r.sourceId === 'upstream-subrace')!;
  await expect(setCharacterSubrace(character.id, raceId, child.id, database)).rejects.toThrow();
  await setCharacterSubrace(character.id, raceId, 'upstream-subrace', database);
  await restoreBackup(await exportBackup(database), database);
  expect((await database.characters.get(character.id))?.values.subrace_id).toBe('upstream-subrace');
  await setCharacterSubrace(character.id, raceId, null, database);
  expect((await database.characters.get(character.id))?.values.subrace_id).toBeNull();
});
it('clears catalog-dependent selections atomically and rejects delayed edits after the race changes', async () => {
  const { database, character, race, otherRace } = await setup();
  await assignCatalog(character.id, race, 'race', database);
  const current = (await database.characters.get(character.id))!;
  const raceId = (current.values.race as { resourceId: string }).resourceId;
  await setCharacterSubrace(character.id, raceId, 'upstream-subrace', database);
  await Promise.all([assignCatalog(character.id, otherRace, 'race', database), setCharacterValue(character.id, 'vigore', 9, database)]);
  await expect(setCharacterSubrace(character.id, raceId, 'upstream-subrace', database)).rejects.toThrow();
  const changed = (await database.characters.get(character.id))!;
  expect(changed.values.subrace_id).toBeNull(); expect(changed.values.vigore).toBe(9);
  expect((await database.resources.get(race))?.catalogSource?.original).toBe(subraceOriginal);
});
it('does not infer a subrace contract from labels alone or override a custom ID stat', async () => {
  const { system } = await setup();
  expect(subraceFields(system.definition)).toBeTruthy();
  expect(subraceFields({ ...system.definition, character_stats: system.definition.character_stats.filter(s => s.id !== 'subrace_id') })).toBeUndefined();
  expect(subraceFields({ ...system.definition, resources: system.definition.resources.map(d => d.id === 'race'
    ? { ...d, stats: [...d.stats, { id: 'id', name: 'ID', type: 'base', value_type: 'string', default_value: '' }] } : d) })).toBeUndefined();
});
