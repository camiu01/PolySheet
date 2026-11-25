/** @file Combatant card events: a character runs its own mechanics; a resource combatant stays inert. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, expect, it } from 'vitest';
import type { SystemDefinition } from '../src/domain/model';
import { diagnose, prepareSystem } from '../src/importing/system';
import { commandCombat, createCombat } from '../src/persistence/combat';
import { createCharacter, db, installSystem } from '../src/persistence/db';
import { CombatTracker } from '../src/ui/CombatTracker';
import { capabilitySystem, constant, list, stat } from './fixtures/capabilities';

const event = { name: 'rollStat', payload: { stat: 'vigore', label: 'Prova originale' } };
const tap = (id: string, statId: string) => ({ id, type: 'stat', stat: statId, on_tap_event: event });
const definition = {
  ...capabilitySystem,
  mechanics: [{ id: 'roll_stat', event_names: 'rollStat', effects: {
    type: 'roll', rolls: list({ type: 'rollable', formulas: list(constant('1d20 + 2')), text: stat('$event.label') })
  } }],
  combat_system: {
    ...capabilitySystem.combat_system,
    combatant_types: capabilitySystem.combat_system.combatant_types.map(type => ({
      ...type, header_view: tap(`${type.id}_header`, type.id === 'hero' ? 'vigore' : 'initiative')
    }))
  }
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it('reports combat events only for combatants without an owner mechanic', () => {
  const events = diagnose(definition as unknown as SystemDefinition).filter(item => item.path.endsWith('on_tap_event'));
  expect(events.map(item => [item.path, item.message])).toEqual([[
    '$.combat_system.combatant_types[0].header_view.on_tap_event',
    'Evento "rollStat" non disponibile per questo combattente: nel tracker solo i personaggi eseguono eventi.'
  ]]);
});

it('runs a character combatant event from the tracker, offers its total as initiative and leaves resource combatants inert', async () => {
  const system = await prepareSystem(JSON.stringify(definition), 'Original MIT combat event fixture');
  await installSystem(system);
  const character = await createCharacter(system, 'Mira');
  const combat = await createCombat(system.key, 'Prova');
  try {
    await commandCombat(combat.id, { type: 'add', typeId: 'hero', sourceId: character.id });
    await commandCombat(combat.id, { type: 'add', typeId: 'scout' });
    render(<CombatTracker systems={[system]} system={system} characters={[character]} run={work => work().then(() => undefined)} />);
    const action = await screen.findByRole('button', { name: 'Esegui azione · Vigore' });
    // The scout card shows its value but offers no action: it has no mechanic of its own.
    expect(screen.queryByRole('button', { name: 'Esegui azione · initiative' })).toBeNull();
    fireEvent.click(action);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Prova originale')).toBeTruthy();
    expect((await db.characters.get(character.id))?.values).toEqual(character.values);
    const total = Number(within(dialog).getByLabelText(/Prova originale/, { selector: 'output' }).textContent);
    expect(total).toBeGreaterThanOrEqual(3);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usa come iniziativa · Prova originale' }));
    await waitFor(async () => expect((await db.combats.get(combat.id))?.combatants
      .find(f => f.characterId === character.id)?.initiative).toBe(total));
  } finally {
    await db.combats.delete(combat.id); await db.characters.delete(character.id); await db.systems.delete(system.key);
  }
});
