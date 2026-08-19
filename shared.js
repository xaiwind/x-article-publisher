(() => {
  const STYLE_TAGS = {
    Bold: "strong",
    Italic: "em",
    Strikethrough: "s",
    Code: "code"
  };

  const BLOCK_TAGS = {
    "header-one": "h1",
    "header-two": "h2",
    "header-three": "h3",
    "header-four": "h4",
    "header-five": "h5",
    "header-six": "h6",
    blockquote: "blockquote",
    unstyled: "p"
  };

  const LOCAL_DB = "xposter_local_assets";
  const LOCAL_STORE = "handles";
  const VAULT_KEY = "vault_root";
  const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
  const MAX_TABLE_IMAGE_PIXELS = 16 * 1000 * 1000;
  const MAX_TABLE_IMAGE_CELLS = 1200;
  const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/avif"
  ]);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const ZH_TW_CHAR_MAP = new Map(Object.entries({
    "与": "與", "专": "專", "业": "業", "个": "個", "临": "臨", "为": "為", "么": "麼", "于": "於",
    "仅": "僅", "从": "從", "们": "們", "优": "優", "会": "會", "传": "傳", "体": "體", "侧": "側",
    "储": "儲", "关": "關", "内": "內", "写": "寫", "准": "準", "减": "減", "击": "擊", "划": "劃",
    "则": "則", "创": "創", "别": "別", "务": "務", "动": "動", "区": "區", "单": "單", "占": "佔",
    "历": "歷", "发": "發", "变": "變", "台": "臺", "号": "號", "后": "後", "启": "啟", "响": "響",
    "围": "圍", "图": "圖", "块": "塊", "声": "聲", "处": "處", "备": "備", "复": "復", "夹": "夾",
    "实": "實", "对": "對", "导": "導", "将": "將", "尝": "嘗", "尽": "盡", "带": "帶", "帮": "幫",
    "并": "並", "庆": "慶", "库": "庫", "应": "應", "开": "開", "张": "張", "弹": "彈", "当": "當",
    "录": "錄", "径": "徑", "态": "態", "执": "執", "扩": "擴", "报": "報", "拦": "攔", "择": "擇",
    "换": "換", "据": "據", "数": "數", "断": "斷", "无": "無", "旧": "舊", "时": "時", "显": "顯",
    "暂": "暫", "术": "術", "权": "權", "条": "條", "来": "來", "构": "構", "标": "標", "栏": "欄",
    "样": "樣", "桥": "橋", "检": "檢", "残": "殘", "没": "沒", "浅": "淺", "测": "測", "浏": "瀏",
    "温": "溫", "点": "點", "烟": "煙", "状": "狀", "独": "獨", "环": "環", "现": "現", "画": "畫",
    "盖": "蓋", "盗": "盜", "码": "碼", "确": "確", "种": "種", "签": "籤", "类": "類", "级": "級",
    "纯": "純", "纸": "紙", "线": "線", "细": "細", "终": "終", "经": "經", "绑": "綁", "结": "結",
    "给": "給", "绝": "絕", "统": "統", "继": "繼", "绪": "緒", "续": "續", "编": "編", "缩": "縮",
    "网": "網", "联": "聯", "脚": "腳", "节": "節", "获": "獲", "虑": "慮", "装": "裝", "见": "見",
    "观": "觀", "规": "規", "览": "覽", "计": "計", "订": "訂", "认": "認", "让": "讓", "议": "議",
    "记": "記", "许": "許", "设": "設", "访": "訪", "证": "證", "识": "識", "诉": "訴", "诊": "診",
    "试": "試", "该": "該", "详": "詳", "语": "語", "误": "誤", "说": "說", "请": "請", "读": "讀",
    "调": "調", "负": "負", "责": "責", "败": "敗", "账": "賬", "贴": "貼", "费": "費", "转": "轉",
    "轻": "輕", "载": "載", "较": "較", "辑": "輯", "输": "輸", "边": "邊", "过": "過", "运": "運",
    "还": "還", "这": "這", "进": "進", "连": "連", "适": "適", "选": "選", "里": "裡", "钮": "鈕",
    "铃": "鈴", "链": "鏈", "锁": "鎖", "错": "錯", "长": "長", "门": "門", "闭": "閉", "问": "問",
    "闲": "閒", "间": "間", "阅": "閱", "队": "隊", "阶": "階", "际": "際", "随": "隨", "隐": "隱",
    "页": "頁", "项": "項", "须": "須", "预": "預", "题": "題", "风": "風", "馈": "饋", "验": "驗",
    "骤": "驟"
  }));
  const ZH_TW_PHRASES = [
    ["文件夾", "資料夾"],
    ["文件", "檔案"],
    ["軟件", "軟體"],
    ["默認", "預設"],
    ["加載", "載入"],
    ["粘貼", "貼上"],
    ["隊列", "佇列"],
    ["賬號", "帳號"],
    ["後臺", "後台"],
    ["本地", "本機"]
  ];

  function toTraditionalChinese(value) {
    let text = String(value ?? "").replace(/[\u4e00-\u9fff]/g, (char) => ZH_TW_CHAR_MAP.get(char) || char);
    for (const [source, replacement] of ZH_TW_PHRASES) {
      text = text.replaceAll(source, replacement);
    }
    return text;
  }

  function looksLikeMarkdown(text) {
    if (!text || text.length < 3) return false;
    if (findMarkdownImageSpans(text).some((span) => isLikelyMarkdownImageSource(span.source))) return true;
    return [
      /^#{1,6}\s+\S/m,
      /^>\s+\S/m,
      /^[-*+]\s+\S/m,
      /^\d+\.\s+\S/m,
      /^\s*```/m,
      /^\s*(?:---|\*\*\*|___)\s*$/m,
      /\[[^\]]+\]\(https?:\/\/\S+\)/i,
      /^\s*\|.+\|\s*$\n^\s*\|[\s:|\-]+\|\s*$/m,
      /`[^`\n]+`/
    ].some((pattern) => pattern.test(text));
  }

  function parseFrontmatter(markdown) {
    const normalized = String(markdown ?? "").replace(/\r\n/g, "\n");
    const match = normalized.match(/^---\n([\s\S]*?)\n---\n*/);
    if (!match) return { body: normalized.trim(), meta: {} };
    const meta = {};
    for (const line of match[1].split("\n")) {
      const index = line.indexOf(":");
      if (index < 0) continue;
      const key = line.slice(0, index).trim();
      const value = line
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key) meta[key] = value;
    }
    return { body: normalized.slice(match[0].length).trim(), meta };
  }

  function markdownTitleCandidate(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function markdownTitleCandidateFromFileName(fileName) {
    const raw = String(fileName || "").trim();
    if (!raw) return "";
    const name = raw.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).pop() || raw;
    const stem = name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, "");
    return markdownTitleCandidate(stem);
  }

  function markdownTitleCandidateFromOptions(options = {}) {
    const explicit = markdownTitleCandidate(
      options.titleCandidate || options.fallbackTitle || options.sourceTitle || ""
    );
    if (explicit) return explicit;
    return markdownTitleCandidateFromFileName(options.sourceFileName || options.fileName || "");
  }

  // 解码字面 unicode 转义（YAML 双引号字符串里的 \U0001F680 / \u{1F680} / \uXXXX）
  // 朴素 frontmatter 解析不会处理这些转义，导致 emoji 变成乱码、标题去重也匹配不上
  function decodeUnicodeEscapes(value) {
    if (value == null) return value;
    const str = String(value);
    if (str.indexOf("\\") === -1) return str;
    return str
      .replace(/\\U([0-9a-fA-F]{8})/g, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return m; } })
      .replace(/\\u\{([0-9a-fA-F]+)\}/g, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return m; } })
      .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => { try { return String.fromCharCode(parseInt(h, 16)); } catch (e) { return m; } });
  }

  function parseMarkdown(markdown, options = {}) {
    const extractTitle = options.extractTitle !== false && options.setTitle !== false;
    const extractCover = options.extractCover !== false && options.setCover !== false;
    const { body, meta } = parseFrontmatter(markdown);
    const rawTitle = decodeUnicodeEscapes(meta.title || meta.Title || meta["标题"] || null);
    // Treat empty/placeholder titles as null → fall through to # heading
    const PLACEHOLDER_TITLES = new Set(["待定", "暂定", "未定", "TBD", "tbd", "TBA", "tba", "WIP", "wip"]);
    const titleFromMeta = (rawTitle && !PLACEHOLDER_TITLES.has(rawTitle.trim()))
      ? rawTitle.trim()
      : null;
    const titleCandidate = extractTitle ? markdownTitleCandidateFromOptions(options) : "";
    let cover = extractCover ? meta.cover || meta.Cover || meta["封面"] || null : null;
    if (cover) {
      cover = cover
        .replace(/^!\[\[|\]\]$/g, "")
        .replace(/^!\[[^\]]*\]\(([^)]+)\)$/u, "$1")
        .trim();
    }

    const spans = findSpecialBlocks(body);
    const segments = [];
    let cursor = 0;
    for (const span of spans) {
      if (span.start > cursor) {
        segments.push(...parseTextBlocks(body.slice(cursor, span.start)));
      }
      segments.push(span.segment);
      cursor = span.end;
    }
    if (cursor < body.length) segments.push(...parseTextBlocks(body.slice(cursor)));

    let title = extractTitle ? titleFromMeta : null;
    let titleSource = title ? "frontmatter" : "";
    if (extractTitle && !title) {
      // 正文 H1 需同时满足两条才认定为「文章标题」：
      //   1. 全文仅此一个 H1 —— 出现多个说明 H1 被当作章节标题（如「# 一、」「# 二、」）
      //   2. 它位于正文最前（之前只允许封面图）
      // 否则保留 H1 在正文中，标题回退到文件名，
      // 避免把章节标题误当成文章标题、并把该章节标题从正文里删掉。
      const h1Indices = [];
      segments.forEach((segment, index) => {
        if (segment.type === "text" && segment.kind === "header-one") h1Indices.push(index);
      });
      if (h1Indices.length === 1) {
        const h1Index = h1Indices[0];
        const leadingOnlyImages = segments
          .slice(0, h1Index)
          .every((segment) => segment.type === "image");
        if (leadingOnlyImages) {
          title = segments[h1Index].text || null;
          titleSource = title ? "heading" : "";
          segments.splice(h1Index, 1);
        }
      }
    } else if (extractTitle && title) {
      // frontmatter 已有标题：若正文首个 H1 与标题同名，删掉它，避免正文里重复出现标题
      const h1Index = segments.findIndex(
        (segment) => segment.type === "text" && segment.kind === "header-one"
      );
      if (h1Index >= 0) {
        const h1Text = String(segments[h1Index].text || "").trim();
        if (h1Text && h1Text === String(title).trim()) {
          segments.splice(h1Index, 1);
        }
      }
    }
    if (extractTitle && !title && titleCandidate) {
      title = titleCandidate;
      titleSource = "candidate";
    }

    if (extractCover && !cover) {
      cover = segments.find((segment) => segment.type === "image" && segment.source)?.source || null;
    }

    return {
      title,
      cover,
      segments,
      meta,
      titleFromMeta: Boolean(extractTitle && titleFromMeta),
      titleFromCandidate: Boolean(extractTitle && titleSource === "candidate"),
      titleSource
    };
  }

  function findSpecialBlocks(markdown) {
    const spans = [];
    let match;

    const fencedCode = /```([^\n`]*)\n([\s\S]*?)```/g;
    while ((match = fencedCode.exec(markdown)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: {
          type: "code",
          language: (match[1] || "").trim(),
          code: (match[2] || "").replace(/\n$/, "")
        }
      });
    }

    const table = /^(?:[ \t]*\|.+\|[ \t]*\n)(?:[ \t]*\|[\s:|\-]+\|[ \t]*\n)((?:[ \t]*\|.+\|[ \t]*\n?)*)/gm;
    while ((match = table.exec(markdown)) !== null) {
      if (overlaps(spans, match.index)) continue;
      const parsed = parseTable(match[0]);
      if (!parsed) continue;
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: "table", ...parsed }
      });
    }

    const divider = /^(?: {0,3})(?:-{3,}|\*{3,}|_{3,})(?:[ \t]*)$/gm;
    while ((match = divider.exec(markdown)) !== null) {
      if (overlaps(spans, match.index)) continue;
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: "divider" }
      });
    }

    const statusUrl = /^[ \t]{0,3}(https?:\/\/\S+)[ \t]*$/gm;
    while ((match = statusUrl.exec(markdown)) !== null) {
      if (overlaps(spans, match.index)) continue;
      const tweetId = parseTweetId(match[1]);
      if (!tweetId) continue;
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: "tweet", tweetId }
      });
    }

    for (const image of findMarkdownImageSpans(markdown)) {
      if (overlaps(spans, image.start)) continue;
      const source = image.source;
      const tweetId = parseTweetId(source);
      spans.push({
        start: image.start,
        end: image.end,
        segment: tweetId
          ? { type: "tweet", tweetId }
          : { type: "image", source, alt: image.alt.trim() }
      });
    }

    const linkedTweet = /^[ \t]*\[([^\]]*)\]\(([^)]+)\)[ \t]*$/gm;
    while ((match = linkedTweet.exec(markdown)) !== null) {
      if (overlaps(spans, match.index)) continue;
      const tweetId = parseTweetId(match[2]);
      if (!tweetId) continue;
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: "tweet", tweetId }
      });
    }

    const obsidianImage = /^[ \t]*!\[\[([^\]]+)\]\][ \t]*$/gm;
    while ((match = obsidianImage.exec(markdown)) !== null) {
      if (overlaps(spans, match.index)) continue;
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        segment: { type: "image", source: match[1].trim(), alt: "" }
      });
    }

    return spans.sort((left, right) => left.start - right.start);
  }

  // 从 x.com / twitter.com 帖子链接取出数字 tweet_id；不是帖子链接返回 null。
  // 整串锚定：只认整个字符串就是一条帖子链接。容忍 http/https、任意子域
  // （www./mobile. 等）、status 前任意路径段（如 i/web/status）、statuses 复数、
  // 结尾的 /photo/1、?query、#hash。
  function parseTweetId(url) {
    const match = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:twitter|x)\.com\/(?:[^\/\s]+\/)*status(?:es)?\/(\d+)(?:[\/?#]\S*)?$/i
      .exec(String(url || "").trim());
    return match ? match[1] : null;
  }

  // 找出行内代码区间（成对的反引号，长度 1~2；``` 围栏由别处处理）
  // 用于跳过示例代码里的 ![](...)，避免被当成真图片
  function findInlineCodeRanges(markdown) {
    const ranges = [];
    const runs = [];
    const re = /`+/g;
    let m;
    while ((m = re.exec(markdown)) !== null) {
      if (m[0].length <= 2) runs.push({ index: m.index, len: m[0].length });
    }
    const used = new Array(runs.length).fill(false);
    for (let i = 0; i < runs.length; i += 1) {
      if (used[i]) continue;
      for (let j = i + 1; j < runs.length; j += 1) {
        if (used[j] || runs[j].len !== runs[i].len) continue;
        ranges.push({ start: runs[i].index, end: runs[j].index + runs[j].len });
        used[i] = used[j] = true;
        break;
      }
    }
    return ranges;
  }

  function findMarkdownImageSpans(markdown) {
    const spans = [];
    const inlineCode = findInlineCodeRanges(markdown);
    const insideInlineCode = (pos) => inlineCode.some((r) => pos > r.start && pos < r.end);
    let cursor = 0;
    while (cursor < markdown.length) {
      const start = markdown.indexOf("![", cursor);
      if (start < 0) break;
      if (insideInlineCode(start)) {
        cursor = start + 2;
        continue;
      }
      const altEnd = findMarkdownClosingBracket(markdown, start + 2);
      if (altEnd < 0 || markdown[altEnd + 1] !== "(") {
        cursor = start + 2;
        continue;
      }
      const sourceStart = altEnd + 2;
      const sourceEnd = findMarkdownClosingParen(markdown, sourceStart);
      if (sourceEnd < 0) {
        cursor = altEnd + 1;
        continue;
      }
      spans.push({
        start,
        end: sourceEnd + 1,
        alt: markdown.slice(start + 2, altEnd),
        source: markdown.slice(sourceStart, sourceEnd).trim()
      });
      cursor = sourceEnd + 1;
    }
    return spans;
  }

  function findMarkdownClosingBracket(markdown, start) {
    for (let index = start; index < markdown.length; index += 1) {
      if (markdown[index] === "]" && !isEscaped(markdown, index)) return index;
    }
    return -1;
  }

  function findMarkdownClosingParen(markdown, start) {
    let depth = 0;
    for (let index = start; index < markdown.length; index += 1) {
      const char = markdown[index];
      if (isEscaped(markdown, index)) continue;
      if (char === "(") {
        depth += 1;
        continue;
      }
      if (char !== ")") continue;
      if (depth === 0) return index;
      depth -= 1;
    }
    return -1;
  }

  function isEscaped(text, index) {
    let count = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) count += 1;
    return count % 2 === 1;
  }

  function isLikelyMarkdownImageSource(source) {
    const value = String(source || "").trim();
    return /^(?:https?:|data:|\.{0,2}\/)/i.test(value) || /\.(?:png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#]|$)/i.test(value);
  }

  function overlaps(spans, index) {
    return spans.some((span) => index >= span.start && index < span.end);
  }

  function parseTable(block) {
    const splitRow = (line) => {
      let cells = line.replace(/\\\|/g, "\0").split("|");
      if (cells[0]?.trim() === "") cells = cells.slice(1);
      if (cells[cells.length - 1]?.trim() === "") cells = cells.slice(0, -1);
      return cells.map((cell) => cell.replace(/\0/g, "|").trim());
    };

    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return null;

    const headers = splitRow(lines[0]);
    const alignmentRow = splitRow(lines[1]);
    if (!alignmentRow.every((cell) => /^:?-+:?$/.test(cell))) return null;

    const alignments = alignmentRow.map((cell) => {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right) return "center";
      return right ? "right" : "left";
    });

    const rows = lines.slice(2).map((line) => {
      const cells = splitRow(line);
      while (cells.length < headers.length) cells.push("");
      return cells.slice(0, headers.length);
    });

    return { headers, alignments, rows };
  }

  function parseTextBlocks(text) {
    const lines = text.split("\n");
    const segments = [];
    let paragraph = [];

    const flush = () => {
      const value = paragraph.join("\n").trim();
      if (value) segments.push(parseInline("unstyled", value));
      paragraph = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      let match;
      if (!trimmed) {
        flush();
        continue;
      }
      if ((match = trimmed.match(/^(#{1,6})\s+(.+)$/))) {
        flush();
        const kind = [
          "",
          "header-one",
          "header-two",
          "header-three",
          "header-four",
          "header-five",
          "header-six"
        ][match[1].length];
        segments.push(parseInline(kind, match[2].trim()));
        continue;
      }
      if ((match = trimmed.match(/^>\s+(.+)$/))) {
        flush();
        segments.push(parseInline("blockquote", match[1].trim()));
        continue;
      }
      if ((match = trimmed.match(/^[-*+]\s+(.+)$/))) {
        flush();
        segments.push(parseInline("unordered-list-item", match[1].trim()));
        continue;
      }
      if ((match = trimmed.match(/^\d+\.\s+(.+)$/))) {
        flush();
        segments.push(parseInline("ordered-list-item", match[1].trim()));
        continue;
      }
      paragraph.push(trimmed);
    }

    flush();
    return segments;
  }

  function parseInline(kind, source) {
    const result = { type: "text", kind, text: "", inlineStyleRanges: [], links: [] };
    let cursor = 0;

    const appendStyled = (text, styles) => {
      const offset = result.text.length;
      result.text += text;
      for (const style of styles) {
        result.inlineStyleRanges.push({ offset, length: text.length, style });
      }
    };

    while (cursor < source.length) {
      const char = source[cursor];

      if (char === "[") {
        const link = source.slice(cursor).match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (link) {
          const offset = result.text.length;
          result.text += link[1];
          result.links.push({ offset, length: link[1].length, url: link[2] });
          cursor += link[0].length;
          continue;
        }
      }

      const inlineRules = [
        { marker: "***", styles: ["Bold", "Italic"] },
        { marker: "**", styles: ["Bold"] },
        { marker: "~~", styles: ["Strikethrough"] }
      ];
      let matched = false;
      for (const rule of inlineRules) {
        if (!source.startsWith(rule.marker, cursor)) continue;
        const end = source.indexOf(rule.marker, cursor + rule.marker.length);
        if (end <= cursor) continue;
        appendStyled(source.slice(cursor + rule.marker.length, end), rule.styles);
        cursor = end + rule.marker.length;
        matched = true;
        break;
      }
      if (matched) continue;

      if ((char === "*" || char === "_") && source[cursor + 1] !== char) {
        const end = source.indexOf(char, cursor + 1);
        if (end > cursor && source[end + 1] !== char) {
          appendStyled(source.slice(cursor + 1, end), ["Italic"]);
          cursor = end + 1;
          continue;
        }
      }

      if (char === "`") {
        const end = source.indexOf("`", cursor + 1);
        if (end > cursor) {
          appendStyled(source.slice(cursor + 1, end), ["Code"]);
          cursor = end + 1;
          continue;
        }
      }

      result.text += char;
      cursor += 1;
    }

    return result;
  }

  function segmentCounts(segments) {
    return segments.reduce(
      (counts, segment) => {
        counts[segment.type] = (counts[segment.type] || 0) + 1;
        return counts;
      },
      { text: 0, image: 0, table: 0, tweet: 0, code: 0, divider: 0 }
    );
  }

  function applyLimits(segments, limits) {
    if (!limits) return { segments, dropped: null };

    const output = [];
    const counters = { image: 0, table: 0, tweet: 0 };
    const dropped = { images: 0, tables: 0, tweets: 0 };

    for (const segment of segments) {
      if (segment.type === "image") {
        counters.image += 1;
        if (counters.image > limits.maxImagesPerImport) {
          dropped.images += 1;
          output.push(textSegment(`![${segment.alt || ""}](${segment.source})`));
          continue;
        }
      }
      if (segment.type === "table") {
        counters.table += 1;
        if (counters.table > limits.maxTablesPerImport) {
          dropped.tables += 1;
          output.push(textSegment(tableToMarkdown(segment)));
          continue;
        }
      }
      if (segment.type === "tweet") {
        counters.tweet += 1;
        if (counters.tweet > limits.maxTweetsPerImport) {
          dropped.tweets += 1;
          output.push(textSegment(`https://twitter.com/i/web/status/${segment.tweetId}`));
          continue;
        }
      }
      output.push(segment);
    }

    // 注：applyLimits 目前无调用方（xPoster 继承下来的休眠代码）。
    // 保留并改为本项目署名，将来若接上不会挂第三方品牌。
    if (limits.appendSignature) {
      output.push(textSegment("Published with x-article-publisher"));
    }

    const hasDropped = dropped.images || dropped.tables || dropped.tweets;
    return { segments: output, dropped: hasDropped ? dropped : null };
  }

  function textSegment(text) {
    return {
      type: "text",
      kind: "unstyled",
      text,
      inlineStyleRanges: [],
      links: []
    };
  }

  function tableToMarkdown(table) {
    const lines = [];
    lines.push(`| ${table.headers.join(" | ")} |`);
    lines.push(
      `| ${table.alignments
        .map((alignment) => (alignment === "center" ? ":---:" : alignment === "right" ? "---:" : ":---"))
        .join(" | ")} |`
    );
    for (const row of table.rows) lines.push(`| ${row.join(" | ")} |`);
    return lines.join("\n");
  }

  function imageSourcesMatch(left, right) {
    const leftRaw = String(left || "").trim();
    const rightRaw = String(right || "").trim();
    if (!leftRaw || !rightRaw) return false;
    if (leftRaw === rightRaw) return true;
    try {
      const leftUrl = new URL(leftRaw, "https://xposter.local");
      const rightUrl = new URL(rightRaw, "https://xposter.local");
      leftUrl.hash = "";
      rightUrl.hash = "";
      return decodeURIComponent(leftUrl.href) === decodeURIComponent(rightUrl.href);
    } catch {
      return leftRaw.split("#")[0] === rightRaw.split("#")[0];
    }
  }

  function buildPastePlan(segments, imageResults = new Map(), tableResults = new Map(), options = {}) {
    const prefix = `__XPOSTER_${Math.random().toString(36).slice(2, 7)}_`;
    let index = 0;
    const html = [];
    const blocks = [];
    const plan = [];
    let listTag = null;
    let listItems = [];
    // 封面源：若正文里某张图就是封面，把它当 coverOnly 处理（只设封面，不留在正文）
    const coverSource = String(options.coverSource || "").trim();
    // 代码卡片图预渲染结果（segment → { ok, images }），由 payload.js 注入
    const codeResults = options.codeResults || new Map();

    const marker = (type) => `${prefix}${type}_${index++}__`;
    const addBlock = (type, text, segment = null) => {
      blocks.push({
        type: type || "unstyled",
        text: String(text ?? "").replace(/\n+/g, " "),
        inlineStyleRanges: (segment?.inlineStyleRanges || []).map((range) => ({ ...range })),
        links: (segment?.links || []).map((link) => ({ ...link }))
      });
    };
    const flushList = () => {
      if (!listTag) return;
      html.push(`<${listTag}>${listItems.map((item) => `<li>${item}</li>`).join("")}</${listTag}>`);
      listTag = null;
      listItems = [];
    };
    // MARKDOWN 原子实体：X 会把 data.markdown 按 markdown 原生渲染成代码框/表格。
    // 两个硬约定（2026-07-09 用原生「插入→代码」流程 dump 实测）：
    //   ① mutability 必须是 MUTABLE——Immutable 能过校验但渲染端丢内容；
    //   ② markdown 前后【不带】换行——带了会渲染成空行，把卡片撑出上下空白
    //     （kaitox 文档说要带换行，那是服务端载荷习惯，编辑器内部注入不适用）。
    const addMarkdownEntityOperation = (markerType, md, fallbackText) => {
      const id = marker(markerType);
      html.push(`<p>${id}</p>`);
      addBlock("unstyled", id);
      plan.push({
        marker: id,
        op: {
          type: "atomic",
          entityType: "MARKDOWN",
          data: { markdown: String(md).replace(/^\n+|\n+$/g, "") },
          mutability: "MUTABLE",
          fallbackText
        }
      });
    };
    const addImageOperation = (segment, result, { markerType = "IMAGE", coverOnly = false } = {}) => {
      const id = marker(markerType);
      html.push(`<p>${id}</p>`);
      addBlock("unstyled", id);
      plan.push({
        marker: id,
        op: {
          type: "image",
          file: {
            base64: result.base64,
            mime: result.mime,
            fileName: result.fileName,
            alt: segment.alt || ""
          },
          source: segment.source,
          fallbackText: coverOnly ? "" : imageFallbackMarkdown(segment),
          coverOnly
        }
      });
    };

    for (const segment of segments) {
      if (segment.type === "text") {
        const rendered = renderInlineHtml(segment) || "<br>";
        addBlock(segment.kind, segment.text || "", segment);
        if (segment.kind === "unordered-list-item" || segment.kind === "ordered-list-item") {
          const nextTag = segment.kind === "unordered-list-item" ? "ul" : "ol";
          if (listTag && listTag !== nextTag) flushList();
          listTag = nextTag;
          listItems.push(rendered);
          continue;
        }
        flushList();
        const tag = BLOCK_TAGS[segment.kind] || "p";
        html.push(`<${tag}>${rendered}</${tag}>`);
        continue;
      }

      flushList();

      if (segment.type === "divider") {
        const id = marker("DIVIDER");
        html.push(`<p>${id}</p>`);
        addBlock("unstyled", id);
        plan.push({
          marker: id,
          op: { type: "atomic", entityType: "DIVIDER", data: {}, mutability: "IMMUTABLE" }
        });
        continue;
      }

      if (segment.type === "code") {
        // X 编辑器没有代码块格式：优先用预渲染的代码卡片图（options.codeResults），
        // 渲染不可用时回退为 code-block 文本块（X 会显示成普通文本）
        const codeResult = codeResults.get(segment);
        if (codeResult?.ok && codeResult.images?.length) {
          const fallback = `\`\`\`${segment.language || ""}\n${segment.code || ""}\n\`\`\``;
          codeResult.images.forEach((img, i) => {
            const id = marker("CODEIMG");
            html.push(`<p>${id}</p>`);
            addBlock("unstyled", id);
            plan.push({
              marker: id,
              op: {
                type: "image",
                file: { base64: img.base64, mime: img.mime, fileName: img.fileName, alt: "code" },
                fallbackText: i === 0 ? fallback : ""
              }
            });
          });
          continue;
        }
        // 默认：原生代码框——MARKDOWN 实体，编辑器/阅读页按 markdown 渲染成代码块
        const lang = (segment.language || "plaintext").trim() || "plaintext";
        const fenced = "```" + lang + "\n" + (segment.code || "") + "\n```";
        addMarkdownEntityOperation("CODE", fenced, fenced);
        continue;
      }

      if (segment.type === "tweet") {
        const id = marker("TWEET");
        const url = `https://twitter.com/i/web/status/${segment.tweetId}`;
        html.push(`<p>${id}</p>`);
        addBlock("unstyled", id);
        plan.push({
          marker: id,
          op: {
            type: "atomic",
            entityType: "TWEET",
            // 编辑器内部字段名是 camelCase 的 tweetId（2026-07 用原生「插入→帖子」
            // 流程实测 dump 所得）；kaitox 抓包的 tweet_id 是服务端载荷格式，
            // 注入到编辑器里会在保存时被丢弃——两者不能混用。
            data: { tweetId: segment.tweetId },
            mutability: "IMMUTABLE",
            fallbackText: url
          }
        });
        continue;
      }

      if (segment.type === "image") {
        const result = imageResults.get(segment);
        if (result?.ok) {
          const isCover = coverSource && imageSourcesMatch(segment.source, coverSource);
          addImageOperation(
            segment,
            result,
            isCover ? { markerType: "COVER", coverOnly: true } : {}
          );
        } else {
          const fallback = imageFallbackMarkdown(segment);
          html.push(`<p>${escapeHtml(fallback)}</p>`);
          addBlock("unstyled", fallback);
        }
        continue;
      }

      if (segment.type === "table") {
        const result = tableResults.get(segment);
        if (result?.ok) {
          const id = marker("TABLE");
          html.push(`<p>${id}</p>`);
          addBlock("unstyled", id);
          plan.push({
            marker: id,
            op: {
              type: "image",
              file: {
                base64: result.base64,
                mime: result.mime,
                fileName: result.fileName,
                alt: "table"
              },
              fallbackText: tableToMarkdown(segment)
            }
          });
        } else {
          // 默认：原生表格——MARKDOWN 实体，X 按 markdown 渲染成表格
          addMarkdownEntityOperation("TABLE", tableToMarkdown(segment), tableToMarkdown(segment));
        }
      }
    }

    const coverResult = options.coverResult || null;
    const coverAlreadyInBody = coverSource && segments.some(
      (segment) => segment.type === "image" && imageSourcesMatch(segment.source, coverSource)
    );
    if (coverSource && coverResult?.ok && !coverAlreadyInBody) {
      addImageOperation(
        { type: "image", source: coverSource, alt: "cover" },
        coverResult,
        { markerType: "COVER", coverOnly: true }
      );
    }

    flushList();
    return { html: html.join(""), plain: blocksToPlainText(blocks), blocks, plan, markerPrefix: prefix };
  }

  function imageFallbackMarkdown(segment = {}) {
    const rawAlt = String(segment.alt || guessFileName(segment.source, "image") || "image")
      .replace(/[\]\r\n]+/g, " ")
      .trim();
    const alt = rawAlt || "image";
    const source = String(segment.source || "").trim();
    if (!source || source.startsWith("data:")) return `[image unavailable: ${alt}]`;
    return `![${alt}](${source})`;
  }

  function renderInlineHtml(segment) {
    const text = segment.text || "";
    const openAt = new Array(text.length + 1).fill(null).map(() => []);
    const closeAt = new Array(text.length + 1).fill(null).map(() => []);

    for (const range of segment.inlineStyleRanges || []) {
      const tag = STYLE_TAGS[range.style];
      if (!tag) continue;
      openAt[range.offset]?.push(`<${tag}>`);
      closeAt[range.offset + range.length]?.unshift(`</${tag}>`);
    }

    for (const link of segment.links || []) {
      const href = escapeHtml(link.url);
      openAt[link.offset]?.push(`<a href="${href}">`);
      closeAt[link.offset + link.length]?.unshift("</a>");
    }

    let output = "";
    for (let i = 0; i < text.length; i += 1) {
      output += closeAt[i].join("");
      output += openAt[i].join("");
      output += escapeHtml(text[i]);
    }
    output += closeAt[text.length].join("");
    return output;
  }

  function blocksToPlainText(blocks) {
    return blocks
      .map((block) => String(block?.text || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function isLocalImageSource(source) {
    return Boolean(
      source &&
        typeof source === "string" &&
        !/^https?:\/\//i.test(source) &&
        !source.startsWith("data:")
    );
  }

  function isAbsoluteLocalImageSource(source) {
    return /^(?:file:\/\/\/?|[a-zA-Z]:[\\/]|\/)/.test(String(source || ""));
  }

  function parseLocalImagePath(source) {
    if (isAbsoluteLocalImageSource(source)) {
      return { ok: false, error: "Absolute paths outside the selected folder are not supported", source };
    }

    const cleanPath = String(source || "")
      .replace(/\\/g, "/")
      .split(/[?#]/)[0]
      .replace(/^\.\/+/, "")
      .replace(/\/+/g, "/")
      .replace(/^\/+/, "");

    if (/^[a-zA-Z]:\//.test(cleanPath)) {
      return { ok: false, error: "Absolute paths outside the selected folder are not supported", source };
    }

    const parts = cleanPath
      .split("/")
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      })
      .filter((part) => part && part !== ".");

    if (!parts.length || parts[parts.length - 1] === "..") {
      return { ok: false, error: "Local image path is empty", source };
    }

    let depth = 0;
    for (const part of parts) {
      if (part === "..") depth -= 1;
      else depth += 1;
      if (depth < 0) return { ok: false, error: "Path escapes the selected folder", source };
    }

    return { ok: true, parts, source };
  }

  function localImageRootNames(rootNames) {
    const values = Array.isArray(rootNames) ? rootNames : [rootNames];
    return values
      .map((name) => String(name || "").trim())
      .filter(Boolean);
  }

  function localImagePathPartMatchesName(part, name) {
    return String(part || "").normalize("NFC").toLowerCase() === String(name || "").normalize("NFC").toLowerCase();
  }

  function localImagePathCandidatesFromParts(parts, rootNames = []) {
    const candidates = [];
    const seen = new Set();
    const add = (candidate) => {
      if (!candidate.length) return;
      const key = candidate.join("\0");
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(candidate);
    };

    add(parts);
    if (parts.length <= 1) return candidates;

    const names = localImageRootNames(rootNames);
    for (let index = 0; index < parts.length - 1; index += 1) {
      if (names.some((name) => localImagePathPartMatchesName(parts[index], name))) {
        add(parts.slice(index + 1));
      }
    }
    return candidates;
  }

  function localImagePathCandidates(source, rootNames = []) {
    const parsed = parseLocalImagePath(source);
    return parsed.ok ? localImagePathCandidatesFromParts(parsed.parts, rootNames) : [];
  }

  function guessFileName(source, fallback = "image") {
    if (typeof source !== "string") return `${fallback}.png`;
    if (source.startsWith("data:")) return `${fallback}.png`;
    try {
      const url = new URL(source, "https://xposter.local");
      const name = url.pathname.split("/").filter(Boolean).pop();
      return name && /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${fallback}.png`;
    } catch {
      const name = source.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).pop();
      return name && /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${fallback}.png`;
    }
  }

  function extensionMime(fileName, fallback = "image/png") {
    const ext = String(fileName || "").split(".").pop()?.toLowerCase();
    return (
      {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        bmp: "image/bmp",
        avif: "image/avif"
      }[ext] || fallback
    );
  }

  function isSupportedImageMime(mime) {
    return SUPPORTED_IMAGE_MIME_TYPES.has(String(mime || "").split(";")[0].trim().toLowerCase());
  }

  function isPrivateImageHost(hostname) {
    const host = String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
    if (!host || /^(localhost|.+\.localhost)$/i.test(host)) return true;
    if (host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;
    const parts = ipv4PartsFromHost(host);
    return parts ? isPrivateIpv4Parts(parts) : false;
  }

  function ipv4PartsFromHost(host) {
    const dotted = host.split(".").map((part) => Number(part));
    if (dotted.length === 4 && dotted.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      return dotted;
    }
    const mapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (!mapped) return null;
    const high = Number.parseInt(mapped[1], 16);
    const low = Number.parseInt(mapped[2], 16);
    if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
    return [high >> 8, high & 255, low >> 8, low & 255];
  }

  function isPrivateIpv4Parts(parts) {
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  function isRemoteHttpImageSource(source) {
    try {
      const url = new URL(String(source || "").trim());
      return (url.protocol === "https:" || url.protocol === "http:") && !isPrivateImageHost(url.hostname);
    } catch {
      return false;
    }
  }

  function base64ByteLength(base64) {
    const clean = String(base64 || "").replace(/\s+/g, "");
    const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
  }

  function validateImagePayload(mime, bytes, maxBytes = MAX_IMAGE_BYTES) {
    if (!isSupportedImageMime(mime)) return { ok: false, error: `Unsupported image type: ${mime || "unknown"}` };
    if (bytes > maxBytes) return { ok: false, error: `Image is too large (${bytes} bytes)` };
    return { ok: true };
  }

  function parseDataUri(uri, options = {}) {
    const match = String(uri || "").match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) return { ok: false, error: "Invalid data URI" };
    const mime = (match[1] || "image/png").toLowerCase();
    const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : MAX_IMAGE_BYTES;
    if (match[2]) {
      const base64 = match[3].replace(/\s+/g, "");
      const bytes = base64ByteLength(base64);
      const valid = validateImagePayload(mime, bytes, maxBytes);
      return valid.ok ? { ok: true, mime, base64, bytes } : valid;
    }
    try {
      const base64 = btoa(unescape(encodeURIComponent(decodeURIComponent(match[3]))));
      const bytes = base64ByteLength(base64);
      const valid = validateImagePayload(mime, bytes, maxBytes);
      return valid.ok ? { ok: true, mime, base64, bytes } : valid;
    } catch {
      return { ok: false, error: "Could not decode data URI" };
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let output = "";
    const chunkSize = 32768;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      output += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
    }
    return btoa(output);
  }

  async function openLocalDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(LOCAL_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(LOCAL_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveVaultHandle(handle) {
    const db = await openLocalDb();
    const store = db.transaction(LOCAL_STORE, "readwrite").objectStore(LOCAL_STORE);
    await requestToPromise(store.put({ handle, name: handle.name, savedAt: Date.now() }, VAULT_KEY));
  }

  async function getVaultRecord() {
    const db = await openLocalDb();
    const store = db.transaction(LOCAL_STORE, "readonly").objectStore(LOCAL_STORE);
    return (await requestToPromise(store.get(VAULT_KEY))) || null;
  }

  async function clearVaultHandle() {
    const db = await openLocalDb();
    const store = db.transaction(LOCAL_STORE, "readwrite").objectStore(LOCAL_STORE);
    await requestToPromise(store.delete(VAULT_KEY));
  }

  async function ensureReadPermission(handle) {
    const options = { mode: "read" };
    if (typeof handle?.queryPermission === "function" && (await handle.queryPermission(options)) === "granted") {
      return "granted";
    }
    if (typeof handle?.requestPermission === "function") return handle.requestPermission(options);
    return "denied";
  }

  async function queryReadPermission(handle) {
    if (typeof handle?.queryPermission !== "function") return "denied";
    return handle.queryPermission({ mode: "read" });
  }

  async function resolveLocalImage(source) {
    if (!isLocalImageSource(source)) return { ok: false, error: "Not a local image source" };
    const record = await getVaultRecord();
    if (!record?.handle) return { ok: false, error: "No local image folder selected" };
    if ((await queryReadPermission(record.handle)) !== "granted") {
      return { ok: false, error: "Local image folder permission expired" };
    }

    const parsedPath = parseLocalImagePath(source);
    if (!parsedPath.ok) return parsedPath;

    const candidates = localImagePathCandidatesFromParts(parsedPath.parts, [record.name, record.handle.name]);
    let lastError = null;

    for (const parts of candidates) {
      try {
        let directory = record.handle;
        for (const part of parts.slice(0, -1)) {
          if (part === "..") throw new Error("Cannot traverse above selected folder");
          directory = await directory.getDirectoryHandle(part, { create: false });
        }
        const file = await (await directory.getFileHandle(parts[parts.length - 1], { create: false })).getFile();
        const mime = file.type || extensionMime(file.name);
        const valid = validateImagePayload(mime, file.size || 0);
        if (!valid.ok) return { ...valid, source };
        const buffer = await file.arrayBuffer();
        return {
          ok: true,
          base64: arrayBufferToBase64(buffer),
          mime,
          fileName: file.name,
          bytes: buffer.byteLength,
          source
        };
      } catch (error) {
        lastError = error;
      }
    }

    return { ok: false, error: lastError?.message || "Local file not found", source };
  }

  async function renderTableImage(table, fileName = `table-${Date.now()}.png`) {
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const paddingX = 24;
    const paddingY = 16;
    const rowHeight = 42;
    const minColumnWidth = 120;
    const maxColumnWidth = 260;
    const font = "14px ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

    const measurer = document.createElement("canvas").getContext("2d");
    measurer.font = font;
    const columnCount = table.headers.length;
    const rowCount = table.rows.length + 1;
    if (columnCount * rowCount > MAX_TABLE_IMAGE_CELLS) {
      throw new Error("Table is too large to render as an image");
    }
    const widths = Array.from({ length: columnCount }, (_, index) => {
      const values = [table.headers[index], ...table.rows.map((row) => row[index] || "")];
      const measured = Math.max(...values.map((value) => measurer.measureText(String(value)).width + paddingX * 2));
      return Math.max(minColumnWidth, Math.min(maxColumnWidth, Math.ceil(measured)));
    });

    const width = widths.reduce((sum, value) => sum + value, 0);
    const height = rowHeight * rowCount;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    if (canvas.width * canvas.height > MAX_TABLE_IMAGE_PIXELS) {
      throw new Error("Table image would be too large to render");
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fbfaf7";
    ctx.fillRect(0, 0, width, height);
    ctx.font = font;
    ctx.textBaseline = "middle";

    let x = 0;
    const drawCell = (text, column, row, isHeader) => {
      const cellWidth = widths[column];
      const y = row * rowHeight;
      ctx.fillStyle = isHeader ? "#eeece6" : row % 2 ? "#fbfaf7" : "#f6f3ec";
      ctx.fillRect(x, y, cellWidth, rowHeight);
      ctx.strokeStyle = "#d8d2c6";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cellWidth, rowHeight);
      ctx.fillStyle = "#201f1b";
      ctx.font = isHeader
        ? "600 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        : font;
      const alignment = table.alignments[column] || "left";
      let textX = x + paddingX;
      ctx.textAlign = "left";
      if (alignment === "center") {
        textX = x + cellWidth / 2;
        ctx.textAlign = "center";
      } else if (alignment === "right") {
        textX = x + cellWidth - paddingX;
        ctx.textAlign = "right";
      }
      ctx.fillText(String(text), textX, y + rowHeight / 2, cellWidth - paddingX * 2);
      x += cellWidth;
    };

    x = 0;
    table.headers.forEach((header, column) => drawCell(header, column, 0, true));
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      x = 0;
      table.rows[rowIndex].forEach((cell, column) => drawCell(cell, column, rowIndex + 1, false));
    }

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Could not render table"))), "image/png");
    });
    const buffer = await blob.arrayBuffer();
    return {
      ok: true,
      base64: arrayBufferToBase64(buffer),
      mime: "image/png",
      fileName,
      bytes: buffer.byteLength
    };
  }

  const api = {
    looksLikeMarkdown,
    parseMarkdown,
    markdownTitleCandidate,
    markdownTitleCandidateFromFileName,
    segmentCounts,
    parseTweetId,
    applyLimits,
    buildPastePlan,
    escapeHtml,
    imageSourcesMatch,
    isLocalImageSource,
    isAbsoluteLocalImageSource,
    localImagePathCandidates,
    guessFileName,
    extensionMime,
    isSupportedImageMime,
    isPrivateImageHost,
    isRemoteHttpImageSource,
    parseDataUri,
    arrayBufferToBase64,
    toTraditionalChinese,
    renderTableImage,
    saveVaultHandle,
    getVaultRecord,
    clearVaultHandle,
    ensureReadPermission,
    queryReadPermission,
    resolveLocalImage
  };

  if (typeof window !== "undefined") {
    window.xPosterShared = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
