/** @file Conservative static input bindings; display-only IDs do not define drafts. */
import { object, type Stat, type View } from '../domain/model';
import { inputStat } from '../engine/view-session';

/** Collect one form's inputs, excluding nested popups and ambiguous duplicate input IDs. */
export function viewBindings(input: unknown, stats: Stat[]) {
  const bindings = new Map<string, Stat>(), duplicates = new Set<string>();
  let count = 0;
  function visit(input: unknown, depth: number) {
    if (depth > 64 || ++count > 10000) throw new Error('Vista troppo complessa');
    if (!input || typeof input !== 'object' || Array.isArray(input)) return;
    const node = object(input);
    if (typeof node.id !== 'string' || typeof node.type !== 'string') return;
    const stat = inputStat(node as View, stats);
    if (stat) {
      if (bindings.has(node.id) || duplicates.has(node.id)) { bindings.delete(node.id); duplicates.add(node.id); }
      else bindings.set(node.id, stat);
    }
    for (const field of ['subviews', 'header', 'content', 'center_content', 'bottom_left_stack', 'bottom_right_stack'])
      if (Array.isArray(node[field])) node[field].forEach(child => visit(child, depth + 1));
    for (const field of ['header_view', 'left_view']) if (node[field]) visit(node[field], depth + 1);
  }
  visit(input, 0);
  return bindings;
}
