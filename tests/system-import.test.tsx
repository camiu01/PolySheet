/** @file Import choices, progressive GitHub options and complete compatibility review. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { Library } from '../src/ui/Library';
import { ImportDiagnostics, SystemImportOptions } from '../src/ui/SystemImport';
import { db } from '../src/persistence/db';
import { it as copy } from '../src/ui/it';

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
  expect(screen.getByRole('list', { name: copy.importSteps }).children).toHaveLength(3);
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

it('previews the example and cancels without installing a system', async () => {
  const before = await db.systems.count();
  render(<Library systems={[]} run={async work => { await work(); }} />);
  fireEvent.click(screen.getByRole('button', { name: copy.demoAction }));
  await screen.findByRole('dialog', { name: copy.importPreview });
  expect(screen.getByText(copy.importReviewHelp)).toBeVisible();
  expect(screen.getByText((_, element) => element?.tagName === 'P'
    && element.textContent === '7 statistiche · 3 sezioni · 1 tipo di risorsa')).toBeVisible();
  expect(await db.systems.count()).toBe(before);
  fireEvent.click(screen.getByRole('button', { name: copy.cancel }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(await db.systems.count()).toBe(before);
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
  expect(screen.getAllByText('Campo conservato, ma non interpretato.')).toHaveLength(100);
  expect(screen.getByText(copy.displayedDiagnostics)).toBeInTheDocument();
});
