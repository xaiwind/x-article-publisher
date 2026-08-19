/**
 * payload.js — 把 Markdown 解析成可注入 X 编辑器的 payload
 * 单一数据源：xarticle-server.js（扩展模式）与 auto-publish.js（全自动模式）共用
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const shared = require('./shared.js');

// ── 轻度图片压缩（macOS 自带 sips，零 npm 依赖）──
// 把大 PNG/JPEG 缩到长边 ≤ MAX_LONG_EDGE 并转 JPEG，体积常砍 5~10 倍，上传更快、更不易被 X 限流。
const IMG_MAX_LONG_EDGE = 1280;       // X 文章正文显示宽度 ~1000px，1280 留余量
const IMG_JPEG_QUALITY = 82;          // 轻度有损，肉眼几乎无差
const IMG_COMPRESS_MIN_BYTES = 150 * 1024; // 小于此体积不折腾

function sipsLongEdge(srcPath) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', srcPath], { encoding: 'utf8' });
    const w = /pixelWidth:\s*(\d+)/.exec(out);
    const h = /pixelHeight:\s*(\d+)/.exec(out);
    if (w && h) return Math.max(parseInt(w[1], 10), parseInt(h[1], 10));
  } catch (e) { /* ignore */ }
  return 0;
}

// 返回压缩后的 Buffer；不适用/失败/没变小则返回 null（调用方回退原图）
function compressWithSips(buf, ext, srcPath) {
  if (process.platform !== 'darwin') return null;            // 只在 macOS 走 sips
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null; // gif(动图)/webp 跳过
  if (buf.length < IMG_COMPRESS_MIN_BYTES) return null;       // 小图不压

  const longEdge = sipsLongEdge(srcPath);
  const target = Math.min(IMG_MAX_LONG_EDGE, longEdge || IMG_MAX_LONG_EDGE); // 只缩不放
  const tmpOut = path.join(os.tmpdir(), `hermes-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  try {
    execFileSync('sips', ['-Z', String(target), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(IMG_JPEG_QUALITY), srcPath, '--out', tmpOut], { stdio: 'ignore' });
    const out = fs.readFileSync(tmpOut);
    fs.unlinkSync(tmpOut);
    return (out.length && out.length < buf.length) ? out : null;
  } catch (e) {
    try { fs.unlinkSync(tmpOut); } catch (_) { /* ignore */ }
    return null;
  }
}

// ── Obsidian 附件路径解析 ──
// wiki 嵌入 ![[img.png]] 只带文件名，附件常存放在 vault 的其他目录（如「附件」文件夹）。
// 先按 md 同目录解析，找不到再从 vault 根目录（含 .obsidian 的最近祖先）按文件名搜索。
function findVaultRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.obsidian'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function findFileByName(rootDir, fileName) {
  const queue = [rootDir];
  while (queue.length) {
    const dir = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) queue.push(full);
      else if (entry.name === fileName) return full;
    }
  }
  return null;
}

function resolveLocalImage(src, mdDir) {
  const clean = src.split('|')[0].trim(); // 去掉 Obsidian 尺寸/别名后缀，如 ![[img.png|400]]
  if (clean.startsWith('/')) return clean;
  const direct = path.resolve(mdDir, clean);
  if (fs.existsSync(direct)) return direct;
  const vaultRoot = findVaultRoot(mdDir);
  const found = vaultRoot ? findFileByName(vaultRoot, path.basename(clean)) : null;
  return found || direct;
}

async function buildPayload(mdPath) {
  const markdown = fs.readFileSync(mdPath, 'utf-8');
  const mdDir = path.dirname(path.resolve(mdPath));
  const options = { extractTitle: true, extractCover: true };
  const parsed = shared.parseMarkdown(markdown, options);

  // 可选：代码块渲染成代码卡片图（X_CODE_IMAGE=1 时启用）；默认用原生 code-block 文本块
  let codeResults = new Map();
  const codeSegments = process.env.X_CODE_IMAGE === '1'
    ? parsed.segments.filter((s) => s.type === 'code')
    : [];
  if (codeSegments.length) {
    try {
      const { renderCodeImages } = require('./code-image.js');
      codeResults = await renderCodeImages(codeSegments);
      const rendered = [...codeResults.values()].filter((r) => r.ok).length;
      console.error(`[code-image] ${rendered}/${codeSegments.length} 个代码块渲染为图片`);
    } catch (e) {
      console.error('[code-image] 渲染失败，代码块回退为文本: ' + e.message);
    }
  }

  const imageResults = new Map();
  for (const seg of parsed.segments) {
    if (seg.type !== 'image') continue;
    const src = seg.source;
    try {
      if (src.startsWith('data:')) {
        const uri = shared.parseDataUri(src);
        if (uri.ok) imageResults.set(seg, { ok: true, ...uri, fileName: shared.guessFileName(src) });
      } else if (src.startsWith('http')) {
        imageResults.set(seg, { ok: false, error: 'Remote images unsupported' });
      } else {
        const fullPath = resolveLocalImage(src, mdDir);
        if (fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          const ext = path.extname(fullPath).toLowerCase();
          const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
          let finalBuf = buf;
          let finalMime = mimeMap[ext] || 'image/png';
          let finalName = path.basename(fullPath);
          const compressed = compressWithSips(buf, ext, fullPath);
          if (compressed) {
            finalBuf = compressed;
            finalMime = 'image/jpeg';
            finalName = finalName.replace(/\.(png|jpg|jpeg)$/i, '') + '.jpg';
            console.error(`[compress] ${path.basename(fullPath)}: ${(buf.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`);
          }
          imageResults.set(seg, { ok: true, base64: finalBuf.toString('base64'), mime: finalMime, fileName: finalName, bytes: finalBuf.length });
        } else {
          imageResults.set(seg, { ok: false, error: 'Not found: ' + fullPath });
        }
      }
    } catch (e) {
      imageResults.set(seg, { ok: false, error: e.message });
    }
  }

  const planOptions = { coverSource: parsed.cover, coverResult: null, codeResults };
  const pastePlan = shared.buildPastePlan(parsed.segments, imageResults, new Map(), planOptions);

  const imagePayloads = [];
  for (const op of pastePlan.plan) {
    if (op.op.type === 'image' && op.op.file?.base64) {
      imagePayloads.push({
        marker: op.marker, base64: op.op.file.base64, fileName: op.op.file.fileName,
        mime: op.op.file.mime, alt: op.op.file.alt || '', coverOnly: !!op.op.coverOnly,
        fallbackText: op.op.fallbackText || '', source: op.op.source || null
      });
    }
  }

  // 标题兜底链：frontmatter title → 正文 H1（parseMarkdown 已处理）→ 文件名
  const fallbackTitle = path.basename(mdPath, path.extname(mdPath)).trim();

  return {
    title: parsed.title || fallbackTitle, cover: parsed.cover || '',
    html: pastePlan.html, plain: pastePlan.plain,
    blocks: pastePlan.blocks, plan: pastePlan.plan,
    markerPrefix: pastePlan.markerPrefix,
    images: imagePayloads, articleId: null
  };
}

module.exports = { buildPayload };
