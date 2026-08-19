# 本地改动记录(相对上游 punk2898/x-article-publisher v4.1.0)

本目录已精简为 **Playwright 无头全自动模式**,并带以下本地补丁。
从上游更新前请先 diff,避免覆盖。

## 已移除(2026-07-07 精简)

- `extension/`、`xarticle-server.js`、`publish-to-x.sh`、`setup.sh` —— 扩展模式
  整条链路。移除原因:① 用户只用无头模式;② 本地 HTTP 服务绑定所有网卡且
  CORS 为 `*`,运行期间文章内容与注入脚本会暴露给局域网(安全问题)。

## 补丁列表

1. **payload.js** — Obsidian 附件解析:`![[img.png]]` 在 md 同目录找不到时,
   从 vault 根(含 `.obsidian` 的最近祖先)按文件名搜索;去除 `|尺寸` 后缀。
2. **payload.js** — 标题兜底链:frontmatter `title` → 正文 H1 → 文件名。
2b. **shared.js**(2026-08-03)— 收紧「正文 H1 当标题」的判定。原逻辑取正文中
   *任意位置*的第一个 H1 当文章标题**并把它从正文删掉**;遇到用 H1 做章节标题
   的文章(`# 一、`、`# 二、`…),会把第一节标题误当成文章标题,同时正文里少了
   那一节的标题。现要求同时满足:① 全文仅一个 H1;② 其前只允许图片(封面)。
   否则回退文件名并保留全部 H1。回归验证三种输入:单 H1 开头(取 H1,原行为不变)
   / 多 H1(回退文件名,H1 保留) / frontmatter 有 title(优先,H1 保留)。
3. **shared.js** — 代码块默认转为**原生代码框**:atomic 块 + MARKDOWN 实体
   (mutability 必须 MUTABLE,Immutable 过校验但渲染丢内容;`data.markdown`
   前后【不带】换行,带了会渲染成空行把卡片撑高——2026-07-09 用原生「插入→代码」
   dump 实测,注意 kaitox 文档说带换行,那是服务端载荷习惯,编辑器注入不适用)。
   思路来自 kuangjiajia/kaitox-toolkit 的 MARKDOWN 实体发现。编辑器「插入」菜单
   原生就有 代码/LaTeX/表格/帖子/分割线(此前"格式菜单没有代码格式"的结论过时)。
   旧的「转引用块」方案已废弃。
4. **code-image.js**(新增)— 可选代码卡片图模式,`X_CODE_IMAGE=1` 启用:
   代码块渲染为深色 GitHub 风格 PNG,>50 行自动分段。`buildPayload` 因此为
   async。
5. **auto-publish.js** — 无头模式等待自动保存后输出
   `__AUTOPUBLISH_DRAFT_URL__<url>`;新增 marker 残留兜底检查(调用引擎的
   `window.__xCleanupMarkers`,基于 Draft.js 内容状态,禁止用键盘选区清理)。
6. **xpage.js** — 暴露 `window.__xCleanupMarkers` 事后清理入口。
7. **shared.js** — 表格默认转为**原生表格**(同上 MARKDOWN 实体机制,X 按
   markdown 渲染);扩展模式遗留的表格截图路径(tableResults)保留但不再触发。
8. **shared.js** — 推文嵌入修正:TWEET 实体数据从 `{url, tweetId}` 改为只含
   `{tweetId}`(2026-07-09 在真实编辑器用原生「插入→帖子」流程 dump 实测的内部
   字段名;注意 kaitox 抓包的 `tweet_id` 是服务端载荷格式,注入编辑器会在保存时
   被丢弃,不能照搬)。新增 `parseTweetId`,识别范围扩到任意子域、`i/web/status`、
   `statuses`、尾部 `/photo/1`、query/hash。
9. **xpage.js** — 修复 `insertAtomicBatch` 只有最后一个原子块生效的 bug(每个
   操作都从旧 editorState 取内容,现改为串联 contentState);插入失败的原子块按
   `fallbackText` 降级为文本,内容不丢。

## 安全审计结论(2026-07-07)

- 外部请求仅 x.com(草稿标题/封面 GraphQL 变更),无遥测/外发。
- `execFileSync` 均为固定二进制 + 数组参数(pgrep/pkill/sips),无命令注入面。
- `eval` 仅用于向 X 页面注入自带引擎(设计如此);代码渲染内容经 HTML 转义。
- `~/.hermes-x-profile` 存有 X 登录 cookies,权限 700;视同凭据,勿拷贝/提交。
