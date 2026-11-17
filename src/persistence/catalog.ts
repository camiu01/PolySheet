/** @file Atomic catalog storage, private character graphs and dependent subrace selection. */
import { isResourceReference, jsonValue, type ResourceInstance, type StoredSystem, type SystemDefinition } from '../domain/model';
import { checkReferences, referencedIds } from '../domain/references';
import { prepareCatalog, prepareCatalogTemplate, MAX_REPOSITORY_CATALOG_BYTES, MAX_REPOSITORY_CATALOG_FILES, type CatalogPreview } from '../importing/catalog';
import { prepareImport, artifactBytes } from '../importing/package';
import { prepareSystem } from '../importing/system';
import { db, createCharacter, initialValues, installSystem, setCharacterValue } from './db';
import { exportBackup } from './backup';
import { it } from '../ui/it';
import { subraceFields, subraceOptions } from '../engine/character-origins';
import { initialHealth } from '../engine/initial-health';
import { commitCharacterView } from './views';

/** Discover class-wrapper and singular origin/background fields from source types. */
export function catalogFields(system: SystemDefinition) {
  const classes = system.character_stats.find(s => s.type === 'base' && s.value_type === 'array' && s.sub_value_type === 'resource'
    && system.resources.some(d => d.id === s.resource_type && d.stats.some(f => f.id === 'class' && f.type === 'base' && f.resource_type === 'class')
      && d.stats.some(f => f.id === 'class_level' && f.type === 'base' && f.value_type === 'integer')));
  const singular = system.character_stats.filter(s => s.type === 'base' && s.value_type === 'resource'
    && ['race', 'ancestry', 'heritage', 'background'].includes(s.resource_type ?? ''));
  return { classes, singular };
}
async function reparse(previews: CatalogPreview[], system: StoredSystem, maxBytes: number, maxFiles: number) {
  if (previews.length > maxFiles || previews.some(p => p.systemKey !== system.key)) throw new Error(it.catalogLimit);
  const prepared: CatalogPreview[] = [];
  let bytes = 0;
  for (const preview of previews) {
    const source = preview.resources.find(r => r.id === preview.rootId)?.catalogSource;
    if (!source || (bytes += new TextEncoder().encode(source.original).length) > maxBytes) throw new Error(it.catalogLimit);
    prepared.push(await prepareCatalogTemplate(source.original, source.source, system));
  }
  return prepared;
}
async function addTemplates(previews: CatalogPreview[], database: typeof db) {
  const existing = await database.resources.toArray(), roots: string[] = [];
  for (const preview of previews) {
    const root = preview.resources[0];
    const previous = existing.find(r => r.systemKey === root.systemKey && r.catalogSource?.digest === root.catalogSource!.digest);
    if (previous) {
      if (previous.catalogIssue !== root.catalogIssue) {
        await database.resources.update(previous.id, { catalogIssue: root.catalogIssue });
        previous.catalogIssue = root.catalogIssue;
      }
      roots.push(previous.id); continue;
    }
    if (existing.length >= 10000) throw new Error(it.resourceListLimit);
    await database.resources.add(root);
    existing.push(root); roots.push(root.id);
  }
  return roots;
}
/**
 * Refresh cached blockers after parser support changes, including offline startup.
 * @remarks Only diagnostics change, never source bytes, identities or private data.
 * Recheck the exact record and system inside the write transaction to avoid races.
 */
export async function refreshCatalogIssues(database = db) {
  const templates = (await database.resources.toArray()).filter(r => r.catalogSource && r.catalogIssue);
  for (const template of templates) {
    const system = await database.systems.get(template.systemKey), source = template.catalogSource!;
    if (!system) continue;
    const preview = await prepareCatalogTemplate(source.original, source.source, system);
    const issue = preview.resources[0].catalogIssue;
    if (issue === template.catalogIssue) continue;
    await database.transaction('rw', database.resources, database.systems, async () => {
      const latest = await database.resources.get(template.id);
      if (!await database.systems.get(system.key) || JSON.stringify(latest) !== JSON.stringify(template)) return;
      await database.resources.update(template.id, { catalogIssue: issue });
    });
  }
}
/** Reparse exact originals at the write boundary; duplicate imports never overwrite edits. */
export async function installCatalogs(previews: CatalogPreview[], database = db) {
  if (!previews.length) throw new Error(it.catalogFormat);
  const system = await database.systems.get(previews[0].systemKey);
  if (!system) throw new Error(it.missingResource);
  const prepared = await reparse(previews, system, 8 * 1024 * 1024, 100);
  return database.transaction('rw', database.tables, async () => {
    if (!await database.systems.get(system.key)) throw new Error(it.noSystemSelected);
    const roots = await addTemplates(prepared, database);
    await exportBackup(database);
    return roots;
  });
}
/** Install system and all reviewed templates atomically, retaining every existing character pin. */
export async function installRepositoryBundle(input: StoredSystem, previews: CatalogPreview[], database = db) {
  const system = input.artifact ? await prepareImport(artifactBytes(input.artifact.base64), input.source) : await prepareSystem(input.original, input.source);
  if (system.key !== input.key) throw new Error(it.repositoryInvalid);
  const prepared = await reparse(previews, system, MAX_REPOSITORY_CATALOG_BYTES, MAX_REPOSITORY_CATALOG_FILES);
  return database.transaction('rw', database.tables, async () => {
    await installSystem(system, database);
    const roots = await addTemplates(prepared, database);
    // Refuse an import that would make the bounded backup unreadable.
    await exportBackup(database);
    return roots;
  });
}
/**
 * Materialize a private graph before assignment; never mutate catalog originals.
 * @remarks No effects or progression run. Shared/cyclic local references use one copy.
 */
