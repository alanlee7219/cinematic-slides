// Screenshot + smoke test：用 SwiftShader（純 CPU WebGL2）跑，CI / 冇 GPU 都得。
// node tests/shots.mjs            → 全部 slide、transition、keyboard walk
// SHOTS=0 node tests/shots.mjs    → 只做 error / keyboard 檢查，唔寫圖
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'index.html');
const url = pathToFileURL(file).href;
const out = path.join(root, 'docs', 'screens');
const SHOTS = process.env.SHOTS !== '0';
for (const d of ['', 'slides', 'phone', 'transitions']) mkdirSync(path.join(out, d), { recursive: true });

const kb = statSync(file).size / 1024;
const failures = [];
const fail = msg => { failures.push(msg); console.error('FAIL', msg); };
if (kb > 250) fail(`index.html is ${kb.toFixed(1)} KB (> 250 KB)`);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

async function open(viewport, dpr, where) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error') fail(`console error @ ${where()}: ${t}`);
    if (/WebGL2 unavailable|shader|link/i.test(t) && m.type() !== 'log') fail(`shader/fallback message @ ${where()}: ${t}`);
  });
  page.on('pageerror', e => fail(`page error @ ${where()}: ${e.message}`));
  return { ctx, page };
}
const frames = (page, n) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
async function settle(page) {
  await page.waitForFunction(() => window.deck);
  const r = await page.evaluate(() => window.deck.renderer);
  if (r !== 'webgl2') fail(`renderer is ${r} at ${page.url()}`);
  await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; });
  await frames(page, 4);
}

let where = '-';
const meta = JSON.parse(await (async () => {
  const { ctx, page } = await open({ width: 1280, height: 720 }, 1, () => where);
  where = 'boot'; await page.goto(url); await settle(page);
  const m = await page.evaluate(() => JSON.stringify({
    slides: window.deck.slides.map(s => ({ id: s.id, bg: s.bg, tr: s.tr, steps: s.layout === 'list' && s.body ? s.body.length : 0 })),
    transitions: window.deck.transitions, scenes: window.deck.scenes
  }));
  await ctx.close();
  return m;
})());
const { slides, transitions, scenes } = meta;
if (slides.length !== 13) fail(`expected 13 slides, got ${slides.length}`);
if (scenes.length !== 13) fail(`expected 13 scenes, got ${scenes.length}`);
if (transitions.length !== 10) fail(`expected 10 transitions, got ${transitions.length}`);
for (const t of transitions) if (!slides.slice(0, -1).some(s => s.tr === t)) fail(`transition ${t} is never used`);
for (const sc of scenes) if (!slides.some(s => s.bg === sc)) fail(`scene ${sc} is never used`);

const pad = k => String(k + 1).padStart(2, '0');
const index = { slides: [], phone: [], transitions: [] };

// (1) 每頁最後一步：1280x720 同 390x844 @2x
for (const [kind, vp, dpr] of [['slides', { width: 1280, height: 720 }, 1], ['phone', { width: 390, height: 844 }, 2]]) {
  const { ctx, page } = await open(vp, dpr, () => where);
  for (const [k, s] of slides.entries()) {
    where = `${kind}/${s.id}`;
    await page.goto(`${url}?q=1&k=${k}#${s.id}-${s.steps}`);
    await settle(page);
    const h = await page.evaluate(() => location.hash);
    if (h !== `#${s.id}-${s.steps}`) fail(`hash ${h} != #${s.id}-${s.steps}`);
    const name = `${kind}/${pad(k)}-${s.bg}.jpg`;
    if (SHOTS) await page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 78 });
    index[kind].push({ name, label: `${pad(k)} ${s.bg}` });
  }
  await ctx.close();
}

// (2) 每款 transition 喺 p = 0.25 / 0.5 / 0.75（凍結預覽）
{
  const { ctx, page } = await open({ width: 1280, height: 720 }, 1, () => where);
  for (const t of transitions) {
    const a = slides.findLastIndex((s, k) => s.tr === t && k < slides.length - 1);
    for (const p of [0.25, 0.5, 0.75]) {
      where = `tr/${t}@${p}`;
      await page.goto(`${url}?q=1&tr=${t}&p=${p}&a=${a}&b=${a + 1}`);
      await settle(page);
      const name = `transitions/${t}-${String(p).replace('.', '')}.jpg`;
      if (SHOTS) await page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 78 });
      index.transitions.push({ name, label: `${t} p=${p}` });
    }
  }
  await ctx.close();
}

