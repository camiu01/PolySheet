/**
 * @file Resource-scoped events fired by character commands.
 * @remarks An `eventName` with `for_resource` runs the matching mechanics of
 * that one resource instance (PF2e `resource_daily_preparations`). Writes are
 * `setStat`/`set` replacements of the resource's base values and are allowed
 * only on instances reachable from the commanding character's values, never on
 * catalog roots. A resource without a handler for the name is left unchanged, since
 * sources fire these names at every class or archetype. Popups, rolls and
 * character events fired from a resource handler stay unsupported.
 * `$character.stat` writes become overrides of the firing character mechanic. A
 * `$variable.stat` destination writes the same way to the owned resource bound
 * to that loop variable (PF2e `$choice.used_quantity`).
 * A write to a calculated stat of the instance is stored as that instance's own
 * override (5e `effect` `current_charges`). `calculated_event_names` are evaluated
 * in the instance scope; an `eventName` inside them names this resource's own event
 * (5e `use`), a plain string a global one (5e `short_rest`).
 */
import { isResourceReference, jsonValue, matchesType, object, type Character, type Json, type ResourceInstance, type SystemDefinition } from '../domain/model';
import { createEvaluator, RuntimeResource } from './formulas';
import { eventNames, executeEffect, validateEffect, writeCharacterStat, type EffectContext, type EffectTerminal, type ResourceWriteMode } from './effects';
import { initialDrafts } from './view-session';

type ResourceDefinition = SystemDefinition['resources'][number];

/** Pending base-value and calculated-override writes for one command; applied only after the whole command succeeds. */
export type ResourceWrites = Map<string, { values: Record<string, Json>; overrides: Record<string, Json> }>;

/** Records as seen by the command, including its own pending writes. */
export function withWrites(resources: ResourceInstance[], writes: ResourceWrites): ResourceInstance[] {
  if (!writes.size) return resources;
  return resources.map(record => {
    const pending = writes.get(record.id);
    if (!pending) return record;
    const next = { ...record, values: { ...record.values, ...pending.values } };
    return Object.keys(pending.overrides).length ? { ...next, overrides: { ...record.overrides, ...pending.overrides } } : next;
  });
}

/** Changed records to persist, in source order. */
export function changedResources(resources: ResourceInstance[], writes: ResourceWrites) {
  return withWrites(resources, writes).filter(record => writes.has(record.id));
}

function references(values: Record<string, unknown>) {
  return Object.values(values).flatMap(value => Array.isArray(value) ? value : [value]).filter(isResourceReference);
}

/** Instances reachable from the character's own values (class wrappers and their private graphs). */
function ownedIds(character: Character, resources: ResourceInstance[]) {
  const byId = new Map(resources.map(record => [record.id, record]));
  const owned = new Set<string>(), queue = references(character.values).map(item => item.resourceId);
  while (queue.length && owned.size < 10000) {
    const id = queue.pop()!, record = byId.get(id);
    if (owned.has(id) || !record || record.catalogSource) continue;
    owned.add(id);
    for (const item of references(record.values)) queue.push(item.resourceId);
  }
  return owned;
}

function targetId(target: unknown) {
  if (target instanceof RuntimeResource && target.key.startsWith('resource:')) return target.key.slice('resource:'.length);
  if (isResourceReference(target)) return target.resourceId;
  throw new Error('Destinazione evento di risorsa non valida.');
}

/** Marks an own-resource event name in evaluated subscriptions; plain strings are global names. */
const OWN = '\u241f';

/** Replace own-resource `eventName` nodes with marked names, so subscription formulas can be evaluated. */
function namedEvents(value: unknown, own: Set<string>): unknown {
  if (Array.isArray(value)) return value.map(item => namedEvents(item, own));
  if (!value || typeof value !== 'object') return value;
  const node = object(value);
  if (node.type === 'eventName' && node.for_resource == null && typeof node.event_name === 'string') {
    own.add(node.event_name);
    return { type: 'constant', value: OWN + node.event_name, value_type: 'string' };
  }
  return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, namedEvents(item, own)]));
}

const subscriptionCache = new WeakMap<ResourceDefinition, ResourceDefinition['stats']>();
/** Definition stats with own `eventName` nodes resolved to their names. */
function subscriptionStats(definition: ResourceDefinition) {
  let cached = subscriptionCache.get(definition);
  if (!cached) subscriptionCache.set(definition, cached = namedEvents(definition.stats, new Set()) as ResourceDefinition['stats']);
  return cached;
}

