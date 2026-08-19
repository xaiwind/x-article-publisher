# NOTICE — 出处与改动声明

本项目是衍生作品，遵循 MIT。以下声明用于满足 MIT 的署名保留要求，
并说明本项目相对上游做了什么。

## 传承链

| 层 | 项目 | 许可 | 说明 |
|---|---|---|---|
| 源头 | [nevertoday/xposter](https://github.com/nevertoday/xposter) | MIT（含 LICENSE 文件） | Draft.js 注入引擎、Markdown 解析器的原始实现 |
| 上游 | [punk2898/x-article-publisher](https://github.com/punk2898/x-article-publisher) v4.1.0 | MIT（README 与 package.json 声明，仓库未附 LICENSE 文件） | X Articles 无头发布链路 |
| 本项目 | x-article-publisher 4.3.0-local | MIT | 见下方改动 |

## 承袭自 xPoster 的部分

- `xpage.js` — 由 xPoster 的 `main-world.js` 移植（文件头已标注）
- `xpage.js` — 图片 atomic 块搬位、marker 光标定位、Draft.js 首字符预热等技巧
- `shared.js` — Markdown 解析器
- `shared.js` — 全局对象仍名为 `window.xPosterShared`

## 本项目的实质改动

完整逐条记录见 `LOCAL_CHANGES.md`。要点：

**移除**（出于安全）
- 删除整条浏览器扩展模式链路：`extension/`、`xarticle-server.js`、
  `publish-to-x.sh`、`setup.sh`。原因：其本地 HTTP 服务绑定所有网卡且
  CORS 为 `*`，运行期间文章内容与注入脚本会暴露给局域网。

**修正上游/第三方文档的错误结论**（均经真实编辑器 dump 实测）
- 嵌入推文实体只传 `tweetId`，不传 `tweet_id`——后者是服务端载荷格式，
  注入编辑器会在保存时被丢弃
- MARKDOWN 实体的 `data.markdown` 前后不带换行——带换行会渲染出空行
- `mutability` 必须为 `MUTABLE`——`IMMUTABLE` 能过校验但渲染丢内容

**修复**
- `insertAtomicBatch` 只有最后一个原子块生效的 bug（改为串联 contentState）
- 「正文 H1 当标题」判定收紧，避免吃掉用 H1 做章节标题的文章的第一节
- 原子块插入失败时按 `fallbackText` 降级为文本，内容不丢

**新增**
- 原生代码框与原生表格（MARKDOWN 实体机制，思路来自
  [kuangjiajia/kaitox-toolkit](https://github.com/kuangjiajia/kaitox-toolkit) 的发现，
  但字段细节经本地逆向验证后与其文档不同，见上）
- `code-image.js` 代码卡片图模式（`X_CODE_IMAGE=1`）
- Obsidian 附件解析：`![[img.png]]` 从 vault 根按文件名搜索

## 已处理

- `shared.js` 中 `applyLimits` 的署名行原为 `"Published with xPoster"`，
  已改为本项目署名。经核实该函数在本项目、上游 v4.1.0 及上游扩展模式中
  **均无调用方**，属 xPoster 继承下来的休眠代码，从未影响已发布内容。
  改动仅为避免将来接上时挂第三方品牌；MIT 不要求此类广告式署名。
