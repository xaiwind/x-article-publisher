/**
 * xpage.js — Injected into X Articles page via page.evaluate()
 * Ported from xPoster's main-world.js (MIT licensed)
 *
 * This code runs INSIDE the X page context and has full access to:
 *   - DOM / contenteditable editor
 *   - React Fiber internals (__reactFiber$ keys)
 *   - Draft.js editor state
 *   - X's internal GraphQL endpoints
 *   - X's image upload handler (onFilesAdded)
 */

window.__xArticleWrite = async function(payload) {
  const LOG = '[xArticle]';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function articleIdFromUrl() {
    return location.href.match(/\/articles\/edit\/(\d+)/)?.[1] || null;
  }

  // ── Editor Discovery ──────────────────────────────────
  function findEditorElement() {
    const sel = '[data-contents="true"] [contenteditable="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"].public-DraftEditor-content, [contenteditable="true"]';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 200 && r.height > 80) return el;
    }
    return null;
  }

  function findDraftStateNode() {
    const editor = findEditorElement();
    if (!editor) return null;
    const fiberKey = Object.keys(editor).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (!fiberKey) return null;
    let fiber = editor[fiberKey];
    for (let d = 0; d < 80 && fiber; d++) {
      if (fiber.stateNode?.props?.editorState && typeof fiber.stateNode.props.onChange === 'function') {
        return fiber.stateNode;
      }
      fiber = fiber.return;
    }
    return null;
  }

  function findOnFilesAdded() {
    const editor = findEditorElement();
    if (!editor) return null;
    const fiberKey = Object.keys(editor).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (!fiberKey) return null;
    let fiber = editor[fiberKey];
    for (let d = 0; d < 160 && fiber; d++) {
      const props = fiber.memoizedProps || fiber.stateNode?.props;
      if (typeof props?.onFilesAdded === 'function') return props.onFilesAdded;
      // Search children
      let child = fiber.child;
      for (let cd = 0; cd < 8 && child; cd++) {
        const cp = child.memoizedProps || child.stateNode?.props;
        if (typeof cp?.onFilesAdded === 'function') return cp.onFilesAdded;
        child = child.child;
      }
      fiber = fiber.return;
    }
    return null;
  }

  function findDraftSampleBlock(draftNode) {
    const blockMap = draftNode?.props?.editorState?.getCurrentContent?.()?.getBlockMap?.();
    if (!blockMap?.find) return null;
    return blockMap.find(b => {
      const cl = b.getCharacterList?.();
      if (!cl) return false;
      const size = typeof cl.size === 'number' ? cl.size : cl.count?.() || 0;
      for (let i = 0; i < size; i++) {
        const ch = cl.get?.(i);
        if (ch?.set) return true;
      }
      return false;
    }) || null;
  }

  // 全新的空 X 文章编辑器里没有任何字符，writeDraftBlocks 找不到字符样本会失败、降级成 HTML 粘贴，
  // 导致后续 marker/图片落位全乱。这里先敲一个字符让 Draft 生成真实 CharacterMetadata（xPoster 技巧）。
  // writeDraftBlocks 会用全新 blockMap 覆盖，这个临时字符块随后被丢弃，不会残留。
  async function ensureDraftCharacterSample(draftNode) {
    if (findDraftSampleBlock(draftNode)) return draftNode;
    const editor = findEditorElement();
    if (!editor) return draftNode;
    editor.focus();
    try { document.execCommand('insertText', false, 'x'); } catch {}
    const deadline = Date.now() + 1600;
    while (Date.now() < deadline) {
      await sleep(80);
      const latestNode = findDraftStateNode() || draftNode;
      if (findDraftSampleBlock(latestNode)) return latestNode;
    }
    return findDraftStateNode() || draftNode;
  }

  // ── Draft.js Content Writing ──────────────────────────
  function draftInlineStyleName(style) {
    return { Bold: 'BOLD', Italic: 'ITALIC', Strikethrough: 'STRIKETHROUGH', Code: 'CODE' }[style] || style;
  }

  function writeDraftBlocks(draftNode, blocks) {
    if (!Array.isArray(blocks) || !blocks.length) return { ok: false, error: 'No blocks' };
    const editorState = draftNode.props.editorState;
    const EditorState = editorState.constructor;
    const SelectionState = editorState.getSelection().constructor;
    let contentState = editorState.getCurrentContent();
    const blockMap = contentState.getBlockMap();
    const sampleBlock = findDraftSampleBlock(draftNode);
    if (!sampleBlock) return { ok: false, error: 'No Draft.js sample block' };

    const CharacterList = sampleBlock.getCharacterList().constructor;
    let nextBlockMap = blockMap.constructor();
    const createdKeys = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i] || {};
      const text = String(block.text || '');
      const key = Math.random().toString(36).slice(2, 7) + i.toString(36);
      let charList = CharacterList();
      const entityRanges = new Map();

      // Create link entities
      for (const link of block.links || []) {
        const off = Number(link.offset) || 0;
        const len = Math.max(0, Number(link.length) || 0);
        if (!len || !link.url) continue;
        contentState = contentState.createEntity('LINK', 'MUTABLE', { url: String(link.url) });
        entityRanges.set(`${off}:${off + len}`, contentState.getLastCreatedEntityKey());
      }

      // Build character list with styles and entities
      const sampleChars = sampleBlock.getCharacterList();
      const sampleChar = sampleChars.first?.() || sampleChars.get?.(0);
      if (!sampleChar?.set) return { ok: false, error: 'No character sample' };

      for (let ci = 0; ci < text.length; ci++) {
        const styleNames = (block.inlineStyleRanges || [])
          .filter(r => ci >= r.offset && ci < r.offset + r.length)
          .map(r => draftInlineStyleName(r.style))
          .filter(Boolean);
        let entity = null;
        for (const [range, ek] of entityRanges) {
          const [s, e] = range.split(':').map(Number);
          if (ci >= s && ci < e) { entity = ek; break; }
        }
        let style = sampleChar.getStyle().clear();
        for (const sn of styleNames) style = style.add(sn);
        charList = charList.push(sampleChar.set('style', style).set('entity', entity));
      }

      const draftType = ({
        'header-one': 'header-one', 'header-two': 'header-two', 'header-three': 'header-three',
        'header-four': 'header-four', 'header-five': 'header-five', 'header-six': 'header-six',
        blockquote: 'blockquote', 'unordered-list-item': 'unordered-list-item',
        'ordered-list-item': 'ordered-list-item', unstyled: 'unstyled', 'code-block': 'code-block'
      })[block.type] || 'unstyled';

      const nextBlock = sampleBlock.merge({
        key, type: draftType, text, characterList: charList, depth: 0,
        data: sampleBlock.getData?.()?.clear?.() || sampleBlock.getData?.()
      });
      nextBlockMap = nextBlockMap.set(key, nextBlock);
      createdKeys.push(key);
    }

    if (!createdKeys.length) return { ok: false, error: 'No blocks created' };
    const lastKey = createdKeys[createdKeys.length - 1];
    const selection = SelectionState.createEmpty(lastKey);
    const nextContent = contentState
      .set('blockMap', nextBlockMap)
      .set('selectionBefore', selection)
      .set('selectionAfter', selection);
    let nextState = EditorState.push(editorState, nextContent, 'insert-fragment');
    nextState = EditorState.moveSelectionToEnd(nextState);
    draftNode.props.onChange(nextState);
    return { ok: true, blocks: createdKeys.length };
  }

  // ── Markers ───────────────────────────────────────────
  function markerTokenPattern(prefix) {
    const p = String(prefix || '__XPOSTER_').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(p + '[A-Z]+_\\d+__', 'g');
  }

  // 兜底：匹配任意 session id 的 marker（__XPOSTER_<id>_<TYPE>_<n>__），
  // 防止 markerPrefix 传递异常时漏掉封面等未经 replaceMarkerText 精确清理的 marker
  function allMarkerTokenPattern() {
    return /__XPOSTER_[A-Za-z0-9]+_[A-Z]+_\d+__/g;
  }

  // 统计正文里还残留多少 marker（用于多轮清理判断是否收敛）
  function countRemainingMarkers(draftNode) {
    try {
      const cs = draftNode.props.editorState.getCurrentContent();
      let n = 0;
      cs.getBlockMap().forEach((block) => {
        if (block.getType() === 'atomic') return;
        const m = (block.getText() || '').match(allMarkerTokenPattern());
        if (m) n += m.length;
      });
      return n;
    } catch (e) { return 0; }
  }

  function findMarkerLocation(contentState, marker) {
    const needle = String(marker || '');
    if (!needle) return null;
    let best = null;
    contentState.getBlockMap().forEach((block, key) => {
      if (block.getType() === 'atomic') return;
      const text = block.getText() || '';
      const off = text.indexOf(needle);
      if (off < 0) return;
      const candidate = { blockKey: key, offset: off, length: needle.length, exact: text.trim() === needle };
      if (candidate.exact && !best) best = candidate;
      else if (!best) best = candidate;
    });
    return best;
  }

  function replaceMarkerText(draftNode, marker, text) {
    const editorState = draftNode.props.editorState;
    const EditorState = editorState.constructor;
    const SelectionState = editorState.getSelection().constructor;
    const contentState = editorState.getCurrentContent();
    const blockMap = contentState.getBlockMap();
    const loc = findMarkerLocation(contentState, marker);
    if (!loc) return false;
    const block = blockMap.get(loc.blockKey);
    const replacement = String(text || '');
    const curText = block.getText() || '';
    const nextText = loc.exact ? replacement :
      curText.slice(0, loc.offset) + replacement + curText.slice(loc.offset + loc.length);
    if (!nextText.trim()) {
      // Delete block
      const nextBM = blockMap.delete(loc.blockKey);
      const lastKey = nextBM.last()?.getKey?.();
      const sel = lastKey ? SelectionState.createEmpty(lastKey) : editorState.getSelection();
      const nc = contentState.set('blockMap', nextBM).set('selectionBefore', sel).set('selectionAfter', sel);
      let ns = EditorState.push(editorState, nc, 'remove-range');
      ns = EditorState.moveSelectionToEnd(ns);
      draftNode.props.onChange(ns);
      return true;
    }
    const sampleChar = block.getCharacterList().first?.() || block.getCharacterList().get?.(0);
    const ch = sampleChar?.constructor ? sampleChar.constructor.create({}) : null;
    const chList = block.getCharacterList().clear().concat(Array(nextText.length).fill(ch));
    const nb = block.merge({ text: nextText, characterList: chList });
    const sel = SelectionState.createEmpty(loc.blockKey);
    const nc = contentState.set('blockMap', blockMap.set(loc.blockKey, nb))
      .set('selectionBefore', sel).set('selectionAfter', sel);
    draftNode.props.onChange(EditorState.push(editorState, nc, 'change-block-data'));
    return true;
  }

  // 注意：contentState 由调用方传入并串联——批量插入时后一个操作必须基于前一个的结果，
  // 不能每次都从 props.editorState 重新取（onChange 只在批末调用一次，中途 props 是旧的）
  function replaceMarkerWithAtomic(draftNode, contentState, marker, entityType, data, mutability) {
    const sampleBlock = findDraftSampleBlock(draftNode);
    const blockKey = findMarkerLocation(contentState, marker)?.blockKey;
    if (!blockKey) return { ok: false, error: `Marker not found: ${marker}`, contentState };

    const block = contentState.getBlockMap().get(blockKey) || sampleBlock;
    const sampleChars = block.getCharacterList();
    const sampleChar = sampleChars.first?.() || sampleChars.get?.(0);
    if (!sampleChar?.set) return { ok: false, error: 'No character sample', contentState };

    const withEntity = contentState.createEntity(entityType, mutability || 'IMMUTABLE', data || {});
    const entityKey = withEntity.getLastCreatedEntityKey();
    const character = sampleChar.set('entity', entityKey);
    const CharacterList = sampleChars.constructor;
    const atomicBlock = block.merge({
      key: blockKey, type: 'atomic', text: ' ',
      characterList: CharacterList([character]), depth: 0
    });
    const blockMap = withEntity.getBlockMap().set(blockKey, atomicBlock);
    return { ok: true, entityKey, contentState: withEntity.set('blockMap', blockMap) };
  }

  function insertAtomicBatch(draftNode, operations) {
    if (!operations.length) return { ok: 0, fail: 0, errors: [], failed: [] };
    const editorState = draftNode.props.editorState;
    const EditorState = editorState.constructor;
    const SelectionState = editorState.getSelection().constructor;
    let contentState = editorState.getCurrentContent();
    let ok = 0, errors = [], failed = [];

    for (const item of operations) {
      const r = replaceMarkerWithAtomic(draftNode, contentState, item.marker, item.op.entityType, item.op.data || {}, item.op.mutability || 'IMMUTABLE');
      if (r.ok) { contentState = r.contentState; ok++; }
      else { errors.push(r.error); failed.push(item); }
    }

    if (ok > 0) {
      const lastKey = contentState.getBlockMap().last().getKey();
      const sel = SelectionState.createEmpty(lastKey);
      const nc = contentState.set('selectionBefore', sel).set('selectionAfter', sel);
      let ns = EditorState.push(editorState, nc, 'insert-fragment');
      ns = EditorState.moveSelectionToEnd(ns);
      draftNode.props.onChange(ns);
    }
    return { ok, fail: errors.length, errors, failed };
  }

  function cleanupMarkers(draftNode, markerPrefix) {
    const prefix = String(markerPrefix || '__XPOSTER_');
    const editorState = draftNode.props.editorState;
    const EditorState = editorState.constructor;
    const SelectionState = editorState.getSelection().constructor;
    const contentState = editorState.getCurrentContent();
    let blockMap = contentState.getBlockMap();
    const toDelete = [];
    const replacements = [];
    const mp = markerTokenPattern(prefix);

    blockMap.forEach((block, key) => {
      if (block.getType() === 'atomic') return;
      const text = block.getText() || '';
      if (!text.includes('__XPOSTER_')) return;
      const cleaned = text
        .replace(mp, '')
        .replace(allMarkerTokenPattern(), '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (!cleaned) toDelete.push(key);
      else if (cleaned !== text) replacements.push({ key, text: cleaned });
    });

    if (!toDelete.length && !replacements.length) return 0;

    for (const r of replacements) {
      const block = blockMap.get(r.key);
      if (!block) continue;
      const sampleChar = block.getCharacterList().first?.() || block.getCharacterList().get?.(0);
      const ch = sampleChar?.constructor ? sampleChar.constructor.create({}) : null;
      const chList = block.getCharacterList().clear().concat(Array(r.text.length).fill(ch));
      blockMap = blockMap.set(r.key, block.merge({ text: r.text, characterList: chList }));
    }
    for (const key of toDelete) blockMap = blockMap.delete(key);

    const lastKey = blockMap.last()?.getKey?.();
    const sel = lastKey ? SelectionState.createEmpty(lastKey) : editorState.getSelection();
    const nc = contentState.set('blockMap', blockMap).set('selectionBefore', sel).set('selectionAfter', sel);
    let ns = EditorState.push(editorState, nc, 'remove-range');
    ns = EditorState.moveSelectionToEnd(ns);
    draftNode.props.onChange(ns);
    return toDelete.length + replacements.length;
  }

  // ── Image Upload ──────────────────────────────────────
  function base64ToFile(b64, fileName, mime) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], fileName, { type: mime });
  }

  // ── Place cursor at marker before upload (xPoster technique) ──
  function placeSelectionAtMarker(draftNode, marker) {
    const editorState = draftNode.props.editorState;
    const SelectionState = editorState.getSelection().constructor;
    const EditorState = editorState.constructor;
    const contentState = editorState.getCurrentContent();
    const location = findMarkerLocation(contentState, marker);
    if (!location) return null;
    const selection = SelectionState.createEmpty(location.blockKey).merge({
      anchorOffset: location.offset,
      focusOffset: location.offset
    });
    draftNode.props.onChange(EditorState.forceSelection(editorState, selection));
    return location;
  }

  async function uploadSingleImage(draftNode, imagePayload, marker, index, total) {
    const onFilesAdded = findOnFilesAdded();
    if (!onFilesAdded) return { ok: false, error: 'X upload handler not found' };

    // Place cursor at marker — X's onFilesAdded inserts at cursor position
    const markerLoc = placeSelectionAtMarker(draftNode, marker);
    if (!markerLoc) return { ok: false, error: 'Marker not found in editor' };
    await sleep(80);

    let file;
    try {
      file = base64ToFile(imagePayload.base64, imagePayload.fileName, imagePayload.mime);
    } catch (e) {
      return { ok: false, error: `Invalid base64: ${e.message}` };
    }

    // Get existing atomic blocks before upload (to detect new ones)
    const before = new Set();
    draftNode.props.editorState.getCurrentContent().getBlockMap().forEach((block, key) => {
      if (block.getType() === 'atomic') before.add(key);
    });

    // Upload — image lands at marker position
    try { onFilesAdded([file]); } catch (e) {
      return { ok: false, error: `Upload call failed: ${e.message}` };
    }

    // Wait for the upload to complete (new atomic block appears)
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      await sleep(500);
      draftNode = findDraftStateNode() || draftNode;
      if (!draftNode) continue;
      const contentState = draftNode.props.editorState.getCurrentContent();
      // 收集本次上传后新增的所有 atomic 块（X 异步处理上一张图时可能同时冒出多个新块）
      const keyList = [];
      const candidates = [];
      contentState.getBlockMap().forEach((block, key) => {
        keyList.push(key);
        if (block.getType() === 'atomic' && !before.has(key)) candidates.push(key);
      });
      let newBlock = null;
      if (candidates.length) {
        // 图片是在 marker 光标处插入的，所以选"块顺序上离 marker 最近"的新块，避免抓到上一张图异步重排出来的块
        let chosen = candidates[0];
        const markerIdx = markerLoc ? keyList.indexOf(markerLoc.blockKey) : -1;
        if (markerIdx >= 0 && candidates.length > 1) {
          let best = Infinity;
          for (const k of candidates) {
            const d = Math.abs(keyList.indexOf(k) - markerIdx);
            if (d < best) { best = d; chosen = k; }
          }
        }
        newBlock = { blockKey: chosen, block: contentState.getBlockMap().get(chosen) };
      }
      if (newBlock) {
        let mediaId = null, entityKey = null;
        try {
          newBlock.block.findEntityRanges(
            (ch) => Boolean(ch.getEntity()),
            (start) => { entityKey = newBlock.block.getCharacterList().get(start)?.getEntity?.(); }
          );
          if (entityKey) {
            const entity = contentState.getEntity(entityKey);
            const data = entity.getData();
            const searchForId = (d, depth) => {
              if (depth > 5 || d == null) return null;
              if (typeof d === 'string' && /^\d+$/.test(d.trim())) return d.trim();
              if (typeof d !== 'object') return null;
              const keys = ['mediaId', 'media_id', 'media_id_string', 'id_str', 'id'];
              for (const k of keys) { if (d[k] && /^\d+/.test(String(d[k]))) return String(d[k]); }
              for (const v of Object.values(d)) { const r = searchForId(v, depth + 1); if (r) return r; }
              return null;
            };
            mediaId = searchForId(data, 0);
          }
        } catch (e) { /* best-effort */ }
        return {
          ok: true,
          blockKey: newBlock.blockKey,
          entityKey,
          mediaId,
          markerBlock: markerLoc.blockKey,
          markerOffset: markerLoc.offset,
          markerLength: markerLoc.length,
          markerExact: markerLoc.exact
        };
      }
    }
    return { ok: false, error: 'Upload timed out waiting for media entity' };
  }

  // ── Block deletion by key ─────────────────────────────
  function deleteBlockByKey(draftNode, blockKey) {
    if (!blockKey) return { ok: false, error: 'Missing block key' };
    const editorState = draftNode.props.editorState;
    const EditorState = editorState.constructor;
    const SelectionState = editorState.getSelection().constructor;
    const contentState = editorState.getCurrentContent();
    const blockMap = contentState.getBlockMap();
    if (!blockMap.has(blockKey)) return { ok: false, error: 'Block not found' };
    const nextBlockMap = blockMap.delete(blockKey);
    const lastKey = nextBlockMap.last()?.getKey?.();
    const selection = lastKey ? SelectionState.createEmpty(lastKey) : editorState.getSelection();
    const nextContent = contentState
      .set('blockMap', nextBlockMap)
      .set('selectionBefore', selection)
      .set('selectionAfter', selection);
    let ns = EditorState.push(editorState, nextContent, 'remove-range');
    ns = EditorState.moveSelectionToEnd(ns);
    draftNode.props.onChange(ns);
    return { ok: true };
  }

  // 重新定位某张已上传图片对应的 atomic 媒体块：优先 blockKey，失效则按 entityKey / mediaId 兜底
  // （X 完成上传后可能给块换 key，导致缓存的 blockKey 失效）
  function findMediaBlockKey(draftNode, upload) {
    const contentState = draftNode.props.editorState.getCurrentContent();
    const blockMap = contentState.getBlockMap();
    if (upload.blockKey && blockMap.has(upload.blockKey)) return upload.blockKey;
    let found = null;
    blockMap.forEach((block, key) => {
      if (found || block.getType() !== 'atomic') return;
      block.findEntityRanges(
        (ch) => Boolean(ch.getEntity()),
        (start) => {
          if (found) return;
          const ek = block.getCharacterList().get(start)?.getEntity?.();
          if (!ek) return;
          if (upload.entityKey && ek === upload.entityKey) { found = key; return; }
          if (upload.mediaId) {
            try {
              const data = contentState.getEntity(ek).getData();
              if (JSON.stringify(data || {}).includes(String(upload.mediaId))) found = key;
            } catch {}
          }
        }
      );
    });
    return found;
  }

  // ── Image Relocation (xPoster: 把上传的图片 atomic 块搬到 marker 位置) ──
  function relocateImages(draftNode, uploads, protectedAtomicBlocks) {
    if (!uploads.length) return { moved: 0, missing: 0 };
    const editorState = draftNode.props.editorState;
    const EditorState = editorState.constructor;
    const SelectionState = editorState.getSelection().constructor;
    const contentState = editorState.getCurrentContent();
    const blockMap = contentState.getBlockMap();
    const entityToBlock = new Map();
    const mediaBlocks = [];

    // 重新定位 marker（块可能因前面的搬运/清理而变化）
    for (const upload of uploads) {
      if (upload.markerBlock && blockMap.has(upload.markerBlock)) continue;
      const loc = findMarkerLocation(contentState, upload.marker);
      if (loc) {
        upload.markerBlock = loc.blockKey;
        upload.markerOffset = loc.offset;
        upload.markerLength = loc.length;
        upload.markerExact = loc.exact;
      }
    }

    // 收集所有"非受保护"的 MEDIA atomic 块（受保护的是推文/代码/分割线等）
    blockMap.forEach((block, blockKey) => {
      if (block.getType() !== 'atomic') return;
      let firstEntity = null;
      block.findEntityRanges(
        (ch) => Boolean(ch.getEntity()),
        (start) => {
          const ek = block.getCharacterList().get(start)?.getEntity?.();
          if (ek) {
            firstEntity = firstEntity || ek;
            entityToBlock.set(ek, blockKey);
          }
        }
      );
      if (protectedAtomicBlocks && protectedAtomicBlocks.has(blockKey)) return;
      if (firstEntity) {
        try {
          if (contentState.getEntity(firstEntity).getType() === 'MEDIA') {
            mediaBlocks.push({ blockKey, entityKey: firstEntity });
          }
        } catch {}
      }
    });

    const moves = new Map();
    let missing = 0;
    let fallbackIndex = 0;

    for (const upload of uploads) {
      if (!upload.markerBlock || !blockMap.has(upload.markerBlock)) { missing++; continue; }
      let imageBlock = upload.blockKey && blockMap.has(upload.blockKey) ? upload.blockKey : null;
      if (!imageBlock && upload.entityKey) imageBlock = entityToBlock.get(upload.entityKey) || null;
      if (!imageBlock) {
        while (fallbackIndex < mediaBlocks.length && moves.has(mediaBlocks[fallbackIndex].blockKey)) fallbackIndex++;
        imageBlock = mediaBlocks[fallbackIndex]?.blockKey || null;
        fallbackIndex++;
      }
      if (!imageBlock) { missing++; continue; }
      if (imageBlock !== upload.markerBlock) {
        moves.set(upload.markerBlock, { imageBlock, markerExact: upload.markerExact !== false });
      }
    }

    if (!moves.size) return { moved: 0, missing };

    const destinationBlocks = new Set(Array.from(moves.values()).map((m) => m.imageBlock));
    const orderedKeys = [];
    blockMap.forEach((block, key) => {
      if (moves.has(key)) {
        const move = moves.get(key);
        if (move.markerExact) {
          orderedKeys.push(move.imageBlock);
        } else {
          orderedKeys.push(move.imageBlock);
          orderedKeys.push(key);
        }
      } else if (!destinationBlocks.has(key)) {
        orderedKeys.push(key);
      }
    });

    let nextBM = blockMap.constructor();
    for (const k of orderedKeys) nextBM = nextBM.set(k, blockMap.get(k));
    const sel = SelectionState.createEmpty(orderedKeys[orderedKeys.length - 1]);
    const nc = contentState.set('blockMap', nextBM).set('selectionBefore', sel).set('selectionAfter', sel);
    let ns = EditorState.push(editorState, nc, 'remove-range');
    ns = EditorState.moveSelectionToEnd(ns);
    draftNode.props.onChange(ns);
    return { moved: moves.size, missing };
  }

  // 每张图上传后：先把图片块搬到 marker 处，再清掉 marker 文本（xPoster 流程）
  async function settleUploadedImageAtMarker(draftNode, upload, protectedAtomicBlocks) {
    if (!upload || upload.coverOnly) {
      return { draftNode, moved: 0, missing: 0, markerCleaned: 0 };
    }
    const relocateResult = relocateImages(draftNode, [upload], protectedAtomicBlocks);
    if (relocateResult.moved || relocateResult.missing) {
      await sleep(180);
      draftNode = findDraftStateNode() || draftNode;
    }
    const markerCleaned = relocateResult.missing ? 0 : Number(replaceMarkerText(draftNode, upload.marker, ''));
    if (markerCleaned) {
      await sleep(120);
      draftNode = findDraftStateNode() || draftNode;
    }
    return { draftNode, moved: relocateResult.moved, missing: relocateResult.missing, markerCleaned };
  }

  // ── Title & Cover ─────────────────────────────────────
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function csrfToken() {
    return document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/)?.[1] || '';
  }

  async function xGraphql(queryId, operationName, body) {
    const resp = await fetch(`https://x.com/i/api/graphql/${queryId}/${operationName}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-csrf-token': csrfToken(),
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session'
      },
      body: JSON.stringify(body)
    });
    let text = '';
    try { text = await resp.text(); } catch {}
    return { ok: resp.ok, status: resp.status, body: text.slice(0, 300) };
  }

  async function setTitleViaUi(title) {
    if (!title) return { ok: true, skipped: true };
    const editor = findEditorElement();
    const candidates = Array.from(document.querySelectorAll("input[type='text'], textarea, [contenteditable='true']"))
      .filter(el => el !== editor && isVisible(el));
    const titleWords = ['title', '标题', 'add title', '输入标题'];
    let best = null, score = -1;
    for (const el of candidates) {
      const haystack = [el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('data-testid')]
        .filter(Boolean).join(' ').toLowerCase();
      const rect = el.getBoundingClientRect();
      let s = 0;
      if (titleWords.some(w => haystack.includes(w))) s += 10;
      if (rect.top < 420) s += 3;
      if (rect.width > 240) s += 2;
      if (s > score) { score = s; best = el; }
    }
    if (!best || score <= 0) return { ok: false, error: 'Title field not found' };

    if (best instanceof HTMLInputElement || best instanceof HTMLTextAreaElement) {
      const proto = best instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(best, String(title));
      best.dispatchEvent(new Event('input', { bubbles: true }));
      best.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      best.focus();
      await sleep(80);
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, String(title));
      best.dispatchEvent(new Event('input', { bubbles: true }));
      best.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return { ok: true };
  }

  async function updateTitleGraphql(articleId, title) {
    return xGraphql('x75E2ABzm8_mGTg1bz8hcA', 'ArticleEntityUpdateTitle', {
      variables: { articleEntityId: articleId, title: String(title) },
      features: {
        profile_label_improvements_pcf_label_in_post_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true
      },
      queryId: 'x75E2ABzm8_mGTg1bz8hcA'
    });
  }

  async function updateCoverGraphql(articleId, mediaId) {
    return xGraphql('Es8InPh7mEkK9PxclxFAVQ', 'ArticleEntityUpdateCoverMedia', {
      variables: {
        articleEntityId: articleId,
        coverMedia: { media_id: String(mediaId), media_category: 'DraftTweetImage' }
      },
      features: {
        profile_label_improvements_pcf_label_in_post_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true
      },
      queryId: 'Es8InPh7mEkK9PxclxFAVQ'
    });
  }

  // ── Main Flow ─────────────────────────────────────────
  async function runFlow(p) {
    let draftNode = findDraftStateNode();
    if (!draftNode) return { ok: false, error: 'Draft.js editor not found. Are you on an X Article edit page?' };

    let articleId = p.articleId || articleIdFromUrl();
    const summary = {
      atomicOk: 0, atomicFail: 0,
      imgOk: 0, imgFail: 0,
      markersCleaned: 0, relocatedImages: 0,
      title: { requested: !!p.title, value: p.title || null, ui: null, graphql: null },
      cover: { requested: !!p.cover, source: p.cover || null, graphql: null }
    };

    try {
      // ── Title ──
      if (p.title) {
        console.log(LOG, 'Setting title...');
        const tr = await setTitleViaUi(p.title);
        summary.title.ui = tr;
        if (articleId) {
          const gr = await updateTitleGraphql(articleId, p.title);
          summary.title.graphql = gr;
        }
      }

      // ── Write blocks ──
      console.log(LOG, 'Writing content blocks...');
      // 空编辑器先造出字符样本，否则 writeDraftBlocks 必失败、降级 HTML 粘贴导致图片落位错乱
      draftNode = await ensureDraftCharacterSample(draftNode) || draftNode;
      const wr = writeDraftBlocks(draftNode, p.blocks);
      if (!wr.ok) {
        // Fallback: paste HTML
        console.log(LOG, 'Block write failed, trying HTML paste...');
        const editor = findEditorElement();
        if (editor) {
          editor.focus();
          const dt = new DataTransfer();
          dt.setData('text/html', p.html);
          dt.setData('text/plain', p.plain);
          const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
          if (ev.clipboardData !== dt) Object.defineProperty(ev, 'clipboardData', { value: dt });
          editor.dispatchEvent(ev);
        }
      }
      await sleep(500);
      draftNode = findDraftStateNode() || draftNode;

      // ── Atomic blocks (tweets, code, dividers) ──
      const atomicOps = (p.plan || []).filter(item => item.op.type === 'atomic');
      if (atomicOps.length) {
        console.log(LOG, `Inserting ${atomicOps.length} atomic blocks...`);
        draftNode = findDraftStateNode() || draftNode;
        const ar = insertAtomicBatch(draftNode, atomicOps);
        summary.atomicOk = ar.ok;
        summary.atomicFail = ar.fail;
        if (ar.fail) summary.atomicErrors = ar.errors;
        await sleep(350);
        // 插入失败的原子块（代码/表格/推文）降级为文本，内容不能丢
        for (const item of ar.failed || []) {
          if (!item.op.fallbackText) continue;
          draftNode = findDraftStateNode() || draftNode;
          replaceMarkerText(draftNode, item.marker, item.op.fallbackText);
          await sleep(120);
        }
      }

      // 受保护的 atomic 块（推文/代码/分割线等），relocate 时不能把它们当图片搬运
      draftNode = findDraftStateNode() || draftNode;
      const protectedAtomicBlocks = new Set();
      draftNode.props.editorState.getCurrentContent().getBlockMap().forEach((block, key) => {
        if (block.getType() === 'atomic') protectedAtomicBlocks.add(key);
      });

      // ── Images ──
      const imageOps = (p.plan || []).filter(item => item.op.type === 'image');
      const uploads = [];
      let coverUpload = null;

      for (let i = 0; i < imageOps.length; i++) {
        const op = imageOps[i];
        const imgPayload = (p.images || []).find(ip => ip.marker === op.marker);
        if (!imgPayload) {
          summary.imgFail++;
          replaceMarkerText(draftNode, op.marker, op.op.fallbackText || '[image unavailable]');
          continue;
        }

        console.log(LOG, `Uploading image ${i + 1}/${imageOps.length}...`);
        draftNode = findDraftStateNode() || draftNode;
        const ur = await uploadSingleImage(draftNode, imgPayload, op.marker, i + 1, imageOps.length);

        if (ur.ok) {
          summary.imgOk++;
          const upload = {
            marker: op.marker,
            blockKey: ur.blockKey,
            entityKey: ur.entityKey,
            markerBlock: ur.markerBlock,
            markerOffset: ur.markerOffset,
            markerLength: ur.markerLength,
            markerExact: ur.markerExact,
            mediaId: ur.mediaId,
            source: imgPayload.source,
            coverOnly: !!imgPayload.coverOnly,
            settled: !!imgPayload.coverOnly
          };
          uploads.push(upload);

          // 关键：把刚上传的图片块搬到 marker 位置，再清掉 marker（xPoster 流程）
          if (!upload.coverOnly) {
            const settleResult = await settleUploadedImageAtMarker(draftNode, upload, protectedAtomicBlocks);
            draftNode = settleResult.draftNode;
            summary.relocatedImages = (summary.relocatedImages || 0) + settleResult.moved;
            summary.markersCleaned += settleResult.markerCleaned;
            upload.settled = !settleResult.missing;
          }

          if (imgPayload.coverOnly && !coverUpload) coverUpload = upload;
          // 封面图块加入受保护集合，避免被后续 body 图片的 relocate 当成备用目标误搬
          if (upload.coverOnly && upload.blockKey) protectedAtomicBlocks.add(upload.blockKey);

          // 命中封面 → 设置封面
          if (p.cover && upload.source && imageSourcesMatch(upload.source, p.cover) && upload.mediaId && articleId && !summary.cover.graphql) {
            coverUpload = upload;
            const cr = await updateCoverGraphql(articleId, upload.mediaId);
            summary.cover.graphql = cr;
          }
        } else {
          summary.imgFail++;
          replaceMarkerText(draftNode, op.marker, imgPayload.fallbackText || (imgPayload.coverOnly ? '' : '[image upload failed]'));
        }
        draftNode = findDraftStateNode() || draftNode;
      }

      // ── 兜底：对没 settle 成功的图片再批量 relocate 一次 ──
      const unsettledUploads = uploads.filter((u) => !u.coverOnly && !u.settled);
      if (unsettledUploads.length) {
        console.log(LOG, `Reordering ${unsettledUploads.length} remaining image(s)...`);
        await sleep(900);
        draftNode = findDraftStateNode() || draftNode;
        const rr = relocateImages(draftNode, unsettledUploads, protectedAtomicBlocks);
        summary.relocatedImages = (summary.relocatedImages || 0) + rr.moved;
        await sleep(400);
      }

      // ── 封面专用图片：从正文删除图片块 + 清掉封面 marker（封面只走 GraphQL，不该出现在正文） ──
      // X 的图片上传是异步的，删早了会被重新插回，所以这里多轮重试；整体 try/catch 隔离，
      // 绝不能让封面清理的异常带崩后面的 marker 清理。
      if (coverUpload?.coverOnly) {
        try {
          let deleted = false;
          for (let attempt = 0; attempt < 4; attempt++) {
            await sleep(attempt === 0 ? 700 : 600);
            draftNode = findDraftStateNode() || draftNode;
            const coverBlockKey = findMediaBlockKey(draftNode, coverUpload);
            if (coverBlockKey) {
              const del = deleteBlockByKey(draftNode, coverBlockKey);
              summary.cover.bodyBlockDeleted = del;
              draftNode = findDraftStateNode() || draftNode;
              if (del.ok) deleted = true;
            } else if (deleted) {
              // 已删且不再出现 → 稳定，收工
              break;
            } else {
              summary.cover.bodyBlockDeleted = { ok: false, error: 'cover media block not found' };
            }
          }
        } catch (e) {
          summary.cover.bodyBlockDeleted = { ok: false, error: 'cover cleanup threw: ' + (e?.message || e) };
        }
        // 显式按精确字符串清掉封面 marker（兜底，不依赖 cleanupMarkers 的前缀匹配）
        try {
          if (coverUpload.marker) {
            draftNode = findDraftStateNode() || draftNode;
            replaceMarkerText(draftNode, coverUpload.marker, '');
            draftNode = findDraftStateNode() || draftNode;
          }
        } catch (e) { /* 交给最终 cleanupMarkers 兜底 */ }
      }

      // ── Cleanup markers（多轮兜底）──
      // X 的图片上传是异步的，单次清理后回调可能把 marker / 封面块改回来（限流时尤其明显），
      // 所以这里多轮重试：每轮清 marker + 再删一次可能被重新插回的封面块，直到收敛或轮次用尽。
      console.log(LOG, 'Cleaning markers (multi-pass)...');
      for (let pass = 0; pass < 6; pass++) {
        try {
          draftNode = findDraftStateNode() || draftNode;
          summary.markersCleaned += cleanupMarkers(draftNode, p.markerPrefix);

          // 封面块若被重新插回正文，再删
          if (coverUpload?.coverOnly) {
            draftNode = findDraftStateNode() || draftNode;
            const ck = findMediaBlockKey(draftNode, coverUpload);
            if (ck) {
              const del = deleteBlockByKey(draftNode, ck);
              if (del.ok) summary.cover.bodyBlockDeleted = del;
            }
          }

          await sleep(450);
          draftNode = findDraftStateNode() || draftNode;
          const remaining = countRemainingMarkers(draftNode);
          const coverStillInBody = coverUpload?.coverOnly ? !!findMediaBlockKey(findDraftStateNode() || draftNode, coverUpload) : false;
          if (remaining === 0 && !coverStillInBody) break;
          console.log(LOG, `pass ${pass + 1}: ${remaining} marker(s) left, coverInBody=${coverStillInBody}`);
        } catch (e) { console.warn(LOG, 'cleanup pass failed', e); break; }
      }

      return { ok: true, summary };

    } catch (error) {
      console.error(LOG, error);
      // Try to cleanup markers even on error
      try {
        draftNode = findDraftStateNode();
        if (draftNode) cleanupMarkers(draftNode, p.markerPrefix);
      } catch {}
      return { ok: false, error: error.message, stack: error.stack, summary };
    }
  }

  function imageSourcesMatch(left, right) {
    const l = String(left || '').trim(), r = String(right || '').trim();
    if (!l || !r) return false;
    if (l === r) return true;
    try {
      const lu = new URL(l, location.href), ru = new URL(r, location.href);
      lu.hash = ''; ru.hash = '';
      return decodeURIComponent(lu.href) === decodeURIComponent(ru.href);
    } catch { return l.split('#')[0] === r.split('#')[0]; }
  }

  // 暴露事后清理入口：注入完成后若 X 异步回调又把 marker 插回来，外部可再清一轮
  window.__xCleanupMarkers = () => {
    const dn = findDraftStateNode();
    return dn ? cleanupMarkers(dn, payload.markerPrefix || '__XPOSTER_') : 0;
  };

  console.log(LOG, 'Engine loaded');
  return await runFlow(payload);
};

console.log('[xArticle] Injection complete — window.__xArticleWrite ready');
