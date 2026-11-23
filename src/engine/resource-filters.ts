/** @file Typed, removable source prefilters for local resource selection, not rule prerequisites. */
import { matchesType, object, type ResourceDefinition, type ResourceInstance } from '../domain/model';
import { createEvaluator, type EvaluationEnvironment } from './formulas';

export interface ResourceFilter {
  stat: string;
  name: string;
  values: (string | number | boolean)[];
  /** Declared resource-typed options shown by a display stat (5e spell `classes`: class records by `name`). */
  options?: { definitionId: string; displayStat: string };
}

/** Evaluate source prefilters in the parent scope; reject unknown filters and unsupported types. */
export function resourceFilters(input: unknown, definition: ResourceDefinition, evaluate: (node: unknown) => unknown): ResourceFilter[] {
  if (input == null) return [];
  const entries = Object.entries(object(input, 'filters'));
  if (entries.length > 2000) throw new Error('Troppi filtri di risorsa');
  const declared = Array.isArray(definition.search_filters) ? definition.search_filters.map(f => object(f)) : [];
  return entries.map(([id, formula]) => {
    const filter = declared.find(f => f.stat === id);
    const stat = definition.stats.find(s => s.id === id);
    if (!filter || !stat || typeof filter.name !== 'string') throw new Error(`Filtro non definito: ${id}`);
    const type = stat.value_type === 'array' ? stat.sub_value_type : stat.value_type;
    if (!type || !['string', 'bool', 'integer', 'decimal'].includes(type))
      throw new Error(`Tipo di filtro non supportato: ${id}`);
    const value = evaluate(formula);
    const values = value === null ? [] : Array.isArray(value) ? value : [value];
    if (values.length > 10000 || !values.every((v): v is string | number | boolean =>
      v !== null && matchesType(v, type) && (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v))))
      throw new Error(`Valore del filtro non valido: ${id}`);
    const options = typeof filter.options === 'string' && typeof filter.options_display_stat === 'string'
      ? { definitionId: filter.options, displayStat: filter.options_display_stat } : undefined;
    return { stat: id, name: filter.name, values, ...options ? { options } : {} };
  }).filter(filter => filter.values.length > 0);
}

const catalogValues = new WeakMap<ResourceInstance, Record<string, unknown>>();
/**
 * Values a filter can read. Catalog roots keep values only in their exact original, so their
 * top-level typed base values are read from it (nested resources are not materialized here).
 */
export function filterValues(record: ResourceInstance, definition: ResourceDefinition): Record<string, unknown> {
  if (!record.catalogSource) return record.values;
  const cached = catalogValues.get(record);
  if (cached) return cached;
  const original = record.catalogSource.original;
  const text = original.charCodeAt(0) === 0xfeff ? original.slice(1) : original;
  const stats = object(object(JSON.parse(text)).stats ?? {});
  const values = Object.fromEntries(definition.stats.flatMap(stat => {
    const entry = stats[stat.id];
    const value = entry && typeof entry === 'object' && !Array.isArray(entry) ? object(entry).value : undefined;
    return stat.type === 'base' && stat.value_type !== 'resource' && stat.sub_value_type !== 'resource' && matchesType(value, stat.value_type, stat.sub_value_type)
      ? [[stat.id, value]] : [];
  }));
  catalogValues.set(record, values);
  return values;
}

/**
 * Values that select records: with resource-typed options, a shown label also selects the ids of the
 * local option records displaying it (the 5e sheet filters spells by class name; spells store `bard`).
 */
function acceptedValues(filter: ResourceFilter, environment: EvaluationEnvironment) {
  const options = filter.options, optionDefinition = options && environment.resourceDefinitions?.find(d => d.id === options.definitionId);
  if (!options || !optionDefinition) return filter.values;
  const ids = (environment.resources ?? []).filter(record => record.definitionId === options.definitionId).flatMap(record => {
    const shown = filterValues(record, optionDefinition)[options.displayStat];
    return filter.values.includes(shown as string) ? [record.sourceId ?? record.id] : [];
  });
  return [...new Set([...filter.values, ...ids])];
}

/** Match every active field, with any selected value within an array field; no coercion beyond declared option labels. */
export function filterResources(resources: ResourceInstance[], definition: ResourceDefinition, filters: ResourceFilter[], environment: EvaluationEnvironment) {
  if (!filters.length) return resources;
  const accepted = new Map(filters.map(filter => [filter, acceptedValues(filter, environment)]));
  return resources.filter(record => {
    const engine = createEvaluator(definition.stats, filterValues(record, definition), undefined, { ...environment, createdAt: record.createdAt, instanceId: record.sourceId ?? record.id, variables: undefined, overrides: undefined });
    return filters.every(filter => {
      const value = engine.get(filter.stat);
      const values = accepted.get(filter)!;
      return Array.isArray(value) ? value.some(v => values.includes(v)) : values.some(v => v === value);
    });
  });
}
