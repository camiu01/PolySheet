// @vitest-environment node
/** @file Resource-scoped events, owned resource writes and the PF2e daily preparations original. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import type { Character, ResourceInstance, StoredSystem } from '../src/domain/model';
import { executeCharacterEvent } from '../src/engine/character-events';
import { resourceEventSupported } from '../src/engine/resource-events';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { installSystem, SheetDatabase } from '../src/persistence/db';
import { runCharacterEvent } from '../src/persistence/character-events';
import { revertMechanic } from '../src/engine/overrides';
import { demo } from '../src/demo';
import { base, constant, list, stat } from './fixtures/capabilities';

const set = (target: string, value: unknown) => ({ type: 'setStat', stat: target, new_value: value, aggregation_type: 'set' });
const fire = (forResource: unknown) => ({ type: 'fireEvent', event_names: list({ type: 'eventName', event_name: 'resource_daily', for_resource: forResource }) });
const never = (effect: unknown) => ({ type: 'when', clauses: [{ condition: constant(false), effect }] });

const definition = {
  ...demo,
  character_stats: [...demo.character_stats, base('classes', 'array', [], 'resource'), base('slots', 'integer', 0)],
  resources: [...demo.resources, {
    id: 'cls', name: 'Classe', stats: [base('used', 'integer', 0), base('max', 'integer', 3), base('choices', 'array', [], 'resource')],
    mechanics: [{ id: 'on_resource_daily', event_names: 'resource_daily', effects: { type: 'sequence', effects: [
      set('used', stat('max')),
      set('$character.slots', stat('max')),
      { type: 'forEach', components: stat('choices'), for_each_value_key: '$choice', apply: set('$choice.spent', constant(0)) }
    ] } }]
  }, { id: 'choice', name: 'Scelta', stats: [base('spent', 'integer', 0)] }],
  mechanics: [{ id: 'on_daily', event_names: 'daily', effects: { type: 'sequence', effects: [
    { type: 'forEach', components: stat('classes'), for_each_value_key: '$class', apply: fire(stat('$class')) },
    never({ type: 'delayed', millis: 100, effect: { type: 'fireEvent', event: { name: 'daily', payload: {} } } })
  ] } }]
};
const system = { key: 'resource-events', definition } as unknown as StoredSystem;
const record = (id: string, definitionId: string, values: ResourceInstance['values'], extra: Partial<ResourceInstance> = {}): ResourceInstance =>
  ({ id, systemKey: system.key, definitionId, name: id, values, ...extra });
const resources = [
  record('wrapper', 'cls', { used: 1, max: 4, choices: [{ resourceId: 'choice' }] }),
  record('choice', 'choice', { spent: 2 }),
  record('catalog', 'cls', { used: 1, max: 9, choices: [] }, { catalogSource: { original: '{}', source: 'x', digest: 'x' } })
];
const character = (classes: string[]): Character => ({
  id: 'c1', systemKey: system.key, name: 'Mira', values: { classes: classes.map(resourceId => ({ resourceId })), slots: 0 },
  resourceIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revision: 1
});

it('runs the targeted resource handler, writes owned base values and owns $character writes by the firing mechanic', () => {
  const result = executeCharacterEvent(system, character(['wrapper']), resources, { name: 'daily', payload: {} });
  expect(result.resources.map(item => [item.id, item.values])).toEqual([
    ['wrapper', { used: 4, max: 4, choices: [{ resourceId: 'choice' }] }],
    ['choice', { spent: 0 }]
  ]);
  expect(result.overrides).toEqual({ on_daily: { values: { slots: { aggregation: 'set', value: 4 } } } });
  expect(revertMechanic(result.overrides, 'on_daily')).toEqual({});
  expect(resources[0].values.used).toBe(1);
});

it('refuses catalog roots, computed name lists, non-replacing resource writes and a reached delayed effect', () => {
  expect(() => executeCharacterEvent(system, character(['catalog']), resources, { name: 'daily', payload: {} }))
    .toThrow('non appartiene al personaggio');
  // Loose JSON view of the definition, so a test can swap any node of the original shape.
  type Mechanics = { effects: { effects: Record<string, unknown>[] } }[];
  type Loose = { mechanics: Mechanics; resources: { mechanics?: Mechanics }[] };
  const variant = (patch: (copy: Loose) => void) => {
    const copy = structuredClone(definition);
    patch(copy as unknown as Loose);
    return () => executeCharacterEvent({ ...system, definition: copy } as unknown as StoredSystem, character(['wrapper']), resources, { name: 'daily', payload: {} });
  };
  expect(variant(copy => { copy.mechanics[0].effects.effects[0] = { type: 'fireEvent', event_names: stat('names') }; }))
    .toThrow('Nomi evento dinamici non supportati');
  expect(variant(copy => { copy.resources.at(-2)!.mechanics![0].effects.effects[0] = { type: 'addToStat', stat: 'used', value: constant(1) }; }))
    .toThrow('solo setStat');
  expect(variant(copy => { (copy.mechanics[0].effects.effects[1].clauses as { condition: unknown }[])[0].condition = constant(true); }))
    .toThrow('Effetto ritardato non supportato');
});

it('treats a resource without a handler and a when without a matching clause as no change', () => {
  const plain = structuredClone(definition);
  delete (plain.resources.at(-2) as { mechanics?: unknown }).mechanics;
  const result = executeCharacterEvent({ ...system, definition: plain } as unknown as StoredSystem, character(['wrapper']), resources, { name: 'daily', payload: {} });
  expect(result.resources).toEqual([]);
  expect(result.overrides).toEqual({});
});

const official = '.reference/official-releases-2026-11-16/pf2e-system.rpg';
const classes = '.reference/rpg-companion-app-systems/systems/pf2e/resource_instances';
it.skipIf(!existsSync(official) || !existsSync(classes))('runs unchanged PF2e daily preparations after creating first-level characters', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync(official)).toString('utf8'), 'Local-only official PF2e fixture');
  const database = new SheetDatabase(`daily-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    // PF2e level 1: class Hit Points (no ancestry chosen) and first-rank slots of the spontaneous/prepared casters.
    for (const [name, hp, slots] of [['fighter', 10, 0], ['rogue', 8, 0], ['witch', 6, 2], ['bard', 8, 2], ['druid', 8, 2]] as const) {
      const original = readFileSync(`${classes}/class_${name}__pc1_.rpg.json`, 'utf8');
      const [id] = await installCatalogs([await prepareCatalogTemplate(original, 'local.json', system)], database);
      const saved = await configureCharacter(system, name, {}, { classes: id }, undefined, database, false);
      const { result, character } = await runCharacterEvent(saved.id, { name: 'daily_preparations', payload: {} }, database);
      const values = result.values;
      expect(values.current_hp).toBe(hp);
      expect(character.values.current_hp).toBe(hp);
      expect(values.spell_slots_1).toBe(slots);
      expect(character.revision).toBe(saved.revision + 1);
    }
  } finally { await database.delete(); }
}, 120000);

const cardDefinition = {
  ...definition,
  resources: [...definition.resources, {
    id: 'blade', name: 'Lama', stats: [base('equipped', 'bool', false), base('ammo', 'integer', 3), base('bonus', 'integer', 2), base('dice', 'array', ['1d6'], 'string')],
    mechanics: [
      { id: 'blade_equip', event_names: 'toggle_equip', effects: set('equipped', { type: 'not', components: stat('equipped') }) },
      { id: 'blade_attack', event_names: 'attack', effects: { type: 'sequence', effects: [
        { type: 'fireEvent', event: { name: 'shoot', payload: {} } },
        { type: 'roll', rolls: list({ type: 'rollable', text: constant('to hit'), formulas: list(constant('1d20 + 2')) }) },
        { type: 'fireEvent', event: { name: 'shared', payload: {} } },
        { type: 'delayed', millis: 500, effect: { type: 'dismissResource' } }
      ] } },
      { id: 'blade_shoot', event_names: 'shoot', effects: { type: 'addToStat', stat: 'ammo', value: constant(-1), aggregation_type: 'set' } },
      { id: 'blade_damage', event_names: 'damage', effects: { type: 'roll', rolls: { type: 'map', components: stat('dice'),
        mapper: { type: 'rollable', text: constant('danno'), formulas: list(stat('$mapValue'), constant('-1')) } } } },
      { id: 'blade_typed', event_names: 'typed', effects: set('bonus', stat('$view.amount')) },
      { id: 'blade_cast', event_names: 'cast', effects: { type: 'addToStat', stat: '$character.slots', value: constant(-1), aggregation_type: 'set' } }
    ]
  }],
  mechanics: [...definition.mechanics, { id: 'on_shared', event_names: 'shared', effects: set('slots', constant(7)) }]
};
const cardSystem = { key: 'resource-events', definition: cardDefinition } as unknown as StoredSystem;
const blade = record('blade-1', 'blade', { equipped: false, ammo: 3, bonus: 2, dice: ['1d6'] });

it('runs a resource card action on its own mechanics, collects rolls and reaches the resource before the character', () => {
  const owner = character(['wrapper']);
  owner.values.weapon = { resourceId: 'blade-1' };
  const all = [...resources, blade];
  const equip = executeCharacterEvent(cardSystem, owner, all, { name: 'toggle_equip' }, undefined, 'blade-1');
  expect(equip.resources.map(item => item.values.equipped)).toEqual([true]);
  const attack = executeCharacterEvent(cardSystem, owner, all, { name: 'attack' }, () => 5, 'blade-1');
  expect(attack.kind).toBe('roll');
  expect(attack.kind === 'roll' && attack.rolls.map(row => [row.text, row.results[0].total])).toEqual([['to hit', 7]]);
  expect(attack.resources.map(item => item.values.ammo)).toEqual([2]);
  // `on_shared` has no revert subscription, so its set is a lasting base write, not an override.
  expect(attack.overrides).toEqual({});
  expect(attack.values).toEqual({ slots: 7 });
  const damage = executeCharacterEvent(cardSystem, owner, all, { name: 'damage' }, () => 4, 'blade-1');
  expect(damage.kind === 'roll' && damage.rolls[0].results.map(result => result.total)).toEqual([4, -1]);
  expect(() => executeCharacterEvent(cardSystem, character(['wrapper']), all, { name: 'toggle_equip' }, undefined, 'blade-1'))
    .toThrow('non appartiene al personaggio');
});

it('repeats a card addToStat on the character base value instead of refusing the second cast', () => {
  const owner = character(['wrapper']);
  owner.values.weapon = { resourceId: 'blade-1' };
  const first = executeCharacterEvent(cardSystem, owner, [...resources, blade], { name: 'cast' }, undefined, 'blade-1');
  expect(first.overrides).toEqual({});
  expect(first.values).toEqual({ slots: -1 });
  const second = executeCharacterEvent(cardSystem, { ...owner, values: { ...owner.values, ...first.values } },
    [...resources, blade], { name: 'cast' }, undefined, 'blade-1');
  expect(second.overrides).toEqual({});
  expect(second.values).toEqual({ slots: -2 });
});

it('offers card buttons only for valid handlers that need no popup form values', () => {
  expect(resourceEventSupported(cardDefinition, 'blade', { name: 'attack' })).toBe(true);
  expect(resourceEventSupported(cardDefinition, 'blade', { name: 'typed' })).toBe(false);
  expect(resourceEventSupported(cardDefinition, 'blade', { name: 'missing' })).toBe(false);
  expect(resourceEventSupported(cardDefinition, 'choice', { name: 'attack' })).toBe(false);
});

const pinned5e = '.reference/5e.json';
it.skipIf(!existsSync(pinned5e))('runs unchanged 5e item quantity buttons and an active effect use from their cards', async () => {
  const full = await prepareSystem(readFileSync(pinned5e, 'utf8'), 'pinned external original');
  const fifth = { key: full.key, definition: full.definition } as StoredSystem;
  const item = (id: string, values: ResourceInstance['values']) => ({ id, systemKey: fifth.key, definitionId: 'item', name: id, values });
  const effect = { id: 'sw', systemKey: fifth.key, definitionId: 'effect', name: 'Uses left', values: {
    name: 'Uses left', trigger_type: 'active', has_charges: true, recharge_event: 'short_rest', max_charges_constant: 1 } };
  const all: ResourceInstance[] = [item('rope', { name: 'Rope', quantity: 2, edit_quantity: 3 }), item('torch', { name: 'Torch', quantity: 1 }), effect];
  const owner: Character = { ...character([]), systemKey: fifth.key,
    values: { equipment: [{ resourceId: 'rope' }, { resourceId: 'torch' }], feature_effect: { resourceId: 'sw' } } };

  expect(resourceEventSupported(fifth.definition, 'item', { name: 'add_quantity' })).toBe(true);
  expect(resourceEventSupported(fifth.definition, 'effect', { name: 'use' })).toBe(true);
  // The card's Amount field edits `edit_quantity`, the `$view.item_quantity` the handler reads.
  const added = executeCharacterEvent(fifth, owner, all, { name: 'add_quantity' }, undefined, 'rope');
  expect(added.resources.map(record => [record.id, record.values.quantity])).toEqual([['rope', 5]]);
  // An unset Amount uses the source default (1); reaching zero fires the character's `remove_empty_items`.
  const removed = executeCharacterEvent(fifth, owner, all, { name: 'subtract_quantity' }, undefined, 'torch');
  expect(removed.resources.map(record => [record.id, record.values.quantity])).toEqual([['torch', 0]]);
  expect(removed.values.equipment).toEqual([{ resourceId: 'rope' }]);
  expect(removed.overrides).toEqual({});

  const used = executeCharacterEvent(fifth, owner, all, { name: 'use' }, undefined, 'sw');
  expect(used.resources.map(record => [record.values, record.overrides])).toEqual([[effect.values, { current_charges: 0 }]]);
  const spent = used.resources[0];
  const again = executeCharacterEvent(fifth, owner, [...all.slice(0, 2), spent], { name: 'use' }, undefined, 'sw');
  expect(again.resources).toEqual([]);
});

it('delivers a character event to subscribed resources, keeps own names scoped and isolates a failing subscriber', () => {
  const calculated = (id: string, components: unknown, value_type = 'integer', sub_value_type?: string) =>
    ({ id, name: id, type: 'calculated', value_type, sub_value_type, components });
  const rested = {
    ...definition,
    resources: [...definition.resources, {
      id: 'charge', name: 'Carica', stats: [base('max', 'integer', 2), base('on', 'string', 'rest'),
        calculated('left', stat('max')), calculated('own', list({ type: 'eventName', event_name: 'spend' }), 'array', 'string'),
        calculated('subs', list(stat('on')), 'array', 'string')],
      mechanics: [
        { id: 'spend', calculated_event_names: stat('own'), effects: { type: 'addToStat', stat: 'left', value: constant(-1), aggregation_type: 'set' } },
        { id: 'refill', calculated_event_names: stat('subs'), effects: set('left', stat('max')) }
      ]
    }, {
      id: 'broken', name: 'Rotta', stats: [base('x', 'integer', 0)],
      mechanics: [{ id: 'bad', calculated_event_names: list(constant('rest')), effects: set('missing', constant(1)) }]
    }],
    mechanics: [...definition.mechanics, { id: 'on_rest', event_names: 'rest', effects: { type: 'showMessage', message: constant('Riposato') } },
      { id: 'on_spend', event_names: 'spend', effects: { type: 'showMessage', message: constant('Personaggio') } }]
  };
  const restSystem = { key: system.key, definition: rested } as unknown as StoredSystem;
  const owner = { ...character([]), values: { charge: { resourceId: 'ch' }, other: { resourceId: 'br' } } };
  const all = [record('ch', 'charge', {}), record('br', 'broken', {})];
  const spent = executeCharacterEvent(restSystem, owner, all, { name: 'spend' }, undefined, 'ch');
  expect(spent.resources.map(item => item.overrides)).toEqual([{ left: 1 }]);
  // A character `spend` never reaches the resource's own scoped `spend`.
  expect(executeCharacterEvent(restSystem, owner, [spent.resources[0], all[1]], { name: 'spend' }).resources).toEqual([]);
  const rest = executeCharacterEvent(restSystem, owner, [spent.resources[0], all[1]], { name: 'rest' });
  expect(rest.resources.map(item => [item.id, item.overrides])).toEqual([['ch', { left: 2 }]]);
  expect(rest.messages).toEqual([{ type: 'info', text: 'Riposato' }, { type: 'warning', text: 'br: Statistica mancante: missing' }]);
});
