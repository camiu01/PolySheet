/** @file File-free source imports use the real controls, preserving originals and offline backups. */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { catalogSystem, classOriginal } from '../fixtures/catalog';
import { it } from '../../src/ui/it';

const repository = 'https://github.com/blastervla/rpg-companion-app-systems';
const commit = '8788e3b18099e4a1b3510f02869d97f1488586b4';
async function navigate(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator('.sidebar').getByRole('button', { name: label, exact: true }).click();
}
async function routes(page: Page, files: Map<string, string>) {
  const headers = { 'access-control-allow-origin': '*' }, treeSha = 'b'.repeat(40);
  await page.route('https://api.github.com/repos/blastervla/rpg-companion-app-systems/**', route => route.fulfill({ headers,
    json: route.request().url().includes('/commits?') ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
      : { sha: treeSha, truncated: false, tree: [...files].map(([path, text]) => ({
        path, size: Buffer.byteLength(text), type: 'blob', mode: '100644'
      })) }
  }));
  await page.route('https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/**', route => {
    expect(route.request().url()).toContain('/' + commit + '/');
    const path = decodeURIComponent(route.request().url().split('/' + commit + '/')[1]), body = files.get(path);
    return route.fulfill({ headers, status: body === undefined ? 404 : 200, body: body ?? 'Unexpected path' });
  });
}
async function choose(page: Page, id = '5e') {
  await page.getByRole('button', { name: it.importUrl, exact: true }).click();
  const input = page.getByRole('textbox', { name: it.url, exact: true });
  await input.fill('');
  await input.pressSequentially(repository);
  await page.getByRole('button', { name: it.fetch, exact: true }).click();
  await page.getByRole('combobox', { name: it.repositorySystem, exact: true }).selectOption(id);
  await expect(page.getByRole('button', { name: it.repositoryChooseSystem, exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: it.repositoryLoadBundle, exact: true })).toBeEnabled();
  await page.getByRole('button', { name: it.repositoryLoadBundle, exact: true }).click();
}

test('repository JSON and RPGScript import without a picker, cancel safely and survive offline export and restore', async ({ page, context }) => {
  const root = 'systems/5e/system/system.rpg.json', script = 'systems/5e/system/character_stats.rpgs';
  const files = new Map([
    [root, '\ufeff' + JSON.stringify({ ...catalogSystem, id: '5e' }, null, 2)],
    [script, 'import "../../_stdlib/math.rpgs";\r\ncalc integer source_total(name="Total") = twice(value=3);\r\n'],
    ['systems/_stdlib/math.rpgs', 'define twice(value) = value * 2;'],
    ['systems/5e/resource_instances/class_one.rpg.json', classOriginal.replace('catalog-original', '5e')]
  ]);
  await routes(page, files);
  await page.goto('./');
  await navigate(page, it.systems);
  let pickers = 0; page.on('filechooser', () => { pickers++; });
  await choose(page);
  const preview = page.getByRole('dialog', { name: it.importPreview, exact: true });
  await expect(preview).toContainText(it.repositorySourceNotice);
  await expect(page.locator('.system-card')).toHaveCount(0);
  await preview.getByRole('button', { name: it.cancel, exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await choose(page);
  await preview.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(preview).not.toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(1);
  expect(pickers).toBe(0);
  const sourceDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: it.repositoryExportSources, exact: true }).click();
  const exported = JSON.parse(readFileSync((await (await sourceDownload).path())!, 'utf8'));
  expect(exported.polysheet_source.files).toHaveLength(3);
  for (const source of exported.polysheet_source.files) expect(source.original).toBe(files.get(source.path));
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true); await page.reload();
  await navigate(page, it.systems);
  await expect(page.locator('.system-card')).toHaveCount(1);
  await navigate(page, it.settings);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
  const backup = readFileSync((await (await downloading).path())!, 'utf8');
  expect(JSON.parse(JSON.parse(backup).systems[0].original).polysheet_source).toEqual(exported.polysheet_source);
  await page.locator('input[type=file]').setInputFiles({ name: 'source-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

const reference = resolve('.reference/rpg-companion-app-systems');
function collect(directory: string, files: Map<string, string>) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collect(path, files);
    else if (/\.(?:rpgs|json)$/.test(entry.name)) files.set(relative(reference, path).replaceAll('\\', '/'), readFileSync(path, 'utf8'));
  }
}
for (const [id, expected, blocked, label] of [
  ['5e', 208, 0, it.game2014], ['5e2024', 74, 19, it.game2024]
] as const) test(`real ${id} source repository prepares every rule and catalog without a compiled upload`, async ({ page }, info) => {
  test.skip(!existsSync(reference), 'Pinned licensed external sources remain local-only');
  test.setTimeout(120000);
  const files = new Map<string, string>();
  collect(resolve(reference, `systems/${id}/system`), files);
  collect(resolve(reference, 'systems/_stdlib'), files);
  for (const name of readdirSync(resolve(reference, `systems/${id}/resource_instances`)).filter(name => /^(class|race|species|background)_.*\.rpg\.json$/.test(name))) {
    const path = `systems/${id}/resource_instances/${name}`;
    files.set(path, readFileSync(resolve(reference, path), 'utf8'));
  }
  await routes(page, files); await page.goto('./');
  await navigate(page, it.systems);
  await page.getByRole('button', { name: `${it.gamePrepare} · ${label}`, exact: true }).click();
  const preview = page.getByRole('dialog', { name: it.importPreview, exact: true });
  await expect(preview).toContainText(`Modelli di catalogo: ${expected} · Modelli non assegnabili: ${blocked}`, { timeout: 30000 });
  await expect(preview.getByRole('button', { name: it.confirmImport, exact: true })).toBeEnabled();
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-${id}-repository-source-preview.png`), fullPage: true });
  await preview.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(preview).not.toBeVisible({ timeout: 30000 });
  await expect(page.locator('.system-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: it.repositoryExportSources, exact: true })).toBeVisible();
});
