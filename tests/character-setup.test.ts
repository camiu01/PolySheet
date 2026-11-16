// @vitest-environment node
/** @file Atomic manual setup and recovery of incomplete characters. */
import { afterEach, expect, it } from 'vitest';
import { SheetDatabase, createCharacter, installSystem, setCharacterValue } from '../src/persistence/db';
import { configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { exportBackup, restoreBackup } from '../src/persistence/backup';
import { setupStats } from '../src/engine/character-setup';
import { catalogSystem, classOriginal, raceOriginal, backgroundOriginal } from './fixtures/catalog';
import { base } from './fixtures/capabilities';
import { refreshSystemDiagnostics } from '../src/persistence/diagnostics';

const databases: SheetDatabase[] = [];
afterEach(async () => { for (const database of databases.splice(0)) await database.delete(); });
async function setup() {
  const database = new SheetDatabase(`setup-${crypto.randomUUID()}`); databases.push(database);
  const system = await prepareSystem(JSON.stringify(catalogSystem), 'Original MIT setup test');
  await installSystem(system, database);
  const ids = await installCatalogs(await Promise.all([classOriginal, raceOriginal, backgroundOriginal]
    .map(original => prepareCatalogTemplate(original, 'local.json', system))), database);
  return { database, system, ids };
}

it('derives initial numeric fields from source inputs and keeps declared HP bases without inventing defaults', () => {
  const system = { ...catalogSystem, character_stats: [base('custom_score', 'integer', 3),
    base('base_hp', 'integer', 1), base('current_hp', 'integer', 1), base('unrelated', 'integer', 99)],
  character_creation_flow: [{ title: { id: 'first', name: 'First' }, view: {
    id: 'input', type: 'text', edit_stat: 'custom_score'
  } }] };
  expect(setupStats(system).map(stat => [stat.id, stat.default_value])).toEqual([
    ['custom_score', 3], ['base_hp', 1], ['current_hp', 1]
  ]);
});

it('creates class, origins and initial values together with independent private graphs and restorable originals', async () => {
  const { database, system, ids } = await setup();
  const character = await configureCharacter(system, 'Mira', { vigore: 7 },
    { classes: ids[0], race: ids[1], background: ids[2] }, undefined, database);
  expect(character.values.vigore).toBe(7);
  expect(character.values.classes).toHaveLength(1);
  expect(character.values.race).toHaveProperty('resourceId');
  expect(character.values.background).toHaveProperty('resourceId');
  expect(await database.resources.count()).toBe(9);
  expect((await database.resources.get(ids[0]))?.catalogSource?.original).toBe(classOriginal);
  await restoreBackup(await exportBackup(database), database);
  expect(await database.characters.get(character.id)).toEqual(character);
});

it('rolls back the new character and all copies if a final manual value is invalid', async () => {
  const { database, system, ids } = await setup();
  await expect(configureCharacter(system, 'Incomplete', { vigore: 'wrong' },
    { classes: ids[0], race: ids[1] }, undefined, database)).rejects.toThrow('non valido');
  expect(await database.characters.count()).toBe(0);
  expect(await database.resources.count()).toBe(3);
});

it('configures an existing character without clearing unrelated edits or changing its pin', async () => {
  const { database, system, ids } = await setup();
  const character = await createCharacter(system, 'Existing', database);
  await setCharacterValue(character.id, 'vigore', 9, database);
  const saved = await configureCharacter(system, character.name, {}, { classes: ids[0] }, character.id, database);
  expect(saved.systemKey).toBe(character.systemKey);
  expect(saved.values.vigore).toBe(9);
  expect(saved.values.classes).toHaveLength(1);
  expect(await database.characters.count()).toBe(1);
});

it('refreshes only derived diagnostics during repeated startup and preserves exact originals and character data', async () => {
  const { database, system } = await setup();
  const character = await createCharacter(system, 'Keep', database);
  await database.systems.update(system.key, { diagnostics: [{ path: '$', severity: 'warning', message: 'Old cached result' }] });
  await Promise.all([refreshSystemDiagnostics(database), refreshSystemDiagnostics(database)]);
  expect(await database.systems.get(system.key)).toEqual(system);
  expect(await database.characters.get(character.id)).toEqual(character);
});
