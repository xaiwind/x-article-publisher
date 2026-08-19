# X Article Publisher

> Markdown → X Articles，一键导入。
> Chrome 扩展 + 本地 HTTP 服务，不依赖任何 API。
> 核心技术来自 [xPoster](https://github.com/nevertoday/xposter) (MIT)。

## 安装

```bash
git clone https://github.com/punk2898/x-article-publisher.git
cd x-article-publisher

# 装 Chrome 扩展
# chrome://extensions → 开发者模式 → 加载已解压 → 选 extension/ 目录
```

不需要 `npm install`，项目只用 Node.js 内置模块。

## 使用

```bash
bash publish-to-x.sh /path/to/article.md
```

然后：
1. Chrome 自动打开 `x.com/compose/articles/new`
2. 点 **New Article** 进入编辑器
3. 点右上角 **📥 导入文章** 按钮
4. 预览窗确认 → 点 **✅ 导入到编辑器**
5. 检查内容 → 点 X 的 **Publish**

## 原理

```
Markdown .md
    │
    ▼  shared.js (xPoster 解析器)
    │
    ▼  xarticle-server.js (HTTP :8765)
    │    ├── /status   — 文章预览信息
    │    ├── /payload  — 完整文章 JSON
    │    └── /inject-script — 注入引擎 + 数据
    │
    ▼  Chrome 扩展 (content.js)
    │    注入 [📥 导入文章] 按钮 → 点它 → 预览 → 确认
    │
    ▼  xpage.js (注入到 X 页面 MAIN world)
       React Fiber 攀爬 → Draft.js 写入 → 图片上传 → GraphQL 元数据
    │
    ▼
✅ 文章出现在编辑器 — 你点 Publish
```

## 文件结构

```
x-article-publisher/
├── xarticle-server.js    # HTTP 服务器
├── xpage.js              # X 页面注入引擎 (Draft.js + React Fiber)
├── shared.js             # xPoster 的 Markdown 解析器 (MIT)
├── publish-to-x.sh       # 一键发布
├── setup.sh              # 环境检测
├── package.json          # 项目描述（无 npm 依赖）
└── extension/            # Chrome 扩展
    ├── manifest.json     # Manifest V3
    ├── content.js        # 注入按钮 + 预览窗 + 导入逻辑
    └── background.js     # 点扩展图标 → 打开 dashboard
```

## 要求

- macOS（Windows/Linux 改 `publish-to-x.sh` 里的 `open` 命令即可）
- Node.js ≥ 18
- Google Chrome
- X Premium（X Articles 功能需要）

## API 端点

| 端点 | 用途 |
|------|------|
| `GET /` | Dashboard（手动复制粘贴备选） |
| `GET /status` | 文章预览：标题、摘要、块数、图片数 |
| `GET /payload` | 完整文章 JSON payload |
| `GET /engine` | xpage.js 注入引擎 |
| `GET /inject-script` | 引擎 + payload 合一（CSP 安全） |

## Hermes 集成

配合 `x-article-publisher` skill 使用。Skill 文件在：
```
~/.hermes/skills/social-media/x-article-publisher/SKILL.md
```

Hermes 里说 "发布到 X" 即可自动调用 `publish-to-x.sh`。

## Markdown 格式

```markdown
---
title: 文章标题          # 可选：为空/占位符时自动取 h1
cover: cover.png        # 可选：封面图片
---

# 标题

**粗体** *斜体* [链接](https://example.com)

![图片](image.png)

- 列表项
- 列表项

> 引用

`行内代码`
```

## 排错

| 现象 | 解决 |
|------|------|
| 📥 按钮不出现 | 确认在 articles/edit 或 compose/articles 页面；刷新扩展 🔄 |
| 点按钮提示「无法连接」 | 确认已运行 `bash publish-to-x.sh` |
| 注入后内容为空 | 等 5 秒再看；检查 DevTools Console |
| 端口被占用 | `lsof -ti :8765 | xargs kill` |

## License

MIT — 基于 xPoster 技术。xPoster 源码: https://github.com/nevertoday/xposter (MIT)
