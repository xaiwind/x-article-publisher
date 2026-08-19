# x-article-publisher

> Markdown → X (Twitter) Articles 草稿，全自动无头导入。
> Playwright + 系统 Chrome，不依赖任何 API key。
> **只灌草稿，永不自动发布**——最后那下 Publish 由你手动点。

源头技术来自 [xPoster](https://github.com/nevertoday/xposter) (MIT)，
经 [punk2898/x-article-publisher](https://github.com/punk2898/x-article-publisher) v4.1.0 (MIT) 分叉而来。
完整传承链与本项目改动见 [NOTICE.md](NOTICE.md) 与 [LOCAL_CHANGES.md](LOCAL_CHANGES.md)。

## 安装

```bash
git clone https://github.com/xaiwind/x-article-publisher.git
cd x-article-publisher
npm install          # 需要 playwright-core
```

## 使用

**首次运行**必须不带 `--headless`，浏览器会打开让你登录 X，登录态之后持久保存：

```bash
node auto-publish.js /path/to/article.md
```

之后都可以无头静默运行：

```bash
node auto-publish.js /path/to/article.md --headless
```

成功时输出里包含：

```
__AUTOPUBLISH_RESULT__{"ok":true,...}
__AUTOPUBLISH_DRAFT_URL__<草稿地址>
```

打开那个地址检查内容，确认无误后自己点 **Publish**。

### 参数

| 参数 | 说明 |
|---|---|
| `--headless` | 无头运行，不弹窗口 |
| `--profile=<dir>` | 自定义登录态目录（默认 `~/.hermes-x-profile`） |
| `--timeout=<ms>` | 登录/编辑器等待超时（默认 180000） |
| `X_CODE_IMAGE=1` | 环境变量；代码块渲染成深色 PNG 卡片，而非原生代码框 |

带 `--headless` 时进程跑完即退；不带时浏览器保持打开，直到你关掉窗口。
脚本会自动关掉占用同一 profile 的上一个实例。

## 内容映射

| Markdown | X Articles |
|---|---|
| frontmatter `title` → 正文 H1 → 文件名 | 文章标题 |
| frontmatter `cover` → 正文首图 | 封面 |
| `![](path)`、Obsidian `![[name.png]]` | 图片（>150KB 自动压缩） |
| 代码块 | 原生代码框（带语言标签） |
| 表格 | 原生表格（保留对齐） |
| 独占一行的推文链接 | 内嵌引用推文 |
| 粗体 / 斜体 / 链接 / 列表 / 引用 | 对应原生格式 |
| H2 / H3 | 章节标题 |

**标题判定**：正文 H1 只有在「全文仅此一个 H1」且「其前只有图片」时才被当作文章标题。
用 H1 做章节标题的文章（`# 一、`、`# 二、`…）会回退到文件名，并保留全部 H1。

**Obsidian 附件**：`![[img.png]]` 在 md 同目录找不到时，会从 vault 根
（含 `.obsidian` 的最近祖先目录）按文件名搜索，`|尺寸` 后缀自动去除。

**降级保护**：代码块 / 表格 / 推文这类原子块若插入失败，会退回成原始文本
（围栏代码 / markdown 表格 / 裸 URL），内容不丢。

## 原理

```
Markdown .md
    │
    ▼  payload.js / shared.js  — 解析、附件定位、原子块构造
    │
    ▼  auto-publish.js  — Playwright 启动系统 Chrome，复用持久登录态
    │
    ▼  xpage.js  — 注入 X 页面 MAIN world
    │     React Fiber 攀爬 → Draft.js 写入 → 图片上传归位 → GraphQL 元数据
    │
    ▼
草稿已就绪 —— 你自己点 Publish
```

## 文件结构

```
x-article-publisher/
├── auto-publish.js    # 入口：Playwright 驱动，等待自动保存，输出草稿 URL
├── payload.js         # Markdown → payload，附件解析
├── shared.js          # Markdown 解析器（承袭自 xPoster）
├── xpage.js           # X 页面注入引擎（承袭自 xPoster main-world.js）
├── code-image.js      # 可选：代码块 → 深色 PNG 卡片
├── NOTICE.md          # 出处与改动声明
└── LOCAL_CHANGES.md   # 相对上游的逐条改动
```

## 要求

- **macOS** —— 用到 `pgrep` / `pkill` / `sips`，其他平台需替换
- **Node.js ≥ 18**
- **Google Chrome**（系统 Chrome，非下载版 Chromium）
- **X Premium** —— X Articles 功能本身需要

## 排错

| 现象 | 解决 |
|---|---|
| Chrome 启动失败 | profile 锁残留，脚本会自动清理重试；仍失败则 `pkill -f .hermes-x-profile` 后重跑 |
| 「没找到写文章按钮」 | 未登录（先不带 `--headless` 跑一次），或 X 改了 UI |
| 结果里 `imgOk` 与图片数不符 | 检查图片路径是否可解析；看输出有无残留 `__XPOSTER_` 标记 |
| 编辑器等待超时 | 加大 `--timeout=<ms>` |

**注意**：清理残留标记必须用引擎的 `window.__xCleanupMarkers`，
不要用键盘选区（macOS 上 Shift+End 会选到文档末尾）。

## 安全

- 网络请求只发往 x.com（草稿的 GraphQL 变更），无遥测、无外发。
- `~/.hermes-x-profile` 存有 X 登录 cookies，权限 700。**视同凭据**，不要拷贝、不要提交。
- `execFileSync` 均为固定二进制 + 数组参数，无命令注入面。
- `xpage.js` 中的 Bearer token 是 X 网页版客户端的公开静态值，非个人凭据。

## License

MIT。本项目为衍生作品，版权声明涵盖三层传承：

- [nevertoday/xposter](https://github.com/nevertoday/xposter) — MIT
- [punk2898/x-article-publisher](https://github.com/punk2898/x-article-publisher) v4.1.0 — MIT
- 本项目 — MIT

详见 [LICENSE](LICENSE) 与 [NOTICE.md](NOTICE.md)。
