/** @file Unchanged 5e long and short rest popups from the avatar menu, with persisted HP and hit dice. */
import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character } from '../../src/domain/model';
import { it } from '../../src/ui/it';
import { chooseManualGame, openCatalogImport } from './helpers';

async function navigate(page: Page, name: string | RegExp) {
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sheetcore');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const characters = await new Promise<Character[]>((resolve, reject) => {
      const request = database.transaction('characters').objectStore('characters').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    database.close(); return characters[0];
  });
}
async function chooseRest(page: Page, name: string) {
  await page.locator('.source-avatar-section').getByRole('button', { name: 'Menu della sorgente', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

test('unchanged 5e long and short rests restore HP and spend hit dice from the sheet', async ({ page, context }, info) => {
  const file = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
  const folder = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/';
  const catalogs = ['class_fighter_fighter', 'race_human', 'background_soldier'].map(name => resolve(folder + name + '.rpg.json'));
  test.skip(!existsSync(file) || catalogs.some(f => !existsSync(f)), 'Local-only official 5e fixtures are absent');
  await page.goto('./'); await navigate(page, it.systems);
  await page.getByLabel(it.localFile).setInputFiles(file);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, it.resources); await openCatalogImport(page);
  await page.getByLabel(it.catalogFiles, { exact: true }).setInputFiles(catalogs);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, /^Personaggi \d+$/);
  await page.getByRole('button', { name: it.newCharacter, exact: true }).first().click();
  await chooseManualGame(page.getByRole('combobox', { name: it.chooseSystem, exact: true }));
  await page.getByLabel('Nome del personaggio', { exact: true }).fill('QA riposi');
  await page.getByRole('combobox', { name: it.setupClass, exact: true }).selectOption({ label: 'Fighter' });
  await page.locator('select[name="setup-race"]').selectOption({ label: 'Human' });
  await page.locator('select[name="setup-background"]').selectOption({ label: 'Soldier' });
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'QA riposi', exact: true })).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('Salvato sul dispositivo');
  const created = await stored(page);
  const maxHp = created.values.current_hp as number;
  expect(maxHp).toBeGreaterThan(3);

  const hp = page.getByRole('button', { name: 'Modifica Current HP', exact: true });
  for (let value = maxHp; value > 3; value--) await page.getByRole('button', { name: 'Diminuisci Current HP', exact: true }).click();
  await expect(hp).toHaveText('3');
  await expect(page.getByTestId('save-status')).toHaveText('Salvato sul dispositivo');

  await chooseRest(page, 'Long rest');
  const long = page.getByRole('dialog', { name: 'Long Rest', exact: true });
  await expect(long).toContainText('Does your DM approve?');
  await long.getByRole('button', { name: it.cancel, exact: true }).click();
  await expect(long).not.toBeVisible();
  expect((await stored(page)).values.current_hp).toBe(3);
  await chooseRest(page, 'Long rest');
  await long.getByRole('button', { name: 'REST', exact: true }).click();
  const applied = page.getByRole('dialog', { name: it.eventApplied, exact: true });
  await expect(applied).toContainText('well rested');
  await applied.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(hp).toHaveText(String(maxHp));
  const restedValues = (await stored(page)).values;
  expect(restedValues.current_hp).toBe(maxHp);
  // A new character starts without hit dice; the long rest grants max(level / 2, 1).
  const hitDice = restedValues.current_d10_hit_dice as number;
  expect(hitDice).toBeGreaterThanOrEqual(1);

  for (let value = maxHp; value > 1; value--) await page.getByRole('button', { name: 'Diminuisci Current HP', exact: true }).click();
  await expect(hp).toHaveText('1');
  await expect(page.getByTestId('save-status')).toHaveText('Salvato sul dispositivo');
  await chooseRest(page, 'Short rest');
  const short = page.getByRole('dialog', { name: 'Short Rest', exact: true });
  await expect(short).toContainText('Select how many Hit Dice you want to spend');
  const d10 = short.getByRole('spinbutton', { name: 'Modifica d10', exact: true });
  await d10.fill(String(hitDice + 1));
  await expect(d10).toHaveAttribute('aria-invalid', 'true');
  await short.getByRole('button', { name: 'REST', exact: true }).click();
  await expect(short).toBeVisible();
  expect((await stored(page)).values.current_d10_hit_dice).toBe(hitDice);
  await d10.fill('1');
  await expect(d10).toHaveAttribute('aria-invalid', 'false');
  if (info.project.name === 'mobile') await page.screenshot({ path: resolve('.reference/ui-review/mobile-short-rest.png') });
  await short.getByRole('button', { name: 'REST', exact: true }).click();
  const rolled = page.getByRole('dialog', { name: it.eventRollResults, exact: true });
  await expect(rolled).toContainText('hit dice rolls');
  const total = Number(await rolled.getByLabel(`${it.eventTotal} hit dice rolls`, { exact: true }).textContent());
  expect(total).toBeGreaterThanOrEqual(1);
  expect(total).toBeLessThanOrEqual(10);
  await rolled.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(hp).toHaveText(String(Math.min(maxHp, 1 + total)));
  const after = await stored(page);
  expect(after.values.current_hp).toBe(Math.min(maxHp, 1 + total));
  expect(after.values.current_d10_hit_dice).toBe(hitDice - 1);
  expect(after.values.temp_short_rest_hit_dice_d10 ?? 0).toBe(0);

  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /QA riposi/ }).click();
  await expect(hp).toHaveText(String(Math.min(maxHp, 1 + total)));
});
