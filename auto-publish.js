#!/usr/bin/env node
/**
 * auto-publish.js — 全自动无人值守发布（Playwright + 系统 Chrome）
 *
 * 用法:
 *   node auto-publish.js <markdown.md> [选项]
 *
 * 行为:把文章自动灌入 X 文章编辑器(草稿),停在那里。【永远不自动发布,由你手动点发布】
 *
 * 选项:
 *   --headless       无头运行(默认有头,X 风控对无头敏感,不建议)
 *   --profile=<dir>  自定义登录态配置目录(默认 ~/.hermes-x-profile)
 *   --timeout=<ms>   登录/编辑器等待超时(默认 180000)
 *
 * 登录态:首次会打开浏览器,请在里面登录 X 一次,之后会话持久化,无需再登。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch (e) {
  console.error('❌ 未安装 playwright-core。请先运行: npm install');
  process.exit(1);
}

const { buildPayload } = require('./payload.js');

// ── 解析参数 ──
const args = process.argv.slice(2);
const mdPath = args.find((a) => !a.startsWith('--'));
const headless = args.includes('--headless');
const profileArg = args.find((a) => a.startsWith('--profile='));
const timeoutArg = args.find((a) => a.startsWith('--timeout='));
const profileDir = profileArg ? profileArg.split('=')[1] : path.join(os.homedir(), '.hermes-x-profile');
const navTimeout = timeoutArg ? parseInt(timeoutArg.split('=')[1]) : 180000;

if (!mdPath) {
  console.error('用法: node auto-publish.js <markdown.md> [--headless]');
  process.exit(1);
}
if (!fs.existsSync(mdPath)) {
  console.error('❌ 文件不存在: ' + mdPath);
  process.exit(1);
}

const XPAGE_JS = fs.readFileSync(path.join(__dirname, 'xpage.js'), 'utf-8');
const EDITOR_URL = 'https://x.com/compose/articles/new';
const log = (...a) => console.log('[AutoPublish]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 编辑器可写区选择器（已实测：编辑器页 contenteditable 即 data-testid=composer）
const EDITOR_SELECTOR = '[data-testid="composer"], .public-DraftEditor-content, div[data-contents="true"]';
// 草稿列表页的「写文章」入口是纯图标按钮，aria-label="create"
const CREATE_SELECTOR = 'button[aria-label="create" i], [role="button"][aria-label="create" i]';

async function ensureEditor(page, timeout) {
  log('检查是否已在编辑器…(如未登录,请在打开的浏览器里登录 X)');
  // 先快速看一眼是否已经在编辑器
  try {
    await page.waitForSelector(EDITOR_SELECTOR, { timeout: 6000, state: 'visible' });
    await sleep(1200);
    log('✅ 已在编辑器');
    return;
  } catch (e) {
    // 不在编辑器：当前应是草稿列表页，点「写文章(create)」新建一篇
  }

  log('当前在草稿列表页,点击「写文章」新建…');
  try {
    const createBtn = page.locator(CREATE_SELECTOR).first();
    await createBtn.waitFor({ state: 'visible', timeout: 20000 });
    await createBtn.click();
  } catch (e) {
    throw new Error('没找到「写文章(create)」按钮,可能未登录或 X 改版。请先在浏览器里登录 X。');
  }

  log('等待新建文章编辑器加载…');
  await page.waitForSelector(EDITOR_SELECTOR, { timeout });
  await sleep(1200);
  log('✅ 编辑器已就绪, URL=' + page.url());
}

async function injectArticle(page, payload) {
  log(`注入文章: ${payload.title || '(untitled)'} | 文本块 ${(payload.blocks || []).filter((b) => b.type === 'text').length} | 图片 ${payload.images.length}`);
  // 在 Playwright 隔离世界里 eval 引擎(不受页面 CSP 限制),定义 window.__xArticleWrite 并执行
  const result = await page.evaluate(
    async ({ js, payload }) => {
      // eslint-disable-next-line no-eval
      (0, eval)(js);
      if (typeof window.__xArticleWrite !== 'function') {
        return { ok: false, error: '注入引擎未定义 __xArticleWrite' };
      }
      try {
        return await window.__xArticleWrite(payload);
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },
    { js: XPAGE_JS, payload }
  );
  return result;
}

// 清理可能残留的 Chrome 单例锁（被 kill 后这些文件可能不会自动删，导致新实例起不来）
function clearProfileLocks() {
  for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try { fs.unlinkSync(path.join(profileDir, f)); } catch (e) { /* ignore */ }
  }
}

