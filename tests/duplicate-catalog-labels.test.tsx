/** @file Catalog entries sharing a name are told apart by their real import source. */
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { ResourceInstance } from '../src/domain/model';
import { LocalResourcePicker, duplicateSourceLabels, spellLevel } from '../src/ui/LocalResourcePicker';

const base = 'https://raw.githubusercontent.com/owner/repo/main/races/';
function record(id: string, name: string, source?: string): ResourceInstance {
  return { id, systemKey: 's', definitionId: 'race', name, values: {},
    ...(source ? { catalogSource: { original: '{}', source, digest: id } } : {}) };
}

it('labels only duplicated names, using the differing source tail', () => {
  const labels = duplicateSourceLabels([
    record('a', 'Satyr', `${base}MOoT/satyr.json`),
    record('b', 'Satyr', `${base}MPMM/satyr.json`),
    record('c', 'Elf', `${base}PHB/elf.json`)
  ]);
  expect(Object.fromEntries(labels)).toEqual({ a: 'MOoT/satyr', b: 'MPMM/satyr' });
});

it('invents no label for unsourced copies or identical sources', () => {
  expect(duplicateSourceLabels([record('a', 'Satyr'), record('b', 'Satyr')]).size).toBe(0);
  expect(duplicateSourceLabels([record('a', 'Satyr', `${base}x.json`), record('b', 'satyr', `${base}x.json`)]).size).toBe(0);
  expect(duplicateSourceLabels([record('a', 'Satyr', `${base}%E0/a.json`), record('b', 'Satyr', `${base}b.json`)]).get('a')).toBe('%E0/a');
});

it('shows the source label inside the option button', () => {
  render(<LocalResourcePicker busy={false} onSelect={() => undefined} resources={[
    record('a', 'Satyr', `${base}MOoT/satyr.json`), record('b', 'Satyr', `${base}MPMM/satyr.json`)
  ]} />);
  expect(screen.getByRole('button', { name: 'Satyr MOoT/satyr' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Satyr MPMM/satyr' })).toBeVisible();
});

it('prefers upstream source-book codes over file names and lists options alphabetically', () => {
  const dir = 'https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/x/systems/5e/resource_instances/';
  const resources = [
    record('a', 'Tortle', `${dir}race_tortle_tortle__mom_.rpg.json`),
    record('b', 'Tortle', `${dir}race_tortle_tortle.rpg.json`),
    record('c', 'Aarakocra', `${dir}race_aarakocra_aarakocra.rpg.json`)
  ];
  expect(Object.fromEntries(duplicateSourceLabels(resources))).toEqual({ a: 'MOM' });
  render(<LocalResourcePicker busy={false} onSelect={() => undefined} resources={resources} />);
  expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Aarakocra', 'Tortle MOM', 'Tortle']);
});

it('orders spells by level and shows the level from copies or retained catalog originals', () => {
  const spell = (id: string, name: string, level: string, template = false): ResourceInstance => ({
    id, systemKey: 's', definitionId: 'spell', name,
    values: template ? {} : { level },
    ...(template ? { catalogSource: { original: JSON.stringify({ resource_id: 'spell', stats: { level: { value: level } } }), source: `${id}.json`, digest: id } } : {})
  });
  const resources = [spell('a', 'Shatter', 'spell_level_2', true), spell('b', 'Absorb Elements', 'spell_level_1'),
    spell('c', 'Fire Bolt', 'spell_level_0', true), record('d', 'Alarm')];
  expect(resources.map(spellLevel)).toEqual([2, 1, 0, undefined]);
  render(<LocalResourcePicker busy={false} onSelect={() => undefined} resources={resources} />);
  expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(
    ['Fire Bolt Trucchetto', 'Absorb Elements Liv. 1', 'Shatter Liv. 2', 'Alarm']);
});

it('finds multiword source file names without changing their labels', () => {
  render(<LocalResourcePicker busy={false} onSelect={() => undefined} resources={[
    record('a', 'monster_ancient_black_dragon.json'), record('b', 'Goblin')
  ]} />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  ANCIENT   black_dragon  ' } });
  expect(screen.getByRole('button', { name: 'monster_ancient_black_dragon.json' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Goblin' })).toBeNull();
});
