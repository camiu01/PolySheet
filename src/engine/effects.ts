/**
 * @file Bounded validation and execution of the documented character effect subset.
 * @remarks Events, `$view` drafts, resource-owned mechanics and asynchronous
 * effects are outside this scope and fail explicitly instead of becoming no-ops.
 * @see https://docs.rpg-companion.app/Effects/sequence
 * @see https://docs.rpg-companion.app/Mechanic/
 */
import { jsonValue, matchesType, object, type AggregationType, type CharacterOverrides, type ResourceInstance, type Stat, type SystemDefinition } from '../domain/model';
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
  evaluate(value: unknown): unknown;
  dispatch(event: unknown): EffectTerminal | undefined;
}

const messageTypes = ['info', 'warning', 'error', 'success'];

function fields(node: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(node).some(key => node[key] != null && !allowed.includes(key)))
    throw new Error('Opzione evento o effetto non supportata.');
}

/** Accept the source's comma-separated string or an explicit string list. */
export function eventNames(value: unknown): string[] {
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

function assertPopUp(effect: Record<string, unknown>) {
  fields(effect, ['type', 'pop_up_view', 'pop_up_title', 'pop_up_type', 'display_cancel_button',
    'display_save_button', 'should_persist_on_save']);
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
export function validateEffect(effect: Record<string, unknown>, definition: SystemDefinition,
  ancestors: string[], budget: { nodes: number }, nested = false) {
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
        validateEffect(object(branch.effect), definition, [...ancestors, '<when>'], budget, nested);
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
      if (effect.event == null && effect.event_names == null) throw new Error('Evento da emettere mancante.');
      if (effect.event_names != null) throw new Error('Nomi evento dinamici non supportati.');
      assertEvent(effect.event);
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
    case 'showMessage':
      fields(effect, ['type', 'message', 'message_type']);
      if (effect.message == null) throw new Error('Messaggio mancante.');
      if (effect.message_type != null && !messageTypes.includes(String(effect.message_type)))
        throw new Error('Tipo di messaggio non supportato.');
      return;
    case 'roll':
      fields(effect, ['type', 'rolls', 'on_result_effect']);
      if (effect.on_result_effect != null) throw new Error('Effetto successivo al tiro non supportato.');
      assertRollList(effect);
      if (nested) throw new Error('Tiro dentro una sequenza non supportato.');
      return;
    case 'showPopUp':
      assertPopUp(effect);
      if (nested) throw new Error('Popup dentro una sequenza non supportato.');
      return;
    default:
      throw new Error(`Effetto non supportato: ${String(effect.type)}`);
  }
}

function targetStat(effect: Record<string, unknown>, ctx: EffectContext): Stat {
  const raw = effect.stat != null ? effect.stat : ctx.evaluate(effect.meta_stat);
  if (typeof raw !== 'string' || !raw || raw.length > 200) throw new Error('Destinazione dell’effetto non valida.');
  if (raw.includes('.') || raw.startsWith('$')) throw new Error('Destinazione annidata non supportata.');
  const stat = ctx.definition.character_stats.find(candidate => candidate.id === raw);
  if (!stat) throw new Error(`Statistica mancante: ${raw}`);
  return stat;
}

function applyStatEffect(effect: Record<string, unknown>, ctx: EffectContext) {
  const stat = targetStat(effect, ctx);
  const override = effect.type === 'setStat'
    ? { aggregation: aggregationType(effect), value: jsonValue(ctx.evaluate(effect.new_value)) }
    : { aggregation: aggregationType(effect), value: jsonValue(ctx.evaluate(effect.value)) };
  if (!matchesType(override.value, stat.value_type, stat.sub_value_type))
    throw new Error(`Valore non valido per ${stat.id} (${stat.value_type}).`);
  if (effect.type === 'addToStat') {
    if (!['integer', 'decimal'].includes(stat.value_type) || typeof override.value !== 'number')
      throw new Error('I modificatori richiedono una statistica numerica.');
    if (ctx.overrides[ctx.mechanicId]?.modifiers?.[stat.id])
      throw new Error('Riesecuzione di addToStat non verificata: modifica la statistica base.');
    ctx.overrides = applyOverride(ctx.overrides, ctx.mechanicId, 'modifiers', stat.id, override);
  } else ctx.overrides = applyOverride(ctx.overrides, ctx.mechanicId, 'values', stat.id, override);
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
        if (condition) return executeEffect(object(branch.effect), ctx, depth + 1);
      }
      throw new Error('Nessuna condizione evento soddisfatta.');
    case 'setStat':
    case 'addToStat':
      applyStatEffect(effect, ctx);
      return;
    case 'fireEvent':
      return ctx.dispatch(effect.event);
    case 'forwardEvent': {
      const names = ctx.evaluate(effect.new_event_names);
      if (!Array.isArray(names) || names.length !== 1 || typeof names[0] !== 'string')
        throw new Error('Inoltro multiplo o dinamico non supportato.');
      return ctx.dispatch({ name: names[0], payload: object(ctx.variables.$event ?? {}) });
    }
    case 'forEach':
      return runForEach(effect, ctx, depth);
    case 'showMessage': {
      const text = ctx.evaluate(effect.message);
      if (typeof text !== 'string' || !text || text.length > 2000) throw new Error('Messaggio non valido.');
      const type = effect.message_type == null ? 'info' : String(effect.message_type);
      if (!messageTypes.includes(type)) throw new Error('Tipo di messaggio non supportato.');
      ctx.messages.push({ text, type: type as EventMessage['type'] });
      return;
    }
    case 'roll':
      return { kind: 'roll', rolls: preparedRolls(effect, ctx) };
    case 'showPopUp':
      return { kind: 'popup', effect };
    default:
      throw new Error(`Effetto non supportato: ${String(effect.type)}`);
  }
}

function preparedRolls(effect: Record<string, unknown>, ctx: EffectContext): PreparedRoll[] {
  return (object(effect.rolls).components as unknown[]).map(item => {
    const rollable = object(item);
    const formulas = ctx.evaluate(rollable.formulas), text = ctx.evaluate(rollable.text);
    if (typeof text !== 'string' || !Array.isArray(formulas) || !formulas.length || formulas.length > 10
      || formulas.some(formula => typeof formula !== 'string'))
      throw new Error('Formule o etichetta tiro non valide.');
    return { text, formulas: formulas as string[] };
  });
}
