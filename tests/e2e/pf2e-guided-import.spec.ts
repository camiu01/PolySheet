/** @file Guided PF2e uses the original compiled upload, pinned catalogs and explicit atomic confirmation. */
import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { it } from '../../src/ui/it';

test('PF2e prepares from the shared game action, validates the file and preserves cancel/offline originals', async ({ page, context }, info) => {
  const file = resolve('.reference/official-releases-2026-11-16/pf2e-system.rpg');
  const wrong = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
  const base = resolve('.reference/rpg-companion-app-systems');
  const paths = ['systems/pf2e/system/system.rpg.json',
    'systems/pf2e/resource_instances/class_fighter__pc1_.rpg.json',
    'systems/pf2e/resource_instances/ancestry_human__pc1_.rpg.json'];
  test.skip(!existsSync(file) || !existsSync(wrong) || paths.some(path => !existsSync(resolve(base, path))),
    'Local-only official PF2e source and compiled fixtures are absent');
  const files = new Map(paths.map(path => [path, readFileSync(resolve(base, path), 'utf8')]));
  const commit = '8788e3b18099e4a1b3510f02869d97f1488586b4', tree = '7'.repeat(40);
  const requests: string[] = [];
  let failCatalog = true;
  await page.route('https://api.github.com/repos/blastervla/rpg-companion-app-systems/**', route => route.fulfill({
    json: route.request().url().includes('/commits')
      ? [{ sha: commit, commit: { tree: { sha: tree } } }]
      : { sha: tree, truncated: false, tree: [...files].map(([path, body]) => ({
        path, size: Buffer.byteLength(body), type: 'blob', mode: '100644'
      })) }
  }));
  await page.route('https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/**', route => {
    const url = route.request().url();
    expect(url).toContain(`/${commit}/`);
    const path = decodeURIComponent(url.split(`/${commit}/`)[1]);
    requests.push(path);
    if (failCatalog && path.includes('/resource_instances/')) {
      failCatalog = false;
      return route.fulfill({ status: 503, body: 'Service unavailable' });
    }
    expect(files.has(path)).toBe(true);
    return route.fulfill({ body: files.get(path), contentType: 'application/json' });
  });
  await page.goto('./');
  await page.getByRole('button', { name: it.importSystem, exact: true }).click();
  const prepare = page.getByRole('button', { name: `${it.gamePrepare} · Pathfinder 2e`, exact: true });
  await prepare.click();
  const source = page.getByRole('dialog', { name: it.repositoryChooseTitle, exact: true });
  const load = source.getByRole('button', { name: it.repositoryLoadBundle, exact: true });
  await expect(source.getByRole('combobox', { name: it.repositorySystem, exact: true })).toHaveValue('pf2e');
  await expect(source.getByText(it.pathfinderSourceHelp, { exact: true })).toBeVisible();
  for (const text of [it.pathfinderBundleHelp, it.pathfinderLocalHelp, it.pathfinderSourceAdvanced, it.pathfinderFileStep])
    await expect(source.getByText(text, { exact: true })).toBeVisible();
  for (const text of [it.repositoryBundleHelp, it.repositoryLocalHelp, it.repositorySourceAdvanced])
    await expect(source.getByText(text, { exact: true })).toHaveCount(0);
  await expect(source.getByRole('link', { name: it.pathfinderDownload, exact: true }))
    .toHaveAttribute('href', 'https://d2dmd8x0lyn9l8.cloudfront.net/pf2e/system.rpg');
  await expect(load).toBeDisabled();
  await source.getByLabel(it.repositoryCompiledFile, { exact: true }).setInputFiles(wrong);
  await expect(source.getByRole('alert')).toContainText(it.repositoryLocalMismatch);
  await expect(load).toBeDisabled();
  await source.getByLabel(it.repositoryCompiledFile, { exact: true }).setInputFiles(file);
  await expect(source.getByRole('alert')).toHaveCount(0);
  await expect(load).toBeEnabled();
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-pf2e-guided-ready.png`) });
  await load.click();
  await expect(source.getByRole('alert')).toContainText('503');
  await expect(page.locator('.system-card')).toHaveCount(0);
  await load.click();
  const preview = page.getByRole('dialog', { name: it.importPreview, exact: true });
  await expect(preview).toContainText('Modelli di catalogo: 2');
  await preview.getByRole('button', { name: it.cancel, exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await prepare.click();
  await expect(load).toBeDisabled();
  await source.getByLabel(it.repositoryCompiledFile, { exact: true }).setInputFiles(file);
  await expect(load).toBeEnabled();
  await load.click();
  await preview.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(preview).not.toBeVisible();
  await page.getByRole('button', { name: it.systems, exact: true }).first().click();
  await expect(page.locator('.system-card')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: it.exportPackage, exact: true }).click();
  expect(readFileSync((await (await download).path())!)).toEqual(readFileSync(file));
  expect(requests.some(path => path.endsWith('.rpgs'))).toBe(false);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator('.sidebar').getByRole('button', { name: it.systems, exact: true }).click();
  await expect(page.getByRole('button', { name: `${it.useGame} · Pathfinder 2e`, exact: true })).toBeEnabled();
  await page.getByRole('button', { name: `${it.useGame} · Pathfinder 2e`, exact: true }).click();
  await expect(page.getByRole('heading', { name: it.allCharacters, exact: true })).toBeVisible();
});
