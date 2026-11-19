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
