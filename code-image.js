/**
 * code-image.js — 把代码块渲染成深色代码卡片 PNG（Playwright + 系统 Chrome）
 * X 文章编辑器不支持代码块格式，渲染成图片是唯一能保留代码观感的方式。
 * 超长代码按 CHUNK_LINES 行分段成连续多张图。
 */
const CHUNK_LINES = 50;   // 单张图最多行数，超出则分段
const CARD_WIDTH = 720;   // CSS 宽度；deviceScaleFactor=2 → 输出 1440px 高清图

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function chunkLines(code) {
  const lines = String(code || '').split('\n');
  if (lines.length <= CHUNK_LINES) return [lines.join('\n')];
  const chunks = [];
  for (let i = 0; i < lines.length; i += CHUNK_LINES) {
    chunks.push(lines.slice(i, i + CHUNK_LINES).join('\n'));
  }
  return chunks;
}

function cardHtml(code, language, partLabel) {
  const label = [language, partLabel].filter(Boolean).join(' · ');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:8px;background:transparent">
<div id="card" style="width:${CARD_WIDTH}px;box-sizing:border-box;background:#0d1117;border:1px solid #30363d;border-radius:12px;padding:18px 24px 22px">
  <div style="display:flex;align-items:center;margin-bottom:14px">
    <span style="width:11px;height:11px;border-radius:50%;background:#ff5f57;display:inline-block"></span>
    <span style="width:11px;height:11px;border-radius:50%;background:#febc2e;display:inline-block;margin-left:7px"></span>
    <span style="width:11px;height:11px;border-radius:50%;background:#28c840;display:inline-block;margin-left:7px"></span>
    <span style="margin-left:auto;color:#8b949e;font:11px 'SF Mono',Menlo,Consolas,monospace">${escapeHtml(label)}</span>
  </div>
  <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font:13px/1.65 'SF Mono',Menlo,Consolas,monospace;color:#e6edf3">${escapeHtml(code)}</pre>
</div>
</body></html>`;
}

/**
 * @param {Array} codeSegments parseMarkdown 产出的 code 段
 * @returns {Map} segment → { ok, images: [{ base64, mime, fileName }] } 或 { ok: false, error }
 */
async function renderCodeImages(codeSegments) {
  const results = new Map();
  if (!codeSegments.length) return results;

  const { chromium } = require('playwright-core');
  // 独立无痕实例，不碰 ~/.hermes-x-profile，避免和发布浏览器抢占登录态
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({
      viewport: { width: CARD_WIDTH + 16, height: 800 },
      deviceScaleFactor: 2,
    });
    let n = 0;
    for (const seg of codeSegments) {
      try {
        const chunks = chunkLines(seg.code);
        const images = [];
        for (let i = 0; i < chunks.length; i++) {
          const part = chunks.length > 1 ? `${i + 1}/${chunks.length}` : '';
          await page.setContent(cardHtml(chunks[i], seg.language || '', part), { waitUntil: 'load' });
          const buf = await page.locator('#card').screenshot({ type: 'png' });
          n += 1;
          images.push({ base64: buf.toString('base64'), mime: 'image/png', fileName: `code-${n}.png` });
        }
        results.set(seg, { ok: true, images });
      } catch (e) {
        results.set(seg, { ok: false, error: e.message });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

module.exports = { renderCodeImages };
