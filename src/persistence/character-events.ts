/** @file Fresh-snapshot character commands and explicit popup saves. */
import { executeCharacterEvent } from '../engine/character-events';
import { db, setCharacterValue } from './db';
import { it } from '../ui/it';

function sameOverrides(left: unknown, right: unknown) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

/** Run one command in a write transaction and persist only changed mechanic overrides. */
export async function runCharacterEvent(characterId: string, event: unknown, database = db) {
  return database.transaction('rw', database.characters, database.systems, database.resources, async () => {
    const character = await database.characters.get(characterId);
    const system = character && await database.systems.get(character.systemKey);
    if (!character || !system) throw new Error(it.eventOwnerMissing);
    const resources = await database.resources.where('systemKey').equals(system.key).toArray();
    const result = executeCharacterEvent(system, character, resources, event);
    if (!sameOverrides(character.overrides, result.overrides)) {
      character.overrides = result.overrides;
      character.updatedAt = new Date().toISOString();
      character.revision++;
      await database.characters.put(character);
    }
    return { result, character, system, resources };
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
    if (!sameOverrides(character.overrides, result.overrides)) {
      character.overrides = result.overrides;
      character.updatedAt = new Date().toISOString();
      character.revision++;
      await database.characters.put(character);
    }
    for (const [id, value] of Object.entries(patch)) await setCharacterValue(characterId, id, value, database);
  });
}
