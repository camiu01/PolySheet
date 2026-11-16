/** @file Source-derived level/HP assistance over effective character values. */
import { isResourceReference, object, type Character, type ResourceInstance, type StoredSystem } from '../domain/model';
import { createEvaluator, RuntimeResource } from './formulas';
import { resolveCharacterOverrides } from './overrides';
import { rollDice } from './dice';
import { it } from '../ui/it';

/** A reviewed command changes one class; other source choices remain an explicit checklist. */
export interface ProgressionRequest {
  wrapperId: string;
  targetLevel: number;
  archetypeId: string | null;
  acknowledgeChoices: boolean;
  expectedClassLevel?: number;
}

function nodes(input: unknown, predicate: (node: Record<string, unknown>) => boolean, depth = 0): Record<string, unknown>[] {
  if (depth > 64) throw new Error(it.progressionUnsupported);
  if (!input || typeof input !== 'object') return [];
  const children = Array.isArray(input) ? input : Object.values(input);
  const found = !Array.isArray(input) && predicate(object(input)) ? [object(input)] : [];
  return [...found, ...children.flatMap(value => nodes(value, predicate, depth + 1))];
}

/** Recognize the imported class/health branches; never substitute independent RPG tables. */
export function progressionContract(system: StoredSystem) {
  const input = object(system.definition.progression_systems.experience_levelling_system);
  const effects = object(input.on_level_up_confirm).effects;
  if (!Array.isArray(effects) || object(input.on_level_up_confirm).type !== 'sequence') throw new Error(it.progressionUnsupported);
  const branch = object(effects[2]);
  if (branch.type !== 'when' || !Array.isArray(branch.clauses) || branch.clauses.length !== 2) throw new Error(it.progressionUnsupported);
  const existing = object(branch.clauses[0]).effect, multiclass = object(branch.clauses[1]).effect;
  const increments = nodes(existing, node => node.type === 'addToStat' && node.stat === '$class_details.class_level');
  const hp = [existing, multiclass].map(input => nodes(input, node => node.type === 'when'
    && Array.isArray(node.clauses) && node.clauses.length === 3
    && node.clauses.every(clause => object(object(clause).effect).stat === 'base_hp')));
  if (increments.length !== 1 || increments[0].aggregation_type !== 'set' || hp.some(list => list.length !== 1)
    || input.level_stat_name !== 'level' || !Array.isArray(input.tables)) throw new Error(it.progressionUnsupported);
  const levels = input.tables.flatMap(table => Object.values(object(object(table).experience_to_level_table)));
  if (!levels.length || levels.some(level => typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1))
    throw new Error(it.progressionUnsupported);
  return { increment: increments[0].value, health: hp.map(list => list[0]), maxLevel: Math.max(...levels as number[]) };
}

/** Build fresh evaluators whenever a staged class or character value changes. */
export function progressionEvaluator(system: StoredSystem, character: Character, resources: ResourceInstance[], variables = {}) {
  if (character.systemKey !== system.key || resources.some(record => record.systemKey !== system.key)) throw new Error(it.progressionUnsupported);
  const overrides = resolveCharacterOverrides(character.overrides);
  return createEvaluator(system.definition.character_stats, character.values, undefined, {
    resources, resourceDefinitions: system.definition.resources, enumerations: system.definition.enumerated_types,
    createdAt: character.createdAt, variables, overrides: overrides.values, modifiers: overrides.modifiers,
    character: new RuntimeResource(`character:${character.id}`, system.definition.character_stats, character.values, character.createdAt, {}, overrides.values, undefined, overrides.modifiers)
  });
}

/** Resolve only wrappers actually assigned to this owner and exact system pin. */
export function progressionClasses(system: StoredSystem, character: Character, resources: ResourceInstance[]) {
  if (!Array.isArray(character.values.classes)) throw new Error(it.progressionUnsupported);
  const evaluator = progressionEvaluator(system, character, resources);
  return character.values.classes.map(value => {
    if (!isResourceReference(value)) throw new Error(it.progressionUnsupported);
    const record = resources.find(record => record.id === value.resourceId && record.definitionId === 'class_details');
    if (!record || record.catalogSource || !isResourceReference(record.values.class)) throw new Error(it.progressionUnsupported);
    const scope = progressionEvaluator(system, character, resources, { $details: { resourceId: record.id } });
    const id = scope.get('$details.class.id'), name = scope.get('$details.class.name'), level = scope.get('$details.class_level');
    if (typeof id !== 'string' || typeof name !== 'string' || typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1)
      throw new Error(it.progressionUnsupported);
    return { record, id, name, level, total: evaluator.get('level') };
  });
}