export async function assignCatalog(characterId: string, resourceId: string, fieldId: string, database = db) {
  return assignPrepared(characterId, fieldId, await prepareAssignment(resourceId, database), database);
}
/** Parse outside write transactions; the writer rechecks the exact template snapshot. */
export async function prepareAssignment(resourceId: string, database: typeof db) {
  const template = await database.resources.get(resourceId);
  const system = template && await database.systems.get(template.systemKey);
  if (!template || !system || (!template.catalogSource && template.catalogIssue)) throw new Error(template?.catalogIssue ?? it.missingResource);
  const materialized = template.catalogSource
    ? await prepareCatalog(template.catalogSource.original, template.catalogSource.source, system) : undefined;
  return { template, system, materialized };
}
/**
 * Copy one template graph into fresh private instances, remapping internal references.
 * @returns The new root id and every copied instance; shared/cyclic children are copied once.
 */
export function privateGraph(system: StoredSystem, sourceRoot: string, existing: ResourceInstance[]) {
  const byId = new Map(existing.map(r => [r.id, r])), ids = new Map<string, string>();
  const queue = [sourceRoot], queued = new Set(queue), additions: ResourceInstance[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (ids.has(id)) continue;
    const source = byId.get(id), definition = system.definition.resources.find(d => d.id === source?.definitionId);
    if (!source || !definition || ids.size >= 10000) throw new Error(it.missingResource);
    checkReferences(definition.stats, source.values, existing, system.key);
    ids.set(id, crypto.randomUUID());
    for (const stat of definition.stats) for (const child of referencedIds(stat, source.values[stat.id])) {
      if (!queued.has(child)) { queued.add(child); queue.push(child); }
    }
  }
  const rootId = ids.get(sourceRoot)!;
  for (const [id, localId] of ids) {
    const source = byId.get(id)!, definition = system.definition.resources.find(d => d.id === source.definitionId)!;
    const values = jsonValue(source.values) as ResourceInstance['values'];
    for (const stat of definition.stats) {
      const value = values[stat.id];
      if (stat.value_type === 'resource' && isResourceReference(value)) values[stat.id] = { resourceId: ids.get(value.resourceId)! };
      else if (stat.value_type === 'array' && stat.sub_value_type === 'resource' && Array.isArray(value))
        values[stat.id] = value.map(v => isResourceReference(v) ? { resourceId: ids.get(v.resourceId)! } : v);
    }
    additions.push({ id: localId, systemKey: system.key, definitionId: source.definitionId, name: source.name,
      values, createdAt: new Date().toISOString(), catalogGroup: rootId,
      ...(source.sourceId ? { sourceId: source.sourceId } : {}) });
  }
  return { rootId, additions };
}
/** Stage a catalog or local template as a private graph for a draft; nothing is written. */
export async function stageTemplate(resourceId: string, database = db) {
  const { system, materialized } = await prepareAssignment(resourceId, database);
  const existing = materialized?.resources ?? await database.resources.where('systemKey').equals(system.key).toArray();
  return privateGraph(system, materialized?.rootId ?? resourceId, existing);
}
/** Assign only a locally prepared, unchanged graph inside the owner's transaction. */
export async function assignPrepared(characterId: string, fieldId: string, prepared: Awaited<ReturnType<typeof prepareAssignment>>, database: typeof db) {
  const { template, system, materialized } = prepared;
  const resourceId = template.id;
  await database.transaction('rw', database.characters, database.resources, database.systems, async () => {
    const character = await database.characters.get(characterId), latest = await database.resources.get(resourceId);
    if (!character || !latest || latest.systemKey !== character.systemKey || latest.systemKey !== system.key
      || JSON.stringify(latest) !== JSON.stringify(template)) throw new Error(it.missingResource);
    const fields = catalogFields(system.definition);
    const isClass = fields.classes?.id === fieldId;
    const field = isClass ? fields.classes : fields.singular.find(s => s.id === fieldId && s.resource_type === template.definitionId);
    if (!field || (isClass && template.definitionId !== 'class')) throw new Error(it.missingResource);
    const existing = materialized?.resources ?? await database.resources.where('systemKey').equals(system.key).toArray();
    const { rootId, additions } = privateGraph(system, materialized?.rootId ?? resourceId, existing);
    let value: unknown = { resourceId: rootId };
    if (isClass) {
      const definition = system.definition.resources.find(d => d.id === field.resource_type)!;
      const wrapper: ResourceInstance = {
        id: crypto.randomUUID(), systemKey: system.key, definitionId: definition.id,
        name: `${template.name} · ${character.name}`.slice(0, 100),
        values: { ...initialValues(definition.stats), class: { resourceId: rootId } }, createdAt: new Date().toISOString()
      };
      additions.push(wrapper);
      const current = character.values[fieldId];
      if (!Array.isArray(current)) throw new Error(it.invalidValue);
      value = [...current, { resourceId: wrapper.id }];
    }
    if (await database.resources.count() + additions.length > 10000) throw new Error(it.resourceListLimit);
    await database.resources.bulkAdd(additions);
    await setCharacterValue(characterId, fieldId, value, database);
    const subrace = subraceFields(system.definition);
    if (subrace?.race.id === fieldId) await setCharacterValue(characterId, subrace.selection.id, null, database);
  });
}
/** Create/configure with staged inventory atomically; health is explicit, not lifecycle dispatch. */
export async function configureCharacter(system: StoredSystem, name: string, values: Record<string, unknown>,
  selections: Record<string, string>, characterId?: string, database = db, initializeHealth = false,
  additions: ResourceInstance[] = []) {
  if (initializeHealth && characterId) throw new Error(it.setupAutoHpNewOnly);
  const prepared = await Promise.all(Object.entries(selections).filter(([, id]) => id)
    .map(async ([field, id]) => ({ field, prepared: await prepareAssignment(id, database) })));
  return database.transaction('rw', database.characters, database.resources, database.systems, async () => {
    const character = characterId ? await database.characters.get(characterId) : await createCharacter(system, name, database);
    if (!character || character.systemKey !== system.key || !await database.systems.get(system.key)) throw new Error(it.missingResource);
    for (const choice of prepared) await assignPrepared(character.id, choice.field, choice.prepared, database);
    await commitCharacterView(character.id, values, additions, database);
    if (initializeHealth) {
      const latest = (await database.characters.get(character.id))!;
      const resources = await database.resources.where('systemKey').equals(system.key).toArray();
      for (const [id, value] of Object.entries(initialHealth(system, latest, resources)))
        await setCharacterValue(character.id, id, value, database);
    }
    return (await database.characters.get(character.id))!;
  });
}
/** Save a subrace against the latest race; stale UI cannot assign another race's child. */
export async function setCharacterSubrace(characterId: string, expectedRaceId: string, value: string | null, database = db) {
  await database.transaction('rw', database.characters, database.resources, database.systems, async () => {
    const character = await database.characters.get(characterId);
    const system = character && await database.systems.get(character.systemKey);
    const fields = system && subraceFields(system.definition);
    const race = fields && character?.values[fields.race.id];
    if (!character || !system || !fields || !isResourceReference(race) || race.resourceId !== expectedRaceId)
      throw new Error(it.subraceChanged);
    const resources = await database.resources.where('systemKey').equals(system.key).toArray();
    if (value !== null && !subraceOptions(system.definition, character, resources).some(s => s.id === value))
      throw new Error(it.subraceChanged);
    await setCharacterValue(characterId, fields.selection.id, value, database);
  });
}
/** Unlink one class against the latest character; retain records and other edits. */
export async function removeCharacterClass(characterId: string, wrapperId: string, database = db) {
  await database.transaction('rw', database.characters, database.systems, database.resources, async () => {
    const character = await database.characters.get(characterId);
    const system = character && await database.systems.get(character.systemKey);
    const field = system && catalogFields(system.definition).classes;
    if (!character || !field) throw new Error(it.missingResource);
    const ids = referencedIds(field, character.values[field.id]);
    await setCharacterValue(characterId, field.id, ids.filter(id => id !== wrapperId).map(resourceId => ({ resourceId })), database);
  });
}
