/** @file Source-derived level/HP assistance over effective character values. */
import { isResourceReference, object, type Character, type ResourceInstance, type StoredSystem } from '../domain/model';
import { createEvaluator, RuntimeResource } from './formulas';
import { resolveCharacterOverrides } from './overrides';
import { rollDice } from './dice';
import { it } from '../ui/it';
import { stageSelectableFeatures, type SelectableFeatureChoice } from './progression-selectable';

/** A reviewed command changes one class and its selected features; other choices remain explicit. */
export interface ProgressionRequest {
  wrapperId: string;
  targetLevel: number;
  archetypeId: string | null;
  acknowledgeChoices: boolean;
  expectedClassLevel?: number;
  /** New value of the imported `hit_point_mode` choice, saved before the HP formulas run. */
  hitPointMode?: string;
  /** Draft feature selections committed atomically with this advancement. */
  selectableFeatures?: SelectableFeatureChoice[];
}

/** The imported HP methods (5e `hit_point_modes`: roll, average, max); empty when the system has none. */
export function hitPointModes(system: StoredSystem) {
  const enumeration = system.definition.enumerated_types.find(item => !!item && typeof item === 'object' && object(item).id === 'hit_point_modes');
  const types = enumeration ? object(enumeration).types : undefined;
  return (Array.isArray(types) ? types : []).flatMap(item => {
    const entry = item && typeof item === 'object' ? object(item) : {};
    return typeof entry.id === 'string' && typeof entry.name === 'string' ? [{ id: entry.id, name: entry.name }] : [];
  });
}

function nodes(input: unknown, predicate: (node: Record<string, unknown>) => boolean, depth = 0): Record<string, unknown>[] {
  if (depth > 64) throw new Error(it.progressionUnsupported);
  if (!input || typeof input !== 'object') return [];
  const children = Array.isArray(input) ? input : Object.values(input);
  const found = !Array.isArray(input) && predicate(object(input)) ? [object(input)] : [];
  return [...found, ...children.flatMap(value => nodes(value, predicate, depth + 1))];
}

/** Highest level of the imported experience tables. */
function tableMaxLevel(input: Record<string, unknown>) {
  if (input.level_stat_name !== 'level' || !Array.isArray(input.tables)) throw new Error(it.progressionUnsupported);
  const levels = input.tables.flatMap(table => Object.values(object(object(table).experience_to_level_table)));
  if (!levels.length || levels.some(level => typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1))
    throw new Error(it.progressionUnsupported);
  return Math.max(...levels as number[]);
}

/**
 * PF2e shape: one `forEach` over `level_up_selected_class_progression` adding to
 * `$class_progression.class_level`. HP is calculated from levels, so nothing is rolled; the
 * per-level grant and proficiency popups that follow stay choices to complete on the sheet.
 */
function classProgressionContract(input: Record<string, unknown>, effects: unknown[]) {
  const loops = effects.map(item => object(item)).filter(item => item.type === 'forEach'
    && JSON.stringify(item.components) === JSON.stringify({ type: 'list', components: [{ type: 'stat', stat: 'level_up_selected_class_progression' }] }));
  const increments = loops.flatMap(loop => nodes(loop.apply, node => node.type === 'addToStat'
    && node.stat === `${String(loop.for_each_value_key)}.class_level`));
  if (loops.length !== 1 || increments.length !== 1 || increments[0].aggregation_type !== 'set') throw new Error(it.progressionUnsupported);
  return { kind: 'class_progression' as const, wrapper: 'class_progression', increment: increments[0].value,
    health: [] as Record<string, unknown>[], maxLevel: tableMaxLevel(input) };
}

