/** @file Character ownership, resource enumeration propagation and actual stat detail drafts. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { createEvaluator, RuntimeResource } from '../src/engine/formulas';
import { RenderView } from '../src/ui/renderer';
import { SourceResourceSelect } from '../src/ui/SourceViews';
import { SourceForm } from '../src/ui/SourceForm';
import { base, constant, stat } from './fixtures/capabilities';
import type { ResourceDefinition } from '../src/domain/model';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it.each(['resource', 'resourceArray', 'resourceSection'])('retains $parent in %s views and refreshes its latest values', type => {
  const label = { id: 'parent-label', type: 'text', text: stat('$parent.level') };
  const definition: ResourceDefinition = { id: 'child', name: 'Child', stats: [], list_view: label, display_view: label };
  const record = { id: 'child', systemKey: 'sys', definitionId: 'child', name: 'Child', values: {} };
  const array = type !== 'resource';
  const context = {
    stats: [base('level', 'integer', 2), base('children', array ? 'array' : 'resource',
      array ? [{ resourceId: record.id }] : { resourceId: record.id }, array ? 'resource' : undefined)],
    values: { level: 2 }, resources: [record], resourceDefinitions: [definition]
  };
  const input = { id: 'children-view', type, stat: 'children', resource_stat: 'children', resource_id: 'child' };
  const result = render(<RenderView input={input} context={context} />);
  expect(screen.getByText('2', { exact: true })).toBeInTheDocument();
  result.rerender(<RenderView input={input} context={{ ...context, values: { level: 5 } }} />);
  expect(screen.getByText('5', { exact: true })).toBeInTheDocument();
  expect(screen.queryByText('2', { exact: true })).toBeNull();
});

it('resolves only an explicitly supplied character snapshot, with separate caches and strict missing contexts', () => {
  const stats = [base('attack', 'integer', 5)];
  const character = new RuntimeResource('owner-a', stats, { attack: 5 });
  const formula = stat('$character.attack');
  const first = createEvaluator([], {}, undefined, { character });
  expect(first.evaluate(formula)).toBe(5);
  expect(createEvaluator([], {}, undefined, { character: new RuntimeResource('owner-b', stats, { attack: 9 }) }).evaluate(formula)).toBe(9);
  expect(first.evaluate(formula)).toBe(5);
  expect(() => createEvaluator([], {}).evaluate(formula)).toThrow('Statistica mancante: $character');
  expect(createEvaluator([], {}).evaluate(stat('$character?.attack'))).toBeNull();
});

it('retains enumerations and owning character in resource list and detail views, without leaking a parent draft', () => {
  const definition: ResourceDefinition = { id: 'spell', name: 'Spell', stats: [base('school', 'string', 'arcane')],
    list_view: { id: 'summary', type: 'list', subviews: [
      { id: 'school-label', type: 'text', text: { type: 'enumeratedName', enumerated_type: 'schools', id: stat('school') } },
      { id: 'attack-label', type: 'text', text: stat('$character.attack') },
      { id: 'no-parent-draft', type: 'text', text: stat('$view?.secret?') }
    ] }, display_view: { id: 'dc-label', type: 'text', text: stat('$character.dc') } };
  const record = { id: 'spell-1', systemKey: 'sys', definitionId: 'spell', name: 'Detect Magic', values: { school: 'arcane' } };
  render(<RenderView input={{ id: 'spells', type: 'resourceSection', resource_id: 'spell', resource_stat: 'spells' }} context={{
    stats: [{ ...base('spells', 'array', [], 'resource'), resource_type: 'spell' }],
    values: { spells: [{ resourceId: record.id }] }, systemKey: 'sys', resources: [record], resourceDefinitions: [definition],
    character: new RuntimeResource('character', [base('attack', 'integer', 5), base('dc', 'integer', 13)], {}),
    variables: { $view: { secret: 'Must not leak' } },
    enumerations: [{ id: 'schools', name: 'Schools', types: [{ id: 'arcane', name: 'Arcana' }] }]
  }} />);
  expect(screen.getByText('Arcana')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(screen.queryByText('Must not leak')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Dettagli · Detect Magic' }));
  expect(screen.getByText('13')).toBeInTheDocument();
});

it('clones a selected private catalog child without its protected identity/group metadata', async () => {
  const record = { id: 'private-feat', sourceId: 'upstream-feat', catalogGroup: 'private-class', systemKey: 'sys',
    definitionId: 'feat', name: 'Magic Sight', values: { name: 'Magic Sight' } };
  const onCommit = vi.fn().mockResolvedValue(undefined);
  render(<SourceResourceSelect node={{ id: 'pick', type: 'selectResources', resource_id: 'feat', stat: 'feats' }} context={{
    stats: [{ ...base('feats', 'array', [], 'resource'), resource_type: 'feat' }], values: {}, drafts: {},
    systemKey: 'sys', resources: [record], resourceDefinitions: [{ id: 'feat', name: 'Feat', core: true, stats: [base('name', 'string', '')] }],
    onCommit
  }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi risorsa · Feat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Magic Sight' }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
  const [patch, additions] = onCommit.mock.calls[0], copy = additions[0];
  expect(copy.id).not.toBe(record.id);
  expect(copy.values).toEqual(record.values);
  expect(copy).not.toHaveProperty('catalogGroup');
  expect(copy).not.toHaveProperty('sourceId');
  expect(patch({})).toEqual({ feats: [{ resourceId: copy.id }] });
  expect(record.sourceId).toBe('upstream-feat');
});

it('uses safe dynamic stat colors and saves/cancels the original detail form rather than firing events', async () => {
  const onCommit = vi.fn().mockResolvedValue(undefined);
  const view = { id: 'hp-detail', type: 'stat', stat: 'hp', name_color: constant('hint'), stat_color: constant('primary'),
    bottom_sheet_view: { id: 'hp-edit', type: 'text', edit_stat: 'hp' }, bottom_sheet_in_edit_mode: true, sheet_title: constant('Punti ferita') };
  render(<RenderView input={view} context={{ stats: [base('hp', 'integer', 4)], values: { hp: 4 }, onCommit }} />);
  expect(screen.getByTestId('stat-hp').style.color).toBe('var(--accent)');
  fireEvent.click(screen.getByRole('button', { name: 'Dettagli · hp' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Dettagli · hp' }));
  expect(screen.getByRole('spinbutton')).toHaveValue(4);
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ hp: 6 }, []));
});

it('isolates readonly stat details from parent drafts and honors explicit tap-event precedence', () => {
  const detail = { id: 'detail', type: 'stat', stat: 'hp', bottom_sheet_view: {
    id: 'read-mode', type: 'list', subviews: [
      { id: 'mode', type: 'text', text: stat('$edit_mode') },
      { id: 'no-draft', type: 'text', text: stat('$view?.secret?') }
    ]
  } };
  const result = render(<RenderView input={detail} context={{ stats: [base('hp', 'integer', 4)], values: {},
    drafts: { secret: 'Parent' }, variables: { $edit_mode: true, $view: { secret: 'Parent' } }, onChange: vi.fn(), onCommit: vi.fn() }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Dettagli · hp' }));
  expect(within(screen.getByRole('dialog')).getByText('false')).toBeInTheDocument();
  expect(within(screen.getByRole('dialog')).queryByText('Parent')).not.toBeInTheDocument();
  expect(within(screen.getByRole('dialog')).queryByRole('spinbutton')).not.toBeInTheDocument();
  result.unmount();
  render(<RenderView input={{ ...detail, on_tap_event: { event: 'roll' } }}
    context={{ stats: [base('hp', 'integer', 4)], values: {} }} />);
  expect(screen.queryByRole('button', { name: 'Dettagli · hp' })).not.toBeInTheDocument();
  expect(screen.getByText('Non supportato: on_tap_event')).toBeInTheDocument();
});

it('updates the owning character through a nested character draft instead of exposing its committed values', () => {
  const stats = [base('attack', 'integer', 5)], committed = { attack: 5 };
  render(<SourceForm input={{ id: 'fields', type: 'list', subviews: [
    { id: 'attack-edit', type: 'text', edit_stat: 'attack' },
    { id: 'attack-preview', type: 'text', text: stat('$character.attack') }
  ] }} context={{ stats, values: { attack: 7 }, character: new RuntimeResource('owner', stats, committed), onCommit: vi.fn() }} onDone={vi.fn()} />);
  expect(screen.getByText('7')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } });
  fireEvent.blur(screen.getByRole('spinbutton'));
  expect(screen.getByText('9')).toBeInTheDocument();
  expect(committed.attack).toBe(5);
});

it('exposes the upstream resource identity as `id` in root scopes and in resourceArray button labels', () => {
  const ids = base('selected_ids', 'array', ['feat-a'], 'string');
  const selected = { id: 'selected', name: 'Selected', type: 'calculated', value_type: 'bool',
    components: { type: 'contains', haystack: stat('selected_ids'), needle: stat('id') } } as const;
  expect(createEvaluator([ids, selected], {}, undefined, { instanceId: 'feat-a' }).get('selected')).toBe(true);
  expect(createEvaluator([ids, selected], {}, undefined, { instanceId: 'feat-b' }).get('selected')).toBe(false);
  expect(() => createEvaluator([ids, selected], {}).get('selected')).toThrow('Statistica mancante: id');
});

it('keeps `$view` local: a nested resource does not inherit its parent form drafts', () => {
  const detail = { id: 'detail', name: 'Detail', stats: [base('label', 'string', 'x')] } as ResourceDefinition;
  const record = { id: 'd1', systemKey: 'sys', definitionId: 'detail', name: 'D', values: {} };
  const evaluator = createEvaluator([base('details', 'array', [{ resourceId: 'd1' }], 'resource')], {}, undefined, {
    resources: [record], resourceDefinitions: [detail], variables: { $view: { parent_input: 'P' } } });
  expect(evaluator.evaluate(stat('$view.parent_input'))).toBe('P');
  const nested = { type: 'map', components: stat('details'), map_value_key: '$item', mapper: stat('$item?.$view?.child_select.name') };
  expect(evaluator.evaluate(nested)).toEqual([null]);
});

it('does not offer the root of another character private graph', () => {
  const root = { id: 'private-class', catalogGroup: 'private-class', systemKey: 'sys', definitionId: 'feat', name: 'Fighter copy', values: {} };
  render(<SourceResourceSelect node={{ id: 'pick', type: 'selectResources', resource_id: 'feat', stat: 'feats' }} context={{
    stats: [{ ...base('feats', 'array', [], 'resource'), resource_type: 'feat' }], values: {}, drafts: {},
    systemKey: 'sys', resources: [root], resourceDefinitions: [{ id: 'feat', name: 'Feat', core: true, stats: [base('name', 'string', '')] }],
    onCommit: vi.fn() }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi risorsa · Feat' }));
  expect(screen.queryByRole('button', { name: 'Fighter copy' })).toBeNull();
});
