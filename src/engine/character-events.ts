/** @file Bounded character events and direct-field popup edits, without persistent effect overrides. */
import { jsonValue, object, type Character, type ResourceInstance, type StoredSystem, type SystemDefinition } from '../domain/model';
import { createEvaluator, RuntimeResource } from './formulas';
import { rollDice } from './dice';
import { enumerationEntries } from './enumerations';

function fields(node: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(node).some(key => node[key] != null && !allowed.includes(key))) throw new Error('Opzione evento o effetto non supportata.');
}

/** Require exactly one unconditional character mechanic; never guess subscription or execution order. */
export function characterEventEffect(system: SystemDefinition, event: unknown, ancestors: string[] = [], budget = { nodes: 0 }) {
  const input = object(event);
  fields(input, ['name', 'payload']);
  if (typeof input.name !== 'string' || !input.name || input.name.length > 200) throw new Error('Nome evento non valido.');
  if (ancestors.length >= 8 || ancestors.includes(input.name)) throw new Error('Ciclo o catena eventi troppo lunga.');
  const mechanics = Array.isArray(system.mechanics) ? system.mechanics.map(item => object(item)) : [];
  if (mechanics.some(mechanic => mechanic.calculated_event_names != null))
    throw new Error('Le sottoscrizioni dinamiche richiedono un dispatcher completo.');
  const matches = mechanics.filter(mechanic => mechanic.event_names === input.name
    || Array.isArray(mechanic.event_names) && mechanic.event_names.includes(input.name));
  if (matches.length !== 1) throw new Error('Evento senza un singolo gestore carattere supportato.');
  fields(matches[0], ['id', 'name', 'description', 'event_names', 'effects', 'revert_event_names']);
  if (matches[0].revert_event_names != null && matches[0].revert_event_names !== '')
    throw new Error('La reversibilità richiede il dispatcher completo.');
  const effect = object(matches[0].effects);
  validateEffect(effect, system, [...ancestors, input.name], budget);
  return effect;
}

/** Validate every branch before any action; forwarding is static, single-target and acyclic. */
function validateEffect(effect: Record<string, unknown>, system: SystemDefinition, ancestors: string[], budget: { nodes: number }) {
  if (++budget.nodes > 2000) throw new Error('Evento troppo complesso.');
  if (effect.type === 'showPopUp') {
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
  } else if (effect.type === 'roll') {
    fields(effect, ['type', 'rolls']);
    const list = object(effect.rolls);
    fields(list, ['type', 'components']);
    if (list.type !== 'list' || !Array.isArray(list.components) || !list.components.length || list.components.length > 10)
      throw new Error('Lista tiri non supportata.');
    for (const item of list.components) {
      const rollable = object(item); fields(rollable, ['type', 'formulas', 'text']);
      if (rollable.type !== 'rollable' || !rollable.formulas || !rollable.text) throw new Error('Tiro non supportato.');
    }
  } else if (effect.type === 'when') {
    fields(effect, ['type', 'clauses']);
    if (!Array.isArray(effect.clauses) || !effect.clauses.length || effect.clauses.length > 10 || ancestors.length >= 8)
      throw new Error('Diramazione evento non supportata.');
    for (const clause of effect.clauses) {
      const branch = object(clause); fields(branch, ['condition', 'effect']);
      validateEffect(object(branch.effect), system, [...ancestors, '<when>'], budget);
    }
  } else if (effect.type === 'forwardEvent') {
    fields(effect, ['type', 'new_event_names']);
    const names = forwardedNames(effect);
    characterEventEffect(system, { name: names[0] }, ancestors, budget);
  } else throw new Error(`Effetto non supportato: ${String(effect.type)}`);
}

