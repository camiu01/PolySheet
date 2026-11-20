/**
 * @file Bounded validation and execution of the documented character effect subset.
 * @remarks `$view` drafts and asynchronous effects are outside this scope and
 * fail explicitly instead of becoming no-ops. Resource-owned mechanics run only
 * for constant event names scoped with `eventName.for_resource`.
 * @see https://docs.rpg-companion.app/Effects/sequence
 * @see https://docs.rpg-companion.app/Mechanic/
 */
import { jsonValue, matchesType, object, type AggregationType, type Json, type CharacterOverrides, type ResourceInstance, type SystemDefinition } from '../domain/model';
import { aggregationTypes, applyOverride } from './overrides';

export interface EventMessage { text: string; type: 'info' | 'warning' | 'error' | 'success' }
export interface PreparedRoll { text: string; formulas: string[] }
export type EffectTerminal =
  | { kind: 'popup'; effect: Record<string, unknown> }
  | { kind: 'roll'; rolls: PreparedRoll[] };

/** Mutable state shared by one event command; never persisted directly. */
export interface EffectContext {
  definition: SystemDefinition;
  values: Record<string, unknown>;
  resources: ResourceInstance[];
  createdAt?: string;
  variables: Record<string, unknown>;
  overrides: CharacterOverrides;
  messages: EventMessage[];
  reverted: string[];
  mechanicId: string;
  ancestors: string[];
  budget: { nodes: number; rolls: number };
  /** Rolls prepared so far; a roll inside a sequence is collected and the sequence continues. */
  pendingRolls?: PreparedRoll[];
  evaluate(value: unknown): unknown;
  dispatch(event: unknown): EffectTerminal | undefined;
  /** Draw these rolls now, record them for display and return their summed total; absent where results cannot be shown. */
  rollNow?(rolls: PreparedRoll[]): number;
  /** Replace or add to a character base value when the running mechanic cannot be reverted; false keeps an override. */
  writeBase?(statId: string, value: Json, mode?: ResourceWriteMode): boolean;
  /** Run the mechanics of one resource for a scoped event name. */
  dispatchResource?(target: unknown, name: string): EffectTerminal | undefined;
  /** Write a base stat of an owned resource reached through `$variable.stat` or `resourceStat.stat`. */
  writeResource?(target: unknown, statId: string, value: unknown, mode: ResourceWriteMode): void;
  /** Writers of a resource scope (its own base stats and `$character`); absent for the character. */
  scope?: {
    write(statId: string, value: Json, mode: ResourceWriteMode): void;
    character(type: unknown, statId: string, aggregation: AggregationType, value: Json): void;
  };
}

/** Resource instances have no override layer: `setStat` replaces and `addToStat` adds to the base value. */
export type ResourceWriteMode = 'set' | 'add';

const messageTypes = ['info', 'warning', 'error', 'success'];

function fields(node: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(node).some(key => node[key] != null && !allowed.includes(key)))
    throw new Error('Opzione evento o effetto non supportata.');
}

/** Accept comma-separated subscriptions or a string list; a blank string means no subscriptions. */
export function eventNames(value: unknown): string[] {
  if (typeof value === 'string' && !value.trim()) return [];
  const names = typeof value === 'string' ? value.split(',').map(item => item.trim())
    : Array.isArray(value) ? value : [];
  if (names.some(name => typeof name !== 'string' || !name || name.length > 200 || name.includes(',')))
    throw new Error('Nome evento non valido.');
  return [...new Set(names as string[])];
}

function aggregationType(effect: Record<string, unknown>): AggregationType {
  if (effect.calculated_aggregation_type != null) throw new Error('Aggregazione calcolata non supportata.');
  const value = effect.aggregation_type ?? 'none';
  if (typeof value !== 'string' || !aggregationTypes.includes(value as AggregationType))
    throw new Error(`Aggregazione non supportata: ${String(value)}`);
  return value as AggregationType;
}

