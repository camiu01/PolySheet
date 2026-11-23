/** @file Import choices, progressive GitHub options and complete compatibility review. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { Library } from '../src/ui/Library';
import { ImportDiagnostics, SystemImportOptions } from '../src/ui/SystemImport';
import { db } from '../src/persistence/db';
import { it as copy } from '../src/ui/it';
import { useUi } from '../src/ui/store';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it('offers distinct file, folder, link and example actions and disables them while busy', () => {
  const onFile = vi.fn(), onFolder = vi.fn(), onLink = vi.fn(), onDemo = vi.fn();
  const { rerender } = render(<SystemImportOptions onFile={onFile} onFolder={onFolder} onLink={onLink} onDemo={onDemo} busy={false} />);
  fireEvent.click(screen.getByRole('button', { name: copy.localFile }));
  fireEvent.click(screen.getByRole('button', { name: copy.localFolder }));
  fireEvent.click(screen.getByRole('button', { name: copy.importUrl }));
  fireEvent.click(screen.getByRole('button', { name: copy.demoAction }));
  for (const callback of [onFile, onFolder, onLink, onDemo]) expect(callback).toHaveBeenCalledTimes(1);
  rerender(<SystemImportOptions onFile={onFile} onFolder={onFolder} onLink={onLink} onDemo={onDemo} busy />);
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
});

it('removes the duplicate import action and only exposes the optional reference for a GitHub repository', () => {
  render(<Library systems={[]} run={async work => { await work(); }} />);
  expect(screen.queryByRole('button', { name: copy.importSystem })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: copy.importUrl }));
  expect(screen.getByRole('dialog', { name: copy.importUrl })).toBeVisible();
  const url = screen.getByRole('textbox', { name: copy.url });
  for (const value of ['https://github.com', 'https://github.com/', 'https://github.com/owner/', 'https://github.com/owner/repository/tree/']) {
    fireEvent.change(url, { target: { value } });
    expect(screen.getByRole('dialog', { name: copy.importUrl })).toBeVisible();
  }
  fireEvent.change(url, { target: { value: 'https://files.example/system.rpg' } });
  expect(screen.queryByText(copy.importAdvanced)).toBeNull();
  for (const value of ['git@github.com:owner/repository.git', 'ssh://git@github.com/owner/repository.git',
    'git://github.com/owner/repository.git', 'https://www.github.com/owner/repository']) {
    fireEvent.change(url, { target: { value } });
    expect(screen.getByText(copy.importAdvanced)).toBeInTheDocument();
  }
  fireEvent.change(url, { target: { value: 'https://github.com/owner/repository' } });
  expect(screen.getByText(copy.importAdvanced).closest('details')).not.toHaveAttribute('open');
  fireEvent.click(screen.getByText(copy.importAdvanced));
  expect(screen.getByRole('textbox', { name: copy.repositoryRef })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: copy.cancel }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('installs the bundled example in one step and opens the character list', async () => {
  const before = await db.systems.count();
  useUi.setState({ page: 'systems' });
  render(<Library systems={[]} run={async work => { await work(); }} />);
  fireEvent.click(screen.getByRole('button', { name: copy.demoAction }));
  await waitFor(async () => expect(await db.systems.count()).toBe(before + 1));
  expect(screen.queryByRole('dialog', { name: copy.importPreview })).toBeNull();
  await waitFor(() => expect(useUi.getState().page).toBe('characters'));
  expect((await db.systems.toArray()).some(s => s.definition.id === 'polysheet-sentieri' && s.key === useUi.getState().systemKey)).toBe(true);
});

it('expands blocking errors and counts all warnings while bounding the visible detail list', () => {
  const warnings = Array.from({ length: 101 }, (_, index) => ({
    path: `$.future_${index}`, message: 'Campo conservato, ma non interpretato.', severity: 'warning' as const
  }));
  render(<ImportDiagnostics diagnostics={[
    ...warnings, { path: '$.invalid', message: 'Invalid source field', severity: 'error' }
  ]} />);
  expect(screen.getByText('Invalid source field').closest('details')).toHaveAttribute('open');
  expect(screen.getByText(copy.diagnosticGroups.fields).closest('details')).not.toHaveAttribute('open');
  expect(screen.getByText('(101)')).toBeInTheDocument();
  // Repeated messages collapse to one entry; the fields stay readable and the exact paths stay bounded.
  expect(screen.getByText('Campo conservato, ma non interpretato.')).toBeInTheDocument();
  expect(screen.getByText('×101')).toBeInTheDocument();
  expect(screen.getByText('future_0', { selector: 'code' })).toBeInTheDocument();
  expect(screen.getByText('$.future_99', { selector: 'code' })).toBeInTheDocument();
  expect(screen.queryByText('$.future_100', { selector: 'code' })).toBeNull();
  expect(screen.getByText(copy.displayedDiagnostics)).toBeInTheDocument();
});
