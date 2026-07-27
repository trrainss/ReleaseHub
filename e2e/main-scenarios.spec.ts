import { test, expect } from '@playwright/test';

test.describe('ReleaseHub E2E Scenarios', () => {
  test('Scenario 1: Owner creates workspace, creates release, adds changes, assigns reviewer, submits for review', async ({ page }) => {
    await page.goto('/auth/signin');

    await page.fill('input[name="email"]', 'owner@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/workspaces');

    await page.click('text=New Workspace');
    await page.fill('input[name="name"]', 'Test Workspace');
    await page.click('button:has-text("Create")');

    await page.waitForSelector('.workspace-card');

    await page.click('.workspace-card');
    await page.waitForSelector('.tabs');

    await page.click('text=Create Release');
    await page.fill('input[name="title"]', 'Release 1.0');
    await page.fill('input[name="version"]', '1.0.0');
    await page.click('button:has-text("Create")');

    await page.waitForSelector('.release-card');

    await page.click('.release-card');
    await page.waitForSelector('.release-detail');

    await page.click('text=Add Change');
    await page.fill('input[name="title"]', 'New feature');
    await page.fill('input[name="description"]', 'Added main feature');
    await page.click('button:has-text("Add")');

    await page.waitForSelector('.change-item');

    await page.click('text=Invite Member');
    await page.fill('input[name="email"]', 'reviewer@test.com');
    await page.click('button:has-text("Send")');

    await page.click('text=Submit for Review');
    await expect(page.locator('.status-badge--review')).toBeVisible();
  });

  test('Scenario 2: Maintainer approves release, publishes, anonymous views release notes', async ({ page }) => {
    await page.goto('/auth/signin');

    await page.fill('input[name="email"]', 'maintainer@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/workspaces');

    await page.click('.workspace-card');
    await page.waitForSelector('.release-card');
    await page.click('.release-card');

    await page.waitForSelector('.approval-panel');

    await page.click('button:has-text("Approve")');
    await page.waitForSelector('.status-badge--approved');

    await page.click('button:has-text("Publish")');
    await page.waitForSelector('.status-badge--published');

    await page.goto('/release-notes/default');
    await expect(page.locator('h1')).toContainText('Release Notes');
  });
});
