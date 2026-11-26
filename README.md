# 告別悶 Slide · cinematic-slides

單一個 `index.html` 嘅 WebGL2 簡報 demo：用 shader 即時畫背景（星空同地球、極光、紙紋），有 5 款電影感轉場。冇外部 library，唔使 build，離線都開到。

## 點開
1. **本機**：下載 `index.html`，用 Chrome、Edge、Firefox 或者 Safari 15+ 打開。
2. **GitHub Pages**：
   1. 入 repo 嘅 Settings → Pages。
   2. Source 揀 `Deploy from a branch`。
   3. Branch 揀 `main`，folder 揀 `/ (root)`，然後撳 Save。
   4. 等 1–2 分鐘，再開 `https://alanlee7219.github.io/cinematic-slides/`。

   注意：private repo 要 GitHub Pro 或者 Team 先開到 Pages。用免費 plan 嘅話，要先將 repo 轉做 public。

## 操作
| 按鍵 | 功能 |
|---|---|
| → / Space / Enter / PageDown，或者撳畫面右邊 | 下一步 |
| ← / Backspace / PageUp，或者撳畫面左邊 | 上一步 |
| Home / End | 跳去第一頁／最後一頁 |
| N | Speaker notes |
| O | Overview（揀頁跳過去） |
| F | 全屏 |
| ? 或者 H | Help |
| Esc | 閂晒啲 panel |
| 手機左右 swipe | 換頁 |

網址會記住你去到邊度，例如 `#how-2` 即係 `how` 呢頁嘅第 2 步。

## 改內容
全部內容都喺 `index.html` 頂部嘅 `SLIDES` array。每一頁係一個 object：

| Field | 用途 |
|---|---|
| `id` | 網址用嘅名，例如 `#intro` |
| `layout` | `hero`（大標題）或者 `list`（逐點出） |
| `bg` | 背景：`space`、`aurora`、`paper` |
| `tr` | 入呢一頁用邊款轉場：`fade`、`dissolve`、`flaps`、`line`、`portal` |
| `accent` | 主色，例如 `'#7cc4ff'` |
| `kicker`、`title` | 小標題、大標題 |
| `sub` | 副題（`hero` 用） |
| `body` | 重點 array（`list` 用）：每按一下出多一點 |
| `notes` | Speaker notes |

## `index.html` 入面有乜
1. `SLIDES`：內容。
2. `TR`：每款轉場行幾多秒。
3. Shaders：`BG_*` 係背景，`TR_*` 係轉場。
4. 文字：先用 Canvas 2D 畫字，再上載做 WebGL texture。
5. Engine：分頁、步驟、hash routing、鍵盤、swipe、notes／overview／help。

## 加一款轉場（大約 15–30 分鐘）
1. 跟 `TR_FADE` 嘅格式寫一個 `TR_XXX`：開頭宣告 `uniform sampler2D tA,tB;`，讀 `tA`（舊頁）、`tB`（新頁）同 `uP`（progress，由 0 行到 1），結果寫入 `o`。
2. 喺 `TR` 加 `xxx: { dur: 1.2 }`。
3. 喺 `PROG.tr` 加 `xxx: mk(TR_XXX)`。
4. 喺想用嘅頁設 `tr: 'xxx'`。
5. 開 `index.html?tr=xxx&p=0.5&a=1&b=2` 預覽：畫面會停喺第 2 頁轉去第 3 頁嘅一半（`a`、`b` 由 0 數起）。

## Fallback
- 冇 WebGL2，或者 shader compile 失敗：自動轉用 2D 淡入淡出，內容照樣睇到。
- 系統開咗「減少動態效果」（`prefers-reduced-motion`）：全部轉場變做 0.45 秒嘅 fade。
- GPU context 甩咗：等佢恢復之後，頁面會自動重新載入。

## 測試
```
node tests/wrap.test.mjs
```
測文字換行：中英混排、標點唔做行頭、最後一行唔會淨低一兩隻字。要 Node 18+，唔使裝任何 package。

## 原版點砌：The Last Boring Slide
呢份 demo 參考咗 [The Last Boring Slide](https://claude.ai/artifact/Cy2d8Vn63CnzCtonA1LSah) 嘅做法：
1. 單一個 HTML file：全屏 canvas，加一層 UI（notes、overview、help）。
2. 13 個 scene，大多數用 shader 即時計：山脈、月球、地球、星空。
3. 10 款 transition：摺紙、水浪、翻牌、印刷、撕紙、CRT 收線。
4. Fonts 同圖片全部用 base64 塞入 file，所以離線都開到。
5. 底層用 three.js，再加自己寫嘅 GLSL。

## 版權
呢份係獨立重寫，冇用原版嘅 code、圖片或者字型。原版嘅版權屬於原作者。