// (3) Keyboard：由頭行到尾，再試倒帶、Home / End
{
  const { ctx, page } = await open({ width: 1280, height: 720 }, 1, () => where);
  where = 'keyboard';
  await page.goto(`${url}?q=1`);
  await settle(page);
  const idle = () => page.waitForFunction(() => window.deck.state.tr === null, null, { timeout: 15000 });
  const total = slides.reduce((n, s) => n + s.steps + 1, 0) - 1;
  for (let k = 0; k < total; k++) { await page.keyboard.press('ArrowRight'); await idle(); }
  const last = slides[slides.length - 1];
  let h = await page.evaluate(() => location.hash);
  if (h !== `#${last.id}-${last.steps}`) fail(`after ${total} × ArrowRight hash is ${h}, expected #${last.id}-${last.steps}`);
  await page.keyboard.press('ArrowRight'); await idle();
  h = await page.evaluate(() => location.hash);
  if (h !== `#${last.id}-${last.steps}`) fail(`ArrowRight past the end moved to ${h}`);
  await page.keyboard.press('ArrowLeft');
  await frames(page, 3);
  if (!(await page.evaluate(() => window.deck.state.tr && window.deck.state.tr.reverse))) fail('ArrowLeft did not start a reverse transition');
  await idle();
  const prevS = slides[slides.length - 2];
  h = await page.evaluate(() => location.hash);
  if (h !== `#${prevS.id}-${prevS.steps}`) fail(`ArrowLeft went to ${h}, expected #${prevS.id}-${prevS.steps}`);
  await page.keyboard.press('Home'); await idle();
  h = await page.evaluate(() => location.hash);
  if (h !== `#${slides[0].id}-0`) fail(`Home went to ${h}`);
  await page.keyboard.press('End'); await idle();
  h = await page.evaluate(() => location.hash);
  if (h !== `#${last.id}-${last.steps}`) fail(`End went to ${h}`);
  for (const key of ['n', 'o', '?']) {
    await page.keyboard.press(key);
    const vis = await page.evaluate(() => ['notes', 'over', 'help'].filter(id => !document.getElementById(id).hidden).length);
    if (vis !== 1) fail(`key ${key} should open exactly one panel (got ${vis})`);
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('m');
  if (!(await page.evaluate(() => window.deck.sound.on))) fail('M did not enable sound');
  await page.keyboard.press('m');
  console.log(`keyboard walk: ${total} steps → ${h}`);
  await ctx.close();
}

// Contact sheets
if (SHOTS) {
  const { ctx, page } = await open({ width: 1600, height: 900 }, 1, () => where);
  where = 'contact';
  for (const [kind, cols, w] of [['slides', 4, 390], ['phone', 7, 220], ['transitions', 6, 260]]) {
    const cells = index[kind].map(c => {
      const b64 = readFileSync(path.join(out, c.name)).toString('base64');
      return `<figure><img src="data:image/jpeg;base64,${b64}"><figcaption>${c.label}</figcaption></figure>`;
    }).join('');
    await page.setContent(`<style>body{margin:0;background:#111;color:#ccc;font:13px system-ui;padding:10px}
      main{display:grid;grid-template-columns:repeat(${cols},${w}px);gap:8px}figure{margin:0}img{width:100%;display:block;border-radius:4px}
      figcaption{padding:3px 0 6px}</style><main>${cells}</main>`);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await page.locator('main').screenshot({ path: path.join(out, `contact-${kind}.jpg`), type: 'jpeg', quality: 82 });
  }
  writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 2));
  await ctx.close();
}

await browser.close();
console.log(`index.html ${kb.toFixed(1)} KB · ${slides.length} slides · ${transitions.length} transitions`);
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('shots: all checks passed');
