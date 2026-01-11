import { test, expect } from '@playwright/test';

test('admin can create challenge via UI', async ({ page }) => {
  await page.goto('http://localhost:5000/admin/login');
  await page.fill('input#username', 'admin');
  await page.fill('input#password', 'admin123');
  await page.click('button:has-text("Login as Admin")');
  await page.waitForURL('**/admin');

  // Navigate to Challenges
  await page.goto('http://localhost:5000/admin/challenges');

  // Open create modal
  await page.click('button:has-text("Create Challenge")');
  await page.fill('input[placeholder="Title"]', 'E2E Test Challenge');
  await page.fill('input[placeholder="Category"]', 'e2e');
  await page.fill('input[type="number"]', '111');
  await page.fill('textarea', 'Created by Playwright test');

  // Intercept POST and wait for response
  const [response] = await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/api/admin/challenges') && resp.request().method() === 'POST'),
    page.click('button:has-text("Create")'),
  ]);

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty('id');

  // Verify the new challenge appears in the list (reload)
  await page.reload();
  const text = await page.textContent('body');
  expect(text).toContain('E2E Test Challenge');
});