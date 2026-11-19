/** @file Creation page hooks on a local draft: base writes, meta_stat, forEach and staged resource writes. */
import { expect, it } from 'vitest';
import { runCreationHook } from '../src/engine/creation-hooks';
import { base, constant, stat } from './fixtures/capabilities';
import type { SystemDefinition } from '../src/domain/model';

const definition = {
  character_stats: [base('gold', 'integer', 0), base('str_proficiency', 'string', ''), base('items', 'array', [], 'resource'),
    base('choices', 'array', [], 'string')],
  resources: [{ id: 'item', name: 'Item', stats: [base('quantity', 'integer', 1), base('skill', 'string', 'str')] }]
} as unknown as SystemDefinition;
const item = { id: 'i1', systemKey: 'sys', definitionId: 'item', name: 'Corda', values: { quantity: 1, skill: 'str' } };
const empty = { values: { gold: 0, items: [{ resourceId: 'i1' }] }, staged: [item], skipped: [] };

it('writes base values, meta_stat targets and staged resource fields through forEach without touching inputs', () => {
  const hook = { type: 'sequence', effects: [
    { type: 'setStat', stat: 'gold', new_value: constant(15), aggregation_type: 'set' },
    { type: 'forEach', components: stat('items'), apply: { type: 'sequence', effects: [
      { type: 'setStat', meta_stat: { type: 'concat', components: { type: 'list', components: [stat('$forEachValue.skill'), constant('_proficiency')] } },
        new_value: constant('proficient'), aggregation_type: 'set' },
      { type: 'addToStat', stat: '$forEachValue.quantity', value: constant(2) }] } },
    { type: 'showMessage', message: constant('x') }] };
  const next = runCreationHook(hook, definition, empty, []);
  expect(next.values).toMatchObject({ gold: 15, str_proficiency: 'proficient' });
  expect(next.staged[0].values.quantity).toBe(3);
  expect(next.skipped).toEqual(['showMessage']);
  expect(empty.staged[0].values.quantity).toBe(1);
});

it('treats an unmatched when as a no-op and rejects writes to persisted resources or wrong types', () => {
  const none = { type: 'when', clauses: [{ condition: constant(false), effect: { type: 'setStat', stat: 'gold', new_value: constant(1) } }] };
  expect(runCreationHook(none, definition, empty, [])).toBe(empty);
  const persisted = { ...empty, staged: [] };
  expect(() => runCreationHook({ type: 'setStat', stat: '$item.quantity', new_value: constant(2) }, definition,
    { ...persisted, values: { ...persisted.values } }, [item])).toThrow();
  expect(() => runCreationHook({ type: 'setStat', stat: 'gold', new_value: constant('molto') }, definition, empty, [])).toThrow('gold');
});

it('exposes `$updated_stats` and rolls source dice only through the explicit hook run', () => {
  const hook = { type: 'when', clauses: [{ condition: { type: 'contains', haystack: stat('$updated_stats'), needle: constant('gold') },
    effect: { type: 'setStat', stat: 'gold', new_value: { type: 'roll', formula: constant('2d6') }, aggregation_type: 'set' } }] };
  expect(runCreationHook(hook, definition, empty, [], undefined, { updatedStats: [] }).values.gold).toBe(0);
  expect(runCreationHook(hook, definition, empty, [], undefined, { updatedStats: ['gold'], random: () => 4 }).values.gold).toBe(8);
});

it('lets staged resource formulas read the draft as `$character`', () => {
  const withGate = { ...definition, resources: [{ id: 'item', name: 'Item', stats: [base('quantity', 'integer', 1), base('skill', 'string', 'str'),
    { id: 'usable', name: 'Usable', type: 'calculated', value_type: 'bool', components: { type: 'greaterThanEquals',
      components: { type: 'list', components: [stat('$character.gold'), constant(10)] } } }] }] } as unknown as SystemDefinition;
  const hook = { type: 'forEach', components: stat('items'), apply: { type: 'when', clauses: [{ condition: stat('$forEachValue.usable'),
    effect: { type: 'setStat', stat: '$forEachValue.quantity', new_value: constant(5), aggregation_type: 'set' } }] } };
  expect(runCreationHook(hook, withGate, { ...empty, values: { ...empty.values, gold: 12 } }, []).staged[0].values.quantity).toBe(5);
});

it('splits text with the bounded source separator pattern', async () => {
  const { createEvaluator } = await import('../src/engine/formulas');
  const split = { type: 'split', components: constant('Elvish ,  Draconic,Common'), separator: String.raw`\s*,\s*` };
  expect(createEvaluator([], {}).evaluate(split)).toEqual(['Elvish', 'Draconic', 'Common']);
  expect(() => createEvaluator([], {}).evaluate({ ...split, separator: '(' })).toThrow('Separatore split non valido');
});

it('copies a resource graph into the draft and appends it to a list stat', () => {
  const copyEach = { type: 'forEach', components: stat('items'), apply: { type: 'addToStat', stat: 'items', aggregation_type: 'set',
    value: { type: 'list', components: [{ type: 'copyResource', components: stat('$forEachValue'), preserve_ids: false }] } } };
  const next = runCreationHook(copyEach, definition, empty, []);
  expect(next.staged).toHaveLength(2);
  const created = next.staged[1];
  expect(created.id).not.toBe('i1');
  expect(created).toMatchObject({ definitionId: 'item', values: { quantity: 1 }, catalogGroup: created.id });
  expect(next.values.items).toEqual([{ resourceId: 'i1' }, { resourceId: created.id }]);
  expect(empty.staged).toHaveLength(1);
});

it('refuses copyResource outside an explicit command', async () => {
  const { createEvaluator } = await import('../src/engine/formulas');
  expect(() => createEvaluator([], {}).evaluate({ type: 'copyResource', components: constant('x') })).toThrow('comando esplicito');
});

it('filters catalog roots by base values read from their exact original', async () => {
  const { filterResources } = await import('../src/engine/resource-filters');
  const heritage = { id: 'heritage', name: 'Heritage', stats: [base('ancestry', 'string', ''), base('name', 'string', '')] };
  const root = (id: string, ancestry: string) => ({ id, systemKey: 'sys', definitionId: 'heritage', name: id, values: {},
    catalogSource: { original: '\ufeff' + JSON.stringify({ resource_id: 'heritage', stats: { ancestry: { value: ancestry } } }), source: 'x', digest: 'd' } });
  const result = filterResources([root('skilled', 'Human'), root('rock', 'Dwarf')], heritage as never, [{ stat: 'ancestry', name: 'Ancestry', values: ['Human'] }], {});
  expect(result.map(r => r.id)).toEqual(['skilled']);
});

it('defers fireEvent to the saved character instead of skipping it', () => {
  const next = runCreationHook({ type: 'sequence', effects: [{ type: 'fireEvent', event: { name: 'daily_preparations', payload: {} } }] }, definition, empty, []);
  expect(next.events).toEqual([{ name: 'daily_preparations', payload: {} }]);
  expect(next.skipped).toEqual([]);
});

it('treats a null list as empty in isEmpty', async () => {
  const { createEvaluator } = await import('../src/engine/formulas');
  expect(createEvaluator([], {}).evaluate({ type: 'isEmpty', components: { type: 'constant', value: null, value_type: 'string' } })).toBe(true);
});
