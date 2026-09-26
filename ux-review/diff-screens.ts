// Pixel-compares two folders of screenshots with the same file names, in a headless Chromium canvas
// (no image libraries needed). Prints the share of differing pixels per file and exits 1 on any difference.
//
//   node ux-review/diff-screens.ts <before-dir> <after-dir> [filter-substring]
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const [before, after, filter = ''] = process.argv.slice(2);
if (!before || !after) { console.error('usage: node ux-review/diff-screens.ts <before-dir> <after-dir> [filter]'); process.exit(2); }
const names = readdirSync(before).filter(n => n.endsWith('.png') && n.includes(filter)).sort();
const browser = await chromium.launch(), page = await browser.newPage();
let changed = 0;
for (const name of names) {
  if (!existsSync(`${after}/${name}`)) { console.log(`MISSING  ${name}`); changed++; continue; }
  const [a, b] = [before, after].map(dir => `data:image/png;base64,${readFileSync(`${dir}/${name}`).toString('base64')}`);
  const result = await page.evaluate(async ([a, b]) => {
    const load = (src: string) => new Promise<HTMLImageElement>(resolve => { const img = new Image(); img.onload = () => resolve(img); img.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`, diff: 1 };
    const pixels = (img: HTMLImageElement) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data; };
    const pa = pixels(ia), pb = pixels(ib); let diff = 0;
    for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 24) diff++;
    return { size: `${ia.width}x${ia.height}`, diff: diff / (pa.length / 4) };
  }, [a, b] as const);
  if (result.diff > 0) changed++;
  console.log(`${result.diff === 0 ? 'SAME   ' : 'CHANGED'}  ${(result.diff * 100).toFixed(3).padStart(7)}%  ${name}`);
}
await browser.close();
console.log(`${names.length - changed} of ${names.length} identical`);
process.exit(changed ? 1 : 0);