function assertRollList(effect: Record<string, unknown>) {
  const list = object(effect.rolls);
  if (list.type === 'map') {
    // A computed list: one rollable per item of the mapped collection (5e weapon damage dice).
    fields(list, ['type', 'components', 'mapper']);
    const rollable = object(list.mapper);
    fields(rollable, ['type', 'formulas', 'text']);
    if (list.components == null || rollable.type !== 'rollable' || !rollable.formulas || !rollable.text) throw new Error('Tiro non supportato.');
    return;
  }
  fields(list, ['type', 'components']);
  if (list.type !== 'list' || !Array.isArray(list.components) || !list.components.length || list.components.length > 10)
    throw new Error('Lista tiri non supportata.');
  for (const item of list.components) {
    const rollable = object(item);
    fields(rollable, ['type', 'formulas', 'text']);
    if (rollable.type !== 'rollable' || !rollable.formulas || !rollable.text) throw new Error('Tiro non supportato.');
  }
}

function assertEvent(event: unknown) {
  const input = object(event);
  fields(input, ['name', 'payload']);
  if (typeof input.name !== 'string' || !input.name || input.name.length > 200) throw new Error('Nome evento non valido.');
  if (input.payload != null && (typeof input.payload !== 'object' || Array.isArray(input.payload)))
    throw new Error('Payload evento non valido.');
  if (input.payload && Object.keys(object(input.payload)).length > 50) throw new Error('Payload evento troppo grande.');
}

function assertForwardNames(effect: Record<string, unknown>) {
  const list = object(effect.new_event_names);
  fields(list, ['type', 'components']);
  if (list.type !== 'list' || !Array.isArray(list.components) || list.components.length !== 1)
    throw new Error('Inoltro multiplo o dinamico non supportato.');
  const name = object(list.components[0]);
  fields(name, ['type', 'value', 'value_type', 'sub_value_type']);
  if (name.type !== 'constant' || name.value_type !== 'string' || typeof name.value !== 'string')
    throw new Error('Inoltro dinamico non supportato.');
}

/**
 * Accept a static list of constant names or `eventName` nodes; a computed list
 * (`map`, `stat`) would make the dispatched events depend on runtime data.
 */
function assertFireNames(effect: Record<string, unknown>) {
  const list = object(effect.event_names);
  if (list.type !== 'list' || !Array.isArray(list.components) || !list.components.length || list.components.length > 20)
    throw new Error('Nomi evento dinamici non supportati.');
  fields(list, ['type', 'components']);
  for (const item of list.components) {
    const node = object(item);
    if (node.type === 'constant') {
      fields(node, ['type', 'value', 'value_type', 'sub_value_type']);
      if (node.value_type !== 'string' || typeof node.value !== 'string') throw new Error('Nome evento non valido.');
    } else if (node.type === 'eventName') {
      fields(node, ['type', 'event_name', 'for_resource']);
      if (typeof node.event_name !== 'string') throw new Error('Nome evento non valido.');
    } else throw new Error('Nomi evento dinamici non supportati.');
  }
}

function assertPopUp(effect: Record<string, unknown>) {
  fields(effect, ['type', 'pop_up_view', 'pop_up_title', 'pop_up_type', 'display_cancel_button',
    'display_save_button', 'should_persist_on_save', 'extra_buttons', 'in_edit_mode']);
  if (effect.in_edit_mode != null && typeof effect.in_edit_mode !== 'boolean') throw new Error('Popup non valido.');
  if (effect.extra_buttons != null) {
    // One action button that fires an event with the popup inputs as `$view` (5e rest popups); more need ordering UI.
    if (!Array.isArray(effect.extra_buttons) || effect.extra_buttons.length !== 1
      || effect.display_save_button === true || effect.should_persist_on_save === true)
      throw new Error('Popup con pulsanti multipli o salvataggio non supportato.');
    const button = object(effect.extra_buttons[0]);
    fields(button, ['text', 'event']);
    if (button.text == null) throw new Error('Testo del pulsante mancante.');
    assertEvent(button.event);
  } else if (effect.in_edit_mode === true) throw new Error('Popup modificabile senza azione non supportato.');
  if (!effect.pop_up_view || !effect.pop_up_title
    || effect.pop_up_type != null && !['bottomSheet', 'alert'].includes(String(effect.pop_up_type))
    || effect.display_cancel_button != null && typeof effect.display_cancel_button !== 'boolean')
    throw new Error('Popup non valido.');
  if (effect.display_save_button != null && typeof effect.display_save_button !== 'boolean'
    || effect.should_persist_on_save != null && typeof effect.should_persist_on_save !== 'boolean')
    throw new Error('Opzioni di salvataggio popup non valide.');
  if (effect.display_save_button === true || effect.should_persist_on_save === true) {
    const node = object(effect.pop_up_view);
    fields(node, ['id', 'type', 'stat', 'meta_stat', 'options', 'style', 'multi_select', 'should_auto_save']);
    if (effect.display_save_button !== true || effect.should_persist_on_save !== true
      || node.type !== 'select' || node.multi_select === true || node.should_auto_save === true
      || typeof node.options !== 'string' || typeof node.id !== 'string')
      throw new Error('Solo popup con selezione singola e salvataggio esplicito.');
  }
}

