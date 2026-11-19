// @vitest-environment node
/** @file Real-source progression, repeat/stale protection and atomic private multiclass graphs. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { installSystem, SheetDatabase } from '../src/persistence/db';
import { advanceCharacter, applyAbilityIncrease, applyLevelChoices } from '../src/persistence/progression';
import { abilityIncreaseLevels, abilityIncreaseOptions, hitPointModes, levelChoiceCommit, pendingLevelChoices, progressionClasses, progressionEvaluator, progressionArchetypes, progressionContract, progressionPreview } from '../src/engine/progression';
import { catalogSystem } from './fixtures/catalog';

it('recognizes imported advancement branches and ceiling without a bundled game fixture', async () => {
  const hp = { type: 'when', clauses: ['roll', 'average', 'max'].map(mode => ({
    condition: { type: 'constant', value: mode, value_type: 'string' },
    effect: { type: 'addToStat', stat: 'base_hp', aggregation_type: 'set', value: { type: 'constant', value: 3, value_type: 'integer' } }
  })) };
  const increment = { type: 'constant', value: 1, value_type: 'integer' };
  const source = await prepareSystem(JSON.stringify({ ...catalogSystem, progression_systems: { experience_levelling_system: {
    level_stat_name: 'level', tables: [{ experience_to_level_table: { 0: 1, 100: 7 } }],
    on_level_up_confirm: { type: 'sequence', effects: [{}, {}, { type: 'when', clauses: [
      { effect: { type: 'sequence', effects: [
        { type: 'addToStat', stat: '$class_details.class_level', value: increment, aggregation_type: 'set' }, hp
      ] } }, { effect: hp }
    ] }] }
  } } }), 'Original contract fixture');
  expect(progressionContract(source)).toMatchObject({ maxLevel: 7, increment });
  expect(() => progressionContract({ ...source, definition: { ...source.definition, progression_systems: {} } })).toThrow();
});

const fixture = '.reference/official-releases-2026-11-16/5e-system.rpg';
it.skipIf(!existsSync(fixture))('advances imported Fighter repeatedly, preserves HP and originals, rejects stale/duplicate multiclass and rolls back', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync(fixture)).toString('utf8'), 'Local progression fixture');
  const database = new SheetDatabase(`progression-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    const ids: string[] = [];
    for (const name of ['fighter', 'wizard']) {
      const original = readFileSync(`.reference/rpg-companion-app-systems/systems/5e/resource_instances/class_${name}_${name}.rpg.json`, 'utf8');
      const [id] = await installCatalogs([await prepareCatalogTemplate(original, 'local.json', system)], database);
      ids.push(id);
    }
    let character = await configureCharacter(system, 'Progression', { constitution_score: 14, hit_point_mode: 'average' },
      { classes: ids[0] }, undefined, database, true);
    let resources = await database.resources.toArray();
    const originals = resources.filter(record => record.catalogSource);
    const wrapper = progressionClasses(system, character, resources)[0];
    const request = { wrapperId: wrapper.record.id, expectedClassLevel: 1, targetLevel: 2, archetypeId: null, acknowledgeChoices: true };
    expect(progressionPreview(system, character, resources, wrapper.record.id, 2).features).toEqual(['Action Surge']);
    expect(hitPointModes(system).map(mode => mode.id)).toEqual(['roll', 'average', 'max']);
    const advanced = await advanceCharacter(character.id, character.revision, request, database);
    expect(advanced).toMatchObject({ level: 2, maxHp: 20, baseHpGain: 6 });
    expect(advanced.summary.features).toEqual(['Action Surge']);
    // The summary is read back from the imported formulas: max HP is reported, current HP is not restored.
    expect(advanced.summary.improved).toContainEqual({ name: 'Maximum HP', before: 12, after: 20 });
    expect(advanced.summary.improved.some(row => /current/i.test(row.name))).toBe(false);
    await expect(advanceCharacter(character.id, character.revision, request, database)).rejects.toThrow('scheda è cambiata');
    character = (await database.characters.get(character.id))!;
    expect(character.values.current_hp).toBe(12);
    resources = await database.resources.toArray();
    const classScope = progressionEvaluator(system, character, resources, { $details: { resourceId: wrapper.record.id } });
    expect(classScope.get('$details.class.level')).toBe(2);
    const featureNames = classScope.evaluate({ type: 'map', components: { type: 'stat', stat: '$details.features' },
      map_value_key: '$feature', mapper: { type: 'stat', stat: '$feature.name' } });
    expect(featureNames).toContain('Action Surge');
    const choices = progressionArchetypes(system, character, resources, wrapper.record.id, 3);
    expect(choices.required).toBe(true);
    const before = await database.resources.toArray();
    await expect(advanceCharacter(character.id, character.revision, { ...request, expectedClassLevel: 2, targetLevel: 3 }, database)).rejects.toThrow('sottoclasse');
    expect(await database.resources.toArray()).toEqual(before);
    expect((await advanceCharacter(character.id, character.revision, { ...request, expectedClassLevel: 2, targetLevel: 3,
      archetypeId: choices.options[0].id }, database)).maxHp).toBe(28);
    character = (await database.characters.get(character.id))!;
    resources = await database.resources.toArray();
    const subclassScope = progressionEvaluator(system, character, resources, { $details: { resourceId: wrapper.record.id } });
    expect(subclassScope.get('$details.class.selected_archetype.level')).toBe(3);
    expect(subclassScope.get('$details.class.selected_archetype.current_class_details.class_level')).toBe(3);
    const snapshot = await database.resources.toArray();
    await expect(advanceCharacter(character.id, character.revision, { ...request, targetLevel: 4,
      newClassId: ids[0], manualPrerequisites: true }, database)).rejects.toThrow('già livelli');
    expect(await database.resources.toArray()).toEqual(snapshot);
    await expect(advanceCharacter(character.id, character.revision, { ...request, targetLevel: 4,
      newClassId: ids[1] }, database)).rejects.toThrow('verifica manuale');
    expect((await advanceCharacter(character.id, character.revision, { ...request, targetLevel: 4,
      newClassId: ids[1], manualPrerequisites: true }, database)).maxHp).toBe(34);
    character = (await database.characters.get(character.id))!;
    resources = await database.resources.toArray();
    expect(progressionEvaluator(system, character, resources).get('level')).toBe(4);
    expect(progressionEvaluator(system, character, resources, { $details: { resourceId: wrapper.record.id } })
      .get('$details.class.level')).toBe(3);
    expect(character.values.current_hp).toBe(12);
    expect(resources.filter(record => record.catalogSource)).toEqual(originals);
    for (const [mode, expected] of [['max', 24], ['roll', 18]] as const) {
      const fresh = await configureCharacter(system, mode, { constitution_score: 14, hit_point_mode: mode },
        { classes: ids[0] }, undefined, database, true);
      const freshWrapper = progressionClasses(system, fresh, await database.resources.toArray())[0];
      let draws = 0;
      const input = { ...request, wrapperId: freshWrapper.record.id };
      await expect(advanceCharacter(fresh.id, fresh.revision, { ...input, targetLevel: 21 }, database,
        () => { draws++; return 4; })).rejects.toThrow();
      expect(draws).toBe(0);
      expect((await advanceCharacter(fresh.id, fresh.revision, input, database, () => { draws++; return 4; })).maxHp).toBe(expected);
      expect(draws).toBe(mode === 'roll' ? 1 : 0);
    }
    // Switching the method in the dialog saves it and the imported HP branch follows it (average → max: 24).
    const switched = await configureCharacter(system, 'Switch', { constitution_score: 14, hit_point_mode: 'average' },
      { classes: ids[0] }, undefined, database, true);
    const switchedWrapper = progressionClasses(system, switched, await database.resources.toArray())[0];
    await expect(advanceCharacter(switched.id, switched.revision, { ...request, wrapperId: switchedWrapper.record.id, hitPointMode: 'nope' }, database))
      .rejects.toThrow();
    expect((await advanceCharacter(switched.id, switched.revision, { ...request, wrapperId: switchedWrapper.record.id, hitPointMode: 'max' }, database)).maxHp).toBe(24);
    expect((await database.characters.get(switched.id))!.values.hit_point_mode).toBe('max');
    const high = await configureCharacter(system, 'Target ceiling', { constitution_score: 14, hit_point_mode: 'max' },
      { classes: ids[0] }, undefined, database, true);
    const highResources = await database.resources.toArray();
    const highClass = progressionClasses(system, high, highResources)[0];
    const highArchetypes = progressionArchetypes(system, high, highResources, highClass.record.id, 20);
    expect(await advanceCharacter(high.id, high.revision, { ...request, wrapperId: highClass.record.id,
      targetLevel: 20, archetypeId: highArchetypes.options[0].id }, database)).toMatchObject({ level: 20, maxHp: 240, baseHpGain: 190 });
    expect(progressionEvaluator(system, (await database.characters.get(high.id))!, await database.resources.toArray(),
      { $details: { resourceId: highClass.record.id } }).get('$details.attacks_per_action')).toBe(4);
  } finally { await database.delete(); }
}, 20000);

it.skipIf(!existsSync(fixture))('offers 5e ability score improvements at the source levels and applies +2 or a feat', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync(fixture)).toString('utf8'), 'Local ASI fixture');
  const database = new SheetDatabase(`asi-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    const read = (name: string) => readFileSync(`.reference/rpg-companion-app-systems/systems/5e/resource_instances/${name}.rpg.json`, 'utf8');
    const [fighter] = await installCatalogs([await prepareCatalogTemplate(read('class_fighter_fighter'), 'local.json', system)], database);
    const [acrobat] = await installCatalogs([await prepareCatalogTemplate(read('feat_acrobat_acrobat'), 'local.json', system)], database);
    const character = await configureCharacter(system, 'ASI', { constitution_score: 14, strength_score: 15, hit_point_mode: 'average' },
      { classes: fighter }, undefined, database, true);
    const resources = await database.resources.toArray();
    const wrapper = progressionClasses(system, character, resources)[0];
    expect(abilityIncreaseLevels(system, character, resources, wrapper.record.id, 1, 20)).toEqual([4, 6, 8, 12, 14, 16, 19]);
    expect(abilityIncreaseLevels(system, character, resources, wrapper.record.id, 1, 3)).toEqual([]);
    expect(abilityIncreaseOptions(system).map(option => option.id)).toContain('strength');
    await applyAbilityIncrease(character.id, { abilities: ['strength', 'strength'] }, database);
    expect((await database.characters.get(character.id))!.values.strength_score).toBe(17);
    await expect(applyAbilityIncrease(character.id, { abilities: ['strength', 'luck'] }, database)).rejects.toThrow();
    expect((await database.characters.get(character.id))!.values.strength_score).toBe(17);
    await applyAbilityIncrease(character.id, { featId: acrobat }, database);
    expect((await database.characters.get(character.id))!.values.feats).toHaveLength(1);
    expect(progressionEvaluator(system, (await database.characters.get(character.id))!, await database.resources.toArray()).get('strength_score')).toBe(17);
  } finally { await database.delete(); }
}, 20000);

const pf2e = '.reference/official-releases-2026-11-16/pf2e-system.rpg';
const pf2eClasses = '.reference/rpg-companion-app-systems/systems/pf2e/resource_instances';
it.skipIf(!existsSync(pf2e) || !existsSync(pf2eClasses))('advances PF2e classes to level 20 through class_progression, with HP derived from levels', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync(pf2e)).toString('utf8'), 'Local PF2e fixture');
  expect(progressionContract(system)).toMatchObject({ kind: 'class_progression', maxLevel: 20, health: [] });
  for (const [file, hp] of [['class_fighter__pc1_.rpg.json', 181], ['class_wizard__pc1_.rpg.json', 101]] as const) {
    const database = new SheetDatabase(`pf2e-progression-${crypto.randomUUID()}`);
    try {
      await installSystem(system, database);
      const [id] = await installCatalogs([await prepareCatalogTemplate(readFileSync(`${pf2eClasses}/${file}`, 'utf8'), 'local.json', system)], database);
      const character = await configureCharacter(system, file, {}, { classes: id }, undefined, database, false);
      const resources = await database.resources.toArray();
      const wrapper = progressionClasses(system, character, resources)[0];
      expect(progressionArchetypes(system, character, resources, wrapper.record.id, 20)).toMatchObject({ required: false, options: [] });
      // PF2e boosts are progression grants, not 5e ASI forms, even though it defines should_show_asi.
      expect(abilityIncreaseLevels(system, character, resources, wrapper.record.id, 1, 20)).toEqual([]);
      let draws = 0;
      const result = await advanceCharacter(character.id, character.revision, { wrapperId: wrapper.record.id, expectedClassLevel: 1,
        targetLevel: 20, archetypeId: null, acknowledgeChoices: true }, database, () => { draws++; return 1; });
      expect(result).toMatchObject({ level: 20, maxHp: hp });
      expect(draws).toBe(0);
      expect(result.summary.features.length).toBeGreaterThan(5);
      expect(result.summary.improved.some(row => /color/i.test(row.name))).toBe(false);
      const saved = (await database.characters.get(character.id))!;
      expect(saved.values.base_hp).toBe(character.values.base_hp);
    } finally { await database.delete(); }
  }
}, 120000);

it.skipIf(!existsSync(pf2e) || !existsSync(pf2eClasses))('applies PF2e level choices with the source commit program, once', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync(pf2e)).toString('utf8'), 'Local PF2e fixture');
  expect(levelChoiceCommit(system)).toBeDefined();
  const database = new SheetDatabase(`pf2e-choices-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    const [id] = await installCatalogs([await prepareCatalogTemplate(readFileSync(`${pf2eClasses}/class_fighter__pc1_.rpg.json`, 'utf8'), 'local.json', system)], database);
    const character = await configureCharacter(system, 'Choices', {}, { classes: id }, undefined, database, false);
    const wrapper = progressionClasses(system, character, await database.resources.toArray())[0];
    await advanceCharacter(character.id, character.revision, { wrapperId: wrapper.record.id, expectedClassLevel: 1, targetLevel: 5,
      archetypeId: null, acknowledgeChoices: true }, database);
    let saved = (await database.characters.get(character.id))!, resources = await database.resources.toArray();
    const pending = pendingLevelChoices(system, saved, resources);
    const boost = pending.map(ref => resources.find(record => record.id === ref.resourceId)!)
      .find(record => record.values.bucket === 'ability_boost' && record.values.level === 5);
    expect(boost).toBeDefined();
    const strength = progressionEvaluator(system, saved, resources).get('strength_score');
    await database.resources.put({ ...boost!, values: { ...boost!.values, assigned_ability_boosts: ['strength'] } });
    await applyLevelChoices(character.id, database);
    saved = (await database.characters.get(character.id))!; resources = await database.resources.toArray();
    const after = progressionEvaluator(system, saved, resources).get('strength_score');
    expect(after).not.toBe(strength);
    expect(resources.find(record => record.id === boost!.id)!.values.committed_ability_boosts).toEqual(['strength']);
    await applyLevelChoices(character.id, database);
    saved = (await database.characters.get(character.id))!;
    expect(progressionEvaluator(system, saved, await database.resources.toArray()).get('strength_score')).toBe(after);
  } finally { await database.delete(); }
}, 120000);
