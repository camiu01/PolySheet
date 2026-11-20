/**
 * @file Character event dispatch over the validated effect subset.
 * @remarks Exactly one matching character mechanic runs per event; multiple
 * handlers or dynamic subscriptions remain explicit errors. Reverting an event
 * removes that mechanic's reversible overrides without touching base values;
 * non-revertible mechanics replace base values directly (see `permanentMechanic`).
 * Resource-scoped names run resource mechanics (see `resource-events.ts`); their
 * base-value writes are returned as `resources` for the caller to persist.
 * @see https://docs.rpg-companion.app/Mechanic/
 */
import { object, type Character, type CharacterOverrides, type Json, type ResourceInstance, type StoredSystem, type SystemDefinition } from '../domain/model';
import { createEvaluator, RuntimeResource } from './formulas';
import { rollDice } from './dice';
import { enumerationEntries } from './enumerations';
import { clearValueOverrides, cloneOverrides, resolveCharacterOverrides, revertMechanic } from './overrides';
import {
  eventNames, executeEffect, validateEffect, type EffectContext, type EventMessage, type PreparedRoll, type ResourceWriteMode
} from './effects';
import { changedResources, resourceDispatcher, withWrites, type ResourceWrites } from './resource-events';

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
    // A popup action fires its event later; an unsupported target must hide the whole entry now.
    if (effect.type === 'showPopUp' && Array.isArray(effect.extra_buttons))
      for (const button of effect.extra_buttons) characterEventPlan(system, object(button).event, [...ancestors, input.name], budget);
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
  // Sources list a flat modifier as its own formula next to the dice (5e weapon damage: "1d8", "-1").
  if (/^[+-]?\d{1,6}$/.test(expression.trim())) {
    const modifier = Number(expression.trim());
    return { expression, dice: [] as number[], modifier, total: modifier };
  }
  const match = /^(?:(min|max)\((\d{1,3}d\d{1,7})\)|(\d{1,3}d\d{1,7}))(?:\s*([+-])\s*(-?\d{1,6}))?$/i.exec(expression.trim());
  if (!match) throw new Error(`Formula dado evento non supportata: ${expression.trim().slice(0, 60)}`);
  const roll = rollDice(match[2] ?? match[3], undefined, random);
  const modifier = Number(match[5] ?? 0) * (match[4] === '-' ? -1 : 1);
  const kept = match[1]?.toLowerCase() === 'min' ? Math.min(...roll.results)
    : match[1]?.toLowerCase() === 'max' ? Math.max(...roll.results) : roll.total;
  return { expression, dice: roll.results, modifier, total: kept + modifier };
}

/** Check every expression and the dice budget before drawing randomness, so an unsupported later roll cannot partly execute. */
function preflightRolls(rows: PreparedRoll[]) {
  let dice = 0;
  for (const row of rows) for (const expression of row.formulas) {
    rollEventDice(expression, () => { if (++dice > 100) throw new Error('Troppi dadi per evento.'); return 1; });
  }
}

export type CharacterEventResult = (
  | { kind: 'roll'; title: string; rolls: { text: string; results: ReturnType<typeof rollEventDice>[] }[] }
  | { kind: 'popup'; title: string; input: unknown; variables: Record<string, unknown>; edit?: ReturnType<typeof editablePopup>;
      /** The single source button; its event runs with the popup inputs as `$view`, which are never saved. */
      action?: { label: string; event: unknown } }
  | { kind: 'effects' }
) & {
  messages: EventMessage[]; overrides: CharacterOverrides; reverted: string[];
  /** Base character values replaced by non-revertible mechanics; persisted like a manual edit. */
  values: Record<string, Json>;
  /** Owned resource instances whose base values the command changed. */
  resources: ResourceInstance[];
};

/**
 * A character mechanic without revert subscriptions can never undo its writes, so its `set` on a
 * base stat is a lasting replacement: the latest event wins, as a manual edit would (5e rests,
 * skill sort toggles, death saves). Resource and revertible mechanics keep reversible overrides.
 */
function permanentMechanic(system: SystemDefinition, mechanicId: string) {
  // A resource card action is a one-shot command with no revert subscription: its writes are lasting.
  if (mechanicId.startsWith('resource-event:')) return true;
  const mechanic = Array.isArray(system.mechanics)
    ? system.mechanics.map(item => object(item)).find(item => item.id === mechanicId) : undefined;
  return !!mechanic && !eventNames(mechanic.revert_event_names).length && mechanic.calculated_revert_event_names == null;
}

/** A resource-card event: the named mechanic of that resource runs instead of a character mechanic. */
function resourceEventPlan(event: unknown): CharacterEventPlan {
  const input = object(event);
  fields(input, ['name', 'payload']);
  if (typeof input.name !== 'string' || !input.name || input.name.length > 200) throw new Error('Nome evento non valido.');
  // `$character.stat` writes from a card action need an owner; the event name keeps them revertable together.
  return { name: input.name, payload: input.payload == null ? {} : object(input.payload),
    mechanicId: `resource-event:${input.name}`, effect: null, revert: [] };
}

/**
 * Evaluate against one immutable command snapshot; randomness is drawn only at explicit roll execution.
 * @param targetResource Local id of an owned resource whose card fired the event, if any.
 * @param view Inputs of the popup whose action fired this event, or the unsaved local choices of the
 * firing resource card, exposed as `$view` (never persisted).
 */
