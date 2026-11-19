/** @file Grouped sheet errors: one summary with counts, compact markers, no repeated live regions. */
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { RenderView } from '../src/ui/renderer';
import { ViewErrorGroup } from '../src/ui/ViewErrors';

const context = { stats: [], values: {} };
it('groups identical messages with counts and keeps every field marked', async () => {
  render(<ViewErrorGroup>
    {[1, 2, 3].map(i => <RenderView key={i} input={{ id: `a${i}`, type: 'stat', stat: 'missing' }} context={context} />)}
    <RenderView input={{ id: 'b', type: 'stat', stat: 'other' }} context={context} />
  </ViewErrorGroup>);
  expect(await screen.findByText('4 campi non calcolabili · 2 motivi. Mostra i dettagli')).toBeTruthy();
  expect(screen.getAllByText('Non calcolabile')).toHaveLength(4);
  expect(screen.getByText('×3')).toBeTruthy();
  expect(document.querySelectorAll('[data-view-error][role=status]')).toHaveLength(0);
});
it('keeps the standalone message outside a group', () => {
  render(<RenderView input={{ id: 'a', type: 'stat', stat: 'missing' }} context={context} />);
  expect(screen.getByRole('status').textContent).toContain('missing');
});
