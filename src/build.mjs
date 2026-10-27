// Usage: node src/build.mjs <data.json> <outDir> [monday|wednesday|monthly] [closerKey...]
// monthly = the 1st-of-month edition: the whole previous month, for #sales-reports.
// Renders each closer's card (out/<edition>-<closer>.html + .png) and writes out/<edition>-flags.md for Sheila.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { closerMetrics, withTeam, runFlags, trackerFor } from './metrics.mjs';
import { plan } from './plan.mjs';
import { closerCard } from './render.mjs';

const [dataPath, outDir, edition = 'monday', ...only] = process.argv.slice(2);
if (!dataPath || !outDir) {
  console.error('usage: node src/build.mjs <data.json> <outDir> [monday|wednesday|monthly] [closerKey...]');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const all = data.closers.map((c) => closerMetrics(data, c, edition));
withTeam(all);
const metrics = all.filter((m) => !only.length || only.includes(m.closer.key));

// "Sunday, October 18th"
const [mm, dd] = data.editions[edition].through_key.split('-').map(Number);
const year = Number(trackerFor(data, data.editions[edition])?.through?.slice(0, 4)) || new Date().getUTCFullYear();
const d = new Date(Date.UTC(year, mm - 1, dd));
const sfx = [11, 12, 13].includes(dd) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[dd % 10] ?? 'th');
const dateText = `${d.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })}, ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${dd}${sfx}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1080, height: 800 } });
for (const m of metrics) {
  const title = edition === 'monthly' ? `${m.closer.short}'s ${data.month.label}: final, through ${dateText}`
    : `${m.closer.short}'s month to date: ${dateText}`;
  const html = closerCard(m, plan(data, m), data.month, title);
  const name = `${edition}-${m.closer.key}`;
  fs.writeFileSync(path.join(outDir, `${name}.html`), html);
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('.card').screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log('wrote', name);
}
await browser.close();

// Data conflicts for Sheila, written on every run
const flags = runFlags(data, all, edition);
const flagPath = path.join(outDir, `${edition}-flags.md`);
fs.writeFileSync(flagPath, `# Scorecard flags: ${data.editions[edition].date}\n\n${flags.map((f) => `- ${f}`).join('\n') || '- None'}\n`);
console.log(`${flags.length} flags -> ${flagPath}`);
