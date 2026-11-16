/** @file Bounded, source-preserving class/origin/background catalogs, not archive decoding. */
import { jsonValue, matchesType, object, type ResourceInstance, type Stat, type StoredSystem } from '../domain/model';
import { checkReferences } from '../domain/references';
import { boundedJson } from './system';
import { it } from '../ui/it';

export interface CatalogPreview {
  systemKey: string;
  rootId: string;
  resources: ResourceInstance[];
}
export const MAX_REPOSITORY_CATALOG_BYTES = 24 * 1024 * 1024;
export const MAX_REPOSITORY_CATALOG_FILES = 1000;
export const CATALOG_ROOTS = ['class', 'race', 'ancestry', 'heritage', 'background'];
/**
 * Read a complete snapshot, validating optional resource-array removal history.
 * @remarks No prior graph is merged. Conflicting current/deleted IDs are ambiguous
 * and rejected; tombstones never delete records from another private assignment.
 */
function snapshotValue(wrapped: Record<string, unknown>, stat: Stat, path: string) {
  if (!Object.hasOwn(wrapped, 'value') || Object.keys(wrapped).some(k => k !== 'value' && k !== 'remove_ids'))
    throw new Error(`${path}: ${it.catalogFormat}`);
  if (Object.hasOwn(wrapped, 'remove_ids')) {
    const removed = wrapped.remove_ids, value = wrapped.value;
    if (stat.value_type !== 'array' || stat.sub_value_type !== 'resource' || !Array.isArray(value)
      || !Array.isArray(removed) || removed.length > 10000
      || removed.some(id => typeof id !== 'string' || !id.length || id.length > 500)
      || new Set(removed).size !== removed.length) throw new Error(`${path}.remove_ids: ${it.catalogRemovalHistory}`);
    const ids = new Set(removed);
    if (value.some(child => child !== null && ids.has(object(object(child).stats).id)))
      throw new Error(`${path}.remove_ids: ${it.catalogRemovalHistory}`);
  }
  return wrapped.value;
}
/** Hash exact UTF-8 catalog text, including an optional BOM. */
export async function catalogDigest(original: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(original));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
/**
 * Retain one compact immutable template; materialize nested instances on assignment.
 * @remarks Invalid source semantics remain visible and nonassignable, never repaired.
 * Keeping unassigned graphs out of the instance table preserves its 10,000-record cap.
 */
export async function prepareCatalogTemplate(original: string, source: string, system: StoredSystem): Promise<CatalogPreview> {
  const input = object(boundedJson(original)), stats = object(input.stats);
  const definition = system.definition.resources.find(d => d.id === input.resource_id);
  if (!definition || !CATALOG_ROOTS.includes(definition.id) || source.length > 2000)
    throw new Error(it.catalogFormat);
  const name = object(stats.name).value;
  if (typeof name !== 'string' || !name.trim() || name.length > 500
    || (stats.id != null && (typeof stats.id !== 'string' || !stats.id.length || stats.id.length > 500))) throw new Error(it.catalogFormat);
  let issue: string | undefined;
  try { await prepareCatalog(original, source, system); }
  catch (error) { issue = error instanceof Error ? error.message : it.catalogFormat; }
  const rootId = crypto.randomUUID();
  return { systemKey: system.key, rootId, resources: [{
    id: rootId, systemKey: system.key, definitionId: definition.id, name, values: {},
    createdAt: new Date().toISOString(), catalogGroup: rootId,
    ...(typeof stats.id === 'string' ? { sourceId: stats.id } : {}),
    catalogSource: { original, source, digest: await catalogDigest(original) },
    ...(issue ? { catalogIssue: issue } : {})
  }] };
}
/**
 * Convert nested upstream `{resource_id, stats: {field: {value}}}` instances.
 * @remarks Only declared base fields are mapped. Unknown fields, reference-only
 * envelopes and wrong types fail instead of silently losing content. Source IDs
 * stay separate from local reference IDs. No rules, effects or hooks execute.
 * Validated removal history describes absent children in this fresh snapshot,
 * never a mutation of existing resources or private character graphs.
 */
export async function prepareCatalog(original: string, source: string, system: StoredSystem): Promise<CatalogPreview> {
  const input = object(boundedJson(original));
  if (!CATALOG_ROOTS.includes(String(input.resource_id))) throw new Error(it.catalogFormat);
  const rootId = crypto.randomUUID(), resources: ResourceInstance[] = [];
  function convert(input: unknown, path: string, id = crypto.randomUUID()): { resourceId: string } {
    if (resources.length >= 10000) throw new Error(it.resourceListLimit);
    const node = object(input, path);
    if (Object.keys(node).some(k => !['system', 'resource_id', 'stats'].includes(k))
      || (node.system != null && node.system !== system.definition.id)) throw new Error(`${path}: ${it.catalogFormat}`);
    const definition = system.definition.resources.find(d => d.id === node.resource_id);
    if (!definition) throw new Error(`${path}: ${it.noResourceType}`);
    const stats = object(node.stats, `${path}.stats`);
    if (stats.id != null && (typeof stats.id !== 'string' || !stats.id.length || stats.id.length > 500)) throw new Error(`${path}.stats.id: ${it.invalidValue}`);
    const record: ResourceInstance = {
      id, systemKey: system.key, definitionId: definition.id, name: definition.name,
      values: {}, createdAt: new Date().toISOString(), catalogGroup: rootId,
      ...(typeof stats.id === 'string' ? { sourceId: stats.id } : {})
    };
    resources.push(record);
    for (const [key, entry] of Object.entries(stats)) {
      if (key === 'id' || key === 'updated_at') continue;
      const stat = definition.stats.find(s => s.id === key && s.type === 'base');
      if (!stat) throw new Error(`${path}.stats.${key}: ${it.catalogUnknownField}`);
      const wrapped = object(entry, `${path}.stats.${key}`);
      let value = snapshotValue(wrapped, stat, `${path}.stats.${key}`);
      if (value !== null && stat.value_type === 'resource') value = convert(value, `${path}.stats.${key}.value`);
      else if (value !== null && stat.value_type === 'array' && stat.sub_value_type === 'resource') {
        if (!Array.isArray(value) || value.length > 10000) throw new Error(`${path}.stats.${key}: ${it.invalidValue}`);
        value = value.map((v, i) => v === null ? null : convert(v, `${path}.stats.${key}.value[${i}]`));
      }
      if (!matchesType(value, stat.value_type, stat.sub_value_type)) throw new Error(`${path}.stats.${key}: ${it.invalidValue}`);
      record.values[key] = jsonValue(value);
    }
    if (typeof record.values.name === 'string' && record.values.name.trim()) record.name = record.values.name;
    if (record.name.length > 500) throw new Error(it.invalidValue);
    return { resourceId: id };
  }
  convert(input, '$', rootId);
  for (const record of resources) checkReferences(system.definition.resources.find(d => d.id === record.definitionId)!.stats, record.values, resources, system.key);
  resources[0].catalogSource = { original, source, digest: await catalogDigest(original) };
  return { systemKey: system.key, rootId, resources };
}
