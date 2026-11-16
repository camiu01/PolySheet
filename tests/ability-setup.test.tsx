/** @file D&D generation rules and draft-only beginner controls. */
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { abilityIds, assignedScores, pointBuyRemaining, rollAbilityScores, standardScores, supportsAbilitySetup } from '../src/engine/ability-setup';
import { InitialValues } from '../src/ui/InitialValues';
import { base } from './fixtures/capabilities';
import { catalogSystem } from './fixtures/catalog';
import { it as copy } from '../src/ui/it';

const system = { ...catalogSystem, id: '5e', character_stats: abilityIds.map(id => base(id, 'integer', 8)) };

it('limits the helper to D&D integer bases and validates every point-buy cost', () => {
  expect(supportsAbilitySetup(system)).toBe(true);
  expect(supportsAbilitySetup({ ...system, id: 'pf2e' })).toBe(false);
  expect(supportsAbilitySetup({ ...system, character_stats: system.character_stats.slice(1) })).toBe(false);
  [0, 1, 2, 3, 4, 5, 7, 9].forEach((cost, i) => expect(pointBuyRemaining([8 + i, 8, 8, 8, 8, 8])).toBe(27 - cost));
  expect(pointBuyRemaining([15, 15, 15, 8, 8, 8])).toBe(0);
  expect(pointBuyRemaining([15, 15, 15, 15, 15, 15])).toBe(-27);
  for (const score of [7, 16, NaN, 8.5]) expect(() => pointBuyRemaining([score, 8, 8, 8, 8, 8])).toThrow();
  expect(() => pointBuyRemaining([8])).toThrow();
});

it('rolls exactly 24 dice, drops one lowest tie and rejects invalid randomness', () => {
  const random = vi.fn(() => 1);
  const rolls = rollAbilityScores(random);
  expect(random).toHaveBeenCalledTimes(24);
  expect(rolls).toEqual(Array.from({ length: 6 }, () => ({ dice: [1, 1, 1, 1], dropped: 0, total: 3 })));
  expect(rollAbilityScores(() => 6).map(roll => roll.total)).toEqual([18, 18, 18, 18, 18, 18]);
  const dice = [6, 2, 5, 4];
  let index = 0;
  expect(rollAbilityScores(() => dice[index++ % 4])[0]).toEqual({ dice, dropped: 1, total: 15 });
  expect(() => rollAbilityScores(() => 0)).toThrow();
});

it('assigns each distinct slot once even when totals are equal', () => {
  expect(assignedScores(standardScores, ['5', '4', '3', '2', '1', '0'])).toEqual([8, 10, 12, 13, 14, 15]);
  expect(assignedScores([12, 12, 12, 12, 12, 12], ['0', '1', '2', '3', '4', '5'])).toHaveLength(6);
  expect(() => assignedScores(standardScores, ['0', '0', '1', '2', '3', '4'])).toThrow();
  expect(() => assignedScores(standardScores, ['', '1', '2', '3', '4', '5'])).toThrow();
});

function Harness({ change = vi.fn() }: { change?: (patch: Record<string, unknown>) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>(Object.fromEntries(abilityIds.map(id => [id, 8])));
  const [pending, setPending] = useState(false);
  return <><InitialValues system={system} stats={system.character_stats} values={values}
    onChange={patch => { change(patch); setValues(old => ({ ...old, ...patch })); }} onPending={setPending} />
    <button disabled={pending}>Save test</button></>;
}

it('requires explicit point-buy apply, blocks overspending and preserves values on mode switches', () => {
  const change = vi.fn(); render(<Harness change={change} />);
  fireEvent.change(screen.getByLabelText(copy.abilityMethod), { target: { value: 'point' } });
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save test' })).toBeDisabled();
  copy.abilityNames.forEach(name => fireEvent.change(screen.getByLabelText(name), { target: { value: '15' } }));
  expect(screen.getByRole('button', { name: copy.abilityApply })).toBeDisabled();
  copy.abilityNames.slice(3).forEach(name => fireEvent.change(screen.getByLabelText(name), { target: { value: '8' } }));
  fireEvent.click(screen.getByRole('button', { name: copy.abilityApply }));
  expect(change).toHaveBeenLastCalledWith(Object.fromEntries(abilityIds.map((id, i) => [id, i < 3 ? 15 : 8])));
  expect(screen.getByRole('button', { name: 'Save test' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText(copy.abilityNames[0]), { target: { value: '14' } });
  expect(screen.getByRole('button', { name: 'Save test' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(copy.abilityMethod), { target: { value: 'manual' } });
  expect(screen.getByLabelText(copy.abilityNames[0])).toHaveValue(15);
});

it('does not roll on render, supports duplicate totals and applies the six assigned scores', () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText(copy.abilityMethod), { target: { value: 'dice' } });
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: copy.abilityRoll }));
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(6);
  expect(screen.getByRole('button', { name: copy.abilityApply })).toBeDisabled();
  copy.abilityNames.forEach((name, i) => fireEvent.change(screen.getByLabelText(name), { target: { value: String(i) } }));
  fireEvent.click(screen.getByRole('button', { name: copy.abilityApply }));
  expect(screen.getByRole('button', { name: 'Save test' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText(copy.abilityMethod), { target: { value: 'manual' } });
  for (const name of copy.abilityNames) {
    const score = Number((screen.getByLabelText(name) as HTMLInputElement).value);
    expect(score).toBeGreaterThanOrEqual(3); expect(score).toBeLessThanOrEqual(18);
  }
});
