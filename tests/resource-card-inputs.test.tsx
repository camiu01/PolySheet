/** @file Resource-card base input ownership and live popup snapshots. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { RenderView, type RenderContext } from '../src/ui/renderer';
import { resourceEventScope } from '../src/ui/view-support';
import { base } from './fixtures/capabilities';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it('routes card inputs to their resource, keeping catalogs and drafts read-only', () => {
  const onResourceChange = vi.fn();
  const context = { canResourceEvent: () => true, onResourceEvent: vi.fn(), onResourceChange };
  const record = { id: 'rope', definitionId: 'item' };
  resourceEventScope(context, record).onChange?.('edit_quantity', 3);
  expect(onResourceChange).toHaveBeenCalledWith('rope', 'edit_quantity', 3);
  expect(resourceEventScope({ ...context, drafts: {} }, record)).toEqual({});
  expect(resourceEventScope(context, { ...record, catalogSource: {} })).toEqual({});
});

it.each(['resourceSection', 'resourceArray'])('updates an open %s card after repeated persisted quantity and Amount changes', type => {
  const stats = [base('equipment', 'array', [], 'resource')];
  const definition = { id: 'item', name: 'Item', stats: [base('quantity', 'integer', 1), base('amount', 'integer', 1)],
    display_view: { id: 'body', type: 'list', subviews: [
      { id: 'quantity', type: 'ticker', stat: 'quantity' },
      { id: 'amount', type: 'text', edit_stat: 'amount' }
    ] } };
  const record = { id: 'rope', systemKey: 'sys', definitionId: 'item', name: 'Rope', values: { quantity: 1, amount: 1 } };
  const onResourceChange = vi.fn(), onChange = vi.fn();
  const context: RenderContext = {
    stats, values: { equipment: [{ resourceId: 'rope' }] }, resources: [record], resourceDefinitions: [definition],
    canResourceEvent: () => true, onResourceEvent: vi.fn(), onResourceChange, onChange
  };
  const view = { id: 'items', type, resource_id: 'item', resource_stat: 'equipment', stat: 'equipment',
    view_type: 'display', ...(type === 'resourceArray' ? { pop_up_type: 'bottomSheet' } : {}) };
  const { rerender } = render(<RenderView input={view} context={context} />);
  fireEvent.click(screen.getByRole('button', { name: type === 'resourceArray' ? 'Rope' : 'Dettagli · Rope' }));
  const amount = screen.getByRole('spinbutton', { name: 'amount' });
  fireEvent.change(amount, { target: { value: '3' } });
  fireEvent.blur(amount);
  expect(onResourceChange).toHaveBeenCalledWith('rope', 'amount', 3);
  expect(onChange).not.toHaveBeenCalled();
  for (const quantity of [2, 5, 2]) {
    rerender(<RenderView input={view} context={{ ...context, resources: [{ ...record, values: { quantity, amount: 3 } }] }} />);
    expect(screen.getByRole('button', { name: 'Modifica quantity' })).toHaveTextContent(String(quantity));
    expect(screen.getByRole('spinbutton', { name: 'amount' })).toHaveValue(3);
  }
});
