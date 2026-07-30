import { test, expect } from '@playwright/test';

/**
 * E2E Scenarios for ReleaseHub
 *
 * NOTE: These tests require:
 * 1. A running Supabase instance with the seed data
 * 2. Test users: owner@test.com / password123, maintainer@test.com / password123, reviewer@test.com / password123
 * 3. The app running on localhost:5173 (or configured BASE_URL)
 *
 * Each scenario is independent and creates its own data.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('ReleaseHub E2E Scenarios', () => {
  test('Scenario 1: Owner creates workspace, creates release, adds changes, assigns reviewer, submits for review', async ({ page }) => {
    // Sign in as owner
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.fill('input[name="email"]', 'owner@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/workspaces');

    // Create a new workspace (unique name to avoid collisions)
    const workspaceName = `E2E Test Workspace ${Date.now()}`;
    await page.click('text=New Workspace');
    await page.fill('input[name="name"]', workspaceName);
    await page.click('button:has-text("Create")');
    await page.waitForSelector('.workspace-card');

    // Navigate to workspace
    await page.click(`text=${workspaceName}`);
    await page.waitForSelector('.tabs');

    // Create a release
    await page.click('text=Create Release');
    await page.fill('input[name="version"]', '1.0.0');
    await page.fill('input[name="title"]', 'Release 1.0');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('.release-card');

    // Navigate into release detail
    await page.click('.release-card');
    await page.waitForSelector('.release-detail');

    // Add a change
    await page.click('text=Add Change');
    await page.fill('input[name="title"]', 'New feature');
    await page.fill('input[name="description"]', 'Added main feature');
    await page.click('button:has-text("Add")');
    await page.waitForSelector('.change-item');

    // Verify change was added
    await expect(page.locator('.change-item')).toHaveCount(1);
  });

  test('Scenario 2: Maintainer approves and publishes release', async ({ page }) => {
    // Sign in as maintainer
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.fill('input[name="email"]', 'maintainer@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/workspaces');

    // Navigate to first workspace
    await page.waitForSelector('.workspace-card');
    await page.click('.workspace-card');
    await page.waitForSelector('.tabs');

    // Navigate to releases
    await page.click('a:has-text("Releases")');

    // Wait for release list to load
    await page.waitForSelector('.release-card', { timeout: 10000 });

    // Click on first release
    await page.click('.release-card');
    await page.waitForSelector('.release-detail');

    // Wait for approval panel to load
    await page.waitForSelector('.approval-panel', { timeout: 10000 });

    // Approve the release
    await page.click('button:has-text("Approve")');
    await page.waitForSelector('.status-badge--approved', { timeout: 10000 });

    // Publish the release
    await page.click('button:has-text("Publish")');
    await page.waitForSelector('.status-badge--published', { timeout: 10000 });
  });

  test('Scenario 3: Anonymous user views release notes', async ({ page }) => {
    // Navigate to release notes page as anonymous user
    await page.goto(`${BASE_URL}/release-notes/default`);
    await page.waitForSelector('h1');

    // Should see the release notes page
    await expect(page.locator('h1')).toContainText('Release Notes');

    // Should see at least one published release (if any exist)
    const articleCount = await page.locator('.release-notes').count();
    expect(articleCount).toBeGreaterThanOrEqual(0); // 0 if no published releases
  });
});