/** Validate every branch before any action; nested terminals need asynchronous UI and stay unsupported. */
/** `when` branches that failed validation in a deferring scope, with the reason; reaching one aborts the command. */
const deferredBranches = new WeakMap<object, string>();

/**
 * Preflight one effect tree.
 * @param budget With `defer`, an unsupported `when` branch is recorded instead of rejecting the tree:
 * resource handlers carry branches for other instance types (5e `effect` `use_spell`), and their
 * writes are applied only after the whole command succeeds, so failing on reach stays atomic.
 */
export function validateEffect(effect: Record<string, unknown>, definition: SystemDefinition,
  ancestors: string[], budget: { nodes: number; defer?: boolean }, nested = false) {
  if (++budget.nodes > 2000) throw new Error('Evento troppo complesso.');
  switch (effect.type) {
    case 'sequence': {
      fields(effect, ['type', 'effects', 'synchronous']);
      if (effect.synchronous === false || !Array.isArray(effect.effects) || !effect.effects.length || effect.effects.length > 100)
        throw new Error('Solo sequenze sincrone supportate.');
      for (const child of effect.effects) validateEffect(object(child), definition, ancestors, budget, true);
      return;
    }
    case 'when': {
      fields(effect, ['type', 'clauses']);
      if (!Array.isArray(effect.clauses) || !effect.clauses.length || effect.clauses.length > 50 || ancestors.length >= 8)
        throw new Error('Diramazione evento non supportata.');
      for (const clause of effect.clauses) {
        const branch = object(clause);
        fields(branch, ['condition', 'effect']);
        const target = object(branch.effect);
        if (!budget.defer) { validateEffect(target, definition, [...ancestors, '<when>'], budget, nested); continue; }
        try { validateEffect(target, definition, [...ancestors, '<when>'], budget, nested); }
        catch (error) { deferredBranches.set(target, error instanceof Error ? error.message : String(error)); }
      }
      return;
    }
    case 'setStat':
    case 'addToStat': {
      fields(effect, ['type', 'stat', 'meta_stat', 'new_value', 'value', 'aggregation_type', 'calculated_aggregation_type']);
      if (effect.stat == null && effect.meta_stat == null) throw new Error('Destinazione dell’effetto mancante.');
      if ((effect.type === 'setStat' ? effect.new_value : effect.value) == null)
        throw new Error('Valore dell’effetto mancante.');
      aggregationType(effect);
      return;
    }
    case 'fireEvent': {
      fields(effect, ['type', 'event', 'event_names']);
      if ((effect.event == null) === (effect.event_names == null)) throw new Error('Evento da emettere mancante.');
      if (effect.event_names != null) assertFireNames(effect);
      else assertEvent(effect.event);
      return;
    }
    case 'forwardEvent':
      fields(effect, ['type', 'new_event_names']);
      assertForwardNames(effect);
      return;
    case 'forEach': {
      fields(effect, ['type', 'components', 'apply', 'for_each_value_key', 'synchronous']);
      if (effect.synchronous === false || effect.components == null || !effect.apply)
        throw new Error('Solo iterazioni sincrone supportate.');
      if (effect.for_each_value_key != null && (typeof effect.for_each_value_key !== 'string'
        || !/^\$?[\w-]{1,100}$/.test(effect.for_each_value_key))) throw new Error('Chiave di iterazione non valida.');
      validateEffect(object(effect.apply), definition, ancestors, budget, true);
      return;
    }
    case 'delayed':
      // Accepted only so sibling branches can run; reaching it aborts the whole command (see executeEffect),
      // except a delayed `dismissResource`, which is UI pacing only.
      fields(effect, ['type', 'millis', 'effect']);
      validateEffect(object(effect.effect), definition, ancestors, budget, true);
      return;
    case 'dismissResource':
      fields(effect, ['type']);
      return;
    case 'showMessage':
      fields(effect, ['type', 'message', 'message_type']);
      if (effect.message == null) throw new Error('Messaggio mancante.');
      if (effect.message_type != null && !messageTypes.includes(String(effect.message_type)))
        throw new Error('Tipo di messaggio non supportato.');
      return;
    case 'roll':
      fields(effect, ['type', 'rolls', 'on_result_effect']);
      assertRollList(effect);
      if (effect.on_result_effect != null) validateEffect(object(effect.on_result_effect), definition, ancestors, budget, true);
      return;
    case 'showPopUp':
      assertPopUp(effect);
      if (nested) throw new Error('Popup dentro una sequenza non supportato.');
      return;
    default:
      throw new Error(`Effetto non supportato: ${String(effect.type)}`);
  }
}

