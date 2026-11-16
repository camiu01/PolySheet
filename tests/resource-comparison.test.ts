/** @file Nullable resource predicates must not require scalar coercion or object equality. */
import { expect, it } from 'vitest';
import { createEvaluator, RuntimeResource } from '../src/engine/formulas';
import { base, constant, list, stat } from './fixtures/capabilities';

it.each(['equals', 'notEquals'])('%s compares nullable resource references without traversing them', type => {
  const engine = createEvaluator([base('weapon', 'resource', null)], { weapon: { resourceId: 'weapon-1' } });
  const expression = { type, components: list(stat('weapon'), constant(null)) };
  expect(engine.evaluate(expression)).toBe(type === 'notEquals');
  expect(createEvaluator([base('weapon', 'resource', null)]).evaluate(expression)).toBe(type === 'equals');
  expect(engine.evaluate({ type, components: list(constant(null), stat('weapon')) })).toBe(type === 'notEquals');
  const owner = createEvaluator([], {}, undefined, { character: new RuntimeResource('owner', [], {}) });
  expect(owner.evaluate({ type, components: list(stat('$character'), constant(null)) })).toBe(type === 'notEquals');
  expect(() => engine.evaluate({ type, components: list(stat('weapon'), stat('weapon')) })).toThrow();
  expect(() => createEvaluator([], {}, undefined, { variables: { $invalid: { arbitrary: true } } })
    .evaluate({ type, components: list(stat('$invalid'), constant(null)) })).toThrow();
});
