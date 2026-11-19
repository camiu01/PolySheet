/** @file Atomic source-form patches and locally created resource assignments. */
import { jsonValue, matchesType, type ResourceInstance } from '../domain/model';
import { db, setCharacterValue } from './db';
import { addResources, saveResource } from './resources';
import { combatContext } from '../engine/combat';
import { commandCombat } from './combat';

export type ValuePatch = Record<string, unknown> | ((latest: Record<string, unknown>) => Record<string, unknown>);
/** Patch the latest owner and create referenced local instances in one transaction. */
export async function commitCharacterView(id: string, patch: ValuePatch, additions: ResourceInstance[] = [], database = db) {
  await database.transaction('rw', [database.characters, database.systems, database.resources], async () => {
    const character = await database.characters.get(id);
    if (!character) throw new Error('Personaggio non trovato');
    await addResources(additions, character.systemKey, database);
    const changes = typeof patch === 'function' ? patch(character.values) : patch;
    for (const [statId, value] of Object.entries(changes)) await setCharacterValue(id, statId, value, database);
  });
}
/** Resource forms patch fields, never replace an old whole-record snapshot. */
export async function commitResourceView(id: string, patch: ValuePatch, additions: ResourceInstance[] = [], database = db) {
  await database.transaction('rw', [database.resources, database.systems], async () => {
    const record = await database.resources.get(id);
    if (!record) throw new Error('Risorsa non trovata');
    await addResources(additions, record.systemKey, database);
    const changes = typeof patch === 'function' ? patch(record.values) : patch;
    const system = await database.systems.get(record.systemKey);
    const definition = system?.definition.resources.find(d => d.id === record.definitionId);
    for (const [id, value] of Object.entries(changes)) {
      const s = definition?.stats.find(s => s.id === id && s.type === 'base');
      if (!s || !matchesType(value, s.value_type, s.sub_value_type)) throw new Error('Valore risorsa non valido.');
      record.values[id] = jsonValue(value);
    }
    await saveResource(record, database);
  });
}
/** Apply combat actor edits atomically, retaining linked-PC and override semantics. */
export async function commitCombatView(combatId: string, actorId: string, patch: ValuePatch, additions: ResourceInstance[] = [], database = db) {
  await database.transaction('rw', [database.combats, database.characters, database.systems, database.resources], async () => {
    const combat = await database.combats.get(combatId);
    const system = combat && await database.systems.get(combat.systemKey);
    if (!combat || !system) throw new Error('Incontro non trovato.');
    await addResources(additions, system.key, database);
    const characters = await database.characters.where('systemKey').equals(system.key).toArray();
    const resources = await database.resources.where('systemKey').equals(system.key).toArray();
    const scope = combatContext(system, combat, characters, resources).scopes.get(actorId);
    if (!scope) throw new Error('Combattente non trovato.');
    const changes = typeof patch === 'function' ? patch({ ...scope.values, ...scope.overrides }) : patch;
    for (const [statId, value] of Object.entries(changes))
      await commandCombat(combatId, { type: 'value', id: actorId, statId, value }, database);
  });
}
