/** @file Resource paths must read live scoped inputs without persisting a preview. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { SourceForm } from '../src/ui/SourceForm';
import { RenderView } from '../src/ui/renderer';
import { parseSystem } from '../src/importing/system';
import { validationMessages } from '../src/engine/view-session';
import { demo } from '../src/demo';
import { base, constant } from './fixtures/capabilities';
import { characterEventPlan } from '../src/engine/character-events';
import { viewBindings } from '../src/importing/view-bindings';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

const stats = [base('race', 'resource', null)];
const definition = { id: 'race', name: 'Race', stats: [base('name', 'string', '')],
  display_view: { id: 'race-name', type: 'text', text: { type: 'stat', stat: 'name' } } };
const records = ['Committed', 'Draft'].map(name => ({
  id: name, definitionId: 'race', name, systemKey: 'pinned', values: { name }
}));
const popup = { id: 'details', type: 'popUpButton', text: constant('Details'),
  pop_up_title: constant('Race'), display_save_button: false, display_cancel_button: true,
  pop_up_view: { id: 'preview', type: 'resource', resource_id: 'race',
    stat: '$view.race-choice', view_type: 'display', create_if_empty: false } };

it('keeps parent input references in nested read-only popups and writes nothing on close', () => {
  const onCommit = vi.fn();
  render(<SourceForm input={popup} context={{
    stats, values: { race: { resourceId: 'Committed' } }, systemKey: 'pinned',
    variables: { $view: { 'race-choice': { resourceId: 'Draft' } } },
    resources: records, resourceDefinitions: [definition], onCommit
  }} onDone={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  const dialog = screen.getByRole('dialog', { name: 'Race' });
  expect(within(dialog).getByText('Draft')).toBeVisible();
  expect(within(dialog).queryByText(/Statistica mancante|Non supportato/)).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  expect(within(screen.getByRole('dialog')).getByText('Draft')).toBeVisible();
});

it('uses local input shadowing for validation while retaining distinct parent inputs', () => {
  const input = { id: 'local', type: 'list', subviews: [], validation_message: {
    type: 'stat', stat: '$view.parent-error'
  } };
  expect(validationMessages(input, [], {}, {}, { variables: { $view: { 'parent-error': 'Required' } } }))
    .toEqual({ local: 'Required' });
  expect(validationMessages(input, [], {}, { 'parent-error': null },
    { variables: { $view: { 'parent-error': 'Required' } } })).toEqual({});
});

it('resolves nested character resource paths, rejects foreign pins and keeps unsafe paths inert', () => {
  const { rerender } = render(<RenderView input={{ ...popup.pop_up_view, stat: 'race' }} context={{
    stats, values: { race: { resourceId: 'Draft' } }, resources: records,
    resourceDefinitions: [definition], systemKey: 'pinned'
  }} />);
  expect(screen.getByText('Draft')).toBeVisible();
  rerender(<RenderView input={{ ...popup.pop_up_view, stat: '$view.race-choice' }} context={{
    stats, values: {}, variables: { $view: { 'race-choice': { resourceId: 'Draft' } } },
    resources: records, resourceDefinitions: [definition], systemKey: 'foreign'
  }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Risorsa mancante o di tipo/versione non compatibile.');
  rerender(<RenderView input={{ ...popup.pop_up_view, stat: '$view.__proto__' }} context={{
    stats, values: {}, variables: { $view: {} }, resources: records, resourceDefinitions: [definition]
  }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Percorso statistica non valido');
});

it('diagnoses missing draft IDs rather than treating every scoped path as supported', () => {
  const view = { id: 'page', type: 'list', subviews: [
    { id: 'race-choice', type: 'selectResources', stat: 'race', resource_id: 'race' }, popup
  ] };
  const system = { ...demo, character_stats: stats, character_creation_flow: [{ title: { id: 'page', name: 'Page' }, view }],
    resources: [definition] };
  const { diagnostics } = parseSystem(JSON.stringify(system));
  expect(diagnostics.filter(d => d.path.endsWith('.pop_up_view.stat'))).toEqual([]);
  const invalid = JSON.stringify(system).replace('$view.race-choice', '$view.missing');
  expect(parseSystem(invalid).diagnostics.some(d => d.path.endsWith('.pop_up_view.stat')
    && d.message.includes('missing'))).toBe(true);
});

it('does not bind display-only duplicate IDs or ambiguous repeated inputs', () => {
  const input = { id: 'page', type: 'list', subviews: [
    { id: 'label', type: 'text' }, { id: 'label', type: 'text' },
    { id: 'duplicate', type: 'selectResources', stat: 'race' },
    { id: 'duplicate', type: 'selectResources', stat: 'race' }
  ] };
  expect(viewBindings(input, stats).size).toBe(0);
});

it('keeps source events inside popup draft sessions diagnosed even with a valid character handler', () => {
  const action = { id: 'action', type: 'stat', stat: 'score', on_long_tap_event: { name: 'message' } };
  const { diagnostics } = parseSystem(JSON.stringify({ ...demo, character_stats: [base('score', 'integer', 10)],
    mechanics: [{ id: 'message', event_names: 'message', effects: { type: 'showMessage', message: constant('Hello') } }],
    character_sheet_sections: [{ id: 'actions', view: { id: 'actions', type: 'list', subviews: [
      action, { ...popup, pop_up_view: { ...action, id: 'draft-action' } }
    ] } }]
  }));
  expect(diagnostics.filter(d => d.path.endsWith('.on_long_tap_event'))).toEqual([expect.objectContaining({
    path: '$.character_sheet_sections[0].view.subviews[1].pop_up_view.on_long_tap_event',
    message: expect.stringContaining('bozze')
  })]);
});

it('keeps unsupported automatic resource creation visible without blocking unrelated form inputs', () => {
  render(<RenderView input={{ ...popup.pop_up_view, stat: 'race', create_if_empty: true }} context={{
    stats, values: { race: null }, resourceDefinitions: [definition]
  }} />);
  expect(document.querySelector('[data-view-error]')).toBeNull();
  expect(screen.getByText(/Creazione automatica/)).toBeVisible();
  const { diagnostics } = parseSystem(JSON.stringify({ ...demo, character_stats: stats, resources: [definition],
    character_sheet_sections: [{ id: 'preview', view: { ...popup.pop_up_view, stat: 'race', create_if_empty: true } }] }));
  expect(diagnostics.some(d => d.path.endsWith('.create_if_empty'))).toBe(true);
});

const path = '.reference/archer-system.json';
it.skipIf(!existsSync(path))('resolves the unchanged Archer race preview path in its creation input scope', () => {
  const source = readFileSync(path, 'utf8');
  const { definition: system, diagnostics } = parseSystem(source);
  const original = system.character_creation_flow[0] as { view: { subviews: { subviews: unknown[] }[] } };
  const button = original.view.subviews[2].subviews[0];
  render(<RenderView input={button} context={{
    stats: system.character_stats, values: {},
    variables: { $view: { edit_character_basics_race_select: { resourceId: 'Draft' } } },
    systemKey: 'pinned', resources: records, resourceDefinitions: [definition]
  }} />);
  fireEvent.click(screen.getByRole('button', { name: 'SEE DETAILS' }));
  expect(screen.getByRole('dialog', { name: 'Draft' })).toBeVisible();
  expect(within(screen.getByRole('dialog')).getByText('Draft', { selector: 'p' })).toBeVisible();
  expect(diagnostics.filter(d => d.path === '$.character_creation_flow[0].view.subviews[2].subviews[0].pop_up_view.stat')).toEqual([]);
  const avatar = system.character_sheet_sections[0].view as Record<string, unknown>;
  expect(characterEventPlan(system, avatar.bottom_left_button_event).effect?.type).toBe('showPopUp');
  expect(diagnostics.some(d => d.path === '$.character_sheet_sections[0].view.bottom_left_button_event')).toBe(false);
  for (const required of ['$.character_creation_flow', '$.mechanics', '$.progression_systems',
    '$.resources[1].mechanics', '$.resources[6].mechanics', '$.resources[9].mechanics'])
    expect(diagnostics.some(d => d.path === required)).toBe(true);
});
