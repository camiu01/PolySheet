/** @file Original selection UI regressions: draft-only changes, maximum, clearing and accessible names. */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ProgressionFeatures } from '../src/ui/ProgressionFeatures';
import { it as copy } from '../src/ui/it';

it('keeps selections local, enforces maximum and allows clearing or replacing them', () => {
  const changed = vi.fn();
  const features = [{ featureId: 'technique', name: 'Tecnica', maximum: 1, selected: [], target: 'wrapper',
    allIds: ['first', 'second'], options: [{ id: 'first', name: 'Prima tecnica' }, { id: 'second', name: 'Seconda tecnica' }] }];
  function Harness() {
    const [drafts, setDrafts] = useState<Record<string, string[]>>({});
    return <ProgressionFeatures features={features} drafts={drafts} onChange={(id, selected) => {
      changed(id, selected); setDrafts({ [id]: selected });
    }} />;
  }
  render(<Harness />);
  expect(screen.getByRole('group', { name: 'Tecnica' })).toBeVisible();
  fireEvent.click(screen.getByLabelText('Prima tecnica'));
  expect(changed).toHaveBeenLastCalledWith('technique', ['first']);
  expect(screen.getByText(copy.progressionSelectableCount(1, 1))).toBeVisible();
  expect(screen.getByLabelText('Seconda tecnica')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Prima tecnica'));
  expect(changed).toHaveBeenLastCalledWith('technique', []);
  fireEvent.click(screen.getByLabelText('Seconda tecnica'));
  expect(changed).toHaveBeenLastCalledWith('technique', ['second']);
  expect(features[0].selected).toEqual([]);
});

it('omits empty sections and retains a source selection without an implicit save', () => {
  const changed = vi.fn();
  const { rerender, container } = render(<ProgressionFeatures features={[]} drafts={{}} onChange={changed} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<ProgressionFeatures features={[{ featureId: 'known', name: 'Known', maximum: 1, target: 'wrapper',
    selected: ['one'], allIds: ['one'], options: [{ id: 'one', name: 'One' }] }]} drafts={{}} onChange={changed} />);
  expect(screen.getByLabelText('One')).toBeChecked();
  expect(changed).not.toHaveBeenCalled();
});
