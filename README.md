# x-article-publisher

> Markdown → X (Twitter) Articles 草稿，全自动无头导入。
> Playwright + 系统 Chrome，不依赖任何 API key。
> **只灌草稿，永不自动发布**——最后那下 Publish 由你手动点。

源头技术来自 [xPoster](https://github.com/nevertoday/xposter) (MIT)，
经 [punk2898/x-article-publisher](https://github.com/punk2898/x-article-publisher) v4.1.0 (MIT) 分叉而来。
完整传承链与本项目改动见 [NOTICE.md](NOTICE.md) 与 [LOCAL_CHANGES.md](LOCAL_CHANGES.md)。

## 安装

### 方式一：作为 Skill 安装（推荐）

本项目本质是一个 AI Skill：装进 AI 助手后，只要说一句「帮我把文章发布到推特」，助手就会自动调用它。支持两个助手的 skills 目录：

| AI 助手 | macOS / Linux | Windows |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/` | `%USERPROFILE%\.claude\skills\` |
| Codex / DeepSeek Harness | `~/.agents/skills/` | `%USERPROFILE%\.agents\skills\` |

以 macOS + Claude Code 为例：

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/xaiwind/x-article-publisher.git ~/.claude/skills/x-article-publisher
cd ~/.claude/skills/x-article-publisher && npm install
```

Codex / DeepSeek Harness 把命令里的 `~/.claude/skills` 换成 `~/.agents/skills` 即可。`~/.agents/skills/` 是「开放 Agent Skills 标准」（agentskills.io）的跨助手目录，Codex、DeepSeek Harness、ChatGPT 等共用。

### 方式二：当普通脚本直接跑

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

- **Node.js ≥ 18**
- **Google Chrome**（系统安装的 Chrome，不是 Playwright 下载的 Chromium）
- **X Premium** —— X Articles 功能本身需要
- 操作系统：macOS 已实测；Windows / Linux 代码上支持但未实测，见「平台支持」

## 平台支持

> **实测状态**：目前只在 **macOS** 上实际跑通过。
> 下表中 Windows / Linux 的结论来自代码核查（平台守卫、异常捕获路径，
> 以及 Node 与 Playwright 自身的跨平台保证），**尚未在真机验证**。
> 逻辑上应该可用，但首次使用遇到问题很正常——欢迎提 issue，我会修。

核心链路（Playwright 驱动系统 Chrome、Draft.js 注入、图片上传、草稿保存）
**三个平台完全一致**，没有平台专属代码。有差异的只有两个辅助功能：

| 能力 | macOS | Windows | Linux | 缺失时的后果 |
|---|:---:|:---:|:---:|---|
| 发布主流程 | ✅ | ✅ | ✅ | — |
| 登录态持久化 | ✅ | ✅ | ✅ | — |
| 图片自动压缩（`sips`） | ✅ | ⚠️ 跳过 | ⚠️ 跳过 | 大图原样上传，见下 |
| 检测并关闭占用浏览器（`pgrep`/`pkill`） | ✅ | ⚠️ 失效 | ✅ | 需手动关 Chrome，见下 |

两处降级都**不会让程序崩溃**：`sips` 有 `process.platform !== 'darwin'` 守卫直接跳过；
`pgrep` 缺失会抛 ENOENT，已被 try/catch 捕获并当作"没有占用"处理。

### Windows / Linux 用户注意

**1. 图片不会自动压缩**

macOS 上大于 150KB 的图会用系统自带的 `sips` 压到长边 1280px / JPEG 82，
其他平台直接跳过，**上传原图**。影响：文章体积偏大、上传变慢，
超大图（如 10MB 的截图）可能上传失败。

对策：发布前自己先压一遍。任选其一——

```bash
# ImageMagick（三平台通用）
magick input.png -resize 1280x1280\> -quality 82 output.jpg

# 或 Windows PowerShell 里用 ffmpeg
ffmpeg -i input.png -vf "scale='min(1280,iw)':-1" -q:v 5 output.jpg
```

**2. Windows 上「自动关闭上一个浏览器」不生效**

脚本靠 `pgrep`/`pkill` 检测有没有别的 Chrome 正占着同一个登录态目录，
Windows 没这两个命令，这步会静默跳过。

影响：如果上次运行的浏览器窗口还开着（不带 `--headless` 时会一直开），
再跑一次会因为 profile 被锁而启动失败。脚本仍会尝试清理锁文件
（`SingletonLock` 等，这步是跨平台的）并重试一次，多数情况能自愈。

对策：**跑之前先把之前那个自动化 Chrome 窗口关掉**。或者从任务管理器结束
对应的 chrome.exe。注意别关掉你日常用的 Chrome——自动化用的是独立
profile，和你平时的浏览器互不干扰。

**3. 登录态目录位置**

| 平台 | 默认路径 |
|---|---|
| macOS / Linux | `~/.hermes-x-profile` |
| Windows | `C:\Users\<你的用户名>\.hermes-x-profile` |

用 `--profile=<dir>` 可以改到别处。

## 排错

| 现象 | 平台 | 解决 |
|---|:---:|---|
| Chrome 启动失败 / profile 被占用 | macOS·Linux | 脚本会自动清理锁并重试；仍失败则 `pkill -f .hermes-x-profile` 后重跑 |
| Chrome 启动失败 / profile 被占用 | Windows | 先手动关掉上一个自动化 Chrome 窗口（或任务管理器结束对应 chrome.exe），再重跑。不要关你日常用的 Chrome |
| 找不到 Chrome | 全平台 | 需要**系统安装**的 Google Chrome。仅装了 Edge 或 Chromium 不行 |
| 「没找到写文章按钮」 | 全平台 | 未登录（先不带 `--headless` 跑一次完成登录），或 X 改了 UI |
| 结果里 `imgOk` 与图片数不符 | 全平台 | 检查图片路径是否可解析；看输出有无残留 `__XPOSTER_` 标记 |
| 图片上传失败 / 很慢 | Windows·Linux | 无自动压缩，大图需自己先压到长边 ≤1280，见「平台支持」 |
| 编辑器等待超时 | 全平台 | 加大 `--timeout=<ms>`（默认 180000） |

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
