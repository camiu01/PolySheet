/**
 * @file Character event dispatch over the validated effect subset.
 * @remarks Exactly one matching character mechanic runs per event; multiple
 * handlers or dynamic subscriptions remain explicit errors. Reverting an event
 * removes that mechanic's reversible overrides without touching base values.
 * @see https://docs.rpg-companion.app/Mechanic/
 */
import { object, type Character, type CharacterOverrides, type ResourceInstance, type StoredSystem, type SystemDefinition } from '../domain/model';
import { createEvaluator, RuntimeResource } from './formulas';
import { rollDice } from './dice';
import { enumerationEntries } from './enumerations';
import { cloneOverrides, resolveCharacterOverrides, revertMechanic } from './overrides';
import {
  eventNames, executeEffect, validateEffect, type EffectContext, type EventMessage
} from './effects';

function fields(node: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(node).some(key => node[key] != null && !allowed.includes(key))) throw new Error('Opzione evento o effetto non supportata.');
}

export interface CharacterEventPlan {
  name: string;
  payload: Record<string, unknown>;
  /** Matching mechanic, or null for a revert-only event. */
  mechanicId: string | null;
  effect: Record<string, unknown> | null;
  /** Mechanics whose reversible overrides this event removes. */
  revert: string[];
}

/** Require at most one unconditional character mechanic; never guess subscription or execution order. */
export function characterEventPlan(system: SystemDefinition, event: unknown,
  ancestors: string[] = [], budget = { nodes: 0 }): CharacterEventPlan {
  const input = object(event);
  fields(input, ['name', 'payload']);
  if (typeof input.name !== 'string' || !input.name || input.name.length > 200) throw new Error('Nome evento non valido.');
  if (input.payload != null && (typeof input.payload !== 'object' || Array.isArray(input.payload)))
    throw new Error('Payload evento non valido.');
  if (input.payload && Object.keys(object(input.payload)).length > 50) throw new Error('Payload evento troppo grande.');
  if (ancestors.length >= 8 || ancestors.includes(input.name)) throw new Error('Ciclo o catena eventi troppo lunga.');
  const mechanics = Array.isArray(system.mechanics) ? system.mechanics.map(item => object(item)) : [];
  for (const mechanic of mechanics) {
    fields(mechanic, ['id', 'name', 'description', 'effects', 'event_names', 'calculated_event_names',
      'revert_event_names', 'calculated_revert_event_names', 'revert_on_remove']);
    if (mechanic.calculated_event_names != null || mechanic.calculated_revert_event_names != null)
      throw new Error('Le sottoscrizioni dinamiche richiedono un dispatcher completo.');
  }
  const matching = mechanics.filter(mechanic => eventNames(mechanic.event_names).includes(input.name as string));
  const reverting = mechanics.filter(mechanic => eventNames(mechanic.revert_event_names).includes(input.name as string));
  if (matching.length > 1) throw new Error('Evento con più gestori carattere: ordine non documentato.');
  if (matching.length && reverting.some(mechanic => mechanic.id === matching[0].id))
    throw new Error('Un gestore non può eseguire e annullare lo stesso evento.');
  if (!matching.length && !reverting.length) throw new Error('Evento senza un singolo gestore carattere supportato.');
  const mechanic = matching[0];
  let effect: Record<string, unknown> | null = null;
  if (mechanic) {
    if (typeof mechanic.id !== 'string' || !mechanic.id) throw new Error('Meccanica senza identificatore.');
    effect = object(mechanic.effects);
    validateEffect(effect, system, [...ancestors, input.name], budget);
  }
  return {
    name: input.name, payload: input.payload == null ? {} : object(input.payload),
    mechanicId: mechanic ? mechanic.id as string : null, effect,
    revert: reverting.map(item => item.id as string)
  };
}

/** Static effect bound to an event; a revert-only event has no effect to return. */
export function characterEventEffect(system: SystemDefinition, event: unknown, ancestors: string[] = [], budget = { nodes: 0 }) {
  const plan = characterEventPlan(system, event, ancestors, budget);
  if (!plan.effect) throw new Error('Evento di reversione senza effetto.');
  return plan.effect;
}

/** Resolve meta_stat once into a direct writable enumeration field, never a nested path. */
function editablePopup(effect: Record<string, unknown>, system: SystemDefinition, evaluate: (value: unknown) => unknown) {
  const node = object(effect.pop_up_view);
  const id = node.stat ?? evaluate(node.meta_stat);
  const stat = system.character_stats.find(s => s.id === id && s.type === 'base' && s.value_type === 'string');
  if (!stat || typeof id !== 'string' || id.includes('.')) throw new Error('Campo popup non modificabile.');
  if (typeof node.options !== 'string') throw new Error('Enumerazione popup mancante.');
  const options = enumerationEntries(system.enumerated_types, node.options);
  return { input: { ...node, stat: id, meta_stat: null }, field: id, options: options.map(option => option.id) };
}