/** Read subclass choices and the actual selection threshold from the selected imported class. */
export function progressionArchetypes(system: StoredSystem, character: Character, resources: ResourceInstance[], wrapperId: string, nextClassLevel: number) {
  const evaluator = progressionEvaluator(system, character, resources, { $details: { resourceId: wrapperId } });
  const options = evaluator.get('$details.class.archetypes');
  const threshold = evaluator.get('$details.class.archetype_selection_level');
  if (!Array.isArray(options) || typeof threshold !== 'number' || !Number.isSafeInteger(threshold)) throw new Error(it.progressionUnsupported);
  return {
    threshold,
    required: options.length > 0 && evaluator.get('$details.archetype_id') == null && nextClassLevel >= threshold,
    options: options.map(option => {
      const scoped = progressionEvaluator(system, character, resources, { $option: option });
      const id = scoped.get('$option.id'), name = scoped.get('$option.name');
      if (typeof id !== 'string' || typeof name !== 'string') throw new Error(it.progressionUnsupported);
      return { id, name };
    })
  };
}

function healthGain(system: StoredSystem, character: Character, resources: ResourceInstance[], wrapper: ResourceInstance,
  input: Record<string, unknown>, random?: (faces: number) => number) {
  const definition = system.definition.resources.find(definition => definition.id === wrapper.definitionId);
  if (!definition) throw new Error(it.progressionUnsupported);
  const evaluator = progressionEvaluator(system, character, resources, {
    $class_details: new RuntimeResource(`resource:${wrapper.id}`, definition.stats, wrapper.values, wrapper.createdAt)
  });
  if (!Array.isArray(input.clauses)) throw new Error(it.progressionUnsupported);
  const matching = input.clauses.filter(clause => evaluator.evaluate(object(clause).condition) === true);
  if (matching.length !== 1) throw new Error(it.progressionUnsupported);
  const effect = object(object(matching[0]).effect);
  if (effect.type !== 'addToStat' || effect.stat !== 'base_hp' || effect.aggregation_type !== 'set') throw new Error(it.progressionUnsupported);
  const value = object(effect.value);
  if (value.type !== 'roll') return integer(evaluator.evaluate(value));
  const expression = evaluator.evaluate(value.formula);
  if (typeof expression !== 'string' || !/^1d\d{1,7}$/.test(expression)) throw new Error(it.progressionUnsupported);
  return rollDice(expression, undefined, random).total;
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(it.progressionUnsupported);
  return value;
}

/** Stage permanent manual advancement using imported increments, HP formulas and subclass identities.
 * @remarks This deliberately does not emulate addToStat override aggregation or execute popup callbacks.
 * Current HP stays unchanged, as in the inspected source branch. No randomness occurs without this command.
 */
export function planProgression(system: StoredSystem, character: Character, resources: ResourceInstance[], request: ProgressionRequest,
  newClass = false, random?: (faces: number) => number) {
  const contract = progressionContract(system), classes = progressionClasses(system, character, resources);
  const selected = classes.find(choice => choice.record.id === request.wrapperId);
  const start = integer(progressionEvaluator(system, character, resources).get('level')) - (newClass ? 1 : 0);
  if (!selected || request.expectedClassLevel != null && !newClass && selected.level !== request.expectedClassLevel
    || !request.acknowledgeChoices || !Number.isSafeInteger(request.targetLevel)
    || request.targetLevel <= start || request.targetLevel > contract.maxLevel || request.targetLevel - start > 100)
    throw new Error(it.progressionUnsupported);
  const values: Character['values'] = { ...character.values, temp_last_level_up_class_id: selected.id };
  let staged = resources.map(record => ({ ...record, values: { ...record.values } }));
  let wrapper = staged.find(record => record.id === selected.record.id)!;
  const choices = progressionArchetypes(system, { ...character, values }, staged, wrapper.id,
    selected.level + request.targetLevel - start - (newClass ? 1 : 0));
  if (choices.required && !choices.options.some(option => option.id === request.archetypeId)
    || request.archetypeId != null && !choices.options.some(option => option.id === request.archetypeId))
    throw new Error(it.progressionArchetypeRequired);
  if (wrapper.values.archetype_id != null && request.archetypeId != null && request.archetypeId !== wrapper.values.archetype_id)
    throw new Error(it.progressionArchetypeRequired);
  for (let next = start + 1; next <= request.targetLevel; next++) {
    const isNew = newClass && next === start + 1;
    if (!isNew) {
      const amount = integer(progressionEvaluator(system, { ...character, values }, staged).evaluate(contract.increment));
      if (amount !== 1) throw new Error(it.progressionUnsupported);
      wrapper.values.class_level = integer(wrapper.values.class_level) + amount;
    }
    if (request.archetypeId != null && integer(wrapper.values.class_level) >= choices.threshold)
      wrapper.values.archetype_id = request.archetypeId;
    const gain = healthGain(system, { ...character, values }, staged, wrapper, contract.health[isNew ? 1 : 0], random);
    if (gain < 1) throw new Error(it.progressionUnsupported);
    values.base_hp = integer(values.base_hp) + gain;
  }
  const evaluator = progressionEvaluator(system, { ...character, values }, staged);
  const level = integer(evaluator.get('level')), maxHp = integer(evaluator.get('max_hp'));
  if (level !== request.targetLevel || maxHp < 1) throw new Error(it.progressionUnsupported);
  return { values, wrapper, level, maxHp, baseHpGain: integer(values.base_hp) - integer(character.values.base_hp) };
}
