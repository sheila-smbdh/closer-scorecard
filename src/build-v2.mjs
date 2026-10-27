// Usage: node src/build-v2.mjs <data.json> <outDir> [monday|wednesday] [closerKey...]
// Renders the v2 (simplified) sample card for the given closers: out/v2-<edition>-<closer>.png

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { closerMetrics, withTeam } from './metrics.mjs';
import { planV2 } from './plan-v2.mjs';
import { closerCardV2 } from './render-v2.mjs';

const [dataPath, outDir, edition = 'monday', ...only] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const all = data.closers.map((c) => closerMetrics(data, c, edition));
withTeam(all);
const metrics = all.filter((m) => !only.length || only.includes(m.closer.key));

// "Sunday, October 18th"
const [mm, dd] = data.editions[edition].through_key.split('-').map(Number);
const d = new Date(Date.UTC(2026, mm - 1, dd));
const sfx = [11, 12, 13].includes(dd) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[dd % 10] ?? 'th');
const dateText = `${d.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })}, ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${dd}${sfx}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1080, height: 800 } });
for (const m of metrics) {
  const html = closerCardV2(m, planV2(data, m), data.month, `${m.closer.short}'s month to date: ${dateText}`);
  const name = `v2-${edition}-${m.closer.key}`;
  fs.writeFileSync(path.join(outDir, `${name}.html`), html);
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('.card').screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log('wrote', name);
}
await browser.close();
