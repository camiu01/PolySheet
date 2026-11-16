/** @file Typed, removable source prefilters for local resource selection, not rule prerequisites. */
import { matchesType, object, type ResourceDefinition, type ResourceInstance } from '../domain/model';
import { createEvaluator, type EvaluationEnvironment } from './formulas';

export interface ResourceFilter {
  stat: string;
  name: string;
  values: (string | number | boolean)[];
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
    return { stat: id, name: filter.name, values };
  }).filter(filter => filter.values.length > 0);
}

/** Match every active field, with any selected value within an array field; no coercion. */
export function filterResources(resources: ResourceInstance[], definition: ResourceDefinition, filters: ResourceFilter[], environment: EvaluationEnvironment) {
  if (!filters.length) return resources;
  return resources.filter(record => {
    const engine = createEvaluator(definition.stats, record.values, undefined, { ...environment, createdAt: record.createdAt, variables: undefined, overrides: undefined });
    return filters.every(filter => {
      const value = engine.get(filter.stat);
      return Array.isArray(value) ? value.some(v => filter.values.includes(v)) : filter.values.some(v => v === value);
    });
  });
}
