/** @file Resource archive search, filters and bounded pages. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Resources } from '../src/ui/Tools';
import { installSystem, db } from '../src/persistence/db';
import { prepareSystem } from '../src/importing/system';
import { demo } from '../src/demo';
import type { ResourceInstance } from '../src/domain/model';

it('searches accent-insensitively, filters by origin and mounts at most 50 cards', async () => {
  const system = await prepareSystem(JSON.stringify(demo), 'demo');
  await installSystem(system);
  const definitionId = demo.resources[0].id;
  const records: ResourceInstance[] = Array.from({ length: 60 }, (_, index) => ({
    id: `r${index}`, systemKey: system.key, definitionId, name: index === 7 ? 'Pozione città' : `Nota ${index}`, values: {}
  }));
  records[59] = { ...records[59], name: 'Catalogo', catalogGroup: 'r59', catalogSource: { original: '{}', source: 'x', digest: 'a'.repeat(64) } };
  await db.resources.bulkAdd(records);
  render(<Resources systems={[system]} system={system} characters={[]} run={async task => { await task(); }} />);
  expect(await screen.findByText('60 risorse')).toBeTruthy();
  expect(document.querySelectorAll('article.resource-card')).toHaveLength(50);
  fireEvent.click(screen.getByRole('button', { name: 'Pagina successiva' }));
  expect(document.querySelectorAll('article.resource-card')).toHaveLength(10);
  fireEvent.change(screen.getByLabelText('Cerca per nome'), { target: { value: 'citta' } });
  expect(screen.getByText('1 di 60 risorse')).toBeTruthy();
  expect(within(document.querySelector('.resource-grid')!).getByText('Pozione città')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Azzera filtri' }));
  fireEvent.change(screen.getByLabelText('Origine'), { target: { value: 'catalog' } });
  expect(screen.getByText('1 di 60 risorse')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Cerca per nome'), { target: { value: 'nessuno' } });
  expect(screen.getByText('Nessuna risorsa corrisponde ai filtri.')).toBeTruthy();
});

it('offers the source sort options once a type is chosen and groups cards under enumeration headers', async () => {
  // Original shape: 5e spell `{ name: 'by level', stat: 'level', options: 'spell_level' }`.
  const source = structuredClone(demo) as unknown as Omit<typeof demo, 'enumerated_types'> & { enumerated_types: unknown[] };
  source.enumerated_types = [{ id: 'tono', types: [{ id: 'lieto', name: 'Lieto' }, { id: 'cupo', name: 'Cupo' }] }];
  const resource = source.resources[0] as typeof source.resources[0] & { sort_options?: unknown[] };
  resource.stats = [...resource.stats, { id: 'tono', name: 'Tono', type: 'base', value_type: 'string', default_value: '' }];
  resource.sort_options = [{ name: 'per tono', stat: 'tono', options: 'tono' }];
  const system = await prepareSystem(JSON.stringify(source), 'sorted demo');
  expect(system.diagnostics.filter(d => d.path.includes('sort_options'))).toEqual([]);
  await installSystem(system);
  await db.resources.bulkAdd([['s1', 'Alba', 'cupo'], ['s2', 'Brezza', 'lieto'], ['s3', 'Cenere', 'cupo']].map(([id, name, tono]) =>
    ({ id, systemKey: system.key, definitionId: 'ricordo', name, values: { titolo: name, testo: '', tono } }) as ResourceInstance));
  render(<Resources systems={[system]} system={system} characters={[]} run={async task => { await task(); }} />);
  await screen.findByText('3 risorse');
  expect(screen.queryByLabelText('Ordina per')).toBeNull();
  fireEvent.change(screen.getByLabelText('Tipo di risorsa'), { target: { value: 'ricordo' } });
  fireEvent.change(screen.getByLabelText('Ordina per'), { target: { value: '0' } });
  const grid = document.querySelector('.resource-grid')!;
  expect([...grid.querySelectorAll('h3.resource-group, article.resource-card h2')].map(node => node.textContent))
    .toEqual(['Lieto', 'Brezza', 'Cupo', 'Alba', 'Cenere']);
});
