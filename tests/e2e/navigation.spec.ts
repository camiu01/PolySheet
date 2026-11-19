/** @file Mobile navigation drawer keyboard behavior. */
import { expect, test } from '@playwright/test';
import { it as copy } from '../../src/ui/it';

test('mobile drawer moves focus inside, contains Tab, closes on Escape and restores focus', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'The drawer is an overlay only below 760 px.');
  await page.goto('./');
  const more = page.getByRole('button', { name: copy.more, exact: true });
  await more.click();
  const drawer = page.getByRole('dialog', { name: copy.mainNavigation });
  await expect(page.getByRole('button', { name: copy.closeNavigation })).toBeFocused();
  await expect(page.locator('.main-shell')).toHaveAttribute('inert', '');
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('button', { name: copy.settings, exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: copy.closeNavigation })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(page.locator('.main-shell')).not.toHaveAttribute('inert');
  await more.click();
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator('.sidebar-open')).toHaveCount(0);
  await expect(page.locator('.main-shell')).not.toHaveAttribute('inert');
});

test('a new destination starts at the top with focus on its heading, also after Back', async ({ page }, info) => {
  await page.goto('./');
  const go = async (label: string) => {
    if (info.project.name === 'mobile') await page.getByRole('button', { name: copy.more, exact: true }).click();
    await page.locator('#main-navigation').getByRole('button', { name: label, exact: true }).click();
  };
  await go(copy.settings);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await go(copy.diagnostics);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('main h1')).toBeFocused();
  await page.goBack();
  await expect(page.locator('main h1')).toHaveText(copy.settings);
  await expect(page.locator('main h1')).toBeFocused();
});
