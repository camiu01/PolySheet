/** @file Explicit D&D score-generation helpers, separate from imported lifecycle effects. */
import type { SystemDefinition } from '../domain/model';
import { rollDice } from './dice';

export const abilityIds = ['strength_score', 'dexterity_score', 'constitution_score',
  'intelligence_score', 'wisdom_score', 'charisma_score'] as const;
export const standardScores = [15, 14, 13, 12, 10, 8];
const costs = [0, 1, 2, 3, 4, 5, 7, 9];

/** Offer the explicit D&D helper only for the supported six declared integer bases. */
export function supportsAbilitySetup(system: SystemDefinition) {
  return ['5e', '5e2024'].includes(system.id) && abilityIds.every(id =>
    system.character_stats.some(stat => stat.id === id && stat.type === 'base' && stat.value_type === 'integer'));
}

/** Invalid scores cannot be counted as free purchases. */
export function pointBuyRemaining(scores: number[]) {
  if (scores.length !== 6 || scores.some(score => !Number.isInteger(score) || score < 8 || score > 15))
    throw new Error('Nel point buy ogni caratteristica deve essere tra 8 e 15.');
  return 27 - scores.reduce((total, score) => total + costs[score - 8], 0);
}

/** Six explicit 4d6 rolls, dropping exactly one lowest die; never invoked by rendering. */
export function rollAbilityScores(random?: (faces: number) => number) {
  return abilityIds.map(() => {
    const { results } = rollDice('4d6', undefined, random);
    const dropped = results.indexOf(Math.min(...results));
    return { dice: results, dropped, total: results.reduce((sum, die, index) => sum + (index === dropped ? 0 : die), 0) };
  });
}

/** Slot identity, rather than score equality, prevents reusing one roll with equal totals. */
export function assignedScores(pool: number[], slots: string[]) {
  if (pool.length !== 6 || slots.length !== 6 || new Set(slots).size !== 6
    || slots.some(slot => !/^[0-5]$/.test(slot)))
    throw new Error('Assegna un risultato diverso a ciascuna caratteristica.');
  if (pool.some(score => !Number.isSafeInteger(score) || score < 3 || score > 18))
    throw new Error('Risultati delle caratteristiche non validi.');
  return slots.map(slot => pool[Number(slot)]);
}
