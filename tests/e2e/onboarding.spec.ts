/** @file First-run game identity, explicit demo choice, browser history and visible saving. */
import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { it } from '../../src/ui/it';

test('a novice can identify the game, cancel the demo, create deliberately, edit and return with browser Back', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: it.newCharacter, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: it.systems, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A quale GDR stai giocando?', exact: true })).toBeVisible();
  for (const name of [it.game2014, it.game2024])
    await expect(page.getByRole('button', { name: `${it.gamePrepare} · ${name}`, exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Sistema di prova', exact: true })).toBeVisible();
  await expect(page.getByText(it.demoDescription, { exact: true })).toBeVisible();
  await expect(page.getByText(/regola nascosta|regole nascoste/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: `${it.pathfinderUpload} · Pathfinder 2e`, exact: true })).toBeEnabled();
  await page.getByText(`${it.gameUnavailable}: Daggerheart`, { exact: true }).click();
  await expect(page.getByText(it.daggerheartUnavailable, { exact: false })).toBeVisible();
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-game-choices.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: it.demoAction, exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByText(it.demoDescription, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: it.cancel, exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.getByRole('button', { name: it.demoAction, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.locator('.system-card').getByText(it.demoBadge)).toBeVisible();
  await page.getByRole('button', { name: it.useGame, exact: true }).click();
  await page.getByRole('button', { name: it.newCharacter, exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: it.chooseSystem, exact: true })).toHaveValue('');
  await expect(dialog.getByRole('button', { name: it.create, exact: true })).toHaveCount(0);
  await dialog.getByRole('combobox', { name: it.chooseSystem, exact: true }).selectOption({ index: 1 });
  await expect(dialog.getByText(it.demoDescription, { exact: true })).toBeVisible();
  await dialog.getByLabel(it.name, { exact: true }).fill('Personaggio di prova');
  await dialog.getByRole('button', { name: it.create, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personaggio di prova', exact: true })).toBeVisible();
  await expect(page.getByTestId('save-status')).toBeVisible();
  await page.getByRole('button', { name: it.characterSetup, exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Modifica personaggio', exact: true });
  await expect(dialog.getByText(it.editSetupHelp, { exact: true })).toBeVisible();
  await expect(dialog.getByText(it.manual, { exact: true })).toHaveCount(0);
  await dialog.getByRole('spinbutton', { name: 'Vigore', exact: true }).fill('7');
  await dialog.getByRole('button', { name: it.cancel, exact: true }).click();
  await expect(page.getByTestId('stat-slancio')).toHaveText('3');
  await page.getByRole('button', { name: it.characterSetup, exact: true }).click();
  await page.getByRole('dialog').getByRole('spinbutton', { name: 'Vigore', exact: true }).fill('7');
  await page.getByRole('dialog').getByRole('button', { name: it.save, exact: true }).click();
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
  await expect(page.getByTestId('save-status')).toHaveText(it.saved);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-demo-sheet-save.png`), fullPage: true });
  await page.goBack();
  await expect(page.getByRole('heading', { name: it.allCharacters, exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Personaggio di prova', exact: true })).toBeVisible();
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
  await page.goBack(); await page.goBack();
  await expect(page.getByRole('heading', { name: it.systems, exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: it.allCharacters, exact: true })).toBeVisible();
  await page.reload();
  await page.locator('.character-card').click();
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
});

test('failed game preparation offers recovery and never installs an incomplete game', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.abort('failed'));
  await page.goto('./');
  await page.getByRole('button', { name: it.newCharacter, exact: true }).first().click();
  const choose = page.getByRole('button', { name: `${it.gamePrepare} · ${it.game2024}`, exact: true });
  await choose.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText(it.error);
  await expect(choose).toBeEnabled();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.getByRole('button', { name: it.demoAction, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText(it.saved);
  await page.getByRole('dialog').getByRole('button', { name: it.cancel, exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(0);
});

test('game choices and save feedback fit a narrow phone viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('./');
  await page.getByRole('button', { name: it.newCharacter, exact: true }).first().click();
  await expect(page.getByTestId('save-status')).toBeVisible();
  const status = (await page.getByTestId('save-status').boundingBox())!;
  expect(status.x).toBeGreaterThanOrEqual(0); expect(status.x + status.width).toBeLessThanOrEqual(320);
  for (const button of await page.locator('main .import-source-row button').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-game-choices-320.png`), fullPage: true });
});
