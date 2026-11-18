/** @file Source layout/value/resource views: enumerations, counters, pages and arrays. */
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RenderView } from '../src/ui/renderer';
import { enumerationEntries } from '../src/engine/enumerations';
import { base, constant, list, stat } from './fixtures/capabilities';
import type { ResourceDefinition, ResourceInstance } from '../src/domain/model';

const enumerations = [
  { id: 'modes', name: 'Modalità', types: [{ id: 'fast', name: 'Rapida' }, { id: 'safe', name: 'Sicura' }] },
  { id: 'extended', name: 'Estesa', extends_type: 'modes', types: [{ id: 'expert', name: 'Esperta' }] }
];

it('resolves inherited enumeration entries in declaration order and honours allowlists', () => {
  expect(enumerationEntries(enumerations, 'extended').map(entry => entry.id)).toEqual(['fast', 'safe', 'expert']);
  expect(enumerationEntries(enumerations, 'modes', ['safe']).map(entry => entry.name)).toEqual(['Sicura']);
  expect(() => enumerationEntries(enumerations, 'missing')).toThrow('Enumerazione mancante');
});

it('renders pages with source names and a collapsible section', () => {
  const view = { id: 'pages', type: 'viewPager', names: list(constant('Uno'), constant('Due')), subviews: [
    { id: 'details', type: 'collapsible', title: constant('Dettagli'), start_expanded: true,
      subviews: [{ id: 'details-text', type: 'text', text: constant('Contenuto interno') }] },
    { id: 'second', type: 'text', text: constant('Seconda pagina') }
  ] };
  render(<RenderView input={view} context={{ stats: [], values: {} }} />);
  expect(screen.getByRole('tab', { name: 'Uno' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Contenuto interno')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Due' }));
  expect(screen.getByText('Seconda pagina')).toBeInTheDocument();
  expect(screen.queryByText('Contenuto interno')).toBeNull();
});