export function executeCharacterEvent(system: StoredSystem, character: Character, resources: ResourceInstance[],
  event: unknown, random?: (faces: number) => number, targetResource?: string,
  view?: Record<string, unknown>): CharacterEventResult {
  if (character.systemKey !== system.key) throw new Error('Sistema evento non corrispondente.');
  const plan = targetResource ? resourceEventPlan(event) : characterEventPlan(system.definition, event);
  const variables: Record<string, unknown> = { $event: plan.payload, $edit_mode: false, ...view ? { $view: view } : {} };
  const reverted: string[] = [];
  const budget = { nodes: 0, rolls: 0 };
  const writes: ResourceWrites = new Map();
  const values: Record<string, Json> = { ...character.values };
  const baseWrites: Record<string, Json> = {};
  const executedRolls: { text: string; results: ReturnType<typeof rollEventDice>[] }[] = [];
  const characterScope = () => {
    const resolved = resolveCharacterOverrides(ctx.overrides);
    return new RuntimeResource(`character:${character.id}`, system.definition.character_stats,
      values, character.createdAt, {}, resolved.values, undefined, resolved.modifiers);
  };
  const ctx: EffectContext = {
    pendingRolls: [],
    definition: system.definition, values, resources, createdAt: character.createdAt, variables,
    overrides: cloneOverrides(character.overrides), messages: [], reverted, mechanicId: plan.mechanicId ?? '',
    ancestors: [plan.name], budget,
    rollNow(rows: PreparedRoll[]) {
      preflightRolls(rows);
      const rolled = rows.map(row => ({ text: row.text, results: row.formulas.map(expression => rollEventDice(expression, random)) }));
      executedRolls.push(...rolled);
      return rolled.reduce((sum, row) => sum + row.results.reduce((total, roll) => total + roll.total, 0), 0);
    },
    writeBase(statId: string, value: Json, mode: ResourceWriteMode = 'set') {
      if (!permanentMechanic(system.definition, ctx.mechanicId)) return false;
      // A stored modifier from an earlier run of this same command would apply twice now.
      const own = ctx.overrides[ctx.mechanicId]?.modifiers?.[statId];
      if (own) {
        const overrides = cloneOverrides(ctx.overrides), entry = overrides[ctx.mechanicId];
        delete entry.modifiers?.[statId];
        if (!Object.keys(entry.modifiers ?? {}).length && !Object.keys(entry.values ?? {}).length) delete overrides[ctx.mechanicId];
        ctx.overrides = overrides;
      }
      if (mode === 'add') {
        const current = values[statId];
        if (typeof current !== 'number' || typeof value !== 'number') return false;
        values[statId] = current + value;
      } else values[statId] = value;
      baseWrites[statId] = values[statId];
      ctx.overrides = clearValueOverrides(ctx.overrides, statId) ?? ctx.overrides;
      return true;
    },
    evaluate(value: unknown) {
      const resolved = resolveCharacterOverrides(ctx.overrides);
      return createEvaluator(system.definition.character_stats, values, undefined, {
        resources: withWrites(resources, writes), resourceDefinitions: system.definition.resources, createdAt: character.createdAt,
        enumerations: system.definition.enumerated_types, variables,
        overrides: resolved.values, modifiers: resolved.modifiers, character: characterScope()
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
      try {
        const terminal = executeEffect(nested.effect, ctx);
        if (terminal?.kind !== 'popup') resourceEvents.broadcast(nested.name);
        return terminal;
      } finally {
        ctx.variables.$event = previousEvent; ctx.mechanicId = previousMechanic; ctx.ancestors = previousAncestors;
      }
    }
  };
  const resourceEvents = resourceDispatcher(system.definition, character, resources, writes, ctx, characterScope);
  ctx.dispatchResource = resourceEvents.dispatch;
  ctx.writeResource = resourceEvents.write;
  for (const id of plan.revert) ctx.overrides = revertMechanic(ctx.overrides, id);
  reverted.push(...plan.revert);
  const updated = () => changedResources(resources, writes);
  const terminal = targetResource ? resourceEvents.card({ resourceId: targetResource }, plan.name, plan.payload, view)
    : plan.effect ? executeEffect(plan.effect, ctx) : undefined;
  if (!targetResource && plan.effect && terminal?.kind !== 'popup') resourceEvents.broadcast(plan.name);
  const rolls = ctx.pendingRolls!;
  if (terminal?.kind === 'popup') {
    // A popup ends the command; rolls collected before it would never be shown.
    if (rolls.length || executedRolls.length) throw new Error('Tiro seguito da popup non supportato.');
    const effect = terminal.effect;
    const title = ctx.evaluate(effect.pop_up_title);
    if (typeof title !== 'string') throw new Error('Il titolo evento deve essere testo.');
    const edit = effect.should_persist_on_save === true ? editablePopup(effect, system.definition, ctx.evaluate) : undefined;
    let action: { label: string; event: unknown } | undefined;
    if (Array.isArray(effect.extra_buttons)) {
      const button = object(effect.extra_buttons[0]), label = ctx.evaluate(button.text);
      if (typeof label !== 'string' || !label || label.length > 100) throw new Error('Testo del pulsante non valido.');
      characterEventPlan(system.definition, button.event, [plan.name]);
      action = { label, event: button.event };
    }
    return { kind: 'popup', title, input: edit?.input ?? effect.pop_up_view,
      variables: { ...ctx.variables, $edit_mode: effect.in_edit_mode === true },
      edit, action, messages: ctx.messages, overrides: ctx.overrides, reverted, values: baseWrites, resources: updated() };
  }
  if (rolls.length || executedRolls.length) {
    preflightRolls(rolls);
    return {
      kind: 'roll', title: plan.name,
      rolls: [...executedRolls,
        ...rolls.map(row => ({ text: row.text, results: row.formulas.map(expression => rollEventDice(expression, random)) }))],
      messages: ctx.messages, overrides: ctx.overrides, reverted, values: baseWrites, resources: updated()
    };
  }
  return { kind: 'effects', messages: ctx.messages, overrides: ctx.overrides, reverted, values: baseWrites, resources: updated() };
}
