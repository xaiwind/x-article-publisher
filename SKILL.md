---
name: x-article-publisher
description: Publish a Markdown article to X (Twitter) Articles via Playwright + system Chrome (headless, no window). Use when the user asks to publish an article to X, 发布到 X, 发布文章到推特, or import a Markdown file into X Articles. Fills the draft only — never auto-publishes. Requires X Premium.
---

# X Article Publisher

Publish a local Markdown file into an X Articles draft, silently (headless).
The tool **never clicks Publish** — the user reviews the draft and publishes
manually from their own browser.

## Install location

Install this repo into any agent's per-user `skills/` directory and run
`npm install` inside it. Known host directories:

- Claude Code: `~/.claude/skills/` (macOS/Linux) or `%USERPROFILE%\.claude\skills\` (Windows)
- Codex / DeepSeek Harness: `~/.agents/skills/` (macOS/Linux) or `%USERPROFILE%\.agents\skills\` (Windows)

Example (macOS, Claude Code):

```bash
git clone https://github.com/xaiwind/x-article-publisher.git ~/.claude/skills/x-article-publisher
cd ~/.claude/skills/x-article-publisher && npm install
```

For Codex / DeepSeek Harness, replace `~/.claude/skills` with `~/.agents/skills` (`~/.agents/skills/` is the cross-agent directory per the open agent skills standard at agentskills.io).

## Usage

Given a Markdown file path, run in the background:

```bash
cd ~/.claude/skills/x-article-publisher && node auto-publish.js /path/to/article.md --headless
```

Injects title, body, images, and cover into a new server-side draft using the
logged-in session in `~/.hermes-x-profile`. On success the output contains
`__AUTOPUBLISH_RESULT__{"ok":true,...}` then `__AUTOPUBLISH_DRAFT_URL__<url>` —
give that URL to the user to review and click **Publish** manually.

- **First run only:** run once WITHOUT `--headless` so the user can log in to X
  in the opened browser; the session persists afterwards.
- Flags: `--profile=<dir>` custom profile dir; `--timeout=<ms>` editor wait
  (default 180s). Headed mode (no `--headless`) keeps the browser open and the
  process alive until the user closes the window.
- The script auto-closes a previous instance holding the same profile.
- After a run, verify the result JSON: `imgOk` should equal the image count and
  the output must not report leftover `__XPOSTER_` markers.

## Content mapping

- **Title**: frontmatter `title` → leading H1 → filename. A body H1 is only
  treated as the article title when it is the **sole** H1 in the document *and*
  nothing but images precedes it. Documents that use H1 for section headings
  (`# 一、`, `# 二、` …) fall back to the filename and keep every H1 in the body.
- **Cover**: frontmatter `cover` → first image in the body.
- **Images**: standard `![](path)` and Obsidian `![[name.png]]` (resolved from
  the vault root, `|size` suffixes stripped); >150KB images auto-compressed.
- **Code blocks**: native code frame via an atomic MARKDOWN entity (X renders
  the fenced markdown itself). Optional: set env `X_CODE_IMAGE=1` to render
  code blocks as dark code-card PNGs instead.
- **Tables**: native table via the same MARKDOWN entity mechanism.
- **Embedded tweets**: a tweet URL alone on a line (also `[text](url)` or
  `![](url)` forms) becomes an embedded quoted tweet (TWEET entity). Tolerates
  subdomains, `i/web/status`, `statuses`, query/hash suffixes.
- Bold/italic/links/lists/quotes map to native formatting; H1 in body is the
  title, sections use H2/H3.
- If an atomic block (code/table/tweet) fails to insert, its marker degrades to
  the original text (fenced code / markdown table / URL) instead of being lost.

## Security notes

- Network calls go to x.com only (draft GraphQL mutations); nothing else.
- `~/.hermes-x-profile` holds the X session cookies (mode 700) — treat it like
  a credential; never copy or commit it.

## Troubleshooting

- Chrome fails to launch: stale profile locks — the script retries after
  clearing them; otherwise `pkill -f .hermes-x-profile` and re-run.
- "没找到写文章按钮": not logged in (run once headed), or X changed their UI.
- Never clean leftover markers via keyboard selection (macOS Shift+End selects
  to end of document); use the engine's `window.__xCleanupMarkers` instead.
