// 測試 index.html 入面嘅換行（wrap）邏輯。
// 跑法：node tests/wrap.test.mjs（Node 18+，唔使裝任何 package）
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = html.match(/\/\/ wrap:begin[^\n]*\n([\s\S]*?)\/\/ wrap:end/);
assert.ok(m, 'index.html 搵唔到 "// wrap:begin" 同 "// wrap:end"');
const { wrap } = new Function(`${m[1]}\nreturn { wrap };`)();

// 假 canvas：每個字闊 1，所以 maxW 就係每行最多幾多個字
const g = { measureText: s => ({ width: [...s].length }) };
const len = s => [...s].length;

// 1. 一行放得落：唔使斷
assert.deepEqual(wrap(g, '告別悶 Slide', 20), ['告別悶 Slide']);

// 2. 尾行得 1 個字：由上一行搬字落嚟，而且一個字都唔可以唔見
const t2 = '一二三四五六七八九十乜';
const r2 = wrap(g, t2, 10);
assert.ok(len(r2.at(-1)) > 3, `尾行太短：${JSON.stringify(r2)}`);
assert.equal(r2.join(''), t2);

// 3. 標點唔可以做一行嘅開頭
const r3 = wrap(g, '一二三四五六七八九，十一二三四五六七八九', 9);
for (const line of r3) assert.ok(!/^[，。、；：！？]/.test(line), `標點開頭：${JSON.stringify(r3)}`);

// 4. 每行唔超過 maxW（只容許行尾標點凸出 1 格）
const r4 = wrap(g, 'WebGL2：所有畫面都喺 GPU 畫，GLSL shader 寫背景同轉場', 12);
for (const line of r4) {
  const limit = /[，。、；：！？]$/.test(line) ? 13 : 12;
  assert.ok(len(line) <= limit, `超出闊度：${JSON.stringify(r4)}`);
}

// 5. 跟 \n 換行
assert.deepEqual(wrap(g, '第一行\n第二行', 20), ['第一行', '第二行']);

console.log('wrap tests: 5/5 passed');