function forwardedNames(effect: Record<string, unknown>) {
  const list = object(effect.new_event_names); fields(list, ['type', 'components']);
  if (list.type !== 'list' || !Array.isArray(list.components) || list.components.length !== 1)
    throw new Error('Inoltro multiplo o dinamico non supportato.');
  const name = object(list.components[0]); fields(name, ['type', 'value', 'value_type', 'sub_value_type']);
  if (name.type !== 'constant' || name.value_type !== 'string' || typeof name.value !== 'string')
    throw new Error('Inoltro dinamico non supportato.');
  return [name.value];
}

function resolvedEffect(effect: Record<string, unknown>, system: SystemDefinition,
  evaluate: (value: unknown) => unknown, depth = 0): Record<string, unknown> {
  if (depth >= 8) throw new Error('Catena eventi troppo lunga.');
  if (effect.type === 'forwardEvent')
    return resolvedEffect(characterEventEffect(system, { name: forwardedNames(effect)[0] }), system, evaluate, depth + 1);
  if (effect.type !== 'when') return effect;
  for (const clause of effect.clauses as unknown[]) {
    const branch = object(clause), condition = evaluate(branch.condition);
    if (typeof condition !== 'boolean') throw new Error('Condizione evento non booleana.');
    if (condition) return resolvedEffect(object(branch.effect), system, evaluate, depth + 1);
  }
  throw new Error('Nessuna condizione evento soddisfatta.');
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

/** Evaluate against one immutable command snapshot; randomness is available only at explicit roll execution. */
export function executeCharacterEvent(system: StoredSystem, character: Character, resources: ResourceInstance[],
  event: unknown, random?: (faces: number) => number) {
  if (character.systemKey !== system.key) throw new Error('Sistema evento non corrispondente.');
  const initialEffect = characterEventEffect(system.definition, event);
  const input = object(event);
  const environment = { resources, resourceDefinitions: system.definition.resources, createdAt: character.createdAt,
    enumerations: system.definition.enumerated_types,
    character: new RuntimeResource(`character:${character.id}`, system.definition.character_stats, character.values, character.createdAt) };
  const payload = input.payload == null ? {} : object(input.payload);
  if (input.payload != null && (typeof input.payload !== 'object' || Array.isArray(input.payload)))
    throw new Error('Payload evento non valido.');
  if (Object.keys(payload).length > 50) throw new Error('Payload evento troppo grande.');
  const eventValues = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, jsonValue(value)]));
  const variables = { $event: eventValues, $edit_mode: false };
  const evaluator = createEvaluator(system.definition.character_stats, character.values, undefined, { ...environment, variables });
  const effect = resolvedEffect(initialEffect, system.definition, evaluator.evaluate);
  if (effect.type === 'showPopUp') {
    const title = evaluator.evaluate(effect.pop_up_title);
    if (typeof title !== 'string') throw new Error('Il titolo evento deve essere testo.');
    const edit = effect.should_persist_on_save === true ? editablePopup(effect, system.definition, evaluator.evaluate) : undefined;
    return { kind: 'popup' as const, title, input: edit?.input ?? effect.pop_up_view, variables, edit };
  }
  const prepared = (object(effect.rolls).components as unknown[]).map(item => {
    const rollable = object(item);
    const formulas = evaluator.evaluate(rollable.formulas), text = evaluator.evaluate(rollable.text);
    if (typeof text !== 'string' || !Array.isArray(formulas) || !formulas.length || formulas.length > 10
      || formulas.some(formula => typeof formula !== 'string')) throw new Error('Formule o etichetta tiro non valide.');
    return { text, formulas: formulas as string[] };
  });
  let dice = 0;
  // Preflight every expression before drawing randomness, so unsupported later rolls cannot partly execute.
  for (const row of prepared) for (const expression of row.formulas) {
    rollEventDice(expression, () => { if (++dice > 100) throw new Error('Troppi dadi per evento.'); return 1; });
  }
  return { kind: 'roll' as const, title: String(input.name),
    rolls: prepared.map(row => ({ text: row.text, results: row.formulas.map(expression => rollEventDice(expression, random)) })) };
}
