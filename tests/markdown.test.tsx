/** @file Source markdown text renders lists, tables and emphasis as elements, never as HTML. */
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Markdown } from '../src/ui/Markdown';

it('renders official description constructs and keeps markup-like text literal', () => {
  const { container } = render(<Markdown text={[
    'Intro with **bold** and *italic* <img src=x onerror=alert(1)>',
    '',
    '- first',
    '- second',
    '',
    '| Spell Level | Spells |',
    '| --- | --- |',
    '| 1st | sleep |'
  ].join('\n')} />);
  expect(screen.getByText('bold').tagName).toBe('STRONG');
  expect(screen.getByText('italic').tagName).toBe('EM');
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['first', 'second']);
  expect(screen.getByRole('columnheader', { name: 'Spell Level' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'sleep' })).toBeInTheDocument();
});
