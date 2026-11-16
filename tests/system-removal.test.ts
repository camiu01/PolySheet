// @vitest-environment node
/** @file Exact-import removal, protected pins and stale/concurrent writer boundaries. */
import { afterEach, expect, it, vi } from 'vitest';
import { SheetDatabase, createCharacter, defaultPreferences, deleteSystem, initialValues, installSystem, saveRoll } from '../src/persistence/db';
import { createCombat } from '../src/persistence/combat';
import { prepareSystem } from '../src/importing/system';
import { exportBackup, restoreBackup } from '../src/persistence/backup';
import { capabilitySystem } from './fixtures/capabilities';

const databases: SheetDatabase[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const d of databases.splice(0)) await d.delete(); });
async function setup() {
  const database = new SheetDatabase('remove-' + crypto.randomUUID()); databases.push(database);
  const system = await prepareSystem(JSON.stringify(capabilitySystem), 'Original MIT fixture');
  await installSystem(system, database);
  const definition = system.definition.resources[0];
  await database.resources.add({ id: 'resource', systemKey: system.key, definitionId: definition.id,
    name: 'Local note', values: initialValues(definition.stats) });
  const roll = { id: 'roll', systemKey: system.key, formula: '1d6', results: [3], total: 3, createdAt: new Date().toISOString() };
  await saveRoll(roll, 100, database);
  return { database, system, roll };
}
it('removes only the exact unused import with its resources/rolls and preserves other pins and preferences through backup', async () => {
  const { database, system } = await setup();
  const other = await prepareSystem(JSON.stringify(capabilitySystem) + '\n', 'Same version, different original');
  await installSystem(other, database); const character = await createCharacter(other, 'Preserved', database);
  await database.preferences.put(defaultPreferences);
  await deleteSystem(system.key, database); await deleteSystem(system.key, database);
  expect(await database.systems.get(system.key)).toBeUndefined();
  expect(await database.resources.count()).toBe(0); expect(await database.rolls.count()).toBe(0);
  expect((await database.characters.get(character.id))?.systemKey).toBe(other.key);
  const backup = await exportBackup(database); await restoreBackup(backup, database);
  expect(await database.systems.count()).toBe(1);
  expect(await database.preferences.get('app')).toEqual(defaultPreferences);
});
it('blocks removal while a character or encounter uses this exact import without deleting any data', async () => {
  const { database, system } = await setup();
  const c = await createCharacter(system, 'Pinned', database);
  await expect(deleteSystem(system.key, database)).rejects.toThrow('personaggi o incontri');
  expect(await database.resources.count()).toBe(1); expect(await database.rolls.count()).toBe(1);
  await database.characters.delete(c.id);
  const encounter = await createCombat(system.key, 'Pinned encounter', database);
  await expect(deleteSystem(system.key, database)).rejects.toThrow('personaggi o incontri');
  expect(await database.combats.get(encounter.id)).toBeDefined(); expect(await database.systems.get(system.key)).toBeDefined();
  await database.combats.delete(encounter.id); await deleteSystem(system.key, database);
  expect(await database.systems.count()).toBe(0);
});
it('rolls back earlier resource and roll deletion if the final system write fails', async () => {
  const { database, system } = await setup();
  vi.spyOn(database.systems, 'delete').mockRejectedValueOnce(new Error('Simulated write failure'));
  await expect(deleteSystem(system.key, database)).rejects.toThrow('Simulated write failure');
  expect(await database.resources.count()).toBe(1); expect(await database.rolls.count()).toBe(1);
  expect(await database.systems.get(system.key)).toBeDefined();
});
it('rejects stale character, encounter and roll creation after system removal', async () => {
  const { database, system, roll } = await setup();
  await deleteSystem(system.key, database);
  await expect(createCharacter(system, 'Stale', database)).rejects.toThrow();
  await expect(createCombat(system.key, 'Stale', database)).rejects.toThrow();
  await expect(saveRoll(roll, 100, database)).rejects.toThrow();
  expect(await database.characters.count()).toBe(0); expect(await database.combats.count()).toBe(0);
  expect(await database.rolls.count()).toBe(0);
});
it('serializes removal with each real creator in both orders so no orphan pin survives', async () => {
  for (const kind of ['character', 'combat', 'roll']) for (const deleteFirst of [true, false]) {
    const { database, system, roll } = await setup();
    const create = () => kind === 'character' ? createCharacter(system, 'Concurrent', database)
      : kind === 'combat' ? createCombat(system.key, 'Concurrent', database) : saveRoll({ ...roll, id: 'new-roll' }, 100, database);
    await Promise.allSettled(deleteFirst ? [deleteSystem(system.key, database), create()] : [create(), deleteSystem(system.key, database)]);
    if (!await database.systems.get(system.key)) {
      expect(await database.characters.count()).toBe(0); expect(await database.combats.count()).toBe(0);
      expect(await database.resources.count()).toBe(0); expect(await database.rolls.count()).toBe(0);
    } else {
      expect(kind).not.toBe('roll');
      expect(await database.characters.count() + await database.combats.count()).toBe(1);
    }
  }
});
