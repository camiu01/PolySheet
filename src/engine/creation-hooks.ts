/**
 * @file Bounded execution of `character_creation_flow` page hooks on a local draft.
 * @remarks Hooks write only draft base values and draft-staged resource copies; nothing
 * is persisted and no mechanic override is created. Supported: `sequence`, `when`
 * (no matching clause is a no-op), `forEach`, deferred `fireEvent`, `setStat` and `addToStat` with
 * `aggregation_type` `set` or omitted, targeting a character base stat, a `meta_stat`
 * or a nested `$path.stat` on a staged resource. Other effects are skipped and
 * reported, never simulated.
 */
import { jsonValue, matchesType, object, isResourceReference, type ResourceInstance, type SystemDefinition } from '../domain/model';
import { createEvaluator, RuntimeResource } from './formulas';
import { rollEventDice } from './character-events';
import { referencedIds } from '../domain/references';

export interface CreationDraft {
  values: Record<string, unknown>;
  /** Draft-only resources; a later copy with the same id replaces an earlier one. */
  staged: ResourceInstance[];
  /** Effects that were skipped because they are outside the supported subset. */
  skipped: string[];
  /** `fireEvent` payloads, dispatched to the saved character after creation (PF2e daily preparations). */
  events?: unknown[];
}

interface HookContext {
  definition: SystemDefinition;
  persisted: ResourceInstance[];
  enumerations?: unknown[];
  draft: CreationDraft;
  variables: Record<string, unknown>;
  budget: { nodes: number };
  options: CreationHookOptions;
}

export interface CreationHookOptions {
  /**
   * `$updated_stats` for `post_edit`: ids of base stats the confirmed page changed.
   * Upstream semantics are not documented locally; this is the conservative reading.
   */
  updatedStats?: string[];
  /**
   * The confirmed page's inputs by view id, read as `$view` (5e `creator_ability_score_increases`
   * reads the chosen race from `$view.edit_character_basics_race_select`).
   */
  view?: Record<string, unknown>;
  /** Hooks run only on explicit navigation, so source `roll` formulas may roll here. */
  random?: (faces: number) => number;
}

/** Replace a staged copy by id, keeping every other staged record. */
export function restage(staged: ResourceInstance[], record: ResourceInstance) {
  return [...staged.filter(r => r.id !== record.id), record];
}

/** Store resource scopes as references; RuntimeResource objects are never persisted. */
function stored(value: unknown): unknown {
  if (value instanceof RuntimeResource) return { resourceId: localId(value) };
  if (Array.isArray(value)) return value.map(stored);
  return value;
}

function localId(value: unknown): string | undefined {
  if (value instanceof RuntimeResource) return value.key.startsWith('resource:') ? value.key.slice('resource:'.length) : undefined;
  return isResourceReference(value) ? value.resourceId : undefined;
}

/** Copy one resource graph into new draft-staged records with fresh ids (`copyResource`, preserve_ids false). */
function copyGraph(ctx: HookContext, value: unknown, preserveIds: boolean) {
  if (preserveIds) throw new Error('copyResource con preserve_ids non supportato.');
  const rootId = localId(value);
  const all = new Map([...ctx.persisted, ...ctx.draft.staged].map(r => [r.id, r]));
  if (!rootId || !all.has(rootId)) throw new Error('Risorsa da copiare mancante.');
  const ids = new Map<string, string>(), queue = [rootId];
  for (let i = 0; i < queue.length; i++) {
    if (ids.has(queue[i])) continue;
    const source = all.get(queue[i]), definition = ctx.definition.resources.find(d => d.id === source?.definitionId);
    if (!source || !definition || ids.size >= 1000) throw new Error('Risorsa da copiare mancante.');
    ids.set(source.id, crypto.randomUUID());
    for (const stat of definition.stats) queue.push(...referencedIds(stat, source.values[stat.id]));
  }
  const remap = (v: unknown): unknown => isResourceReference(v) ? { resourceId: ids.get(v.resourceId) ?? v.resourceId } : Array.isArray(v) ? v.map(remap) : v;
  let staged = ctx.draft.staged;
  for (const [sourceId, id] of ids) {
    const source = all.get(sourceId)!;
    const values = Object.fromEntries(Object.entries(source.values).map(([k, v]) => [k, jsonValue(remap(v))]));
    staged = restage(staged, { id, systemKey: source.systemKey, definitionId: source.definitionId, name: source.name, values,
      // One private group per copy, so upstream identities stay valid when the draft is saved.
      createdAt: new Date().toISOString(), catalogGroup: ids.get(rootId)!, ...(source.sourceId ? { sourceId: source.sourceId } : {}) });
  }
  ctx.draft = { ...ctx.draft, staged };
  return { resourceId: ids.get(rootId)! };
}

function evaluate(ctx: HookContext, input: unknown) {
  return createEvaluator(ctx.definition.character_stats, ctx.draft.values, undefined, {
    resources: [...ctx.persisted.filter(r => !ctx.draft.staged.some(s => s.id === r.id)), ...ctx.draft.staged],
    resourceDefinitions: ctx.definition.resources, enumerations: ctx.enumerations,
    // Resource formulas read the owner as `$character`; during creation that is the draft itself.
    character: new RuntimeResource('character:creation', ctx.definition.character_stats, ctx.draft.values, undefined, { $is_new: true }),
    variables: { $is_new: true, $updated_stats: ctx.options.updatedStats ?? [],
      ...ctx.options.view ? { $view: ctx.options.view } : {}, ...ctx.variables },
    roll: expression => rollEventDice(expression, ctx.options.random).total,
    copyResource: (value, preserveIds) => copyGraph(ctx, value, preserveIds)
  }).evaluate(input);
}