/** Own event names a subscription formula can produce, following the instance stats it reads. */
function possibleOwnNames(definition: ResourceDefinition, formula: unknown) {
  const own = new Set<string>(), seen = new Set<string>(), queue = [formula];
  while (queue.length && seen.size < 1000) {
    const value = queue.pop();
    namedEvents(value, own);
    JSON.stringify(value ?? null, (key, item) => {
      if (key === 'stat' && typeof item === 'string' && !seen.has(item)) {
        seen.add(item);
        const stat = definition.stats.find(candidate => candidate.id === item);
        if (stat?.type === 'calculated') queue.push(stat.components);
      }
      return item;
    });
  }
  return own;
}

/**
 * Find the single handler of `name` on one resource type.
 * @param subscribed Evaluates a `calculated_event_names` formula for the concrete instance; without it,
 * only the statically possible own event names count (the card-button gate has no instance).
 * @param global Match a character-level event: only plain names in calculated subscriptions qualify,
 * since static `event_names` on a resource are scoped to it.
 */
function resourceMechanic(definition: ResourceDefinition, name: string, subscribed?: (formula: unknown) => string[], global = false) {
  const mechanics = Array.isArray(definition.mechanics) ? definition.mechanics.map(item => object(item)) : [];
  const matching = mechanics.filter(mechanic => {
    if (!global && eventNames(mechanic.event_names).includes(name)) return true;
    if (mechanic.calculated_event_names == null) return false;
    if (subscribed) return subscribed(mechanic.calculated_event_names).includes(global ? name : OWN + name);
    return !global && possibleOwnNames(definition, mechanic.calculated_event_names).has(name);
  });
  if (matching.length > 1) throw new Error('Evento con più gestori sulla risorsa: ordine non documentato.');
  const mechanic = matching[0];
  if (mechanic && (typeof mechanic.id !== 'string' || !mechanic.id)) throw new Error('Meccanica senza identificatore.');
  return mechanic;
}

/**
 * Build the resource dispatcher and writer of one character command.
 * @param parent Character command context; its messages, budget and ancestors are shared.
 * @param characterScope Current `$character` snapshot, including the command's overrides.
 */
