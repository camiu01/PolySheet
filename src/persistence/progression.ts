/** @file Atomic, source-derived manual advancement; no general persistent-effect dispatcher. */
import { type ProgressionRequest, abilityIncreaseOptions, hitPointModes, levelChoiceCommit, planProgression, progressionClasses, progressionEvaluator, progressionSnapshot, progressionSummary } from '../engine/progression';
import { runCreationHook } from '../engine/creation-hooks';
import { isResourceReference } from '../domain/model';
import { db, initialValues, setCharacterValue } from './db';
import { type ResourceInstance } from '../domain/model';
import { prepareAssignment, assignPrepared, assignCatalog } from './catalog';
import { saveResource } from './resources';
import { it } from '../ui/it';

/** Materialize a selection preview locally; never write clones or advance during selection. */
export async function previewNewClass(characterId: string, classId: string, database = db) {
  const prepared = await prepareAssignment(classId, database);
  const character = await database.characters.get(characterId);
  if (!character || character.systemKey !== prepared.system.key || !Array.isArray(character.values.classes))
    throw new Error(it.progressionUnsupported);
  const definition = prepared.system.definition.resources.find(definition => definition.id === 'class_details');
  if (!definition) throw new Error(it.progressionUnsupported);
  const rootId = prepared.materialized?.rootId ?? prepared.template.id;
  const wrapper: ResourceInstance = { id: crypto.randomUUID(), systemKey: character.systemKey,
    definitionId: definition.id, name: prepared.template.name,
    values: { ...initialValues(definition.stats), class: { resourceId: rootId } } };
  const records = await database.resources.where('systemKey').equals(character.systemKey).toArray();
  return { character: { ...character, values: { ...character.values, classes: [...character.values.classes, { resourceId: wrapper.id }] } },
    resources: [...records, ...(prepared.materialized?.resources ?? []), wrapper], wrapperId: wrapper.id };
}

/** Reject stale/repeated commands, validate latest graph, and commit level/HP changes together.
 * @remarks Preparing a multiclass graph happens before the write transaction; source pins and
 * snapshots are rechecked by assignPrepared. Failures roll back every private clone and patch.
 */
export async function advanceCharacter(characterId: string, expectedRevision: number,
  request: ProgressionRequest & { newClassId?: string; manualPrerequisites?: boolean }, database = db,
  random?: (faces: number) => number) {
  const prepared = request.newClassId ? await prepareAssignment(request.newClassId, database) : undefined;
  return database.transaction('rw', database.characters, database.systems, database.resources, async () => {
    let character = await database.characters.get(characterId);
    const system = character && await database.systems.get(character.systemKey);
    if (!character || !system || character.revision !== expectedRevision) throw new Error(it.progressionStale);
    let resources = await database.resources.where('systemKey').equals(system.key).toArray();
    if (request.hitPointMode !== undefined && request.hitPointMode !== character.values.hit_point_mode) {
      if (!hitPointModes(system).some(mode => mode.id === request.hitPointMode)) throw new Error(it.progressionUnsupported);
      await setCharacterValue(characterId, 'hit_point_mode', request.hitPointMode, database);
      character = (await database.characters.get(characterId))!;
    }
    const before = progressionClasses(system, character, resources);
    const snapshot = progressionSnapshot(system, character, resources, prepared ? undefined : request.wrapperId);
    const level = progressionEvaluator(system, character, resources).get('level');
    if (typeof level !== 'number' || level < 1) throw new Error(it.progressionUnsupported);
    let wrapperId = request.wrapperId;
    if (prepared) {
      if (!request.manualPrerequisites || prepared.template.definitionId !== 'class') throw new Error(it.progressionManualRequired);
      await assignPrepared(character.id, 'classes', prepared, database);
      character = (await database.characters.get(characterId))!;
      resources = await database.resources.where('systemKey').equals(system.key).toArray();
      const choices = progressionClasses(system, character, resources);
      const added = choices.find(choice => !before.some(previous => previous.record.id === choice.record.id));
      if (!added || added.level !== 1 || before.some(previous => previous.name === added.name || previous.id === added.id))
        throw new Error(it.progressionDuplicate);
      wrapperId = added.record.id;
    }
    const plan = planProgression(system, character, resources, { ...request, wrapperId }, !!prepared, random);
    const otherUsers = await database.characters.where('systemKey').equals(system.key).toArray();
    if (otherUsers.some(owner => owner.id !== characterId && Array.isArray(owner.values.classes)
      && owner.values.classes.some(value => value && typeof value === 'object' && !Array.isArray(value) && value.resourceId === wrapperId)))
      throw new Error(it.progressionShared);
    await saveResource(plan.wrapper, database);
    if (plan.values.base_hp !== character.values.base_hp) await setCharacterValue(characterId, 'base_hp', plan.values.base_hp, database);
    await setCharacterValue(characterId, 'temp_last_level_up_class_id', plan.values.temp_last_level_up_class_id, database);
    const saved = (await database.characters.get(characterId))!;
    const after = progressionSnapshot(system, saved, await database.resources.where('systemKey').equals(system.key).toArray(), wrapperId);
    return { level: plan.level, maxHp: plan.maxHp, baseHpGain: plan.baseHpGain, summary: progressionSummary(snapshot, after) };
  });
}

