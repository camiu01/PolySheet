// @vitest-environment node
/** @file Lasting writes of non-revertible mechanics, popup actions and the unchanged 5e rest lifecycle. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import type { Character, StoredSystem } from '../src/domain/model';
import { characterEventPlan, executeCharacterEvent } from '../src/engine/character-events';
import { createEvaluator, RuntimeResource } from '../src/engine/formulas';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { assignCatalog, configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { filterResources, resourceFilters } from '../src/engine/resource-filters';
import { installSystem, setCharacterValue, SheetDatabase } from '../src/persistence/db';
import { runCharacterEvent } from '../src/persistence/character-events';
import { demo } from '../src/demo';
import { base, constant, list, stat } from './fixtures/capabilities';

const set = (target: string, value: unknown) => ({ type: 'setStat', stat: target, new_value: value, aggregation_type: 'set' });
const definition = {
  ...demo,
  character_stats: [...demo.character_stats, base('slots', 'integer', 0), base('spend', 'integer', 0)],
  mechanics: [
    { id: 'rest_a', event_names: 'rest_a', effects: set('slots', constant(4)) },
    { id: 'rest_b', event_names: 'rest_b', effects: set('slots', constant(1)) },
    { id: 'buff', event_names: 'buff', revert_event_names: 'unbuff', effects: set('slots', constant(9)) },
    { id: 'ask', event_names: 'ask', effects: { type: 'showPopUp', pop_up_title: constant('Rest'), in_edit_mode: true,
      pop_up_view: { id: 'spend_view', type: 'stat', stat: 'spend' },
      extra_buttons: [{ text: constant('REST'), event: { name: 'spend', payload: {} } }] } },
    { id: 'spend', event_names: 'spend', effects: { type: 'roll',
      rolls: list({ type: 'rollable', text: constant('dice'), formulas: list(constant('2d6')) }),
      on_result_effect: set('slots', { type: 'add', components: list(stat('$event.result'), stat('$view.spend_view')) }) } },
    { id: 'broken', event_names: 'broken', effects: { type: 'showPopUp', pop_up_title: constant('Broken'),
      pop_up_view: { id: 'text', type: 'text', text: constant('x') },
      extra_buttons: [{ text: constant('GO'), event: { name: 'missing_handler', payload: {} } }] } }
  ]
};
const system = { key: 'rest-events', definition } as unknown as StoredSystem;
const owner = (values: Character['values'] = {}, overrides?: Character['overrides']): Character =>
  ({ id: 'c', systemKey: system.key, name: 'C', values, resourceIds: [], overrides, createdAt: '', updatedAt: '', revision: 1 });

it('replaces base values from non-revertible mechanics so successive rests do not conflict', () => {
  const first = executeCharacterEvent(system, owner(), [], { name: 'rest_a' });
  expect(first.values).toEqual({ slots: 4 });
  expect(first.overrides).toEqual({});
  const second = executeCharacterEvent(system, owner(first.values), [], { name: 'rest_b' });
  expect(second.values).toEqual({ slots: 1 });
  const buffed = executeCharacterEvent(system, owner({ slots: 1 }), [], { name: 'buff' });
  expect(buffed.values).toEqual({});
  expect(buffed.overrides).toEqual({ buff: { values: { slots: { aggregation: 'set', value: 9 } } } });
  // A lasting write supersedes a stale override on the same stat, like a manual edit.
  const rested = executeCharacterEvent(system, owner({ slots: 1 }, buffed.overrides), [], { name: 'rest_a' });
  expect(rested).toMatchObject({ values: { slots: 4 }, overrides: { buff: { values: {} } } });
});

it('returns one popup action, runs it with the popup inputs as $view and exposes the summed roll as $event.result', () => {
  const popup = executeCharacterEvent(system, owner({ spend: 0 }), [], { name: 'ask' });
  expect(popup).toMatchObject({ kind: 'popup', title: 'Rest', action: { label: 'REST', event: { name: 'spend' } } });
  expect(popup.kind === 'popup' && popup.variables.$edit_mode).toBe(true);
  const spent = executeCharacterEvent(system, owner(), [], { name: 'spend' }, () => 3, undefined, { spend_view: 2 });
  expect(spent.kind === 'roll' && spent.rolls.map(row => [row.text, row.results[0].total])).toEqual([['dice', 6]]);
  expect(spent.values).toEqual({ slots: 8 });
  expect(() => characterEventPlan(definition as never, { name: 'broken' })).toThrow();
});

const fixture = '.reference/official-releases-2026-11-16/5e-system.rpg';
const fighterFile = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/class_fighter_fighter.rpg.json';
it.skipIf(!existsSync(fixture) || !existsSync(fighterFile))('runs the unchanged 5e long and short rest popups and sorts skills twice', async () => {
  const real = await prepareSystem(gunzipSync(readFileSync(fixture)).toString('utf8'), 'Local rest fixture');
  const database = new SheetDatabase(`rest-${crypto.randomUUID()}`);
  try {
    await installSystem(real, database);
    const [fighter] = await installCatalogs([await prepareCatalogTemplate(readFileSync(fighterFile, 'utf8'), 'local.json', real)], database);
    const created = await configureCharacter(real, 'Rest', { constitution_score: 14, hit_point_mode: 'average' },
      { classes: fighter }, undefined, database, true);
    const read = async () => {
      const character = (await database.characters.get(created.id))!;
      const evaluator = createEvaluator(real.definition.character_stats, character.values, undefined, {
        resources: await database.resources.toArray(), resourceDefinitions: real.definition.resources,
        enumerations: real.definition.enumerated_types });
      return { character, get: (id: string) => evaluator.get(id) };
    };
    const maxHp = (await read()).get('max_hp') as number;
    expect(maxHp).toBe(12);
    await setCharacterValue(created.id, 'current_hp', 3, database);

    const long = await runCharacterEvent(created.id, { name: 'trigger_long_rest', payload: {} }, database);
    expect(long.result).toMatchObject({ kind: 'popup', title: 'Long Rest', action: { label: 'REST', event: { name: 'long_rest' } } });
    const rested = await runCharacterEvent(created.id, { name: 'long_rest', payload: {} }, database);
    expect(rested.result.messages[0].text).toContain('well rested');
    let state = await read();
    expect(state.get('current_hp')).toBe(maxHp);
    expect(state.character.values.current_hp).toBe(maxHp);
    const hitDice = state.get('current_d10_hit_dice') as number;
    expect(hitDice).toBe(state.get('max_d10_hit_dice'));

    await setCharacterValue(created.id, 'current_hp', 3, database);
    const short = await runCharacterEvent(created.id, { name: 'trigger_short_rest', payload: {} }, database);
    expect(short.result).toMatchObject({ kind: 'popup', action: { event: { name: 'short_rest' } } });
    expect(short.result.kind === 'popup' && short.result.variables.$edit_mode).toBe(true);
    const view = { short_rest_hit_dice_d4_stat: 0, short_rest_hit_dice_d6_stat: 0, short_rest_hit_dice_d8_stat: 0,
      short_rest_hit_dice_d10_stat: 1, short_rest_hit_dice_d12_stat: 0, short_rest_hit_dice_d20_stat: 0 };
    const preview = executeCharacterEvent(real, (await read()).character, await database.resources.toArray(),
      { name: 'short_rest', payload: {} }, () => 7, undefined, view);
    expect(preview.kind === 'roll' && preview.rolls.map(row => row.results.map(result => result.total))).toEqual([[7]]);
    expect(preview.values).toMatchObject({ current_hp: 10, current_d10_hit_dice: hitDice - 1 });
    await runCharacterEvent(created.id, { name: 'short_rest', payload: {} }, database, undefined, view);
    state = await read();
    expect(state.get('current_d10_hit_dice')).toBe(hitDice - 1);
    expect(state.get('current_hp')).toBeGreaterThanOrEqual(4);
    expect(state.get('current_hp')).toBeLessThanOrEqual(maxHp);
    // Temporary popup inputs stay unsaved.
    expect(state.character.values.temp_short_rest_hit_dice_d10 ?? 0).toBe(0);
    await runCharacterEvent(created.id, { name: 'long_rest', payload: {} }, database);
    expect((await read()).get('current_d10_hit_dice')).toBe(hitDice);

    await runCharacterEvent(created.id, { name: 'sort_by_name', payload: {} }, database);
    const ability = (await read()).get('sort_skills_by_name');
    await runCharacterEvent(created.id, { name: 'sort_by_ability', payload: {} }, database);
    expect((await read()).get('sort_skills_by_name')).toBe(!ability);
  } finally { await database.delete(); }
}, 120000);

const classFile = (name: string) => `.reference/rpg-companion-app-systems/systems/5e/resource_instances/class_${name}_${name}.rpg.json`;
it.skipIf(!existsSync(fixture) || !existsSync(classFile('bard')) || !existsSync(classFile('wizard')))(
  'pools multiclass spell slots, offers spells of every class and keeps one spellcasting ability per class', async () => {
  const real = await prepareSystem(gunzipSync(readFileSync(fixture)).toString('utf8'), 'Local multiclass fixture');
  const database = new SheetDatabase(`multiclass-${crypto.randomUUID()}`);
  try {
    await installSystem(real, database);
    const [bard, wizard] = await installCatalogs(await Promise.all(['bard', 'wizard'].map(async name =>
      prepareCatalogTemplate(readFileSync(classFile(name), 'utf8'), 'local.json', real))), database);
    const created = await configureCharacter(real, 'Multiclass', { constitution_score: 14, hit_point_mode: 'average' },
      { classes: bard }, undefined, database, true);
    await assignCatalog(created.id, wizard, 'classes', database);
    const wrappers = ((await database.characters.get(created.id))!.values.classes as { resourceId: string }[]).map(r => r.resourceId);
    expect(wrappers).toHaveLength(2);
    // Bard 3 / Wizard 2: full casters add up to caster level 5 (4/3/2 slots), not each class's own table.
    await database.resources.update(wrappers[0], { 'values.class_level': 3 });
    await database.resources.update(wrappers[1], { 'values.class_level': 2 });
    await runCharacterEvent(created.id, { name: 'long_rest', payload: {} }, database);
    const character = (await database.characters.get(created.id))!;
    const resources = await database.resources.toArray();
    const context = { resources, resourceDefinitions: real.definition.resources, enumerations: real.definition.enumerated_types };
    const engine = createEvaluator(real.definition.character_stats, character.values, undefined, context);
    expect(engine.get('spellcaster_level')).toBe(5);
    expect([1, 2, 3, 4].map(level => engine.get(`spell_slots_${level}`))).toEqual([4, 3, 2, 0]);

    const spell = real.definition.resources.find(r => r.id === 'spell')!;
    const nodes: Record<string, unknown>[] = [];
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (!Array.isArray(value) && (value as Record<string, unknown>).type === 'selectResources'
        && (value as Record<string, unknown>).resource_id === 'spell') nodes.push(value as Record<string, unknown>);
      for (const child of Object.values(value)) visit(child);
    };
    visit(real.definition.character_sheet_sections);
    const sheetFilters = resourceFilters(nodes.find(n => n.filters != null)?.filters, spell, engine.evaluate);
    expect(sheetFilters[0].values).toEqual(['Bard', 'Wizard']);
    const candidates = ['bard', 'wizard', 'cleric'].map(id => ({ id, name: id, definitionId: 'spell', systemKey: real.key, values: { classes: [id] } }));
    expect(filterResources(candidates, spell, sheetFilters, context).map(r => r.name)).toEqual(['bard', 'wizard']);
    // The Spells tab shows one class_details card per class, each with its own casting ability.
    const details = real.definition.resources.find(d => d.id === 'class_details')!;
    const owner = new RuntimeResource(character.id, real.definition.character_stats, character.values, character.createdAt);
    expect(wrappers.map(id => String(createEvaluator(details.stats, resources.find(r => r.id === id)!.values, undefined,
      { ...context, character: owner }).get('class_name_with_spellcasting_ability')))).toEqual([expect.stringMatching(/Bard.*CHA/i), expect.stringMatching(/Wizard.*INT/i)]);
  } finally { await database.delete(); }
}, 120000);