/** Next value for one stat write; `addToStat` adds to the current numeric value. */
function nextValue(effect: Record<string, unknown>, ctx: HookContext, current: unknown, valueType: string) {
  if (effect.aggregation_type != null && effect.aggregation_type !== 'set') throw new Error(`Aggregazione non supportata: ${String(effect.aggregation_type)}`);
  const raw = stored(evaluate(ctx, effect.type === 'setStat' ? effect.new_value : effect.value));
  if (effect.type === 'setStat') return jsonValue(raw);
  // addToStat on a list appends (5e starting equipment); on numbers it adds.
  if (valueType === 'array') return jsonValue([...(Array.isArray(current) ? current : []), ...(Array.isArray(raw) ? raw : [raw])]);
  if (!['integer', 'decimal'].includes(valueType) || typeof raw !== 'number') throw new Error('addToStat richiede un valore numerico.');
  return (typeof current === 'number' ? current : 0) + raw;
}

/** Write a character base stat or a base stat of one staged resource. */
function writeStat(effect: Record<string, unknown>, ctx: HookContext) {
  const target = effect.stat != null ? effect.stat : evaluate(ctx, effect.meta_stat);
  if (typeof target !== 'string' || !target || target.length > 500) throw new Error('Destinazione dell’effetto non valida.');
  const split = target.lastIndexOf('.');
  if (split < 0) {
    const stat = ctx.definition.character_stats.find(s => s.id === target && s.type === 'base');
    if (!stat) throw new Error(`Statistica base mancante: ${target}`);
    const value = nextValue(effect, ctx, ctx.draft.values[target] ?? stat.default_value, stat.value_type);
    if (!matchesType(value, stat.value_type, stat.sub_value_type)) throw new Error(`Valore non valido per ${target}.`);
    ctx.draft = { ...ctx.draft, values: { ...ctx.draft.values, [target]: value } };
    return;
  }
  const id = localId(evaluate(ctx, { type: 'stat', stat: target.slice(0, split) }));
  const record = ctx.draft.staged.find(r => r.id === id);
  if (!record) throw new Error(`Risorsa non modificabile nella bozza: ${target}`);
  const field = target.slice(split + 1);
  const stat = ctx.definition.resources.find(d => d.id === record.definitionId)?.stats.find(s => s.id === field && s.type === 'base');
  if (!stat) throw new Error(`Statistica base mancante: ${target}`);
  const value = nextValue(effect, ctx, record.values[field] ?? stat.default_value, stat.value_type);
  if (!matchesType(value, stat.value_type, stat.sub_value_type)) throw new Error(`Valore non valido per ${target}.`);
  ctx.draft = { ...ctx.draft, staged: restage(ctx.draft.staged, { ...record, values: { ...record.values, [field]: jsonValue(value) } }) };
}

function run(effect: Record<string, unknown>, ctx: HookContext, depth: number): void {
  if (++ctx.budget.nodes > 5000 || depth > 32) throw new Error('Azione di pagina troppo complessa.');
  switch (effect.type) {
    case 'sequence':
      for (const child of Array.isArray(effect.effects) ? effect.effects : []) run(object(child), ctx, depth + 1);
      return;
    case 'when':
      for (const clause of Array.isArray(effect.clauses) ? effect.clauses : []) {
        const branch = object(clause), condition = evaluate(ctx, branch.condition);
        if (typeof condition !== 'boolean') throw new Error('Condizione non booleana.');
        if (condition) return run(object(branch.effect), ctx, depth + 1);
      }
      return;
    case 'forEach': return runForEach(effect, ctx, depth);
    case 'fireEvent':
      ctx.draft = { ...ctx.draft, events: [...(ctx.draft.events ?? []), effect.event] };
      return;
    case 'setStat':
    case 'addToStat': return writeStat(effect, ctx);
    default:
      ctx.draft = { ...ctx.draft, skipped: [...ctx.draft.skipped, String(effect.type)] };
  }
}

function runForEach(effect: Record<string, unknown>, ctx: HookContext, depth: number) {
  const items = evaluate(ctx, effect.components);
  if (!Array.isArray(items) || items.length > 1000) throw new Error('Lista di iterazione non valida.');
  const key = typeof effect.for_each_value_key === 'string' ? effect.for_each_value_key : '$forEachValue';
  const previous = ctx.variables;
  try {
    for (const item of items) {
      // Rebind resource items by id so each step reads the latest staged copy.
      ctx.variables = { ...previous, [key]: item instanceof RuntimeResource && localId(item) ? { resourceId: localId(item) } : item };
      run(object(effect.apply), ctx, depth + 1);
    }
  } finally { ctx.variables = previous; }
}

/**
 * Apply one page hook to a draft and return the updated draft.
 * @param persisted - Stored resources visible to formulas; never written.
 * @throws When a supported effect cannot be applied; the caller keeps the previous draft.
 */
export function runCreationHook(effect: unknown, definition: SystemDefinition, draft: CreationDraft,
  persisted: ResourceInstance[], enumerations?: unknown[], options: CreationHookOptions = {}): CreationDraft {
  if (effect == null) return draft;
  const ctx: HookContext = { definition, persisted, enumerations, draft, variables: {}, budget: { nodes: 0 }, options };
  run(object(effect), ctx, 0);
  return ctx.draft;
}
