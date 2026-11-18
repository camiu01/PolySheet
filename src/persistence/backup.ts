/**
 * @file PolySheet backup v4; reads legacy v1/v2/v3 without changing source identities.
 * @remarks Source imports are revalidated and rehashed before any data is changed.
 */
import { z } from 'zod';
import { boundedJson, prepareSystem } from '../importing/system';
import { artifactBytes, prepareImport } from '../importing/package';
import { matchesType, object, type Character, type Combat, type ResourceInstance } from '../domain/model';
import { checkReferences } from '../domain/references';
import { eligibleCombatants, initiativeOrder } from '../engine/combat';
import { db, type SheetDatabase } from './db';
import { catalogDigest, prepareCatalogTemplate } from '../importing/catalog';

const record = z.record(z.string(), z.unknown());
const id = z.string().min(1).max(500);
const date = z.string().datetime();
const schema = z.object({
  // The original format tag stays readable so backups exported before the rename still restore.
  format: z.union([z.literal('polysheet-backup'), z.literal('sheetcore-backup')]),
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), exportedAt: date,
  systems: z.array(z.object({
    key: id, original: z.string(), source: z.string().max(2000), digest: id, importedAt: date,
    artifact: z.object({ format: z.literal('gzip-json'), base64: z.string().max(Math.ceil(8 * 1024 * 1024 / 3) * 4) }).strict().optional()
  })).max(100),
  characters: z.array(z.object({
    id, systemKey: id, name: z.string().max(500), values: record,
    resourceIds: z.array(id).max(10000), createdAt: date, updatedAt: date,
    revision: z.number().int().nonnegative(),
    overrides: z.record(z.string(), z.object({
      values: z.record(z.string(), z.object({ aggregation: z.enum(['set','sum','max','min','none']), value: z.unknown() })).optional(),
      modifiers: z.record(z.string(), z.object({ aggregation: z.enum(['set','sum','max','min','none']), value: z.unknown() })).optional()
    })).optional()
  })).max(10000),
  resources: z.array(z.object({
    id, systemKey: id, definitionId: id, name: z.string().max(500), values: record, createdAt: date.optional(),
    sourceId: id.optional(), catalogGroup: id.optional(),
    catalogIssue: z.string().max(100000).optional(),
    overrides: record.optional(),
    catalogSource: z.object({ original: z.string(), source: z.string().max(2000), digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict().optional()
  })).max(10000),
  combats: z.array(z.object({
    id, systemKey: id, name: z.string().min(1).max(100), difficulty: id.nullable(),
    status: z.enum(['preparing', 'active', 'finished']), round: z.number().int().min(0).max(100000),
    pass: z.number().int().min(1).max(10000), turn: z.number().int().min(0).max(99),
    revision: z.number().int().nonnegative(), createdAt: date, updatedAt: date,
    combatants: z.array(z.object({
      id, typeId: id, characterId: id.optional(), resourceId: id.optional(), templateId: id.optional(),
      values: record, overrides: record, initiative: z.number().int().min(-1000000000).max(1000000000).nullable(),
      tieBreakers: z.array(z.number().finite().nullable()).max(20), createdAt: date
    })).max(100)
  })).max(1000).default([]),
  rolls: z.array(z.object({
    id, systemKey: id, characterId: id.optional(), formula: z.string().max(100),
    results: z.array(z.number().int().min(1).max(1000000)).min(1).max(100),
    total: z.number().finite(), createdAt: date
  })).max(1000),
  preferences: z.array(z.object({
    id: z.literal('app'), theme: z.enum(['light', 'dark']),
    historyLimit: z.number().int().min(1).max(1000)
  })).max(1)
});
/** Export a v4 snapshot including reversible character overrides in one read transaction. */
export async function exportBackup(database = db) {
  const text = await database.transaction('r', [database.systems, database.characters, database.resources, database.rolls, database.preferences, database.combats], async () => JSON.stringify({
    format: 'polysheet-backup', version: 4, exportedAt: new Date().toISOString(),
    systems: (await database.systems.toArray()).map(({ key, original, artifact, source, digest, importedAt }) => ({ key, original, artifact, source, digest, importedAt })),
    characters: await database.characters.toArray(),
    resources: await database.resources.toArray(), rolls: await database.rolls.toArray(),
    preferences: await database.preferences.toArray(), combats: await database.combats.toArray()
  // Compact output: indentation roughly doubled size and hit the 32 MiB restore bound.
  }));
  // Do not produce a backup that this version cannot read back.
  schema.parse(boundedJson(text, 32 * 1024 * 1024));
  return text;
}
/**
 * Validate schema, source hashes, unique keys, values and cross-table references.
 * @returns A preview safe to show before asking the user to replace their archive.
 * @throws Before any mutation if even one supplied record is invalid.
 */
export async function validateBackup(text: string) {
  const parsed = schema.safeParse(boundedJson(text, 32 * 1024 * 1024));
  if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 10).map(i => `$.${i.path.join('.')}: ${i.message}`).join('\n'));
  const data = parsed.data;
  if (data.version < 3 && data.combats.length) throw new Error('I combattimenti richiedono un backup v3.');
  for (const [name, entries] of Object.entries({ systems: data.systems.map(s => s.key), characters: data.characters.map(c => c.id), resources: data.resources.map(r => r.id), rolls: data.rolls.map(r => r.id), combats: data.combats.map(c => c.id) }))
    if (new Set(entries).size !== entries.length) throw new Error(`${name}: ID duplicati nel backup`);
  const systems = [];
  // Sequential decompression bounds peak memory when restoring many packages.
  for (const s of data.systems) {
    if (s.artifact && data.version === 1) throw new Error('Un backup v1 non può contenere originali .rpg.');
    const prepared = s.artifact ? await prepareImport(artifactBytes(s.artifact.base64), s.source) : await prepareSystem(s.original, s.source);
    if (s.key !== prepared.key || s.digest !== prepared.digest || s.original !== prepared.original ||
        Boolean(s.artifact) !== Boolean(prepared.artifact) || prepared.diagnostics.some(d => d.severity === 'error'))
      throw new Error(`Sistema alterato o non valido: ${s.key}`);
    systems.push({ ...prepared, importedAt: s.importedAt });
  }
  const byKey = new Map(systems.map(s => [s.key, s]));
  for (const resource of data.resources) {
    if (resource.catalogGroup && !data.resources.some(r => r.id === resource.catalogGroup && r.systemKey === resource.systemKey && r.catalogGroup === r.id))
      throw new Error('Gruppo catalogo mancante o non valido.');
    if (resource.catalogSource) {
      const system = byKey.get(resource.systemKey);
      if (!system || resource.catalogGroup !== resource.id || await catalogDigest(resource.catalogSource.original) !== resource.catalogSource.digest)
        throw new Error('Originale catalogo alterato.');
      const preview = await prepareCatalogTemplate(resource.catalogSource.original, resource.catalogSource.source, system);
      if (preview.resources[0].definitionId !== resource.definitionId || preview.resources[0].sourceId !== resource.sourceId
        || preview.resources[0].name !== resource.name || Object.keys(resource.values).length
        || data.resources.some(r => r.id !== resource.id && r.catalogGroup === resource.id))
        throw new Error('Identità catalogo non valida.');
      resource.catalogIssue = preview.resources[0].catalogIssue;
    }
    if (resource.catalogIssue && !resource.catalogSource) throw new Error('Diagnostica catalogo senza originale.');
  }
  for (const entry of [...data.characters, ...data.resources]) {
    const system = byKey.get(entry.systemKey);
    if (!system) throw new Error(`Sistema mancante: ${entry.systemKey}`);
    const stats = 'definitionId' in entry ? system.definition.resources.find(r => r.id === entry.definitionId)?.stats : system.definition.character_stats;
    if (!stats) throw new Error('Definizione risorsa mancante');
    for (const [key, value] of Object.entries(entry.values)) {
      const stat = stats.find(s => s.id === key);
      if (!stat || stat.type !== 'base') throw new Error(`Valore sconosciuto o calcolato nel backup: ${key}`);
      if (['string', 'integer', 'decimal', 'bool', 'array', 'resource', 'photo'].includes(stat.value_type) && !matchesType(value, stat.value_type, stat.sub_value_type))
        throw new Error(`${entry.id}.${key}: tipo non valido`);
    }
    if ('definitionId' in entry && entry.overrides) {
      // Resource instances keep one flat layer of calculated-stat values set by their own mechanics.
      for (const [statId, value] of Object.entries(entry.overrides)) {
        const stat = stats.find(s => s.id === statId);
        if (!stat || stat.type !== 'calculated' || !matchesType(value, stat.value_type, stat.sub_value_type))
          throw new Error(`Valore override non valido per ${statId}`);
      }
    } else if ('overrides' in entry && entry.overrides) {
      const stats = system.definition.character_stats;
      for (const [_mechanicId, layers] of Object.entries((entry as Character).overrides!)) {
        if (!layers || typeof layers !== 'object') throw new Error('Struttura override non valida');
        for (const layer of ['values', 'modifiers'] as const) {
          if (layers[layer]) {
            for (const [statId, item] of Object.entries(layers[layer])) {
              if (!stats.find(s => s.id === statId)) throw new Error(`Override per statistica sconosciuta: ${statId}`);
              if (!['set','sum','max','min','none'].includes(item.aggregation as string)) throw new Error(`Aggregazione non valida: ${item.aggregation}`);
              if (item.value == null || (['integer','decimal'].includes(stats.find(s => s.id === statId)?.value_type ?? '') && typeof item.value !== 'number'))
                throw new Error(`Valore override non valido per ${statId}`);
            }
          }
        }
      }
    }
    checkReferences(stats, entry.values, data.resources as ResourceInstance[], entry.systemKey);
  }
  for (const c of data.characters)
    for (const id of c.resourceIds)
      if (!data.resources.some(r => r.id === id && r.systemKey === c.systemKey)) throw new Error(`Risorsa assegnata mancante: ${id}`);
  for (const r of data.rolls) {
    if (!byKey.has(r.systemKey)) throw new Error('Sistema del tiro mancante');
    if (r.characterId && !data.characters.some(c => c.id === r.characterId && c.systemKey === r.systemKey)) throw new Error('Personaggio del tiro mancante');
  }
  for (const combat of data.combats) {
    const system = byKey.get(combat.systemKey);
    const definition = system?.definition.combat_system;
    if (!definition || new Set(combat.combatants.map(f => f.id)).size !== combat.combatants.length) throw new Error('Combattimento non valido o ID duplicati.');
    if (combat.difficulty !== null && !definition.difficulty_levels?.some(d => d.id === combat.difficulty)) throw new Error('Difficoltà incontro non valida.');
    if ((combat.status === 'active' && (!combat.round || !combat.combatants.length)) || combat.turn >= Math.max(1, combat.combatants.length)) throw new Error('Turno o stato incontro non valido.');
    if (combat.status === 'active' && (initiativeOrder(combat).unresolved
      || combat.turn >= Math.max(1, eligibleCombatants(system!, combat).length)
      || !eligibleCombatants(system!, combat).length
      || (!definition.initiative_system.has_turns && combat.turn !== 0)))
      throw new Error('Iniziativa o turno attivo non valido.');
    const linkedCharacters = combat.combatants.flatMap(f => f.characterId ? [f.characterId] : []);
    if (new Set(linkedCharacters).size !== linkedCharacters.length) throw new Error('Personaggio duplicato nell’incontro.');
    for (const f of combat.combatants) {
      const type = definition.combatant_types.find(t => t.id === f.typeId);
      if (!type) throw new Error('Tipo combattente mancante.');
      if (type.template_resource_id === 'character') {
        if (!f.characterId || type.instance_resource_id || f.resourceId || f.templateId || Object.keys(f.overrides).length || Object.keys(f.values).length
          || !data.characters.some(c => c.id === f.characterId && c.systemKey === combat.systemKey)) throw new Error('Personaggio combattente non valido.');
      } else {
        if (f.characterId) throw new Error('Sorgente combattente non valida.');
        if ((type.instance_resource_id && f.resourceId) || (!type.instance_resource_id && f.templateId))
          throw new Error('Sorgente e istanza combattente incoerenti.');
        if (type.template_resource_id) {
          const sourceId = type.instance_resource_id ? f.templateId : f.resourceId;
          if (!sourceId || !data.resources.some(r => r.id === sourceId && !r.catalogSource && r.systemKey === combat.systemKey && r.definitionId === type.template_resource_id))
            throw new Error('Risorsa combattente mancante.');
        } else if (f.resourceId || f.templateId) throw new Error('Sorgente inattesa nel combattente.');
        const stats = system!.definition.resources.find(r => r.id === type.instance_resource_id)?.stats ?? [];
        if (!type.instance_resource_id && (Object.keys(f.values).length || Object.keys(f.overrides).length)) throw new Error('Valori istanza inattesi.');
        for (const [key, value] of Object.entries(f.values)) {
          const stat = stats.find(s => s.id === key && s.type === 'base');
          if (!stat || !matchesType(value, stat.value_type, stat.sub_value_type)) throw new Error('Valore base combattente non valido.');
        }
        for (const [key, value] of Object.entries(f.overrides)) {
          const stat = stats.find(s => s.id === key);
          function initializedBy(effect: unknown): boolean {
            if (!effect || typeof effect !== 'object') return false;
            const node = object(effect);
            return (node.type === 'setStat' && node.aggregation_type === 'set' && node.stat === key)
              || (node.type === 'sequence' && Array.isArray(node.effects) && node.effects.some(initializedBy));
          }
          if (!stat || !initializedBy(type.on_create) || !matchesType(value, stat.value_type, stat.sub_value_type)) throw new Error('Override combattente non valido.');
        }
        checkReferences(stats, { ...f.values, ...f.overrides }, data.resources as ResourceInstance[], combat.systemKey);
      }
    }
  }
  return { ...data, systems };
}
export type ValidBackup = Awaited<ReturnType<typeof validateBackup>>;
/** Revalidate, then replace every table in one rollback-safe IndexedDB transaction. */
export async function restoreBackup(backupText: string, database: SheetDatabase = db) {
  const data = await validateBackup(backupText);
  // Validation completes before the destructive transaction; failures roll back all tables.
  await database.transaction('rw', [database.systems, database.characters, database.resources, database.rolls, database.preferences, database.combats], async () => {
    await Promise.all([database.systems.clear(), database.characters.clear(), database.resources.clear(), database.rolls.clear(), database.preferences.clear(), database.combats.clear()]);
    await database.systems.bulkAdd(data.systems);
    await database.characters.bulkAdd(data.characters as Parameters<typeof database.characters.bulkAdd>[0]);
    await database.resources.bulkAdd(data.resources as Parameters<typeof database.resources.bulkAdd>[0]);
    await database.rolls.bulkAdd(data.rolls);
    await database.preferences.bulkAdd(data.preferences);
    await database.combats.bulkAdd(data.combats as Combat[]);
  });
}