it('steps a ticker inside its bounds and rejects out-of-range direct edits', () => {
  const stats = [base('hp', 'integer', 5)];
  const onChange = vi.fn();
  const ticker = { id: 'hp-ticker', type: 'ticker', stat: 'hp', change_amount: 1, min_value_allowed: 0,
    max_value_allowed: 6, button_location: 'left', should_auto_save: true, label: constant('/ 6') };
  const { unmount } = render(<RenderView input={ticker} context={{ stats, values: { hp: 5 }, onChange }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aumenta hp' }));
  expect(onChange).toHaveBeenCalledWith('hp', 6);
  fireEvent.click(screen.getByRole('button', { name: 'Modifica hp' }));
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '99' } });
  fireEvent.blur(input);
  expect(screen.getByRole('alert')).toHaveTextContent('Inserisci un numero valido');
  expect(onChange).toHaveBeenCalledTimes(1);
  unmount();
  const clamped = vi.fn();
  render(<RenderView input={ticker} context={{ stats, values: { hp: 6 }, onChange: clamped }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aumenta hp' }));
  expect(clamped).not.toHaveBeenCalled();
});

it('shows a ticker only in edit mode when its visibility asks for $edit_mode', () => {
  const view = { id: 'hp-view', type: 'ticker', stat: 'hp', is_visible: stat('$edit_mode') };
  const stats = [base('hp', 'integer', 4)];
  const { container, unmount } = render(<RenderView input={view} context={{ stats, values: { hp: 4 }, onChange: vi.fn() }} />);
  expect(container).toBeEmptyDOMElement();
  unmount();
  render(<RenderView input={view} context={{ stats, values: { hp: 4 }, onChange: vi.fn(), drafts: {} }} />);
  expect(screen.getByRole('button', { name: 'Modifica hp' })).toBeInTheDocument();
});

it('renders enumeration select options and enforces the maximum selection', () => {
  const stats = [base('mode', 'string', ''), base('modes', 'array', [], 'string')];
  const onChange = vi.fn();
  const single = { id: 'mode-select', type: 'select', stat: 'mode', options: 'modes' };
  const { unmount } = render(<RenderView input={single} context={{ stats, values: { mode: '' }, onChange, enumerations }} />);
  fireEvent.change(screen.getByLabelText('mode'), { target: { value: 'safe' } });
  expect(onChange).toHaveBeenCalledWith('mode', 'safe');
  unmount();
  const multi = vi.fn();
  const { unmount: unmountList } = render(<RenderView input={{ ...single, id: 'modes-select', stat: 'modes', multi_select: true, style: 'list', max_selection_amount: constant(2) }}
    context={{ stats, values: { modes: [] }, onChange: multi, enumerations }} />);
  fireEvent.click(screen.getByLabelText('Rapida'));
  expect(multi).toHaveBeenCalledWith('modes', ['fast']);
  fireEvent.click(screen.getByLabelText('Sicura'));
  expect(multi).toHaveBeenCalledWith('modes', ['safe']);
  unmountList();
  render(<RenderView input={{ ...single, id: 'modes-limit', stat: 'modes', multi_select: true, style: 'list', max_selection_amount: constant(0) }}
    context={{ stats, values: { modes: [] }, onChange: vi.fn(), enumerations }} />);
  fireEvent.click(screen.getByLabelText('Rapida'));
  expect(screen.getByRole('alert')).toHaveTextContent('Hai raggiunto il numero massimo');
});

it('keeps source button and menu events visible instead of executing them', () => {
  const { container } = render(<RenderView input={{ id: 'roll-button', type: 'button', text: constant('Tira'), event: { name: 'roll' } }}
    context={{ stats: [], values: {} }} />);
  expect(screen.getByRole('button', { name: 'Tira' })).toBeDisabled();
  expect(container).toHaveTextContent('Azione non ancora disponibile in PolySheet');
  const { container: menu } = render(<RenderView input={{ id: 'mode-menu', type: 'menuButton', options: 'modes', allowed_options: list(constant('fast')) }}
    context={{ stats: [], values: {}, enumerations }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Menu della sorgente' }));
  expect(screen.getByRole('menuitem', { name: 'Rapida' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Sicura' })).toBeNull();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rapida' }));
  expect(menu).toHaveTextContent('Azione non ancora disponibile in PolySheet');
});

it('uses upstream scalar identity for source resource options and reopens the selected choice', () => {
  const onChange = vi.fn();
  const definition: ResourceDefinition = { id: 'race', name: 'Race', stats: [base('name', 'string', '')] };
  const record: ResourceInstance = { id: 'private-child', sourceId: 'upstream-child', systemKey: 'sys',
    definitionId: 'race', name: 'Riva', values: { name: 'Riva' } };
  render(<RenderView input={{ id: 'subrace', type: 'select', stat: 'subrace_id',
    resource_options: list(constant({ resourceId: record.id }, 'resource')), options_display_stat: 'name' }}
    context={{ stats: [base('subrace_id', 'string', null)], values: { subrace_id: 'upstream-child' },
      systemKey: 'sys', resources: [record], resourceDefinitions: [definition], onChange }} />);
  expect(screen.getByRole('combobox', { name: 'subrace_id' })).toHaveValue('private-child');
  fireEvent.change(screen.getByRole('combobox', { name: 'subrace_id' }), { target: { value: '' } });
  expect(onChange).toHaveBeenLastCalledWith('subrace_id', null);
  fireEvent.change(screen.getByRole('combobox', { name: 'subrace_id' }), { target: { value: 'private-child' } });
  expect(onChange).toHaveBeenLastCalledWith('subrace_id', 'upstream-child');
});

it('lists referenced resource instances without offering creation in display mode', () => {
  const definition = {
    id: 'note', name: 'Nota', stats: [base('title', 'string', '')],
    display_view: { id: 'note-display', type: 'text', text: stat('title') }
  } as ResourceDefinition;
  const record = { id: 'note-1', systemKey: 'sys', definitionId: 'note', name: 'Nota uno',
    values: { title: 'Prima nota' }, createdAt: new Date().toISOString() } as ResourceInstance;
  const view = { id: 'notes-array', type: 'resourceArray', resource_id: 'note', stat: 'notes', view_type: 'display' };
  render(<RenderView input={view} context={{
    stats: [base('notes', 'array', [], 'resource')], values: { notes: [{ resourceId: 'note-1' }] },
    systemKey: 'sys', resources: [record], resourceDefinitions: [definition]
  }} />);
  expect(screen.getByText('Prima nota')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Aggiungi risorsa' })).toBeNull();
});

it('fills a single-choice select that has exactly one option only inside a draft form', () => {
  const stats = [{ id: 'armor', name: 'Armatura', type: 'base', value_type: 'string', default_value: null }];
  const node = { id: 'armor-select', type: 'select', stat: 'armor', options: 'armors' };
  const enumerations = [{ id: 'armors', name: 'Armature', types: [{ id: 'heavy', name: 'Pesante' }] }];
  const onInput = vi.fn(), onChange = vi.fn();
  const { unmount } = render(<RenderView input={node} context={{ stats, values: {}, drafts: {}, onInput, onChange, enumerations }} />);
  expect(onInput).toHaveBeenCalledWith('armor-select', 'armor', 'heavy');
  unmount();
  render(<RenderView input={node} context={{ stats, values: {}, onChange, enumerations }} />);
  expect(onChange).not.toHaveBeenCalled();
});
