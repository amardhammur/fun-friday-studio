import { test } from 'node:test';
import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

test('changing activity folders keeps the library populated during development', { timeout: 30000 }, async () => {
  const workspace = fileURLToPath(new URL('../../', import.meta.url));
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'friday-activity-reload-')));
  let server, browser;
  try {
    for (const path of ['src', 'activities', 'index.html', 'package.json']) await cp(join(workspace, path), join(fixture, path), { recursive: true });
    await symlink(join(workspace, 'node_modules'), join(fixture, 'node_modules'));
    await symlink(join(workspace, 'public'), join(fixture, 'public'));
    const probe = join(fixture, 'activities', 'reload-probe');
    await mkdir(probe);
    await writeFile(join(probe, 'index.ts'), "import '../../src/core/registry';\n");
    const { default: react } = await import('@vitejs/plugin-react');
    server = await createServer({ root: fixture, configFile: false, plugins: [react()], logLevel: 'error', server: { host: '127.0.0.1', port: 0, fs: { allow: [fixture, workspace] } } });
    await server.listen();
    browser = await chromium.launch();
    const page = await browser.newPage();
    const repeatedBoots = [];
    page.on('console', message => { if (message.text().includes('calling ReactDOMClient.createRoot()')) repeatedBoots.push(message.text()); });
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    const names = ['Childhood vs Now', 'Act It Out', 'Commercial Clash'];
    await expect(page.locator('.activity-card h2')).toHaveText(names);
    const hotUpdate = Promise.race([
      page.waitForEvent('console', { predicate: msg => msg.text().includes('[vite] hot updated:'), timeout: 10000 }),
      page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame(), timeout: 10000 }),
    ]);
    await rm(probe, { recursive: true });
    await hotUpdate;
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))).catch(error => {
      if (!error.message.includes('Execution context was destroyed')) throw error;
    });
    // A full reload returns to welcome; a component refresh keeps the library.
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await expect(page.locator('.activity-card h2')).toHaveText(names, { timeout: 8000 });
    expect(repeatedBoots).toEqual([]);
  } finally {
    await browser?.close();
    await server?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});