function resourceWriteMode(type: unknown, aggregation: AggregationType): ResourceWriteMode {
  // Without an override layer only unambiguous base writes are possible: a replacement or an addition.
  if (type === 'setStat' && aggregation === 'set') return 'set';
  if (type === 'addToStat' && (aggregation === 'set' || aggregation === 'sum')) return 'add';
  throw new Error('Sulle risorse sono supportati solo setStat (set) e addToStat.');
}

/** Write one character stat as a reversible override owned by the current character mechanic,
 * or, for a `direct` character-mechanic write (not `$character` from a resource), as a base
 * replacement when that mechanic cannot be reverted (see `EffectContext.writeBase`). */
export function writeCharacterStat(ctx: EffectContext, type: unknown, statId: string, aggregation: AggregationType, value: Json,
  direct = false) {
  if (statId.includes('.') || statId.startsWith('$')) throw new Error('Destinazione annidata non supportata.');
  const stat = ctx.definition.character_stats.find(candidate => candidate.id === statId);
  if (!stat) throw new Error(`Statistica mancante: ${statId}`);
  if (!matchesType(value, stat.value_type, stat.sub_value_type))
    throw new Error(`Valore non valido per ${stat.id} (${stat.value_type}).`);
  // A non-revertible command (a rest, a card action) has no modifier layer to undo, so both a
  // replacement and an addition land on the base value: repeating a cast decrements it again.
  const cardAction = ctx.mechanicId.startsWith('resource-event:');
  if ((direct || cardAction) && stat.type === 'base' && (type === 'addToStat' || type === 'setStat' && aggregation === 'set')
    && ctx.writeBase?.(stat.id, value, type === 'addToStat' ? 'add' : 'set')) return;
  const override = { aggregation, value };
  if (type === 'addToStat') {
    if (!['integer', 'decimal'].includes(stat.value_type) || typeof value !== 'number')
      throw new Error('I modificatori richiedono una statistica numerica.');
    if (ctx.overrides[ctx.mechanicId]?.modifiers?.[stat.id])
      throw new Error('Riesecuzione di addToStat non verificata: modifica la statistica base.');
    ctx.overrides = applyOverride(ctx.overrides, ctx.mechanicId, 'modifiers', stat.id, override);
  } else ctx.overrides = applyOverride(ctx.overrides, ctx.mechanicId, 'values', stat.id, override);
}

/**
 * Route one stat write: a character stat, a base stat of the resource scope,
 * `$character.stat` from a resource scope, `$variable.stat` on a bound owned resource,
 * `resourceStat.stat` through a resource-valued stat of the resource scope, or a deeper owned path
 * such as `$parent.current_class_details.stat`.
 */
