/** @file Validated resource writes and referentially safe deletion. */
import { matchesType, type ResourceInstance } from '../domain/model';
import { checkReferences, referencedIds } from '../domain/references';
import { db } from './db';
import { it } from '../ui/it';

/**
 * Save a manual resource with bounded typed values and same-version links.
 * @param pending - Records written in the same owner transaction. A new private
 * copy of a catalog graph may carry `catalogGroup`/`sourceId` when its group root
 * is itself or a non-catalog record, and may reference not-yet-written members.
 */
export async function saveResource(record: ResourceInstance, database = db, pending: ResourceInstance[] = []) {
  await database.transaction('rw', database.resources, database.systems, async () => {
    const system = await database.systems.get(record.systemKey);
    const definition = system?.definition.resources.find(d => d.id === record.definitionId);
    if (!definition || !record.name.trim() || record.name.length > 100) throw new Error('Nome o definizione risorsa non validi.');
    const existing = await database.resources.get(record.id);
    const groupRoot = record.catalogGroup === record.id ? record
      : record.catalogGroup ? pending.find(r => r.id === record.catalogGroup) ?? await database.resources.get(record.catalogGroup) : undefined;
    const privateCopy = !existing && !record.catalogSource && !record.catalogIssue && !!groupRoot && !groupRoot.catalogSource;
    if ((!existing && !privateCopy && (record.catalogSource || record.catalogGroup || record.sourceId || record.catalogIssue))
      || (existing && (record.sourceId !== existing.sourceId || record.catalogGroup !== existing.catalogGroup
        || JSON.stringify(record.catalogSource) !== JSON.stringify(existing.catalogSource) || record.catalogIssue !== existing.catalogIssue)))
      throw new Error(it.catalogImmutable);
    if (existing?.catalogSource || (existing?.catalogGroup && (await database.resources.get(existing.catalogGroup))?.catalogSource))
      throw new Error(it.catalogImmutable);
    if (existing && (existing.systemKey !== record.systemKey || existing.definitionId !== record.definitionId))
      throw new Error('Tipo e versione di una risorsa esistente non possono cambiare.');
    for (const [id, value] of Object.entries(record.values)) {
      const stat = definition.stats.find(s => s.id === id && s.type === 'base');
      if (!stat || !matchesType(value, stat.value_type, stat.sub_value_type)) throw new Error(`${id}: valore risorsa non valido.`);
    }
    const resources = await database.resources.where('systemKey').equals(record.systemKey).toArray();
    const batch = pending.filter(r => r.id !== record.id && !resources.some(e => e.id === r.id));
    checkReferences(definition.stats, record.values, [...resources.filter(r => r.id !== record.id), ...batch, record], record.systemKey);
    await database.resources.put(record);
  });
}
/**
 * Add many new records in one owner transaction (staged draft graphs), validating each like
 * `saveResource` against one snapshot instead of re-reading every resource per record.
 * @throws When any record already exists, forges catalog identity, has invalid values or dangling links.
 */
export async function addResources(records: ResourceInstance[], systemKey: string, database = db) {
  if (!records.length) return;
  await database.transaction('rw', database.resources, database.systems, async () => {
    const system = await database.systems.get(systemKey);
    const stored = await database.resources.where('systemKey').equals(systemKey).toArray();
    const known = new Map([...stored, ...records].map(r => [r.id, r]));
    if (records.some(r => r.systemKey !== systemKey || stored.some(e => e.id === r.id)) || known.size !== stored.length + records.length)
      throw new Error('Nuova risorsa non compatibile.');
    const all = [...known.values()];
    for (const record of records) {
      const definition = system?.definition.resources.find(d => d.id === record.definitionId);
      if (!definition || !record.name.trim() || record.name.length > 100) throw new Error('Nome o definizione risorsa non validi.');
      const groupRoot = record.catalogGroup ? known.get(record.catalogGroup) : undefined;
      const identity = record.catalogSource || record.catalogIssue || ((record.catalogGroup || record.sourceId) && (!groupRoot || groupRoot.catalogSource));
      if (identity) throw new Error(it.catalogImmutable);
      for (const [id, value] of Object.entries(record.values)) {
        const stat = definition.stats.find(s => s.id === id && s.type === 'base');
        if (!stat || !matchesType(value, stat.value_type, stat.sub_value_type)) throw new Error(`${id}: valore risorsa non valido.`);
      }
      checkReferences(definition.stats, record.values, all, systemKey);
    }
    await database.resources.bulkAdd(records);
  });
}
/** Do not leave dangling rule references or combat sources when deleting a note. */
export async function deleteResource(id: string, database = db) {
  await database.transaction('rw', [database.resources, database.characters, database.systems, database.combats], async () => {
    const record = await database.resources.get(id);
    if (!record) return;
    const system = await database.systems.get(record.systemKey);
    const characters = await database.characters.where('systemKey').equals(record.systemKey).toArray();
    const resources = await database.resources.where('systemKey').equals(record.systemKey).toArray();
    if (!system) throw new Error('Sistema della risorsa mancante.');
    const deleting = new Set([id, ...resources.filter(r => r.catalogGroup === id).map(r => r.id)]);
    const linked = (stats: typeof system.definition.character_stats, values: Record<string, unknown>) =>
      stats.some(s => referencedIds(s, values[s.id]).some(id => deleting.has(id)));
    if (characters.some(c => linked(system.definition.character_stats, c.values))
      || resources.some(r => !deleting.has(r.id) && linked(system.definition.resources.find(d => d.id === r.definitionId)?.stats ?? [], r.values))
      || (await database.combats.where('systemKey').equals(record.systemKey).toArray()).some(c =>
        c.combatants.some(f => {
          const type = system.definition.combat_system?.combatant_types.find(t => t.id === f.typeId);
          const stats = system.definition.resources.find(d => d.id === type?.instance_resource_id)?.stats ?? [];
          return Boolean(f.resourceId && deleting.has(f.resourceId) || f.templateId && deleting.has(f.templateId))
            || linked(stats, { ...f.values, ...f.overrides });
        })))
      throw new Error('Risorsa usata da un campo o da un incontro: rimuovi prima il riferimento.');
    await database.resources.bulkDelete([...deleting]);
    for (const c of characters.filter(c => c.resourceIds.some(id => deleting.has(id)))) {
      c.resourceIds = c.resourceIds.filter(value => !deleting.has(value));
      c.revision++; c.updatedAt = new Date().toISOString();
      await database.characters.put(c);
    }
  });
}
