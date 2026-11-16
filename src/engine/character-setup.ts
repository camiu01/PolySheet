/** @file Manual initial fields derived from source creation inputs, not RPG defaults. */
import { object, type SystemDefinition } from '../domain/model';

/** Numeric creation inputs plus declared HP bases; no calculated fields or invented values. */
export function setupStats(system: SystemDefinition) {
  const ids = new Set<string>();
  const visit = (input: unknown) => {
    if (!input || typeof input !== 'object') return;
    const node = object(input);
    if (node.id && ['text', 'stat', 'ticker'].includes(String(node.type))) {
      const id = node.edit_stat ?? node.stat;
      if (typeof id === 'string') ids.add(id);
    }
    for (const child of Object.values(input)) if (child && typeof child === 'object') {
      if (Array.isArray(child)) child.forEach(visit); else visit(child);
    }
  };
  system.character_creation_flow.forEach(page => visit(object(page).view));
  return system.character_stats.filter(stat => stat.type === 'base'
    && ['integer', 'decimal'].includes(stat.value_type)
    && (ids.has(stat.id) || ['base_hp', 'current_hp'].includes(stat.id)));
}