function applyStatEffect(effect: Record<string, unknown>, ctx: EffectContext) {
  const raw = effect.stat != null ? effect.stat : ctx.evaluate(effect.meta_stat);
  if (typeof raw !== 'string' || !raw || raw.length > 200) throw new Error('Destinazione dell’effetto non valida.');
  const aggregation = aggregationType(effect);
  const value = jsonValue(ctx.evaluate(effect.type === 'setStat' ? effect.new_value : effect.value));
  const nested = /^(\$?[\w-]{1,100})\.([\w-]{1,200})$/.exec(raw);
  if (nested && nested[1] === '$character' && ctx.scope) return ctx.scope.character(effect.type, nested[2], aggregation, value);
  if (nested && ctx.writeResource && nested[1].startsWith('$') && Object.hasOwn(ctx.variables, nested[1]))
    return ctx.writeResource(ctx.variables[nested[1]], nested[2], value, resourceWriteMode(effect.type, aggregation));
  if (nested && ctx.writeResource && ctx.scope && !nested[1].startsWith('$'))
    return ctx.writeResource(ctx.evaluate({ type: 'stat', stat: nested[1] }), nested[2], value, resourceWriteMode(effect.type, aggregation));
  // A deeper owned path from a resource scope (5e feat `$parent.current_class_details.selected_selectable_feature_ids`).
  const owner = /^(\$?[\w-]{1,100}(?:\.[\w-]{1,200}){0,4})\.([\w-]{1,200})$/.exec(raw);
  if (owner && ctx.writeResource && ctx.scope)
    return ctx.writeResource(ctx.evaluate({ type: 'stat', stat: owner[1] }), owner[2], value, resourceWriteMode(effect.type, aggregation));
  if (!ctx.scope) return writeCharacterStat(ctx, effect.type, raw, aggregation, value, true);
  if (raw.includes('.') || raw.startsWith('$')) throw new Error('Destinazione annidata non supportata.');
  ctx.scope.write(raw, value, resourceWriteMode(effect.type, aggregation));
}

/**
 * Roll immediately and expose the sum of every rolled formula as `$event.result` to `on_result_effect`
 * (5e short rest heals by the hit dice total). The command stays atomic: nothing persists if a later step fails.
 * @see https://docs.rpg-companion.app/Effects/roll
 */
function runRollResult(effect: Record<string, unknown>, rolls: PreparedRoll[], ctx: EffectContext, depth: number) {
  if (!ctx.rollNow) throw new Error('Effetto successivo al tiro non supportato.');
  const result = ctx.rollNow(rolls);
  const previous = ctx.variables.$event;
  ctx.variables.$event = { ...object(previous ?? {}), result };
  try { return executeEffect(object(effect.on_result_effect), ctx, depth + 1); }
  finally { ctx.variables.$event = previous; }
}

function runForEach(effect: Record<string, unknown>, ctx: EffectContext, depth: number) {
  const values = ctx.evaluate(effect.components);
  if (!Array.isArray(values) || values.length > 1000) throw new Error('Lista di iterazione non valida.');
  const key = typeof effect.for_each_value_key === 'string' ? effect.for_each_value_key : '$forEachValue';
  const previous = Object.hasOwn(ctx.variables, key) ? { present: true, value: ctx.variables[key] } : { present: false, value: undefined };
  try {
    for (const value of values) {
      ctx.variables[key] = value;
      const terminal = executeEffect(object(effect.apply), ctx, depth + 1);
      if (terminal) return terminal;
    }
  } finally {
    if (previous.present) ctx.variables[key] = previous.value; else delete ctx.variables[key];
  }
  return undefined;
}

/** Fire each listed name in order; an `eventName` with a resource targets that resource's mechanics. */
function fireNames(effect: Record<string, unknown>, ctx: EffectContext): EffectTerminal | undefined {
  for (const item of object(effect.event_names).components as unknown[]) {
    const node = object(item);
    const name = node.type === 'constant' ? node.value as string : node.event_name as string;
    let terminal: EffectTerminal | undefined;
    if (node.type === 'eventName' && node.for_resource != null) {
      if (!ctx.dispatchResource) throw new Error('Eventi di risorsa non supportati in questo contesto.');
      terminal = ctx.dispatchResource(ctx.evaluate(node.for_resource), name);
    } else terminal = ctx.dispatch({ name, payload: {} });
    if (terminal) return terminal;
  }
  return undefined;
}

