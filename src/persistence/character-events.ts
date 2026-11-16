/** @file Fresh-snapshot, direct-field saves from a verified character popup. */
import { executeCharacterEvent } from '../engine/character-events';
import { db, setCharacterValue } from './db';
import { it } from '../ui/it';

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
    for (const [id, value] of Object.entries(patch)) await setCharacterValue(characterId, id, value, database);
  });
}
