/** @file Official creation pages as one draft: navigation, validation, `$is_new` and atomic save. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { CharacterCreator } from '../src/ui/CharacterCreator';
import { db, installSystem } from '../src/persistence/db';
import { parseSystem, prepareSystem } from '../src/importing/system';
import { demo } from '../src/demo';
import { it as copy } from '../src/ui/it';
import { constant, stat } from './fixtures/capabilities';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(async () => { await db.open(); });
afterEach(async () => { await db.delete(); });

const flowSystem = {
  ...demo, id: 'creation-flow-original', name: 'Flusso originale',
  character_creation_flow: [
    { title: { id: 'basics', name: 'Basi' }, view: { id: 'basics_list', type: 'list', subviews: [
      { id: 'name_input', type: 'text', edit_stat: 'nome', label: constant('Nome'),
        validation_message: { type: 'when', clauses: [
          { condition: { type: 'isEmpty', components: stat('$view.name_input') }, components: constant('Serve un nome') },
          { condition: constant(true), components: { type: 'constant', value: null, value_type: 'string' } }] } }
    ] } },
    { title: { id: 'traits', name: 'Tratti' },
      on_page_open: { type: 'sequence', effects: [
        { type: 'setStat', stat: 'appunti', new_value: constant('aperta'), aggregation_type: 'set' },
        { type: 'showMessage', message: constant('Ciao') }] },
      post_edit: { type: 'when', clauses: [{ condition: stat('$is_new'),
        effect: { type: 'addToStat', stat: 'scorte', value: stat('vigore') } }] }, view: { id: 'traits_list', type: 'list', subviews: [
      { id: 'new_label', type: 'text', text: constant('Personaggio nuovo'), is_visible: stat('$is_new') },
      { id: 'vigore_input', type: 'stat', stat: 'vigore' }
    ] } }
  ]
};

async function renderFlow() {
  const system = await prepareSystem(JSON.stringify(flowSystem), 'Original MIT fixture');
  await installSystem(system);
  const onDone = vi.fn(), onClose = vi.fn();
  render(<CharacterCreator systems={[system]} character={undefined} onSystemChange={vi.fn()}
    run={async work => { await work(); }} onDone={onDone} onClose={onClose} />);
  fireEvent.change(screen.getByRole('combobox', { name: copy.chooseSystem }), { target: { value: system.key } });
  return { onDone, onClose };
}

it('accepts `$is_new` only inside creation pages and reports unexecuted page hooks', () => {
  const diagnostics = parseSystem(JSON.stringify(flowSystem)).diagnostics;
  expect(diagnostics.filter(d => d.message.includes('$is_new'))).toEqual([]);
  expect(diagnostics).toContainEqual(expect.objectContaining({ path: '$.character_creation_flow' }));
});

it('walks source pages in one draft and saves the character only on the last page', async () => {
  const { onDone } = await renderFlow();
  const current = () => document.querySelector('.creation-steps [aria-current="step"]')?.textContent;
  await waitFor(() => expect(current()).toBe('1Basi'));
  expect(screen.queryByText('Serve un nome')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: copy.next }));
  expect(await screen.findByText('Serve un nome')).toBeVisible();
  expect(screen.getByText(copy.completeHighlighted)).toBeVisible();
  expect(current()).toBe('1Basi');
  fireEvent.change(screen.getByRole('textbox', { name: /Nome/ }), { target: { value: 'Ilaria' } });
  fireEvent.blur(screen.getByRole('textbox', { name: /Nome/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: copy.next })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: copy.next }));
  await waitFor(() => expect(current()).toBe('2Tratti'));
  expect(screen.getByText('Personaggio nuovo')).toBeVisible();
  expect(screen.getByText(`${copy.creationHooksPending}: showMessage`)).toBeVisible();
  expect(await db.characters.count()).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: copy.back }));
  expect(await screen.findByRole('textbox', { name: /Nome/ })).toHaveValue('Ilaria');
  fireEvent.click(screen.getByRole('button', { name: copy.next }));
  fireEvent.change(await screen.findByRole('spinbutton', { name: 'Modifica Vigore' }), { target: { value: '4' } });
  fireEvent.blur(screen.getByRole('spinbutton', { name: 'Modifica Vigore' }));
  fireEvent.click(screen.getByRole('button', { name: copy.create }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  const [saved] = await db.characters.toArray();
  // on_page_open wrote `appunti`; post_edit added vigore (4) to the default scorte (6).
  expect(saved).toMatchObject({ name: 'Ilaria', values: { nome: 'Ilaria', vigore: 4, appunti: 'aperta', scorte: 10 } });
  expect(onDone).toHaveBeenCalledWith(saved.id);
});

it('cancels from the first page without writing and keeps manual setup reachable', async () => {
  const { onClose } = await renderFlow();
  fireEvent.click(await screen.findByRole('button', { name: copy.cancel }));
  expect(onClose).toHaveBeenCalled();
  expect(await db.characters.count()).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: copy.useManualSetup }));
  expect(screen.getByRole('button', { name: copy.create })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: copy.useCreationFlow })).toBeInTheDocument();
});

it('stages the auto-added first array instance with the draft and hides non-scalar derived values', async () => {
  const { SourceForm } = await import('../src/ui/SourceForm');
  const { base } = await import('./fixtures/capabilities');
  const detail = { id: 'detail', name: 'Dettaglio', stats: [base('label', 'string', 'Primo')],
    edit_view: { id: 'detail_edit', type: 'text', edit_stat: 'label' } };
  const stats = [base('details', 'array', [], 'resource'),
    { id: 'first_detail', name: 'Primo dettaglio', type: 'calculated', value_type: 'array', sub_value_type: 'resource',
      components: stat('$view.details_array') } as const];
  const onCommit = vi.fn(async () => {});
  render(<SourceForm onDone={vi.fn()} input={{ id: 'details_array', type: 'resourceArray', resource_id: 'detail', stat: 'details',
    view_type: 'edit', auto_add_first: true, pop_up_type: 'bottomSheet' }}
    context={{ stats, values: {}, systemKey: 'sys', resources: [], resourceDefinitions: [detail], onCommit }} />);
  await waitFor(() => expect(screen.getAllByText('Dettaglio').length).toBeGreaterThan(0));
  expect(screen.queryByText(copy.missingResource)).toBeNull();
  expect(document.querySelector('[data-view-error]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: copy.save }));
  await waitFor(() => expect(onCommit).toHaveBeenCalled());
  const [patch, additions] = onCommit.mock.calls[0] as unknown as [Record<string, unknown>, { id: string; definitionId: string }[]];
  expect(additions).toHaveLength(1);
  expect(additions[0].definitionId).toBe('detail');
  expect(patch.details).toEqual([{ resourceId: additions[0].id }]);
});

it('offers catalog roots in a draft select and stages a private copy until Save', async () => {
  const { SourceForm } = await import('../src/ui/SourceForm');
  const { installCatalogs } = await import('../src/persistence/catalog');
  const { prepareCatalogTemplate } = await import('../src/importing/catalog');
  const { catalogSystem, raceOriginal } = await import('./fixtures/catalog');
  const core = { ...catalogSystem, resources: catalogSystem.resources.map(r => r.id === 'race' ? { ...r, core: true } : r) };
  const system = await prepareSystem(JSON.stringify(core), 'Original MIT catalog test');
  await installSystem(system);
  const [templateId] = await installCatalogs([await prepareCatalogTemplate(raceOriginal, 'race.json', system)]);
  const template = (await db.resources.get(templateId))!;
  const onCommit = vi.fn(async () => {});
  render(<SourceForm onDone={vi.fn()} input={{ id: 'race_select', type: 'selectResources', stat: 'race', resource_id: 'race' }}
    context={{ stats: system.definition.character_stats, values: {}, systemKey: system.key, resources: [template],
      resourceDefinitions: system.definition.resources, onCommit }} />);
  fireEvent.click(screen.getByRole('button', { name: /Aggiungi risorsa · Origine/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Collina/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Aggiungi risorsa · Origine/ })).toHaveTextContent('Collina'));
  expect(await db.resources.count()).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: copy.save }));
  await waitFor(() => expect(onCommit).toHaveBeenCalled());
  const [patch, additions] = onCommit.mock.calls[0] as unknown as [Record<string, { resourceId: string }>, { id: string; catalogSource?: unknown }[]];
  expect(patch.race.resourceId).not.toBe(templateId);
  expect(additions.map(r => r.id)).toContain(patch.race.resourceId);
  expect(additions.every(r => r.catalogSource === undefined)).toBe(true);
});

it('edits a draft-only nested array item inline and re-stages one updated copy', async () => {
  const { SourceForm } = await import('../src/ui/SourceForm');
  const { base } = await import('./fixtures/capabilities');
  const detail = { id: 'detail', name: 'Dettaglio', stats: [base('label', 'string', '')],
    edit_view: { id: 'detail_edit', type: 'list', subviews: [
      { id: 'detail_label', type: 'text', edit_stat: 'label', label: constant('Etichetta') },
      { id: 'detail_echo', type: 'text', text: { type: 'stat', stat: '$view.detail_label' } }] } };
  const onCommit = vi.fn(async () => {});
  render(<SourceForm onDone={vi.fn()} input={{ id: 'details_array', type: 'resourceArray', resource_id: 'detail', stat: 'details',
    view_type: 'edit', auto_add_first: true }}
    context={{ stats: [base('details', 'array', [], 'resource')], values: {}, systemKey: 'sys', resources: [], resourceDefinitions: [detail], onCommit }} />);
  const input = await screen.findByRole('textbox', { name: /Etichetta/ });
  expect(screen.queryByText(copy.resourceEditOutsideForm)).toBeNull();
  fireEvent.change(input, { target: { value: 'Mago' } });
  fireEvent.blur(input);
  await waitFor(() => expect(screen.getAllByText('Mago').length).toBeGreaterThan(0));
  fireEvent.click(screen.getByRole('button', { name: copy.save }));
  await waitFor(() => expect(onCommit).toHaveBeenCalled());
  const [patch, additions] = onCommit.mock.calls[0] as unknown as [Record<string, { resourceId: string }[]>, { id: string; values: Record<string, unknown> }[]];
  expect(additions).toHaveLength(1);
  expect(additions[0].values.label).toBe('Mago');
  expect(patch.details).toEqual([{ resourceId: additions[0].id }]);
});

it('lists a calculated resource array through its formula instead of a stored value', async () => {
  const { RenderView } = await import('../src/ui/renderer');
  const { base } = await import('./fixtures/capabilities');
  const detail = { id: 'detail', name: 'Dettaglio', stats: [base('label', 'string', '')],
    display_view: { id: 'detail_show', type: 'text', text: stat('label') } };
  const stats = [base('owned', 'array', [{ resourceId: 'd1' }], 'resource'),
    { id: 'shown', name: 'Mostrati', type: 'calculated', value_type: 'array', sub_value_type: 'resource', components: stat('owned') } as const];
  render(<RenderView input={{ id: 'shown_array', type: 'resourceArray', resource_id: 'detail', stat: 'shown', view_type: 'display' }}
    context={{ stats, values: {}, systemKey: 'sys', resourceDefinitions: [detail],
      resources: [{ id: 'd1', systemKey: 'sys', definitionId: 'detail', name: 'D', values: { label: 'Arcana' } }] }} />);
  expect(screen.getByText('Arcana')).toBeVisible();
  expect(screen.queryByText(copy.noResourceValue)).toBeNull();
});

it('seeds auto_add_first even when manual add/remove is disabled (PF2e classes)', async () => {
  const { SourceForm } = await import('../src/ui/SourceForm');
  const { base } = await import('./fixtures/capabilities');
  const detail = { id: 'detail', name: 'Dettaglio', stats: [base('label', 'string', '')],
    edit_view: { id: 'detail_edit', type: 'text', edit_stat: 'label', label: constant('Etichetta') } };
  render(<SourceForm onDone={vi.fn()} input={{ id: 'details_array', type: 'resourceArray', resource_id: 'detail', stat: 'details',
    view_type: 'edit', auto_add_first: true, allow_adds_and_removes: false }}
    context={{ stats: [base('details', 'array', [], 'resource')], values: {}, systemKey: 'sys', resources: [], resourceDefinitions: [detail], onCommit: vi.fn(async () => {}) }} />);
  expect(await screen.findByRole('textbox', { name: /Etichetta/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: copy.addResource })).toBeNull();
  expect(screen.queryByText(copy.resourceListReadOnly)).toBeNull();
  expect(screen.queryByRole('button', { name: new RegExp(`${copy.detach}|${copy.removeEntry}`) })).toBeNull();
});

it('renders the switcher checkbox style as an accessible switch', async () => {
  const { RenderView } = await import('../src/ui/renderer');
  const { base } = await import('./fixtures/capabilities');
  const onChange = vi.fn();
  render(<RenderView input={{ id: 'toggle', type: 'checkbox', stat: 'on', style: 'switcher', label: constant('Archetipi') }}
    context={{ stats: [base('on', 'bool', false)], values: {}, onChange }} />);
  fireEvent.click(screen.getByRole('switch', { name: 'Archetipi' }));
  expect(onChange).toHaveBeenCalledWith('on', true);
});

it('preselects the only installed real game so creation starts immediately', async () => {
  const system = await prepareSystem(JSON.stringify(flowSystem), 'Original MIT fixture');
  await installSystem(system);
  render(<CharacterCreator systems={[system]} onSystemChange={vi.fn()} run={async work => { await work(); }} onDone={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByRole('combobox', { name: copy.chooseSystem })).toHaveValue(system.key);
  await waitFor(() => expect(document.querySelector('.creation-steps [aria-current="step"]')).not.toBeNull());
});

it('turns a page hook failing on an unanswered value into an actionable message', async () => {
  const pages = structuredClone(flowSystem.character_creation_flow) as Record<string, unknown>[];
  pages[0].on_page_close = { type: 'setStat', stat: 'appunti', new_value: stat('fantasma'), aggregation_type: 'set' };
  const system = await prepareSystem(JSON.stringify({ ...flowSystem, character_creation_flow: pages }), 'Original MIT fixture');
  await installSystem(system);
  render(<CharacterCreator systems={[system]} character={undefined} onSystemChange={vi.fn()}
    run={async work => { await work(); }} onDone={vi.fn()} onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: copy.chooseSystem }), { target: { value: system.key } });
  const name = await screen.findByLabelText('Nome');
  fireEvent.change(name, { target: { value: 'Mira' } });
  fireEvent.click(screen.getByRole('button', { name: copy.next }));
  expect(await screen.findByText(new RegExp(copy.creationChoicesIncomplete.slice(0, 30)))).toBeVisible();
  expect(screen.getByText(/fantasma/)).toBeVisible();
});
