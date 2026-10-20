// Usage: node src/build.mjs <data.json> <outDir> [monday|wednesday] [closerKey...]
// Writes one HTML + PNG per closer and, on Monday, the leadership table.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { closerMetrics, runFlags } from './metrics.mjs';
import { closerCard, leadershipTable } from './render.mjs';

const [dataPath, outDir, edition = 'monday', ...only] = process.argv.slice(2);
if (!dataPath || !outDir) {
  console.error('usage: node src/build.mjs <data.json> <outDir> [monday|wednesday] [closerKey...]');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const closers = data.closers.filter((c) => !only.length || only.includes(c.key));
const metrics = closers.map((c) => closerMetrics(data, c, edition));

const pages = metrics.map((m) => [`${edition}-${m.closer.key}`, closerCard(m, data.month)]);
if (edition === 'monday' && !only.length) pages.push(['monday-leadership', leadershipTable(metrics, data)]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const [name, html] of pages) {
  const htmlPath = path.join(outDir, `${name}.html`);
  fs.writeFileSync(htmlPath, html);
  await page.setViewportSize({ width: name.endsWith('leadership') ? 1500 : 1080, height: 800 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('.card').screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log('wrote', name);
}
await browser.close();

// Data conflicts for Sheila, written on every run
const flags = runFlags(data, metrics, edition);
const flagPath = path.join(outDir, `${edition}-flags.md`);
fs.writeFileSync(flagPath, `# Scorecard flags: ${data.editions[edition].date}\n\n${flags.map((f) => `- ${f}`).join('\n') || '- None'}\n`);
console.log(`${flags.length} flags -> ${flagPath}`);