export function resourceDispatcher(system: SystemDefinition, character: Character, resources: ResourceInstance[],
  writes: ResourceWrites, parent: EffectContext, characterScope: () => RuntimeResource) {
  let owned: Set<string> | undefined;
  function ownedRecord(target: unknown) {
    const id = targetId(target);
    const record = resources.find(item => item.id === id);
    const definition = system.resources.find(item => item.id === record?.definitionId);
    if (!record || !definition) throw new Error(`Risorsa mancante: ${id}`);
    owned ??= ownedIds(character, resources);
    if (!owned.has(id)) throw new Error('Effetto su una risorsa che non appartiene al personaggio.');
    return { id, record, definition };
  }
  function evaluateIn(id: string, definition: ResourceDefinition, variables: Record<string, unknown>, value: unknown,
    stats = definition.stats) {
    const current = withWrites(resources, writes), self = current.find(item => item.id === id)!;
    return createEvaluator(stats, self.values, undefined, {
      resources: current, resourceDefinitions: system.resources, createdAt: self.createdAt,
      instanceId: self.sourceId ?? self.id, enumerations: system.enumerated_types, variables,
      overrides: self.overrides, character: characterScope()
    }).evaluate(value);
  }
  function subscriptions(id: string, definition: ResourceDefinition) {
    return (formula: unknown) => {
      const names = evaluateIn(id, definition, { $edit_mode: false }, namedEvents(formula, new Set()), subscriptionStats(definition));
      const list = typeof names === 'string' ? [names] : names;
      if (!Array.isArray(list) || list.length > 100 || list.some(item => typeof item !== 'string'))
        throw new Error('Sottoscrizione evento non valida.');
      return list as string[];
    };
  }
  function write(target: unknown, statId: string, value: unknown, mode: ResourceWriteMode = 'set') {
    const { id, definition } = ownedRecord(target);
    const stat = definition.stats.find(item => item.id === statId);
    if (!stat || !['base', 'calculated'].includes(stat.type)) throw new Error(`Statistica mancante: ${statId}`);
    let json = jsonValue(value);
    if (mode === 'add') {
      const current = evaluateIn(id, definition, {}, { type: 'stat', stat: stat.id }) ?? 0;
      if (!['integer', 'decimal'].includes(stat.value_type) || typeof current !== 'number' || typeof json !== 'number')
        throw new Error('I modificatori richiedono una statistica numerica.');
      json = current + json;
    }
    if (!matchesType(json, stat.value_type, stat.sub_value_type)) throw new Error(`Valore non valido per ${stat.id} (${stat.value_type}).`);
    const pending = writes.get(id) ?? { values: {}, overrides: {} };
    pending[stat.type === 'base' ? 'values' : 'overrides'][stat.id] = json;
    writes.set(id, pending);
  }
  function dispatchResource(target: unknown, name: string, ancestors: string[], payload: Record<string, unknown> = {},
    view?: Record<string, unknown>, global = false): EffectTerminal | undefined {
    const { id, record, definition } = ownedRecord(target), key = `${name}@${id}`;
    if (ancestors.length >= 8 || ancestors.includes(key)) throw new Error('Ciclo o catena eventi troppo lunga.');
    const mechanic = resourceMechanic(definition, name, subscriptions(id, definition), global);
    if (!mechanic) return undefined;
    const effect = object(mechanic.effects), chain = [...ancestors, key];
    validateEffect(effect, system, chain, Object.assign(parent.budget, { defer: true }));
    const variables: Record<string, unknown> = { $event: payload, $edit_mode: false, ...view ? { $view: view } : {} };
    const ctx: EffectContext = {
      ...parent, values: record.values, variables, mechanicId: mechanic.id as string, ancestors: chain,
      evaluate: value => evaluateIn(id, definition, variables, value),
      // An unscoped event from a resource handler reaches the same resource first, then the character
      // (5e: weapon `shoot_ammo` is weapon-local, item `remove_empty_items` is a character mechanic).
      dispatch(event: unknown) {
        const next = object(event);
        if (typeof next.name === 'string' && resourceMechanic(definition, next.name, subscriptions(id, definition)))
          return dispatchResource({ resourceId: id }, next.name, chain, next.payload == null ? {} : object(next.payload));
        return parent.dispatch(event);
      },
      dispatchResource: (next, nextName) => dispatchResource(next, nextName, chain),
      scope: {
        write: (statId, value, mode) => write({ resourceId: id }, statId, value, mode),
        // The character mechanic that fired this event owns the override, so reverting it reverts both.
        character: (type, statId, aggregation, value) => writeCharacterStat(parent, type, statId, aggregation, value)
      }
    };
    const terminal = executeEffect(effect, ctx);
    // Rolls are already evaluated in the resource scope; a popup would need that scope for its view.
    if (terminal?.kind === 'popup') throw new Error('Popup da un evento di risorsa non supportato.');
    return terminal;
  }
  return {
    dispatch: (target: unknown, name: string, payload?: Record<string, unknown>) => dispatchResource(target, name, parent.ancestors, payload),
    /** A card button: the card's own inputs are its `$view` (5e item `item_quantity` edits `edit_quantity`). */
    card(target: unknown, name: string, payload?: Record<string, unknown>) {
      const { id, definition } = ownedRecord(target);
      const self = withWrites(resources, writes).find(item => item.id === id)!;
      return dispatchResource(target, name, parent.ancestors, payload, cardView(definition, self.values));
    },
    /**
     * Deliver a character event to every owned instance subscribed to it by name (5e effect
     * `recharge` on `short_rest`). Each subscriber is atomic: a failing one is rolled back and
     * reported as a warning, so one unsupported effect cannot block the character's own event.
     */
    broadcast(name: string) {
      owned ??= ownedIds(character, resources);
      for (const record of resources) {
        const definition = system.resources.find(item => item.id === record.definitionId);
        if (!owned.has(record.id) || !definition?.mechanics?.some(item => object(item).calculated_event_names != null)) continue;
        const saved = new Map([...writes].map(([id, item]) => [id, { values: { ...item.values }, overrides: { ...item.overrides } }]));
        const overrides = parent.overrides, messages = parent.messages.length, rolls = parent.pendingRolls?.length ?? 0;
        try {
          const terminal = dispatchResource({ resourceId: record.id }, name, parent.ancestors, {}, undefined, true);
          if (terminal) throw new Error('Tiro o popup da un evento globale di risorsa non supportato.');
        } catch (error) {
          writes.clear(); saved.forEach((item, id) => writes.set(id, item));
          parent.overrides = overrides; parent.messages.length = messages;
          if (parent.pendingRolls) parent.pendingRolls.length = rolls;
          parent.messages.push({ type: 'warning', text: `${record.name}: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
    },
    write
  };
}

function cardView(definition: ResourceDefinition, values: Record<string, unknown>) {
  return definition.display_view == null ? {} : initialDrafts(definition.display_view, definition.stats, values);
}

/** Static gate for a resource-card button: one valid handler on that resource type, nothing executed. */
export function resourceEventSupported(system: SystemDefinition, definitionId: string, event: unknown) {
  try {
    const input = object(event);
    const definition = system.resources.find(item => item.id === definitionId);
    if (!definition || typeof input.name !== 'string') return false;
    const mechanic = resourceMechanic(definition, input.name);
    if (!mechanic) return false;
    validateEffect(object(mechanic.effects), system, [input.name], { nodes: 0, defer: true });
    // A required `$view.` value must be one of the card's own inputs; any other comes from a popup form.
    const inputs = Object.keys(cardView(definition, {}));
    return [...JSON.stringify(mechanic.effects).matchAll(/"\$view\.([\w-]+)/g)].every(match => inputs.includes(match[1]));
  } catch { return false; }
}
