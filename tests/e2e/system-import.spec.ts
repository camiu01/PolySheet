/** @file Source selection and review remain understandable and non-destructive on desktop and mobile. */
import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { demo, demoOriginal } from '../../src/demo';
import { catalogSystem, classOriginal } from '../fixtures/catalog';
import { it } from '../../src/ui/it';

test('system import separates sources, opens the real file picker and cancels before writing', async ({ page }, info) => {
  await page.goto('./');
  await page.locator('main').getByRole('button', { name: it.importSystem, exact: true }).click();
  const main = page.locator('main');
  await expect(main.locator('.page-heading button')).toHaveCount(0);
  await expect(main.getByRole('heading', { name: it.importFileTitle })).toBeVisible();
  await expect(main.getByRole('heading', { name: it.importLinkTitle })).toBeVisible();
  await expect(main.getByText(it.importBeforeConfirm)).toBeVisible();
  await expect(main.locator('.import-format-help').filter({ hasText: it.importFormatsTitle })).not.toHaveAttribute('open');
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-import-options-dark.png`), fullPage: true });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-import-options-light.png`), fullPage: true });
  await page.evaluate(() => { delete document.documentElement.dataset.theme; });
  const picker = page.waitForEvent('filechooser');
  await main.locator('button').filter({ hasText: it.localFile }).click();
  await (await picker).setFiles({ name: 'system.json', mimeType: 'application/json', buffer: Buffer.from(demoOriginal) });
  const preview = page.getByRole('dialog', { name: it.importPreview });
  await expect(preview).toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await preview.getByRole('button', { name: it.cancel, exact: true }).click();
  await expect(preview).not.toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(0);
});

test('folder import selects one system and reviews its own catalogs before writing', async ({ page }) => {
  const root = mkdtempSync(join(tmpdir(), 'polysheet-folder-'));
  try {
    const folder = join(root, 'export');
    mkdirSync(join(folder, 'catalogs', 'class'), { recursive: true });
    writeFileSync(join(folder, 'first.system.json'), JSON.stringify({ ...catalogSystem, id: 'folder-a', name: 'Cartella A' }));
    writeFileSync(join(folder, 'second.system.json'), JSON.stringify({ ...catalogSystem, id: 'folder-b', name: 'Cartella B' }));
    writeFileSync(join(folder, 'catalogs', 'class', 'viandante.json'), classOriginal.replace('catalog-original', 'folder-b'));
    writeFileSync(join(folder, 'catalogs', 'manifest.json'), JSON.stringify({ total: 1 }));
    writeFileSync(join(folder, 'README.md'), 'not imported');
    await page.goto('./');
    await page.locator('main').getByRole('button', { name: it.importSystem, exact: true }).click();
    const picker = page.waitForEvent('filechooser');
    await page.locator('main .import-source-row button').filter({ hasText: it.localFolder }).click();
    await (await picker).setFiles(folder);
    const choose = page.getByRole('dialog', { name: it.folderPreviewTitle });
    await expect(choose).toBeVisible();
    await choose.getByRole('combobox', { name: it.folderSelect }).selectOption('export/second.system.json');
    await expect(choose.getByText(`1 ${it.folderCatalogs}`)).toBeVisible();
    await choose.getByRole('button', { name: it.folderLoad }).click();
    const preview = page.getByRole('dialog', { name: it.importPreview });
    await expect(preview.getByRole('heading', { name: /Cartella B/ })).toBeVisible();
    await expect(preview.getByText(`${it.repositoryCatalogs}: 1`)).toBeVisible();
    await preview.getByRole('button', { name: it.confirmImport }).click();
    await expect(preview).not.toBeVisible();
    await expect(page.locator('.system-card')).toHaveCount(1);
    await expect(page.locator('.system-card')).toContainText('Cartella B');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('link options and compatibility review disclose details without hiding blocking errors', async ({ page }, info) => {
  await page.goto('./');
  await page.locator('main').getByRole('button', { name: it.importSystem, exact: true }).click();
  await page.getByRole('button', { name: it.importUrl, exact: true }).click();
  const link = page.getByRole('dialog', { name: it.importUrl });
  await link.getByRole('textbox', { name: it.url, exact: true }).fill('https://files.example/system.rpg');
  await expect(link.getByText(it.importAdvanced)).toHaveCount(0);
  await link.getByRole('textbox', { name: it.url, exact: true }).fill('https://github.com/owner/repository');
  await link.getByText(it.importAdvanced, { exact: true }).click();
  await link.getByRole('textbox', { name: it.repositoryRef, exact: true }).fill('release/test');
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-import-link.png`), fullPage: true });
  await link.getByRole('button', { name: it.cancel, exact: true }).click();
  const invalid = { ...demo, character_stats: [...demo.character_stats, {
    id: 'bad_default', name: 'Invalid default', type: 'base', value_type: 'integer', default_value: 'not a number'
  }] };
  await page.getByLabel(it.localFile).setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid))
  });
  const preview = page.getByRole('dialog', { name: it.importPreview });
  await expect(preview.getByRole('alert')).toHaveText(it.blockingErrors);
  await expect(preview.getByRole('button', { name: it.confirmImport })).toBeDisabled();
  await expect(preview.locator('.import-diagnostic-group[open]')).toContainText('Valore non conforme al tipo');
  await expect(preview.locator('.import-source-details')).not.toHaveAttribute('open');
  const footer = (await preview.locator('.modal-actions').boundingBox())!;
  const fields = (await preview.locator('.system-import-dialog-fields').boundingBox())!;
  expect(fields.y + fields.height).toBeLessThanOrEqual(footer.y + 1);
  expect(footer.y + footer.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await preview.getByRole('button', { name: it.cancel, exact: true }).click({ trial: true });
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-import-blocking-error.png`), fullPage: true });
  await preview.getByRole('button', { name: it.cancel, exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(0);
});