/**
 * Apply the level choices assigned on the grants (ability boosts, skill increases, feat slots)
 * with the source's own commit program, atomically.
 * @remarks The owned grant records are staged under their own ids, so the hook's `$grant.stat`
 * writes land on them; skipped effects abort the whole command rather than half-applying it.
 */
export async function applyLevelChoices(characterId: string, database = db) {
  return database.transaction('rw', database.characters, database.systems, database.resources, async () => {
    const character = await database.characters.get(characterId);
    const system = character && await database.systems.get(character.systemKey);
    const effect = system && levelChoiceCommit(system);
    if (!character || !system || !effect) throw new Error(it.progressionUnsupported);
    const resources = await database.resources.where('systemKey').equals(system.key).toArray();
    const grants = progressionEvaluator(system, character, resources).get('all_interactive_progression_grants_for_current_level');
    if (!Array.isArray(grants) || !grants.every(isResourceReference)) throw new Error(it.progressionUnsupported);
    const ids = new Set(grants.map(grant => grant.resourceId));
    const staged = resources.filter(record => ids.has(record.id) && !record.catalogSource);
    if (staged.length !== ids.size) throw new Error(it.progressionUnsupported);
    const draft = runCreationHook(effect, system.definition, { values: { ...character.values }, staged, skipped: [] },
      resources.filter(record => !ids.has(record.id)), system.definition.enumerated_types);
    if (draft.skipped.length) throw new Error(`${it.progressionUnsupported} (${[...new Set(draft.skipped)].join(', ')})`);
    const changed = Object.keys(draft.values).filter(key => JSON.stringify(draft.values[key]) !== JSON.stringify(character.values[key]));
    for (const key of changed) await setCharacterValue(characterId, key, draft.values[key], database);
    for (const record of draft.staged) {
      const before = resources.find(item => item.id === record.id);
      if (JSON.stringify(before?.values) !== JSON.stringify(record.values)) await saveResource(record, database);
    }
    return changed.length;
  });
}

/**
 * Apply one source ability score improvement, as 5e `level_up_asi` does: +1 to each of two
 * abilities (the same one twice is +2), or the chosen feat added to `feats`. Like the rest of the
 * assistant it edits base values permanently, not mechanic overrides.
 */
export async function applyAbilityIncrease(characterId: string, choice: { abilities: [string, string] } | { featId: string }, database = db) {
  if ('featId' in choice) return assignCatalog(characterId, choice.featId, 'feats', database);
  return database.transaction('rw', database.characters, database.systems, database.resources, async () => {
    const character = await database.characters.get(characterId);
    const system = character && await database.systems.get(character.systemKey);
    const options = system ? abilityIncreaseOptions(system) : [];
    if (!character || !choice.abilities.every(id => options.some(option => option.id === id))) throw new Error(it.progressionUnsupported);
    const scores = { ...character.values };
    for (const id of choice.abilities) {
      const current = scores[`${id}_score`];
      if (typeof current !== 'number' || !Number.isSafeInteger(current)) throw new Error(it.progressionUnsupported);
      scores[`${id}_score`] = current + 1;
    }
    for (const id of new Set(choice.abilities)) await setCharacterValue(characterId, `${id}_score`, scores[`${id}_score`], database);
  });
}
