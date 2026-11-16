/**
 * @file Mechanic-owned, reversible value and modifier overrides.
 * @remarks Upstream keeps value overrides (`setStat`) separate from modifier
 * overrides (`addToStat`). Compatible `sum`/`max`/`min` contributions combine
 * deterministically; `set`/`none` clashes require an upstream user prompt and
 * therefore stay an explicit, non-destructive error.
 * @see https://docs.rpg-companion.app/Effects/setStat
 * @see https://docs.rpg-companion.app/Effects/addToStat
 */
import type { AggregationType, CharacterOverrides, EffectOverride, Json } from '../domain/model';

export const aggregationTypes: AggregationType[] = ['set', 'sum', 'max', 'min', 'none'];
export type OverrideLayer = 'values' | 'modifiers';

/** Deep-copy only the persisted override shape; values remain immutable JSON. */
export function cloneOverrides(overrides?: CharacterOverrides): CharacterOverrides {
  const copy: CharacterOverrides = {};
  for (const [mechanicId, mechanic] of Object.entries(overrides ?? {})) {
    copy[mechanicId] = {
      values: { ...(mechanic.values ?? {}) },
      modifiers: { ...(mechanic.modifiers ?? {}) }
    };
  }
  return copy;
}

/** Resolve one layer, combining only order-independent numeric aggregations. */
function resolveLayer(overrides: CharacterOverrides, layer: OverrideLayer) {
  const grouped = new Map<string, { aggregation: AggregationType; values: unknown[] }>();
  for (const mechanic of Object.values(overrides)) {
    for (const [statId, item] of Object.entries(mechanic[layer] ?? {})) {
      const group = grouped.get(statId);
      if (group) group.values.push(item.value);
      else grouped.set(statId, { aggregation: item.aggregation, values: [item.value] });
    }
  }
  const resolved: Record<string, unknown> = {};
  for (const [statId, group] of grouped) {
    if (group.values.length === 1) { resolved[statId] = group.values[0]; continue; }
    if (!['sum', 'max', 'min'].includes(group.aggregation))
      throw new Error(`Conflitto di aggregazione non risolvibile per ${statId}.`);
    const numbers = group.values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (numbers.length !== group.values.length)
      throw new Error(`Aggregazione numerica richiesta per ${statId}.`);
    resolved[statId] = group.aggregation === 'sum' ? numbers.reduce((sum, value) => sum + value, 0)
      : group.aggregation === 'max' ? Math.max(...numbers) : Math.min(...numbers);
  }
  return resolved;
}

/** Effective evaluator maps; never persisted in place of base values. */
export function resolveCharacterOverrides(overrides?: CharacterOverrides) {
  const source = overrides ?? {};
  return { values: resolveLayer(source, 'values'), modifiers: resolveLayer(source, 'modifiers') };
}

/** Reject ambiguous clashes before any write, so stored overrides stay resolvable. */
function assertCompatible(overrides: CharacterOverrides, mechanicId: string, layer: OverrideLayer,
  statId: string, next: EffectOverride) {
  for (const [owner, mechanic] of Object.entries(overrides)) {
    const other = owner === mechanicId ? undefined : mechanic[layer]?.[statId];
    if (!other || other.aggregation === next.aggregation
      && ['sum', 'max', 'min'].includes(next.aggregation)) continue;
    throw new Error(`Aggregazione non risolta per ${statId}: serve una scelta dell'utente non supportata.`);
  }
}

/** Apply one override immutably; an owner replaces its own previous contribution. */
export function applyOverride(current: CharacterOverrides, mechanicId: string, layer: OverrideLayer,
  statId: string, override: EffectOverride): CharacterOverrides {
  assertCompatible(current, mechanicId, layer, statId, override);
  const overrides = cloneOverrides(current);
  const mechanic = overrides[mechanicId] ?? {};
  mechanic[layer] = { ...(mechanic[layer] ?? {}), [statId]: { aggregation: override.aggregation, value: override.value } };
  overrides[mechanicId] = mechanic;
  return overrides;
}

/** Revert every override owned by one mechanic. */
export function revertMechanic(current: CharacterOverrides, mechanicId: string): CharacterOverrides {
  if (!Object.hasOwn(current, mechanicId)) return current;
  const overrides = cloneOverrides(current);
  delete overrides[mechanicId];
  return overrides;
}

/** A manual base edit invalidates value overrides for that field, never modifier additions. */
export function clearValueOverrides(current: CharacterOverrides | undefined, statId: string): CharacterOverrides | undefined {
  if (!current) return current;
  let changed = false;
  const overrides = cloneOverrides(current);
  for (const mechanic of Object.values(overrides)) {
    if (mechanic.values && Object.hasOwn(mechanic.values, statId)) { delete mechanic.values[statId]; changed = true; }
  }
  return changed ? overrides : current;
}

/** Narrow one persisted override without trusting backup or storage input. */
export function effectOverride(value: unknown): EffectOverride {
  const item = value as { aggregation?: unknown; value?: unknown };
  if (!item || typeof item !== 'object' || !aggregationTypes.includes(item.aggregation as AggregationType))
    throw new Error('Aggregazione di override non valida.');
  return { aggregation: item.aggregation as AggregationType, value: item.value as Json };
}
