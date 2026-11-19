/** @file Source-derived 5e feature selections, staged with the advancement rather than calculated-stat writes. */
import { isResourceReference, type Character, type ResourceInstance, type StoredSystem } from '../domain/model';
import { progressionEvaluator } from './progression';
import { RuntimeResource } from './formulas';
import { it } from '../ui/it';

/** Stable source identities survive private multiclass graph materialization. */
export interface SelectableFeatureChoice {
  featureId: string;
  selected: string[];
}

/** Read a strict source string list; malformed rules remain visible errors. */
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new Error(it.progressionUnsupported);
  return value;
}

/**
 * Read choices at the proposed class level, including earlier unfilled choices.
 * @remarks Parent-bearing references come from the actual class wrapper. Source formulas
 * determine availability, allowance, current selection and destination, never application RPG tables.
 */
export function selectableProgressionFeatures(system: StoredSystem, character: Character, resources: ResourceInstance[],
  wrapperId: string, classLevel: number, archetypeId?: string | null) {
  const definition = system.definition.resources.find(resource => resource.id === 'feat');
  if (!definition?.stats.some(stat => stat.id === 'chosen_selectable_features')) return [];
  const staged = resources.map(record => record.id === wrapperId ? { ...record, values: { ...record.values,
    class_level: classLevel, ...(archetypeId ? { archetype_id: archetypeId } : {}) } } : record);
  const evaluator = progressionEvaluator(system, character, staged, { $details: { resourceId: wrapperId } });
  const features = evaluator.get('$details.features');
  if (!Array.isArray(features)) throw new Error(it.progressionUnsupported);
  return features.flatMap(feature => {
    const scope = progressionEvaluator(system, character, staged, { $feature: feature });
    if (scope.get('$feature.has_selectable_features') !== true) return [];
    const maximum = scope.get('$feature.current_allowed_amount_of_selectable_features');
    if (maximum === 0) return [];
    const featureId = scope.get('$feature.id'), name = scope.get('$feature.name');
    const options = scope.get('$feature.available_selectable_features_for_current_level');
    const path = scope.get('$feature.selected_selectable_feature_ids_stat_path');
    if (typeof featureId !== 'string' || typeof name !== 'string' || !Number.isSafeInteger(maximum)
      || typeof maximum !== 'number' || maximum < 0 || !Array.isArray(options)
      || !['$parent.current_class_details.selected_selectable_feature_ids', '$character.selected_selectable_feature_ids'].includes(String(path)))
      throw new Error(it.progressionUnsupported);
    const target = path === '$character.selected_selectable_feature_ids' ? 'character' : 'wrapper';
    if (target === 'wrapper') {
      const owner = scope.get('$feature.$parent.current_class_details');
      const id = owner instanceof RuntimeResource ? owner.key.slice('resource:'.length) : isResourceReference(owner) ? owner.resourceId : undefined;
      if (id !== wrapperId) throw new Error(it.progressionUnsupported);
    }
    return [{ featureId, name, maximum, target, selected: strings(scope.get('$feature.chosen_selectable_features')),
      allIds: strings(scope.get('$feature.selectable_feature_ids')), options: options.map(option => {
        const item = progressionEvaluator(system, character, staged, { $option: option });
        const id = item.get('$option.id'), name = item.get('$option.name');
        if (typeof id !== 'string' || typeof name !== 'string') throw new Error(it.progressionUnsupported);
        return { id, name };
      }) }];
  });
}

/**
 * Replace only each submitted feature's own ids, preserving other choices on the latest owner.
 * @throws Invalid, duplicate, unavailable or excessive selections abort the entire advancement.
 */
export function stageSelectableFeatures(system: StoredSystem, character: Character, resources: ResourceInstance[],
  wrapper: ResourceInstance, choices: SelectableFeatureChoice[], classLevel: number, archetypeId?: string | null) {
  if (!choices.length) return;
  const available = selectableProgressionFeatures(system, character, resources, wrapper.id, classLevel, archetypeId);
  const seen = new Set<string>();
  for (const choice of choices) {
    const matches = available.filter(feature => feature.featureId === choice.featureId);
    const selected = strings(choice.selected), feature = matches[0];
    if (matches.length !== 1 || seen.has(choice.featureId) || new Set(selected).size !== selected.length
      || selected.length > feature.maximum || selected.some(id => !feature.options.some(option => option.id === id)))
      throw new Error(it.progressionSelectableInvalid);
    seen.add(choice.featureId);
    const values = feature.target === 'wrapper' ? wrapper.values : character.values;
    const current = strings(values.selected_selectable_feature_ids);
    values.selected_selectable_feature_ids = [...new Set([...current.filter(id => !feature.allIds.includes(id)), ...selected])];
  }
}
