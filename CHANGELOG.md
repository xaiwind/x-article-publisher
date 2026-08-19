# Changelog

> 按版本记录关键改动，最新在上。

## [4.3.0-local] - 2026-07-09

> 借鉴 kuangjiajia/kaitox-toolkit 的 MARKDOWN 实体发现，结合真实编辑器逆向验证后实现。

### 新增
- **原生代码块**：代码块默认转为 atomic 块 + MARKDOWN 实体，X 编辑器/阅读页原生渲染成带语法高亮的代码框（含语言标签）。硬约定（原生「插入→代码」dump 实测）：mutability 必须 MUTABLE（Immutable 过校验但渲染丢内容）；`data.markdown` 前后**不带**换行——带了会渲染成空行把卡片上下撑出空白（kaitox 文档的"带换行"是服务端载荷习惯，编辑器注入不适用）。`X_CODE_IMAGE=1` 代码卡片图模式保留，优先级不变。旧「转引用块」方案废弃。
- **原生表格**：Markdown 表格同样走 MARKDOWN 实体，X 原生渲染成表格（对齐保留）。
- **嵌入推文**：独占一行的推文链接（也支持 `[text](url)`、`![](url)` 形式）转为内嵌推文卡片。识别容错扩大：任意子域、`i/web/status`、`statuses` 复数、尾部 `/photo/1`、query/hash（`shared.parseTweetId`）。

### 修复
- **TWEET 实体字段名**：编辑器内部是 camelCase `tweetId`（原生「插入→帖子」流程实测 dump），不是 kaitox 抓包的服务端格式 `tweet_id`——照搬服务端格式注入会在保存时被静默丢弃。
- **多原子块只有最后一个生效**：`insertAtomicBatch` 每个操作都从旧 editorState 取内容、互相覆盖，现改为串联 contentState。此前多分割线文章会触发此 bug，代码/表格改走原子块后必现，已修。
- **原子块插入失败不再丢内容**：失败的代码/表格/推文按 `fallbackText` 降级为原文（围栏代码/markdown 表格/链接），marker 不再被清理阶段静默删除。

### 验证
- 端到端实测（无头注入 → 服务端保存 → 重新加载截图）：代码框语法高亮、表格、推文卡片三者均正常渲染；`atomicOk=3, atomicFail=0`。

## [4.1.0] - 2026-06-05

### 新增
- **全自动无人值守模式 `auto-publish.js`**（Playwright + 系统 Chrome）：自动打开 X 文章编辑器、新建文章、注入正文 + 图片 + 封面，灌完停在草稿等你手动发布——**工具永不自动发布**。持久化登录态（`~/.hermes-x-profile`），首次登录一次后免登。
- **图片轻度压缩**（`payload.js`，调用 macOS 原生 `sips`，零依赖）：>150KB 的大图缩到长边 ≤1280px 并转 JPEG q82，体积常砍 5~10 倍（如 2.1MB → 228KB），上传更快、更不易触发 X 限流；只缩不放大。
- **Profile 占用自检**（`auto-publish.js`）：启动前检测并关闭上一个未关的发布浏览器（共用同一登录态），启动失败再清理锁文件重试，避免「现有会话」冲突。
- **`payload.js`**：把 `buildPayload` 抽成独立模块，扩展模式与全自动模式共用同一套解析逻辑（单一数据源）。
- `package.json` 新增 `npm run auto` 脚本。

### 修复
- **标题乱码 + 正文标题重复**：解码 frontmatter 里的 unicode 转义（如 `\U0001F680` → 🚀），让标题正常显示，同时修复因字符串不匹配导致的正文 H1 去重失效。
- **图片错位/丢失**：上传后改为按「块顺序里离 marker 最近」挑选新原子块，修复快速连续上传时 X 异步重排导致的图片落到文章最底部或丢失。
- **占位符残留**：`cleanupMarkers` 改为多轮兜底清理（每轮重新抓取 draftNode），并重删被异步插回的封面块，直到收敛——彻底清掉 `__..._IMAGE_n__` 之类残留标记。
- **行内代码里的示例图被误解析**：`shared.js` 新增行内代码区间识别，反引号包裹的 `![](...)` 不再被当成真实图片处理。

### 变更
- `xarticle-server.js`：改为引用 `payload.js`，不再内联 `buildPayload`。
- `package.json`：新增 `playwright-core` 依赖。

## [4.0.0]

- 基线：Chrome 扩展（MV3）一键把 Markdown 文章灌入 X Articles 编辑器，支持正文、图片按位插入、封面识别；载入按钮仅在文章编辑器页显示。
