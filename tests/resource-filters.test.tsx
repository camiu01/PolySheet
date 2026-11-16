/** @file Source prefilters are visible, removable and independent of persisted assignment. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { resourceFilters, filterResources } from '../src/engine/resource-filters';
import { SourceResourceSelect } from '../src/ui/SourceViews';
import { base, constant, stat } from './fixtures/capabilities';
import type { ResourceDefinition } from '../src/domain/model';

const definition: ResourceDefinition = { id: 'spell', name: 'Spell', core: true,
  stats: [base('classes', 'array', [], 'string'), base('ritual', 'bool', false)],
  search_filters: [{ name: 'Class', stat: 'classes' }, { name: 'Ritual', stat: 'ritual' }] };
const resources = [
  { id: 'wizard', name: 'Arcane Eye', systemKey: 'sys', definitionId: 'spell', values: { classes: ['Wizard'], ritual: false } },
  { id: 'cleric', name: 'Bless', systemKey: 'sys', definitionId: 'spell', values: { classes: ['Cleric'], ritual: false } },
  { id: 'shared', name: 'Detect Magic', systemKey: 'sys', definitionId: 'spell', values: { classes: ['Wizard', 'Cleric'], ritual: true } }
];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it('matches any selected class, combines fields, preserves exact types and leaves empty preselection unrestricted', () => {
  const evaluate = (node: unknown) => (node as { value: unknown }).value;
  const filters = resourceFilters({ classes: { value: ['Wizard', 'Cleric'] }, ritual: { value: true } }, definition, evaluate);
  expect(filterResources(resources, definition, filters, {}).map(r => r.id)).toEqual(['shared']);
  expect(filterResources(resources, definition, resourceFilters({ classes: { value: [] } }, definition, evaluate), {})).toEqual(resources);
  expect(() => resourceFilters({ unknown: {} }, definition, evaluate)).toThrow('Filtro non definito');
  expect(() => resourceFilters({ ritual: { value: 'true' } }, definition, evaluate)).toThrow('non valido');
  expect(() => resourceFilters({ classes: { value: [null] } }, definition, evaluate)).toThrow('non valido');
  expect(() => resourceFilters([], definition, evaluate)).toThrow();
  const scalar = { ...definition, stats: [base('classes', 'string', '')] };
  expect(filterResources(resources.map(r => ({ ...r, values: { classes: r.name } })), scalar,
    resourceFilters({ classes: { value: ['Bless', 'Detect Magic'] } }, scalar, evaluate), {}).map(r => r.id)).toEqual(['cleric', 'shared']);
});

it('uses parent draft prefilters, broadens results explicitly and assigns only after selection', async () => {
  const onCommit = vi.fn().mockResolvedValue(undefined);
  render(<SourceResourceSelect node={{ id: 'spells', type: 'selectResources', resource_id: 'spell', stat: 'spells',
    preserve_ids: true, should_append: true, filters: { classes: stat('$view.classes') } }} context={{
    stats: [{ ...base('spells', 'array', [], 'resource'), resource_type: 'spell' }], values: {}, drafts: {},
    variables: { $view: { classes: ['Wizard'] } }, systemKey: 'sys', resourceDefinitions: [definition], resources, onCommit
  }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi risorsa · Spell' }));
  expect(screen.getByRole('checkbox', { name: 'Class: Wizard' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Arcane Eye' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bless' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Class: Wizard' }));
  expect(screen.getByRole('button', { name: 'Bless' })).toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Bless' } });
  fireEvent.click(screen.getByRole('button', { name: 'Bless' }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
  const [patch] = onCommit.mock.calls[0];
  expect(patch({ spells: [{ resourceId: 'wizard' }] })).toEqual({ spells: [{ resourceId: 'wizard' }, { resourceId: 'cleric' }] });
  expect(resources[0].values.classes).toEqual(['Wizard']);
});

it('keeps invalid source filters visible rather than offering unfiltered choices', () => {
  render(<SourceResourceSelect node={{ id: 'spells', type: 'selectResources', resource_id: 'spell', stat: 'spells',
    filters: { ritual: constant('true') } }} context={{ stats: [base('spells', 'array', [], 'resource')],
    values: {}, resources, resourceDefinitions: [definition], onCommit: vi.fn() }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi risorsa · Spell' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Valore del filtro non valido: ritual');
  expect(screen.queryByRole('button', { name: 'Bless' })).toBeNull();
});
