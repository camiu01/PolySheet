/** @file Fresh-snapshot character commands and explicit popup saves. */
import { executeCharacterEvent } from '../engine/character-events';
import { db, setCharacterValue } from './db';
import { it } from '../ui/it';

function sameOverrides(left: unknown, right: unknown) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

/** Run one command in a write transaction and persist changed overrides, base values and owned resource values. */
export async function runCharacterEvent(characterId: string, event: unknown, database = db, targetResource?: string,
  view?: Record<string, unknown>) {
  return database.transaction('rw', database.characters, database.systems, database.resources, async () => {
    const character = await database.characters.get(characterId);
    const system = character && await database.systems.get(character.systemKey);
    if (!character || !system) throw new Error(it.eventOwnerMissing);
    const resources = await database.resources.where('systemKey').equals(system.key).toArray();
    const result = executeCharacterEvent(system, character, resources, event, undefined, targetResource, view);
    if (!sameOverrides(character.overrides, result.overrides) || result.resources.length || Object.keys(result.values).length) {
      character.overrides = result.overrides;
      character.values = { ...character.values, ...result.values };
      character.updatedAt = new Date().toISOString();
      character.revision++;
      await database.characters.put(character);
    }
    if (result.resources.length) await database.resources.bulkPut(result.resources);
    const latest = result.resources.length ? await database.resources.where('systemKey').equals(system.key).toArray() : resources;
    return { result, character, system, resources: latest };
  });
}

/** Revalidate event, target and enumeration against the latest owner before saving. */
export async function saveCharacterEvent(characterId: string, event: unknown, expectedField: string,
  patch: Record<string, unknown>, database = db) {
  await database.transaction('rw', database.characters, database.systems, database.resources, async () => {
    const character = await database.characters.get(characterId);
    const system = character && await database.systems.get(character.systemKey);
    if (!character || !system) throw new Error(it.eventOwnerMissing);
    const resources = await database.resources.where('systemKey').equals(system.key).toArray();
    const result = executeCharacterEvent(system, character, resources, event, () => { throw new Error(it.formReadOnly); });
    if (result.kind !== 'popup' || !result.edit || result.edit.field !== expectedField
      || Object.keys(patch).some(id => id !== expectedField)
      || Object.hasOwn(patch, expectedField) && (typeof patch[expectedField] !== 'string'
        || !result.edit.options.includes(patch[expectedField])))
      throw new Error(it.invalidValue);
    if (!sameOverrides(character.overrides, result.overrides) || result.resources.length || Object.keys(result.values).length) {
      character.overrides = result.overrides;
      character.values = { ...character.values, ...result.values };
      character.updatedAt = new Date().toISOString();
      character.revision++;
      await database.characters.put(character);
    }
    if (result.resources.length) await database.resources.bulkPut(result.resources);
    for (const [id, value] of Object.entries(patch)) await setCharacterValue(characterId, id, value, database);
  });
}
