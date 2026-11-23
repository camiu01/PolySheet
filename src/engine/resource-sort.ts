/**
 * @file Source `sort_options` for local resource search: ordering and group headers, never rule values.
 * @see https://docs.rpg-companion.app/System/SortOption
 */
import { object, type ResourceDefinition, type ResourceInstance } from '../domain/model';
import { enumerationEntries } from './enumerations';
import { createEvaluator, type EvaluationEnvironment } from './formulas';
import { filterValues } from './resource-filters';

/** One declared sort option, validated against the resource's stats. */
export interface SortOption {
  name: string; stat: string; descending: boolean;
  trueName?: string; falseName?: string;
  /** Enumerated type id (string stats) or option resource id with its display stat. */
  enumeration?: string; resource?: { definitionId: string; displayStat: string };
}

/** A sorted record and the header it falls under; null when the option has no headers or no value. */
export interface SortedResource { record: ResourceInstance; group: string | null }

/** Declared options in source order; the alphabetical default is added by the caller. */
export function sortOptions(definition: ResourceDefinition, enumerations: unknown[] = []): SortOption[] {
  const declared = Array.isArray(definition.sort_options) ? definition.sort_options : [];
  if (declared.length > 100) throw new Error('Troppe opzioni di ordinamento');
  const enumIds = new Set(enumerations.flatMap(raw => { const id = object(raw).id; return typeof id === 'string' ? [id] : []; }));
  return declared.map((raw, index) => {
    const o = object(raw, `sort_options[${index}]`);
    const stat = definition.stats.find(s => s.id === o.stat);
    if (typeof o.name !== 'string' || !stat) throw new Error(`Opzione di ordinamento non valida: ${String(o.stat)}`);
    if (!['string', 'integer', 'decimal', 'bool'].includes(stat.value_type))
      throw new Error(`Ordinamento non supportato per il tipo ${stat.value_type}: ${stat.id}`);
    if (o.order != null && o.order !== 'asc' && o.order !== 'desc') throw new Error(`Ordine non valido: ${String(o.order)}`);
    const option: SortOption = { name: o.name, stat: stat.id, descending: o.order === 'desc' };
    if (typeof o.true_name === 'string') option.trueName = o.true_name;
    if (typeof o.false_name === 'string') option.falseName = o.false_name;
    if (typeof o.options === 'string') {
      if (typeof o.options_display_stat === 'string') option.resource = { definitionId: o.options, displayStat: o.options_display_stat };
      else if (enumIds.has(o.options)) option.enumeration = o.options;
      else throw new Error(`Opzioni di ordinamento sconosciute: ${o.options}`);
    }
    return option;
  });
}

const byName = (a: ResourceInstance, b: ResourceInstance) => a.name.localeCompare(b.name);

/**
 * Order records by one option, or alphabetically by name when it is null.
 * @param falseLabel Default `false` header ("Not <stat>") in the interface language.
 */
export function sortResources(records: ResourceInstance[], definition: ResourceDefinition, option: SortOption | null,
  environment: EvaluationEnvironment, falseLabel: (statName: string) => string): SortedResource[] {
  if (!option) return [...records].sort(byName).map(record => ({ record, group: null }));
  const stat = definition.stats.find(s => s.id === option.stat)!;
  const ranks = option.enumeration
    ? new Map(enumerationEntries(environment.enumerations as unknown[], option.enumeration).map((entry, index) => [entry.id, { index, name: entry.name }]))
    : undefined;
  const optionDefinition = option.resource && environment.resourceDefinitions?.find(d => d.id === option.resource!.definitionId);
  if (option.resource && !optionDefinition) throw new Error(`Risorsa delle opzioni mancante: ${option.resource.definitionId}`);
  const labels = option.resource ? new Map((environment.resources ?? []).filter(r => r.definitionId === option.resource!.definitionId)
    .map(r => [r.sourceId ?? r.id, filterValues(r, optionDefinition!)[option.resource!.displayStat]])) : undefined;
  const keyed = records.map(record => {
    const engine = createEvaluator(definition.stats, filterValues(record, definition), undefined,
      { ...environment, createdAt: record.createdAt, instanceId: record.sourceId ?? record.id, variables: undefined, overrides: undefined });
    const value = engine.get(stat.id);
    if (value === null || value === undefined) return { record, key: null, group: null };
    if (typeof value === 'boolean')
      return { record, key: value ? 0 : 1, group: value ? option.trueName ?? stat.name : option.falseName ?? falseLabel(stat.name) };
    if (ranks) {
      const rank = ranks.get(String(value));
      return rank ? { record, key: rank.index, group: rank.name } : { record, key: null, group: null };
    }
    if (labels) {
      const label = labels.get(String(value));
      return typeof label === 'string' ? { record, key: label, group: label } : { record, key: null, group: null };
    }
    return { record, key: value as string | number, group: null };
  });
  const direction = option.descending ? -1 : 1;
  // Records without a sortable value follow every ranked one in both directions.
  keyed.sort((a, b) => a.key === null || b.key === null ? (a.key === null ? 1 : 0) - (b.key === null ? 1 : 0) || byName(a.record, b.record)
    : (typeof a.key === 'number' && typeof b.key === 'number' ? a.key - b.key : String(a.key).localeCompare(String(b.key))) * direction
      || byName(a.record, b.record));
  return keyed.map(({ record, group }) => ({ record, group }));
}