// 检测是否有 Chrome 正占用这个登录 profile（上一次发布的浏览器没关），有就先关掉再开
async function freeProfileIfBusy() {
  let busy = false;
  try {
    const out = execFileSync('pgrep', ['-fl', profileDir], { encoding: 'utf8' });
    busy = /[Cc]hrome/.test(out);
  } catch (e) {
    busy = false; // pgrep 无匹配会抛错（退出码 1）
  }
  if (!busy) return;
  log('检测到上一个发布浏览器还开着(共用同一登录态),先关闭它再开新的…');
  try { execFileSync('pkill', ['-f', profileDir]); } catch (e) { /* ignore */ }
  await sleep(2000);
  clearProfileLocks();
}

(async () => {
  let payload;
  try {
    payload = await buildPayload(mdPath);
  } catch (e) {
    console.error('❌ 解析 Markdown 失败: ' + e.message);
    process.exit(1);
  }

  log(`配置目录: ${profileDir} | 模式: ${headless ? '无头' : '有头'} | 自动发布: 永不(只灌草稿)`);

  const launchOpts = {
    headless,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  };

  // 启动前：若 profile 被上一个浏览器占用，先关掉它
  await freeProfileIfBusy();

  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, launchOpts);
  } catch (e) {
    // 占用/残留锁导致的启动失败：强制清理后重试一次
    log('启动失败,清理 profile 占用后重试: ' + e.message);
    try { execFileSync('pkill', ['-f', profileDir]); } catch (_) { /* ignore */ }
    await sleep(2000);
    clearProfileLocks();
    try {
      context = await chromium.launchPersistentContext(profileDir, launchOpts);
    } catch (e2) {
      console.error('❌ 启动 Chrome 失败: ' + e2.message);
      console.error('   确认已安装 Google Chrome,且已 npm install。');
      process.exit(1);
    }
  }

  const page = context.pages()[0] || (await context.newPage());

  let result = { ok: false };
  try {
    await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ensureEditor(page, navTimeout);
    result = await injectArticle(page, payload);
    log('注入结果:', JSON.stringify(result));

    if (!result.ok) {
      log('❌ 注入失败。浏览器保持打开供检查。');
    } else {
      log('✅ 文章已灌入 X 草稿编辑器。请人工核对后【手动点发布】——本工具永不自动发布。');
    }
  } catch (e) {
    console.error('❌ 流程出错: ' + e.message);
    result.error = e.message;
  }

  // 输出机器可读结果(供 Punk Studio API 解析)
  console.log('__AUTOPUBLISH_RESULT__' + JSON.stringify(result));

  // 无头模式:草稿存在 X 服务端,等自动保存完成后输出草稿链接,用户在自己的浏览器里核对发布
  if (headless) {
    if (result.ok) {
      log('等待 X 自动保存草稿…');
      await sleep(10000);
      // 兜底：X 的异步回调偶尔在清理结束后把 marker 插回来，最后再检一次
      try {
        const leftover = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="composer"], .public-DraftEditor-content, div[data-contents="true"]');
          return el ? /__XPOSTER_/.test(el.innerText || '') : false;
        });
        if (leftover) {
          log('检测到残留 marker，执行最终清理…');
          const n = await page.evaluate(() => (window.__xCleanupMarkers ? window.__xCleanupMarkers() : -1));
          log(`最终清理完成（清除 ${n} 处），再等自动保存…`);
          await sleep(8000);
        }
      } catch (e) { log('残留检查失败(忽略): ' + e.message); }
      log('✅ 草稿已保存到你的 X 账号。请在你自己的浏览器打开核对并手动发布:');
      log('   ' + page.url());
      console.log('__AUTOPUBLISH_DRAFT_URL__' + page.url());
    }
    await context.close();
    process.exit(result.ok ? 0 : 1);
  } else {
    log('浏览器保持打开,等你手动点发布。发完直接关掉浏览器窗口即可(本进程会随之退出)。');
    await new Promise((resolve) => context.on('close', resolve));
    log('浏览器已关闭,退出。');
    process.exit(result.ok ? 0 : 1);
  }
})();
