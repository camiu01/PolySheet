/** @file Explicit first-level D&D health initialization, separate from lifecycle effects. */
import { isResourceReference, type Character, type ResourceInstance, type StoredSystem, type SystemDefinition } from '../domain/model';
import { supportsAbilitySetup } from './ability-setup';
import { createEvaluator, RuntimeResource } from './formulas';
import { resolveCharacterOverrides } from './overrides';
import { it } from '../ui/it';

/** Restrict the helper to declared D&D health and class-wrapper contracts. */
export function supportsInitialHealth(system: SystemDefinition) {
  return supportsAbilitySetup(system) && ['base_hp', 'current_hp'].every(id =>
    system.character_stats.some(stat => stat.id === id && stat.type === 'base' && stat.value_type === 'integer'))
    && ['max_hp', 'classes_hp_mods', 'level', 'constitution_modifier'].every(id =>
      system.character_stats.some(stat => stat.id === id))
    && system.character_stats.some(stat => stat.id === 'classes' && stat.resource_type === 'class_details');
}

/** Compute source-compatible bases; fail before persistence for unsupported/custom class rules. */
export function initialHealth(system: StoredSystem, character: Character, resources: ResourceInstance[]) {
  const classes = character.values.classes;
  if (!supportsInitialHealth(system.definition) || !Array.isArray(classes) || classes.length !== 1
    || !isResourceReference(classes[0]) || character.systemKey !== system.key) throw new Error(it.setupAutoHpUnavailable);
  const wrapperId = classes[0].resourceId;
  const wrapper = resources.find(record => record.id === wrapperId && record.systemKey === system.key);
  const definition = system.definition.resources.find(resource => resource.id === wrapper?.definitionId);
  if (!wrapper || !definition || definition.id !== 'class_details') throw new Error(it.setupAutoHpUnavailable);
  const overrides = resolveCharacterOverrides(character.overrides);
  const environment = { resources, resourceDefinitions: system.definition.resources,
    enumerations: system.definition.enumerated_types, createdAt: character.createdAt,
    overrides: overrides.values, modifiers: overrides.modifiers,
    character: new RuntimeResource(`character:${character.id}`, system.definition.character_stats, character.values, character.createdAt, {}, overrides.values, undefined, overrides.modifiers) };
  const root = createEvaluator(system.definition.character_stats, character.values, undefined, environment);
  const details = createEvaluator(definition.stats, wrapper.values, undefined, environment);
  const die = details.get('class.actual_hit_die'), modifiers = details.get('class.actual_hp_modifiers');
  const constitution = character.values.constitution_score ?? system.definition.character_stats.find(stat => stat.id === 'constitution_score')?.default_value;
  const modifier = root.get('constitution_modifier'), sourceBonus = root.get('classes_hp_mods');
  if (root.get('level') !== 1 || details.get('class_level') !== 1 || typeof die !== 'string' || !/^d(6|8|10|12)$/.test(die)
    || !Array.isArray(modifiers) || modifiers.length !== 1 || modifiers[0] !== 'constitution'
    || typeof constitution !== 'number' || !Number.isSafeInteger(constitution)
    || modifier !== Math.floor((constitution - 10) / 2) || typeof modifier !== 'number'
    || typeof sourceBonus !== 'number' || !Number.isSafeInteger(sourceBonus)) throw new Error(it.setupAutoHpUnavailable);
  const total = Number(die.slice(1)) + modifier;
  // The source clamps negative class bonuses; compensate in its base, not in immutable source formulas.
  const values = { base_hp: total - sourceBonus, current_hp: total };
  const maximum = createEvaluator(system.definition.character_stats, { ...character.values, ...values }, undefined, environment).get('max_hp');
  if (!Number.isSafeInteger(total) || total < 1 || maximum !== total) throw new Error(it.setupAutoHpUnavailable);
  return values;
}