/** Recognize the imported class/health branches; never substitute independent RPG tables. */
export function progressionContract(system: StoredSystem) {
  const input = object(system.definition.progression_systems.experience_levelling_system);
  const effects = object(input.on_level_up_confirm).effects;
  if (!Array.isArray(effects) || object(input.on_level_up_confirm).type !== 'sequence') throw new Error(it.progressionUnsupported);
  if (effects.some(item => object(item).type === 'forEach' && JSON.stringify(object(item).components).includes('"level_up_selected_class_progression"')))
    return classProgressionContract(input, effects);
  const branch = object(effects[2]);
  if (branch.type !== 'when' || !Array.isArray(branch.clauses) || branch.clauses.length !== 2) throw new Error(it.progressionUnsupported);
  const existing = object(branch.clauses[0]).effect, multiclass = object(branch.clauses[1]).effect;
  const increments = nodes(existing, node => node.type === 'addToStat' && node.stat === '$class_details.class_level');
  const hp = [existing, multiclass].map(input => nodes(input, node => node.type === 'when'
    && Array.isArray(node.clauses) && node.clauses.length === 3
    && node.clauses.every(clause => object(object(clause).effect).stat === 'base_hp')));
  if (increments.length !== 1 || increments[0].aggregation_type !== 'set' || hp.some(list => list.length !== 1))
    throw new Error(it.progressionUnsupported);
  return { kind: 'class_details' as const, wrapper: 'class_details', increment: increments[0].value,
    health: hp.map(list => list[0]), maxLevel: tableMaxLevel(input) };
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
    const wrapperType = system.definition.character_stats.find(stat => stat.id === 'classes')?.resource_type;
    const record = resources.find(record => record.id === value.resourceId && record.definitionId === wrapperType);
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
  // PF2e classes declare no subclass list here: archetypes are dedication feats chosen on the sheet.
  if (!system.definition.resources.find(definition => definition.id === 'class')?.stats.some(stat => stat.id === 'archetype_selection_level'))
    return { threshold: Number.MAX_SAFE_INTEGER, required: false, options: [] as { id: string; name: string }[] };
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

/** Stage permanent advancement using imported increments, HP formulas, subclass and feature identities.
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
  const maxHpBefore = contract.kind === 'class_progression' ? integer(progressionEvaluator(system, character, resources).get('max_hp')) : 0;
  let staged = resources.map(record => ({ ...record, values: { ...record.values } }));
  let wrapper = staged.find(record => record.id === selected.record.id)!;
  const choices = progressionArchetypes(system, { ...character, values }, staged, wrapper.id,
    selected.level + request.targetLevel - start - (newClass ? 1 : 0));
  if (choices.required && !choices.options.some(option => option.id === request.archetypeId)
    || request.archetypeId != null && !choices.options.some(option => option.id === request.archetypeId))
    throw new Error(it.progressionArchetypeRequired);
  if (wrapper.values.archetype_id != null && request.archetypeId != null && request.archetypeId !== wrapper.values.archetype_id)
    throw new Error(it.progressionArchetypeRequired);
  stageSelectableFeatures(system, { ...character, values }, staged, wrapper, request.selectableFeatures ?? [],
    selected.level + request.targetLevel - start - (newClass ? 1 : 0), request.archetypeId);
  for (let next = start + 1; next <= request.targetLevel; next++) {
    const isNew = newClass && next === start + 1;
    if (!isNew) {
      const amount = integer(progressionEvaluator(system, { ...character, values }, staged).evaluate(contract.increment));
      if (amount !== 1) throw new Error(it.progressionUnsupported);
      wrapper.values.class_level = integer(wrapper.values.class_level) + amount;
    }
    if (request.archetypeId != null && integer(wrapper.values.class_level) >= choices.threshold)
      wrapper.values.archetype_id = request.archetypeId;
    if (contract.kind === 'class_progression') continue;
    const gain = healthGain(system, { ...character, values }, staged, wrapper, contract.health[isNew ? 1 : 0], random);
    if (gain < 1) throw new Error(it.progressionUnsupported);
    values.base_hp = integer(values.base_hp) + gain;
  }
  const evaluator = progressionEvaluator(system, { ...character, values }, staged);
  const level = integer(evaluator.get('level')), maxHp = integer(evaluator.get('max_hp'));
  if (level !== request.targetLevel || maxHp < 1) throw new Error(it.progressionUnsupported);
  // 5e reports the rolled base HP; PF2e has no base gain, so the derived maximum's change is reported.
  return { values, wrapper, level, maxHp,
    baseHpGain: contract.kind === 'class_progression' ? maxHp - maxHpBefore : integer(values.base_hp) - integer(character.values.base_hp) };
}

/** What one advancement changed, read from the imported formulas before and after the command. */
export interface ProgressionSummary {
  /** Scalar character stats shown on the sheet whose value changed. */
  improved: { name: string; before: unknown; after: unknown }[];
  /** Class features available after the command that were not before (5e `class_details.features`). */
  features: string[];
  /** New or updated features that now offer selectable choices. */
  choices: string[];
}

/** Values the summary compares; a stat that cannot be evaluated in either state is left out of the comparison. */
export function progressionSnapshot(system: StoredSystem, character: Character, resources: ResourceInstance[], wrapperId?: string,
  withStats = true) {
  const ids = new Set<string>();
  nodes(system.definition.character_sheet_sections, node => node.type === 'stat' && typeof node.stat === 'string')
    .forEach(node => ids.add(node.stat as string));
  const evaluator = progressionEvaluator(system, character, resources);
  const stats = new Map<string, { name: string; value: unknown }>();
  for (const stat of system.definition.character_stats) {
    if (!withStats || !ids.has(stat.id) || !['integer', 'decimal', 'string'].includes(stat.value_type)) continue;
    const value = readOrSkip(() => evaluator.get(stat.id));
    if (value !== undefined) stats.set(stat.id, { name: stat.name, value });
  }
  const features = new Map<string, boolean>();
  if (wrapperId && resources.some(record => record.id === wrapperId)) {
    const context = { $details: { resourceId: wrapperId } };
    const scope = progressionEvaluator(system, character, resources, context);
    // 5e wraps `class.current_level_features` as `class_details.features`; PF2e reads the class directly.
    const own = readOrSkip(() => scope.get('$details.features'));
    const list = Array.isArray(own) ? own : readOrSkip(() => scope.get('$details.class.current_level_features'));
    (Array.isArray(list) ? list : []).forEach(feature => {
      const item = progressionEvaluator(system, character, resources, { ...context, $feature: feature });
      const name = readOrSkip(() => item.get('$feature.name'));
      if (typeof name !== 'string') return;
      // A choice is open only while fewer options are chosen than the level allows, so one made in the form is not listed.
      const chosen = readOrSkip(() => item.get('$feature.chosen_selectable_features'));
      const allowed = readOrSkip(() => item.get('$feature.current_allowed_amount_of_selectable_features'));
      const filled = Array.isArray(chosen) && typeof allowed === 'number' && chosen.length >= allowed;
      features.set(name, !filled && readOrSkip(() => item.get('$feature.can_choose_new_selectable_features_in_current_level')) === true);
    });
  }
  return { stats, features };
}

/** Display-only reads: an imported formula that fails for this character is not shown, never guessed. */
function readOrSkip(read: () => unknown) {
  try { return read(); } catch { return undefined; }
}

/** Compare two snapshots of the same character. */
export function progressionSummary(before: ReturnType<typeof progressionSnapshot>, after: ReturnType<typeof progressionSnapshot>): ProgressionSummary {
  const improved = [...after.stats].flatMap(([id, next]) => {
    const previous = before.stats.get(id);
    // Sheet colors (PF2e `perception_number_color`) change with values but are presentation, not a gain.
    const color = id.endsWith('_color') || typeof next.value === 'string' && /^#[0-9a-f]{3,8}$/i.test(next.value);
    return previous && !color && previous.value !== next.value && next.value !== null && next.value !== ''
      ? [{ name: next.name, before: previous.value, after: next.value }] : [];
  });
  const features = [...after.features.keys()].filter(name => !before.features.has(name));
  const choices = [...after.features].filter(([name, open]) => open && (!before.features.get(name))).map(([name]) => name);
  return { improved, features, choices };
}

/** Features and choices the selected class gains at `classLevel`; no dice, so HP is not previewed. */
export function progressionPreview(system: StoredSystem, character: Character, resources: ResourceInstance[], wrapperId: string, classLevel: number) {
  const staged = resources.map(record => record.id === wrapperId ? { ...record, values: { ...record.values, class_level: classLevel } } : record);
  return progressionSummary(progressionSnapshot(system, character, resources, wrapperId, false),
    progressionSnapshot(system, character, staged, wrapperId, false));
}

const choiceGrants = 'all_interactive_progression_grants_for_current_level';

/**
 * The source's commit program for level choices: the creation page `post_edit` that applies every
 * interactive grant of the current level (PF2e page 1: ability scores and `committed_*` values, then
 * feat slots). The same pages edit an existing character in the original app, so it is re-runnable:
 * it compares assigned with committed choices and never applies one twice.
 */
export function levelChoiceCommit(system: StoredSystem) {
  const pages = system.definition.character_creation_flow.map(page => object(page).post_edit)
    .filter(effect => effect != null && JSON.stringify(effect).includes(`"${choiceGrants}"`)
      && JSON.stringify(effect).includes('.committed_'));
  return pages.length === 1 ? pages[0] : undefined;
}

/** Grants of the current level the source still reports as open (its `has_pending_interactive_slots` filter). */
export function pendingLevelChoices(system: StoredSystem, character: Character, resources: ResourceInstance[]) {
  const pending = system.definition.character_stats.find(stat => stat.id === 'has_pending_interactive_slots');
  const filter = pending && object(object(object(pending.components).components).components);
  if (!filter || filter.type !== 'filter' || object(filter.components).stat !== choiceGrants) return [];
  const list = progressionEvaluator(system, character, resources).evaluate(filter);
  return Array.isArray(list) ? list.filter(isResourceReference) : [];
}

/**
 * Class levels in (from, to] at which a `class_details` source offers an ability score improvement (5e
 * `should_show_asi`, evaluated with the wrapper staged at each level, as its level-up popup is).
 */
export function abilityIncreaseLevels(system: StoredSystem, character: Character, resources: ResourceInstance[],
  wrapperId: string, from: number, to: number) {
  // PF2e also defines `should_show_asi`, but its boosts are progression grants, applied by `applyLevelChoices`.
  if (!system.definition.character_stats.some(stat => stat.id === 'should_show_asi')
    || readOrSkip(() => progressionContract(system).kind) !== 'class_details') return [];
  const wrapper = resources.find(record => record.id === wrapperId);
  if (!wrapper) return [];
  const classId = progressionEvaluator(system, character, resources, { $details: { resourceId: wrapperId } }).get('$details.class.id');
  const levels: number[] = [];
  for (let level = from + 1; level <= to; level++) {
    const staged = resources.map(record => record.id === wrapperId ? { ...record, values: { ...record.values, class_level: level } } : record);
    const scoped = { ...character, values: { ...character.values, temp_last_level_up_class_id: classId as string } };
    if (readOrSkip(() => progressionEvaluator(system, scoped, staged).get('should_show_asi')) === true) levels.push(level);
  }
  return levels;
}

/** Abilities the source's ASI popup offers (5e `ability` options), with their `<id>_score` base stats. */
export function abilityIncreaseOptions(system: StoredSystem) {
  const enumeration = system.definition.enumerated_types.find(item => !!item && typeof item === 'object' && object(item).id === 'ability');
  const types = enumeration ? object(enumeration).types : undefined;
  return (Array.isArray(types) ? types : []).flatMap(item => {
    const entry = item && typeof item === 'object' ? object(item) : {};
    const stat = system.definition.character_stats.find(candidate => candidate.id === `${String(entry.id)}_score`);
    return typeof entry.id === 'string' && typeof entry.name === 'string' && stat?.type === 'base' && stat.value_type === 'integer'
      ? [{ id: entry.id, name: entry.name }] : [];
  });
}
