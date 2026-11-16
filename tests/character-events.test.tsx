/** @file Explicit event subscriptions, source rolls and read-only popup boundaries. */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';
import { characterEventEffect, executeCharacterEvent, rollEventDice } from '../src/engine/character-events';
import { RuntimeResource } from '../src/engine/formulas';
import { prepareSystem } from '../src/importing/system';
import { createCharacter, db, installSystem, SheetDatabase } from '../src/persistence/db';
import { demo } from '../src/demo';
import { base, constant, list, stat } from './fixtures/capabilities';
import { canSourceEvent, useCharacterEvents } from '../src/ui/CharacterEvents';
import { RenderView } from '../src/ui/renderer';

const roll = { type: 'roll', rolls: list({ type: 'rollable', formulas: list(constant('1d20 + -1')), text: stat('$event.label') }) };
const definition = { ...demo, mechanics: [{ id: 'roll', event_names: 'testRoll', effects: roll }] };
const event = { name: 'testRoll', payload: { label: 'Prova originale' } };

async function fixture() {
  const system = await prepareSystem(JSON.stringify(definition), 'Original MIT event fixture');
  const database = new SheetDatabase(`event-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    const character = await createCharacter(system, 'Mira', database);
    return { system, character };
  } finally { await database.delete(); }
}

it('uses one source-selected handler and rejects writes, unknown options and ambiguous/dynamic subscriptions', () => {
  expect(characterEventEffect(definition, event)).toEqual(roll);
  expect(() => characterEventEffect({ ...definition, mechanics: [...definition.mechanics, ...definition.mechanics] }, event)).toThrow();
  expect(() => characterEventEffect({ ...definition, mechanics: [{ ...definition.mechanics[0], calculated_event_names: constant('testRoll') }] }, event)).toThrow();
  expect(() => characterEventEffect({ ...definition, mechanics: [{ ...definition.mechanics[0], effects: { type: 'setStat' } }] }, event)).toThrow();
  expect(() => characterEventEffect(definition, { ...event, targets: [] })).toThrow();
});

it('preserves signed bonuses and verifies normal, min and max dice without executing code', () => {
  expect(rollEventDice('1d20 + -1', () => 10).total).toBe(9);
  let index = 0;
  expect(rollEventDice('max(2d20) + 3', () => [4, 17][index++]).total).toBe(20);
  index = 0;
  expect(rollEventDice('min(2d20) - 2', () => [4, 17][index++]).total).toBe(2);
  for (const expression of ['1d20;alert(1)', 'max(2d20)+1d6', '101d20', '1d1', '1d20'.repeat(30)])
    expect(() => rollEventDice(expression)).toThrow();
});

it('executes only on demand, consumes exactly one draw and leaves owner and event immutable', async () => {
  const { system, character } = await fixture();
  const before = structuredClone({ system, character, event });
  const random = vi.fn(() => 10);
  const result = executeCharacterEvent(system, character, [], event, random);
  expect(result.kind).toBe('roll');
  if (result.kind !== 'roll') throw new Error('Expected roll');
  expect(result.rolls[0].text).toBe('Prova originale');
  expect(result.rolls[0].results[0].total).toBe(9);
  expect(random).toHaveBeenCalledTimes(1);
  expect({ system, character, event }).toEqual(before);
});

it('preflights every formula before randomness and rejects callbacks without partial execution', async () => {
  const { system, character } = await fixture();
  const random = vi.fn(() => 10);
  const effects = { ...roll, rolls: list({ type: 'rollable', formulas: list(constant('1d20'), constant('unsupported()')), text: constant('test') }) };
  const changed = { ...system, definition: { ...definition, mechanics: [{ ...definition.mechanics[0], effects }] } };
  expect(() => executeCharacterEvent(changed, character, [], event, random)).toThrow();
  expect(random).not.toHaveBeenCalled();
  const callback = { ...roll, on_result_effect: { type: 'setStat', stat: 'hp' } };
  expect(() => executeCharacterEvent({ ...system, definition: { ...definition,
    mechanics: [{ ...definition.mechanics[0], effects: callback }] } }, character, [], event, random)).toThrow();
});

it('keeps nested resource and draft events isolated and exposes a keyboard-operable source stat action', () => {
  const stats = [base('score', 'integer', 12)], values = { score: 12 };
  const onEvent = vi.fn();
  const context = { stats, values, character: new RuntimeResource('character:test', stats, values), canEvent: () => true, onEvent };
  expect(canSourceEvent(context, event)).toBe(true);
  expect(canSourceEvent({ ...context, stats: [...stats] }, event)).toBe(false);
  expect(canSourceEvent({ ...context, drafts: {} }, event)).toBe(false);
  render(<RenderView input={{ id: 'roll-score', type: 'stat', stat: 'score', on_tap_event: event }} context={context} />);
  expect(onEvent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Esegui azione · score' }));
  expect(onEvent).toHaveBeenCalledExactlyOnceWith(event);
});

const official = '.reference/official-releases-2026-11-16/5e-system.rpg';
it('serializes overlapping clicks, renders no random draws and executes once again only on a new command', async () => {
  const system = await prepareSystem(JSON.stringify(definition), 'Original MIT event fixture');
  await installSystem(system);
  const character = await createCharacter(system, 'Event lock test');
  const random = vi.spyOn(crypto, 'getRandomValues');
  try {
    const { result, rerender } = renderHook(() => useCharacterEvents(system, character));
    expect(random).not.toHaveBeenCalled();
    act(() => { result.current.onEvent(event); result.current.onEvent(event); });
    await waitFor(() => expect(result.current.eventBusy).toBe(false));
    expect(random).toHaveBeenCalledTimes(1);
    expect((await db.characters.get(character.id))?.values).toEqual(character.values);
    rerender(); expect(random).toHaveBeenCalledTimes(1);
    act(() => result.current.onEvent(event));
    await waitFor(() => expect(random).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.eventBusy).toBe(false));
  } finally {
    random.mockRestore();
    await db.characters.delete(character.id); await db.systems.delete(system.key);
  }
});

it.skipIf(!existsSync(official))('executes the unchanged official roll_stat and show_information effects', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync(official)).toString('utf8'), 'Local-only original');
  const database = new SheetDatabase(`official-event-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    const character = await createCharacter(system, 'Mira', database);
    character.values.strength_score = 16;
    const result = executeCharacterEvent(system, character, [], { name: 'rollStat', payload: { stat: 'strength_modifier', statName: 'Strength' } }, () => 10);
    expect(result.kind).toBe('roll');
    if (result.kind === 'roll') expect(result.rolls[0].results[0].total).toBe(13);
    const info = executeCharacterEvent(system, character, [], { name: 'show_information' });
    expect(info.kind).toBe('popup');
    if (info.kind === 'popup') { expect(info.title).toBe('About Mira'); expect(info.input).toHaveProperty('id', 'information_bottom_sheet'); }
  } finally { await database.delete(); }
});