/** Extend explicit event rolls only with verified min/max pools and signed source bonuses. */
export function rollEventDice(expression: string, random?: (faces: number) => number) {
  if (expression.length > 100) throw new Error('Formula dado troppo lunga.');
  const match = /^(?:(min|max)\((\d{1,3}d\d{1,7})\)|(\d{1,3}d\d{1,7}))(?:\s*([+-])\s*(-?\d{1,6}))?$/i.exec(expression.trim());
  if (!match) throw new Error('Formula dado evento non supportata.');
  const roll = rollDice(match[2] ?? match[3], undefined, random);
  const modifier = Number(match[5] ?? 0) * (match[4] === '-' ? -1 : 1);
  const kept = match[1]?.toLowerCase() === 'min' ? Math.min(...roll.results)
    : match[1]?.toLowerCase() === 'max' ? Math.max(...roll.results) : roll.total;
  return { expression, dice: roll.results, modifier, total: kept + modifier };
}

export type CharacterEventResult =
  | { kind: 'roll'; title: string; rolls: { text: string; results: ReturnType<typeof rollEventDice>[] }[];
      messages: EventMessage[]; overrides: CharacterOverrides; reverted: string[] }
  | { kind: 'popup'; title: string; input: unknown; variables: Record<string, unknown>;
      edit?: ReturnType<typeof editablePopup>; messages: EventMessage[]; overrides: CharacterOverrides; reverted: string[] }
  | { kind: 'effects'; messages: EventMessage[]; overrides: CharacterOverrides; reverted: string[] };

/** Evaluate against one immutable command snapshot; randomness is drawn only at explicit roll execution. */
export function executeCharacterEvent(system: StoredSystem, character: Character, resources: ResourceInstance[],
  event: unknown, random?: (faces: number) => number): CharacterEventResult {
  if (character.systemKey !== system.key) throw new Error('Sistema evento non corrispondente.');
  const plan = characterEventPlan(system.definition, event);
  const variables: Record<string, unknown> = { $event: plan.payload, $edit_mode: false };
  const reverted: string[] = [];
  const budget = { nodes: 0, rolls: 0 };
  const ctx: EffectContext = {
    definition: system.definition, values: character.values, resources, createdAt: character.createdAt, variables,
    overrides: cloneOverrides(character.overrides), messages: [], reverted, mechanicId: plan.mechanicId ?? '',
    ancestors: [plan.name], budget,
    evaluate(value: unknown) {
      const resolved = resolveCharacterOverrides(ctx.overrides);
      return createEvaluator(system.definition.character_stats, character.values, undefined, {
        resources, resourceDefinitions: system.definition.resources, createdAt: character.createdAt,
        enumerations: system.definition.enumerated_types, variables,
        overrides: resolved.values, modifiers: resolved.modifiers,
        character: new RuntimeResource(`character:${character.id}`, system.definition.character_stats,
          character.values, character.createdAt, {}, resolved.values, undefined, resolved.modifiers)
      }).evaluate(value);
    },
    dispatch(target: unknown) {
      const nested = characterEventPlan(system.definition, target, ctx.ancestors, budget);
      for (const id of nested.revert) {
        ctx.overrides = revertMechanic(ctx.overrides, id);
        if (!reverted.includes(id)) reverted.push(id);
      }
      if (!nested.effect) return undefined;
      const previousEvent = ctx.variables.$event, previousMechanic = ctx.mechanicId, previousAncestors = ctx.ancestors;
      ctx.variables.$event = nested.payload;
      ctx.mechanicId = nested.mechanicId!;
      ctx.ancestors = [...previousAncestors, nested.name];
      try { return executeEffect(nested.effect, ctx); } finally {
        ctx.variables.$event = previousEvent; ctx.mechanicId = previousMechanic; ctx.ancestors = previousAncestors;
      }
    }
  };
  for (const id of plan.revert) ctx.overrides = revertMechanic(ctx.overrides, id);
  reverted.push(...plan.revert);
  const terminal = plan.effect ? executeEffect(plan.effect, ctx) : undefined;
  if (terminal?.kind === 'popup') {
    const effect = terminal.effect;
    const title = ctx.evaluate(effect.pop_up_title);
    if (typeof title !== 'string') throw new Error('Il titolo evento deve essere testo.');
    const edit = effect.should_persist_on_save === true ? editablePopup(effect, system.definition, ctx.evaluate) : undefined;
    return { kind: 'popup', title, input: edit?.input ?? effect.pop_up_view, variables: ctx.variables,
      edit, messages: ctx.messages, overrides: ctx.overrides, reverted };
  }
  if (terminal?.kind === 'roll') {
    let dice = 0;
    // Preflight every expression before drawing randomness, so unsupported later rolls cannot partly execute.
    for (const row of terminal.rolls) for (const expression of row.formulas) {
      rollEventDice(expression, () => { if (++dice > 100) throw new Error('Troppi dadi per evento.'); return 1; });
    }
    return {
      kind: 'roll', title: plan.name,
      rolls: terminal.rolls.map(row => ({ text: row.text, results: row.formulas.map(expression => rollEventDice(expression, random)) })),
      messages: ctx.messages, overrides: ctx.overrides, reverted
    };
  }
  return { kind: 'effects', messages: ctx.messages, overrides: ctx.overrides, reverted };
}