/** Execute one validated effect, mutating only the command state. */
export function executeEffect(effect: Record<string, unknown>, ctx: EffectContext, depth = 0): EffectTerminal | undefined {
  if (++ctx.budget.nodes > 2000 || depth > 32) throw new Error('Evento troppo complesso.');
  switch (effect.type) {
    case 'sequence':
      for (const child of effect.effects as unknown[]) {
        const terminal = executeEffect(object(child), ctx, depth + 1);
        if (terminal) return terminal;
      }
      return;
    case 'when':
      for (const clause of effect.clauses as unknown[]) {
        const branch = object(clause), condition = ctx.evaluate(branch.condition);
        if (typeof condition !== 'boolean') throw new Error('Condizione evento non booleana.');
        if (!condition) continue;
        const target = object(branch.effect), unsupported = deferredBranches.get(target);
        if (unsupported) throw new Error(unsupported);
        return executeEffect(target, ctx, depth + 1);
      }
      // A `when` without a matching clause does nothing: sources guard one-off work this way (PF2e `characterLoaded`).
      return;
    case 'setStat':
    case 'addToStat':
      applyStatEffect(effect, ctx);
      return;
    case 'fireEvent':
      return effect.event_names == null ? ctx.dispatch(effect.event) : fireNames(effect, ctx);
    case 'forwardEvent': {
      const names = ctx.evaluate(effect.new_event_names);
      if (!Array.isArray(names) || names.length !== 1 || typeof names[0] !== 'string')
        throw new Error('Inoltro multiplo o dinamico non supportato.');
      return ctx.dispatch({ name: names[0], payload: object(ctx.variables.$event ?? {}) });
    }
    case 'forEach':
      return runForEach(effect, ctx, depth);
    case 'delayed':
      if (object(effect.effect).type === 'dismissResource') return undefined;
      throw new Error('Effetto ritardato non supportato.');
    case 'dismissResource':
      // Closing the sheet that shows the resource is left to the user; nothing in the data changes.
      return undefined;
    case 'showMessage': {
      const text = ctx.evaluate(effect.message);
      if (typeof text !== 'string' || !text || text.length > 2000) throw new Error('Messaggio non valido.');
      const type = effect.message_type == null ? 'info' : String(effect.message_type);
      if (!messageTypes.includes(type)) throw new Error('Tipo di messaggio non supportato.');
      ctx.messages.push({ text, type: type as EventMessage['type'] });
      return;
    }
    case 'roll': {
      const rolls = preparedRolls(effect, ctx);
      if (effect.on_result_effect != null) return runRollResult(effect, rolls, ctx, depth);
      if (!ctx.pendingRolls) return { kind: 'roll', rolls };
      if (ctx.pendingRolls.length + rolls.length > 20) throw new Error('Troppi tiri per evento.');
      ctx.pendingRolls.push(...rolls);
      return undefined;
    }
    case 'showPopUp':
      return { kind: 'popup', effect };
    default:
      throw new Error(`Effetto non supportato: ${String(effect.type)}`);
  }
}

function preparedRolls(effect: Record<string, unknown>, ctx: EffectContext): PreparedRoll[] {
  const list = object(effect.rolls);
  if (list.type === 'map') {
    const items = ctx.evaluate(list.components);
    if (!Array.isArray(items) || items.length > 10) throw new Error('Lista tiri non valida.');
    const previous = Object.hasOwn(ctx.variables, '$mapValue') ? { value: ctx.variables.$mapValue } : undefined;
    try {
      return items.map(item => { ctx.variables.$mapValue = item; return preparedRoll(object(list.mapper), ctx); });
    } finally { if (previous) ctx.variables.$mapValue = previous.value; else delete ctx.variables.$mapValue; }
  }
  return (list.components as unknown[]).map(item => preparedRoll(object(item), ctx));
}

function preparedRoll(rollable: Record<string, unknown>, ctx: EffectContext): PreparedRoll {
  const formulas = ctx.evaluate(rollable.formulas), text = ctx.evaluate(rollable.text);
  if (typeof text !== 'string' || !Array.isArray(formulas) || !formulas.length || formulas.length > 10
    || formulas.some(formula => typeof formula !== 'string'))
    throw new Error('Formule o etichetta tiro non valide.');
  return { text, formulas: formulas as string[] };
}
