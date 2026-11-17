/** @file Original action contracts plus local-only 5e/Archer regression evidence. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, expect, it, vi } from 'vitest';
import { demo } from '../src/demo';
import { base, constant, list } from './fixtures/capabilities';
import { characterEventEffect, executeCharacterEvent } from '../src/engine/character-events';
import { RuntimeResource } from '../src/engine/formulas';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalog } from '../src/importing/catalog';
import { createCharacter, db, initialValues, installSystem, setCharacterValue, SheetDatabase } from '../src/persistence/db';
import { saveCharacterEvent } from '../src/persistence/character-events';
import { configureCharacter } from '../src/persistence/catalog';
import { RenderView } from '../src/ui/renderer';
import { CharacterInventory } from '../src/ui/CharacterInventory';
import { useCharacterEvents } from '../src/ui/CharacterEvents';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  class TestPointerEvent extends MouseEvent {
    isPrimary: boolean;
    constructor(type: string, options: PointerEventInit = {}) { super(type, options); this.isPrimary = options.isPrimary ?? true; }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
});

const choose = { name: 'choose' };
const popup = { type: 'showPopUp', pop_up_title: constant('Competenza'),
  pop_up_view: { id: 'choice', type: 'select', stat: 'rank', options: 'ranks', style: 'list' },
  display_save_button: true, should_persist_on_save: true };
const definition = { ...demo, character_stats: [...demo.character_stats, base('rank', 'string', 'none'), base('hp', 'integer', 0)],
  enumerated_types: [{ id: 'ranks', types: [{ id: 'none', name: 'Nessuna' }, { id: 'trained', name: 'Allenata' }] }],
  mechanics: [{ id: 'choice', event_names: 'choose', effects: popup }] };

it('saves a popup using its opening event after the click event has expired', async () => {
  const system = await prepareSystem(JSON.stringify(definition), 'Popup UI regression');
  await installSystem(system);
  const owner = await createCharacter(system, 'Popup UI regression');
  function PopupHarness() {
    const events = useCharacterEvents(system, owner);
    return <><button onClick={() => events.onEvent(choose)}>Open choice</button>{events.dialog}</>;
  }
  const { unmount } = render(<PopupHarness />);
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Open choice' }));
    await screen.findByRole('dialog', { name: 'Competenza' });
    fireEvent.click(screen.getByRole('radio', { name: 'Allenata' }));
    expect((await db.characters.get(owner.id))?.values.rank).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect((await db.characters.get(owner.id))?.values.rank).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Open choice' }));
    await screen.findByRole('dialog', { name: 'Competenza' });
    fireEvent.click(screen.getByRole('radio', { name: 'Allenata' }));
    await setCharacterValue(owner.id, 'hp', 7);
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await db.characters.get(owner.id))?.values).toMatchObject({ rank: 'trained', hp: 7 });
  } finally {
    unmount();
    await db.characters.delete(owner.id);
    await db.systems.delete(system.key);
  }
});

it('follows the first true branch with unchanged payload; rejects cycles, multiple targets and unsupported branches', async () => {
  const forward = { type: 'forwardEvent', new_event_names: list(constant('choose')) };
  const system = await prepareSystem(JSON.stringify({ ...definition, mechanics: [...definition.mechanics,
    { id: 'route', event_names: 'route', effects: { type: 'when', clauses: [
      { condition: constant(false), effect: forward }, { condition: constant(true), effect: forward }
    ] } }] }), 'Original action contract');
  const database = new SheetDatabase(`action-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    const owner = await createCharacter(system, 'Mira', database);
    const result = executeCharacterEvent(system, owner, [], { name: 'route', payload: { label: 'kept' } });
    expect(result.kind).toBe('popup');
    if (result.kind === 'popup') {
      expect(result.edit?.field).toBe('rank'); expect(result.variables.$event).toEqual({ label: 'kept' });
    }
    // Static validation rejects multiple forward names and incomplete effects
    for (const effect of [
      { ...forward, new_event_names: list(constant('choose'), constant('choose')) },
      { type: 'when', clauses: [{ condition: constant(false), effect: { type: 'setStat' } }] }
    ]) expect(() => characterEventEffect({ ...system.definition, mechanics: [...definition.mechanics,
      { id: 'route', event_names: 'route', effects: effect }] }, { name: 'route' })).toThrow();
    // Cycle detection happens at execution time
    const cycleSystem = { ...system.definition, mechanics: [...definition.mechanics,
      { id: 'route', event_names: 'route', effects: { ...forward, new_event_names: list(constant('route')) } }] };
    expect(() => executeCharacterEvent({ ...system, definition: cycleSystem }, owner, [], { name: 'route', payload: { label: 'kept' } })).toThrow('Ciclo o catena eventi troppo lunga');
  } finally { await database.delete(); }
});

it('saves only the current popup field and allowed enum, retaining unrelated edits with rollback on refusal', async () => {
  const system = await prepareSystem(JSON.stringify(definition), 'Original popup contract');
  const database = new SheetDatabase(`popup-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    const owner = await createCharacter(system, 'Mira', database);
    await setCharacterValue(owner.id, 'hp', 7, database);
    await saveCharacterEvent(owner.id, choose, 'rank', { rank: 'trained' }, database);
    const saved = await database.characters.get(owner.id);
    expect(saved?.values).toMatchObject({ rank: 'trained', hp: 7 });
    for (const patch of [{ rank: 'invented' }, { hp: 99 }, { rank: null }])
      await expect(saveCharacterEvent(owner.id, choose, 'rank', patch, database)).rejects.toThrow();
    await expect(saveCharacterEvent(owner.id, choose, 'hp', { rank: 'none' }, database)).rejects.toThrow();
    expect(await database.characters.get(owner.id)).toEqual(saved);
  } finally { await database.delete(); }
});

it('long-presses once, suppresses the subsequent click, cancels movement and offers a keyboard alternative', () => {
  vi.useFakeTimers();
  try {
    const stats = [base('score', 'integer', 12)], values = { score: 12 }, onEvent = vi.fn();
    const node = { id: 'action-score', type: 'stat', stat: 'score',
      on_tap_event: { name: 'tap' }, on_long_tap_event: { name: 'long' } };
    render(<RenderView input={node} context={{ stats, values, onEvent, canEvent: () => true,
      character: new RuntimeResource('character:test', stats, values) }} />);
    const trigger = screen.getByRole('button', { name: 'Esegui azione · score' });
    fireEvent.pointerDown(trigger, { button: 0, isPrimary: true, clientX: 0, clientY: 0 });
    act(() => vi.advanceTimersByTime(601));
    fireEvent.pointerUp(trigger); fireEvent.click(trigger, { detail: 1 });
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ name: 'long' });
    onEvent.mockClear();
    fireEvent.pointerDown(trigger, { button: 0, isPrimary: true, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(trigger, { clientX: 30, clientY: 0 });
    act(() => vi.advanceTimersByTime(601));
    expect(onEvent).not.toHaveBeenCalled();
    fireEvent.pointerCancel(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Azione pressione lunga · score' }));
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ name: 'long' });
  } finally { vi.useRealTimers(); }
});

it('opens the original stat title, cancels without writes and applies bounded deltas to latest values', async () => {
  let latest = { coins: 9, untouched: 'keep' };
  const commit = vi.fn(async (patch: import('../src/persistence/views').ValuePatch) => {
    latest = { ...latest, ...(typeof patch === 'function' ? patch(latest) : patch) };
  });
  render(<RenderView input={{ id: 'currency', type: 'stat', stat: 'coins', min_value_allowed: 0,
    edit_bottom_sheet_title: constant('Copper') }} context={{ stats: [base('coins', 'integer', 4)], values: { coins: 4 }, onCommit: commit }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Modifica · coins' }));
  expect(screen.getByRole('dialog', { name: 'Copper' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(commit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Modifica · coins' }));
  fireEvent.change(screen.getByLabelText('Quantità'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sottrai' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(latest.coins).toBe(9);
  fireEvent.change(screen.getByLabelText('Quantità'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(latest).toEqual({ coins: 12, untouched: 'keep' });
});

it('evaluates formula colors consistently without accepting arbitrary CSS', () => {
  const { container } = render(<RenderView input={{ id: 'color-list', type: 'list', subviews: [
    { id: 'colored-text', type: 'text', text: constant('Original color'), color: constant('#4CAF50') },
    { id: 'colored-chip', type: 'chip', text: constant('Original chip'), border_color: constant('accent') }
  ] }} context={{ stats: [], values: {} }} />);
  expect(container.querySelector('[data-view-error]')).toBeNull();
  expect(screen.getByText('Original color').style.color).toBe('rgb(76, 175, 80)');
});

const official = '.reference/official-releases-2026-11-16/5e-system.rpg';
const archer = '.reference/archer-system.json';
it.skipIf(!existsSync(official) || !existsSync(archer))('executes unchanged official and Archer skill actions and renders original item edit colors', async () => {
  for (const path of [official, archer]) {
    const bytes = readFileSync(path);
    const system = await prepareSystem((path.endsWith('.rpg') ? gunzipSync(bytes) : bytes).toString('utf8'), 'Local-only source actions');
    const database = new SheetDatabase(`original-action-${crypto.randomUUID()}`);
    try {
      await installSystem(system, database);
      const catalogs = await Promise.all(['class_fighter_fighter', 'race_human', 'background_soldier'].map(name => prepareCatalog(
        readFileSync(`.reference/rpg-companion-app-systems/systems/5e/resource_instances/${name}.rpg.json`, 'utf8'), 'local.json', system)));
      const owner = await createCharacter(system, 'Mira', database);
      const wrapper = { id: 'class-wrapper', systemKey: system.key, definitionId: 'class_details', name: 'Fighter',
        values: { ...initialValues(system.definition.resources.find(d => d.id === 'class_details')!.stats),
          class: { resourceId: catalogs[0].rootId }, class_level: 1 } };
      // Archer omits resource_type declarations, so this evaluator fixture supplies explicit references rather than claiming guided setup support.
      const resources = [...catalogs.flatMap(catalog => catalog.resources), wrapper];
      owner.values = { ...owner.values, dexterity_score: 16, classes: [{ resourceId: wrapper.id }],
        race: { resourceId: catalogs[1].rootId }, background: { resourceId: catalogs[2].rootId } };
      const result = executeCharacterEvent(system, owner, resources, { name: 'skillTap',
        payload: { stat: 'acrobatics', statName: 'Acrobatics' } }, () => 10);
      expect(result.kind).toBe('roll');
      if (result.kind === 'roll') expect(result.rolls[0].results[0].total).toBe(13);
      const long = executeCharacterEvent(system, owner, resources, { name: 'editSkillProficiency',
        payload: { stat: 'acrobatics', statName: 'Acrobatics' } });
      expect(long.kind).toBe('popup');
      if (long.kind === 'popup') expect(long.edit).toMatchObject({ field: 'acrobatics_proficiency', options: ['none', 'proficient', 'expert'] });
      const item = system.definition.resources.find(resource => resource.id === 'item')!;
      const values = initialValues(item.stats);
      const { container, unmount } = render(<RenderView input={item.edit_view} context={{
        stats: item.stats, values, resources: [], resourceDefinitions: system.definition.resources,
        enumerations: system.definition.enumerated_types, drafts: {}, onChange: vi.fn()
      }} />);
      expect(container.querySelector('[data-view-error]')?.textContent ?? '').not.toContain('Colore non supportato');
      unmount();
    } finally { await database.delete(); }
  }
}, 20000);

it('stages inventory creation through source controls and saves owner plus instances atomically', async () => {
  const item = { id: 'item', name: 'Oggetto', stats: [base('name', 'string', '')],
    edit_view: { id: 'item-name', type: 'text', edit_stat: 'name' }, display_name: 'name' };
  const system = await prepareSystem(JSON.stringify({ ...demo, resources: [item],
    character_stats: [...demo.character_stats, { ...base('equipment', 'array', [], 'resource'), resource_type: 'item' }] }), 'Original inventory contract');
  let values: Record<string, unknown> = initialValues(system.definition.character_stats);
  let additions: import('../src/domain/model').ResourceInstance[] = [];
  render(<CharacterInventory context={{ stats: system.definition.character_stats, values, systemKey: system.key,
    resourceDefinitions: system.definition.resources, resources: [], drafts: {},
    onCommit: async (patch, created = []) => { values = { ...values, ...(typeof patch === 'function' ? patch(values) : patch) }; additions = [...additions, ...created]; }
  }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi risorsa · Oggetto' }));
  fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Corda' } });
  fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(additions).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi risorsa · Oggetto' }));
  const name = screen.getByLabelText('name');
  fireEvent.change(name, { target: { value: 'Corda' } }); fireEvent.blur(name);
  fireEvent.submit(screen.getByRole('button', { name: 'Salva' }).closest('form')!);
  await waitFor(() => expect(additions).toHaveLength(1));
  const database = new SheetDatabase(`inventory-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    expect(await database.resources.count()).toBe(0);
    const character = await configureCharacter(system, 'Mira', values, {}, undefined, database, false, additions);
    expect(character.values.equipment).toEqual([{ resourceId: additions[0].id }]);
    expect((await database.resources.get(additions[0].id))?.values.name).toBe('Corda');
    const before = await database.characters.toArray();
    await expect(configureCharacter(system, 'Refused', { ...values, hp: 'wrong' }, {}, undefined, database, false,
      [{ ...additions[0], id: crypto.randomUUID() }])).rejects.toThrow();
    expect(await database.characters.toArray()).toEqual(before);
    expect(await database.resources.count()).toBe(1);
  } finally { await database.delete(); }
});
