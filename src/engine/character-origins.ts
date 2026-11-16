/** @file Declared race/subrace links, without applying creation rules or effects. */
import { isResourceReference, type Character, type ResourceInstance, type SystemDefinition } from '../domain/model';

/** Recognize the source contract only when all three declared base types agree. */
export function subraceFields(system: SystemDefinition) {
  const race = system.character_stats.find(s => s.id === 'race' && s.type === 'base' && s.value_type === 'resource' && s.resource_type === 'race');
  const selection = system.character_stats.find(s => s.id === 'subrace_id' && s.type === 'base' && s.value_type === 'string');
  const definition = system.resources.find(d => d.id === 'race');
  const children = definition?.stats.find(s => s.id === 'subraces' && s.type === 'base'
    && s.value_type === 'array' && s.sub_value_type === 'resource' && s.resource_type === 'race');
  // A custom ID stat can override instance identity; leave that contract to its source form.
  return race && selection && children && !definition?.stats.some(s => s.id === 'id') ? { race, selection, children } : undefined;
}

/** List only children of the assigned race, retaining upstream scalar IDs. */
export function subraceOptions(system: SystemDefinition, character: Character, resources: ResourceInstance[]) {
  const fields = subraceFields(system);
  if (!fields) return [];
  const ref = character.values[fields.race.id];
  const race = isResourceReference(ref) ? resources.find(r => r.id === ref.resourceId
    && r.systemKey === character.systemKey && r.definitionId === 'race' && !r.catalogSource) : undefined;
  const children = race?.values[fields.children.id];
  if (!Array.isArray(children)) return [];
  return children.flatMap(child => {
    const record = isResourceReference(child) ? resources.find(r => r.id === child.resourceId
      && r.systemKey === character.systemKey && r.definitionId === 'race' && !r.catalogSource) : undefined;
    return record ? [{ id: record.sourceId ?? record.id, name: record.name }] : [];
  });
}
