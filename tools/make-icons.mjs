// Renders icons/icon.svg to PNGs with headless Chromium: node tools/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync('icons/icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const jobs = [['icons/icon-192.png', 192, 1], ['icons/icon-512.png', 512, 1], ['icons/apple-touch-icon.png', 180, 1], ['icons/icon-maskable-512.png', 512, 0.8]];
for (const [out, size, scale] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * scale);
  await page.setContent(`<html><body style="margin:0;background:#083222;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: out, omitBackground: false });
  console.log('wrote', out);
}
await browser.close();
