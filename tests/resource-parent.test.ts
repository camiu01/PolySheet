/** @file Parent ownership survives calculated collections without leaking caller scope. */
import { expect, it } from 'vitest';
import { createEvaluator, resourceParent } from '../src/engine/formulas';
import { base, stat } from './fixtures/capabilities';
import type { ResourceDefinition, ResourceInstance } from '../src/domain/model';

const definitions: ResourceDefinition[] = [
  { id: 'wrapper', name: 'Wrapper', stats: [base('level', 'integer', 1), base('child', 'resource', null)] },
  { id: 'child', name: 'Child', stats: [
    { id: 'level', name: 'Level', type: 'calculated', value_type: 'integer', components: stat('$parent.level') },
    { id: 'draft', name: 'Draft', type: 'calculated', value_type: 'string', components: stat('$view?.secret?') },
    base('next', 'resource', null),
    { id: 'loop', name: 'Loop', type: 'calculated', value_type: 'integer', components: stat('next.loop') }
  ] }
];
const resources: ResourceInstance[] = [
  { id: 'a', systemKey: 's', definitionId: 'wrapper', name: 'A', values: { level: 2, child: { resourceId: 'shared' } } },
  { id: 'b', systemKey: 's', definitionId: 'wrapper', name: 'B', values: { level: 5, child: { resourceId: 'shared' } } },
  { id: 'shared', systemKey: 's', definitionId: 'child', name: 'Shared', values: { next: { resourceId: 'shared' } } }
];
const stats = [base('wrappers', 'array', [{ resourceId: 'a' }, { resourceId: 'b' }], 'resource')];
const environment = { resources, resourceDefinitions: definitions };

it('keeps the same child isolated under two parents through map and repeated cached reads', () => {
  const evaluator = createEvaluator(stats, {}, undefined, { ...environment, variables: { $view: { secret: 'root' } } });
  const levels = { type: 'map', components: stat('wrappers'), map_value_key: '$item', mapper: stat('$item.child.level') };
  expect(evaluator.evaluate(levels)).toEqual([2, 5]);
  expect(evaluator.evaluate(levels)).toEqual([2, 5]);
  const children = evaluator.evaluate({ ...levels, mapper: stat('$item.child') });
  expect(children).toEqual([{ resourceId: 'shared' }, { resourceId: 'shared' }]);
  expect(JSON.stringify(children)).toBe('[{"resourceId":"shared"},{"resourceId":"shared"}]');
  if (!Array.isArray(children)) throw new Error('Expected children');
  expect(createEvaluator(definitions[1].stats, {}, undefined, { ...environment, parent: resourceParent(children[1]) }).get('level')).toBe(5);
  expect(evaluator.evaluate({ ...levels, mapper: stat('$item.child.draft') })).toEqual([null, null]);
  expect(evaluator.evaluate({ ...levels, mapper: stat('$item.child.$parent.level') })).toEqual([2, 5]);
});

it('does not inherit a global parent into an unrelated lookup, and bounds cyclic resource paths', () => {
  const evaluator = createEvaluator(stats, {}, undefined, { ...environment, variables: {
    $parent: { resourceId: 'a' }, $loose: { resourceId: 'shared' }
  } });
  expect(evaluator.get('$loose.$parent?')).toBeNull();
  expect(() => evaluator.get('$loose.level')).toThrow('Statistica mancante: $parent');
  expect(evaluator.get('$loose.next.next.$parent?')).toBeNull();
  expect(() => evaluator.get('$loose.loop')).toThrow('Dipendenza circolare');
  expect(() => createEvaluator(stats, {}, { steps: 3, depth: 3 }, environment).evaluate({
    type: 'map', components: stat('wrappers'), map_value_key: '$item', mapper: stat('$item.child.level')
  })).toThrow('Limite di valutazione');
});

it('exposes a parent draft only through an explicit parent path and never persists owner metadata', () => {
  const evaluator = createEvaluator([base('child', 'resource', { resourceId: 'shared' })], {}, undefined,
    { ...environment, variables: { $view: { secret: 'owner draft' } } });
  expect(evaluator.get('child.$view?')).toBeNull();
  expect(evaluator.get('child.$parent.$view.secret')).toBe('owner draft');
  const reference = evaluator.get('child');
  expect(resourceParent(reference)?.values).toEqual({});
  expect(resourceParent(structuredClone(reference))).toBeUndefined();
});
