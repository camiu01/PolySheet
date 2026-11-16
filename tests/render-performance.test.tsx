/** @file Bounded resource lookup/rendering without weakening snapshot or selection semantics. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { createEvaluator } from '../src/engine/formulas';
import { SourceResourceSelect } from '../src/ui/SourceViews';
import { BaseValueEditor } from '../src/ui/BaseValueEditor';
import { SheetSections } from '../src/ui/SheetSections';
import type { ResourceInstance } from '../src/domain/model';
import { base } from './fixtures/capabilities';
import { constant, stat } from './fixtures/capabilities';

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it('defers resource indexing until needed and retains membership of the evaluation snapshot', () => {
  let reads = 0;
  const record: ResourceInstance = { get id() { reads++; return 'first'; }, systemKey: 'sys',
    definitionId: 'monster', name: 'First', values: { hp: 7 } };
  const resources = [record];
  const stats = [base('hp', 'integer', 1), { ...base('monster', 'resource', null), resource_type: 'monster' }];
  const environment = { resources, resourceDefinitions: [{ id: 'monster', name: 'Monster', stats: [base('hp', 'integer', 0)] }] };
  const evaluator = createEvaluator(stats, { monster: { resourceId: 'first' } }, undefined, environment);
  expect(evaluator.get('hp')).toBe(1);
  expect(reads).toBe(0);
  resources.splice(0, 1, { ...record, id: 'second', values: { hp: 9 } });
  expect(evaluator.get('monster.hp')).toBe(7);
  const indexedReads = reads;
  expect(evaluator.get('monster.hp')).toBe(7);
  expect(reads).toBe(indexedReads);
  expect(() => createEvaluator(stats, { monster: { resourceId: 'first' } }, undefined, environment).get('monster.hp')).toThrow('mancante');
});

it('renders only one resource page, searches every matching instance and preserves selection semantics', async () => {
  const records: ResourceInstance[] = Array.from({ length: 10000 }, (_, i) => ({
    id: `monster-${i}`, systemKey: 'sys', definitionId: 'monster', name: `Monster ${String(i).padStart(5, '0')}`, values: {}
  }));
  const onCommit = vi.fn().mockResolvedValue(undefined);
  const definition = { id: 'monster', name: 'Monster', core: true, stats: [] };
  render(<SourceResourceSelect node={{ id: 'pick', type: 'selectResources', resource_id: 'monster', stat: 'monsters', should_append: true, preserve_ids: true }}
    context={{ stats: [{ ...base('monsters', 'array', [], 'resource'), resource_type: 'monster' }], values: {}, drafts: {},
      systemKey: 'sys', resources: [...records, { ...records[0], id: 'foreign', systemKey: 'other', name: 'Foreign' },
        { ...records[0], id: 'wrong-type', definitionId: 'note', name: 'Wrong type' }],
      resourceDefinitions: [definition], onCommit }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi risorsa · Monster' }));
  expect(screen.getAllByRole('button', { name: /^Monster \d/ })).toHaveLength(50);
  fireEvent.click(screen.getByRole('button', { name: 'Pagina successiva' }));
  expect(screen.getByRole('button', { name: 'Monster 00050' })).toBeInTheDocument();
  expect(screen.getByRole('searchbox')).toHaveFocus();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Cerca risorsa locale' }), { target: { value: '09999' } });
  expect(screen.getAllByRole('button', { name: /^Monster \d/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Monster 09999' }));
  const [patch, additions] = onCommit.mock.calls[0];
  expect(patch({ monsters: [{ resourceId: 'previous' }] })).toEqual({ monsters: [{ resourceId: 'previous' }, { resourceId: 'monster-9999' }] });
  expect(additions).toEqual([]);
});

it('mounts manual fields on demand, searches by source ID and keeps their typed save callback', () => {
  const onSave = vi.fn();
  const { container } = render(<BaseValueEditor stats={[base('current_hp', 'integer', 1), base('name', 'string', '')]}
    values={{ current_hp: 4, name: 'Mira' }} resources={[]} onSave={onSave} />);
  expect(screen.queryByRole('spinbutton')).toBeNull();
  const details = container.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'CURRENT_HP' } });
  expect(screen.queryByRole('textbox', { name: 'name' })).toBeNull();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'current_hp' }), { target: { value: '5' } });
  fireEvent.blur(screen.getByRole('spinbutton', { name: 'current_hp' }));
  expect(onSave).toHaveBeenCalledWith('current_hp', 5);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not present' } });
  expect(screen.getByRole('status')).toHaveTextContent('Nessun campo corrisponde');
});

it('links to actual source titles without changing their order or exposing invisible content', () => {
  const sections = [
    { id: 'first', view: { id: 'one', type: 'section', header: [{ id: 'title-one', type: 'text', style: 'title', text: constant('Combattimento') }], content: [] } },
    { id: 'second', view: { id: 'two', type: 'section', header: [{ id: 'title-two', type: 'text', style: 'title', text: constant('Appunti') }], content: [] } },
    { id: 'hidden', view: { id: 'three', type: 'section', is_visible: stat('visible'), header: [{ id: 'title-three', type: 'text', style: 'title', text: constant('Hidden') }], content: [] } }
  ];
  render(<SheetSections sections={sections} context={{ stats: [base('visible', 'bool', false)], values: {} }} />);
  expect(screen.getAllByRole('link').slice(0, 2).map(link => link.textContent)).toEqual(['Combattimento', 'Appunti']);
  expect(screen.getByRole('link', { name: 'Combattimento' })).toHaveAttribute('href', '#sheet-section-0');
  expect(screen.queryByText('Hidden')).toBeNull();
});
