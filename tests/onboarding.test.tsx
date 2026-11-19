/** @file Novices explicitly select a game, even with an installed or selected demo. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { CharacterCreator } from '../src/ui/CharacterCreator';
import { Characters } from '../src/ui/Characters';
import { GameChoices } from '../src/ui/GameChoices';
import { prepareSystem } from '../src/importing/system';
import { demoOriginal } from '../src/demo';
import { useUi } from '../src/ui/store';
import { it as copy } from '../src/ui/it';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it('requires a deliberate game choice and labels the demo before showing a creation form', async () => {
  const system = await prepareSystem(demoOriginal, 'Original MIT demo');
  useUi.getState().selectSystem(system.key);
  const onChange = vi.fn();
  render(<CharacterCreator systems={[system]} onSystemChange={onChange} run={async work => { await work(); }}
    onClose={vi.fn()} onDone={vi.fn()} />);
  expect(screen.getByRole('combobox', { name: copy.chooseSystem })).toHaveValue('');
  expect(screen.queryByRole('button', { name: copy.create })).toBeNull();
  expect(screen.getByText(copy.chooseGameHelp)).toBeVisible();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: system.key } });
  expect(onChange).toHaveBeenCalledWith(system.key);
  expect(screen.getByText(copy.demoDescription)).toBeVisible();
  expect(screen.getByRole('button', { name: copy.create })).toBeEnabled();
  expect(screen.getByRole('spinbutton', { name: 'Vigore' })).toHaveValue(2);
  expect(screen.getByRole('option', { name: /Sentieri.*Demo · non D&D/ })).toBeInTheDocument();
});

it('offers the same preparation entry for D&D and guided PF2e without promising automatic PF2e download', () => {
  const onChoose = vi.fn();
  const { rerender } = render(<GameChoices onChoose={onChoose} busy={false} />);
  for (const [name, id] of [[copy.game2014, '5e'], [copy.game2024, '5e2024']]) {
    fireEvent.click(screen.getByRole('button', { name: `${copy.gamePrepare} · ${name}` }));
    expect(onChoose).toHaveBeenLastCalledWith(id);
  }
  expect(screen.getByText(copy.pathfinderHelp)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: `${copy.gamePrepare} · Pathfinder 2e` }));
  expect(onChoose).toHaveBeenLastCalledWith('pf2e');
  expect(screen.queryByRole('button', { name: /Daggerheart/ })).toBeNull();
  fireEvent.click(screen.getByText(`${copy.gameUnavailable}: Daggerheart`));
  expect(screen.getByText(copy.daggerheartUnavailable, { exact: false })).toBeVisible();
  rerender(<GameChoices onChoose={onChoose} busy />);
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
});

it('gives an empty roster a single route to the game library', () => {
  useUi.getState().navigate('characters');
  render(<Characters systems={[]} characters={[]} run={async work => { await work(); }} />);
  expect(screen.getByRole('heading', { name: copy.emptyCharacters })).toBeVisible();
  expect(screen.queryByText(copy.chooseRules)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: copy.importSystem }));
  expect(useUi.getState().page).toBe('systems');
});

it('shows search and game filters only when there is something to narrow down', async () => {
  const demo = await prepareSystem(demoOriginal, 'Original MIT demo');
  const other = { ...demo, key: 'other', definition: { ...demo.definition, id: 'original-other', name: 'Altro gioco' } };
  const character = (id: string, systemKey: string) => ({ id, systemKey, name: `Eroe ${id}`, values: {}, resourceIds: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revision: 1 });
  const run = async (work: () => Promise<unknown>) => { await work(); };
  const { rerender } = render(<Characters systems={[demo]} characters={[character('a', demo.key)]} run={run} />);
  expect(screen.queryByLabelText(copy.search)).toBeNull();
  expect(screen.queryByText(copy.recentCharacter)).toBeNull();
  expect(screen.getByText(copy.chooseRules)).toBeVisible();
  const mixed = [character('a', demo.key), character('b', 'other'), character('c', 'other'), character('d', 'other')];
  rerender(<Characters systems={[demo, other]} characters={mixed} run={run} />);
  expect(screen.getByLabelText(copy.search)).toBeVisible();
  expect(screen.getByText(copy.recentCharacter)).toBeVisible();
  expect(screen.queryByText(copy.chooseRules)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Altro gioco 3' }));
  expect(document.querySelectorAll('.character-card')).toHaveLength(3);
});

it('leads an installed game to its characters instead of preparing it again', () => {
  const onChoose = vi.fn(), onUse = vi.fn();
  render(<GameChoices busy={false} onChoose={onChoose} installed={['5e']} onUse={onUse} />);
  fireEvent.click(screen.getByRole('button', { name: `${copy.useGame} · ${copy.game2014}` }));
  expect(onUse).toHaveBeenCalledWith('5e');
  expect(screen.getByRole('button', { name: `${copy.gamePrepare} · ${copy.game2024}` })).toBeEnabled();
  expect(onChoose).not.toHaveBeenCalled();
});

it('opens installed PF2e characters rather than asking for another compiled file', () => {
  const onChoose = vi.fn(), onUse = vi.fn();
  render(<GameChoices busy={false} onChoose={onChoose} installed={['pf2e']} onUse={onUse} />);
  fireEvent.click(screen.getByRole('button', { name: `${copy.useGame} · Pathfinder 2e` }));
  expect(onUse).toHaveBeenCalledWith('pf2e');
  expect(onChoose).not.toHaveBeenCalled();
});

it('preselects the game chosen last, but never the demo', async () => {
  const demo = await prepareSystem(demoOriginal, 'Original MIT demo');
  const other = { ...demo, key: 'other', definition: { ...demo.definition, id: 'original-other', name: 'Altro gioco' } };
  const props = { onSystemChange: vi.fn(), run: async (work: () => Promise<unknown>) => { await work(); }, onDone: vi.fn(), onClose: vi.fn() };
  useUi.getState().selectSystem('other');
  const { unmount } = render(<CharacterCreator systems={[demo, other]} character={undefined} {...props} />);
  expect(screen.getByRole('combobox', { name: copy.chooseSystem })).toHaveValue('other');
  unmount();
  useUi.getState().selectSystem(demo.key);
  render(<CharacterCreator systems={[demo, other]} character={undefined} {...props} />);
  expect(screen.getByRole('combobox', { name: copy.chooseSystem })).toHaveValue('');
});
