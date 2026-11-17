/** @file Novices explicitly select a game, even with an installed or selected demo. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { CharacterCreator } from '../src/ui/CharacterCreator';
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

it('offers only verified D&D imports and explains unavailable games without promising rules support', () => {
  const onChoose = vi.fn();
  const { rerender } = render(<GameChoices onChoose={onChoose} busy={false} />);
  for (const [name, id] of [[copy.game2014, '5e'], [copy.game2024, '5e2024']]) {
    fireEvent.click(screen.getByRole('button', { name: `${copy.gamePrepare} · ${name}` }));
    expect(onChoose).toHaveBeenLastCalledWith(id);
  }
  expect(screen.queryByRole('button', { name: /Pathfinder|Daggerheart/ })).toBeNull();
  fireEvent.click(screen.getByText(`${copy.gameUnavailable}: Pathfinder 2e, Daggerheart`));
  expect(screen.getByText(copy.pathfinderUnavailable, { exact: false })).toBeVisible();
  rerender(<GameChoices onChoose={onChoose} busy />);
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
});
