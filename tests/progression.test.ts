// @vitest-environment node
/** @file Real-source progression, repeat/stale protection and atomic private multiclass graphs. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { installSystem, SheetDatabase } from '../src/persistence/db';
import { advanceCharacter } from '../src/persistence/progression';
import { progressionClasses, progressionEvaluator, progressionArchetypes, progressionContract } from '../src/engine/progression';
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
    expect(await advanceCharacter(character.id, character.revision, request, database)).toEqual({ level: 2, maxHp: 20, baseHpGain: 6 });
    await expect(advanceCharacter(character.id, character.revision, request, database)).rejects.toThrow('scheda è cambiata');
    character = (await database.characters.get(character.id))!;
    expect(character.values.current_hp).toBe(12);
    resources = await database.resources.toArray();
    const choices = progressionArchetypes(system, character, resources, wrapper.record.id, 3);
    expect(choices.required).toBe(true);
    const before = await database.resources.toArray();
    await expect(advanceCharacter(character.id, character.revision, { ...request, expectedClassLevel: 2, targetLevel: 3 }, database)).rejects.toThrow('sottoclasse');
    expect(await database.resources.toArray()).toEqual(before);
    expect((await advanceCharacter(character.id, character.revision, { ...request, expectedClassLevel: 2, targetLevel: 3,
      archetypeId: choices.options[0].id }, database)).maxHp).toBe(28);
    character = (await database.characters.get(character.id))!;
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
    const high = await configureCharacter(system, 'Target ceiling', { constitution_score: 14, hit_point_mode: 'max' },
      { classes: ids[0] }, undefined, database, true);
    const highResources = await database.resources.toArray();
    const highClass = progressionClasses(system, high, highResources)[0];
    const highArchetypes = progressionArchetypes(system, high, highResources, highClass.record.id, 20);
    expect(await advanceCharacter(high.id, high.revision, { ...request, wrapperId: highClass.record.id,
      targetLevel: 20, archetypeId: highArchetypes.options[0].id }, database)).toEqual({ level: 20, maxHp: 240, baseHpGain: 190 });
  } finally { await database.delete(); }
}, 20000);
