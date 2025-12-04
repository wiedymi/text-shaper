import "./chunk-BUSYA2B4.js";

// src/aat/state-machine.ts
var CLASS_END_OF_TEXT = 0;
var CLASS_OUT_OF_BOUNDS = 1;
function getGlyphClass(classTable, glyphId) {
  if (glyphId < 0 || glyphId >= classTable.classArray.length) {
    return CLASS_OUT_OF_BOUNDS;
  }
  return classTable.classArray[glyphId] ?? CLASS_OUT_OF_BOUNDS;
}
function processRearrangement(subtable, infos) {
  const { stateTable } = subtable;
  let state = 0;
  let markFirst = 0;
  let markLast = 0;
  for (let i = 0; i <= infos.length; i++) {
    const isEnd = i >= infos.length;
    const glyphClass = isEnd ? CLASS_END_OF_TEXT : getGlyphClass(stateTable.classTable, infos[i]?.glyphId);
    const stateRow = stateTable.stateArray[state];
    if (!stateRow) break;
    const entry = stateRow[glyphClass];
    if (!entry) break;
    const flags = entry.flags;
    if (flags & 32768) {
      markFirst = i;
    }
    if (flags & 8192) {
      markLast = i;
    }
    const verb = flags & 15;
    if (verb !== 0 && markFirst <= markLast && markLast < infos.length) {
      rearrangeGlyphs(infos, markFirst, markLast, verb);
    }
    if (!(flags & 16384)) {
    }
    state = entry.newState;
  }
}
function rearrangeGlyphs(infos, first, last, verb) {
  if (first >= last || first >= infos.length || last >= infos.length) return;
  const a = infos[first];
  const b = infos[first + 1];
  const c = infos[last - 1];
  const d = infos[last];
  if (!a || !d) return;
  switch (verb) {
    case 1:
      if (b) {
        infos[first] = b;
        infos[first + 1] = a;
      }
      break;
    case 2:
      if (c) {
        infos[last] = c;
        infos[last - 1] = d;
      }
      break;
    case 3:
      infos[first] = d;
      infos[last] = a;
      break;
    case 4:
      if (b && c) {
        const temp = infos.slice(first, first + 2);
        const [tempFirst, tempSecond] = temp;
        const thirdItem = infos[first + 2];
        if (tempFirst && tempSecond && thirdItem) {
          infos[first] = thirdItem;
          infos[first + 1] = tempFirst;
          infos[first + 2] = tempSecond;
        }
      }
      break;
    case 5:
      if (b && c) {
        const temp = infos.slice(first, first + 2);
        const [tempFirst, tempSecond] = temp;
        const thirdItem = infos[first + 2];
        if (tempFirst && tempSecond && thirdItem) {
          infos[first] = thirdItem;
          infos[first + 1] = tempSecond;
          infos[first + 2] = tempFirst;
        }
      }
      break;
    case 6:
      if (c && b) {
        const temp = infos.slice(last - 1, last + 1);
        const [tempFirst, tempSecond] = temp;
        const prevItem = infos[last - 2];
        if (tempFirst && tempSecond && prevItem) {
          infos[last] = prevItem;
          infos[last - 1] = tempSecond;
          infos[last - 2] = tempFirst;
        }
      }
      break;
    case 7:
      if (c && b) {
        const temp = infos.slice(last - 1, last + 1);
        const [tempFirst, tempSecond] = temp;
        const prevItem = infos[last - 2];
        if (tempFirst && tempSecond && prevItem) {
          infos[last] = prevItem;
          infos[last - 1] = tempFirst;
          infos[last - 2] = tempSecond;
        }
      }
      break;
    case 8:
      if (c) {
        const tempA = a;
        infos[first] = c;
        infos[last - 1] = d;
        infos[last] = tempA;
      }
      break;
    case 9:
      if (c) {
        const tempA = a;
        infos[first] = d;
        infos[last - 1] = c;
        infos[last] = tempA;
      }
      break;
    case 10:
      if (b) {
        const tempD = d;
        infos[last] = b;
        infos[first + 1] = a;
        infos[first] = tempD;
      }
      break;
    case 11:
      if (b) {
        const tempD = d;
        infos[last] = a;
        infos[first + 1] = b;
        infos[first] = tempD;
      }
      break;
    case 12:
      if (b && c) {
        const tempAB = [a, b];
        infos[first] = c;
        infos[first + 1] = d;
        infos[last - 1] = tempAB[0];
        infos[last] = tempAB[1];
      }
      break;
    case 13:
      if (b && c) {
        const tempAB = [a, b];
        infos[first] = c;
        infos[first + 1] = d;
        infos[last - 1] = tempAB[1];
        infos[last] = tempAB[0];
      }
      break;
    case 14:
      if (b && c) {
        const tempAB = [a, b];
        infos[first] = d;
        infos[first + 1] = c;
        infos[last - 1] = tempAB[0];
        infos[last] = tempAB[1];
      }
      break;
    case 15:
      if (b && c) {
        const tempAB = [a, b];
        infos[first] = d;
        infos[first + 1] = c;
        infos[last - 1] = tempAB[1];
        infos[last] = tempAB[0];
      }
      break;
  }
}
function processContextual(subtable, infos) {
  const { stateTable, substitutionTable } = subtable;
  let state = 0;
  let markIndex = -1;
  for (let i = 0; i <= infos.length; i++) {
    const isEnd = i >= infos.length;
    const glyphClass = isEnd ? CLASS_END_OF_TEXT : getGlyphClass(stateTable.classTable, infos[i]?.glyphId);
    const stateRow = stateTable.stateArray[state];
    if (!stateRow) break;
    const entry = stateRow[glyphClass];
    if (!entry) break;
    if (entry.flags & 32768) {
      markIndex = i;
    }
    if (entry.markIndex !== 65535 && markIndex >= 0 && markIndex < infos.length) {
      const substTable = substitutionTable[entry.markIndex];
      if (substTable) {
        const markedInfo = infos[markIndex];
        if (markedInfo) {
          const replacement = substTable.get(markedInfo.glyphId);
          if (replacement !== void 0) {
            markedInfo.glyphId = replacement;
          }
        }
      }
    }
    if (!isEnd && entry.currentIndex !== 65535) {
      const substTable = substitutionTable[entry.currentIndex];
      if (substTable) {
        const currentInfo = infos[i];
        if (currentInfo) {
          const replacement = substTable.get(currentInfo.glyphId);
          if (replacement !== void 0) {
            currentInfo.glyphId = replacement;
          }
        }
      }
    }
    if (!(entry.flags & 16384)) {
    }
    state = entry.newState;
  }
}
function processLigature(subtable, infos) {
  const { stateTable, ligatureActions, components, ligatures } = subtable;
  let state = 0;
  const stack = [];
  const result = [];
  const deleted = /* @__PURE__ */ new Set();
  for (let i = 0; i <= infos.length; i++) {
    const isEnd = i >= infos.length;
    const glyphClass = isEnd ? CLASS_END_OF_TEXT : getGlyphClass(stateTable.classTable, infos[i]?.glyphId);
    const stateRow = stateTable.stateArray[state];
    if (!stateRow) break;
    const entry = stateRow[glyphClass];
    if (!entry) break;
    if (entry.flags & 32768) {
      stack.push(i);
    }
    if (entry.flags & 8192 && entry.ligActionIndex < ligatureActions.length) {
      let actionIndex = entry.ligActionIndex;
      let ligatureGlyph = 0;
      const componentIndices = [];
      while (actionIndex < ligatureActions.length) {
        const action = ligatureActions[actionIndex];
        if (action === void 0) break;
        const last = (action & 2147483648) !== 0;
        const store = (action & 1073741824) !== 0;
        const componentOffset = (action & 1073741823) << 2 >> 2;
        const stackIdx = stack.pop();
        if (stackIdx !== void 0 && stackIdx < infos.length) {
          componentIndices.push(stackIdx);
          const info = infos[stackIdx];
          if (info) {
            const glyphId = info.glyphId;
            const componentIdx = glyphId + componentOffset;
            if (componentIdx >= 0 && componentIdx < components.length) {
              const component = components[componentIdx];
              if (component !== void 0) {
                ligatureGlyph = component + ligatureGlyph;
              }
            }
          }
        }
        if (store && ligatureGlyph < ligatures.length) {
          const firstIdx = componentIndices[componentIndices.length - 1];
          if (firstIdx !== void 0 && firstIdx < infos.length) {
            const firstInfo = infos[firstIdx];
            const ligature = ligatures[ligatureGlyph];
            if (firstInfo && ligature !== void 0) {
              firstInfo.glyphId = ligature;
              for (const [j, idx] of componentIndices.entries()) {
                if (j < componentIndices.length - 1) {
                  deleted.add(idx);
                }
              }
            }
          }
          ligatureGlyph = 0;
        }
        if (last) break;
        actionIndex++;
      }
    }
    if (!(entry.flags & 16384)) {
    }
    state = entry.newState;
  }
  for (const [i, info] of infos.entries()) {
    if (!deleted.has(i)) {
      result.push(info);
    }
  }
  return result;
}
function processInsertion(subtable, infos) {
  const { stateTable, insertionGlyphs } = subtable;
  let state = 0;
  let markIndex = -1;
  const result = [];
  const insertions = /* @__PURE__ */ new Map();
  for (let i = 0; i <= infos.length; i++) {
    const isEnd = i >= infos.length;
    const glyphClass = isEnd ? CLASS_END_OF_TEXT : getGlyphClass(stateTable.classTable, infos[i]?.glyphId);
    const stateRow = stateTable.stateArray[state];
    if (!stateRow) break;
    const entry = stateRow[glyphClass];
    if (!entry) break;
    if (entry.flags & 32768) {
      markIndex = i;
    }
    if (entry.markedInsertIndex !== 65535 && markIndex >= 0) {
      const count = entry.flags >> 5 & 31;
      const insertBefore = (entry.flags & 2048) !== 0;
      const glyphs = insertionGlyphs.slice(
        entry.markedInsertIndex,
        entry.markedInsertIndex + count
      );
      let ins = insertions.get(markIndex);
      if (!ins) {
        ins = { before: [], after: [] };
        insertions.set(markIndex, ins);
      }
      if (insertBefore) {
        ins.before.push(...glyphs);
      } else {
        ins.after.push(...glyphs);
      }
    }
    if (!isEnd && entry.currentInsertIndex !== 65535) {
      const count = entry.flags & 31;
      const insertBefore = (entry.flags & 32) !== 0;
      const glyphs = insertionGlyphs.slice(
        entry.currentInsertIndex,
        entry.currentInsertIndex + count
      );
      let ins = insertions.get(i);
      if (!ins) {
        ins = { before: [], after: [] };
        insertions.set(i, ins);
      }
      if (insertBefore) {
        ins.before.push(...glyphs);
      } else {
        ins.after.push(...glyphs);
      }
    }
    if (!(entry.flags & 16384)) {
    }
    state = entry.newState;
  }
  for (const [i, info] of infos.entries()) {
    const ins = insertions.get(i);
    if (ins) {
      for (const glyph of ins.before) {
        result.push({
          glyphId: glyph,
          cluster: info.cluster,
          mask: info.mask,
          codepoint: 0
        });
      }
    }
    result.push(info);
    if (ins) {
      for (const glyph of ins.after) {
        result.push({
          glyphId: glyph,
          cluster: info.cluster,
          mask: info.mask,
          codepoint: 0
        });
      }
    }
  }
  return result;
}

// src/types.ts
var Direction = /* @__PURE__ */ ((Direction2) => {
  Direction2[Direction2["Invalid"] = 0] = "Invalid";
  Direction2[Direction2["LTR"] = 4] = "LTR";
  Direction2[Direction2["RTL"] = 5] = "RTL";
  Direction2[Direction2["TTB"] = 6] = "TTB";
  Direction2[Direction2["BTT"] = 7] = "BTT";
  return Direction2;
})(Direction || {});
var ClusterLevel = /* @__PURE__ */ ((ClusterLevel2) => {
  ClusterLevel2[ClusterLevel2["MonotoneGraphemes"] = 0] = "MonotoneGraphemes";
  ClusterLevel2[ClusterLevel2["MonotoneCharacters"] = 1] = "MonotoneCharacters";
  ClusterLevel2[ClusterLevel2["Characters"] = 2] = "Characters";
  return ClusterLevel2;
})(ClusterLevel || {});
var BufferFlags = /* @__PURE__ */ ((BufferFlags2) => {
  BufferFlags2[BufferFlags2["Default"] = 0] = "Default";
  BufferFlags2[BufferFlags2["BeginningOfText"] = 1] = "BeginningOfText";
  BufferFlags2[BufferFlags2["EndOfText"] = 2] = "EndOfText";
  BufferFlags2[BufferFlags2["PreserveDefaultIgnorables"] = 4] = "PreserveDefaultIgnorables";
  BufferFlags2[BufferFlags2["RemoveDefaultIgnorables"] = 8] = "RemoveDefaultIgnorables";
  BufferFlags2[BufferFlags2["DoNotInsertDottedCircle"] = 16] = "DoNotInsertDottedCircle";
  return BufferFlags2;
})(BufferFlags || {});
var GlyphClass = /* @__PURE__ */ ((GlyphClass2) => {
  GlyphClass2[GlyphClass2["Base"] = 1] = "Base";
  GlyphClass2[GlyphClass2["Ligature"] = 2] = "Ligature";
  GlyphClass2[GlyphClass2["Mark"] = 3] = "Mark";
  GlyphClass2[GlyphClass2["Component"] = 4] = "Component";
  return GlyphClass2;
})(GlyphClass || {});
function tag(str) {
  if (str.length !== 4) {
    throw new Error(`Tag must be exactly 4 characters: "${str}"`);
  }
  return str.charCodeAt(0) << 24 | str.charCodeAt(1) << 16 | str.charCodeAt(2) << 8 | str.charCodeAt(3);
}
function tagToString(t) {
  return String.fromCharCode(
    t >> 24 & 255,
    t >> 16 & 255,
    t >> 8 & 255,
    t & 255
  );
}
var Tags = {
  // Required tables
  head: tag("head"),
  hhea: tag("hhea"),
  hmtx: tag("hmtx"),
  maxp: tag("maxp"),
  cmap: tag("cmap"),
  loca: tag("loca"),
  glyf: tag("glyf"),
  name: tag("name"),
  OS2: tag("OS/2"),
  post: tag("post"),
  // OpenType layout
  GDEF: tag("GDEF"),
  GSUB: tag("GSUB"),
  GPOS: tag("GPOS"),
  BASE: tag("BASE"),
  JSTF: tag("JSTF"),
  MATH: tag("MATH"),
  // CFF
  CFF: tag("CFF "),
  CFF2: tag("CFF2"),
  // Variable fonts
  fvar: tag("fvar"),
  gvar: tag("gvar"),
  avar: tag("avar"),
  HVAR: tag("HVAR"),
  VVAR: tag("VVAR"),
  MVAR: tag("MVAR"),
  // AAT
  morx: tag("morx"),
  kerx: tag("kerx"),
  kern: tag("kern"),
  trak: tag("trak"),
  feat: tag("feat"),
  // Color
  COLR: tag("COLR"),
  CPAL: tag("CPAL"),
  SVG: tag("SVG "),
  sbix: tag("sbix"),
  CBDT: tag("CBDT"),
  CBLC: tag("CBLC"),
  // Style Attributes
  STAT: tag("STAT"),
  // Vertical
  vhea: tag("vhea"),
  vmtx: tag("vmtx"),
  VORG: tag("VORG"),
  // Hinting
  fpgm: tag("fpgm"),
  prep: tag("prep"),
  cvt: tag("cvt "),
  gasp: tag("gasp")
};
var FeatureTags = {
  // GSUB
  ccmp: tag("ccmp"),
  locl: tag("locl"),
  rlig: tag("rlig"),
  liga: tag("liga"),
  clig: tag("clig"),
  calt: tag("calt"),
  rclt: tag("rclt"),
  dlig: tag("dlig"),
  smcp: tag("smcp"),
  c2sc: tag("c2sc"),
  // Arabic
  isol: tag("isol"),
  init: tag("init"),
  medi: tag("medi"),
  fina: tag("fina"),
  // GPOS
  kern: tag("kern"),
  mark: tag("mark"),
  mkmk: tag("mkmk"),
  curs: tag("curs"),
  dist: tag("dist")
};

// src/buffer/glyph-buffer.ts
var GlyphBuffer = class _GlyphBuffer {
  /** Direction used during shaping */
  direction = 4 /* LTR */;
  /** Script used during shaping */
  script = "Zyyy";
  /** Language used during shaping */
  language = null;
  /** Glyph information array */
  infos = [];
  /** Glyph position array */
  positions = [];
  /** Create buffer with pre-allocated capacity */
  static withCapacity(capacity) {
    const buffer = new _GlyphBuffer();
    buffer.infos = new Array(capacity);
    buffer.positions = new Array(capacity);
    return buffer;
  }
  /** Number of glyphs */
  get length() {
    return this.infos.length;
  }
  /** Initialize from glyph infos (positions zeroed) */
  initFromInfos(infos) {
    this.infos = infos;
    this.positions = infos.map(() => ({
      xAdvance: 0,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0
    }));
  }
  /** Set advance width for a glyph */
  setAdvance(index, xAdvance, yAdvance = 0) {
    const pos = this.positions[index];
    if (pos) {
      pos.xAdvance = xAdvance;
      pos.yAdvance = yAdvance;
    }
  }
  /** Add offset to a glyph position */
  addOffset(index, xOffset, yOffset) {
    const pos = this.positions[index];
    if (pos) {
      pos.xOffset += xOffset;
      pos.yOffset += yOffset;
    }
  }
  /** Replace glyph at index */
  replaceGlyph(index, glyphId) {
    const info = this.infos[index];
    if (info) {
      info.glyphId = glyphId;
    }
  }
  /** Insert glyph at index */
  insertGlyph(index, info, position) {
    this.infos.splice(index, 0, info);
    this.positions.splice(index, 0, position);
  }
  /** Remove glyphs in range [start, end) */
  removeRange(start, end) {
    const count = end - start;
    this.infos.splice(start, count);
    this.positions.splice(start, count);
  }
  /** Merge clusters from start to end (inclusive) */
  mergeClusters(start, end) {
    if (start >= end || start < 0 || end >= this.infos.length) return;
    const cluster = this.infos[start]?.cluster;
    for (let i = start + 1; i <= end; i++) {
      const info = this.infos[i];
      if (info) {
        info.cluster = cluster;
      }
    }
  }
  /** Reverse glyph order (for RTL) */
  reverse() {
    this.infos.reverse();
    this.positions.reverse();
  }
  /** Reverse range [start, end) */
  reverseRange(start, end) {
    let i = start;
    let j = end - 1;
    while (i < j) {
      const tmpInfo = this.infos[i];
      const tmpInfoJ = this.infos[j];
      if (!tmpInfo || !tmpInfoJ) break;
      this.infos[i] = tmpInfoJ;
      this.infos[j] = tmpInfo;
      const tmpPos = this.positions[i];
      const tmpPosJ = this.positions[j];
      if (!tmpPos || !tmpPosJ) break;
      this.positions[i] = tmpPosJ;
      this.positions[j] = tmpPos;
      i++;
      j--;
    }
  }
  /** Get total advance width */
  getTotalAdvance() {
    let x = 0;
    let y = 0;
    for (const pos of this.positions) {
      x += pos.xAdvance;
      y += pos.yAdvance;
    }
    return { x, y };
  }
  /** Serialize to HarfBuzz-compatible format */
  serialize() {
    const parts = [];
    for (const [i, info] of this.infos.entries()) {
      const pos = this.positions[i];
      if (!pos) continue;
      let str = `${info.glyphId}`;
      if (i === 0 || info.cluster !== this.infos[i - 1]?.cluster) {
        str += `=${info.cluster}`;
      }
      if (pos.xOffset !== 0 || pos.yOffset !== 0) {
        str += `@${pos.xOffset},${pos.yOffset}`;
      }
      if (pos.xAdvance !== 0) {
        str += `+${pos.xAdvance}`;
      }
      parts.push(str);
    }
    return `[${parts.join("|")}]`;
  }
  /** Get glyph IDs as array */
  glyphIds() {
    return this.infos.map((info) => info.glyphId);
  }
  /** Get clusters as array */
  clusters() {
    return this.infos.map((info) => info.cluster);
  }
  /** Iterator for glyph info/position pairs */
  *[Symbol.iterator]() {
    for (const [i, info] of this.infos.entries()) {
      const position = this.positions[i];
      if (!position) continue;
      yield { info, position };
    }
  }
};

// src/buffer/unicode-buffer.ts
var UnicodeBuffer = class {
  _direction = 4 /* LTR */;
  _script = "Zyyy";
  // Common/Unknown
  _language = null;
  _clusterLevel = 0 /* MonotoneGraphemes */;
  _flags = 0 /* Default */;
  /** Codepoints to shape */
  codepoints = [];
  /** Cluster indices (maps each codepoint to its cluster) */
  clusters = [];
  /** Pre-context (text before the buffer for contextual shaping) */
  preContext = [];
  /** Post-context (text after the buffer for contextual shaping) */
  postContext = [];
  /** Add a string to the buffer */
  addStr(text, startCluster = 0) {
    let cluster = startCluster;
    for (const char of text) {
      const codepoint = char.codePointAt(0);
      if (codepoint === void 0) continue;
      this.codepoints.push(codepoint);
      this.clusters.push(cluster);
      cluster++;
    }
    return this;
  }
  /** Add codepoints directly */
  addCodepoints(codepoints, startCluster = 0) {
    let cluster = startCluster;
    for (const cp of codepoints) {
      this.codepoints.push(cp);
      this.clusters.push(cluster);
      cluster++;
    }
    return this;
  }
  /** Add a single codepoint */
  addCodepoint(codepoint, cluster) {
    this.codepoints.push(codepoint);
    this.clusters.push(cluster ?? this.codepoints.length - 1);
    return this;
  }
  /** Set text direction */
  setDirection(direction) {
    this._direction = direction;
    return this;
  }
  /** Set script (ISO 15924 tag, e.g., 'Latn', 'Arab') */
  setScript(script) {
    this._script = script;
    return this;
  }
  /** Set language (BCP 47 tag, e.g., 'en', 'ar') */
  setLanguage(language) {
    this._language = language;
    return this;
  }
  /** Set cluster level */
  setClusterLevel(level) {
    this._clusterLevel = level;
    return this;
  }
  /** Set buffer flags */
  setFlags(flags) {
    this._flags = flags;
    return this;
  }
  /** Set pre-context string */
  setPreContext(text) {
    this.preContext = [];
    for (const char of text) {
      const codepoint = char.codePointAt(0);
      if (codepoint !== void 0) {
        this.preContext.push(codepoint);
      }
    }
    return this;
  }
  /** Set post-context string */
  setPostContext(text) {
    this.postContext = [];
    for (const char of text) {
      const codepoint = char.codePointAt(0);
      if (codepoint !== void 0) {
        this.postContext.push(codepoint);
      }
    }
    return this;
  }
  /** Clear the buffer */
  clear() {
    this.codepoints.length = 0;
    this.clusters.length = 0;
    this.preContext.length = 0;
    this.postContext.length = 0;
    return this;
  }
  /** Number of codepoints */
  get length() {
    return this.codepoints.length;
  }
  get direction() {
    return this._direction;
  }
  get script() {
    return this._script;
  }
  get language() {
    return this._language;
  }
  get clusterLevel() {
    return this._clusterLevel;
  }
  get flags() {
    return this._flags;
  }
  /** Convert to initial glyph infos (codepoint = glyphId initially) */
  toGlyphInfos() {
    return this.codepoints.map((codepoint, i) => ({
      glyphId: 0,
      // Will be set during shaping
      cluster: this.clusters[i] ?? 0,
      mask: 0,
      codepoint
    }));
  }
};

// src/font/binary/reader.ts
var Reader = class _Reader {
  data;
  start;
  end;
  pos;
  constructor(buffer, offset = 0, length) {
    if (buffer instanceof ArrayBuffer) {
      this.data = new DataView(buffer);
      this.start = offset;
      this.end = length !== void 0 ? offset + length : buffer.byteLength;
    } else {
      this.data = buffer;
      this.start = buffer.byteOffset + offset;
      this.end = length !== void 0 ? this.start + length : buffer.byteOffset + buffer.byteLength;
    }
    this.pos = this.start;
  }
  /** Current read position relative to start */
  get offset() {
    return this.pos - this.start;
  }
  /** Bytes remaining to read */
  get remaining() {
    return this.end - this.pos;
  }
  /** Total length of this reader's view */
  get length() {
    return this.end - this.start;
  }
  /** Seek to absolute offset (relative to this reader's start) */
  seek(offset) {
    this.pos = this.start + offset;
  }
  /** Skip bytes */
  skip(bytes) {
    this.pos += bytes;
  }
  /** Create a sub-reader (zero-copy slice) */
  slice(offset, length) {
    return new _Reader(this.data, this.start + offset, length);
  }
  /** Create a sub-reader from current position */
  sliceFrom(offset) {
    return new _Reader(
      this.data,
      this.start + offset,
      this.end - this.start - offset
    );
  }
  /** Peek at a value without advancing position */
  peek(fn) {
    const savedPos = this.pos;
    const result = fn();
    this.pos = savedPos;
    return result;
  }
  // Primitive readers (big-endian)
  uint8() {
    const value = this.data.getUint8(this.pos);
    this.pos += 1;
    return value;
  }
  int8() {
    const value = this.data.getInt8(this.pos);
    this.pos += 1;
    return value;
  }
  uint16() {
    const value = this.data.getUint16(this.pos, false);
    this.pos += 2;
    return value;
  }
  int16() {
    const value = this.data.getInt16(this.pos, false);
    this.pos += 2;
    return value;
  }
  uint32() {
    const value = this.data.getUint32(this.pos, false);
    this.pos += 4;
    return value;
  }
  int32() {
    const value = this.data.getInt32(this.pos, false);
    this.pos += 4;
    return value;
  }
  // OpenType-specific types
  /** 16.16 fixed-point number */
  fixed() {
    return this.int32() / 65536;
  }
  /** 2.14 fixed-point number */
  f2dot14() {
    return this.int16() / 16384;
  }
  /** Signed 16-bit integer in font design units */
  fword() {
    return this.int16();
  }
  /** Unsigned 16-bit integer in font design units */
  ufword() {
    return this.uint16();
  }
  /** 64-bit signed integer (seconds since 1904-01-01) */
  longDateTime() {
    const high = this.uint32();
    const low = this.uint32();
    return BigInt(high) << 32n | BigInt(low);
  }
  /** 4-byte ASCII tag as packed uint32 */
  tag() {
    return this.uint32();
  }
  /** 4-byte ASCII tag as string */
  tagString() {
    const t = this.uint32();
    return String.fromCharCode(
      t >> 24 & 255,
      t >> 16 & 255,
      t >> 8 & 255,
      t & 255
    );
  }
  /** 16-bit offset */
  offset16() {
    return this.uint16();
  }
  /** 32-bit offset */
  offset32() {
    return this.uint32();
  }
  /** 24-bit unsigned integer */
  uint24() {
    const b0 = this.data.getUint8(this.pos);
    const b1 = this.data.getUint8(this.pos + 1);
    const b2 = this.data.getUint8(this.pos + 2);
    this.pos += 3;
    return b0 << 16 | b1 << 8 | b2;
  }
  // Array readers
  uint8Array(count) {
    const result = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.uint8();
    }
    return result;
  }
  uint16Array(count) {
    const result = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.uint16();
    }
    return result;
  }
  int16Array(count) {
    const result = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.int16();
    }
    return result;
  }
  uint32Array(count) {
    const result = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.uint32();
    }
    return result;
  }
  /** Read array using custom reader function */
  array(count, readFn) {
    const result = new Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = readFn(this);
    }
    return result;
  }
  // String readers
  /** Read ASCII string of given length */
  ascii(length) {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(this.uint8());
    }
    return result;
  }
  /** Read UTF-16BE string (used in 'name' table) */
  utf16be(length) {
    const chars = [];
    const charCount = length / 2;
    for (let i = 0; i < charCount; i++) {
      chars.push(this.uint16());
    }
    return String.fromCharCode(...chars);
  }
  // Utility methods
  /** Check if there are enough bytes remaining */
  hasRemaining(bytes) {
    return this.remaining >= bytes;
  }
  /** Throw if not enough bytes remaining */
  ensureRemaining(bytes) {
    if (this.remaining < bytes) {
      throw new Error(
        `Unexpected end of data: need ${bytes} bytes, have ${this.remaining}`
      );
    }
  }
  /** Get raw bytes as Uint8Array (zero-copy view) */
  bytes(length) {
    const result = new Uint8Array(
      this.data.buffer,
      this.data.byteOffset + this.pos,
      length
    );
    this.pos += length;
    return result;
  }
  /** Read value at specific offset without moving position */
  readAt(offset, fn) {
    const savedPos = this.pos;
    this.pos = this.start + offset;
    const result = fn(this);
    this.pos = savedPos;
    return result;
  }
};

// src/font/tables/avar.ts
function parseAvar(reader, axisCount) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  reader.skip(2);
  const axisSegmentMaps = [];
  for (let i = 0; i < axisCount; i++) {
    const positionMapCount = reader.uint16();
    const axisValueMaps = [];
    for (let j = 0; j < positionMapCount; j++) {
      axisValueMaps.push({
        fromCoordinate: reader.f2dot14(),
        toCoordinate: reader.f2dot14()
      });
    }
    axisSegmentMaps.push({ axisValueMaps });
  }
  return {
    majorVersion,
    minorVersion,
    axisSegmentMaps
  };
}
function applyAvarMapping(segmentMap, coord) {
  const maps = segmentMap.axisValueMaps;
  if (maps.length === 0) return coord;
  for (let i = 0; i < maps.length - 1; i++) {
    const map1 = maps[i];
    const map2 = maps[i + 1];
    if (!map1 || !map2) continue;
    if (coord >= map1.fromCoordinate && coord <= map2.fromCoordinate) {
      const t = (coord - map1.fromCoordinate) / (map2.fromCoordinate - map1.fromCoordinate);
      return map1.toCoordinate + t * (map2.toCoordinate - map1.toCoordinate);
    }
  }
  const firstMap = maps[0];
  const lastMap = maps[maps.length - 1];
  if (firstMap && coord <= firstMap.fromCoordinate) {
    return firstMap.toCoordinate;
  }
  return lastMap?.toCoordinate ?? coord;
}
function applyAvar(avar, coords) {
  const result = [];
  for (const [i, coord] of coords.entries()) {
    const segmentMap = avar.axisSegmentMaps[i];
    if (segmentMap) {
      result.push(applyAvarMapping(segmentMap, coord));
    } else {
      result.push(coord);
    }
  }
  return result;
}

// src/font/tables/fvar.ts
function parseFvar(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const axesArrayOffset = reader.offset16();
  reader.skip(2);
  const axisCount = reader.uint16();
  const axisSize = reader.uint16();
  const instanceCount = reader.uint16();
  const instanceSize = reader.uint16();
  const axes = [];
  reader.seek(axesArrayOffset);
  for (let i = 0; i < axisCount; i++) {
    const axisStart = reader.offset;
    const tag2 = reader.uint32();
    const minValue = reader.fixed();
    const defaultValue = reader.fixed();
    const maxValue = reader.fixed();
    const flags = reader.uint16();
    const axisNameId = reader.uint16();
    axes.push({
      tag: tag2,
      minValue,
      defaultValue,
      maxValue,
      flags,
      axisNameId
    });
    reader.seek(axisStart + axisSize);
  }
  const instances = [];
  const hasPostScriptNameId = instanceSize >= 4 + axisCount * 4 + 2;
  for (let i = 0; i < instanceCount; i++) {
    const instanceStart = reader.offset;
    const subfamilyNameId = reader.uint16();
    const flags = reader.uint16();
    const coordinates = [];
    for (let j = 0; j < axisCount; j++) {
      coordinates.push(reader.fixed());
    }
    const instance = {
      subfamilyNameId,
      flags,
      coordinates
    };
    if (hasPostScriptNameId) {
      instance.postScriptNameId = reader.uint16();
    }
    instances.push(instance);
    reader.seek(instanceStart + instanceSize);
  }
  return {
    majorVersion,
    minorVersion,
    axes,
    instances
  };
}
function normalizeAxisValue(axis, value) {
  if (value < axis.defaultValue) {
    if (value < axis.minValue) value = axis.minValue;
    if (axis.defaultValue === axis.minValue) return 0;
    return (value - axis.defaultValue) / (axis.defaultValue - axis.minValue);
  } else if (value > axis.defaultValue) {
    if (value > axis.maxValue) value = axis.maxValue;
    if (axis.defaultValue === axis.maxValue) return 0;
    return (value - axis.defaultValue) / (axis.maxValue - axis.defaultValue);
  }
  return 0;
}

// src/font/tables/hvar.ts
function parseHvar(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const itemVariationStoreOffset = reader.offset32();
  const advanceWidthMappingOffset = reader.offset32();
  const lsbMappingOffset = reader.offset32();
  const rsbMappingOffset = reader.offset32();
  const itemVariationStore = parseItemVariationStore(
    reader.sliceFrom(itemVariationStoreOffset)
  );
  const advanceWidthMapping = advanceWidthMappingOffset !== 0 ? parseDeltaSetIndexMap(reader.sliceFrom(advanceWidthMappingOffset)) : null;
  const lsbMapping = lsbMappingOffset !== 0 ? parseDeltaSetIndexMap(reader.sliceFrom(lsbMappingOffset)) : null;
  const rsbMapping = rsbMappingOffset !== 0 ? parseDeltaSetIndexMap(reader.sliceFrom(rsbMappingOffset)) : null;
  return {
    majorVersion,
    minorVersion,
    itemVariationStore,
    advanceWidthMapping,
    lsbMapping,
    rsbMapping
  };
}
function parseItemVariationStore(reader) {
  const format = reader.uint16();
  const variationRegionListOffset = reader.offset32();
  const itemVariationDataCount = reader.uint16();
  const itemVariationDataOffsets = [];
  for (let i = 0; i < itemVariationDataCount; i++) {
    itemVariationDataOffsets.push(reader.offset32());
  }
  const regionReader = reader.sliceFrom(variationRegionListOffset);
  const axisCount = regionReader.uint16();
  const regionCount = regionReader.uint16();
  const variationRegions = [];
  for (let i = 0; i < regionCount; i++) {
    const regionAxes = [];
    for (let j = 0; j < axisCount; j++) {
      regionAxes.push({
        startCoord: regionReader.f2dot14(),
        peakCoord: regionReader.f2dot14(),
        endCoord: regionReader.f2dot14()
      });
    }
    variationRegions.push({ regionAxes });
  }
  const itemVariationData = [];
  for (const offset of itemVariationDataOffsets) {
    const dataReader = reader.sliceFrom(offset);
    const itemCount = dataReader.uint16();
    const wordDeltaCount = dataReader.uint16();
    const regionIndexCount = dataReader.uint16();
    const regionIndexes = [];
    for (let i = 0; i < regionIndexCount; i++) {
      regionIndexes.push(dataReader.uint16());
    }
    const longWords = (wordDeltaCount & 32768) !== 0;
    const wordCount = wordDeltaCount & 32767;
    const shortCount = regionIndexCount - wordCount;
    const deltaSets = [];
    for (let i = 0; i < itemCount; i++) {
      const deltas = [];
      for (let j = 0; j < wordCount; j++) {
        if (longWords) {
          deltas.push(dataReader.int32());
        } else {
          deltas.push(dataReader.int16());
        }
      }
      for (let j = 0; j < shortCount; j++) {
        if (longWords) {
          deltas.push(dataReader.int16());
        } else {
          deltas.push(dataReader.int8());
        }
      }
      deltaSets.push(deltas);
    }
    itemVariationData.push({ itemCount, regionIndexes, deltaSets });
  }
  return { format, variationRegions, itemVariationData };
}
function parseDeltaSetIndexMap(reader) {
  const format = reader.uint8();
  const entryFormat = reader.uint8();
  const mapCount = format === 0 ? reader.uint16() : reader.uint32();
  const innerIndexBitCount = (entryFormat & 15) + 1;
  const mapEntrySize = (entryFormat >> 4 & 3) + 1;
  const mapData = [];
  for (let i = 0; i < mapCount; i++) {
    let entry = 0;
    for (let j = 0; j < mapEntrySize; j++) {
      entry = entry << 8 | reader.uint8();
    }
    const inner = entry & (1 << innerIndexBitCount) - 1;
    const outer = entry >> innerIndexBitCount;
    mapData.push({ outer, inner });
  }
  return { format, mapCount, entryFormat, innerIndexBitCount, mapData };
}
function calculateRegionScalar(region, coords) {
  let scalar = 1;
  for (let i = 0; i < region.regionAxes.length && i < coords.length; i++) {
    const axis = region.regionAxes[i];
    const coord = coords[i];
    if (axis === void 0 || coord === void 0) continue;
    if (coord < axis.startCoord || coord > axis.endCoord) {
      return 0;
    }
    if (coord === axis.peakCoord) {
      continue;
    }
    if (coord < axis.peakCoord) {
      if (axis.peakCoord === axis.startCoord) {
        continue;
      }
      scalar *= (coord - axis.startCoord) / (axis.peakCoord - axis.startCoord);
    } else {
      if (axis.peakCoord === axis.endCoord) {
        continue;
      }
      scalar *= (axis.endCoord - coord) / (axis.endCoord - axis.peakCoord);
    }
  }
  return scalar;
}
function getDeltaFromMapping(hvar, glyphId, coords, mapping) {
  let outer;
  let inner;
  if (mapping && glyphId < mapping.mapData.length) {
    const entry = mapping.mapData[glyphId];
    if (!entry) {
      outer = 0;
      inner = glyphId;
    } else {
      outer = entry.outer;
      inner = entry.inner;
    }
  } else {
    outer = 0;
    inner = glyphId;
  }
  const varData = hvar.itemVariationStore.itemVariationData[outer];
  if (!varData || inner >= varData.itemCount) {
    return 0;
  }
  const deltaSet = varData.deltaSets[inner];
  if (!deltaSet) {
    return 0;
  }
  let delta = 0;
  for (const [i, regionIndex] of varData.regionIndexes.entries()) {
    const region = hvar.itemVariationStore.variationRegions[regionIndex];
    if (!region) continue;
    const scalar = calculateRegionScalar(region, coords);
    const regionDelta = deltaSet[i] ?? 0;
    delta += scalar * regionDelta;
  }
  return Math.round(delta);
}
function getAdvanceWidthDelta(hvar, glyphId, coords) {
  return getDeltaFromMapping(hvar, glyphId, coords, hvar.advanceWidthMapping);
}
function getLsbDelta(hvar, glyphId, coords) {
  if (!hvar.lsbMapping) {
    return 0;
  }
  return getDeltaFromMapping(hvar, glyphId, coords, hvar.lsbMapping);
}

// src/font/face.ts
var Face = class {
  font;
  /** Normalized axis coordinates [-1, 1] */
  _coords;
  /** User-space axis values */
  _variations;
  constructor(font, variations) {
    this.font = font;
    this._coords = [];
    this._variations = /* @__PURE__ */ new Map();
    const fvar = font.fvar;
    if (fvar) {
      this._coords = new Array(fvar.axes.length).fill(0);
      if (variations) {
        this.setVariations(variations);
      }
    }
  }
  /**
   * Set variation axis values
   * @param variations Object with axis tags as keys (e.g., { wght: 700, wdth: 100 })
   *                   or array of Variation objects
   */
  setVariations(variations) {
    const fvar = this.font.fvar;
    if (!fvar) return;
    if (Array.isArray(variations)) {
      for (const v of variations) {
        this._variations.set(v.tag, v.value);
      }
    } else {
      for (const [tagStr, value] of Object.entries(variations)) {
        const t = tag(tagStr.padEnd(4, " "));
        this._variations.set(t, value);
      }
    }
    for (const [i, axis] of fvar.axes.entries()) {
      const userValue = this._variations.get(axis.tag) ?? axis.defaultValue;
      this._coords[i] = normalizeAxisValue(axis, userValue);
    }
    const avar = this.font.avar;
    if (avar) {
      this._coords = applyAvar(avar, this._coords);
    }
  }
  /**
   * Get normalized coordinates for variation processing
   */
  get normalizedCoords() {
    return this._coords;
  }
  /**
   * Check if this is a variable font instance
   */
  get isVariable() {
    return this.font.isVariable;
  }
  /**
   * Get variation axes
   */
  get axes() {
    return this.font.fvar?.axes ?? [];
  }
  /**
   * Get current value for an axis
   */
  getAxisValue(axisTag) {
    const t = typeof axisTag === "string" ? tag(axisTag.padEnd(4, " ")) : axisTag;
    const fvar = this.font.fvar;
    if (!fvar) return null;
    const value = this._variations.get(t);
    if (value !== void 0) return value;
    const axis = fvar.axes.find((a) => a.tag === t);
    return axis?.defaultValue ?? null;
  }
  /**
   * Get advance width for a glyph, including variation deltas
   */
  advanceWidth(glyphId) {
    let advance = this.font.advanceWidth(glyphId);
    if (this._coords.length > 0 && this.font.hvar) {
      const delta = getAdvanceWidthDelta(this.font.hvar, glyphId, this._coords);
      advance += delta;
    }
    return advance;
  }
  /**
   * Get left side bearing for a glyph, including variation deltas
   */
  leftSideBearing(glyphId) {
    let lsb = this.font.leftSideBearing(glyphId);
    if (this._coords.length > 0 && this.font.hvar) {
      const delta = getLsbDelta(this.font.hvar, glyphId, this._coords);
      lsb += delta;
    }
    return lsb;
  }
  // Delegate common properties to font
  get numGlyphs() {
    return this.font.numGlyphs;
  }
  get unitsPerEm() {
    return this.font.unitsPerEm;
  }
  get ascender() {
    return this.font.ascender;
  }
  get descender() {
    return this.font.descender;
  }
  get lineGap() {
    return this.font.lineGap;
  }
  glyphId(codepoint) {
    return this.font.glyphId(codepoint);
  }
  glyphIdForChar(char) {
    return this.font.glyphIdForChar(char);
  }
  hasTable(t) {
    return this.font.hasTable(t);
  }
  // Expose tables
  get gdef() {
    return this.font.gdef;
  }
  get gsub() {
    return this.font.gsub;
  }
  get gpos() {
    return this.font.gpos;
  }
  get kern() {
    return this.font.kern;
  }
  get morx() {
    return this.font.morx;
  }
  get cmap() {
    return this.font.cmap;
  }
  get hmtx() {
    return this.font.hmtx;
  }
  get hhea() {
    return this.font.hhea;
  }
};
function createFace(font, variations) {
  return new Face(font, variations);
}

// src/font/woff2.ts
var KNOWN_TAGS = [
  "cmap",
  "head",
  "hhea",
  "hmtx",
  "maxp",
  "name",
  "OS/2",
  "post",
  "cvt ",
  "fpgm",
  "glyf",
  "loca",
  "prep",
  "CFF ",
  "VORG",
  "EBDT",
  "EBLC",
  "gasp",
  "hdmx",
  "kern",
  "LTSH",
  "PCLT",
  "VDMX",
  "vhea",
  "vmtx",
  "BASE",
  "GDEF",
  "GPOS",
  "GSUB",
  "EBSC",
  "JSTF",
  "MATH",
  "CBDT",
  "CBLC",
  "COLR",
  "CPAL",
  "SVG ",
  "sbix",
  "acnt",
  "avar",
  "bdat",
  "bloc",
  "bsln",
  "cvar",
  "fdsc",
  "feat",
  "fmtx",
  "fvar",
  "gvar",
  "hsty",
  "just",
  "lcar",
  "mort",
  "morx",
  "opbd",
  "prop",
  "trak",
  "Zapf",
  "Silf",
  "Glat",
  "Gloc",
  "Feat",
  "Sill"
];
function readUIntBase128(data, offset) {
  let result = 0;
  for (let i = 0; i < 5; i++) {
    const byte = data[offset.value++];
    if (i === 0 && byte === 128) {
      throw new Error("Invalid UIntBase128: leading zeros");
    }
    if (result > 2097151) {
      throw new Error("UIntBase128 overflow");
    }
    result = result << 7 | byte & 127;
    if ((byte & 128) === 0) {
      return result;
    }
  }
  throw new Error("UIntBase128 too long");
}
function read255UInt16(data, offset) {
  const code = data[offset.value++];
  if (code === 253) {
    const hi = data[offset.value++];
    const lo = data[offset.value++];
    return hi << 8 | lo;
  } else if (code === 255) {
    return data[offset.value++] + 253 * 2;
  } else if (code === 254) {
    return data[offset.value++] + 253;
  }
  return code;
}
function parseTableDirectory(data, offset, numTables) {
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = data[offset.value++];
    const tagIndex = flags & 63;
    const transformVersion = flags >> 6 & 3;
    let tag2;
    if (tagIndex === 63) {
      tag2 = String.fromCharCode(
        data[offset.value++],
        data[offset.value++],
        data[offset.value++],
        data[offset.value++]
      );
    } else {
      tag2 = KNOWN_TAGS[tagIndex];
    }
    const origLength = readUIntBase128(data, offset);
    let transformLength = origLength;
    const hasTransform = tag2 === "glyf" || tag2 === "loca" ? transformVersion === 0 : transformVersion !== 0;
    if (hasTransform) {
      transformLength = readUIntBase128(data, offset);
    }
    tables.push({ tag: tag2, origLength, transformLength, transformVersion });
  }
  return tables;
}
async function decompressBrotli(data) {
  if (typeof process !== "undefined" && process.versions?.node || typeof Bun !== "undefined") {
    const zlib = await import("./node_zlib-GYVILIHA.js");
    return new Promise((resolve, reject) => {
      zlib.brotliDecompress(Buffer.from(data), (err, result) => {
        if (err) reject(err);
        else resolve(new Uint8Array(result));
      });
    });
  }
  if (typeof DecompressionStream !== "undefined") {
    try {
      const ds = new DecompressionStream("brotli");
      const blob = new Blob([data]);
      const decompressedStream = blob.stream().pipeThrough(ds);
      const result = await new Response(decompressedStream).arrayBuffer();
      return new Uint8Array(result);
    } catch {
    }
  }
  const { decompress } = await import("./decode-TR7JJYCG.js");
  return decompress(data);
}
function writeUint16BE(arr, offset, value) {
  arr[offset] = value >> 8 & 255;
  arr[offset + 1] = value & 255;
}
function writeUint32BE(arr, offset, value) {
  arr[offset] = value >> 24 & 255;
  arr[offset + 1] = value >> 16 & 255;
  arr[offset + 2] = value >> 8 & 255;
  arr[offset + 3] = value & 255;
}
function readUint16BE(arr, offset) {
  return arr[offset] << 8 | arr[offset + 1];
}
function readInt16BE(arr, offset) {
  const val = readUint16BE(arr, offset);
  return val >= 32768 ? val - 65536 : val;
}
function readUint32BE(arr, offset) {
  return (arr[offset] << 24 | arr[offset + 1] << 16 | arr[offset + 2] << 8 | arr[offset + 3]) >>> 0;
}
function calcChecksum(data, offset, length) {
  let sum = 0;
  const nLongs = Math.ceil(length / 4);
  for (let i = 0; i < nLongs; i++) {
    const idx = offset + i * 4;
    sum = sum + ((data[idx] || 0) << 24 | (data[idx + 1] || 0) << 16 | (data[idx + 2] || 0) << 8 | (data[idx + 3] || 0)) >>> 0;
  }
  return sum;
}
function pad4(n) {
  return n + 3 & ~3;
}
function decodeTriplets(flagStream, glyphStream, nPoints, flagIdx, glyphIdx) {
  const points = [];
  let x = 0, y = 0;
  function withSign(flag, baseval) {
    return flag & 1 ? baseval : -baseval;
  }
  for (let i = 0; i < nPoints; i++) {
    const flag = flagStream[flagIdx.value++];
    const onCurve = flag >> 7 === 0;
    const flagValue = flag & 127;
    let dx = 0, dy = 0;
    if (flagValue < 10) {
      dx = 0;
      dy = withSign(flag, ((flagValue & 14) << 7) + glyphStream[glyphIdx.value++]);
    } else if (flagValue < 20) {
      dx = withSign(flag, ((flagValue - 10 & 14) << 7) + glyphStream[glyphIdx.value++]);
      dy = 0;
    } else if (flagValue < 84) {
      const b0 = flagValue - 20;
      const b1 = glyphStream[glyphIdx.value++];
      dx = withSign(flag, 1 + (b0 & 48) + (b1 >> 4));
      dy = withSign(flag >> 1, 1 + ((b0 & 12) << 2) + (b1 & 15));
    } else if (flagValue < 120) {
      const b0 = flagValue - 84;
      dx = withSign(flag, 1 + (Math.floor(b0 / 12) << 8) + glyphStream[glyphIdx.value++]);
      dy = withSign(flag >> 1, 1 + (b0 % 12 >> 2 << 8) + glyphStream[glyphIdx.value++]);
    } else if (flagValue < 124) {
      const b1 = glyphStream[glyphIdx.value++];
      const b2 = glyphStream[glyphIdx.value++];
      const b3 = glyphStream[glyphIdx.value++];
      dx = withSign(flag, (b1 << 4) + (b2 >> 4));
      dy = withSign(flag >> 1, ((b2 & 15) << 8) + b3);
    } else {
      dx = withSign(flag, (glyphStream[glyphIdx.value++] << 8) + glyphStream[glyphIdx.value++]);
      dy = withSign(flag >> 1, (glyphStream[glyphIdx.value++] << 8) + glyphStream[glyphIdx.value++]);
    }
    x += dx;
    y += dy;
    points.push({ x, y, onCurve });
  }
  return points;
}
function reconstructGlyfLoca(glyfTransform, numGlyphs, indexFormat) {
  let offset = 0;
  const version = readUint16BE(glyfTransform, offset);
  offset += 2;
  if (version !== 0) {
    throw new Error(`Unsupported glyf transform version: ${version}`);
  }
  const optionFlags = readUint16BE(glyfTransform, offset);
  offset += 2;
  const numGlyphsHeader = readUint16BE(glyfTransform, offset);
  offset += 2;
  const indexFormatHeader = readUint16BE(glyfTransform, offset);
  offset += 2;
  const nContourStreamSize = readUint32BE(glyfTransform, offset);
  offset += 4;
  const nPointsStreamSize = readUint32BE(glyfTransform, offset);
  offset += 4;
  const flagStreamSize = readUint32BE(glyfTransform, offset);
  offset += 4;
  const glyphStreamSize = readUint32BE(glyfTransform, offset);
  offset += 4;
  const compositeStreamSize = readUint32BE(glyfTransform, offset);
  offset += 4;
  const bboxStreamSize = readUint32BE(glyfTransform, offset);
  offset += 4;
  const instructionStreamSize = readUint32BE(glyfTransform, offset);
  offset += 4;
  const nContourStream = glyfTransform.slice(offset, offset + nContourStreamSize);
  offset += nContourStreamSize;
  const nPointsStream = glyfTransform.slice(offset, offset + nPointsStreamSize);
  offset += nPointsStreamSize;
  const flagStream = glyfTransform.slice(offset, offset + flagStreamSize);
  offset += flagStreamSize;
  const glyphStream = glyfTransform.slice(offset, offset + glyphStreamSize);
  offset += glyphStreamSize;
  const compositeStream = glyfTransform.slice(offset, offset + compositeStreamSize);
  offset += compositeStreamSize;
  const bboxStream = glyfTransform.slice(offset, offset + bboxStreamSize);
  offset += bboxStreamSize;
  const instructionStream = glyfTransform.slice(offset, offset + instructionStreamSize);
  const nContourIdx = { value: 0 };
  const nPointsIdx = { value: 0 };
  const flagIdx = { value: 0 };
  const glyphIdx = { value: 0 };
  const compositeIdx = { value: 0 };
  const bboxIdx = { value: 0 };
  const instructionIdx = { value: 0 };
  const glyphOffsets = [0];
  const glyphParts = [];
  let totalGlyfSize = 0;
  for (let g = 0; g < numGlyphs; g++) {
    const nContours = readInt16BE(nContourStream, nContourIdx.value);
    nContourIdx.value += 2;
    if (nContours === 0) {
      glyphParts.push(new Uint8Array(0));
      glyphOffsets.push(totalGlyfSize);
      continue;
    }
    if (nContours > 0) {
      const glyphData = reconstructSimpleGlyph(
        nContours,
        nPointsStream,
        nPointsIdx,
        flagStream,
        flagIdx,
        glyphStream,
        glyphIdx,
        bboxStream,
        bboxIdx,
        instructionStream,
        instructionIdx,
        optionFlags
      );
      glyphParts.push(glyphData);
      totalGlyfSize += pad4(glyphData.length);
      glyphOffsets.push(totalGlyfSize);
    } else {
      const glyphData = reconstructCompositeGlyph(
        compositeStream,
        compositeIdx,
        bboxStream,
        bboxIdx,
        instructionStream,
        instructionIdx,
        optionFlags
      );
      glyphParts.push(glyphData);
      totalGlyfSize += pad4(glyphData.length);
      glyphOffsets.push(totalGlyfSize);
    }
  }
  const glyf = new Uint8Array(totalGlyfSize);
  let glyfOffset = 0;
  for (const part of glyphParts) {
    glyf.set(part, glyfOffset);
    glyfOffset += pad4(part.length);
  }
  const locaSize = indexFormat === 0 ? (numGlyphs + 1) * 2 : (numGlyphs + 1) * 4;
  const loca = new Uint8Array(locaSize);
  for (let i = 0; i <= numGlyphs; i++) {
    if (indexFormat === 0) {
      writeUint16BE(loca, i * 2, glyphOffsets[i] / 2);
    } else {
      writeUint32BE(loca, i * 4, glyphOffsets[i]);
    }
  }
  return { glyf, loca };
}
function reconstructSimpleGlyph(nContours, nPointsStream, nPointsIdx, flagStream, flagIdx, glyphStream, glyphIdx, bboxStream, bboxIdx, instructionStream, instructionIdx, optionFlags) {
  const endPtsOfContours = [];
  let totalPoints = 0;
  for (let c = 0; c < nContours; c++) {
    const nPoints = read255UInt16(nPointsStream, nPointsIdx);
    totalPoints += nPoints;
    endPtsOfContours.push(totalPoints - 1);
  }
  const points = decodeTriplets(flagStream, glyphStream, totalPoints, flagIdx, glyphIdx);
  let xMin, yMin, xMax, yMax;
  const bboxBitmap = (optionFlags & 1) === 0;
  if (bboxBitmap && bboxIdx.value + 8 <= bboxStream.length) {
    xMin = readInt16BE(bboxStream, bboxIdx.value);
    bboxIdx.value += 2;
    yMin = readInt16BE(bboxStream, bboxIdx.value);
    bboxIdx.value += 2;
    xMax = readInt16BE(bboxStream, bboxIdx.value);
    bboxIdx.value += 2;
    yMax = readInt16BE(bboxStream, bboxIdx.value);
    bboxIdx.value += 2;
  } else {
    xMin = yMin = 32767;
    xMax = yMax = -32768;
    for (const pt of points) {
      xMin = Math.min(xMin, pt.x);
      yMin = Math.min(yMin, pt.y);
      xMax = Math.max(xMax, pt.x);
      yMax = Math.max(yMax, pt.y);
    }
  }
  const instructionLength = read255UInt16(glyphStream, glyphIdx);
  const instructions = instructionStream.slice(instructionIdx.value, instructionIdx.value + instructionLength);
  instructionIdx.value += instructionLength;
  const xDeltas = [];
  const yDeltas = [];
  let prevX = 0, prevY = 0;
  for (const pt of points) {
    xDeltas.push(pt.x - prevX);
    yDeltas.push(pt.y - prevY);
    prevX = pt.x;
    prevY = pt.y;
  }
  const encodedFlags = [];
  const encodedX = [];
  const encodedY = [];
  for (let i = 0; i < totalPoints; i++) {
    let flag = points[i].onCurve ? 1 : 0;
    const dx = xDeltas[i];
    const dy = yDeltas[i];
    if (dx === 0) {
      flag |= 16;
    } else if (dx >= -255 && dx <= 255) {
      flag |= 2;
      if (dx > 0) flag |= 16;
      encodedX.push(Math.abs(dx));
    } else {
      encodedX.push(dx >> 8 & 255, dx & 255);
    }
    if (dy === 0) {
      flag |= 32;
    } else if (dy >= -255 && dy <= 255) {
      flag |= 4;
      if (dy > 0) flag |= 32;
      encodedY.push(Math.abs(dy));
    } else {
      encodedY.push(dy >> 8 & 255, dy & 255);
    }
    encodedFlags.push(flag);
  }
  const headerSize = 10 + nContours * 2 + 2 + instructionLength;
  const totalSize = headerSize + encodedFlags.length + encodedX.length + encodedY.length;
  const data = new Uint8Array(totalSize);
  let off = 0;
  writeUint16BE(data, off, nContours);
  off += 2;
  writeUint16BE(data, off, xMin & 65535);
  off += 2;
  writeUint16BE(data, off, yMin & 65535);
  off += 2;
  writeUint16BE(data, off, xMax & 65535);
  off += 2;
  writeUint16BE(data, off, yMax & 65535);
  off += 2;
  for (const endPt of endPtsOfContours) {
    writeUint16BE(data, off, endPt);
    off += 2;
  }
  writeUint16BE(data, off, instructionLength);
  off += 2;
  data.set(instructions, off);
  off += instructionLength;
  for (const f of encodedFlags) {
    data[off++] = f;
  }
  for (const x of encodedX) {
    data[off++] = x;
  }
  for (const y of encodedY) {
    data[off++] = y;
  }
  return data.slice(0, off);
}
function reconstructCompositeGlyph(compositeStream, compositeIdx, bboxStream, bboxIdx, instructionStream, instructionIdx, optionFlags) {
  const parts = [];
  const xMin = readInt16BE(bboxStream, bboxIdx.value);
  bboxIdx.value += 2;
  const yMin = readInt16BE(bboxStream, bboxIdx.value);
  bboxIdx.value += 2;
  const xMax = readInt16BE(bboxStream, bboxIdx.value);
  bboxIdx.value += 2;
  const yMax = readInt16BE(bboxStream, bboxIdx.value);
  bboxIdx.value += 2;
  parts.push(255, 255);
  parts.push(xMin >> 8 & 255, xMin & 255);
  parts.push(yMin >> 8 & 255, yMin & 255);
  parts.push(xMax >> 8 & 255, xMax & 255);
  parts.push(yMax >> 8 & 255, yMax & 255);
  let hasMoreComponents = true;
  let hasInstructions = false;
  while (hasMoreComponents) {
    const flags = readUint16BE(compositeStream, compositeIdx.value);
    compositeIdx.value += 2;
    const glyphIndex = readUint16BE(compositeStream, compositeIdx.value);
    compositeIdx.value += 2;
    parts.push(flags >> 8 & 255, flags & 255);
    parts.push(glyphIndex >> 8 & 255, glyphIndex & 255);
    if (flags & 1) {
      parts.push(compositeStream[compositeIdx.value++]);
      parts.push(compositeStream[compositeIdx.value++]);
      parts.push(compositeStream[compositeIdx.value++]);
      parts.push(compositeStream[compositeIdx.value++]);
    } else {
      parts.push(compositeStream[compositeIdx.value++]);
      parts.push(compositeStream[compositeIdx.value++]);
    }
    if (flags & 8) {
      parts.push(compositeStream[compositeIdx.value++]);
      parts.push(compositeStream[compositeIdx.value++]);
    } else if (flags & 64) {
      for (let i = 0; i < 4; i++) parts.push(compositeStream[compositeIdx.value++]);
    } else if (flags & 128) {
      for (let i = 0; i < 8; i++) parts.push(compositeStream[compositeIdx.value++]);
    }
    hasMoreComponents = (flags & 32) !== 0;
    if (flags & 256) hasInstructions = true;
  }
  if (hasInstructions) {
    const instrLen = read255UInt16(instructionStream, instructionIdx);
    parts.push(instrLen >> 8 & 255, instrLen & 255);
    for (let i = 0; i < instrLen; i++) {
      parts.push(instructionStream[instructionIdx.value++]);
    }
  }
  return new Uint8Array(parts);
}
async function woff2ToSfnt(buffer) {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const signature = view.getUint32(0, false);
  if (signature !== 2001684018) {
    throw new Error("Not a valid WOFF2 file");
  }
  const flavor = view.getUint32(4, false);
  const numTables = view.getUint16(12, false);
  const totalCompressedSize = view.getUint32(20, false);
  const offset = { value: 48 };
  const tables = parseTableDirectory(data, offset, numTables);
  const compressedData = data.slice(offset.value, offset.value + totalCompressedSize);
  const decompressedData = await decompressBrotli(compressedData);
  const tableData = /* @__PURE__ */ new Map();
  let decompOffset = 0;
  for (const table of tables) {
    const tdata = decompressedData.slice(decompOffset, decompOffset + table.transformLength);
    tableData.set(table.tag, tdata);
    decompOffset += table.transformLength;
  }
  const maxpData = tableData.get("maxp");
  const headData = tableData.get("head");
  if (!maxpData || !headData) {
    throw new Error("Missing required tables");
  }
  const numGlyphs = readUint16BE(maxpData, 4);
  const indexToLocFormat = readInt16BE(headData, 50);
  const glyfEntry = tables.find((t) => t.tag === "glyf");
  const locaEntry = tables.find((t) => t.tag === "loca");
  if (glyfEntry && glyfEntry.transformVersion === 0) {
    const glyfTransformed = tableData.get("glyf");
    const { glyf, loca } = reconstructGlyfLoca(glyfTransformed, numGlyphs, indexToLocFormat);
    tableData.set("glyf", glyf);
    tableData.set("loca", loca);
    glyfEntry.origLength = glyf.length;
    if (locaEntry) {
      locaEntry.origLength = loca.length;
    }
  }
  const headerSize = 12;
  const directorySize = numTables * 16;
  let tableOffset = headerSize + directorySize;
  const tableOffsets = [];
  for (const table of tables) {
    tableOffsets.push(tableOffset);
    tableOffset += pad4(table.origLength);
  }
  const output = new Uint8Array(tableOffset);
  const searchRange = Math.pow(2, Math.floor(Math.log2(numTables))) * 16;
  const entrySelector = Math.floor(Math.log2(numTables));
  const rangeShift = numTables * 16 - searchRange;
  writeUint32BE(output, 0, flavor);
  writeUint16BE(output, 4, numTables);
  writeUint16BE(output, 6, searchRange);
  writeUint16BE(output, 8, entrySelector);
  writeUint16BE(output, 10, rangeShift);
  let headOffset = -1;
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const tdata = tableData.get(table.tag);
    const dirOffset = headerSize + i * 16;
    if (table.tag === "head") headOffset = tableOffsets[i];
    for (let j = 0; j < 4; j++) {
      output[dirOffset + j] = table.tag.charCodeAt(j);
    }
    const checksum = calcChecksum(tdata, 0, tdata.length);
    writeUint32BE(output, dirOffset + 4, checksum);
    writeUint32BE(output, dirOffset + 8, tableOffsets[i]);
    writeUint32BE(output, dirOffset + 12, table.origLength);
    output.set(tdata.slice(0, table.origLength), tableOffsets[i]);
  }
  if (headOffset >= 0) {
    const totalChecksum = calcChecksum(output, 0, output.length);
    const checksumAdjustment = 2981146554 - totalChecksum >>> 0;
    writeUint32BE(output, headOffset + 8, checksumAdjustment);
  }
  return output.buffer;
}

// src/font/tables/base.ts
function parseBaseCoord(reader) {
  const format = reader.uint16();
  const coordinate = reader.int16();
  const result = { format, coordinate };
  if (format === 2) {
    result.referenceGlyph = reader.uint16();
    result.baseCoordPoint = reader.uint16();
  } else if (format === 3) {
    result.deviceOffset = reader.uint16();
  }
  return result;
}
function parseMinMax(reader, minMaxOffset) {
  if (minMaxOffset === 0) return null;
  const minMaxReader = reader.sliceFrom(minMaxOffset);
  const minCoordOffset = minMaxReader.uint16();
  const maxCoordOffset = minMaxReader.uint16();
  const featMinMaxCount = minMaxReader.uint16();
  let minCoord = null;
  let maxCoord = null;
  if (minCoordOffset !== 0) {
    const coordReader = reader.sliceFrom(minMaxOffset + minCoordOffset);
    minCoord = parseBaseCoord(coordReader).coordinate;
  }
  if (maxCoordOffset !== 0) {
    const coordReader = reader.sliceFrom(minMaxOffset + maxCoordOffset);
    maxCoord = parseBaseCoord(coordReader).coordinate;
  }
  const featMinMaxRecords = [];
  for (let i = 0; i < featMinMaxCount; i++) {
    const featureTag = minMaxReader.uint32();
    const minOffset = minMaxReader.uint16();
    const maxOffset = minMaxReader.uint16();
    let featMin = null;
    let featMax = null;
    if (minOffset !== 0) {
      const coordReader = reader.sliceFrom(minMaxOffset + minOffset);
      featMin = parseBaseCoord(coordReader).coordinate;
    }
    if (maxOffset !== 0) {
      const coordReader = reader.sliceFrom(minMaxOffset + maxOffset);
      featMax = parseBaseCoord(coordReader).coordinate;
    }
    featMinMaxRecords.push({
      featureTag,
      minCoord: featMin,
      maxCoord: featMax
    });
  }
  return { minCoord, maxCoord, featMinMaxRecords };
}
function parseBaseValues(reader, baseValuesOffset, _baseTagList) {
  if (baseValuesOffset === 0) return null;
  const bvReader = reader.sliceFrom(baseValuesOffset);
  const defaultBaselineIndex = bvReader.uint16();
  const baseCoordCount = bvReader.uint16();
  const coordOffsets = [];
  for (let i = 0; i < baseCoordCount; i++) {
    coordOffsets.push(bvReader.uint16());
  }
  const baseCoords = [];
  for (const offset of coordOffsets) {
    if (offset !== 0) {
      const coordReader = reader.sliceFrom(baseValuesOffset + offset);
      baseCoords.push(parseBaseCoord(coordReader).coordinate);
    } else {
      baseCoords.push(0);
    }
  }
  return { defaultBaselineIndex, baseCoords };
}
function parseBaseScriptRecord(reader, scriptOffset, baseTagList) {
  const scriptReader = reader.sliceFrom(scriptOffset);
  const baseValuesOffset = scriptReader.uint16();
  const defaultMinMaxOffset = scriptReader.uint16();
  const baseLangSysCount = scriptReader.uint16();
  const baseLangSysRecords = /* @__PURE__ */ new Map();
  const langSysData = [];
  for (let i = 0; i < baseLangSysCount; i++) {
    const tag2 = scriptReader.uint32();
    const offset = scriptReader.uint16();
    langSysData.push({ tag: tag2, offset });
  }
  const baseValues = parseBaseValues(
    reader,
    scriptOffset + baseValuesOffset,
    baseTagList
  );
  const defaultMinMax = parseMinMax(reader, scriptOffset + defaultMinMaxOffset);
  for (const { tag: tag2, offset } of langSysData) {
    const minMax = parseMinMax(reader, scriptOffset + offset);
    if (minMax) {
      baseLangSysRecords.set(tag2, minMax);
    }
  }
  return { baseValues, defaultMinMax, baseLangSysRecords };
}
function parseAxisTable(reader, axisOffset) {
  if (axisOffset === 0) return null;
  const axisReader = reader.sliceFrom(axisOffset);
  const baseTagListOffset = axisReader.uint16();
  const baseScriptListOffset = axisReader.uint16();
  const baseTagList = [];
  if (baseTagListOffset !== 0) {
    const tagReader = reader.sliceFrom(axisOffset + baseTagListOffset);
    const baseTagCount = tagReader.uint16();
    for (let i = 0; i < baseTagCount; i++) {
      baseTagList.push(tagReader.uint32());
    }
  }
  const baseScriptList = [];
  if (baseScriptListOffset !== 0) {
    const scriptListReader = reader.sliceFrom(
      axisOffset + baseScriptListOffset
    );
    const baseScriptCount = scriptListReader.uint16();
    const scriptData = [];
    for (let i = 0; i < baseScriptCount; i++) {
      const tag2 = scriptListReader.uint32();
      const offset = scriptListReader.uint16();
      scriptData.push({ tag: tag2, offset });
    }
    for (const { tag: tag2, offset } of scriptData) {
      const record = parseBaseScriptRecord(
        reader,
        axisOffset + baseScriptListOffset + offset,
        baseTagList
      );
      baseScriptList.push({ scriptTag: tag2, ...record });
    }
  }
  return { baseTagList, baseScriptList };
}
function parseBase(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const horizAxisOffset = reader.uint16();
  const vertAxisOffset = reader.uint16();
  const horizAxis = parseAxisTable(reader, horizAxisOffset);
  const vertAxis = parseAxisTable(reader, vertAxisOffset);
  return {
    majorVersion,
    minorVersion,
    horizAxis,
    vertAxis
  };
}

// src/font/tables/cbdt.ts
var CbdtImageFormat = {
  SmallMetrics: 1,
  // Small metrics, byte-aligned
  SmallMetricsPng: 17,
  // Small metrics + PNG
  BigMetrics: 2,
  // Big metrics, byte-aligned
  BigMetricsPng: 18,
  // Big metrics + PNG
  CompressedPng: 19
  // Metrics in CBLC + PNG
};
function parseCblc(reader) {
  const tableStart = reader.offset;
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const numSizes = reader.uint32();
  const bitmapSizes = [];
  for (let i = 0; i < numSizes; i++) {
    const indexSubTableArrayOffset = reader.uint32();
    const indexTablesSize = reader.uint32();
    const numberOfIndexSubTables = reader.uint32();
    const colorRef = reader.uint32();
    const hori = parseSbitLineMetrics(reader);
    const vert = parseSbitLineMetrics(reader);
    const startGlyphIndex = reader.uint16();
    const endGlyphIndex = reader.uint16();
    const ppemX = reader.uint8();
    const ppemY = reader.uint8();
    const bitDepth = reader.uint8();
    const flags = reader.int8();
    bitmapSizes.push({
      indexSubTableArrayOffset,
      indexTablesSize,
      numberOfIndexSubTables,
      colorRef,
      hori,
      vert,
      startGlyphIndex,
      endGlyphIndex,
      ppemX,
      ppemY,
      bitDepth,
      flags,
      indexSubTables: []
    });
  }
  for (const size of bitmapSizes) {
    const subTableReader = reader.sliceFrom(
      tableStart + size.indexSubTableArrayOffset
    );
    const subTableHeaders = [];
    for (let i = 0; i < size.numberOfIndexSubTables; i++) {
      subTableHeaders.push({
        firstGlyphIndex: subTableReader.uint16(),
        lastGlyphIndex: subTableReader.uint16(),
        additionalOffsetToIndexSubtable: subTableReader.uint32()
      });
    }
    for (const header of subTableHeaders) {
      const indexSubTable = parseIndexSubTable(
        reader,
        tableStart + size.indexSubTableArrayOffset + header.additionalOffsetToIndexSubtable,
        header.firstGlyphIndex,
        header.lastGlyphIndex
      );
      size.indexSubTables.push(indexSubTable);
    }
  }
  return { majorVersion, minorVersion, bitmapSizes };
}
function parseSbitLineMetrics(reader) {
  return {
    ascender: reader.int8(),
    descender: reader.int8(),
    widthMax: reader.uint8(),
    caretSlopeNumerator: reader.int8(),
    caretSlopeDenominator: reader.int8(),
    caretOffset: reader.int8(),
    minOriginSB: reader.int8(),
    minAdvanceSB: reader.int8(),
    maxBeforeBL: reader.int8(),
    minAfterBL: reader.int8(),
    pad1: reader.int8(),
    pad2: reader.int8()
  };
}
function parseIndexSubTable(reader, offset, firstGlyph, lastGlyph) {
  const subReader = reader.sliceFrom(offset);
  const indexFormat = subReader.uint16();
  const imageFormat = subReader.uint16();
  const imageDataOffset = subReader.uint32();
  const glyphOffsets = /* @__PURE__ */ new Map();
  const numGlyphs = lastGlyph - firstGlyph + 1;
  switch (indexFormat) {
    case 1: {
      const offsets = [];
      for (let i = 0; i <= numGlyphs; i++) {
        offsets.push(subReader.uint32());
      }
      for (let i = 0; i < numGlyphs; i++) {
        const glyphOffset = offsets[i];
        const nextOffset = offsets[i + 1];
        if (nextOffset > glyphOffset) {
          glyphOffsets.set(firstGlyph + i, {
            offset: imageDataOffset + glyphOffset,
            length: nextOffset - glyphOffset
          });
        }
      }
      break;
    }
    case 2: {
      const imageSize = subReader.uint32();
      const _bigMetrics = {
        height: subReader.uint8(),
        width: subReader.uint8(),
        horiBearingX: subReader.int8(),
        horiBearingY: subReader.int8(),
        horiAdvance: subReader.uint8(),
        vertBearingX: subReader.int8(),
        vertBearingY: subReader.int8(),
        vertAdvance: subReader.uint8()
      };
      for (let i = 0; i < numGlyphs; i++) {
        glyphOffsets.set(firstGlyph + i, {
          offset: imageDataOffset + i * imageSize,
          length: imageSize
        });
      }
      break;
    }
    case 3: {
      const offsets = [];
      for (let i = 0; i <= numGlyphs; i++) {
        offsets.push(subReader.uint16());
      }
      for (let i = 0; i < numGlyphs; i++) {
        const glyphOffset = offsets[i];
        const nextOffset = offsets[i + 1];
        if (nextOffset > glyphOffset) {
          glyphOffsets.set(firstGlyph + i, {
            offset: imageDataOffset + glyphOffset,
            length: nextOffset - glyphOffset
          });
        }
      }
      break;
    }
    case 4: {
      const numGlyphsActual = subReader.uint32();
      const glyphArray = [];
      for (let i = 0; i <= numGlyphsActual; i++) {
        glyphArray.push({
          glyphId: subReader.uint16(),
          offset: subReader.uint16()
        });
      }
      for (let i = 0; i < numGlyphsActual; i++) {
        const entry = glyphArray[i];
        const nextEntry = glyphArray[i + 1];
        glyphOffsets.set(entry.glyphId, {
          offset: imageDataOffset + entry.offset,
          length: nextEntry.offset - entry.offset
        });
      }
      break;
    }
    case 5: {
      const imageSize = subReader.uint32();
      subReader.skip(8);
      const numGlyphsActual = subReader.uint32();
      for (let i = 0; i < numGlyphsActual; i++) {
        const glyphId = subReader.uint16();
        glyphOffsets.set(glyphId, {
          offset: imageDataOffset + i * imageSize,
          length: imageSize
        });
      }
      break;
    }
  }
  return {
    firstGlyphIndex: firstGlyph,
    lastGlyphIndex: lastGlyph,
    indexFormat,
    imageFormat,
    imageDataOffset,
    glyphOffsets
  };
}
function parseCbdt(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const data = reader.bytes(reader.remaining);
  return { majorVersion, minorVersion, data };
}
function getBitmapGlyph(cblc, cbdt, glyphId, ppem) {
  let bestSize = null;
  let bestDiff = Infinity;
  for (const size of cblc.bitmapSizes) {
    if (glyphId < size.startGlyphIndex || glyphId > size.endGlyphIndex) {
      continue;
    }
    const diff = Math.abs(size.ppemX - ppem);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSize = size;
    }
  }
  if (!bestSize) return null;
  for (const subTable of bestSize.indexSubTables) {
    const glyphInfo = subTable.glyphOffsets.get(glyphId);
    if (!glyphInfo) continue;
    const glyphData = cbdt.data.slice(
      glyphInfo.offset - 4,
      // Adjust for CBDT header
      glyphInfo.offset - 4 + glyphInfo.length
    );
    return parseGlyphData(glyphData, subTable.imageFormat);
  }
  return null;
}
function parseGlyphData(data, imageFormat) {
  if (data.length === 0) return null;
  let offset = 0;
  let metrics;
  switch (imageFormat) {
    case 1:
    case 2:
    case 17:
    case 18: {
      if (imageFormat === 1 || imageFormat === 17) {
        metrics = {
          height: data[offset++],
          width: data[offset++],
          bearingX: data[offset++] << 24 >> 24,
          // Sign extend
          bearingY: data[offset++] << 24 >> 24,
          advance: data[offset++]
        };
      } else {
        metrics = {
          height: data[offset++],
          width: data[offset++],
          bearingX: data[offset++] << 24 >> 24,
          bearingY: data[offset++] << 24 >> 24,
          advance: data[offset++]
        };
        offset += 3;
      }
      break;
    }
    case 19: {
      metrics = { height: 0, width: 0, bearingX: 0, bearingY: 0, advance: 0 };
      break;
    }
    default:
      return null;
  }
  return {
    metrics,
    imageFormat,
    data: data.slice(offset)
  };
}
function hasColorBitmap(cblc, glyphId, ppem) {
  for (const size of cblc.bitmapSizes) {
    if (ppem !== void 0 && size.ppemX !== ppem) continue;
    if (glyphId < size.startGlyphIndex || glyphId > size.endGlyphIndex) {
      continue;
    }
    for (const subTable of size.indexSubTables) {
      if (subTable.glyphOffsets.has(glyphId)) {
        return true;
      }
    }
  }
  return false;
}
function getColorBitmapSizes(cblc) {
  const sizes = /* @__PURE__ */ new Set();
  for (const size of cblc.bitmapSizes) {
    sizes.add(size.ppemX);
  }
  return Array.from(sizes).sort((a, b) => a - b);
}

// src/font/tables/cff.ts
var STANDARD_STRINGS = [
  ".notdef",
  "space",
  "exclam",
  "quotedbl",
  "numbersign",
  "dollar",
  "percent",
  "ampersand",
  "quoteright",
  "parenleft",
  "parenright",
  "asterisk",
  "plus",
  "comma",
  "hyphen",
  "period",
  "slash",
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "colon",
  "semicolon",
  "less",
  "equal",
  "greater",
  "question",
  "at",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "bracketleft",
  "backslash",
  "bracketright",
  "asciicircum",
  "underscore",
  "quoteleft",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "braceleft",
  "bar",
  "braceright",
  "asciitilde",
  "exclamdown",
  "cent",
  "sterling",
  "fraction",
  "yen",
  "florin",
  "section",
  "currency",
  "quotesingle",
  "quotedblleft",
  "guillemotleft",
  "guilsinglleft",
  "guilsinglright",
  "fi",
  "fl",
  "endash",
  "dagger",
  "daggerdbl",
  "periodcentered",
  "paragraph",
  "bullet",
  "quotesinglbase",
  "quotedblbase",
  "quotedblright",
  "guillemotright",
  "ellipsis",
  "perthousand",
  "questiondown",
  "grave",
  "acute",
  "circumflex",
  "tilde",
  "macron",
  "breve",
  "dotaccent",
  "dieresis",
  "ring",
  "cedilla",
  "hungarumlaut",
  "ogonek",
  "caron",
  "emdash",
  "AE",
  "ordfeminine",
  "Lslash",
  "Oslash",
  "OE",
  "ordmasculine",
  "ae",
  "dotlessi",
  "lslash",
  "oslash",
  "oe",
  "germandbls",
  "onesuperior",
  "logicalnot",
  "mu",
  "trademark",
  "Eth",
  "onehalf",
  "plusminus",
  "Thorn",
  "onequarter",
  "divide",
  "brokenbar",
  "degree",
  "thorn",
  "threequarters",
  "twosuperior",
  "registered",
  "minus",
  "eth",
  "multiply",
  "threesuperior",
  "copyright",
  "Aacute",
  "Acircumflex",
  "Adieresis",
  "Agrave",
  "Aring",
  "Atilde",
  "Ccedilla",
  "Eacute",
  "Ecircumflex",
  "Edieresis",
  "Egrave",
  "Iacute",
  "Icircumflex",
  "Idieresis",
  "Igrave",
  "Ntilde",
  "Oacute",
  "Ocircumflex",
  "Odieresis",
  "Ograve",
  "Otilde",
  "Scaron",
  "Uacute",
  "Ucircumflex",
  "Udieresis",
  "Ugrave",
  "Yacute",
  "Ydieresis",
  "Zcaron",
  "aacute",
  "acircumflex",
  "adieresis",
  "agrave",
  "aring",
  "atilde",
  "ccedilla",
  "eacute",
  "ecircumflex",
  "edieresis",
  "egrave",
  "iacute",
  "icircumflex",
  "idieresis",
  "igrave",
  "ntilde",
  "oacute",
  "ocircumflex",
  "odieresis",
  "ograve",
  "otilde",
  "scaron",
  "uacute",
  "ucircumflex",
  "udieresis",
  "ugrave",
  "yacute",
  "ydieresis",
  "zcaron",
  "exclamsmall",
  "Hungarumlautsmall",
  "dollaroldstyle",
  "dollarsuperior",
  "ampersandsmall",
  "Acutesmall",
  "parenleftsuperior",
  "parenrightsuperior",
  "twodotenleader",
  "onedotenleader",
  "zerooldstyle",
  "oneoldstyle",
  "twooldstyle",
  "threeoldstyle",
  "fouroldstyle",
  "fiveoldstyle",
  "sixoldstyle",
  "sevenoldstyle",
  "eightoldstyle",
  "nineoldstyle",
  "commasuperior",
  "threequartersemdash",
  "periodsuperior",
  "questionsmall",
  "asuperior",
  "bsuperior",
  "centsuperior",
  "dsuperior",
  "esuperior",
  "isuperior",
  "lsuperior",
  "msuperior",
  "nsuperior",
  "osuperior",
  "rsuperior",
  "ssuperior",
  "tsuperior",
  "ff",
  "ffi",
  "ffl",
  "parenleftinferior",
  "parenrightinferior",
  "Circumflexsmall",
  "hyphensuperior",
  "Gravesmall",
  "Asmall",
  "Bsmall",
  "Csmall",
  "Dsmall",
  "Esmall",
  "Fsmall",
  "Gsmall",
  "Hsmall",
  "Ismall",
  "Jsmall",
  "Ksmall",
  "Lsmall",
  "Msmall",
  "Nsmall",
  "Osmall",
  "Psmall",
  "Qsmall",
  "Rsmall",
  "Ssmall",
  "Tsmall",
  "Usmall",
  "Vsmall",
  "Wsmall",
  "Xsmall",
  "Ysmall",
  "Zsmall",
  "colonmonetary",
  "onefitted",
  "rupiah",
  "Tildesmall",
  "exclamdownsmall",
  "centoldstyle",
  "Lslashsmall",
  "Scaronsmall",
  "Zcaronsmall",
  "Dieresissmall",
  "Brevesmall",
  "Caronsmall",
  "Dotaccentsmall",
  "Macronsmall",
  "figuredash",
  "hypheninferior",
  "Ogoneksmall",
  "Ringsmall",
  "Cedillasmall",
  "questiondownsmall",
  "oneeighth",
  "threeeighths",
  "fiveeighths",
  "seveneighths",
  "onethird",
  "twothirds",
  "zerosuperior",
  "foursuperior",
  "fivesuperior",
  "sixsuperior",
  "sevensuperior",
  "eightsuperior",
  "ninesuperior",
  "zeroinferior",
  "oneinferior",
  "twoinferior",
  "threeinferior",
  "fourinferior",
  "fiveinferior",
  "sixinferior",
  "seveninferior",
  "eightinferior",
  "nineinferior",
  "centinferior",
  "dollarinferior",
  "periodinferior",
  "commainferior",
  "Agravesmall",
  "Aacutesmall",
  "Acircumflexsmall",
  "Atildesmall",
  "Adieresissmall",
  "Aringsmall",
  "AEsmall",
  "Ccedillasmall",
  "Egravesmall",
  "Eacutesmall",
  "Ecircumflexsmall",
  "Edieresissmall",
  "Igravesmall",
  "Iacutesmall",
  "Icircumflexsmall",
  "Idieresissmall",
  "Ethsmall",
  "Ntildesmall",
  "Ogravesmall",
  "Oacutesmall",
  "Ocircumflexsmall",
  "Otildesmall",
  "Odieresissmall",
  "OEsmall",
  "Oslashsmall",
  "Ugravesmall",
  "Uacutesmall",
  "Ucircumflexsmall",
  "Udieresissmall",
  "Yacutesmall",
  "Thornsmall",
  "Ydieresissmall",
  "001.000",
  "001.001",
  "001.002",
  "001.003",
  "Black",
  "Bold",
  "Book",
  "Light",
  "Medium",
  "Regular",
  "Roman",
  "Semibold"
];
function parseCff(reader) {
  const startOffset = reader.offset;
  const major = reader.uint8();
  const minor = reader.uint8();
  const hdrSize = reader.uint8();
  const _offSize = reader.uint8();
  reader.seek(startOffset + hdrSize);
  const names = parseIndex(reader).map(
    (data) => new TextDecoder().decode(data)
  );
  const topDictData = parseIndex(reader);
  const topDicts = [];
  const stringData = parseIndex(reader);
  const strings = stringData.map((data) => new TextDecoder().decode(data));
  const globalSubrs = parseIndex(reader);
  for (const data of topDictData) {
    topDicts.push(
      parseTopDict(
        new Reader(
          data.buffer,
          data.byteOffset,
          data.byteLength
        ),
        strings
      )
    );
  }
  const charStrings = [];
  const localSubrs = [];
  const fdArrays = [];
  const fdSelects = [];
  for (const topDict of topDicts) {
    if (topDict.charStrings !== void 0) {
      reader.seek(startOffset + topDict.charStrings);
      charStrings.push(parseIndex(reader));
    } else {
      charStrings.push([]);
    }
    if (topDict.private) {
      const [privateSize, privateOffset] = topDict.private;
      const privateDict = parsePrivateDict(
        reader.slice(privateOffset, privateSize),
        strings
      );
      if (privateDict.subrs !== void 0) {
        reader.seek(startOffset + privateOffset + privateDict.subrs);
        localSubrs.push(parseIndex(reader));
      } else {
        localSubrs.push([]);
      }
    } else {
      localSubrs.push([]);
    }
    if (topDict.fdArray !== void 0) {
      reader.seek(startOffset + topDict.fdArray);
      const fdData = parseIndex(reader);
      const fds = [];
      for (const data of fdData) {
        const fdDict = parseTopDict(
          new Reader(
            data.buffer,
            data.byteOffset,
            data.byteLength
          ),
          strings
        );
        if (fdDict.private) {
          const [fdPrivateSize, fdPrivateOffset] = fdDict.private;
          const fdPrivateDict = parsePrivateDict(
            reader.slice(startOffset + fdPrivateOffset, fdPrivateSize),
            strings
          );
          Object.assign(fdDict, fdPrivateDict);
          if (fdPrivateDict.subrs !== void 0) {
            reader.seek(startOffset + fdPrivateOffset + fdPrivateDict.subrs);
            fdDict.localSubrs = parseIndex(reader);
          }
        }
        fds.push(fdDict);
      }
      fdArrays.push(fds);
    } else {
      fdArrays.push([]);
    }
    if (topDict.fdSelect !== void 0) {
      reader.seek(startOffset + topDict.fdSelect);
      const lastCharStrings = charStrings[charStrings.length - 1];
      fdSelects.push(parseFDSelect(reader, lastCharStrings?.length ?? 0));
    } else {
      fdSelects.push({ format: 0, select: () => 0 });
    }
  }
  return {
    version: { major, minor },
    names,
    topDicts,
    strings,
    globalSubrs,
    charStrings,
    localSubrs,
    fdArrays,
    fdSelects
  };
}
function parseIndex(reader) {
  const count = reader.uint16();
  if (count === 0) return [];
  const offSize = reader.uint8();
  const offsets = [];
  for (let i = 0; i <= count; i++) {
    offsets.push(readOffset(reader, offSize));
  }
  const result = [];
  for (let i = 0; i < count; i++) {
    const start = offsets[i];
    const end = offsets[i + 1];
    if (start === void 0 || end === void 0) continue;
    const length = end - start;
    result.push(reader.bytes(length));
  }
  return result;
}
function readOffset(reader, offSize) {
  switch (offSize) {
    case 1:
      return reader.uint8();
    case 2:
      return reader.uint16();
    case 3:
      return reader.uint24();
    case 4:
      return reader.uint32();
    default:
      throw new Error(`Invalid offset size: ${offSize}`);
  }
}
function parseDict(reader) {
  const result = /* @__PURE__ */ new Map();
  const operands = [];
  while (reader.remaining > 0) {
    const b0 = reader.uint8();
    if (b0 <= 21) {
      let op = b0;
      if (b0 === 12) {
        op = 3072 | reader.uint8();
      }
      result.set(op, [...operands]);
      operands.length = 0;
    } else if (b0 === 28) {
      operands.push(reader.int16());
    } else if (b0 === 29) {
      operands.push(reader.int32());
    } else if (b0 === 30) {
      operands.push(parseReal(reader));
    } else if (b0 >= 32 && b0 <= 246) {
      operands.push(b0 - 139);
    } else if (b0 >= 247 && b0 <= 250) {
      const b1 = reader.uint8();
      operands.push((b0 - 247) * 256 + b1 + 108);
    } else if (b0 >= 251 && b0 <= 254) {
      const b1 = reader.uint8();
      operands.push(-(b0 - 251) * 256 - b1 - 108);
    }
  }
  return result;
}
function parseReal(reader) {
  let str = "";
  const nibbleChars = "0123456789.EE -";
  let done = false;
  while (!done) {
    const byte = reader.uint8();
    for (let i = 0; i < 2; i++) {
      const nibble = i === 0 ? byte >> 4 : byte & 15;
      if (nibble === 15) {
        done = true;
        break;
      }
      if (nibble === 12) {
        str += "E-";
      } else {
        str += nibbleChars[nibble];
      }
    }
  }
  return parseFloat(str);
}
function parseTopDict(reader, strings) {
  const dict = parseDict(reader);
  const result = {};
  const getString = (sid) => {
    if (sid < STANDARD_STRINGS.length) {
      const str = STANDARD_STRINGS[sid];
      return str ?? "";
    }
    return strings[sid - STANDARD_STRINGS.length] ?? "";
  };
  for (const [op, operands] of dict) {
    const op0 = operands[0];
    const op1 = operands[1];
    const op2 = operands[2];
    switch (op) {
      case 0 /* version */:
        if (op0 !== void 0) result.version = getString(op0);
        break;
      case 1 /* Notice */:
        if (op0 !== void 0) result.notice = getString(op0);
        break;
      case 3072 /* Copyright */:
        if (op0 !== void 0) result.copyright = getString(op0);
        break;
      case 2 /* FullName */:
        if (op0 !== void 0) result.fullName = getString(op0);
        break;
      case 3 /* FamilyName */:
        if (op0 !== void 0) result.familyName = getString(op0);
        break;
      case 4 /* Weight */:
        if (op0 !== void 0) result.weight = getString(op0);
        break;
      case 3073 /* isFixedPitch */:
        result.isFixedPitch = op0 !== 0;
        break;
      case 3074 /* ItalicAngle */:
        result.italicAngle = op0;
        break;
      case 3075 /* UnderlinePosition */:
        result.underlinePosition = op0;
        break;
      case 3076 /* UnderlineThickness */:
        result.underlineThickness = op0;
        break;
      case 3077 /* PaintType */:
        result.paintType = op0;
        break;
      case 3078 /* CharstringType */:
        result.charstringType = op0;
        break;
      case 3079 /* FontMatrix */:
        result.fontMatrix = operands;
        break;
      case 13 /* UniqueID */:
        result.uniqueID = op0;
        break;
      case 5 /* FontBBox */:
        result.fontBBox = operands;
        break;
      case 3080 /* StrokeWidth */:
        result.strokeWidth = op0;
        break;
      case 15 /* charset */:
        result.charset = op0;
        break;
      case 16 /* Encoding */:
        result.encoding = op0;
        break;
      case 17 /* CharStrings */:
        result.charStrings = op0;
        break;
      case 18 /* Private */:
        if (op0 !== void 0 && op1 !== void 0) {
          result.private = [op0, op1];
        }
        break;
      case 3092 /* SyntheticBase */:
        result.syntheticBase = op0;
        break;
      case 3093 /* PostScript */:
        if (op0 !== void 0) result.postScript = getString(op0);
        break;
      case 3094 /* BaseFontName */:
        if (op0 !== void 0) result.baseFontName = getString(op0);
        break;
      case 3095 /* BaseFontBlend */:
        result.baseFontBlend = operands;
        break;
      case 3102 /* ROS */:
        if (op0 !== void 0 && op1 !== void 0 && op2 !== void 0) {
          result.ros = {
            registry: getString(op0),
            ordering: getString(op1),
            supplement: op2
          };
        }
        break;
      case 3103 /* CIDFontVersion */:
        result.cidFontVersion = op0;
        break;
      case 3104 /* CIDFontRevision */:
        result.cidFontRevision = op0;
        break;
      case 3105 /* CIDFontType */:
        result.cidFontType = op0;
        break;
      case 3106 /* CIDCount */:
        result.cidCount = op0;
        break;
      case 3107 /* UIDBase */:
        result.uidBase = op0;
        break;
      case 3108 /* FDArray */:
        result.fdArray = op0;
        break;
      case 3109 /* FDSelect */:
        result.fdSelect = op0;
        break;
      case 3110 /* FontName */:
        if (op0 !== void 0) result.fontName = getString(op0);
        break;
    }
  }
  return result;
}
function parsePrivateDict(reader, _strings) {
  const dict = parseDict(reader);
  const result = {};
  for (const [op, operands] of dict) {
    const op0 = operands[0];
    switch (op) {
      case 6 /* BlueValues */:
        result.blueValues = deltaToAbsolute(operands);
        break;
      case 7 /* OtherBlues */:
        result.otherBlues = deltaToAbsolute(operands);
        break;
      case 8 /* FamilyBlues */:
        result.familyBlues = deltaToAbsolute(operands);
        break;
      case 9 /* FamilyOtherBlues */:
        result.familyOtherBlues = deltaToAbsolute(operands);
        break;
      case 3081 /* BlueScale */:
        result.blueScale = op0;
        break;
      case 3082 /* BlueShift */:
        result.blueShift = op0;
        break;
      case 3083 /* BlueFuzz */:
        result.blueFuzz = op0;
        break;
      case 10 /* StdHW */:
        result.stdHW = op0;
        break;
      case 11 /* StdVW */:
        result.stdVW = op0;
        break;
      case 3084 /* StemSnapH */:
        result.stemSnapH = deltaToAbsolute(operands);
        break;
      case 3085 /* StemSnapV */:
        result.stemSnapV = deltaToAbsolute(operands);
        break;
      case 3086 /* ForceBold */:
        result.forceBold = op0 !== 0;
        break;
      case 3089 /* LanguageGroup */:
        result.languageGroup = op0;
        break;
      case 3090 /* ExpansionFactor */:
        result.expansionFactor = op0;
        break;
      case 3091 /* initialRandomSeed */:
        result.initialRandomSeed = op0;
        break;
      case 19 /* Subrs */:
        result.subrs = op0;
        break;
      case 20 /* defaultWidthX */:
        result.defaultWidthX = op0;
        break;
      case 21 /* nominalWidthX */:
        result.nominalWidthX = op0;
        break;
    }
  }
  return result;
}
function deltaToAbsolute(deltas) {
  const result = [];
  let value = 0;
  for (const delta of deltas) {
    value += delta;
    result.push(value);
  }
  return result;
}
function parseFDSelect(reader, numGlyphs) {
  const format = reader.uint8();
  if (format === 0) {
    const fds = reader.uint8Array(numGlyphs);
    return {
      format,
      select: (glyphId) => fds[glyphId] ?? 0
    };
  } else if (format === 3) {
    const nRanges = reader.uint16();
    const ranges = [];
    for (let i = 0; i < nRanges; i++) {
      ranges.push({
        first: reader.uint16(),
        fd: reader.uint8()
      });
    }
    const _sentinel = reader.uint16();
    return {
      format,
      select: (glyphId) => {
        let lo = 0;
        let hi = ranges.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          const range = ranges[mid];
          if (range && range.first <= glyphId) {
            lo = mid;
          } else {
            hi = mid - 1;
          }
        }
        const foundRange = ranges[lo];
        return foundRange?.fd ?? 0;
      }
    };
  }
  return { format, select: () => 0 };
}

// src/font/tables/cff2.ts
function parseCff2(reader) {
  const startOffset = reader.offset;
  const major = reader.uint8();
  const minor = reader.uint8();
  const headerSize = reader.uint8();
  const topDictLength = reader.uint16();
  reader.seek(startOffset + headerSize);
  const topDictReader = reader.slice(
    reader.offset - startOffset,
    topDictLength
  );
  reader.skip(topDictLength);
  const topDict = parseCff2TopDict(topDictReader);
  const globalSubrs = parseIndex2(reader);
  let charStrings = [];
  if (topDict.charStrings !== void 0) {
    reader.seek(startOffset + topDict.charStrings);
    charStrings = parseIndex2(reader);
  }
  const fdArray = [];
  if (topDict.fdArray !== void 0) {
    reader.seek(startOffset + topDict.fdArray);
    const fdDictData = parseIndex2(reader);
    for (const data of fdDictData) {
      const fd = parseCff2FDDict(
        new Reader(
          data.buffer,
          data.byteOffset,
          data.byteLength
        )
      );
      if (fd.privateOffset !== void 0 && fd.privateSize !== void 0) {
        reader.seek(startOffset + fd.privateOffset);
        const privateReader = reader.slice(0, fd.privateSize);
        fd.private = parseCff2PrivateDict(privateReader);
        if (fd.private.subrs !== void 0) {
          reader.seek(startOffset + fd.privateOffset + fd.private.subrs);
          fd.localSubrs = parseIndex2(reader);
        }
      }
      fdArray.push(fd);
    }
  }
  let fdSelect = null;
  if (topDict.fdSelect !== void 0) {
    reader.seek(startOffset + topDict.fdSelect);
    fdSelect = parseFDSelect2(reader, charStrings.length);
  }
  let vstore = null;
  if (topDict.vstore !== void 0) {
    reader.seek(startOffset + topDict.vstore);
    vstore = parseItemVariationStore2(reader);
  }
  return {
    version: { major, minor },
    topDict,
    globalSubrs,
    charStrings,
    fdArray,
    fdSelect,
    vstore
  };
}
function parseIndex2(reader) {
  const count = reader.uint32();
  if (count === 0) return [];
  const offSize = reader.uint8();
  const offsets = [];
  for (let i = 0; i <= count; i++) {
    offsets.push(readOffset2(reader, offSize));
  }
  const result = [];
  for (let i = 0; i < count; i++) {
    const start = offsets[i];
    const end = offsets[i + 1];
    if (start === void 0 || end === void 0) continue;
    const length = end - start;
    result.push(reader.bytes(length));
  }
  return result;
}
function readOffset2(reader, offSize) {
  switch (offSize) {
    case 1:
      return reader.uint8();
    case 2:
      return reader.uint16();
    case 3:
      return reader.uint24();
    case 4:
      return reader.uint32();
    default:
      throw new Error(`Invalid offset size: ${offSize}`);
  }
}
function parseDict2(reader) {
  const result = /* @__PURE__ */ new Map();
  const operands = [];
  while (reader.remaining > 0) {
    const b0 = reader.uint8();
    if (b0 <= 21) {
      let op = b0;
      if (b0 === 12) {
        op = 3072 | reader.uint8();
      }
      result.set(op, [...operands]);
      operands.length = 0;
    } else if (b0 === 22) {
      result.set(22, [...operands]);
      operands.length = 0;
    } else if (b0 === 23) {
      result.set(23, [...operands]);
      operands.length = 0;
    } else if (b0 === 24) {
      result.set(24, [...operands]);
      operands.length = 0;
    } else if (b0 === 28) {
      operands.push(reader.int16());
    } else if (b0 === 29) {
      operands.push(reader.int32());
    } else if (b0 === 30) {
      operands.push(parseReal2(reader));
    } else if (b0 >= 32 && b0 <= 246) {
      operands.push(b0 - 139);
    } else if (b0 >= 247 && b0 <= 250) {
      const b1 = reader.uint8();
      operands.push((b0 - 247) * 256 + b1 + 108);
    } else if (b0 >= 251 && b0 <= 254) {
      const b1 = reader.uint8();
      operands.push(-(b0 - 251) * 256 - b1 - 108);
    }
  }
  return result;
}
function parseReal2(reader) {
  let str = "";
  const nibbleChars = "0123456789.EE -";
  let done = false;
  while (!done) {
    const byte = reader.uint8();
    for (let i = 0; i < 2; i++) {
      const nibble = i === 0 ? byte >> 4 : byte & 15;
      if (nibble === 15) {
        done = true;
        break;
      }
      if (nibble === 12) {
        str += "E-";
      } else {
        const char = nibbleChars[nibble];
        if (char !== void 0) str += char;
      }
    }
  }
  return parseFloat(str);
}
function parseCff2TopDict(reader) {
  const dict = parseDict2(reader);
  const result = {};
  for (const [op, operands] of dict) {
    switch (op) {
      case 3079 /* FontMatrix */:
        result.fontMatrix = operands;
        break;
      case 17 /* CharStrings */:
        result.charStrings = operands[0];
        break;
      case 3108 /* FDArray */:
        result.fdArray = operands[0];
        break;
      case 3109 /* FDSelect */:
        result.fdSelect = operands[0];
        break;
      case 24 /* vstore */:
        result.vstore = operands[0];
        break;
    }
  }
  return result;
}
function parseCff2FDDict(reader) {
  const dict = parseDict2(reader);
  const result = {};
  const privateOp = dict.get(18);
  if (privateOp && privateOp.length >= 2) {
    result.privateSize = privateOp[0];
    result.privateOffset = privateOp[1];
  }
  return result;
}
function parseCff2PrivateDict(reader) {
  const dict = parseDict2(reader);
  const result = {};
  for (const [op, operands] of dict) {
    const op0 = operands[0];
    switch (op) {
      case 6 /* BlueValues */:
        result.blueValues = deltaToAbsolute2(operands);
        break;
      case 7 /* OtherBlues */:
        result.otherBlues = deltaToAbsolute2(operands);
        break;
      case 8 /* FamilyBlues */:
        result.familyBlues = deltaToAbsolute2(operands);
        break;
      case 9 /* FamilyOtherBlues */:
        result.familyOtherBlues = deltaToAbsolute2(operands);
        break;
      case 3081 /* BlueScale */:
        result.blueScale = op0;
        break;
      case 3082 /* BlueShift */:
        result.blueShift = op0;
        break;
      case 3083 /* BlueFuzz */:
        result.blueFuzz = op0;
        break;
      case 10 /* StdHW */:
        result.stdHW = op0;
        break;
      case 11 /* StdVW */:
        result.stdVW = op0;
        break;
      case 3084 /* StemSnapH */:
        result.stemSnapH = deltaToAbsolute2(operands);
        break;
      case 3085 /* StemSnapV */:
        result.stemSnapV = deltaToAbsolute2(operands);
        break;
      case 3089 /* LanguageGroup */:
        result.languageGroup = op0;
        break;
      case 3090 /* ExpansionFactor */:
        result.expansionFactor = op0;
        break;
      case 19 /* Subrs */:
        result.subrs = op0;
        break;
      case 22 /* vsindex */:
        result.vsindex = op0;
        break;
      case 23 /* blend */:
        result.blend = operands;
        break;
    }
  }
  return result;
}
function deltaToAbsolute2(deltas) {
  const result = [];
  let value = 0;
  for (const delta of deltas) {
    value += delta;
    result.push(value);
  }
  return result;
}
function parseFDSelect2(reader, numGlyphs) {
  const format = reader.uint8();
  if (format === 0) {
    const fds = reader.uint8Array(numGlyphs);
    return {
      format,
      select: (glyphId) => fds[glyphId] ?? 0
    };
  } else if (format === 3) {
    const nRanges = reader.uint16();
    const ranges = [];
    for (let i = 0; i < nRanges; i++) {
      ranges.push({
        first: reader.uint16(),
        fd: reader.uint8()
      });
    }
    reader.uint16();
    return {
      format,
      select: (glyphId) => {
        let lo = 0;
        let hi = ranges.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          const range = ranges[mid];
          if (range && range.first <= glyphId) {
            lo = mid;
          } else {
            hi = mid - 1;
          }
        }
        const foundRange = ranges[lo];
        return foundRange?.fd ?? 0;
      }
    };
  } else if (format === 4) {
    const nRanges = reader.uint32();
    const ranges = [];
    for (let i = 0; i < nRanges; i++) {
      ranges.push({
        first: reader.uint32(),
        fd: reader.uint16()
      });
    }
    reader.uint32();
    return {
      format,
      select: (glyphId) => {
        let lo = 0;
        let hi = ranges.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          const range = ranges[mid];
          if (range && range.first <= glyphId) {
            lo = mid;
          } else {
            hi = mid - 1;
          }
        }
        const foundRange = ranges[lo];
        return foundRange?.fd ?? 0;
      }
    };
  }
  return { format, select: () => 0 };
}
function parseItemVariationStore2(reader) {
  const startOffset = reader.offset;
  const _length = reader.uint16();
  const format = reader.uint16();
  const variationRegionListOffset = reader.uint32();
  const itemVariationDataCount = reader.uint16();
  const itemVariationDataOffsets = [];
  for (let i = 0; i < itemVariationDataCount; i++) {
    itemVariationDataOffsets.push(reader.uint32());
  }
  reader.seek(startOffset + variationRegionListOffset);
  const variationRegionList = parseVariationRegionList(reader);
  const itemVariationData = [];
  for (const offset of itemVariationDataOffsets) {
    reader.seek(startOffset + offset);
    itemVariationData.push(parseItemVariationData(reader));
  }
  return {
    format,
    variationRegionList,
    itemVariationData
  };
}
function parseVariationRegionList(reader) {
  const axisCount = reader.uint16();
  const regionCount = reader.uint16();
  const regions = [];
  for (let i = 0; i < regionCount; i++) {
    const axes = [];
    for (let j = 0; j < axisCount; j++) {
      axes.push({
        startCoord: reader.f2dot14(),
        peakCoord: reader.f2dot14(),
        endCoord: reader.f2dot14()
      });
    }
    regions.push({ axes });
  }
  return { axisCount, regionCount, regions };
}
function parseItemVariationData(reader) {
  const itemCount = reader.uint16();
  const wordDeltaCount = reader.uint16();
  const regionIndexCount = wordDeltaCount & 32767;
  const longWords = (wordDeltaCount & 32768) !== 0;
  const regionIndexes = [];
  for (let i = 0; i < regionIndexCount; i++) {
    regionIndexes.push(reader.uint16());
  }
  const deltaSets = [];
  for (let i = 0; i < itemCount; i++) {
    const deltas = [];
    for (let j = 0; j < regionIndexCount; j++) {
      if (longWords) {
        deltas.push(reader.int32());
      } else {
        deltas.push(reader.int16());
      }
    }
    deltaSets.push(deltas);
  }
  return {
    itemCount,
    regionIndexCount,
    regionIndexes,
    deltaSets
  };
}

// src/font/tables/cmap.ts
function parseCmap(reader, tableLength) {
  const _tableStart = reader.offset;
  const version = reader.uint16();
  const numTables = reader.uint16();
  const encodingRecords = [];
  for (let i = 0; i < numTables; i++) {
    encodingRecords.push({
      platformId: reader.uint16(),
      encodingId: reader.uint16(),
      offset: reader.uint32()
    });
  }
  const subtables = /* @__PURE__ */ new Map();
  const parsedOffsets = /* @__PURE__ */ new Set();
  for (const record of encodingRecords) {
    if (parsedOffsets.has(record.offset)) {
      const key = `${record.platformId}-${record.encodingId}`;
      for (const [existingKey, subtable2] of subtables) {
        const parts = existingKey.split("@");
        const existingOffset = parts[0];
        if (existingOffset && Number.parseInt(existingOffset, 10) === record.offset) {
          subtables.set(key, subtable2);
          break;
        }
      }
      continue;
    }
    parsedOffsets.add(record.offset);
    const subtableReader = reader.slice(
      record.offset,
      tableLength - record.offset
    );
    const subtable = parseCmapSubtable(subtableReader);
    if (subtable) {
      const key = `${record.platformId}-${record.encodingId}`;
      subtables.set(key, subtable);
    }
  }
  const preferredKeys = ["3-10", "0-4", "3-1", "0-3", "0-6", "1-0"];
  let bestSubtable = null;
  for (const key of preferredKeys) {
    const subtable = subtables.get(key);
    if (subtable && subtable.format !== 14) {
      bestSubtable = subtable;
      break;
    }
  }
  if (!bestSubtable) {
    for (const subtable of subtables.values()) {
      if (subtable.format !== 14) {
        bestSubtable = subtable;
        break;
      }
    }
  }
  return {
    version,
    numTables,
    encodingRecords,
    subtables,
    bestSubtable
  };
}
function parseCmapSubtable(reader) {
  const format = reader.uint16();
  switch (format) {
    case 0:
      return parseCmapFormat0(reader);
    case 4:
      return parseCmapFormat4(reader);
    case 12:
      return parseCmapFormat12(reader);
    case 14:
      return parseCmapFormat14(reader);
    default:
      return null;
  }
}
function parseCmapFormat0(reader) {
  const _length = reader.uint16();
  const _language = reader.uint16();
  const glyphIdArray = reader.uint8Array(256);
  return {
    format: 0,
    glyphIdArray,
    lookup(codepoint) {
      if (codepoint >= 0 && codepoint < 256) {
        return glyphIdArray[codepoint];
      }
      return void 0;
    }
  };
}
function parseCmapFormat4(reader) {
  const _length = reader.uint16();
  const _language = reader.uint16();
  const segCountX2 = reader.uint16();
  const segCount = segCountX2 / 2;
  reader.skip(6);
  const endCodes = reader.uint16Array(segCount);
  reader.skip(2);
  const startCodes = reader.uint16Array(segCount);
  const idDeltas = reader.int16Array(segCount);
  const _idRangeOffsetPos = reader.offset;
  const idRangeOffsets = reader.uint16Array(segCount);
  const remainingBytes = reader.remaining;
  const glyphIdCount = remainingBytes / 2;
  const glyphIdArray = reader.uint16Array(glyphIdCount);
  return {
    format: 4,
    segCount,
    endCodes,
    startCodes,
    idDeltas,
    idRangeOffsets,
    glyphIdArray,
    lookup(codepoint) {
      if (codepoint > 65535) return void 0;
      let low = 0;
      let high = segCount - 1;
      while (low <= high) {
        const mid = low + high >>> 1;
        const endCode = endCodes[mid];
        if (endCode === void 0) break;
        if (codepoint > endCode) {
          low = mid + 1;
        } else {
          const startCode = startCodes[mid];
          if (startCode === void 0) break;
          if (codepoint < startCode) {
            high = mid - 1;
          } else {
            const idRangeOffset = idRangeOffsets[mid];
            const idDelta = idDeltas[mid];
            if (idRangeOffset === void 0 || idDelta === void 0) break;
            if (idRangeOffset === 0) {
              return codepoint + idDelta & 65535;
            }
            const glyphIdIndex = idRangeOffset / 2 - (segCount - mid) + (codepoint - startCode);
            const glyphId = glyphIdArray[glyphIdIndex];
            if (glyphId === void 0 || glyphId === 0) {
              return 0;
            }
            return glyphId + idDelta & 65535;
          }
        }
      }
      return void 0;
    }
  };
}
function parseCmapFormat12(reader) {
  reader.skip(2);
  const _length = reader.uint32();
  const _language = reader.uint32();
  const numGroups = reader.uint32();
  const groups = new Array(numGroups);
  for (let i = 0; i < numGroups; i++) {
    groups[i] = {
      startCharCode: reader.uint32(),
      endCharCode: reader.uint32(),
      startGlyphId: reader.uint32()
    };
  }
  return {
    format: 12,
    groups,
    lookup(codepoint) {
      let low = 0;
      let high = groups.length - 1;
      while (low <= high) {
        const mid = low + high >>> 1;
        const group = groups[mid];
        if (!group) break;
        if (codepoint > group.endCharCode) {
          low = mid + 1;
        } else if (codepoint < group.startCharCode) {
          high = mid - 1;
        } else {
          return group.startGlyphId + (codepoint - group.startCharCode);
        }
      }
      return void 0;
    }
  };
}
function parseCmapFormat14(reader) {
  const subtableStart = reader.offset - 2;
  const _length = reader.uint32();
  const numVarSelectorRecords = reader.uint32();
  const rawRecords = [];
  for (let i = 0; i < numVarSelectorRecords; i++) {
    rawRecords.push({
      varSelector: reader.uint24(),
      defaultUVSOffset: reader.uint32(),
      nonDefaultUVSOffset: reader.uint32()
    });
  }
  const varSelectorRecords = [];
  for (const raw of rawRecords) {
    let defaultUVS = null;
    let nonDefaultUVS = null;
    if (raw.defaultUVSOffset !== 0) {
      const uvsReader = reader.sliceFrom(subtableStart + raw.defaultUVSOffset);
      const numUnicodeValueRanges = uvsReader.uint32();
      defaultUVS = [];
      for (let j = 0; j < numUnicodeValueRanges; j++) {
        defaultUVS.push({
          startUnicodeValue: uvsReader.uint24(),
          additionalCount: uvsReader.uint8()
        });
      }
    }
    if (raw.nonDefaultUVSOffset !== 0) {
      const uvsReader = reader.sliceFrom(
        subtableStart + raw.nonDefaultUVSOffset
      );
      const numUVSMappings = uvsReader.uint32();
      nonDefaultUVS = [];
      for (let j = 0; j < numUVSMappings; j++) {
        nonDefaultUVS.push({
          unicodeValue: uvsReader.uint24(),
          glyphId: uvsReader.uint16()
        });
      }
    }
    varSelectorRecords.push({
      varSelector: raw.varSelector,
      defaultUVS,
      nonDefaultUVS
    });
  }
  return {
    format: 14,
    varSelectorRecords,
    lookup(_codepoint) {
      return void 0;
    },
    lookupVariation(codepoint, variationSelector) {
      let low = 0;
      let high = varSelectorRecords.length - 1;
      let record = null;
      while (low <= high) {
        const mid = low + high >>> 1;
        const rec = varSelectorRecords[mid];
        if (!rec) break;
        if (variationSelector > rec.varSelector) {
          low = mid + 1;
        } else if (variationSelector < rec.varSelector) {
          high = mid - 1;
        } else {
          record = rec;
          break;
        }
      }
      if (!record) {
        return void 0;
      }
      if (record.nonDefaultUVS) {
        let lo = 0;
        let hi = record.nonDefaultUVS.length - 1;
        while (lo <= hi) {
          const mid = lo + hi >>> 1;
          const mapping = record.nonDefaultUVS[mid];
          if (!mapping) break;
          if (codepoint > mapping.unicodeValue) {
            lo = mid + 1;
          } else if (codepoint < mapping.unicodeValue) {
            hi = mid - 1;
          } else {
            return mapping.glyphId;
          }
        }
      }
      if (record.defaultUVS) {
        for (const range of record.defaultUVS) {
          const end = range.startUnicodeValue + range.additionalCount;
          if (codepoint >= range.startUnicodeValue && codepoint <= end) {
            return "default";
          }
        }
      }
      return void 0;
    }
  };
}
function getGlyphId(cmap, codepoint) {
  return cmap.bestSubtable?.lookup(codepoint) ?? 0;
}

// src/font/tables/colr.ts
var PaintFormat = /* @__PURE__ */ ((PaintFormat2) => {
  PaintFormat2[PaintFormat2["ColrLayers"] = 1] = "ColrLayers";
  PaintFormat2[PaintFormat2["Solid"] = 2] = "Solid";
  PaintFormat2[PaintFormat2["VarSolid"] = 3] = "VarSolid";
  PaintFormat2[PaintFormat2["LinearGradient"] = 4] = "LinearGradient";
  PaintFormat2[PaintFormat2["VarLinearGradient"] = 5] = "VarLinearGradient";
  PaintFormat2[PaintFormat2["RadialGradient"] = 6] = "RadialGradient";
  PaintFormat2[PaintFormat2["VarRadialGradient"] = 7] = "VarRadialGradient";
  PaintFormat2[PaintFormat2["SweepGradient"] = 8] = "SweepGradient";
  PaintFormat2[PaintFormat2["VarSweepGradient"] = 9] = "VarSweepGradient";
  PaintFormat2[PaintFormat2["Glyph"] = 10] = "Glyph";
  PaintFormat2[PaintFormat2["ColrGlyph"] = 11] = "ColrGlyph";
  PaintFormat2[PaintFormat2["Transform"] = 12] = "Transform";
  PaintFormat2[PaintFormat2["VarTransform"] = 13] = "VarTransform";
  PaintFormat2[PaintFormat2["Translate"] = 14] = "Translate";
  PaintFormat2[PaintFormat2["VarTranslate"] = 15] = "VarTranslate";
  PaintFormat2[PaintFormat2["Scale"] = 16] = "Scale";
  PaintFormat2[PaintFormat2["VarScale"] = 17] = "VarScale";
  PaintFormat2[PaintFormat2["ScaleAroundCenter"] = 18] = "ScaleAroundCenter";
  PaintFormat2[PaintFormat2["VarScaleAroundCenter"] = 19] = "VarScaleAroundCenter";
  PaintFormat2[PaintFormat2["ScaleUniform"] = 20] = "ScaleUniform";
  PaintFormat2[PaintFormat2["VarScaleUniform"] = 21] = "VarScaleUniform";
  PaintFormat2[PaintFormat2["ScaleUniformAroundCenter"] = 22] = "ScaleUniformAroundCenter";
  PaintFormat2[PaintFormat2["VarScaleUniformAroundCenter"] = 23] = "VarScaleUniformAroundCenter";
  PaintFormat2[PaintFormat2["Rotate"] = 24] = "Rotate";
  PaintFormat2[PaintFormat2["VarRotate"] = 25] = "VarRotate";
  PaintFormat2[PaintFormat2["RotateAroundCenter"] = 26] = "RotateAroundCenter";
  PaintFormat2[PaintFormat2["VarRotateAroundCenter"] = 27] = "VarRotateAroundCenter";
  PaintFormat2[PaintFormat2["Skew"] = 28] = "Skew";
  PaintFormat2[PaintFormat2["VarSkew"] = 29] = "VarSkew";
  PaintFormat2[PaintFormat2["SkewAroundCenter"] = 30] = "SkewAroundCenter";
  PaintFormat2[PaintFormat2["VarSkewAroundCenter"] = 31] = "VarSkewAroundCenter";
  PaintFormat2[PaintFormat2["Composite"] = 32] = "Composite";
  return PaintFormat2;
})(PaintFormat || {});
var Extend = /* @__PURE__ */ ((Extend2) => {
  Extend2[Extend2["Pad"] = 0] = "Pad";
  Extend2[Extend2["Repeat"] = 1] = "Repeat";
  Extend2[Extend2["Reflect"] = 2] = "Reflect";
  return Extend2;
})(Extend || {});
var CompositeMode = /* @__PURE__ */ ((CompositeMode2) => {
  CompositeMode2[CompositeMode2["Clear"] = 0] = "Clear";
  CompositeMode2[CompositeMode2["Src"] = 1] = "Src";
  CompositeMode2[CompositeMode2["Dest"] = 2] = "Dest";
  CompositeMode2[CompositeMode2["SrcOver"] = 3] = "SrcOver";
  CompositeMode2[CompositeMode2["DestOver"] = 4] = "DestOver";
  CompositeMode2[CompositeMode2["SrcIn"] = 5] = "SrcIn";
  CompositeMode2[CompositeMode2["DestIn"] = 6] = "DestIn";
  CompositeMode2[CompositeMode2["SrcOut"] = 7] = "SrcOut";
  CompositeMode2[CompositeMode2["DestOut"] = 8] = "DestOut";
  CompositeMode2[CompositeMode2["SrcAtop"] = 9] = "SrcAtop";
  CompositeMode2[CompositeMode2["DestAtop"] = 10] = "DestAtop";
  CompositeMode2[CompositeMode2["Xor"] = 11] = "Xor";
  CompositeMode2[CompositeMode2["Plus"] = 12] = "Plus";
  CompositeMode2[CompositeMode2["Screen"] = 13] = "Screen";
  CompositeMode2[CompositeMode2["Overlay"] = 14] = "Overlay";
  CompositeMode2[CompositeMode2["Darken"] = 15] = "Darken";
  CompositeMode2[CompositeMode2["Lighten"] = 16] = "Lighten";
  CompositeMode2[CompositeMode2["ColorDodge"] = 17] = "ColorDodge";
  CompositeMode2[CompositeMode2["ColorBurn"] = 18] = "ColorBurn";
  CompositeMode2[CompositeMode2["HardLight"] = 19] = "HardLight";
  CompositeMode2[CompositeMode2["SoftLight"] = 20] = "SoftLight";
  CompositeMode2[CompositeMode2["Difference"] = 21] = "Difference";
  CompositeMode2[CompositeMode2["Exclusion"] = 22] = "Exclusion";
  CompositeMode2[CompositeMode2["Multiply"] = 23] = "Multiply";
  CompositeMode2[CompositeMode2["Hue"] = 24] = "Hue";
  CompositeMode2[CompositeMode2["Saturation"] = 25] = "Saturation";
  CompositeMode2[CompositeMode2["Color"] = 26] = "Color";
  CompositeMode2[CompositeMode2["Luminosity"] = 27] = "Luminosity";
  return CompositeMode2;
})(CompositeMode || {});
function parseColr(reader) {
  const startOffset = reader.offset;
  const version = reader.uint16();
  const numBaseGlyphRecords = reader.uint16();
  const baseGlyphRecordsOffset = reader.uint32();
  const layerRecordsOffset = reader.uint32();
  const numLayerRecords = reader.uint16();
  const baseGlyphRecords = [];
  if (baseGlyphRecordsOffset !== 0 && numBaseGlyphRecords > 0) {
    reader.seek(startOffset + baseGlyphRecordsOffset);
    for (let i = 0; i < numBaseGlyphRecords; i++) {
      baseGlyphRecords.push({
        glyphId: reader.uint16(),
        firstLayerIndex: reader.uint16(),
        numLayers: reader.uint16()
      });
    }
  }
  const layerRecords = [];
  if (layerRecordsOffset !== 0 && numLayerRecords > 0) {
    reader.seek(startOffset + layerRecordsOffset);
    for (let i = 0; i < numLayerRecords; i++) {
      layerRecords.push({
        glyphId: reader.uint16(),
        paletteIndex: reader.uint16()
      });
    }
  }
  const result = {
    version,
    baseGlyphRecords,
    layerRecords
  };
  if (version >= 1) {
    reader.seek(startOffset + 14);
    const baseGlyphListOffset = reader.uint32();
    const layerListOffset = reader.uint32();
    const clipListOffset = reader.uint32();
    const varIdxMapOffset = reader.uint32();
    const itemVariationStoreOffset = reader.uint32();
    if (baseGlyphListOffset !== 0) {
      reader.seek(startOffset + baseGlyphListOffset);
      const numRecords = reader.uint32();
      result.baseGlyphPaintRecords = [];
      for (let i = 0; i < numRecords; i++) {
        const glyphId = reader.uint16();
        const paintOffset = reader.uint32();
        const savedPos = reader.offset;
        reader.seek(
          startOffset + baseGlyphListOffset + 4 + i * 6 + 2 + paintOffset - 4
        );
        const paint = parsePaint(reader, startOffset);
        reader.seek(savedPos);
        result.baseGlyphPaintRecords.push({ glyphId, paint });
      }
    }
    if (layerListOffset !== 0) {
      reader.seek(startOffset + layerListOffset);
      const numLayers = reader.uint32();
      const paintOffsets = [];
      for (let i = 0; i < numLayers; i++) {
        paintOffsets.push(reader.uint32());
      }
      result.layerList = [];
      for (const offset of paintOffsets) {
        reader.seek(startOffset + layerListOffset + offset);
        result.layerList.push(parsePaint(reader, startOffset));
      }
    }
    if (clipListOffset !== 0) {
      reader.seek(startOffset + clipListOffset);
      result.clipList = parseClipList(reader, startOffset);
    }
    if (varIdxMapOffset !== 0) {
      reader.seek(startOffset + varIdxMapOffset);
      result.varIdxMap = parseDeltaSetIndexMap2(reader);
    }
    if (itemVariationStoreOffset !== 0) {
      reader.seek(startOffset + itemVariationStoreOffset);
      result.itemVariationStore = parseItemVariationStore3(reader);
    }
  }
  return result;
}
function parsePaint(reader, tableOffset) {
  const format = reader.uint8();
  switch (format) {
    case 1 /* ColrLayers */:
      return {
        format,
        numLayers: reader.uint8(),
        firstLayerIndex: reader.uint32()
      };
    case 2 /* Solid */:
      return {
        format,
        paletteIndex: reader.uint16(),
        alpha: reader.f2dot14()
      };
    case 3 /* VarSolid */:
      return {
        format,
        paletteIndex: reader.uint16(),
        alpha: reader.f2dot14(),
        varIndexBase: reader.uint32()
      };
    case 4 /* LinearGradient */:
    case 5 /* VarLinearGradient */: {
      const colorLineOffset = reader.uint24();
      const x0 = reader.fword();
      const y0 = reader.fword();
      const x1 = reader.fword();
      const y1 = reader.fword();
      const x2 = reader.fword();
      const y2 = reader.fword();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 18 + colorLineOffset);
      const colorLine = parseColorLine(reader);
      reader.seek(savedPos);
      return { format, colorLine, x0, y0, x1, y1, x2, y2 };
    }
    case 6 /* RadialGradient */:
    case 7 /* VarRadialGradient */: {
      const colorLineOffset = reader.uint24();
      const x0 = reader.fword();
      const y0 = reader.fword();
      const radius0 = reader.ufword();
      const x1 = reader.fword();
      const y1 = reader.fword();
      const radius1 = reader.ufword();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 18 + colorLineOffset);
      const colorLine = parseColorLine(reader);
      reader.seek(savedPos);
      return { format, colorLine, x0, y0, radius0, x1, y1, radius1 };
    }
    case 8 /* SweepGradient */:
    case 9 /* VarSweepGradient */: {
      const colorLineOffset = reader.uint24();
      const centerX = reader.fword();
      const centerY = reader.fword();
      const startAngle = reader.f2dot14();
      const endAngle = reader.f2dot14();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 12 + colorLineOffset);
      const colorLine = parseColorLine(reader);
      reader.seek(savedPos);
      return { format, colorLine, centerX, centerY, startAngle, endAngle };
    }
    case 10 /* Glyph */: {
      const paintOffset = reader.uint24();
      const glyphId = reader.uint16();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 5 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, glyphId };
    }
    case 11 /* ColrGlyph */:
      return {
        format,
        glyphId: reader.uint16()
      };
    case 12 /* Transform */:
    case 13 /* VarTransform */: {
      const paintOffset = reader.uint24();
      const transformOffset = reader.uint24();
      const paintPos = reader.offset - 6 + paintOffset;
      const transformPos = reader.offset - 3 + transformOffset;
      reader.seek(transformPos);
      const transform = {
        xx: reader.fixed(),
        yx: reader.fixed(),
        xy: reader.fixed(),
        yy: reader.fixed(),
        dx: reader.fixed(),
        dy: reader.fixed()
      };
      reader.seek(paintPos);
      const paint = parsePaint(reader, tableOffset);
      return { format, paint, transform };
    }
    case 14 /* Translate */:
    case 15 /* VarTranslate */: {
      const paintOffset = reader.uint24();
      const dx = reader.fword();
      const dy = reader.fword();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 7 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, dx, dy };
    }
    case 16 /* Scale */:
    case 17 /* VarScale */: {
      const paintOffset = reader.uint24();
      const scaleX = reader.f2dot14();
      const scaleY = reader.f2dot14();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 7 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, scaleX, scaleY };
    }
    case 18 /* ScaleAroundCenter */:
    case 19 /* VarScaleAroundCenter */: {
      const paintOffset = reader.uint24();
      const scaleX = reader.f2dot14();
      const scaleY = reader.f2dot14();
      const centerX = reader.fword();
      const centerY = reader.fword();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 11 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, scaleX, scaleY, centerX, centerY };
    }
    case 20 /* ScaleUniform */:
    case 21 /* VarScaleUniform */: {
      const paintOffset = reader.uint24();
      const scale = reader.f2dot14();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 5 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, scaleX: scale, scaleY: scale };
    }
    case 22 /* ScaleUniformAroundCenter */:
    case 23 /* VarScaleUniformAroundCenter */: {
      const paintOffset = reader.uint24();
      const scale = reader.f2dot14();
      const centerX = reader.fword();
      const centerY = reader.fword();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 9 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, scaleX: scale, scaleY: scale, centerX, centerY };
    }
    case 24 /* Rotate */:
    case 25 /* VarRotate */: {
      const paintOffset = reader.uint24();
      const angle = reader.f2dot14();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 5 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, angle };
    }
    case 26 /* RotateAroundCenter */:
    case 27 /* VarRotateAroundCenter */: {
      const paintOffset = reader.uint24();
      const angle = reader.f2dot14();
      const centerX = reader.fword();
      const centerY = reader.fword();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 9 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, angle, centerX, centerY };
    }
    case 28 /* Skew */:
    case 29 /* VarSkew */: {
      const paintOffset = reader.uint24();
      const xSkewAngle = reader.f2dot14();
      const ySkewAngle = reader.f2dot14();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 7 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, xSkewAngle, ySkewAngle };
    }
    case 30 /* SkewAroundCenter */:
    case 31 /* VarSkewAroundCenter */: {
      const paintOffset = reader.uint24();
      const xSkewAngle = reader.f2dot14();
      const ySkewAngle = reader.f2dot14();
      const centerX = reader.fword();
      const centerY = reader.fword();
      const savedPos = reader.offset;
      reader.seek(reader.offset - 11 + paintOffset);
      const paint = parsePaint(reader, tableOffset);
      reader.seek(savedPos);
      return { format, paint, xSkewAngle, ySkewAngle, centerX, centerY };
    }
    case 32 /* Composite */: {
      const sourcePaintOffset = reader.uint24();
      const compositeMode = reader.uint8();
      const backdropPaintOffset = reader.uint24();
      const sourcePos = reader.offset - 7 + sourcePaintOffset;
      const backdropPos = reader.offset - 3 + backdropPaintOffset;
      reader.seek(sourcePos);
      const sourcePaint = parsePaint(reader, tableOffset);
      reader.seek(backdropPos);
      const backdropPaint = parsePaint(reader, tableOffset);
      return { format, sourcePaint, compositeMode, backdropPaint };
    }
    default:
      throw new Error(`Unknown paint format: ${format}`);
  }
}
function parseColorLine(reader) {
  const extend = reader.uint8();
  const numStops = reader.uint16();
  const colorStops = [];
  for (let i = 0; i < numStops; i++) {
    colorStops.push({
      stopOffset: reader.f2dot14(),
      paletteIndex: reader.uint16(),
      alpha: reader.f2dot14()
    });
  }
  return { extend, colorStops };
}
function parseClipList(reader, _tableOffset) {
  const _format = reader.uint8();
  const numClips = reader.uint32();
  const records = [];
  for (let i = 0; i < numClips; i++) {
    const startGlyphId = reader.uint16();
    const endGlyphId = reader.uint16();
    const clipBoxOffset = reader.uint24();
    const savedPos = reader.offset;
    reader.seek(reader.offset - 7 + clipBoxOffset);
    const boxFormat = reader.uint8();
    const clipBox = {
      format: boxFormat,
      xMin: reader.fword(),
      yMin: reader.fword(),
      xMax: reader.fword(),
      yMax: reader.fword()
    };
    if (boxFormat === 2) {
      clipBox.varIndexBase = reader.uint32();
    }
    reader.seek(savedPos);
    records.push({ startGlyphId, endGlyphId, clipBox });
  }
  return records;
}
function getColorLayers(colr, glyphId) {
  const records = colr.baseGlyphRecords;
  let lo = 0;
  let hi = records.length - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const record = records[mid];
    if (!record) break;
    if (record.glyphId === glyphId) {
      const layers = [];
      for (let i = 0; i < record.numLayers; i++) {
        const layer = colr.layerRecords[record.firstLayerIndex + i];
        if (layer) layers.push(layer);
      }
      return layers;
    } else if (record.glyphId < glyphId) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return null;
}
function getColorPaint(colr, glyphId) {
  if (!colr.baseGlyphPaintRecords) return null;
  const records = colr.baseGlyphPaintRecords;
  let lo = 0;
  let hi = records.length - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const record = records[mid];
    if (!record) break;
    if (record.glyphId === glyphId) {
      return record.paint;
    } else if (record.glyphId < glyphId) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return null;
}
function hasColorGlyph(colr, glyphId) {
  return getColorLayers(colr, glyphId) !== null || getColorPaint(colr, glyphId) !== null;
}
function parseDeltaSetIndexMap2(reader) {
  const format = reader.uint8();
  const entryFormat = reader.uint8();
  const mapCount = format === 0 ? reader.uint16() : reader.uint32();
  const innerBits = (entryFormat & 15) + 1;
  const outerBits = (entryFormat >> 4 & 15) + 1;
  const entrySize = Math.ceil((innerBits + outerBits) / 8);
  const result = [];
  for (let i = 0; i < mapCount; i++) {
    let entry = 0;
    for (let b = 0; b < entrySize; b++) {
      entry = entry << 8 | reader.uint8();
    }
    const innerMask = (1 << innerBits) - 1;
    const inner = entry & innerMask;
    const outer = entry >> innerBits;
    result.push(outer << 16 | inner);
  }
  return result;
}
function parseItemVariationStore3(reader) {
  const storeOffset = reader.offset;
  const format = reader.uint16();
  const variationRegionListOffset = reader.uint32();
  const itemVariationDataCount = reader.uint16();
  const itemVariationDataOffsets = [];
  for (let i = 0; i < itemVariationDataCount; i++) {
    itemVariationDataOffsets.push(reader.uint32());
  }
  reader.seek(storeOffset + variationRegionListOffset);
  const axisCount = reader.uint16();
  const regionCount = reader.uint16();
  const variationRegions = [];
  for (let i = 0; i < regionCount; i++) {
    const regionAxes = [];
    for (let j = 0; j < axisCount; j++) {
      regionAxes.push({
        startCoord: reader.f2dot14(),
        peakCoord: reader.f2dot14(),
        endCoord: reader.f2dot14()
      });
    }
    variationRegions.push({ regionAxes });
  }
  const itemVariationData = [];
  for (const offset of itemVariationDataOffsets) {
    reader.seek(storeOffset + offset);
    const itemCount = reader.uint16();
    const wordDeltaCount = reader.uint16();
    const regionIndexCount = reader.uint16();
    const regionIndexes = [];
    for (let i = 0; i < regionIndexCount; i++) {
      regionIndexes.push(reader.uint16());
    }
    const longWords = (wordDeltaCount & 32768) !== 0;
    const wordCount = wordDeltaCount & 32767;
    const deltaSets = [];
    for (let i = 0; i < itemCount; i++) {
      const deltas = [];
      for (let j = 0; j < regionIndexCount; j++) {
        if (j < wordCount) {
          deltas.push(longWords ? reader.int32() : reader.int16());
        } else {
          deltas.push(longWords ? reader.int16() : reader.int8());
        }
      }
      deltaSets.push(deltas);
    }
    itemVariationData.push({
      itemCount,
      wordDeltaCount,
      regionIndexCount,
      regionIndexes,
      deltaSets
    });
  }
  return {
    format,
    variationRegionListOffset,
    itemVariationDataCount,
    itemVariationDataOffsets,
    variationRegions,
    itemVariationData
  };
}
function getClipBox(colr, glyphId) {
  if (!colr.clipList) return null;
  for (const record of colr.clipList) {
    if (glyphId >= record.startGlyphId && glyphId <= record.endGlyphId) {
      return record.clipBox;
    }
  }
  return null;
}
function getColorVariationDelta(colr, varIndex, coords) {
  if (!colr.itemVariationStore || !colr.varIdxMap) return 0;
  const mappedIndex = colr.varIdxMap[varIndex];
  if (mappedIndex === void 0) return 0;
  const outer = mappedIndex >> 16;
  const inner = mappedIndex & 65535;
  const store = colr.itemVariationStore;
  const data = store.itemVariationData[outer];
  if (!data) return 0;
  const deltas = data.deltaSets[inner];
  if (!deltas) return 0;
  let result = 0;
  for (let i = 0; i < data.regionIndexCount; i++) {
    const regionIndex = data.regionIndexes[i];
    const region = store.variationRegions[regionIndex];
    if (!region) continue;
    let scalar = 1;
    for (let j = 0; j < region.regionAxes.length && j < coords.length; j++) {
      const axis = region.regionAxes[j];
      const coord = coords[j];
      scalar *= calculateAxisScalar(coord, axis.startCoord, axis.peakCoord, axis.endCoord);
      if (scalar === 0) break;
    }
    result += deltas[i] * scalar;
  }
  return result;
}
function calculateAxisScalar(coord, start, peak, end) {
  if (peak === 0) return 1;
  if (coord === peak) return 1;
  if (coord < start || coord > end) return 0;
  if (coord < peak) {
    if (start === peak) return 1;
    return (coord - start) / (peak - start);
  } else {
    if (peak === end) return 1;
    return (end - coord) / (end - peak);
  }
}
function isColrV1(colr) {
  return colr.version >= 1 && colr.baseGlyphPaintRecords !== void 0;
}
function getLayerPaint(colr, index) {
  return colr.layerList?.[index] ?? null;
}

// src/font/tables/cpal.ts
var PaletteType = /* @__PURE__ */ ((PaletteType2) => {
  PaletteType2[PaletteType2["UsableWithLightBackground"] = 1] = "UsableWithLightBackground";
  PaletteType2[PaletteType2["UsableWithDarkBackground"] = 2] = "UsableWithDarkBackground";
  return PaletteType2;
})(PaletteType || {});
function parseCpal(reader) {
  const startOffset = reader.offset;
  const version = reader.uint16();
  const numPaletteEntries = reader.uint16();
  const numPalettes = reader.uint16();
  const numColorRecords = reader.uint16();
  const colorRecordsArrayOffset = reader.uint32();
  const colorRecordIndices = [];
  for (let i = 0; i < numPalettes; i++) {
    colorRecordIndices.push(reader.uint16());
  }
  reader.seek(startOffset + colorRecordsArrayOffset);
  const colorRecords = [];
  for (let i = 0; i < numColorRecords; i++) {
    colorRecords.push({
      blue: reader.uint8(),
      green: reader.uint8(),
      red: reader.uint8(),
      alpha: reader.uint8()
    });
  }
  const palettes = [];
  for (let i = 0; i < numPalettes; i++) {
    const startIndex = colorRecordIndices[i];
    if (startIndex === void 0) continue;
    const colors = [];
    for (let j = 0; j < numPaletteEntries; j++) {
      const color = colorRecords[startIndex + j];
      if (color) colors.push(color);
    }
    palettes.push({ colors });
  }
  let paletteTypes;
  let paletteLabels;
  let paletteEntryLabels;
  if (version >= 1) {
    reader.seek(startOffset + 12 + numPalettes * 2);
    const paletteTypesArrayOffset = reader.uint32();
    const paletteLabelsArrayOffset = reader.uint32();
    const paletteEntryLabelsArrayOffset = reader.uint32();
    if (paletteTypesArrayOffset !== 0) {
      reader.seek(startOffset + paletteTypesArrayOffset);
      paletteTypes = [];
      for (let i = 0; i < numPalettes; i++) {
        paletteTypes.push(reader.uint32());
      }
    }
    if (paletteLabelsArrayOffset !== 0) {
      reader.seek(startOffset + paletteLabelsArrayOffset);
      paletteLabels = [];
      for (let i = 0; i < numPalettes; i++) {
        paletteLabels.push(reader.uint16());
      }
    }
    if (paletteEntryLabelsArrayOffset !== 0) {
      reader.seek(startOffset + paletteEntryLabelsArrayOffset);
      paletteEntryLabels = [];
      for (let i = 0; i < numPaletteEntries; i++) {
        paletteEntryLabels.push(reader.uint16());
      }
    }
  }
  return {
    version,
    numPalettes,
    numPaletteEntries,
    palettes,
    paletteTypes,
    paletteLabels,
    paletteEntryLabels
  };
}
function getColor(cpal, paletteIndex, colorIndex) {
  const palette = cpal.palettes[paletteIndex];
  if (!palette) return null;
  return palette.colors[colorIndex] ?? null;
}
function colorToRgba(color) {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${(color.alpha / 255).toFixed(3)})`;
}
function colorToHex(color) {
  const r = color.red.toString(16).padStart(2, "0");
  const g = color.green.toString(16).padStart(2, "0");
  const b = color.blue.toString(16).padStart(2, "0");
  if (color.alpha === 255) {
    return `#${r}${g}${b}`;
  }
  const a = color.alpha.toString(16).padStart(2, "0");
  return `#${r}${g}${b}${a}`;
}

// src/layout/structures/class-def.ts
var ClassDefFormat1 = class {
  startGlyphId;
  classValueArray;
  constructor(startGlyphId, classValueArray) {
    this.startGlyphId = startGlyphId;
    this.classValueArray = classValueArray;
  }
  get(glyphId) {
    const index = glyphId - this.startGlyphId;
    if (index >= 0 && index < this.classValueArray.length) {
      const value = this.classValueArray[index];
      return value ?? 0;
    }
    return 0;
  }
  glyphsInClass(classValue) {
    const result = [];
    for (let i = 0; i < this.classValueArray.length; i++) {
      if (this.classValueArray[i] === classValue) {
        result.push(this.startGlyphId + i);
      }
    }
    return result;
  }
};
var ClassDefFormat2 = class {
  ranges;
  constructor(ranges) {
    this.ranges = ranges;
  }
  get(glyphId) {
    let low = 0;
    let high = this.ranges.length - 1;
    while (low <= high) {
      const mid = low + high >>> 1;
      const range = this.ranges[mid];
      if (!range) continue;
      if (glyphId > range.endGlyphId) {
        low = mid + 1;
      } else if (glyphId < range.startGlyphId) {
        high = mid - 1;
      } else {
        return range.classValue;
      }
    }
    return 0;
  }
  glyphsInClass(classValue) {
    const result = [];
    for (const range of this.ranges) {
      if (range.classValue === classValue) {
        for (let g = range.startGlyphId; g <= range.endGlyphId; g++) {
          result.push(g);
        }
      }
    }
    return result;
  }
};
var ClassDefEmpty = class {
  get(_glyphId) {
    return 0;
  }
  glyphsInClass(_classValue) {
    return [];
  }
};
var EMPTY_CLASS_DEF = new ClassDefEmpty();
function parseClassDef(reader) {
  const format = reader.uint16();
  if (format === 1) {
    const startGlyphId = reader.uint16();
    const glyphCount = reader.uint16();
    const classValueArray = reader.uint16Array(glyphCount);
    return new ClassDefFormat1(startGlyphId, classValueArray);
  }
  if (format === 2) {
    const classRangeCount = reader.uint16();
    const ranges = new Array(classRangeCount);
    for (let i = 0; i < classRangeCount; i++) {
      ranges[i] = {
        startGlyphId: reader.uint16(),
        endGlyphId: reader.uint16(),
        classValue: reader.uint16()
      };
    }
    return new ClassDefFormat2(ranges);
  }
  throw new Error(`Unknown ClassDef format: ${format}`);
}
function parseClassDefAt(reader, offset) {
  if (offset === 0) {
    return EMPTY_CLASS_DEF;
  }
  return parseClassDef(reader.sliceFrom(offset));
}

// src/font/tables/gdef.ts
function parseGdef(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const glyphClassDefOffset = reader.offset16();
  const attachListOffset = reader.offset16();
  const ligCaretListOffset = reader.offset16();
  const markAttachClassDefOffset = reader.offset16();
  let markGlyphSetsDefOffset = 0;
  if (majorVersion === 1 && minorVersion >= 2) {
    markGlyphSetsDefOffset = reader.offset16();
  }
  const glyphClassDef = parseClassDefAt(reader, glyphClassDefOffset);
  let attachList = null;
  if (attachListOffset !== 0) {
    attachList = parseAttachList(reader.sliceFrom(attachListOffset));
  }
  let ligCaretList = null;
  if (ligCaretListOffset !== 0) {
    ligCaretList = parseLigCaretList(reader.sliceFrom(ligCaretListOffset));
  }
  const markAttachClassDef = parseClassDefAt(reader, markAttachClassDefOffset);
  let markGlyphSets = null;
  if (markGlyphSetsDefOffset !== 0) {
    markGlyphSets = parseMarkGlyphSets(
      reader.sliceFrom(markGlyphSetsDefOffset)
    );
  }
  return {
    version: { major: majorVersion, minor: minorVersion },
    glyphClassDef,
    attachList,
    ligCaretList,
    markAttachClassDef,
    markGlyphSets
  };
}
function parseAttachList(reader) {
  const coverageOffset = reader.offset16();
  const glyphCount = reader.uint16();
  const attachPointOffsets = reader.uint16Array(glyphCount);
  const coverageReader = reader.sliceFrom(coverageOffset);
  const format = coverageReader.uint16();
  const glyphIds = [];
  if (format === 1) {
    const count = coverageReader.uint16();
    for (let i = 0; i < count; i++) {
      glyphIds.push(coverageReader.uint16());
    }
  } else if (format === 2) {
    const rangeCount = coverageReader.uint16();
    for (let i = 0; i < rangeCount; i++) {
      const start = coverageReader.uint16();
      const end = coverageReader.uint16();
      coverageReader.skip(2);
      for (let g = start; g <= end; g++) {
        glyphIds.push(g);
      }
    }
  }
  const result = /* @__PURE__ */ new Map();
  for (const [i, offset] of attachPointOffsets.entries()) {
    const glyphId = glyphIds[i];
    if (glyphId === void 0) continue;
    const pointReader = reader.sliceFrom(offset);
    const pointCount = pointReader.uint16();
    const pointIndices = Array.from(pointReader.uint16Array(pointCount));
    result.set(glyphId, { pointIndices });
  }
  return result;
}
function parseLigCaretList(reader) {
  const coverageOffset = reader.offset16();
  const ligGlyphCount = reader.uint16();
  const ligGlyphOffsets = reader.uint16Array(ligGlyphCount);
  const coverageReader = reader.sliceFrom(coverageOffset);
  const format = coverageReader.uint16();
  const glyphIds = [];
  if (format === 1) {
    const count = coverageReader.uint16();
    for (let i = 0; i < count; i++) {
      glyphIds.push(coverageReader.uint16());
    }
  } else if (format === 2) {
    const rangeCount = coverageReader.uint16();
    for (let i = 0; i < rangeCount; i++) {
      const start = coverageReader.uint16();
      const end = coverageReader.uint16();
      coverageReader.skip(2);
      for (let g = start; g <= end; g++) {
        glyphIds.push(g);
      }
    }
  }
  const result = /* @__PURE__ */ new Map();
  for (const [i, offset] of ligGlyphOffsets.entries()) {
    const glyphId = glyphIds[i];
    if (glyphId === void 0) continue;
    const ligReader = reader.sliceFrom(offset);
    const caretCount = ligReader.uint16();
    const caretValueOffsets = ligReader.uint16Array(caretCount);
    const caretValues = [];
    for (const caretOffset of caretValueOffsets) {
      const caretReader = reader.sliceFrom(offset + caretOffset);
      const caretFormat = caretReader.uint16();
      if (caretFormat === 1) {
        caretValues.push(caretReader.int16());
      } else if (caretFormat === 2) {
        caretValues.push(caretReader.uint16());
      } else if (caretFormat === 3) {
        caretValues.push(caretReader.int16());
      }
    }
    result.set(glyphId, { caretValues });
  }
  return result;
}
function parseMarkGlyphSets(reader) {
  const _format = reader.uint16();
  const markSetCount = reader.uint16();
  const coverageOffsets = reader.uint32Array(markSetCount);
  const markSets = [];
  for (const offset of coverageOffsets) {
    const coverageReader = reader.sliceFrom(offset);
    const coverageFormat = coverageReader.uint16();
    const glyphSet = /* @__PURE__ */ new Set();
    if (coverageFormat === 1) {
      const count = coverageReader.uint16();
      for (let i = 0; i < count; i++) {
        glyphSet.add(coverageReader.uint16());
      }
    } else if (coverageFormat === 2) {
      const rangeCount = coverageReader.uint16();
      for (let i = 0; i < rangeCount; i++) {
        const start = coverageReader.uint16();
        const end = coverageReader.uint16();
        coverageReader.skip(2);
        for (let g = start; g <= end; g++) {
          glyphSet.add(g);
        }
      }
    }
    markSets.push(glyphSet);
  }
  return {
    has(setIndex, glyphId) {
      const set = markSets[setIndex];
      return set ? set.has(glyphId) : false;
    }
  };
}
function getGlyphClass2(gdef, glyphId) {
  if (!gdef) return 0;
  const cls = gdef.glyphClassDef.get(glyphId);
  return cls;
}

// src/font/tables/gvar.ts
var EMBEDDED_PEAK_TUPLE = 32768;
var INTERMEDIATE_REGION = 16384;
var PRIVATE_POINT_NUMBERS = 8192;
var TUPLE_INDEX_MASK = 4095;
function parseGvar(reader, _numGlyphs) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const axisCount = reader.uint16();
  const sharedTupleCount = reader.uint16();
  const sharedTuplesOffset = reader.offset32();
  const glyphCount = reader.uint16();
  const flags = reader.uint16();
  const glyphVariationDataArrayOffset = reader.offset32();
  const offsetSize = flags & 1 ? 4 : 2;
  const offsets = [];
  for (let i = 0; i <= glyphCount; i++) {
    const offset = offsetSize === 4 ? reader.uint32() : reader.uint16() * 2;
    offsets.push(offset);
  }
  const sharedTuples = [];
  if (sharedTupleCount > 0) {
    const tupleReader = reader.sliceFrom(sharedTuplesOffset);
    for (let i = 0; i < sharedTupleCount; i++) {
      const tuple = [];
      for (let a = 0; a < axisCount; a++) {
        tuple.push(tupleReader.f2dot14());
      }
      sharedTuples.push(tuple);
    }
  }
  const glyphVariationData = [];
  for (let g = 0; g < glyphCount; g++) {
    const startOffset = offsets[g];
    const endOffset = offsets[g + 1];
    if (startOffset === void 0 || endOffset === void 0) {
      glyphVariationData.push({ tupleVariationHeaders: [] });
      continue;
    }
    const dataStart = glyphVariationDataArrayOffset + startOffset;
    const dataEnd = glyphVariationDataArrayOffset + endOffset;
    if (dataStart === dataEnd) {
      glyphVariationData.push({ tupleVariationHeaders: [] });
      continue;
    }
    const dataReader = reader.sliceFrom(dataStart);
    const variationData = parseGlyphVariationData(
      dataReader,
      dataEnd - dataStart,
      axisCount,
      sharedTuples
    );
    glyphVariationData.push(variationData);
  }
  return {
    majorVersion,
    minorVersion,
    axisCount,
    sharedTupleCount,
    sharedTuples,
    glyphVariationData
  };
}
function parseGlyphVariationData(reader, dataLength, axisCount, sharedTuples) {
  if (dataLength === 0) {
    return { tupleVariationHeaders: [] };
  }
  const startOffset = reader.offset;
  const tupleVariationCount = reader.uint16();
  const dataOffset = reader.offset16();
  const tupleCount = tupleVariationCount & 4095;
  const hasSharedPointNumbers = (tupleVariationCount & 32768) !== 0;
  const headerData = [];
  for (let i = 0; i < tupleCount; i++) {
    const variationDataSize = reader.uint16();
    const tupleIndex = reader.uint16();
    let peakTuple = null;
    let intermediateStartTuple = null;
    let intermediateEndTuple = null;
    if (tupleIndex & EMBEDDED_PEAK_TUPLE) {
      peakTuple = [];
      for (let a = 0; a < axisCount; a++) {
        peakTuple.push(reader.f2dot14());
      }
    } else {
      const sharedIndex = tupleIndex & TUPLE_INDEX_MASK;
      peakTuple = sharedTuples[sharedIndex] || null;
    }
    if (tupleIndex & INTERMEDIATE_REGION) {
      intermediateStartTuple = [];
      intermediateEndTuple = [];
      for (let a = 0; a < axisCount; a++) {
        intermediateStartTuple.push(reader.f2dot14());
      }
      for (let a = 0; a < axisCount; a++) {
        intermediateEndTuple.push(reader.f2dot14());
      }
    }
    headerData.push({
      variationDataSize,
      tupleIndex,
      peakTuple,
      intermediateStartTuple,
      intermediateEndTuple
    });
  }
  const dataReader = reader.sliceFrom(startOffset + dataOffset);
  let sharedPoints = null;
  if (hasSharedPointNumbers) {
    sharedPoints = parsePackedPoints(dataReader);
  }
  const headers = [];
  for (const hd of headerData) {
    const hasPrivatePoints = (hd.tupleIndex & PRIVATE_POINT_NUMBERS) !== 0;
    let pointNumbers;
    if (hasPrivatePoints) {
      pointNumbers = parsePackedPoints(dataReader);
    } else {
      pointNumbers = sharedPoints;
    }
    const numPoints = pointNumbers ? pointNumbers.length : 0;
    const xDeltas = numPoints > 0 ? parsePackedDeltas(dataReader, numPoints) : [];
    const yDeltas = numPoints > 0 ? parsePackedDeltas(dataReader, numPoints) : [];
    const deltas = [];
    for (const [p, xDelta] of xDeltas.entries()) {
      const yDelta = yDeltas[p];
      deltas.push({
        x: xDelta ?? 0,
        y: yDelta ?? 0
      });
    }
    headers.push({
      variationDataSize: hd.variationDataSize,
      tupleIndex: hd.tupleIndex,
      peakTuple: hd.peakTuple,
      intermediateStartTuple: hd.intermediateStartTuple,
      intermediateEndTuple: hd.intermediateEndTuple,
      serializedData: new Uint8Array(0),
      pointNumbers,
      deltas
    });
  }
  return { tupleVariationHeaders: headers };
}
function parsePackedPoints(reader) {
  const count = reader.uint8();
  const totalPoints = count === 0 ? 0 : count & 128 ? (count & 127) << 8 | reader.uint8() : count;
  if (totalPoints === 0) {
    return [];
  }
  const points = [];
  let pointIdx = 0;
  while (points.length < totalPoints) {
    const runHeader = reader.uint8();
    const runCount = (runHeader & 127) + 1;
    const pointsAreWords = (runHeader & 128) !== 0;
    for (let i = 0; i < runCount && points.length < totalPoints; i++) {
      const delta = pointsAreWords ? reader.uint16() : reader.uint8();
      pointIdx += delta;
      points.push(pointIdx);
    }
  }
  return points;
}
function parsePackedDeltas(reader, count) {
  const deltas = [];
  while (deltas.length < count) {
    const runHeader = reader.uint8();
    const runCount = (runHeader & 63) + 1;
    const deltasAreZero = (runHeader & 128) !== 0;
    const deltasAreWords = (runHeader & 64) !== 0;
    for (let i = 0; i < runCount && deltas.length < count; i++) {
      if (deltasAreZero) {
        deltas.push(0);
      } else if (deltasAreWords) {
        deltas.push(reader.int16());
      } else {
        deltas.push(reader.int8());
      }
    }
  }
  return deltas;
}
function calculateTupleScalar(peakTuple, axisCoords, intermediateStart, intermediateEnd) {
  let scalar = 1;
  for (const [i, peak] of peakTuple.entries()) {
    const coord = axisCoords[i] ?? 0;
    if (peak === 0 || coord === 0) {
      if (peak !== 0) scalar = 0;
      continue;
    }
    if (intermediateStart && intermediateEnd) {
      const start = intermediateStart[i];
      const end = intermediateEnd[i];
      if (start === void 0 || end === void 0) continue;
      if (coord < start || coord > end) {
        scalar = 0;
        break;
      }
      if (coord < peak) {
        scalar *= (coord - start) / (peak - start);
      } else if (coord > peak) {
        scalar *= (end - coord) / (end - peak);
      }
    } else {
      if (peak > 0 && coord < 0 || peak < 0 && coord > 0) {
        scalar = 0;
        break;
      }
      if (Math.abs(coord) < Math.abs(peak)) {
        scalar *= coord / peak;
      }
    }
  }
  return scalar;
}
function getGlyphDelta(gvar, glyphId, pointIndex, axisCoords) {
  const glyphData = gvar.glyphVariationData[glyphId];
  if (!glyphData) return { x: 0, y: 0 };
  let totalX = 0;
  let totalY = 0;
  for (const header of glyphData.tupleVariationHeaders) {
    if (!header.peakTuple) continue;
    const scalar = calculateTupleScalar(
      header.peakTuple,
      axisCoords,
      header.intermediateStartTuple,
      header.intermediateEndTuple
    );
    if (scalar === 0) continue;
    if (header.pointNumbers !== null) {
      const pointIdx = header.pointNumbers.indexOf(pointIndex);
      if (pointIdx < 0) continue;
      const delta = header.deltas[pointIdx];
      if (delta) {
        totalX += delta.x * scalar;
        totalY += delta.y * scalar;
      }
    } else {
      const delta = header.deltas[pointIndex];
      if (delta) {
        totalX += delta.x * scalar;
        totalY += delta.y * scalar;
      }
    }
  }
  return { x: Math.round(totalX), y: Math.round(totalY) };
}

// src/font/tables/loca.ts
function parseLoca(reader, numGlyphs, indexToLocFormat) {
  const isShort = indexToLocFormat === 0;
  const offsets = [];
  const count = numGlyphs + 1;
  if (isShort) {
    for (let i = 0; i < count; i++) {
      offsets.push(reader.uint16() * 2);
    }
  } else {
    for (let i = 0; i < count; i++) {
      offsets.push(reader.uint32());
    }
  }
  return { offsets, isShort };
}
function getGlyphLocation(loca, glyphId) {
  if (glyphId < 0 || glyphId >= loca.offsets.length - 1) {
    return null;
  }
  const offset = loca.offsets[glyphId];
  const nextOffset = loca.offsets[glyphId + 1];
  if (offset === void 0 || nextOffset === void 0) {
    return null;
  }
  const length = nextOffset - offset;
  if (length === 0) {
    return null;
  }
  return { offset, length };
}
function hasGlyphOutline(loca, glyphId) {
  return getGlyphLocation(loca, glyphId) !== null;
}

// src/font/tables/glyf.ts
var PointFlag = {
  OnCurve: 1,
  XShortVector: 2,
  YShortVector: 4,
  Repeat: 8,
  XIsSameOrPositive: 16,
  YIsSameOrPositive: 32,
  OverlapSimple: 64
};
var CompositeFlag = {
  Arg1And2AreWords: 1,
  ArgsAreXYValues: 2,
  RoundXYToGrid: 4,
  WeHaveAScale: 8,
  MoreComponents: 32,
  WeHaveAnXAndYScale: 64,
  WeHaveATwoByTwo: 128,
  WeHaveInstructions: 256,
  UseMyMetrics: 512,
  OverlapCompound: 1024,
  ScaledComponentOffset: 2048,
  UnscaledComponentOffset: 4096
};
function parseGlyf(reader) {
  return { reader };
}
function parseGlyph(glyf, loca, glyphId) {
  const location = getGlyphLocation(loca, glyphId);
  if (!location) {
    return { type: "empty" };
  }
  const reader = glyf.reader.slice(location.offset, location.length);
  return parseGlyphData2(reader);
}
function parseGlyphData2(reader) {
  const numberOfContours = reader.int16();
  const xMin = reader.int16();
  const yMin = reader.int16();
  const xMax = reader.int16();
  const yMax = reader.int16();
  if (numberOfContours >= 0) {
    return parseSimpleGlyph(reader, numberOfContours, xMin, yMin, xMax, yMax);
  } else {
    return parseCompositeGlyph(
      reader,
      numberOfContours,
      xMin,
      yMin,
      xMax,
      yMax
    );
  }
}
function parseSimpleGlyph(reader, numberOfContours, xMin, yMin, xMax, yMax) {
  if (numberOfContours === 0) {
    return {
      type: "simple",
      numberOfContours,
      xMin,
      yMin,
      xMax,
      yMax,
      contours: [],
      instructions: new Uint8Array(0)
    };
  }
  const endPtsOfContours = [];
  for (let i = 0; i < numberOfContours; i++) {
    endPtsOfContours.push(reader.uint16());
  }
  const lastEndPt = endPtsOfContours[numberOfContours - 1];
  if (lastEndPt === void 0) {
    return {
      type: "simple",
      numberOfContours,
      xMin,
      yMin,
      xMax,
      yMax,
      contours: [],
      instructions: new Uint8Array(0)
    };
  }
  const numPoints = lastEndPt + 1;
  const instructionLength = reader.uint16();
  const instructions = reader.bytes(instructionLength);
  const flags = [];
  while (flags.length < numPoints) {
    const flag = reader.uint8();
    flags.push(flag);
    if (flag & PointFlag.Repeat) {
      const repeatCount = reader.uint8();
      for (let i = 0; i < repeatCount; i++) {
        flags.push(flag);
      }
    }
  }
  const xCoordinates = [];
  let x = 0;
  for (const [_i, flag] of flags.entries()) {
    if (flag & PointFlag.XShortVector) {
      const dx = reader.uint8();
      x += flag & PointFlag.XIsSameOrPositive ? dx : -dx;
    } else if (!(flag & PointFlag.XIsSameOrPositive)) {
      x += reader.int16();
    }
    xCoordinates.push(x);
  }
  const yCoordinates = [];
  let y = 0;
  for (const [_i, flag] of flags.entries()) {
    if (flag & PointFlag.YShortVector) {
      const dy = reader.uint8();
      y += flag & PointFlag.YIsSameOrPositive ? dy : -dy;
    } else if (!(flag & PointFlag.YIsSameOrPositive)) {
      y += reader.int16();
    }
    yCoordinates.push(y);
  }
  const contours = [];
  let pointIndex = 0;
  for (const endPt of endPtsOfContours) {
    const contour = [];
    while (pointIndex <= endPt) {
      const xCoord = xCoordinates[pointIndex];
      const yCoord = yCoordinates[pointIndex];
      const flag = flags[pointIndex];
      if (xCoord === void 0 || yCoord === void 0 || flag === void 0) {
        break;
      }
      contour.push({
        x: xCoord,
        y: yCoord,
        onCurve: (flag & PointFlag.OnCurve) !== 0
      });
      pointIndex++;
    }
    contours.push(contour);
  }
  return {
    type: "simple",
    numberOfContours,
    xMin,
    yMin,
    xMax,
    yMax,
    contours,
    instructions
  };
}
function parseCompositeGlyph(reader, numberOfContours, xMin, yMin, xMax, yMax) {
  const components = [];
  let flags;
  do {
    flags = reader.uint16();
    const glyphIndex = reader.uint16();
    let arg1;
    let arg2;
    if (flags & CompositeFlag.Arg1And2AreWords) {
      if (flags & CompositeFlag.ArgsAreXYValues) {
        arg1 = reader.int16();
        arg2 = reader.int16();
      } else {
        arg1 = reader.uint16();
        arg2 = reader.uint16();
      }
    } else {
      if (flags & CompositeFlag.ArgsAreXYValues) {
        arg1 = reader.int8();
        arg2 = reader.int8();
      } else {
        arg1 = reader.uint8();
        arg2 = reader.uint8();
      }
    }
    let a = 1, b = 0, c = 0, d = 1;
    if (flags & CompositeFlag.WeHaveAScale) {
      a = d = reader.f2dot14();
    } else if (flags & CompositeFlag.WeHaveAnXAndYScale) {
      a = reader.f2dot14();
      d = reader.f2dot14();
    } else if (flags & CompositeFlag.WeHaveATwoByTwo) {
      a = reader.f2dot14();
      b = reader.f2dot14();
      c = reader.f2dot14();
      d = reader.f2dot14();
    }
    components.push({
      glyphId: glyphIndex,
      flags,
      arg1,
      arg2,
      transform: [a, b, c, d]
    });
  } while (flags & CompositeFlag.MoreComponents);
  let instructions = new Uint8Array(0);
  if (flags & CompositeFlag.WeHaveInstructions) {
    const instructionLength = reader.uint16();
    instructions = reader.bytes(instructionLength);
  }
  return {
    type: "composite",
    numberOfContours,
    xMin,
    yMin,
    xMax,
    yMax,
    components,
    instructions
  };
}
function flattenCompositeGlyph(glyf, loca, glyph, depth = 0) {
  if (depth > 32) {
    return [];
  }
  const result = [];
  for (const component of glyph.components) {
    const componentGlyph = parseGlyph(glyf, loca, component.glyphId);
    let componentContours;
    if (componentGlyph.type === "simple") {
      componentContours = componentGlyph.contours;
    } else if (componentGlyph.type === "composite") {
      componentContours = flattenCompositeGlyph(
        glyf,
        loca,
        componentGlyph,
        depth + 1
      );
    } else {
      continue;
    }
    const [a, b, c, d] = component.transform;
    const dx = component.flags & CompositeFlag.ArgsAreXYValues ? component.arg1 : 0;
    const dy = component.flags & CompositeFlag.ArgsAreXYValues ? component.arg2 : 0;
    for (const contour of componentContours) {
      const transformedContour = contour.map((point) => ({
        x: Math.round(a * point.x + c * point.y + dx),
        y: Math.round(b * point.x + d * point.y + dy),
        onCurve: point.onCurve
      }));
      result.push(transformedContour);
    }
  }
  return result;
}
function getGlyphContours(glyf, loca, glyphId) {
  const glyph = parseGlyph(glyf, loca, glyphId);
  if (glyph.type === "empty") {
    return [];
  } else if (glyph.type === "simple") {
    return glyph.contours;
  } else {
    return flattenCompositeGlyph(glyf, loca, glyph);
  }
}
function getGlyphBounds(glyf, loca, glyphId) {
  const glyph = parseGlyph(glyf, loca, glyphId);
  if (glyph.type === "empty") {
    return null;
  }
  return {
    xMin: glyph.xMin,
    yMin: glyph.yMin,
    xMax: glyph.xMax,
    yMax: glyph.yMax
  };
}
function getGlyphDeltas(gvar, glyphId, numPoints, axisCoords) {
  const glyphData = gvar.glyphVariationData[glyphId];
  if (!glyphData) {
    return Array(numPoints).fill({ x: 0, y: 0 });
  }
  const deltas = Array(numPoints).fill(null).map(() => ({ x: 0, y: 0 }));
  for (const header of glyphData.tupleVariationHeaders) {
    if (!header.peakTuple) continue;
    const scalar = calculateTupleScalar(
      header.peakTuple,
      axisCoords,
      header.intermediateStartTuple,
      header.intermediateEndTuple
    );
    if (scalar === 0) continue;
    if (header.pointNumbers !== null) {
      for (const [i, pointIndex] of header.pointNumbers.entries()) {
        const delta = deltas[pointIndex];
        const headerDelta = header.deltas[i];
        if (pointIndex < numPoints && delta && headerDelta) {
          delta.x += headerDelta.x * scalar;
          delta.y += headerDelta.y * scalar;
        }
      }
    } else {
      for (let i = 0; i < Math.min(header.deltas.length, numPoints); i++) {
        const delta = deltas[i];
        const headerDelta = header.deltas[i];
        if (delta && headerDelta) {
          delta.x += headerDelta.x * scalar;
          delta.y += headerDelta.y * scalar;
        }
      }
    }
  }
  for (const d of deltas) {
    d.x = Math.round(d.x);
    d.y = Math.round(d.y);
  }
  return deltas;
}
function applyVariationDeltas(contours, deltas) {
  const result = [];
  let pointIndex = 0;
  for (const contour of contours) {
    const newContour = [];
    for (const point of contour) {
      const delta = deltas[pointIndex] ?? { x: 0, y: 0 };
      newContour.push({
        x: point.x + delta.x,
        y: point.y + delta.y,
        onCurve: point.onCurve
      });
      pointIndex++;
    }
    result.push(newContour);
  }
  return result;
}
function getGlyphContoursWithVariation(glyf, loca, gvar, glyphId, axisCoords) {
  const glyph = parseGlyph(glyf, loca, glyphId);
  if (glyph.type === "empty") {
    return [];
  }
  let contours;
  if (glyph.type === "simple") {
    contours = glyph.contours;
  } else {
    contours = flattenCompositeGlyphWithVariation(
      glyf,
      loca,
      gvar,
      glyph,
      axisCoords
    );
  }
  if (gvar && axisCoords && axisCoords.length > 0) {
    let numPoints = 0;
    for (const c of contours) {
      numPoints += c.length;
    }
    numPoints += 4;
    const deltas = getGlyphDeltas(gvar, glyphId, numPoints, axisCoords);
    contours = applyVariationDeltas(contours, deltas);
  }
  return contours;
}
function flattenCompositeGlyphWithVariation(glyf, loca, gvar, glyph, axisCoords, depth = 0) {
  if (depth > 32) {
    return [];
  }
  const result = [];
  for (const component of glyph.components) {
    const componentGlyph = parseGlyph(glyf, loca, component.glyphId);
    let componentContours;
    if (componentGlyph.type === "simple") {
      componentContours = componentGlyph.contours;
      if (gvar && axisCoords && axisCoords.length > 0) {
        let numPoints = 0;
        for (const c2 of componentContours) {
          numPoints += c2.length;
        }
        numPoints += 4;
        const deltas = getGlyphDeltas(
          gvar,
          component.glyphId,
          numPoints,
          axisCoords
        );
        componentContours = applyVariationDeltas(componentContours, deltas);
      }
    } else if (componentGlyph.type === "composite") {
      componentContours = flattenCompositeGlyphWithVariation(
        glyf,
        loca,
        gvar,
        componentGlyph,
        axisCoords,
        depth + 1
      );
    } else {
      continue;
    }
    const [a, b, c, d] = component.transform;
    const dx = component.flags & CompositeFlag.ArgsAreXYValues ? component.arg1 : 0;
    const dy = component.flags & CompositeFlag.ArgsAreXYValues ? component.arg2 : 0;
    for (const contour of componentContours) {
      const transformedContour = contour.map((point) => ({
        x: Math.round(a * point.x + c * point.y + dx),
        y: Math.round(b * point.x + d * point.y + dy),
        onCurve: point.onCurve
      }));
      result.push(transformedContour);
    }
  }
  return result;
}

// src/font/tables/cff-charstring.ts
function executeCffCharString(cff, glyphId, fontIndex = 0) {
  const charStrings = cff.charStrings[fontIndex];
  if (!charStrings || glyphId >= charStrings.length) return null;
  const charString = charStrings[glyphId];
  if (!charString) return null;
  const globalSubrs = cff.globalSubrs;
  const topDict = cff.topDicts[fontIndex];
  const isCID = topDict?.ros !== void 0;
  let localSubrs = [];
  if (isCID && cff.fdSelects[fontIndex] && cff.fdArrays[fontIndex]) {
    const fdIndex = cff.fdSelects[fontIndex]?.select(glyphId) ?? 0;
    const fdArray = cff.fdArrays[fontIndex];
    const fd = fdArray?.[fdIndex];
    localSubrs = fd?.localSubrs || cff.localSubrs[fontIndex] || [];
  } else {
    localSubrs = cff.localSubrs[fontIndex] || [];
  }
  const state = {
    x: 0,
    y: 0,
    stack: [],
    nStems: 0,
    haveWidth: false,
    width: 0,
    contours: [],
    currentContour: [],
    transientArray: new Array(32).fill(0),
    callStack: [],
    vsindex: 0,
    axisCoords: null,
    vstore: null
  };
  executeCharString(state, charString, globalSubrs, localSubrs);
  if (state.currentContour.length > 0) {
    state.contours.push(state.currentContour);
  }
  return state.contours;
}
function executeCff2CharString(cff2, glyphId, axisCoords = null) {
  if (glyphId >= cff2.charStrings.length) return null;
  const charString = cff2.charStrings[glyphId];
  if (!charString) return null;
  const globalSubrs = cff2.globalSubrs;
  const fdIndex = cff2.fdSelect?.select(glyphId) ?? 0;
  const fd = cff2.fdArray[fdIndex];
  const localSubrs = fd?.localSubrs || [];
  const state = {
    x: 0,
    y: 0,
    stack: [],
    nStems: 0,
    haveWidth: true,
    // CFF2 doesn't have width in charstring
    width: 0,
    contours: [],
    currentContour: [],
    transientArray: new Array(32).fill(0),
    callStack: [],
    vsindex: fd?.private?.vsindex ?? 0,
    axisCoords,
    vstore: cff2.vstore
  };
  executeCharString(state, charString, globalSubrs, localSubrs);
  if (state.currentContour.length > 0) {
    state.contours.push(state.currentContour);
  }
  return state.contours;
}
function executeCharString(state, data, globalSubrs, localSubrs) {
  let pos = 0;
  while (pos < data.length) {
    const b0 = data[pos++];
    if (b0 === void 0) return;
    if (b0 === 28) {
      const b1 = data[pos++];
      if (b1 === void 0) return;
      const b2 = data[pos++];
      if (b2 === void 0) return;
      state.stack.push((b1 << 8 | b2) << 16 >> 16);
    } else if (b0 === 255) {
      const b1 = data[pos++];
      if (b1 === void 0) return;
      const b2 = data[pos++];
      if (b2 === void 0) return;
      const b3 = data[pos++];
      if (b3 === void 0) return;
      const b4 = data[pos++];
      if (b4 === void 0) return;
      const val = (b1 << 24 | b2 << 16 | b3 << 8 | b4) >> 0;
      state.stack.push(val / 65536);
    } else if (b0 >= 32 && b0 <= 246) {
      state.stack.push(b0 - 139);
    } else if (b0 >= 247 && b0 <= 250) {
      const b1 = data[pos++];
      if (b1 === void 0) return;
      state.stack.push((b0 - 247) * 256 + b1 + 108);
    } else if (b0 >= 251 && b0 <= 254) {
      const b1 = data[pos++];
      if (b1 === void 0) return;
      state.stack.push(-(b0 - 251) * 256 - b1 - 108);
    } else if (b0 === 12) {
      const b1 = data[pos++];
      if (b1 === void 0) return;
      const op = 3072 | b1;
      executeOperator(state, op, globalSubrs, localSubrs);
    } else if (b0 === 19 /* hintmask */ || b0 === 20 /* cntrmask */) {
      const stack = state.stack;
      const hasWidth = stack.length % 2 !== 0;
      if (hasWidth && !state.haveWidth) {
        const width = stack.shift();
        if (width !== void 0) {
          state.width = width;
          state.haveWidth = true;
        }
      }
      state.nStems += stack.length / 2;
      stack.length = 0;
      const maskBytes = Math.ceil(state.nStems / 8);
      pos += maskBytes;
    } else {
      executeOperator(state, b0, globalSubrs, localSubrs);
    }
    if (state.callStack.length > 0) {
      const frame = state.callStack[state.callStack.length - 1];
      if (frame && frame.pos >= frame.data.length) {
        state.callStack.pop();
      }
    }
  }
}
function executeOperator(state, op, globalSubrs, localSubrs) {
  const stack = state.stack;
  switch (op) {
    case 1 /* hstem */:
    case 3 /* vstem */:
    case 18 /* hstemhm */:
    case 23 /* vstemhm */: {
      const hasWidth = stack.length % 2 !== 0;
      if (hasWidth && !state.haveWidth) {
        const width = stack.shift();
        if (width === void 0) break;
        state.width = width;
        state.haveWidth = true;
      }
      state.nStems += stack.length / 2;
      stack.length = 0;
      break;
    }
    case 19 /* hintmask */:
    case 20 /* cntrmask */:
      break;
    case 21 /* rmoveto */: {
      if (stack.length > 2 && !state.haveWidth) {
        const width = stack.shift();
        if (width === void 0) break;
        state.width = width;
        state.haveWidth = true;
      }
      if (state.currentContour.length > 0) {
        state.contours.push(state.currentContour);
        state.currentContour = [];
      }
      const dy = stack.pop();
      if (dy === void 0) break;
      const dx = stack.pop();
      if (dx === void 0) break;
      state.x += dx;
      state.y += dy;
      state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
      stack.length = 0;
      break;
    }
    case 22 /* hmoveto */: {
      if (stack.length > 1 && !state.haveWidth) {
        const width = stack.shift();
        if (width === void 0) break;
        state.width = width;
        state.haveWidth = true;
      }
      if (state.currentContour.length > 0) {
        state.contours.push(state.currentContour);
        state.currentContour = [];
      }
      const dx = stack.pop();
      if (dx === void 0) break;
      state.x += dx;
      state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
      stack.length = 0;
      break;
    }
    case 4 /* vmoveto */: {
      if (stack.length > 1 && !state.haveWidth) {
        const width = stack.shift();
        if (width === void 0) break;
        state.width = width;
        state.haveWidth = true;
      }
      if (state.currentContour.length > 0) {
        state.contours.push(state.currentContour);
        state.currentContour = [];
      }
      const dy = stack.pop();
      if (dy === void 0) break;
      state.y += dy;
      state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
      stack.length = 0;
      break;
    }
    case 5 /* rlineto */: {
      while (stack.length >= 2) {
        const dx = stack.shift();
        if (dx === void 0) break;
        const dy = stack.shift();
        if (dy === void 0) break;
        state.x += dx;
        state.y += dy;
        state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
      }
      break;
    }
    case 6 /* hlineto */: {
      let isHorizontal = true;
      while (stack.length >= 1) {
        const val = stack.shift();
        if (val === void 0) break;
        if (isHorizontal) {
          state.x += val;
        } else {
          state.y += val;
        }
        state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
        isHorizontal = !isHorizontal;
      }
      break;
    }
    case 7 /* vlineto */: {
      let isVertical = true;
      while (stack.length >= 1) {
        const val = stack.shift();
        if (val === void 0) break;
        if (isVertical) {
          state.y += val;
        } else {
          state.x += val;
        }
        state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
        isVertical = !isVertical;
      }
      break;
    }
    case 8 /* rrcurveto */: {
      while (stack.length >= 6) {
        const dx1 = stack.shift();
        if (dx1 === void 0) break;
        const dy1 = stack.shift();
        if (dy1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dx3 = stack.shift();
        if (dx3 === void 0) break;
        const dy3 = stack.shift();
        if (dy3 === void 0) break;
        addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
      }
      break;
    }
    case 27 /* hhcurveto */: {
      let dy1 = 0;
      if (stack.length % 4 === 1) {
        const val = stack.shift();
        if (val === void 0) break;
        dy1 = val;
      }
      while (stack.length >= 4) {
        const dx1 = stack.shift();
        if (dx1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dx3 = stack.shift();
        if (dx3 === void 0) break;
        addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, 0);
        dy1 = 0;
      }
      break;
    }
    case 26 /* vvcurveto */: {
      let dx1 = 0;
      if (stack.length % 4 === 1) {
        const val = stack.shift();
        if (val === void 0) break;
        dx1 = val;
      }
      while (stack.length >= 4) {
        const dy1 = stack.shift();
        if (dy1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dy3 = stack.shift();
        if (dy3 === void 0) break;
        addCubicBezier(state, dx1, dy1, dx2, dy2, 0, dy3);
        dx1 = 0;
      }
      break;
    }
    case 31 /* hvcurveto */: {
      let isHorizontal = true;
      while (stack.length >= 4) {
        if (isHorizontal) {
          const dx1 = stack.shift();
          if (dx1 === void 0) break;
          const dx2 = stack.shift();
          if (dx2 === void 0) break;
          const dy2 = stack.shift();
          if (dy2 === void 0) break;
          const dy3 = stack.shift();
          if (dy3 === void 0) break;
          const dx3 = stack.length === 1 ? stack.shift() ?? 0 : 0;
          addCubicBezier(state, dx1, 0, dx2, dy2, dx3, dy3);
        } else {
          const dy1 = stack.shift();
          if (dy1 === void 0) break;
          const dx2 = stack.shift();
          if (dx2 === void 0) break;
          const dy2 = stack.shift();
          if (dy2 === void 0) break;
          const dx3 = stack.shift();
          if (dx3 === void 0) break;
          const dy3 = stack.length === 1 ? stack.shift() ?? 0 : 0;
          addCubicBezier(state, 0, dy1, dx2, dy2, dx3, dy3);
        }
        isHorizontal = !isHorizontal;
      }
      break;
    }
    case 30 /* vhcurveto */: {
      let isVertical = true;
      while (stack.length >= 4) {
        if (isVertical) {
          const dy1 = stack.shift();
          if (dy1 === void 0) break;
          const dx2 = stack.shift();
          if (dx2 === void 0) break;
          const dy2 = stack.shift();
          if (dy2 === void 0) break;
          const dx3 = stack.shift();
          if (dx3 === void 0) break;
          const dy3 = stack.length === 1 ? stack.shift() ?? 0 : 0;
          addCubicBezier(state, 0, dy1, dx2, dy2, dx3, dy3);
        } else {
          const dx1 = stack.shift();
          if (dx1 === void 0) break;
          const dx2 = stack.shift();
          if (dx2 === void 0) break;
          const dy2 = stack.shift();
          if (dy2 === void 0) break;
          const dy3 = stack.shift();
          if (dy3 === void 0) break;
          const dx3 = stack.length === 1 ? stack.shift() ?? 0 : 0;
          addCubicBezier(state, dx1, 0, dx2, dy2, dx3, dy3);
        }
        isVertical = !isVertical;
      }
      break;
    }
    case 24 /* rcurveline */: {
      while (stack.length >= 8) {
        const dx1 = stack.shift();
        if (dx1 === void 0) break;
        const dy1 = stack.shift();
        if (dy1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dx3 = stack.shift();
        if (dx3 === void 0) break;
        const dy3 = stack.shift();
        if (dy3 === void 0) break;
        addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
      }
      if (stack.length >= 2) {
        const dx = stack.shift();
        if (dx === void 0) break;
        const dy = stack.shift();
        if (dy === void 0) break;
        state.x += dx;
        state.y += dy;
        state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
      }
      break;
    }
    case 25 /* rlinecurve */: {
      while (stack.length >= 8) {
        const dx = stack.shift();
        if (dx === void 0) break;
        const dy = stack.shift();
        if (dy === void 0) break;
        state.x += dx;
        state.y += dy;
        state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
      }
      if (stack.length >= 6) {
        const dx1 = stack.shift();
        if (dx1 === void 0) break;
        const dy1 = stack.shift();
        if (dy1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dx3 = stack.shift();
        if (dx3 === void 0) break;
        const dy3 = stack.shift();
        if (dy3 === void 0) break;
        addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
      }
      break;
    }
    case 10 /* callsubr */: {
      const index = stack.pop();
      if (index === void 0) break;
      const biasedIndex = index + getSubrBias(localSubrs.length);
      const subr = localSubrs[biasedIndex];
      if (subr) {
        executeCharString(state, subr, globalSubrs, localSubrs);
      }
      break;
    }
    case 29 /* callgsubr */: {
      const index = stack.pop();
      if (index === void 0) break;
      const biasedIndex = index + getSubrBias(globalSubrs.length);
      const subr = globalSubrs[biasedIndex];
      if (subr) {
        executeCharString(state, subr, globalSubrs, localSubrs);
      }
      break;
    }
    case 11 /* return_ */:
      break;
    case 14 /* endchar */: {
      if (stack.length > 0 && !state.haveWidth) {
        const width = stack.shift();
        if (width === void 0) break;
        state.width = width;
        state.haveWidth = true;
      }
      if (state.currentContour.length > 0) {
        state.contours.push(state.currentContour);
        state.currentContour = [];
      }
      stack.length = 0;
      break;
    }
    // Flex operators
    case 3107 /* flex */: {
      if (stack.length >= 13) {
        const dx1 = stack.shift();
        if (dx1 === void 0) break;
        const dy1 = stack.shift();
        if (dy1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dx3 = stack.shift();
        if (dx3 === void 0) break;
        const dy3 = stack.shift();
        if (dy3 === void 0) break;
        const dx4 = stack.shift();
        if (dx4 === void 0) break;
        const dy4 = stack.shift();
        if (dy4 === void 0) break;
        const dx5 = stack.shift();
        if (dx5 === void 0) break;
        const dy5 = stack.shift();
        if (dy5 === void 0) break;
        const dx6 = stack.shift();
        if (dx6 === void 0) break;
        const dy6 = stack.shift();
        if (dy6 === void 0) break;
        stack.shift();
        addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
        addCubicBezier(state, dx4, dy4, dx5, dy5, dx6, dy6);
      }
      break;
    }
    case 3106 /* hflex */: {
      if (stack.length >= 7) {
        const dx1 = stack.shift();
        if (dx1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dx3 = stack.shift();
        if (dx3 === void 0) break;
        const dx4 = stack.shift();
        if (dx4 === void 0) break;
        const dx5 = stack.shift();
        if (dx5 === void 0) break;
        const dx6 = stack.shift();
        if (dx6 === void 0) break;
        addCubicBezier(state, dx1, 0, dx2, dy2, dx3, 0);
        addCubicBezier(state, dx4, 0, dx5, -dy2, dx6, 0);
      }
      break;
    }
    case 3108 /* hflex1 */: {
      if (stack.length >= 9) {
        const dx1 = stack.shift();
        if (dx1 === void 0) break;
        const dy1 = stack.shift();
        if (dy1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dx3 = stack.shift();
        if (dx3 === void 0) break;
        const dx4 = stack.shift();
        if (dx4 === void 0) break;
        const dx5 = stack.shift();
        if (dx5 === void 0) break;
        const dy5 = stack.shift();
        if (dy5 === void 0) break;
        const dx6 = stack.shift();
        if (dx6 === void 0) break;
        addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, 0);
        addCubicBezier(state, dx4, 0, dx5, dy5, dx6, -(dy1 + dy2 + dy5));
      }
      break;
    }
    case 3109 /* flex1 */: {
      if (stack.length >= 11) {
        const dx1 = stack.shift();
        if (dx1 === void 0) break;
        const dy1 = stack.shift();
        if (dy1 === void 0) break;
        const dx2 = stack.shift();
        if (dx2 === void 0) break;
        const dy2 = stack.shift();
        if (dy2 === void 0) break;
        const dx3 = stack.shift();
        if (dx3 === void 0) break;
        const dy3 = stack.shift();
        if (dy3 === void 0) break;
        const dx4 = stack.shift();
        if (dx4 === void 0) break;
        const dy4 = stack.shift();
        if (dy4 === void 0) break;
        const dx5 = stack.shift();
        if (dx5 === void 0) break;
        const dy5 = stack.shift();
        if (dy5 === void 0) break;
        const d6 = stack.shift();
        if (d6 === void 0) break;
        const dx = dx1 + dx2 + dx3 + dx4 + dx5;
        const dy = dy1 + dy2 + dy3 + dy4 + dy5;
        let dx6, dy6;
        if (Math.abs(dx) > Math.abs(dy)) {
          dx6 = d6;
          dy6 = -dy;
        } else {
          dx6 = -dx;
          dy6 = d6;
        }
        addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
        addCubicBezier(state, dx4, dy4, dx5, dy5, dx6, dy6);
      }
      break;
    }
    // Arithmetic operators
    case 3075 /* and_ */: {
      const b = stack.pop();
      if (b === void 0) break;
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(a && b ? 1 : 0);
      break;
    }
    case 3076 /* or_ */: {
      const b = stack.pop();
      if (b === void 0) break;
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(a || b ? 1 : 0);
      break;
    }
    case 3077 /* not_ */: {
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(a ? 0 : 1);
      break;
    }
    case 3081 /* abs_ */: {
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(Math.abs(a));
      break;
    }
    case 3082 /* add_ */: {
      const b = stack.pop();
      if (b === void 0) break;
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(a + b);
      break;
    }
    case 3083 /* sub_ */: {
      const b = stack.pop();
      if (b === void 0) break;
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(a - b);
      break;
    }
    case 3084 /* div_ */: {
      const b = stack.pop();
      if (b === void 0) break;
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(a / b);
      break;
    }
    case 3086 /* neg_ */: {
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(-a);
      break;
    }
    case 3087 /* eq_ */: {
      const b = stack.pop();
      if (b === void 0) break;
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(a === b ? 1 : 0);
      break;
    }
    case 3090 /* drop_ */: {
      stack.pop();
      break;
    }
    case 3092 /* put_ */: {
      const i = stack.pop();
      if (i === void 0) break;
      const val = stack.pop();
      if (val === void 0) break;
      state.transientArray[i] = val;
      break;
    }
    case 3093 /* get_ */: {
      const i = stack.pop();
      if (i === void 0) break;
      stack.push(state.transientArray[i] ?? 0);
      break;
    }
    case 3094 /* ifelse_ */: {
      const v2 = stack.pop();
      if (v2 === void 0) break;
      const v1 = stack.pop();
      if (v1 === void 0) break;
      const s2 = stack.pop();
      if (s2 === void 0) break;
      const s1 = stack.pop();
      if (s1 === void 0) break;
      stack.push(v1 <= v2 ? s1 : s2);
      break;
    }
    case 3095 /* random_ */: {
      stack.push(Math.random());
      break;
    }
    case 3096 /* mul_ */: {
      const b = stack.pop();
      if (b === void 0) break;
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(a * b);
      break;
    }
    case 3098 /* sqrt_ */: {
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(Math.sqrt(a));
      break;
    }
    case 3099 /* dup_ */: {
      const a = stack[stack.length - 1];
      if (a === void 0) break;
      stack.push(a);
      break;
    }
    case 3100 /* exch_ */: {
      const b = stack.pop();
      if (b === void 0) break;
      const a = stack.pop();
      if (a === void 0) break;
      stack.push(b, a);
      break;
    }
    case 3101 /* index_ */: {
      const i = stack.pop();
      if (i === void 0) break;
      const idx = stack.length - 1 - i;
      stack.push(stack[idx] ?? 0);
      break;
    }
    case 3102 /* roll_ */: {
      const j = stack.pop();
      if (j === void 0) break;
      const n = stack.pop();
      if (n === void 0) break;
      if (n > 0) {
        const items = stack.splice(-n);
        const shift = (j % n + n) % n;
        for (let i = 0; i < n; i++) {
          const item = items[(i + shift) % n];
          if (item !== void 0) {
            stack.push(item);
          }
        }
      }
      break;
    }
    // CFF2 blend operator
    case 16 /* blend */: {
      if (!state.axisCoords || !state.vstore) break;
      const n = stack.pop();
      if (n === void 0) break;
      const regionCount = state.vstore.itemVariationData[state.vsindex]?.regionIndexCount ?? 0;
      const totalDeltaCount = n * regionCount;
      const deltas = stack.splice(-totalDeltaCount);
      const defaults = stack.splice(-n);
      for (let i = 0; i < n; i++) {
        const defaultVal = defaults[i];
        if (defaultVal === void 0) continue;
        let value = defaultVal;
        for (let r = 0; r < regionCount; r++) {
          const delta = deltas[i * regionCount + r];
          if (delta === void 0) continue;
          const scalar = computeRegionScalar(
            state.vstore,
            state.vsindex,
            r,
            state.axisCoords
          );
          value += delta * scalar;
        }
        stack.push(value);
      }
      break;
    }
    case 15 /* vsindex */: {
      const vsindex = stack.pop();
      if (vsindex === void 0) break;
      state.vsindex = vsindex;
      break;
    }
    case 3072 /* dotsection */:
      break;
  }
}
function addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3) {
  const x0 = state.x;
  const y0 = state.y;
  const x1 = x0 + dx1;
  const y1 = y0 + dy1;
  const x2 = x1 + dx2;
  const y2 = y1 + dy2;
  const x3 = x2 + dx3;
  const y3 = y2 + dy3;
  state.currentContour.push({ x: x1, y: y1, onCurve: false, cubic: true });
  state.currentContour.push({ x: x2, y: y2, onCurve: false, cubic: true });
  state.currentContour.push({ x: x3, y: y3, onCurve: true });
  state.x = x3;
  state.y = y3;
}
function getSubrBias(count) {
  if (count < 1240) return 107;
  if (count < 33900) return 1131;
  return 32768;
}
function computeRegionScalar(vstore, vsindex, regionIndex, axisCoords) {
  const data = vstore.itemVariationData[vsindex];
  if (!data) return 0;
  const actualRegionIndex = data.regionIndexes[regionIndex];
  if (actualRegionIndex === void 0) return 0;
  const region = vstore.variationRegionList.regions[actualRegionIndex];
  if (!region) return 0;
  let scalar = 1;
  for (let i = 0; i < region.axes.length && i < axisCoords.length; i++) {
    const coords = region.axes[i];
    if (!coords) continue;
    const coord = axisCoords[i];
    if (coord === void 0) continue;
    if (coord < coords.startCoord || coord > coords.endCoord) {
      return 0;
    }
    if (coord === coords.peakCoord) {
      continue;
    }
    if (coord < coords.peakCoord) {
      scalar *= (coord - coords.startCoord) / (coords.peakCoord - coords.startCoord);
    } else {
      scalar *= (coords.endCoord - coord) / (coords.endCoord - coords.peakCoord);
    }
  }
  return scalar;
}
function getCffGlyphWidth(cff, _glyphId, fontIndex = 0) {
  const _topDict = cff.topDicts[fontIndex];
  return 0;
}

// src/layout/structures/coverage.ts
var CoverageFormat1 = class {
  glyphArray;
  glyphSet;
  constructor(glyphArray) {
    this.glyphArray = glyphArray;
    this.glyphSet = new Set(glyphArray);
  }
  get size() {
    return this.glyphArray.length;
  }
  get(glyphId) {
    let low = 0;
    let high = this.glyphArray.length - 1;
    while (low <= high) {
      const mid = low + high >>> 1;
      const midVal = this.glyphArray[mid];
      if (midVal === void 0) continue;
      if (midVal < glyphId) {
        low = mid + 1;
      } else if (midVal > glyphId) {
        high = mid - 1;
      } else {
        return mid;
      }
    }
    return null;
  }
  covers(glyphId) {
    return this.glyphSet.has(glyphId);
  }
  glyphs() {
    return Array.from(this.glyphArray);
  }
};
var CoverageFormat2 = class {
  ranges;
  _size;
  constructor(ranges) {
    this.ranges = ranges;
    if (ranges.length === 0) {
      this._size = 0;
    } else {
      const lastRange = ranges[ranges.length - 1];
      if (lastRange) {
        this._size = lastRange.startCoverageIndex + (lastRange.endGlyphId - lastRange.startGlyphId + 1);
      } else {
        this._size = 0;
      }
    }
  }
  get size() {
    return this._size;
  }
  get(glyphId) {
    let low = 0;
    let high = this.ranges.length - 1;
    while (low <= high) {
      const mid = low + high >>> 1;
      const range = this.ranges[mid];
      if (!range) continue;
      if (glyphId > range.endGlyphId) {
        low = mid + 1;
      } else if (glyphId < range.startGlyphId) {
        high = mid - 1;
      } else {
        return range.startCoverageIndex + (glyphId - range.startGlyphId);
      }
    }
    return null;
  }
  covers(glyphId) {
    return this.get(glyphId) !== null;
  }
  glyphs() {
    const result = [];
    for (const range of this.ranges) {
      for (let g = range.startGlyphId; g <= range.endGlyphId; g++) {
        result.push(g);
      }
    }
    return result;
  }
};
function parseCoverage(reader) {
  const format = reader.uint16();
  if (format === 1) {
    const glyphCount = reader.uint16();
    const glyphArray = reader.uint16Array(glyphCount);
    return new CoverageFormat1(glyphArray);
  }
  if (format === 2) {
    const rangeCount = reader.uint16();
    const ranges = new Array(rangeCount);
    for (let i = 0; i < rangeCount; i++) {
      ranges[i] = {
        startGlyphId: reader.uint16(),
        endGlyphId: reader.uint16(),
        startCoverageIndex: reader.uint16()
      };
    }
    return new CoverageFormat2(ranges);
  }
  throw new Error(`Unknown Coverage format: ${format}`);
}
function parseCoverageAt(reader, offset) {
  return parseCoverage(reader.sliceFrom(offset));
}

// src/layout/structures/device.ts
function isVariationIndexTable(table) {
  return "deltaSetOuterIndex" in table;
}
function parseDeviceAt(reader, offset) {
  if (offset === 0) return null;
  return parseDevice(reader.sliceFrom(offset));
}
function parseDevice(reader) {
  const startSize = reader.uint16();
  const endSize = reader.uint16();
  const deltaFormat = reader.uint16();
  if (deltaFormat === 32768) {
    return {
      deltaSetOuterIndex: startSize,
      deltaSetInnerIndex: endSize
    };
  }
  const deltaValues = [];
  if (deltaFormat >= 1 && deltaFormat <= 3) {
    const count = endSize - startSize + 1;
    const bitsPerValue = 1 << deltaFormat;
    const valuesPerWord = 16 / bitsPerValue;
    const mask = (1 << bitsPerValue) - 1;
    const signBit = 1 << bitsPerValue - 1;
    const wordCount = Math.ceil(count / valuesPerWord);
    let valueIndex = 0;
    for (let w = 0; w < wordCount; w++) {
      const word = reader.uint16();
      for (let v = 0; v < valuesPerWord && valueIndex < count; v++, valueIndex++) {
        const shift = 16 - bitsPerValue * (v + 1);
        let delta = word >> shift & mask;
        if (delta & signBit) {
          delta = delta - (1 << bitsPerValue);
        }
        deltaValues.push(delta);
      }
    }
  }
  return {
    startSize,
    endSize,
    deltaFormat,
    deltaValues
  };
}
function getDeviceDelta(device, ppem) {
  if (ppem < device.startSize || ppem > device.endSize) {
    return 0;
  }
  const index = ppem - device.startSize;
  return device.deltaValues[index] ?? 0;
}
function applyDeviceAdjustment(device, value, ppem) {
  if (!device) return value;
  if (isVariationIndexTable(device)) {
    return value;
  }
  return value + getDeviceDelta(device, ppem);
}

// src/layout/structures/layout-common.ts
var LookupFlag = {
  RightToLeft: 1,
  IgnoreBaseGlyphs: 2,
  IgnoreLigatures: 4,
  IgnoreMarks: 8,
  UseMarkFilteringSet: 16,
  // Bits 5-7 reserved
  MarkAttachmentTypeMask: 65280
};
function getMarkAttachmentType(lookupFlag) {
  return (lookupFlag & LookupFlag.MarkAttachmentTypeMask) >> 8;
}
function parseScriptList(reader) {
  const scriptCount = reader.uint16();
  const scriptRecords = [];
  for (let i = 0; i < scriptCount; i++) {
    scriptRecords.push({
      tag: reader.tag(),
      offset: reader.offset16()
    });
  }
  const scripts = [];
  for (const record of scriptRecords) {
    const scriptReader = reader.sliceFrom(record.offset);
    const script = parseScript(scriptReader);
    scripts.push({
      scriptTag: record.tag,
      script
    });
  }
  return { scripts };
}
function parseScript(reader) {
  const defaultLangSysOffset = reader.offset16();
  const langSysCount = reader.uint16();
  const langSysRecords = [];
  for (let i = 0; i < langSysCount; i++) {
    langSysRecords.push({
      tag: reader.tag(),
      offset: reader.offset16()
    });
  }
  let defaultLangSys = null;
  if (defaultLangSysOffset !== 0) {
    defaultLangSys = parseLangSys(reader.sliceFrom(defaultLangSysOffset));
  }
  const parsedLangSysRecords = [];
  for (const record of langSysRecords) {
    const langSys = parseLangSys(reader.sliceFrom(record.offset));
    parsedLangSysRecords.push({
      langSysTag: record.tag,
      langSys
    });
  }
  return {
    defaultLangSys,
    langSysRecords: parsedLangSysRecords
  };
}
function parseLangSys(reader) {
  const _lookupOrderOffset = reader.offset16();
  const requiredFeatureIndex = reader.uint16();
  const featureIndexCount = reader.uint16();
  const featureIndices = Array.from(reader.uint16Array(featureIndexCount));
  return {
    requiredFeatureIndex,
    featureIndices
  };
}
function parseFeatureList(reader) {
  const featureCount = reader.uint16();
  const featureRecords = [];
  for (let i = 0; i < featureCount; i++) {
    featureRecords.push({
      tag: reader.tag(),
      offset: reader.offset16()
    });
  }
  const features2 = [];
  for (const record of featureRecords) {
    const featureReader = reader.sliceFrom(record.offset);
    const feature2 = parseFeature(featureReader);
    features2.push({
      featureTag: record.tag,
      feature: feature2
    });
  }
  return { features: features2 };
}
function parseFeature(reader) {
  const featureParamsOffset = reader.offset16();
  const lookupIndexCount = reader.uint16();
  const lookupListIndices = Array.from(reader.uint16Array(lookupIndexCount));
  return {
    featureParamsOffset,
    lookupListIndices
  };
}
function findScript(scriptList, scriptTag) {
  for (const record of scriptList.scripts) {
    if (record.scriptTag === scriptTag) {
      return record.script;
    }
  }
  return null;
}
function findLangSys(script, langSysTag) {
  if (langSysTag === null) {
    return script.defaultLangSys;
  }
  for (const record of script.langSysRecords) {
    if (record.langSysTag === langSysTag) {
      return record.langSys;
    }
  }
  return script.defaultLangSys;
}
function getFeature(featureList, index) {
  return featureList.features[index] ?? null;
}

// src/font/tables/gpos-contextual.ts
function parseContextPos(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    switch (format) {
      case 1:
        subtables.push(parseContextPosFormat1(r));
        break;
      case 2:
        subtables.push(parseContextPosFormat2(r));
        break;
      case 3:
        subtables.push(parseContextPosFormat3(r));
        break;
    }
  }
  return subtables;
}
function parseContextPosFormat1(reader) {
  const coverageOffset = reader.offset16();
  const ruleSetCount = reader.uint16();
  const ruleSetOffsets = reader.uint16Array(ruleSetCount);
  const coverage = parseCoverageAt(reader, coverageOffset);
  const ruleSets = [];
  for (const ruleSetOffset of ruleSetOffsets) {
    if (ruleSetOffset === 0) {
      ruleSets.push(null);
      continue;
    }
    const rsReader = reader.sliceFrom(ruleSetOffset);
    const ruleCount = rsReader.uint16();
    const ruleOffsets = rsReader.uint16Array(ruleCount);
    const rules = [];
    for (const ruleOffset of ruleOffsets) {
      const ruleReader = rsReader.sliceFrom(ruleOffset);
      const glyphCount = ruleReader.uint16();
      const lookupCount = ruleReader.uint16();
      const inputSequence = Array.from(ruleReader.uint16Array(glyphCount - 1));
      const lookupRecords = parsePosLookupRecords(ruleReader, lookupCount);
      rules.push({ glyphCount, inputSequence, lookupRecords });
    }
    ruleSets.push(rules);
  }
  return { format: 1, coverage, ruleSets };
}
function parseContextPosFormat2(reader) {
  const coverageOffset = reader.offset16();
  const classDefOffset = reader.offset16();
  const classRuleSetCount = reader.uint16();
  const classRuleSetOffsets = reader.uint16Array(classRuleSetCount);
  const coverage = parseCoverageAt(reader, coverageOffset);
  const classDef = parseClassDefAt(reader, classDefOffset);
  const classRuleSets = [];
  for (const crsOffset of classRuleSetOffsets) {
    if (crsOffset === 0) {
      classRuleSets.push(null);
      continue;
    }
    const crsReader = reader.sliceFrom(crsOffset);
    const ruleCount = crsReader.uint16();
    const ruleOffsets = crsReader.uint16Array(ruleCount);
    const rules = [];
    for (const ruleOffset of ruleOffsets) {
      const ruleReader = crsReader.sliceFrom(ruleOffset);
      const glyphCount = ruleReader.uint16();
      const lookupCount = ruleReader.uint16();
      const inputClasses = Array.from(ruleReader.uint16Array(glyphCount - 1));
      const lookupRecords = parsePosLookupRecords(ruleReader, lookupCount);
      rules.push({ glyphCount, inputClasses, lookupRecords });
    }
    classRuleSets.push(rules);
  }
  return { format: 2, coverage, classDef, classRuleSets };
}
function parseContextPosFormat3(reader) {
  const glyphCount = reader.uint16();
  const lookupCount = reader.uint16();
  const coverageOffsets = reader.uint16Array(glyphCount);
  const coverages = [];
  for (const offset of coverageOffsets) {
    coverages.push(parseCoverageAt(reader, offset));
  }
  const lookupRecords = parsePosLookupRecords(reader, lookupCount);
  return { format: 3, coverages, lookupRecords };
}
function parseChainingContextPos(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    switch (format) {
      case 1:
        subtables.push(parseChainingPosFormat1(r));
        break;
      case 2:
        subtables.push(parseChainingPosFormat2(r));
        break;
      case 3:
        subtables.push(parseChainingPosFormat3(r));
        break;
    }
  }
  return subtables;
}
function parseChainingPosFormat1(reader) {
  const coverageOffset = reader.offset16();
  const chainRuleSetCount = reader.uint16();
  const chainRuleSetOffsets = reader.uint16Array(chainRuleSetCount);
  const coverage = parseCoverageAt(reader, coverageOffset);
  const chainRuleSets = [];
  for (const crsOffset of chainRuleSetOffsets) {
    if (crsOffset === 0) {
      chainRuleSets.push(null);
      continue;
    }
    const crsReader = reader.sliceFrom(crsOffset);
    const ruleCount = crsReader.uint16();
    const ruleOffsets = crsReader.uint16Array(ruleCount);
    const rules = [];
    for (const ruleOffset of ruleOffsets) {
      const ruleReader = crsReader.sliceFrom(ruleOffset);
      const backtrackCount = ruleReader.uint16();
      const backtrackSequence = Array.from(
        ruleReader.uint16Array(backtrackCount)
      );
      const inputCount = ruleReader.uint16();
      const inputSequence = Array.from(ruleReader.uint16Array(inputCount - 1));
      const lookaheadCount = ruleReader.uint16();
      const lookaheadSequence = Array.from(
        ruleReader.uint16Array(lookaheadCount)
      );
      const lookupCount = ruleReader.uint16();
      const lookupRecords = parsePosLookupRecords(ruleReader, lookupCount);
      rules.push({
        backtrackSequence,
        inputSequence,
        lookaheadSequence,
        lookupRecords
      });
    }
    chainRuleSets.push(rules);
  }
  return { format: 1, coverage, chainRuleSets };
}
function parseChainingPosFormat2(reader) {
  const coverageOffset = reader.offset16();
  const backtrackClassDefOffset = reader.offset16();
  const inputClassDefOffset = reader.offset16();
  const lookaheadClassDefOffset = reader.offset16();
  const chainClassRuleSetCount = reader.uint16();
  const chainClassRuleSetOffsets = reader.uint16Array(chainClassRuleSetCount);
  const coverage = parseCoverageAt(reader, coverageOffset);
  const backtrackClassDef = parseClassDefAt(reader, backtrackClassDefOffset);
  const inputClassDef = parseClassDefAt(reader, inputClassDefOffset);
  const lookaheadClassDef = parseClassDefAt(reader, lookaheadClassDefOffset);
  const chainClassRuleSets = [];
  for (const ccrsOffset of chainClassRuleSetOffsets) {
    if (ccrsOffset === 0) {
      chainClassRuleSets.push(null);
      continue;
    }
    const ccrsReader = reader.sliceFrom(ccrsOffset);
    const ruleCount = ccrsReader.uint16();
    const ruleOffsets = ccrsReader.uint16Array(ruleCount);
    const rules = [];
    for (const ruleOffset of ruleOffsets) {
      const ruleReader = ccrsReader.sliceFrom(ruleOffset);
      const backtrackCount = ruleReader.uint16();
      const backtrackClasses = Array.from(
        ruleReader.uint16Array(backtrackCount)
      );
      const inputCount = ruleReader.uint16();
      const inputClasses = Array.from(ruleReader.uint16Array(inputCount - 1));
      const lookaheadCount = ruleReader.uint16();
      const lookaheadClasses = Array.from(
        ruleReader.uint16Array(lookaheadCount)
      );
      const lookupCount = ruleReader.uint16();
      const lookupRecords = parsePosLookupRecords(ruleReader, lookupCount);
      rules.push({
        backtrackClasses,
        inputClasses,
        lookaheadClasses,
        lookupRecords
      });
    }
    chainClassRuleSets.push(rules);
  }
  return {
    format: 2,
    coverage,
    backtrackClassDef,
    inputClassDef,
    lookaheadClassDef,
    chainClassRuleSets
  };
}
function parseChainingPosFormat3(reader) {
  const backtrackCount = reader.uint16();
  const backtrackCoverageOffsets = reader.uint16Array(backtrackCount);
  const inputCount = reader.uint16();
  const inputCoverageOffsets = reader.uint16Array(inputCount);
  const lookaheadCount = reader.uint16();
  const lookaheadCoverageOffsets = reader.uint16Array(lookaheadCount);
  const lookupCount = reader.uint16();
  const lookupRecords = parsePosLookupRecords(reader, lookupCount);
  const backtrackCoverages = [];
  for (const offset of backtrackCoverageOffsets) {
    backtrackCoverages.push(parseCoverageAt(reader, offset));
  }
  const inputCoverages = [];
  for (const offset of inputCoverageOffsets) {
    inputCoverages.push(parseCoverageAt(reader, offset));
  }
  const lookaheadCoverages = [];
  for (const offset of lookaheadCoverageOffsets) {
    lookaheadCoverages.push(parseCoverageAt(reader, offset));
  }
  return {
    format: 3,
    backtrackCoverages,
    inputCoverages,
    lookaheadCoverages,
    lookupRecords
  };
}
function parsePosLookupRecords(reader, count) {
  const records = [];
  for (let i = 0; i < count; i++) {
    records.push({
      sequenceIndex: reader.uint16(),
      lookupListIndex: reader.uint16()
    });
  }
  return records;
}

// src/font/tables/gpos-mark.ts
function parseAnchor(reader) {
  const format = reader.uint16();
  const xCoordinate = reader.int16();
  const yCoordinate = reader.int16();
  const anchor = { xCoordinate, yCoordinate };
  if (format === 2) {
    anchor.anchorPoint = reader.uint16();
  } else if (format === 3) {
    anchor.xDeviceOffset = reader.uint16();
    anchor.yDeviceOffset = reader.uint16();
  }
  return anchor;
}
function parseAnchorAt(reader, offset) {
  if (offset === 0) return null;
  return parseAnchor(reader.sliceFrom(offset));
}
function parseMarkArray(reader) {
  const markCount = reader.uint16();
  const markRecords = [];
  const recordData = [];
  for (let i = 0; i < markCount; i++) {
    recordData.push({
      markClass: reader.uint16(),
      anchorOffset: reader.uint16()
    });
  }
  for (const data of recordData) {
    const markAnchor = parseAnchor(reader.sliceFrom(data.anchorOffset));
    markRecords.push({
      markClass: data.markClass,
      markAnchor
    });
  }
  return { markRecords };
}
function parseCursivePos(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const coverageOffset = r.offset16();
      const entryExitCount = r.uint16();
      const entryExitData = [];
      for (let i = 0; i < entryExitCount; i++) {
        entryExitData.push({
          entryOffset: r.uint16(),
          exitOffset: r.uint16()
        });
      }
      const coverage = parseCoverageAt(r, coverageOffset);
      const entryExitRecords = [];
      for (const data of entryExitData) {
        entryExitRecords.push({
          entryAnchor: parseAnchorAt(r, data.entryOffset),
          exitAnchor: parseAnchorAt(r, data.exitOffset)
        });
      }
      subtables.push({ coverage, entryExitRecords });
    }
  }
  return subtables;
}
function parseMarkBasePos(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const markCoverageOffset = r.offset16();
      const baseCoverageOffset = r.offset16();
      const markClassCount = r.uint16();
      const markArrayOffset = r.offset16();
      const baseArrayOffset = r.offset16();
      const markCoverage = parseCoverageAt(r, markCoverageOffset);
      const baseCoverage = parseCoverageAt(r, baseCoverageOffset);
      const markArray = parseMarkArray(r.sliceFrom(markArrayOffset));
      const baseArrayReader = r.sliceFrom(baseArrayOffset);
      const baseCount = baseArrayReader.uint16();
      const baseArray = [];
      const baseRecordData = [];
      for (let i = 0; i < baseCount; i++) {
        const anchorOffsets = [];
        for (let j = 0; j < markClassCount; j++) {
          anchorOffsets.push(baseArrayReader.uint16());
        }
        baseRecordData.push(anchorOffsets);
      }
      for (const anchorOffsets of baseRecordData) {
        const baseAnchors = [];
        for (const anchorOffset of anchorOffsets) {
          baseAnchors.push(parseAnchorAt(baseArrayReader, anchorOffset));
        }
        baseArray.push({ baseAnchors });
      }
      subtables.push({
        markCoverage,
        baseCoverage,
        markClassCount,
        markArray,
        baseArray
      });
    }
  }
  return subtables;
}
function parseMarkLigaturePos(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const markCoverageOffset = r.offset16();
      const ligatureCoverageOffset = r.offset16();
      const markClassCount = r.uint16();
      const markArrayOffset = r.offset16();
      const ligatureArrayOffset = r.offset16();
      const markCoverage = parseCoverageAt(r, markCoverageOffset);
      const ligatureCoverage = parseCoverageAt(r, ligatureCoverageOffset);
      const markArray = parseMarkArray(r.sliceFrom(markArrayOffset));
      const ligArrayReader = r.sliceFrom(ligatureArrayOffset);
      const ligatureCount = ligArrayReader.uint16();
      const ligatureAttachOffsets = ligArrayReader.uint16Array(ligatureCount);
      const ligatureArray = [];
      for (const ligAttachOffset of ligatureAttachOffsets) {
        const ligAttachReader = ligArrayReader.sliceFrom(ligAttachOffset);
        const componentCount = ligAttachReader.uint16();
        const componentRecords = [];
        const componentData = [];
        for (let i = 0; i < componentCount; i++) {
          const anchorOffsets = [];
          for (let j = 0; j < markClassCount; j++) {
            anchorOffsets.push(ligAttachReader.uint16());
          }
          componentData.push(anchorOffsets);
        }
        for (const anchorOffsets of componentData) {
          const ligatureAnchors = [];
          for (const anchorOffset of anchorOffsets) {
            ligatureAnchors.push(parseAnchorAt(ligAttachReader, anchorOffset));
          }
          componentRecords.push({ ligatureAnchors });
        }
        ligatureArray.push({ componentRecords });
      }
      subtables.push({
        markCoverage,
        ligatureCoverage,
        markClassCount,
        markArray,
        ligatureArray
      });
    }
  }
  return subtables;
}
function parseMarkMarkPos(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const mark1CoverageOffset = r.offset16();
      const mark2CoverageOffset = r.offset16();
      const markClassCount = r.uint16();
      const mark1ArrayOffset = r.offset16();
      const mark2ArrayOffset = r.offset16();
      const mark1Coverage = parseCoverageAt(r, mark1CoverageOffset);
      const mark2Coverage = parseCoverageAt(r, mark2CoverageOffset);
      const mark1Array = parseMarkArray(r.sliceFrom(mark1ArrayOffset));
      const mark2ArrayReader = r.sliceFrom(mark2ArrayOffset);
      const mark2Count = mark2ArrayReader.uint16();
      const mark2Array = [];
      const mark2Data = [];
      for (let i = 0; i < mark2Count; i++) {
        const anchorOffsets = [];
        for (let j = 0; j < markClassCount; j++) {
          anchorOffsets.push(mark2ArrayReader.uint16());
        }
        mark2Data.push(anchorOffsets);
      }
      for (const anchorOffsets of mark2Data) {
        const mark2Anchors = [];
        for (const anchorOffset of anchorOffsets) {
          mark2Anchors.push(parseAnchorAt(mark2ArrayReader, anchorOffset));
        }
        mark2Array.push({ mark2Anchors });
      }
      subtables.push({
        mark1Coverage,
        mark2Coverage,
        markClassCount,
        mark1Array,
        mark2Array
      });
    }
  }
  return subtables;
}

// src/font/tables/gpos.ts
var ValueFormat = {
  XPlacement: 1,
  YPlacement: 2,
  XAdvance: 4,
  YAdvance: 8,
  XPlaDevice: 16,
  YPlaDevice: 32,
  XAdvDevice: 64,
  YAdvDevice: 128
};
function parseGpos(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const scriptListOffset = reader.offset16();
  const featureListOffset = reader.offset16();
  const lookupListOffset = reader.offset16();
  if (majorVersion === 1 && minorVersion >= 1) {
    reader.offset32();
  }
  const scriptList = parseScriptList(reader.sliceFrom(scriptListOffset));
  const featureList = parseFeatureList(reader.sliceFrom(featureListOffset));
  const lookupListReader = reader.sliceFrom(lookupListOffset);
  const lookupCount = lookupListReader.uint16();
  const lookupOffsets = lookupListReader.uint16Array(lookupCount);
  const lookups = [];
  for (const lookupOffset of lookupOffsets) {
    const lookupReader = lookupListReader.sliceFrom(lookupOffset);
    const lookup = parseGposLookup(lookupReader);
    if (lookup) {
      lookups.push(lookup);
    }
  }
  return {
    version: { major: majorVersion, minor: minorVersion },
    scriptList,
    featureList,
    lookups
  };
}
function parseGposLookup(reader) {
  const lookupType = reader.uint16();
  const lookupFlag = reader.uint16();
  const subtableCount = reader.uint16();
  const subtableOffsets = Array.from(reader.uint16Array(subtableCount));
  let markFilteringSet;
  if (lookupFlag & LookupFlag.UseMarkFilteringSet) {
    markFilteringSet = reader.uint16();
  }
  const baseProps = { flag: lookupFlag, markFilteringSet };
  switch (lookupType) {
    case 1 /* Single */:
      return {
        type: 1 /* Single */,
        ...baseProps,
        subtables: parseSinglePos(reader, subtableOffsets)
      };
    case 2 /* Pair */:
      return {
        type: 2 /* Pair */,
        ...baseProps,
        subtables: parsePairPos(reader, subtableOffsets)
      };
    case 3 /* Cursive */:
      return {
        type: 3 /* Cursive */,
        ...baseProps,
        subtables: parseCursivePos(reader, subtableOffsets)
      };
    case 4 /* MarkToBase */:
      return {
        type: 4 /* MarkToBase */,
        ...baseProps,
        subtables: parseMarkBasePos(reader, subtableOffsets)
      };
    case 5 /* MarkToLigature */:
      return {
        type: 5 /* MarkToLigature */,
        ...baseProps,
        subtables: parseMarkLigaturePos(reader, subtableOffsets)
      };
    case 6 /* MarkToMark */:
      return {
        type: 6 /* MarkToMark */,
        ...baseProps,
        subtables: parseMarkMarkPos(reader, subtableOffsets)
      };
    case 7 /* Context */:
      return {
        type: 7 /* Context */,
        ...baseProps,
        subtables: parseContextPos(reader, subtableOffsets)
      };
    case 8 /* ChainingContext */:
      return {
        type: 8 /* ChainingContext */,
        ...baseProps,
        subtables: parseChainingContextPos(reader, subtableOffsets)
      };
    case 9 /* Extension */:
      return parseExtensionLookup(reader, subtableOffsets, baseProps);
    default:
      return null;
  }
}
function parseValueRecord(reader, valueFormat, subtableReader) {
  const record = {};
  if (valueFormat & ValueFormat.XPlacement) record.xPlacement = reader.int16();
  if (valueFormat & ValueFormat.YPlacement) record.yPlacement = reader.int16();
  if (valueFormat & ValueFormat.XAdvance) record.xAdvance = reader.int16();
  if (valueFormat & ValueFormat.YAdvance) record.yAdvance = reader.int16();
  const deviceReader = subtableReader ?? reader;
  if (valueFormat & ValueFormat.XPlaDevice) {
    const offset = reader.uint16();
    if (offset !== 0)
      record.xPlaDevice = parseDeviceAt(deviceReader, offset) ?? void 0;
  }
  if (valueFormat & ValueFormat.YPlaDevice) {
    const offset = reader.uint16();
    if (offset !== 0)
      record.yPlaDevice = parseDeviceAt(deviceReader, offset) ?? void 0;
  }
  if (valueFormat & ValueFormat.XAdvDevice) {
    const offset = reader.uint16();
    if (offset !== 0)
      record.xAdvDevice = parseDeviceAt(deviceReader, offset) ?? void 0;
  }
  if (valueFormat & ValueFormat.YAdvDevice) {
    const offset = reader.uint16();
    if (offset !== 0)
      record.yAdvDevice = parseDeviceAt(deviceReader, offset) ?? void 0;
  }
  return record;
}
function parseSinglePos(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const subtableReader = reader.sliceFrom(offset);
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const coverageOffset = r.offset16();
      const valueFormat = r.uint16();
      const value = parseValueRecord(r, valueFormat, subtableReader);
      const coverage = parseCoverageAt(subtableReader, coverageOffset);
      subtables.push({ format: 1, coverage, valueFormat, value });
    } else if (format === 2) {
      const coverageOffset = r.offset16();
      const valueFormat = r.uint16();
      const valueCount = r.uint16();
      const values = [];
      for (let i = 0; i < valueCount; i++) {
        values.push(parseValueRecord(r, valueFormat, subtableReader));
      }
      const coverage = parseCoverageAt(subtableReader, coverageOffset);
      subtables.push({ format: 2, coverage, valueFormat, values });
    }
  }
  return subtables;
}
function parsePairPos(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const subtableReader = reader.sliceFrom(offset);
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      subtables.push(parsePairPosFormat1(r, subtableReader));
    } else if (format === 2) {
      subtables.push(parsePairPosFormat2(r, subtableReader));
    }
  }
  return subtables;
}
function parsePairPosFormat1(reader, subtableReader) {
  const coverageOffset = reader.offset16();
  const valueFormat1 = reader.uint16();
  const valueFormat2 = reader.uint16();
  const pairSetCount = reader.uint16();
  const pairSetOffsets = reader.uint16Array(pairSetCount);
  const coverage = parseCoverageAt(subtableReader, coverageOffset);
  const pairSets = [];
  for (const pairSetOffset of pairSetOffsets) {
    const pairSetReader = subtableReader.sliceFrom(pairSetOffset);
    const r = subtableReader.sliceFrom(pairSetOffset);
    const pairValueCount = r.uint16();
    const pairValueRecords = [];
    for (let i = 0; i < pairValueCount; i++) {
      const secondGlyph = r.uint16();
      const value1 = parseValueRecord(r, valueFormat1, pairSetReader);
      const value2 = parseValueRecord(r, valueFormat2, pairSetReader);
      pairValueRecords.push({ secondGlyph, value1, value2 });
    }
    pairSets.push({ pairValueRecords });
  }
  return { format: 1, coverage, valueFormat1, valueFormat2, pairSets };
}
function parsePairPosFormat2(reader, subtableReader) {
  const coverageOffset = reader.offset16();
  const valueFormat1 = reader.uint16();
  const valueFormat2 = reader.uint16();
  const classDef1Offset = reader.offset16();
  const classDef2Offset = reader.offset16();
  const class1Count = reader.uint16();
  const class2Count = reader.uint16();
  const coverage = parseCoverageAt(subtableReader, coverageOffset);
  const classDef1 = parseClassDefAt(subtableReader, classDef1Offset);
  const classDef2 = parseClassDefAt(subtableReader, classDef2Offset);
  const class1Records = [];
  for (let i = 0; i < class1Count; i++) {
    const class2Records = [];
    for (let j = 0; j < class2Count; j++) {
      const value1 = parseValueRecord(reader, valueFormat1, subtableReader);
      const value2 = parseValueRecord(reader, valueFormat2, subtableReader);
      class2Records.push({ value1, value2 });
    }
    class1Records.push({ class2Records });
  }
  return {
    format: 2,
    coverage,
    valueFormat1,
    valueFormat2,
    classDef1,
    classDef2,
    class1Count,
    class2Count,
    class1Records
  };
}
function parseExtensionLookup(reader, subtableOffsets, baseProps) {
  if (subtableOffsets.length === 0) return null;
  const extSubtables = [];
  for (const offset of subtableOffsets) {
    const extReader = reader.sliceFrom(offset);
    const format = extReader.uint16();
    if (format !== 1) continue;
    const extensionLookupType = extReader.uint16();
    const extensionOffset = extReader.uint32();
    extSubtables.push({
      type: extensionLookupType,
      reader: extReader.sliceFrom(extensionOffset)
    });
  }
  if (extSubtables.length === 0) return null;
  const actualType = extSubtables[0]?.type;
  switch (actualType) {
    case 1 /* Single */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseSinglePos(ext.reader, [0]));
      }
      return { type: 1 /* Single */, ...baseProps, subtables };
    }
    case 2 /* Pair */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parsePairPos(ext.reader, [0]));
      }
      return { type: 2 /* Pair */, ...baseProps, subtables };
    }
    case 3 /* Cursive */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseCursivePos(ext.reader, [0]));
      }
      return { type: 3 /* Cursive */, ...baseProps, subtables };
    }
    case 4 /* MarkToBase */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseMarkBasePos(ext.reader, [0]));
      }
      return { type: 4 /* MarkToBase */, ...baseProps, subtables };
    }
    case 5 /* MarkToLigature */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseMarkLigaturePos(ext.reader, [0]));
      }
      return { type: 5 /* MarkToLigature */, ...baseProps, subtables };
    }
    case 6 /* MarkToMark */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseMarkMarkPos(ext.reader, [0]));
      }
      return { type: 6 /* MarkToMark */, ...baseProps, subtables };
    }
    case 7 /* Context */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseContextPos(ext.reader, [0]));
      }
      return { type: 7 /* Context */, ...baseProps, subtables };
    }
    case 8 /* ChainingContext */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseChainingContextPos(ext.reader, [0]));
      }
      return { type: 8 /* ChainingContext */, ...baseProps, subtables };
    }
    default:
      return null;
  }
}
function getKerning(lookup, firstGlyph, secondGlyph) {
  for (const subtable of lookup.subtables) {
    const coverageIndex = subtable.coverage.get(firstGlyph);
    if (coverageIndex === null) continue;
    if (subtable.format === 1) {
      const pairSet = subtable.pairSets[coverageIndex];
      if (!pairSet) continue;
      for (const record of pairSet.pairValueRecords) {
        if (record.secondGlyph === secondGlyph) {
          return {
            xAdvance1: record.value1.xAdvance ?? 0,
            xAdvance2: record.value2.xAdvance ?? 0
          };
        }
      }
    } else if (subtable.format === 2) {
      const class1 = subtable.classDef1.get(firstGlyph);
      const class2 = subtable.classDef2.get(secondGlyph);
      const class1Record = subtable.class1Records[class1];
      if (!class1Record) continue;
      const class2Record = class1Record.class2Records[class2];
      if (!class2Record) continue;
      return {
        xAdvance1: class2Record.value1.xAdvance ?? 0,
        xAdvance2: class2Record.value2.xAdvance ?? 0
      };
    }
  }
  return null;
}

// src/font/tables/gsub-contextual.ts
function parseContextSubst(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    switch (format) {
      case 1:
        subtables.push(parseContextFormat1(r));
        break;
      case 2:
        subtables.push(parseContextFormat2(r));
        break;
      case 3:
        subtables.push(parseContextFormat3(r));
        break;
    }
  }
  return subtables;
}
function parseContextFormat1(reader) {
  const coverageOffset = reader.offset16();
  const ruleSetCount = reader.uint16();
  const ruleSetOffsets = reader.uint16Array(ruleSetCount);
  const coverage = parseCoverageAt(reader, coverageOffset);
  const ruleSets = [];
  for (const ruleSetOffset of ruleSetOffsets) {
    if (ruleSetOffset === 0) {
      ruleSets.push(null);
      continue;
    }
    const rsReader = reader.sliceFrom(ruleSetOffset);
    const ruleCount = rsReader.uint16();
    const ruleOffsets = rsReader.uint16Array(ruleCount);
    const rules = [];
    for (const ruleOffset of ruleOffsets) {
      const ruleReader = rsReader.sliceFrom(ruleOffset);
      const glyphCount = ruleReader.uint16();
      const lookupCount = ruleReader.uint16();
      const inputSequence = Array.from(ruleReader.uint16Array(glyphCount - 1));
      const lookupRecords = parseLookupRecords(ruleReader, lookupCount);
      rules.push({ glyphCount, inputSequence, lookupRecords });
    }
    ruleSets.push(rules);
  }
  return { format: 1, coverage, ruleSets };
}
function parseContextFormat2(reader) {
  const coverageOffset = reader.offset16();
  const classDefOffset = reader.offset16();
  const classRuleSetCount = reader.uint16();
  const classRuleSetOffsets = reader.uint16Array(classRuleSetCount);
  const coverage = parseCoverageAt(reader, coverageOffset);
  const classDef = parseClassDefAt(reader, classDefOffset);
  const classRuleSets = [];
  for (const crsOffset of classRuleSetOffsets) {
    if (crsOffset === 0) {
      classRuleSets.push(null);
      continue;
    }
    const crsReader = reader.sliceFrom(crsOffset);
    const ruleCount = crsReader.uint16();
    const ruleOffsets = crsReader.uint16Array(ruleCount);
    const rules = [];
    for (const ruleOffset of ruleOffsets) {
      const ruleReader = crsReader.sliceFrom(ruleOffset);
      const glyphCount = ruleReader.uint16();
      const lookupCount = ruleReader.uint16();
      const inputClasses = Array.from(ruleReader.uint16Array(glyphCount - 1));
      const lookupRecords = parseLookupRecords(ruleReader, lookupCount);
      rules.push({ glyphCount, inputClasses, lookupRecords });
    }
    classRuleSets.push(rules);
  }
  return { format: 2, coverage, classDef, classRuleSets };
}
function parseContextFormat3(reader) {
  const glyphCount = reader.uint16();
  const lookupCount = reader.uint16();
  const coverageOffsets = reader.uint16Array(glyphCount);
  const coverages = [];
  for (const offset of coverageOffsets) {
    coverages.push(parseCoverageAt(reader, offset));
  }
  const lookupRecords = parseLookupRecords(reader, lookupCount);
  return { format: 3, coverages, lookupRecords };
}
function parseChainingContextSubst(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    switch (format) {
      case 1:
        subtables.push(parseChainingFormat1(r));
        break;
      case 2:
        subtables.push(parseChainingFormat2(r));
        break;
      case 3:
        subtables.push(parseChainingFormat3(r));
        break;
    }
  }
  return subtables;
}
function parseChainingFormat1(reader) {
  const coverageOffset = reader.offset16();
  const chainRuleSetCount = reader.uint16();
  const chainRuleSetOffsets = reader.uint16Array(chainRuleSetCount);
  const coverage = parseCoverageAt(reader, coverageOffset);
  const chainRuleSets = [];
  for (const crsOffset of chainRuleSetOffsets) {
    if (crsOffset === 0) {
      chainRuleSets.push(null);
      continue;
    }
    const crsReader = reader.sliceFrom(crsOffset);
    const ruleCount = crsReader.uint16();
    const ruleOffsets = crsReader.uint16Array(ruleCount);
    const rules = [];
    for (const ruleOffset of ruleOffsets) {
      const ruleReader = crsReader.sliceFrom(ruleOffset);
      const backtrackCount = ruleReader.uint16();
      const backtrackSequence = Array.from(
        ruleReader.uint16Array(backtrackCount)
      );
      const inputCount = ruleReader.uint16();
      const inputSequence = Array.from(ruleReader.uint16Array(inputCount - 1));
      const lookaheadCount = ruleReader.uint16();
      const lookaheadSequence = Array.from(
        ruleReader.uint16Array(lookaheadCount)
      );
      const lookupCount = ruleReader.uint16();
      const lookupRecords = parseLookupRecords(ruleReader, lookupCount);
      rules.push({
        backtrackSequence,
        inputSequence,
        lookaheadSequence,
        lookupRecords
      });
    }
    chainRuleSets.push(rules);
  }
  return { format: 1, coverage, chainRuleSets };
}
function parseChainingFormat2(reader) {
  const coverageOffset = reader.offset16();
  const backtrackClassDefOffset = reader.offset16();
  const inputClassDefOffset = reader.offset16();
  const lookaheadClassDefOffset = reader.offset16();
  const chainClassRuleSetCount = reader.uint16();
  const chainClassRuleSetOffsets = reader.uint16Array(chainClassRuleSetCount);
  const coverage = parseCoverageAt(reader, coverageOffset);
  const backtrackClassDef = parseClassDefAt(reader, backtrackClassDefOffset);
  const inputClassDef = parseClassDefAt(reader, inputClassDefOffset);
  const lookaheadClassDef = parseClassDefAt(reader, lookaheadClassDefOffset);
  const chainClassRuleSets = [];
  for (const ccrsOffset of chainClassRuleSetOffsets) {
    if (ccrsOffset === 0) {
      chainClassRuleSets.push(null);
      continue;
    }
    const ccrsReader = reader.sliceFrom(ccrsOffset);
    const ruleCount = ccrsReader.uint16();
    const ruleOffsets = ccrsReader.uint16Array(ruleCount);
    const rules = [];
    for (const ruleOffset of ruleOffsets) {
      const ruleReader = ccrsReader.sliceFrom(ruleOffset);
      const backtrackCount = ruleReader.uint16();
      const backtrackClasses = Array.from(
        ruleReader.uint16Array(backtrackCount)
      );
      const inputCount = ruleReader.uint16();
      const inputClasses = Array.from(ruleReader.uint16Array(inputCount - 1));
      const lookaheadCount = ruleReader.uint16();
      const lookaheadClasses = Array.from(
        ruleReader.uint16Array(lookaheadCount)
      );
      const lookupCount = ruleReader.uint16();
      const lookupRecords = parseLookupRecords(ruleReader, lookupCount);
      rules.push({
        backtrackClasses,
        inputClasses,
        lookaheadClasses,
        lookupRecords
      });
    }
    chainClassRuleSets.push(rules);
  }
  return {
    format: 2,
    coverage,
    backtrackClassDef,
    inputClassDef,
    lookaheadClassDef,
    chainClassRuleSets
  };
}
function parseChainingFormat3(reader) {
  const backtrackCount = reader.uint16();
  const backtrackCoverageOffsets = reader.uint16Array(backtrackCount);
  const inputCount = reader.uint16();
  const inputCoverageOffsets = reader.uint16Array(inputCount);
  const lookaheadCount = reader.uint16();
  const lookaheadCoverageOffsets = reader.uint16Array(lookaheadCount);
  const lookupCount = reader.uint16();
  const lookupRecords = parseLookupRecords(reader, lookupCount);
  const backtrackCoverages = [];
  for (const offset of backtrackCoverageOffsets) {
    backtrackCoverages.push(parseCoverageAt(reader, offset));
  }
  const inputCoverages = [];
  for (const offset of inputCoverageOffsets) {
    inputCoverages.push(parseCoverageAt(reader, offset));
  }
  const lookaheadCoverages = [];
  for (const offset of lookaheadCoverageOffsets) {
    lookaheadCoverages.push(parseCoverageAt(reader, offset));
  }
  return {
    format: 3,
    backtrackCoverages,
    inputCoverages,
    lookaheadCoverages,
    lookupRecords
  };
}
function parseLookupRecords(reader, count) {
  const records = [];
  for (let i = 0; i < count; i++) {
    records.push({
      sequenceIndex: reader.uint16(),
      lookupListIndex: reader.uint16()
    });
  }
  return records;
}

// src/font/tables/gsub.ts
function parseGsub(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const scriptListOffset = reader.offset16();
  const featureListOffset = reader.offset16();
  const lookupListOffset = reader.offset16();
  if (majorVersion === 1 && minorVersion >= 1) {
    reader.offset32();
  }
  const scriptList = parseScriptList(reader.sliceFrom(scriptListOffset));
  const featureList = parseFeatureList(reader.sliceFrom(featureListOffset));
  const lookupListReader = reader.sliceFrom(lookupListOffset);
  const lookupCount = lookupListReader.uint16();
  const lookupOffsets = lookupListReader.uint16Array(lookupCount);
  const lookups = [];
  for (const lookupOffset of lookupOffsets) {
    const lookupReader = lookupListReader.sliceFrom(lookupOffset);
    const lookup = parseGsubLookup(
      lookupReader,
      lookupListReader,
      lookupOffset
    );
    if (lookup) {
      lookups.push(lookup);
    }
  }
  return {
    version: { major: majorVersion, minor: minorVersion },
    scriptList,
    featureList,
    lookups
  };
}
function parseGsubLookup(reader, _lookupListReader, _lookupOffset) {
  const lookupType = reader.uint16();
  const lookupFlag = reader.uint16();
  const subtableCount = reader.uint16();
  const subtableOffsets = Array.from(reader.uint16Array(subtableCount));
  let markFilteringSet;
  if (lookupFlag & LookupFlag.UseMarkFilteringSet) {
    markFilteringSet = reader.uint16();
  }
  const baseProps = { flag: lookupFlag, markFilteringSet };
  switch (lookupType) {
    case 1 /* Single */:
      return {
        type: 1 /* Single */,
        ...baseProps,
        subtables: parseSingleSubst(reader, subtableOffsets)
      };
    case 2 /* Multiple */:
      return {
        type: 2 /* Multiple */,
        ...baseProps,
        subtables: parseMultipleSubst(reader, subtableOffsets)
      };
    case 3 /* Alternate */:
      return {
        type: 3 /* Alternate */,
        ...baseProps,
        subtables: parseAlternateSubst(reader, subtableOffsets)
      };
    case 4 /* Ligature */:
      return {
        type: 4 /* Ligature */,
        ...baseProps,
        subtables: parseLigatureSubst(reader, subtableOffsets)
      };
    case 5 /* Context */:
      return {
        type: 5 /* Context */,
        ...baseProps,
        subtables: parseContextSubst(reader, subtableOffsets)
      };
    case 6 /* ChainingContext */:
      return {
        type: 6 /* ChainingContext */,
        ...baseProps,
        subtables: parseChainingContextSubst(reader, subtableOffsets)
      };
    case 7 /* Extension */:
      return parseExtensionLookup2(reader, subtableOffsets, baseProps);
    case 8 /* ReverseChainingSingle */:
      return {
        type: 8 /* ReverseChainingSingle */,
        ...baseProps,
        subtables: parseReverseChainingSingleSubst(reader, subtableOffsets)
      };
    default:
      return null;
  }
}
function parseSingleSubst(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const coverageOffset = r.offset16();
      const deltaGlyphId = r.int16();
      const coverage = parseCoverageAt(r, coverageOffset);
      subtables.push({ format: 1, coverage, deltaGlyphId });
    } else if (format === 2) {
      const coverageOffset = r.offset16();
      const glyphCount = r.uint16();
      const substituteGlyphIds = Array.from(r.uint16Array(glyphCount));
      const coverage = parseCoverageAt(r, coverageOffset);
      subtables.push({ format: 2, coverage, substituteGlyphIds });
    }
  }
  return subtables;
}
function parseMultipleSubst(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const coverageOffset = r.offset16();
      const sequenceCount = r.uint16();
      const sequenceOffsets = r.uint16Array(sequenceCount);
      const coverage = parseCoverageAt(r, coverageOffset);
      const sequences = [];
      for (const seqOffset of sequenceOffsets) {
        const seqReader = r.sliceFrom(seqOffset);
        const glyphCount = seqReader.uint16();
        sequences.push(Array.from(seqReader.uint16Array(glyphCount)));
      }
      subtables.push({ coverage, sequences });
    }
  }
  return subtables;
}
function parseAlternateSubst(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const coverageOffset = r.offset16();
      const alternateSetCount = r.uint16();
      const alternateSetOffsets = r.uint16Array(alternateSetCount);
      const coverage = parseCoverageAt(r, coverageOffset);
      const alternateSets = [];
      for (const altOffset of alternateSetOffsets) {
        const altReader = r.sliceFrom(altOffset);
        const glyphCount = altReader.uint16();
        alternateSets.push(Array.from(altReader.uint16Array(glyphCount)));
      }
      subtables.push({ coverage, alternateSets });
    }
  }
  return subtables;
}
function parseLigatureSubst(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const coverageOffset = r.offset16();
      const ligatureSetCount = r.uint16();
      const ligatureSetOffsets = r.uint16Array(ligatureSetCount);
      const coverage = parseCoverageAt(r, coverageOffset);
      const ligatureSets = [];
      for (const setOffset of ligatureSetOffsets) {
        const setReader = r.sliceFrom(setOffset);
        const ligatureCount = setReader.uint16();
        const ligatureOffsets = setReader.uint16Array(ligatureCount);
        const ligatures = [];
        for (const ligOffset of ligatureOffsets) {
          const ligReader = setReader.sliceFrom(ligOffset);
          const ligatureGlyph = ligReader.uint16();
          const componentCount = ligReader.uint16();
          const componentGlyphIds = Array.from(
            ligReader.uint16Array(componentCount - 1)
          );
          ligatures.push({ ligatureGlyph, componentGlyphIds });
        }
        ligatureSets.push({ ligatures });
      }
      subtables.push({ coverage, ligatureSets });
    }
  }
  return subtables;
}
function parseReverseChainingSingleSubst(reader, subtableOffsets) {
  const subtables = [];
  for (const offset of subtableOffsets) {
    const r = reader.sliceFrom(offset);
    const format = r.uint16();
    if (format === 1) {
      const coverageOffset = r.offset16();
      const backtrackCount = r.uint16();
      const backtrackCoverageOffsets = r.uint16Array(backtrackCount);
      const lookaheadCount = r.uint16();
      const lookaheadCoverageOffsets = r.uint16Array(lookaheadCount);
      const glyphCount = r.uint16();
      const substituteGlyphIds = Array.from(r.uint16Array(glyphCount));
      const coverage = parseCoverageAt(r, coverageOffset);
      const backtrackCoverages = [];
      for (const covOffset of backtrackCoverageOffsets) {
        backtrackCoverages.push(parseCoverageAt(r, covOffset));
      }
      const lookaheadCoverages = [];
      for (const covOffset of lookaheadCoverageOffsets) {
        lookaheadCoverages.push(parseCoverageAt(r, covOffset));
      }
      subtables.push({
        coverage,
        backtrackCoverages,
        lookaheadCoverages,
        substituteGlyphIds
      });
    }
  }
  return subtables;
}
function parseExtensionLookup2(reader, subtableOffsets, baseProps) {
  if (subtableOffsets.length === 0) return null;
  const extSubtables = [];
  for (const offset of subtableOffsets) {
    const extReader = reader.sliceFrom(offset);
    const format = extReader.uint16();
    if (format !== 1) continue;
    const extensionLookupType = extReader.uint16();
    const extensionOffset = extReader.uint32();
    extSubtables.push({
      type: extensionLookupType,
      reader: extReader.sliceFrom(extensionOffset)
    });
  }
  if (extSubtables.length === 0) return null;
  const actualType = extSubtables[0]?.type;
  const _actualOffsets = extSubtables.map((_, _i) => 0);
  switch (actualType) {
    case 1 /* Single */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseSingleSubst(ext.reader, [0]));
      }
      return { type: 1 /* Single */, ...baseProps, subtables };
    }
    case 2 /* Multiple */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseMultipleSubst(ext.reader, [0]));
      }
      return { type: 2 /* Multiple */, ...baseProps, subtables };
    }
    case 3 /* Alternate */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseAlternateSubst(ext.reader, [0]));
      }
      return { type: 3 /* Alternate */, ...baseProps, subtables };
    }
    case 4 /* Ligature */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseLigatureSubst(ext.reader, [0]));
      }
      return { type: 4 /* Ligature */, ...baseProps, subtables };
    }
    case 5 /* Context */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseContextSubst(ext.reader, [0]));
      }
      return { type: 5 /* Context */, ...baseProps, subtables };
    }
    case 6 /* ChainingContext */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseChainingContextSubst(ext.reader, [0]));
      }
      return { type: 6 /* ChainingContext */, ...baseProps, subtables };
    }
    case 8 /* ReverseChainingSingle */: {
      const subtables = [];
      for (const ext of extSubtables) {
        subtables.push(...parseReverseChainingSingleSubst(ext.reader, [0]));
      }
      return {
        type: 8 /* ReverseChainingSingle */,
        ...baseProps,
        subtables
      };
    }
    default:
      return null;
  }
}
function applySingleSubst(lookup, glyphId) {
  for (const subtable of lookup.subtables) {
    const coverageIndex = subtable.coverage.get(glyphId);
    if (coverageIndex === null) continue;
    if (subtable.format === 1 && subtable.deltaGlyphId !== void 0) {
      return glyphId + subtable.deltaGlyphId & 65535;
    }
    if (subtable.format === 2 && subtable.substituteGlyphIds) {
      return subtable.substituteGlyphIds[coverageIndex] ?? null;
    }
  }
  return null;
}
function applyLigatureSubst(lookup, glyphIds, startIndex) {
  const firstGlyph = glyphIds[startIndex];
  if (firstGlyph === void 0) return null;
  for (const subtable of lookup.subtables) {
    const coverageIndex = subtable.coverage.get(firstGlyph);
    if (coverageIndex === null) continue;
    const ligatureSet = subtable.ligatureSets[coverageIndex];
    if (!ligatureSet) continue;
    for (const ligature of ligatureSet.ligatures) {
      const componentCount = ligature.componentGlyphIds.length;
      if (startIndex + 1 + componentCount > glyphIds.length) continue;
      let matches = true;
      for (let i = 0; i < componentCount; i++) {
        if (glyphIds[startIndex + 1 + i] !== ligature.componentGlyphIds[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return {
          ligatureGlyph: ligature.ligatureGlyph,
          consumed: 1 + componentCount
        };
      }
    }
  }
  return null;
}

// src/font/tables/head.ts
var HEAD_MAGIC_NUMBER = 1594834165;
function parseHead(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const fontRevision = reader.fixed();
  const checksumAdjustment = reader.uint32();
  const magicNumber = reader.uint32();
  if (magicNumber !== HEAD_MAGIC_NUMBER) {
    throw new Error(
      `Invalid head table magic number: 0x${magicNumber.toString(16)}`
    );
  }
  const flags = reader.uint16();
  const unitsPerEm = reader.uint16();
  const created = reader.longDateTime();
  const modified = reader.longDateTime();
  const xMin = reader.fword();
  const yMin = reader.fword();
  const xMax = reader.fword();
  const yMax = reader.fword();
  const macStyle = reader.uint16();
  const lowestRecPPEM = reader.uint16();
  const fontDirectionHint = reader.int16();
  const indexToLocFormat = reader.int16();
  const glyphDataFormat = reader.int16();
  return {
    majorVersion,
    minorVersion,
    fontRevision,
    checksumAdjustment,
    magicNumber,
    flags,
    unitsPerEm,
    created,
    modified,
    xMin,
    yMin,
    xMax,
    yMax,
    macStyle,
    lowestRecPPEM,
    fontDirectionHint,
    indexToLocFormat,
    glyphDataFormat
  };
}

// src/font/tables/hhea.ts
function parseHhea(reader) {
  return {
    majorVersion: reader.uint16(),
    minorVersion: reader.uint16(),
    ascender: reader.fword(),
    descender: reader.fword(),
    lineGap: reader.fword(),
    advanceWidthMax: reader.ufword(),
    minLeftSideBearing: reader.fword(),
    minRightSideBearing: reader.fword(),
    xMaxExtent: reader.fword(),
    caretSlopeRise: reader.int16(),
    caretSlopeRun: reader.int16(),
    caretOffset: reader.int16(),
    reserved1: reader.int16(),
    reserved2: reader.int16(),
    reserved3: reader.int16(),
    reserved4: reader.int16(),
    metricDataFormat: reader.int16(),
    numberOfHMetrics: reader.uint16()
  };
}

// src/font/tables/hmtx.ts
function parseHmtx(reader, numberOfHMetrics, numGlyphs) {
  const hMetrics = new Array(numberOfHMetrics);
  for (let i = 0; i < numberOfHMetrics; i++) {
    hMetrics[i] = {
      advanceWidth: reader.ufword(),
      lsb: reader.fword()
    };
  }
  const numLeftSideBearings = numGlyphs - numberOfHMetrics;
  const leftSideBearings = new Array(numLeftSideBearings);
  for (let i = 0; i < numLeftSideBearings; i++) {
    leftSideBearings[i] = reader.fword();
  }
  return { hMetrics, leftSideBearings };
}
function getAdvanceWidth(hmtx, glyphId) {
  if (glyphId < hmtx.hMetrics.length) {
    return hmtx.hMetrics[glyphId]?.advanceWidth;
  }
  return hmtx.hMetrics[hmtx.hMetrics.length - 1]?.advanceWidth;
}
function getLeftSideBearing(hmtx, glyphId) {
  if (glyphId < hmtx.hMetrics.length) {
    return hmtx.hMetrics[glyphId]?.lsb;
  }
  const idx = glyphId - hmtx.hMetrics.length;
  return hmtx.leftSideBearings[idx] ?? 0;
}

// src/font/tables/jstf.ts
function parseJstfModList(reader, offset) {
  if (offset === 0) return null;
  const modReader = reader.sliceFrom(offset);
  const lookupCount = modReader.uint16();
  const lookupIndices = [];
  for (let i = 0; i < lookupCount; i++) {
    lookupIndices.push(modReader.uint16());
  }
  return { lookupIndices };
}
function parseJstfMax(reader, offset) {
  if (offset === 0) return null;
  const maxReader = reader.sliceFrom(offset);
  const lookupCount = maxReader.uint16();
  const lookupIndices = [];
  for (let i = 0; i < lookupCount; i++) {
    lookupIndices.push(maxReader.uint16());
  }
  return { lookupIndices };
}
function parseJstfPriority(reader, offset) {
  const priReader = reader.sliceFrom(offset);
  const shrinkageEnableGsubOffset = priReader.uint16();
  const shrinkageDisableGsubOffset = priReader.uint16();
  const shrinkageEnableGposOffset = priReader.uint16();
  const shrinkageDisableGposOffset = priReader.uint16();
  const shrinkageJstfMaxOffset = priReader.uint16();
  const extensionEnableGsubOffset = priReader.uint16();
  const extensionDisableGsubOffset = priReader.uint16();
  const extensionEnableGposOffset = priReader.uint16();
  const extensionDisableGposOffset = priReader.uint16();
  const extensionJstfMaxOffset = priReader.uint16();
  return {
    shrinkageEnableGsub: parseJstfModList(
      reader,
      offset + shrinkageEnableGsubOffset
    ),
    shrinkageDisableGsub: parseJstfModList(
      reader,
      offset + shrinkageDisableGsubOffset
    ),
    shrinkageEnableGpos: parseJstfModList(
      reader,
      offset + shrinkageEnableGposOffset
    ),
    shrinkageDisableGpos: parseJstfModList(
      reader,
      offset + shrinkageDisableGposOffset
    ),
    shrinkageJstfMax: parseJstfMax(reader, offset + shrinkageJstfMaxOffset),
    extensionEnableGsub: parseJstfModList(
      reader,
      offset + extensionEnableGsubOffset
    ),
    extensionDisableGsub: parseJstfModList(
      reader,
      offset + extensionDisableGsubOffset
    ),
    extensionEnableGpos: parseJstfModList(
      reader,
      offset + extensionEnableGposOffset
    ),
    extensionDisableGpos: parseJstfModList(
      reader,
      offset + extensionDisableGposOffset
    ),
    extensionJstfMax: parseJstfMax(reader, offset + extensionJstfMaxOffset)
  };
}
function parseJstfLangSys(reader, offset) {
  const langReader = reader.sliceFrom(offset);
  const jstfPriorityCount = langReader.uint16();
  const priorityOffsets = [];
  for (let i = 0; i < jstfPriorityCount; i++) {
    priorityOffsets.push(langReader.uint16());
  }
  const priorities = [];
  for (const priOffset of priorityOffsets) {
    priorities.push(parseJstfPriority(reader, offset + priOffset));
  }
  return { priorities };
}
function parseJstfScript(reader, offset) {
  const scriptReader = reader.sliceFrom(offset);
  const extenderGlyphOffset = scriptReader.uint16();
  const defJstfLangSysOffset = scriptReader.uint16();
  const jstfLangSysCount = scriptReader.uint16();
  const langSysData = [];
  for (let i = 0; i < jstfLangSysCount; i++) {
    const tag2 = scriptReader.uint32();
    const langOffset = scriptReader.uint16();
    langSysData.push({ tag: tag2, offset: langOffset });
  }
  const extenderGlyphs = [];
  if (extenderGlyphOffset !== 0) {
    const extReader = reader.sliceFrom(offset + extenderGlyphOffset);
    const glyphCount = extReader.uint16();
    for (let i = 0; i < glyphCount; i++) {
      extenderGlyphs.push(extReader.uint16());
    }
  }
  const defaultLangSys = defJstfLangSysOffset !== 0 ? parseJstfLangSys(reader, offset + defJstfLangSysOffset) : null;
  const langSysRecords = /* @__PURE__ */ new Map();
  for (const { tag: tag2, offset: langOffset } of langSysData) {
    langSysRecords.set(tag2, parseJstfLangSys(reader, offset + langOffset));
  }
  return { extenderGlyphs, defaultLangSys, langSysRecords };
}
function parseJstf(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const jstfScriptCount = reader.uint16();
  const scriptData = [];
  for (let i = 0; i < jstfScriptCount; i++) {
    const tag2 = reader.uint32();
    const offset = reader.uint16();
    scriptData.push({ tag: tag2, offset });
  }
  const scripts = [];
  for (const { tag: tag2, offset } of scriptData) {
    const script = parseJstfScript(reader, offset);
    scripts.push({ scriptTag: tag2, ...script });
  }
  return {
    majorVersion,
    minorVersion,
    scripts
  };
}
function getExtenderGlyphs(jstf, scriptTag) {
  const script = jstf.scripts.find((s) => s.scriptTag === scriptTag);
  return script?.extenderGlyphs ?? [];
}
function getJstfPriorities(jstf, scriptTag, languageTag) {
  const script = jstf.scripts.find((s) => s.scriptTag === scriptTag);
  if (!script) return [];
  if (languageTag !== void 0) {
    const langSys = script.langSysRecords.get(languageTag);
    if (langSys) return langSys.priorities;
  }
  return script.defaultLangSys?.priorities ?? [];
}
function getShrinkageMods(priority) {
  return {
    enableGsub: priority.shrinkageEnableGsub?.lookupIndices ?? [],
    disableGsub: priority.shrinkageDisableGsub?.lookupIndices ?? [],
    enableGpos: priority.shrinkageEnableGpos?.lookupIndices ?? [],
    disableGpos: priority.shrinkageDisableGpos?.lookupIndices ?? [],
    maxLookups: priority.shrinkageJstfMax?.lookupIndices ?? []
  };
}
function getExtensionMods(priority) {
  return {
    enableGsub: priority.extensionEnableGsub?.lookupIndices ?? [],
    disableGsub: priority.extensionDisableGsub?.lookupIndices ?? [],
    enableGpos: priority.extensionEnableGpos?.lookupIndices ?? [],
    disableGpos: priority.extensionDisableGpos?.lookupIndices ?? [],
    maxLookups: priority.extensionJstfMax?.lookupIndices ?? []
  };
}

// src/font/tables/kern.ts
function parseKern(reader) {
  const version = reader.uint16();
  const subtables = [];
  if (version === 0) {
    const nTables = reader.uint16();
    for (let i = 0; i < nTables; i++) {
      const subtable = parseKernSubtable(reader);
      if (subtable) subtables.push(subtable);
    }
  } else if (version === 1) {
    reader.skip(2);
    const nTables = reader.uint32();
    for (let i = 0; i < nTables; i++) {
      const subtable = parseAppleKernSubtable(reader);
      if (subtable) subtables.push(subtable);
    }
  }
  return { version, subtables };
}
function parseKernSubtable(reader) {
  const _version = reader.uint16();
  const length = reader.uint16();
  const coverageBits = reader.uint16();
  const coverage = {
    horizontal: (coverageBits & 1) !== 0,
    minimum: (coverageBits & 2) !== 0,
    crossStream: (coverageBits & 4) !== 0,
    override: (coverageBits & 8) !== 0
  };
  const format = coverageBits >> 8 & 255;
  if (format === 0) {
    return parseKernFormat0(reader, coverage);
  } else if (format === 2) {
    return parseKernFormat2(reader, coverage, length - 6);
  }
  reader.skip(length - 6);
  return null;
}
function parseAppleKernSubtable(reader) {
  const length = reader.uint32();
  const coverageBits = reader.uint16();
  const _tupleIndex = reader.uint16();
  const coverage = {
    horizontal: (coverageBits & 32768) === 0,
    // bit 15: 0=horizontal
    minimum: false,
    crossStream: (coverageBits & 16384) !== 0,
    override: (coverageBits & 8192) !== 0
  };
  const format = coverageBits & 255;
  if (format === 0) {
    return parseKernFormat0(reader, coverage);
  } else if (format === 2) {
    return parseKernFormat2(reader, coverage, length - 8);
  }
  reader.skip(length - 8);
  return null;
}
function parseKernFormat0(reader, coverage) {
  const nPairs = reader.uint16();
  reader.skip(6);
  const pairs = /* @__PURE__ */ new Map();
  for (let i = 0; i < nPairs; i++) {
    const left = reader.uint16();
    const right = reader.uint16();
    const value = reader.int16();
    const key = left << 16 | right;
    pairs.set(key, value);
  }
  return { format: 0, coverage, pairs };
}
function parseKernFormat2(reader, coverage, dataLength) {
  const startOffset = reader.offset;
  const rowWidth = reader.uint16();
  const leftClassOffset = reader.uint16();
  const rightClassOffset = reader.uint16();
  const arrayOffset = reader.uint16();
  const leftClassTable = /* @__PURE__ */ new Map();
  reader.seek(startOffset + leftClassOffset);
  const leftFirstGlyph = reader.uint16();
  const leftNGlyphs = reader.uint16();
  for (let i = 0; i < leftNGlyphs; i++) {
    const classValue = reader.uint16();
    if (classValue !== 0) {
      leftClassTable.set(leftFirstGlyph + i, classValue);
    }
  }
  const rightClassTable = /* @__PURE__ */ new Map();
  reader.seek(startOffset + rightClassOffset);
  const rightFirstGlyph = reader.uint16();
  const rightNGlyphs = reader.uint16();
  for (let i = 0; i < rightNGlyphs; i++) {
    const classValue = reader.uint16();
    if (classValue !== 0) {
      rightClassTable.set(rightFirstGlyph + i, classValue);
    }
  }
  reader.seek(startOffset + arrayOffset);
  const numRows = rowWidth > 0 ? Math.floor(dataLength / rowWidth) : 0;
  const numCols = rowWidth / 2;
  const kerningValues = [];
  for (let row = 0; row < numRows; row++) {
    const rowValues = [];
    for (let col = 0; col < numCols; col++) {
      rowValues.push(reader.int16());
    }
    kerningValues.push(rowValues);
  }
  return {
    format: 2,
    coverage,
    rowWidth,
    leftClassTable,
    rightClassTable,
    kerningValues
  };
}
function getKernValue(kern, left, right) {
  let total = 0;
  for (const subtable of kern.subtables) {
    if (!subtable.coverage.horizontal) continue;
    if (subtable.format === 0) {
      const key = left << 16 | right;
      const value = subtable.pairs.get(key);
      if (value !== void 0) {
        if (subtable.coverage.override) {
          total = value;
        } else {
          total += value;
        }
      }
    } else if (subtable.format === 2) {
      const leftClass = subtable.leftClassTable.get(left) ?? 0;
      const rightClass = subtable.rightClassTable.get(right) ?? 0;
      if (leftClass > 0 && rightClass > 0) {
        const rowIndex = Math.floor(leftClass / 2);
        const colIndex = Math.floor(rightClass / 2);
        const row = subtable.kerningValues[rowIndex];
        if (row) {
          const value = row[colIndex];
          if (value !== void 0) {
            if (subtable.coverage.override) {
              total = value;
            } else {
              total += value;
            }
          }
        }
      }
    }
  }
  return total;
}

// src/font/tables/kerx.ts
function parseKerx(reader) {
  const version = reader.uint16();
  reader.skip(2);
  const nTables = reader.uint32();
  const subtables = [];
  for (let i = 0; i < nTables; i++) {
    const subtable = parseKerxSubtable(reader);
    if (subtable) subtables.push(subtable);
  }
  return { version, nTables, subtables };
}
function parseKerxSubtable(reader) {
  const length = reader.uint32();
  const coverageAndFormat = reader.uint32();
  const tupleCount = reader.uint16();
  reader.skip(2);
  const format = coverageAndFormat & 255;
  const coverage = {
    vertical: (coverageAndFormat & 2147483648) !== 0,
    crossStream: (coverageAndFormat & 1073741824) !== 0,
    variation: (coverageAndFormat & 536870912) !== 0
  };
  const base = { length, coverage, tupleCount };
  const subtableEnd = reader.offset + length - 12;
  let subtable = null;
  switch (format) {
    case 0 /* OrderedList */:
      subtable = parseKerxFormat0(reader, base);
      break;
    case 1 /* StateTable */:
      subtable = parseKerxFormat1(reader, base);
      break;
    case 2 /* SimpleArray */:
      subtable = parseKerxFormat2(reader, base);
      break;
    case 6 /* Format6 */:
      subtable = parseKerxFormat6(reader, base);
      break;
  }
  reader.seek(subtableEnd);
  return subtable;
}
function parseKerxFormat0(reader, base) {
  const nPairs = reader.uint32();
  reader.skip(12);
  const pairs = [];
  for (let i = 0; i < nPairs; i++) {
    pairs.push({
      left: reader.uint16(),
      right: reader.uint16(),
      value: reader.int16()
    });
    reader.skip(2);
  }
  return {
    ...base,
    format: 0 /* OrderedList */,
    nPairs,
    pairs
  };
}
function parseKerxFormat1(reader, base) {
  const stateHeader = {
    nClasses: reader.uint32(),
    classTableOffset: reader.offset32(),
    stateArrayOffset: reader.offset32(),
    entryTableOffset: reader.offset32(),
    valueTableOffset: reader.offset32()
  };
  return {
    ...base,
    format: 1 /* StateTable */,
    stateHeader
  };
}
function parseKerxFormat2(reader, base) {
  const rowWidth = reader.uint16();
  reader.skip(2);
  const leftClassTableOffset = reader.offset32();
  const rightClassTableOffset = reader.offset32();
  const kerningArrayOffset = reader.offset32();
  const leftClassTable = parseKerxClassTable(
    reader.sliceFrom(leftClassTableOffset)
  );
  const rightClassTable = parseKerxClassTable(
    reader.sliceFrom(rightClassTableOffset)
  );
  const arrayReader = reader.sliceFrom(kerningArrayOffset);
  const numRows = leftClassTable.nGlyphs > 0 ? Math.max(...Array.from(leftClassTable.classes)) + 1 : 0;
  const numCols = rowWidth / 2;
  const kerningArray = new Int16Array(numRows * numCols);
  for (const [i, _] of kerningArray.entries()) {
    kerningArray[i] = arrayReader.int16();
  }
  return {
    ...base,
    format: 2 /* SimpleArray */,
    rowWidth,
    leftClassTable,
    rightClassTable,
    kerningArray
  };
}
function parseKerxClassTable(reader) {
  const firstGlyph = reader.uint16();
  const nGlyphs = reader.uint16();
  const classes = new Uint8Array(nGlyphs);
  for (let i = 0; i < nGlyphs; i++) {
    classes[i] = reader.uint8();
  }
  return { firstGlyph, nGlyphs, classes };
}
function parseKerxFormat6(reader, base) {
  const flags = reader.uint32();
  const rowCount = reader.uint16();
  const columnCount = reader.uint16();
  const rowIndexTableOffset = reader.offset32();
  const columnIndexTableOffset = reader.offset32();
  const kerningArrayOffset = reader.offset32();
  const kerningVectorOffset = reader.offset32();
  return {
    ...base,
    format: 6 /* Format6 */,
    flags,
    rowCount,
    columnCount,
    rowIndexTableOffset,
    columnIndexTableOffset,
    kerningArrayOffset,
    kerningVectorOffset
  };
}
function getKerxValue(kerx, left, right) {
  for (const subtable of kerx.subtables) {
    if (subtable.coverage.vertical) continue;
    switch (subtable.format) {
      case 0 /* OrderedList */: {
        const pairs = subtable.pairs;
        let lo = 0;
        let hi = pairs.length - 1;
        while (lo <= hi) {
          const mid = lo + hi >> 1;
          const pair = pairs[mid];
          if (!pair) break;
          const key = pair.left << 16 | pair.right;
          const target = left << 16 | right;
          if (key === target) {
            return pair.value;
          } else if (key < target) {
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        break;
      }
      case 2 /* SimpleArray */: {
        const leftTable = subtable.leftClassTable;
        const rightTable = subtable.rightClassTable;
        if (left < leftTable.firstGlyph || left >= leftTable.firstGlyph + leftTable.nGlyphs) {
          continue;
        }
        if (right < rightTable.firstGlyph || right >= rightTable.firstGlyph + rightTable.nGlyphs) {
          continue;
        }
        const leftClass = leftTable.classes[left - leftTable.firstGlyph];
        const rightClass = rightTable.classes[right - rightTable.firstGlyph];
        if (leftClass === void 0 || rightClass === void 0) continue;
        const numCols = subtable.rowWidth / 2;
        const index = leftClass * numCols + rightClass;
        if (index < subtable.kerningArray.length) {
          const value = subtable.kerningArray[index];
          if (value !== void 0 && value !== 0) return value;
        }
        break;
      }
    }
  }
  return 0;
}

// src/font/tables/math.ts
function parseMathValueRecord(reader, tableReader) {
  const value = reader.int16();
  const deviceOffset = reader.uint16();
  return {
    value,
    device: parseDeviceAt(tableReader, deviceOffset)
  };
}
function parseMathConstants(reader) {
  const tableReader = reader;
  const scriptPercentScaleDown = reader.int16();
  const scriptScriptPercentScaleDown = reader.int16();
  const delimitedSubFormulaMinHeight = reader.uint16();
  const displayOperatorMinHeight = reader.uint16();
  return {
    scriptPercentScaleDown,
    scriptScriptPercentScaleDown,
    delimitedSubFormulaMinHeight,
    displayOperatorMinHeight,
    mathLeading: parseMathValueRecord(reader, tableReader),
    axisHeight: parseMathValueRecord(reader, tableReader),
    accentBaseHeight: parseMathValueRecord(reader, tableReader),
    flattenedAccentBaseHeight: parseMathValueRecord(reader, tableReader),
    subscriptShiftDown: parseMathValueRecord(reader, tableReader),
    subscriptTopMax: parseMathValueRecord(reader, tableReader),
    subscriptBaselineDropMin: parseMathValueRecord(reader, tableReader),
    superscriptShiftUp: parseMathValueRecord(reader, tableReader),
    superscriptShiftUpCramped: parseMathValueRecord(reader, tableReader),
    superscriptBottomMin: parseMathValueRecord(reader, tableReader),
    superscriptBaselineDropMax: parseMathValueRecord(reader, tableReader),
    subSuperscriptGapMin: parseMathValueRecord(reader, tableReader),
    superscriptBottomMaxWithSubscript: parseMathValueRecord(
      reader,
      tableReader
    ),
    spaceAfterScript: parseMathValueRecord(reader, tableReader),
    upperLimitGapMin: parseMathValueRecord(reader, tableReader),
    upperLimitBaselineRiseMin: parseMathValueRecord(reader, tableReader),
    lowerLimitGapMin: parseMathValueRecord(reader, tableReader),
    lowerLimitBaselineDropMin: parseMathValueRecord(reader, tableReader),
    stackTopShiftUp: parseMathValueRecord(reader, tableReader),
    stackTopDisplayStyleShiftUp: parseMathValueRecord(reader, tableReader),
    stackBottomShiftDown: parseMathValueRecord(reader, tableReader),
    stackBottomDisplayStyleShiftDown: parseMathValueRecord(reader, tableReader),
    stackGapMin: parseMathValueRecord(reader, tableReader),
    stackDisplayStyleGapMin: parseMathValueRecord(reader, tableReader),
    stretchStackTopShiftUp: parseMathValueRecord(reader, tableReader),
    stretchStackBottomShiftDown: parseMathValueRecord(reader, tableReader),
    stretchStackGapAboveMin: parseMathValueRecord(reader, tableReader),
    stretchStackGapBelowMin: parseMathValueRecord(reader, tableReader),
    fractionNumeratorShiftUp: parseMathValueRecord(reader, tableReader),
    fractionNumeratorDisplayStyleShiftUp: parseMathValueRecord(
      reader,
      tableReader
    ),
    fractionDenominatorShiftDown: parseMathValueRecord(reader, tableReader),
    fractionDenominatorDisplayStyleShiftDown: parseMathValueRecord(
      reader,
      tableReader
    ),
    fractionNumeratorGapMin: parseMathValueRecord(reader, tableReader),
    fractionNumDisplayStyleGapMin: parseMathValueRecord(reader, tableReader),
    fractionRuleThickness: parseMathValueRecord(reader, tableReader),
    fractionDenominatorGapMin: parseMathValueRecord(reader, tableReader),
    fractionDenomDisplayStyleGapMin: parseMathValueRecord(reader, tableReader),
    skewedFractionHorizontalGap: parseMathValueRecord(reader, tableReader),
    skewedFractionVerticalGap: parseMathValueRecord(reader, tableReader),
    overbarVerticalGap: parseMathValueRecord(reader, tableReader),
    overbarRuleThickness: parseMathValueRecord(reader, tableReader),
    overbarExtraAscender: parseMathValueRecord(reader, tableReader),
    underbarVerticalGap: parseMathValueRecord(reader, tableReader),
    underbarRuleThickness: parseMathValueRecord(reader, tableReader),
    underbarExtraDescender: parseMathValueRecord(reader, tableReader),
    radicalVerticalGap: parseMathValueRecord(reader, tableReader),
    radicalDisplayStyleVerticalGap: parseMathValueRecord(reader, tableReader),
    radicalRuleThickness: parseMathValueRecord(reader, tableReader),
    radicalExtraAscender: parseMathValueRecord(reader, tableReader),
    radicalKernBeforeDegree: parseMathValueRecord(reader, tableReader),
    radicalKernAfterDegree: parseMathValueRecord(reader, tableReader),
    radicalDegreeBottomRaisePercent: reader.int16()
  };
}
function parseMathItalicsCorrection(reader) {
  const coverageOffset = reader.uint16();
  const count = reader.uint16();
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push(parseMathValueRecord(reader, reader));
  }
  const coverage = parseCoverageAt(reader, coverageOffset);
  return { coverage, values };
}
function parseMathTopAccentAttachment(reader) {
  const coverageOffset = reader.uint16();
  const count = reader.uint16();
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push(parseMathValueRecord(reader, reader));
  }
  const coverage = parseCoverageAt(reader, coverageOffset);
  return { coverage, values };
}
function parseMathKernRecord(reader, offset) {
  const kernReader = reader.sliceFrom(offset);
  const heightCount = kernReader.uint16();
  const correctionHeights = [];
  for (let i = 0; i < heightCount; i++) {
    correctionHeights.push(parseMathValueRecord(kernReader, kernReader));
  }
  const kernValues = [];
  for (let i = 0; i < heightCount + 1; i++) {
    kernValues.push(parseMathValueRecord(kernReader, kernReader));
  }
  return { correctionHeights, kernValues };
}
function parseMathKernInfoTable(reader) {
  const coverageOffset = reader.uint16();
  const count = reader.uint16();
  const kernInfoRecords = [];
  for (let i = 0; i < count; i++) {
    kernInfoRecords.push({
      topRightOffset: reader.uint16(),
      topLeftOffset: reader.uint16(),
      bottomRightOffset: reader.uint16(),
      bottomLeftOffset: reader.uint16()
    });
  }
  const coverage = parseCoverageAt(reader, coverageOffset);
  const kernInfo = kernInfoRecords.map((record) => ({
    topRight: record.topRightOffset !== 0 ? parseMathKernRecord(reader, record.topRightOffset) : null,
    topLeft: record.topLeftOffset !== 0 ? parseMathKernRecord(reader, record.topLeftOffset) : null,
    bottomRight: record.bottomRightOffset !== 0 ? parseMathKernRecord(reader, record.bottomRightOffset) : null,
    bottomLeft: record.bottomLeftOffset !== 0 ? parseMathKernRecord(reader, record.bottomLeftOffset) : null
  }));
  return { coverage, kernInfo };
}
function parseMathGlyphInfo(reader) {
  const italicsCorrectionOffset = reader.uint16();
  const topAccentAttachmentOffset = reader.uint16();
  const extendedShapeCoverageOffset = reader.uint16();
  const kernInfoOffset = reader.uint16();
  let italicsCorrection = null;
  if (italicsCorrectionOffset !== 0) {
    italicsCorrection = parseMathItalicsCorrection(
      reader.sliceFrom(italicsCorrectionOffset)
    );
  }
  let topAccentAttachment = null;
  if (topAccentAttachmentOffset !== 0) {
    topAccentAttachment = parseMathTopAccentAttachment(
      reader.sliceFrom(topAccentAttachmentOffset)
    );
  }
  let extendedShapeCoverage = null;
  if (extendedShapeCoverageOffset !== 0) {
    const coverage = parseCoverageAt(reader, extendedShapeCoverageOffset);
    extendedShapeCoverage = { coverage };
  }
  let kernInfo = null;
  if (kernInfoOffset !== 0) {
    kernInfo = parseMathKernInfoTable(reader.sliceFrom(kernInfoOffset));
  }
  return {
    italicsCorrection,
    topAccentAttachment,
    extendedShapeCoverage,
    kernInfo
  };
}
function parseGlyphAssembly(reader) {
  const italicsCorrection = parseMathValueRecord(reader, reader);
  const partCount = reader.uint16();
  const parts = [];
  for (let i = 0; i < partCount; i++) {
    parts.push({
      glyphId: reader.uint16(),
      startConnectorLength: reader.uint16(),
      endConnectorLength: reader.uint16(),
      fullAdvance: reader.uint16(),
      partFlags: reader.uint16()
    });
  }
  return { italicsCorrection, parts };
}
function parseMathGlyphConstruction(reader) {
  const glyphAssemblyOffset = reader.uint16();
  const variantCount = reader.uint16();
  const variants = [];
  for (let i = 0; i < variantCount; i++) {
    variants.push({
      variantGlyph: reader.uint16(),
      advanceMeasurement: reader.uint16()
    });
  }
  let glyphAssembly = null;
  if (glyphAssemblyOffset !== 0) {
    glyphAssembly = parseGlyphAssembly(reader.sliceFrom(glyphAssemblyOffset));
  }
  return { glyphAssembly, variants };
}
function parseMathVariants(reader) {
  const minConnectorOverlap = reader.uint16();
  const vertGlyphCoverageOffset = reader.uint16();
  const horizGlyphCoverageOffset = reader.uint16();
  const vertGlyphCount = reader.uint16();
  const horizGlyphCount = reader.uint16();
  const vertGlyphConstructionOffsets = [];
  for (let i = 0; i < vertGlyphCount; i++) {
    vertGlyphConstructionOffsets.push(reader.uint16());
  }
  const horizGlyphConstructionOffsets = [];
  for (let i = 0; i < horizGlyphCount; i++) {
    horizGlyphConstructionOffsets.push(reader.uint16());
  }
  const vertGlyphCoverage = vertGlyphCoverageOffset !== 0 ? parseCoverageAt(reader, vertGlyphCoverageOffset) : null;
  const horizGlyphCoverage = horizGlyphCoverageOffset !== 0 ? parseCoverageAt(reader, horizGlyphCoverageOffset) : null;
  const vertGlyphConstruction = vertGlyphConstructionOffsets.map(
    (offset) => parseMathGlyphConstruction(reader.sliceFrom(offset))
  );
  const horizGlyphConstruction = horizGlyphConstructionOffsets.map(
    (offset) => parseMathGlyphConstruction(reader.sliceFrom(offset))
  );
  return {
    minConnectorOverlap,
    vertGlyphCoverage,
    horizGlyphCoverage,
    vertGlyphConstruction,
    horizGlyphConstruction
  };
}
function parseMath(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const mathConstantsOffset = reader.uint16();
  const mathGlyphInfoOffset = reader.uint16();
  const mathVariantsOffset = reader.uint16();
  let constants = null;
  if (mathConstantsOffset !== 0) {
    constants = parseMathConstants(reader.sliceFrom(mathConstantsOffset));
  }
  let glyphInfo = null;
  if (mathGlyphInfoOffset !== 0) {
    glyphInfo = parseMathGlyphInfo(reader.sliceFrom(mathGlyphInfoOffset));
  }
  let variants = null;
  if (mathVariantsOffset !== 0) {
    variants = parseMathVariants(reader.sliceFrom(mathVariantsOffset));
  }
  return {
    majorVersion,
    minorVersion,
    constants,
    glyphInfo,
    variants
  };
}

// src/font/tables/maxp.ts
function parseMaxp(reader) {
  const version = reader.uint32();
  const numGlyphs = reader.uint16();
  if (version === 20480) {
    return { version, numGlyphs };
  }
  if (version === 65536) {
    return {
      version,
      numGlyphs,
      maxPoints: reader.uint16(),
      maxContours: reader.uint16(),
      maxCompositePoints: reader.uint16(),
      maxCompositeContours: reader.uint16(),
      maxZones: reader.uint16(),
      maxTwilightPoints: reader.uint16(),
      maxStorage: reader.uint16(),
      maxFunctionDefs: reader.uint16(),
      maxInstructionDefs: reader.uint16(),
      maxStackElements: reader.uint16(),
      maxSizeOfInstructions: reader.uint16(),
      maxComponentElements: reader.uint16(),
      maxComponentDepth: reader.uint16()
    };
  }
  throw new Error(`Unknown maxp version: 0x${version.toString(16)}`);
}

// src/font/tables/morx.ts
var MorxSubtableType = /* @__PURE__ */ ((MorxSubtableType2) => {
  MorxSubtableType2[MorxSubtableType2["Rearrangement"] = 0] = "Rearrangement";
  MorxSubtableType2[MorxSubtableType2["Contextual"] = 1] = "Contextual";
  MorxSubtableType2[MorxSubtableType2["Ligature"] = 2] = "Ligature";
  MorxSubtableType2[MorxSubtableType2["NonContextual"] = 4] = "NonContextual";
  MorxSubtableType2[MorxSubtableType2["Insertion"] = 5] = "Insertion";
  return MorxSubtableType2;
})(MorxSubtableType || {});
function parseMorx(reader) {
  const version = reader.uint16();
  reader.skip(2);
  if (version < 2) {
    return { version, chains: [] };
  }
  const nChains = reader.uint32();
  const chains = [];
  for (let i = 0; i < nChains; i++) {
    const chain = parseMorxChain(reader);
    chains.push(chain);
  }
  return { version, chains };
}
function parseMorxChain(reader) {
  const defaultFlags = reader.uint32();
  const _chainLength = reader.uint32();
  const nFeatureEntries = reader.uint32();
  const nSubtables = reader.uint32();
  const features2 = [];
  for (let i = 0; i < nFeatureEntries; i++) {
    features2.push({
      featureType: reader.uint16(),
      featureSetting: reader.uint16(),
      enableFlags: reader.uint32(),
      disableFlags: reader.uint32()
    });
  }
  const subtables = [];
  for (let i = 0; i < nSubtables; i++) {
    const subtable = parseMorxSubtable(reader);
    if (subtable) subtables.push(subtable);
  }
  return { defaultFlags, features: features2, subtables };
}
function parseMorxSubtable(reader) {
  const length = reader.uint32();
  const coverageBits = reader.uint32();
  const subFeatureFlags = reader.uint32();
  const type = coverageBits & 255;
  const coverage = {
    vertical: (coverageBits & 2147483648) !== 0,
    descending: (coverageBits & 1073741824) !== 0,
    logical: (coverageBits & 268435456) !== 0
  };
  const subtableStart = reader.offset;
  const subtableEnd = subtableStart + length - 12;
  let subtable = null;
  switch (type) {
    case 0 /* Rearrangement */:
      subtable = parseRearrangementSubtable(reader, coverage, subFeatureFlags);
      break;
    case 1 /* Contextual */:
      subtable = parseContextualSubtable(reader, coverage, subFeatureFlags);
      break;
    case 2 /* Ligature */:
      subtable = parseLigatureSubtable(reader, coverage, subFeatureFlags);
      break;
    case 4 /* NonContextual */:
      subtable = parseNonContextualSubtable(reader, coverage, subFeatureFlags);
      break;
    case 5 /* Insertion */:
      subtable = parseInsertionSubtable(reader, coverage, subFeatureFlags);
      break;
  }
  reader.seek(subtableEnd);
  return subtable;
}
function parseNonContextualSubtable(reader, coverage, subFeatureFlags) {
  const lookupTable = parseLookupTable(reader);
  return {
    type: 4 /* NonContextual */,
    coverage,
    subFeatureFlags,
    lookupTable
  };
}
function parseContextualSubtable(reader, coverage, subFeatureFlags) {
  const stateTableOffset = reader.offset;
  const nClasses = reader.uint32();
  const classTableOffset = reader.offset32();
  const _stateArrayOffset = reader.offset32();
  const _entryTableOffset = reader.offset32();
  const _substitutionTableOffset = reader.offset32();
  const classTable = parseClassTable(
    reader.sliceFrom(stateTableOffset + classTableOffset)
  );
  const stateTable = {
    nClasses,
    classTable,
    stateArray: []
  };
  const substitutionTable = [];
  return {
    type: 1 /* Contextual */,
    coverage,
    subFeatureFlags,
    stateTable,
    substitutionTable
  };
}
function parseLigatureSubtable(reader, coverage, subFeatureFlags) {
  const stateTableOffset = reader.offset;
  const nClasses = reader.uint32();
  const classTableOffset = reader.offset32();
  const _stateArrayOffset = reader.offset32();
  const _entryTableOffset = reader.offset32();
  const _ligatureActionsOffset = reader.offset32();
  const _componentsOffset = reader.offset32();
  const _ligaturesOffset = reader.offset32();
  const classTable = parseClassTable(
    reader.sliceFrom(stateTableOffset + classTableOffset)
  );
  const stateTable = {
    nClasses,
    classTable,
    stateArray: []
  };
  return {
    type: 2 /* Ligature */,
    coverage,
    subFeatureFlags,
    stateTable,
    ligatureActions: [],
    components: [],
    ligatures: []
  };
}
function parseRearrangementSubtable(reader, coverage, subFeatureFlags) {
  const stateTableOffset = reader.offset;
  const nClasses = reader.uint32();
  const classTableOffset = reader.offset32();
  const stateArrayOffset = reader.offset32();
  const entryTableOffset = reader.offset32();
  const classTable = parseClassTable(
    reader.sliceFrom(stateTableOffset + classTableOffset)
  );
  const stateArrayReader = reader.sliceFrom(
    stateTableOffset + stateArrayOffset
  );
  const entryReader = reader.sliceFrom(stateTableOffset + entryTableOffset);
  const entries = [];
  const entryCount = 256;
  for (let i = 0; i < entryCount; i++) {
    entries.push({
      newState: entryReader.uint16(),
      flags: entryReader.uint16()
    });
  }
  const stateArray = [];
  const stateCount = Math.min(
    256,
    Math.ceil((entryTableOffset - stateArrayOffset) / (nClasses * 2))
  );
  for (let s = 0; s < stateCount; s++) {
    const row = [];
    for (let c = 0; c < nClasses; c++) {
      const entryIndex = stateArrayReader.uint16();
      row.push(entries[entryIndex] ?? { newState: 0, flags: 0 });
    }
    stateArray.push(row);
  }
  return {
    type: 0 /* Rearrangement */,
    coverage,
    subFeatureFlags,
    stateTable: {
      nClasses,
      classTable,
      stateArray
    }
  };
}
function parseInsertionSubtable(reader, coverage, subFeatureFlags) {
  const stateTableOffset = reader.offset;
  const nClasses = reader.uint32();
  const classTableOffset = reader.offset32();
  const stateArrayOffset = reader.offset32();
  const entryTableOffset = reader.offset32();
  const insertionActionOffset = reader.offset32();
  const classTable = parseClassTable(
    reader.sliceFrom(stateTableOffset + classTableOffset)
  );
  const insertionReader = reader.sliceFrom(
    stateTableOffset + insertionActionOffset
  );
  const insertionGlyphs = [];
  const maxInsertionGlyphs = 1024;
  for (let i = 0; i < maxInsertionGlyphs; i++) {
    try {
      insertionGlyphs.push(insertionReader.uint16());
    } catch {
      break;
    }
  }
  const entryReader = reader.sliceFrom(stateTableOffset + entryTableOffset);
  const entries = [];
  const entryCount = 256;
  for (let i = 0; i < entryCount; i++) {
    entries.push({
      newState: entryReader.uint16(),
      flags: entryReader.uint16(),
      currentInsertIndex: entryReader.uint16(),
      markedInsertIndex: entryReader.uint16()
    });
  }
  const stateArrayReader = reader.sliceFrom(
    stateTableOffset + stateArrayOffset
  );
  const stateArray = [];
  const stateCount = Math.min(
    256,
    Math.ceil((entryTableOffset - stateArrayOffset) / (nClasses * 2))
  );
  for (let s = 0; s < stateCount; s++) {
    const row = [];
    for (let c = 0; c < nClasses; c++) {
      const entryIndex = stateArrayReader.uint16();
      row.push(
        entries[entryIndex] ?? {
          newState: 0,
          flags: 0,
          currentInsertIndex: 65535,
          markedInsertIndex: 65535
        }
      );
    }
    stateArray.push(row);
  }
  return {
    type: 5 /* Insertion */,
    coverage,
    subFeatureFlags,
    stateTable: {
      nClasses,
      classTable,
      stateArray
    },
    insertionGlyphs
  };
}
function parseLookupTable(reader) {
  const format = reader.uint16();
  const mapping = /* @__PURE__ */ new Map();
  switch (format) {
    case 0: {
      break;
    }
    case 2: {
      const _unitSize = reader.uint16();
      const nUnits = reader.uint16();
      reader.skip(6);
      for (let i = 0; i < nUnits; i++) {
        const lastGlyph = reader.uint16();
        const firstGlyph = reader.uint16();
        const value = reader.uint16();
        for (let g = firstGlyph; g <= lastGlyph; g++) {
          mapping.set(g, value);
        }
      }
      break;
    }
    case 4: {
      const _unitSize = reader.uint16();
      const nUnits = reader.uint16();
      reader.skip(6);
      for (let i = 0; i < nUnits; i++) {
        const _lastGlyph = reader.uint16();
        const _firstGlyph = reader.uint16();
        const _valueOffset = reader.uint16();
      }
      break;
    }
    case 6: {
      const _unitSize = reader.uint16();
      const nUnits = reader.uint16();
      reader.skip(6);
      for (let i = 0; i < nUnits; i++) {
        const glyph = reader.uint16();
        const value = reader.uint16();
        mapping.set(glyph, value);
      }
      break;
    }
    case 8: {
      const firstGlyph = reader.uint16();
      const glyphCount = reader.uint16();
      for (let i = 0; i < glyphCount; i++) {
        const value = reader.uint16();
        if (value !== 0) {
          mapping.set(firstGlyph + i, value);
        }
      }
      break;
    }
  }
  return { format, mapping };
}
function parseClassTable(reader) {
  const format = reader.uint16();
  const classArray = [];
  if (format === 2) {
    const _unitSize = reader.uint16();
    const nUnits = reader.uint16();
    reader.skip(6);
    const segments = [];
    for (let i = 0; i < nUnits; i++) {
      segments.push({
        last: reader.uint16(),
        first: reader.uint16(),
        classValue: reader.uint16()
      });
    }
    const maxGlyph = Math.max(...segments.map((s) => s.last), 0);
    for (let g = 0; g <= maxGlyph; g++) {
      const seg = segments.find((s) => g >= s.first && g <= s.last);
      classArray[g] = seg?.classValue ?? 1;
    }
  }
  return { format, classArray };
}
function applyNonContextual(subtable, glyphId) {
  return subtable.lookupTable.mapping.get(glyphId) ?? null;
}

// src/font/tables/mvar.ts
var MvarTags = {
  // Horizontal metrics
  hasc: tag("hasc"),
  // horizontal ascender
  hdsc: tag("hdsc"),
  // horizontal descender
  hlgp: tag("hlgp"),
  // horizontal line gap
  hcla: tag("hcla"),
  // horizontal clipping ascent
  hcld: tag("hcld"),
  // horizontal clipping descent
  hcof: tag("hcof"),
  // horizontal caret offset
  hcrn: tag("hcrn"),
  // horizontal caret run
  hcrs: tag("hcrs"),
  // horizontal caret rise
  // Vertical metrics
  vasc: tag("vasc"),
  // vertical ascender
  vdsc: tag("vdsc"),
  // vertical descender
  vlgp: tag("vlgp"),
  // vertical line gap
  vcof: tag("vcof"),
  // vertical caret offset
  vcrn: tag("vcrn"),
  // vertical caret run
  vcrs: tag("vcrs"),
  // vertical caret rise
  // OS/2 table values
  xhgt: tag("xhgt"),
  // x height
  cpht: tag("cpht"),
  // cap height
  sbxs: tag("sbxs"),
  // subscript x size
  sbys: tag("sbys"),
  // subscript y size
  sbxo: tag("sbxo"),
  // subscript x offset
  sbyo: tag("sbyo"),
  // subscript y offset
  spxs: tag("spxs"),
  // superscript x size
  spys: tag("spys"),
  // superscript y size
  spxo: tag("spxo"),
  // superscript x offset
  spyo: tag("spyo"),
  // superscript y offset
  strs: tag("strs"),
  // strikeout size
  stro: tag("stro"),
  // strikeout offset
  undo: tag("undo"),
  // underline offset
  unds: tag("unds"),
  // underline size
  // Glyph bounds
  gsp0: tag("gsp0"),
  // glyph bounding box x min
  gsp1: tag("gsp1"),
  // glyph bounding box y min
  gsp2: tag("gsp2"),
  // glyph bounding box x max
  gsp3: tag("gsp3")
  // glyph bounding box y max
};
function parseMvar(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  reader.uint16();
  const valueRecordSize = reader.uint16();
  const valueRecordCount = reader.uint16();
  const itemVariationStoreOffset = reader.offset16();
  const valueRecords = [];
  for (let i = 0; i < valueRecordCount; i++) {
    valueRecords.push({
      valueTag: reader.tag(),
      deltaSetOuterIndex: reader.uint16(),
      deltaSetInnerIndex: reader.uint16()
    });
    if (valueRecordSize > 8) {
      reader.skip(valueRecordSize - 8);
    }
  }
  const itemVariationStore = parseItemVariationStore4(
    reader.sliceFrom(itemVariationStoreOffset)
  );
  return {
    majorVersion,
    minorVersion,
    itemVariationStore,
    valueRecords
  };
}
function parseItemVariationStore4(reader) {
  const format = reader.uint16();
  const variationRegionListOffset = reader.offset32();
  const itemVariationDataCount = reader.uint16();
  const itemVariationDataOffsets = [];
  for (let i = 0; i < itemVariationDataCount; i++) {
    itemVariationDataOffsets.push(reader.offset32());
  }
  const regionReader = reader.sliceFrom(variationRegionListOffset);
  const axisCount = regionReader.uint16();
  const regionCount = regionReader.uint16();
  const variationRegions = [];
  for (let i = 0; i < regionCount; i++) {
    const regionAxes = [];
    for (let j = 0; j < axisCount; j++) {
      regionAxes.push({
        startCoord: regionReader.f2dot14(),
        peakCoord: regionReader.f2dot14(),
        endCoord: regionReader.f2dot14()
      });
    }
    variationRegions.push({ regionAxes });
  }
  const itemVariationData = [];
  for (const offset of itemVariationDataOffsets) {
    const dataReader = reader.sliceFrom(offset);
    const itemCount = dataReader.uint16();
    const wordDeltaCount = dataReader.uint16();
    const regionIndexCount = dataReader.uint16();
    const regionIndexes = [];
    for (let i = 0; i < regionIndexCount; i++) {
      regionIndexes.push(dataReader.uint16());
    }
    const longWords = (wordDeltaCount & 32768) !== 0;
    const wordCount = wordDeltaCount & 32767;
    const shortCount = regionIndexCount - wordCount;
    const deltaSets = [];
    for (let i = 0; i < itemCount; i++) {
      const deltas = [];
      for (let j = 0; j < wordCount; j++) {
        if (longWords) {
          deltas.push(dataReader.int32());
        } else {
          deltas.push(dataReader.int16());
        }
      }
      for (let j = 0; j < shortCount; j++) {
        if (longWords) {
          deltas.push(dataReader.int16());
        } else {
          deltas.push(dataReader.int8());
        }
      }
      deltaSets.push(deltas);
    }
    itemVariationData.push({ itemCount, regionIndexes, deltaSets });
  }
  return { format, variationRegions, itemVariationData };
}
function getMetricDelta(mvar, valueTag, coords) {
  const record = mvar.valueRecords.find((r) => r.valueTag === valueTag);
  if (!record) return 0;
  const outer = record.deltaSetOuterIndex;
  const inner = record.deltaSetInnerIndex;
  const varData = mvar.itemVariationStore.itemVariationData[outer];
  if (!varData || inner >= varData.itemCount) {
    return 0;
  }
  const deltaSet = varData.deltaSets[inner];
  if (!deltaSet) {
    return 0;
  }
  let delta = 0;
  for (const [i, regionIndex] of varData.regionIndexes.entries()) {
    const region = mvar.itemVariationStore.variationRegions[regionIndex];
    if (!region) continue;
    const scalar = calculateRegionScalar(region, coords);
    const regionDelta = deltaSet[i] ?? 0;
    delta += scalar * regionDelta;
  }
  return Math.round(delta);
}
function getHAscenderDelta(mvar, coords) {
  return getMetricDelta(mvar, MvarTags.hasc, coords);
}
function getHDescenderDelta(mvar, coords) {
  return getMetricDelta(mvar, MvarTags.hdsc, coords);
}
function getXHeightDelta(mvar, coords) {
  return getMetricDelta(mvar, MvarTags.xhgt, coords);
}
function getCapHeightDelta(mvar, coords) {
  return getMetricDelta(mvar, MvarTags.cpht, coords);
}

// src/font/tables/name.ts
var PlatformId = {
  Unicode: 0,
  Macintosh: 1,
  Reserved: 2,
  Windows: 3
};
function parseName(reader) {
  const format = reader.uint16();
  const count = reader.uint16();
  const stringOffset = reader.uint16();
  const records = [];
  const recordData = [];
  for (let i = 0; i < count; i++) {
    recordData.push({
      platformId: reader.uint16(),
      encodingId: reader.uint16(),
      languageId: reader.uint16(),
      nameId: reader.uint16(),
      length: reader.uint16(),
      offset: reader.uint16()
    });
  }
  for (const rd of recordData) {
    const strReader = reader.sliceFrom(stringOffset + rd.offset);
    const value = decodeNameString(
      strReader,
      rd.length,
      rd.platformId,
      rd.encodingId
    );
    if (value !== null) {
      records.push({
        platformId: rd.platformId,
        encodingId: rd.encodingId,
        languageId: rd.languageId,
        nameId: rd.nameId,
        value
      });
    }
  }
  return { format, records };
}
function decodeNameString(reader, length, platformId, encodingId) {
  if (platformId === PlatformId.Unicode || platformId === PlatformId.Windows && (encodingId === 1 || encodingId === 10)) {
    const chars = [];
    for (let i = 0; i < length; i += 2) {
      const code = reader.uint16();
      chars.push(String.fromCharCode(code));
    }
    return chars.join("");
  }
  if (platformId === PlatformId.Macintosh && encodingId === 0) {
    const bytes = [];
    for (let i = 0; i < length; i++) {
      bytes.push(reader.uint8());
    }
    return String.fromCharCode(...bytes);
  }
  return null;
}

// src/font/tables/os2.ts
function parseOs2(reader) {
  const version = reader.uint16();
  const xAvgCharWidth = reader.int16();
  const usWeightClass = reader.uint16();
  const usWidthClass = reader.uint16();
  const fsType = reader.uint16();
  const ySubscriptXSize = reader.int16();
  const ySubscriptYSize = reader.int16();
  const ySubscriptXOffset = reader.int16();
  const ySubscriptYOffset = reader.int16();
  const ySuperscriptXSize = reader.int16();
  const ySuperscriptYSize = reader.int16();
  const ySuperscriptXOffset = reader.int16();
  const ySuperscriptYOffset = reader.int16();
  const yStrikeoutSize = reader.int16();
  const yStrikeoutPosition = reader.int16();
  const sFamilyClass = reader.int16();
  const panose = [];
  for (let i = 0; i < 10; i++) {
    panose.push(reader.uint8());
  }
  const ulUnicodeRange1 = reader.uint32();
  const ulUnicodeRange2 = reader.uint32();
  const ulUnicodeRange3 = reader.uint32();
  const ulUnicodeRange4 = reader.uint32();
  const achVendID = String.fromCharCode(
    reader.uint8(),
    reader.uint8(),
    reader.uint8(),
    reader.uint8()
  );
  const fsSelection = reader.uint16();
  const usFirstCharIndex = reader.uint16();
  const usLastCharIndex = reader.uint16();
  const sTypoAscender = reader.int16();
  const sTypoDescender = reader.int16();
  const sTypoLineGap = reader.int16();
  const usWinAscent = reader.uint16();
  const usWinDescent = reader.uint16();
  const result = {
    version,
    xAvgCharWidth,
    usWeightClass,
    usWidthClass,
    fsType,
    ySubscriptXSize,
    ySubscriptYSize,
    ySubscriptXOffset,
    ySubscriptYOffset,
    ySuperscriptXSize,
    ySuperscriptYSize,
    ySuperscriptXOffset,
    ySuperscriptYOffset,
    yStrikeoutSize,
    yStrikeoutPosition,
    sFamilyClass,
    panose,
    ulUnicodeRange1,
    ulUnicodeRange2,
    ulUnicodeRange3,
    ulUnicodeRange4,
    achVendID,
    fsSelection,
    usFirstCharIndex,
    usLastCharIndex,
    sTypoAscender,
    sTypoDescender,
    sTypoLineGap,
    usWinAscent,
    usWinDescent
  };
  if (version >= 1) {
    result.ulCodePageRange1 = reader.uint32();
    result.ulCodePageRange2 = reader.uint32();
  }
  if (version >= 2) {
    result.sxHeight = reader.int16();
    result.sCapHeight = reader.int16();
    result.usDefaultChar = reader.uint16();
    result.usBreakChar = reader.uint16();
    result.usMaxContext = reader.uint16();
  }
  if (version >= 5) {
    result.usLowerOpticalPointSize = reader.uint16();
    result.usUpperOpticalPointSize = reader.uint16();
  }
  return result;
}

// src/font/tables/post.ts
function parsePost(reader) {
  const versionMajor = reader.uint16();
  const versionMinor = reader.uint16();
  const version = versionMajor + versionMinor / 65536;
  const italicAngle = reader.fixed();
  const underlinePosition = reader.int16();
  const underlineThickness = reader.int16();
  const isFixedPitch = reader.uint32();
  const minMemType42 = reader.uint32();
  const maxMemType42 = reader.uint32();
  const minMemType1 = reader.uint32();
  const maxMemType1 = reader.uint32();
  const result = {
    version,
    italicAngle,
    underlinePosition,
    underlineThickness,
    isFixedPitch,
    minMemType42,
    maxMemType42,
    minMemType1,
    maxMemType1
  };
  if (version === 2) {
    const numberOfGlyphs = reader.uint16();
    const glyphNameIndex = [];
    for (let i = 0; i < numberOfGlyphs; i++) {
      glyphNameIndex.push(reader.uint16());
    }
    const customNames = [];
    let maxIndex = 0;
    for (const idx of glyphNameIndex) {
      if (idx >= 258 && idx > maxIndex) {
        maxIndex = idx;
      }
    }
    const numCustomNames = maxIndex >= 258 ? maxIndex - 257 : 0;
    for (let i = 0; i < numCustomNames; i++) {
      const length = reader.uint8();
      const chars = [];
      for (let j = 0; j < length; j++) {
        chars.push(String.fromCharCode(reader.uint8()));
      }
      customNames.push(chars.join(""));
    }
    result.numberOfGlyphs = numberOfGlyphs;
    result.glyphNameIndex = glyphNameIndex;
    result.names = customNames;
  }
  return result;
}

// src/font/tables/sbix.ts
var SbixGraphicType = {
  PNG: "png ",
  JPG: "jpg ",
  TIFF: "tiff",
  PDF: "pdf ",
  MASK: "mask",
  // Mask for another glyph
  DUPE: "dupe"
  // Duplicate of another glyph (data is glyph ID)
};
function parseSbix(reader, numGlyphs) {
  const tableStart = reader.offset;
  const version = reader.uint16();
  const flags = reader.uint16();
  const numStrikes = reader.uint32();
  const strikeOffsets = [];
  for (let i = 0; i < numStrikes; i++) {
    strikeOffsets.push(reader.uint32());
  }
  const strikes = [];
  for (const strikeOffset of strikeOffsets) {
    const strike = parseStrike(reader, tableStart + strikeOffset, numGlyphs);
    strikes.push(strike);
  }
  return { version, flags, strikes };
}
function parseStrike(reader, strikeOffset, numGlyphs) {
  const strikeReader = reader.sliceFrom(strikeOffset);
  const ppem = strikeReader.uint16();
  const ppi = strikeReader.uint16();
  const glyphDataOffsets = [];
  for (let i = 0; i <= numGlyphs; i++) {
    glyphDataOffsets.push(strikeReader.uint32());
  }
  const glyphData = /* @__PURE__ */ new Map();
  for (let glyphId = 0; glyphId < numGlyphs; glyphId++) {
    const offset = glyphDataOffsets[glyphId];
    const nextOffset = glyphDataOffsets[glyphId + 1];
    const dataLength = nextOffset - offset;
    if (dataLength <= 8) {
      continue;
    }
    const glyphReader = reader.sliceFrom(strikeOffset + offset);
    const originOffsetX = glyphReader.int16();
    const originOffsetY = glyphReader.int16();
    const graphicType = glyphReader.tagString();
    const imageDataLength = dataLength - 8;
    const data = glyphReader.bytes(imageDataLength);
    glyphData.set(glyphId, {
      originOffsetX,
      originOffsetY,
      graphicType,
      data
    });
  }
  return { ppem, ppi, glyphData };
}
function getGlyphBitmap(sbix, glyphId, ppem) {
  let bestStrike = null;
  let bestDiff = Infinity;
  for (const strike of sbix.strikes) {
    const diff = Math.abs(strike.ppem - ppem);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestStrike = strike;
    }
  }
  if (!bestStrike) return null;
  return bestStrike.glyphData.get(glyphId) ?? null;
}
function getStrikeForPpem(sbix, ppem) {
  return sbix.strikes.find((s) => s.ppem === ppem) ?? null;
}
function getAvailablePpemSizes(sbix) {
  return sbix.strikes.map((s) => s.ppem).sort((a, b) => a - b);
}
function hasGlyphBitmap(sbix, glyphId, ppem) {
  if (ppem !== void 0) {
    const strike = getStrikeForPpem(sbix, ppem);
    return strike?.glyphData.has(glyphId) ?? false;
  }
  for (const strike of sbix.strikes) {
    if (strike.glyphData.has(glyphId)) {
      return true;
    }
  }
  return false;
}
function resolveDupeGlyph(sbix, strike, glyph) {
  if (glyph.graphicType !== SbixGraphicType.DUPE) {
    return glyph;
  }
  if (glyph.data.length < 2) return null;
  const dupeGlyphId = glyph.data[0] << 8 | glyph.data[1];
  const resolved = strike.glyphData.get(dupeGlyphId);
  if (!resolved) return null;
  if (resolved.graphicType === SbixGraphicType.DUPE) {
    return resolveDupeGlyph(sbix, strike, resolved);
  }
  return resolved;
}

// src/font/tables/sfnt.ts
var SFNT_VERSION_TRUETYPE = 65536;
var SFNT_VERSION_OPENTYPE = 1330926671;
var SFNT_VERSION_TRUE = 1953658213;
function parseFontDirectory(reader) {
  const sfntVersion = reader.uint32();
  if (sfntVersion !== SFNT_VERSION_TRUETYPE && sfntVersion !== SFNT_VERSION_OPENTYPE && sfntVersion !== SFNT_VERSION_TRUE) {
    throw new Error(
      `Invalid sfnt version: 0x${sfntVersion.toString(16).padStart(8, "0")}`
    );
  }
  const numTables = reader.uint16();
  const searchRange = reader.uint16();
  const entrySelector = reader.uint16();
  const rangeShift = reader.uint16();
  const tables = /* @__PURE__ */ new Map();
  for (let i = 0; i < numTables; i++) {
    const tag2 = reader.tag();
    const checksum = reader.uint32();
    const offset = reader.uint32();
    const length = reader.uint32();
    tables.set(tag2, { tag: tag2, checksum, offset, length });
  }
  return {
    sfntVersion,
    numTables,
    searchRange,
    entrySelector,
    rangeShift,
    tables
  };
}
function isTrueType(directory) {
  return directory.sfntVersion === SFNT_VERSION_TRUETYPE || directory.sfntVersion === SFNT_VERSION_TRUE;
}

// src/font/tables/feat.ts
var FeatureType = /* @__PURE__ */ ((FeatureType2) => {
  FeatureType2[FeatureType2["AllTypographicFeatures"] = 0] = "AllTypographicFeatures";
  FeatureType2[FeatureType2["Ligatures"] = 1] = "Ligatures";
  FeatureType2[FeatureType2["CursiveConnection"] = 2] = "CursiveConnection";
  FeatureType2[FeatureType2["LetterCase"] = 3] = "LetterCase";
  FeatureType2[FeatureType2["VerticalSubstitution"] = 4] = "VerticalSubstitution";
  FeatureType2[FeatureType2["LinguisticRearrangement"] = 5] = "LinguisticRearrangement";
  FeatureType2[FeatureType2["NumberSpacing"] = 6] = "NumberSpacing";
  FeatureType2[FeatureType2["SmartSwashes"] = 8] = "SmartSwashes";
  FeatureType2[FeatureType2["Diacritics"] = 9] = "Diacritics";
  FeatureType2[FeatureType2["VerticalPosition"] = 10] = "VerticalPosition";
  FeatureType2[FeatureType2["Fractions"] = 11] = "Fractions";
  FeatureType2[FeatureType2["OverlappingCharacters"] = 13] = "OverlappingCharacters";
  FeatureType2[FeatureType2["TypographicExtras"] = 14] = "TypographicExtras";
  FeatureType2[FeatureType2["MathematicalExtras"] = 15] = "MathematicalExtras";
  FeatureType2[FeatureType2["OrnamentSets"] = 16] = "OrnamentSets";
  FeatureType2[FeatureType2["CharacterAlternatives"] = 17] = "CharacterAlternatives";
  FeatureType2[FeatureType2["DesignComplexity"] = 18] = "DesignComplexity";
  FeatureType2[FeatureType2["StyleOptions"] = 19] = "StyleOptions";
  FeatureType2[FeatureType2["CharacterShape"] = 20] = "CharacterShape";
  FeatureType2[FeatureType2["NumberCase"] = 21] = "NumberCase";
  FeatureType2[FeatureType2["TextSpacing"] = 22] = "TextSpacing";
  FeatureType2[FeatureType2["Transliteration"] = 23] = "Transliteration";
  FeatureType2[FeatureType2["Annotation"] = 24] = "Annotation";
  FeatureType2[FeatureType2["KanaSpacing"] = 25] = "KanaSpacing";
  FeatureType2[FeatureType2["IdeographicSpacing"] = 26] = "IdeographicSpacing";
  FeatureType2[FeatureType2["UnicodeDecomposition"] = 27] = "UnicodeDecomposition";
  FeatureType2[FeatureType2["RubyKana"] = 28] = "RubyKana";
  FeatureType2[FeatureType2["CJKSymbolAlternatives"] = 29] = "CJKSymbolAlternatives";
  FeatureType2[FeatureType2["IdeographicAlternatives"] = 30] = "IdeographicAlternatives";
  FeatureType2[FeatureType2["CJKVerticalRomanPlacement"] = 31] = "CJKVerticalRomanPlacement";
  FeatureType2[FeatureType2["ItalicCJKRoman"] = 32] = "ItalicCJKRoman";
  FeatureType2[FeatureType2["CaseSensitiveLayout"] = 33] = "CaseSensitiveLayout";
  FeatureType2[FeatureType2["AlternateKana"] = 34] = "AlternateKana";
  FeatureType2[FeatureType2["StylisticAlternatives"] = 35] = "StylisticAlternatives";
  FeatureType2[FeatureType2["ContextualAlternatives"] = 36] = "ContextualAlternatives";
  FeatureType2[FeatureType2["LowerCase"] = 37] = "LowerCase";
  FeatureType2[FeatureType2["UpperCase"] = 38] = "UpperCase";
  FeatureType2[FeatureType2["LanguageTag"] = 39] = "LanguageTag";
  FeatureType2[FeatureType2["CJKRomanSpacing"] = 103] = "CJKRomanSpacing";
  return FeatureType2;
})(FeatureType || {});
var LigatureSetting = /* @__PURE__ */ ((LigatureSetting2) => {
  LigatureSetting2[LigatureSetting2["RequiredLigaturesOn"] = 0] = "RequiredLigaturesOn";
  LigatureSetting2[LigatureSetting2["RequiredLigaturesOff"] = 1] = "RequiredLigaturesOff";
  LigatureSetting2[LigatureSetting2["CommonLigaturesOn"] = 2] = "CommonLigaturesOn";
  LigatureSetting2[LigatureSetting2["CommonLigaturesOff"] = 3] = "CommonLigaturesOff";
  LigatureSetting2[LigatureSetting2["RareLigaturesOn"] = 4] = "RareLigaturesOn";
  LigatureSetting2[LigatureSetting2["RareLigaturesOff"] = 5] = "RareLigaturesOff";
  LigatureSetting2[LigatureSetting2["LogosOn"] = 6] = "LogosOn";
  LigatureSetting2[LigatureSetting2["LogosOff"] = 7] = "LogosOff";
  LigatureSetting2[LigatureSetting2["RebusPicturesOn"] = 8] = "RebusPicturesOn";
  LigatureSetting2[LigatureSetting2["RebusPicturesOff"] = 9] = "RebusPicturesOff";
  LigatureSetting2[LigatureSetting2["DiphthongLigaturesOn"] = 10] = "DiphthongLigaturesOn";
  LigatureSetting2[LigatureSetting2["DiphthongLigaturesOff"] = 11] = "DiphthongLigaturesOff";
  LigatureSetting2[LigatureSetting2["SquaredLigaturesOn"] = 12] = "SquaredLigaturesOn";
  LigatureSetting2[LigatureSetting2["SquaredLigaturesOff"] = 13] = "SquaredLigaturesOff";
  LigatureSetting2[LigatureSetting2["AbbrevSquaredLigaturesOn"] = 14] = "AbbrevSquaredLigaturesOn";
  LigatureSetting2[LigatureSetting2["AbbrevSquaredLigaturesOff"] = 15] = "AbbrevSquaredLigaturesOff";
  LigatureSetting2[LigatureSetting2["SymbolLigaturesOn"] = 16] = "SymbolLigaturesOn";
  LigatureSetting2[LigatureSetting2["SymbolLigaturesOff"] = 17] = "SymbolLigaturesOff";
  LigatureSetting2[LigatureSetting2["ContextualLigaturesOn"] = 18] = "ContextualLigaturesOn";
  LigatureSetting2[LigatureSetting2["ContextualLigaturesOff"] = 19] = "ContextualLigaturesOff";
  LigatureSetting2[LigatureSetting2["HistoricalLigaturesOn"] = 20] = "HistoricalLigaturesOn";
  LigatureSetting2[LigatureSetting2["HistoricalLigaturesOff"] = 21] = "HistoricalLigaturesOff";
  return LigatureSetting2;
})(LigatureSetting || {});
var VerticalPositionSetting = /* @__PURE__ */ ((VerticalPositionSetting2) => {
  VerticalPositionSetting2[VerticalPositionSetting2["NormalPosition"] = 0] = "NormalPosition";
  VerticalPositionSetting2[VerticalPositionSetting2["Superiors"] = 1] = "Superiors";
  VerticalPositionSetting2[VerticalPositionSetting2["Inferiors"] = 2] = "Inferiors";
  VerticalPositionSetting2[VerticalPositionSetting2["Ordinals"] = 3] = "Ordinals";
  VerticalPositionSetting2[VerticalPositionSetting2["ScientificInferiors"] = 4] = "ScientificInferiors";
  return VerticalPositionSetting2;
})(VerticalPositionSetting || {});
var NumberCaseSetting = /* @__PURE__ */ ((NumberCaseSetting2) => {
  NumberCaseSetting2[NumberCaseSetting2["LowerCaseNumbers"] = 0] = "LowerCaseNumbers";
  NumberCaseSetting2[NumberCaseSetting2["UpperCaseNumbers"] = 1] = "UpperCaseNumbers";
  return NumberCaseSetting2;
})(NumberCaseSetting || {});
var NumberSpacingSetting = /* @__PURE__ */ ((NumberSpacingSetting2) => {
  NumberSpacingSetting2[NumberSpacingSetting2["MonospacedNumbers"] = 0] = "MonospacedNumbers";
  NumberSpacingSetting2[NumberSpacingSetting2["ProportionalNumbers"] = 1] = "ProportionalNumbers";
  NumberSpacingSetting2[NumberSpacingSetting2["ThirdWidthNumbers"] = 2] = "ThirdWidthNumbers";
  NumberSpacingSetting2[NumberSpacingSetting2["QuarterWidthNumbers"] = 3] = "QuarterWidthNumbers";
  return NumberSpacingSetting2;
})(NumberSpacingSetting || {});
var FractionsSetting = /* @__PURE__ */ ((FractionsSetting2) => {
  FractionsSetting2[FractionsSetting2["NoFractions"] = 0] = "NoFractions";
  FractionsSetting2[FractionsSetting2["VerticalFractions"] = 1] = "VerticalFractions";
  FractionsSetting2[FractionsSetting2["DiagonalFractions"] = 2] = "DiagonalFractions";
  return FractionsSetting2;
})(FractionsSetting || {});
var CaseSensitiveLayoutSetting = /* @__PURE__ */ ((CaseSensitiveLayoutSetting2) => {
  CaseSensitiveLayoutSetting2[CaseSensitiveLayoutSetting2["CaseSensitiveLayoutOn"] = 0] = "CaseSensitiveLayoutOn";
  CaseSensitiveLayoutSetting2[CaseSensitiveLayoutSetting2["CaseSensitiveLayoutOff"] = 1] = "CaseSensitiveLayoutOff";
  CaseSensitiveLayoutSetting2[CaseSensitiveLayoutSetting2["CaseSensitiveSpacingOn"] = 2] = "CaseSensitiveSpacingOn";
  CaseSensitiveLayoutSetting2[CaseSensitiveLayoutSetting2["CaseSensitiveSpacingOff"] = 3] = "CaseSensitiveSpacingOff";
  return CaseSensitiveLayoutSetting2;
})(CaseSensitiveLayoutSetting || {});
var StylisticAlternativesSetting = /* @__PURE__ */ ((StylisticAlternativesSetting2) => {
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["NoStylisticAlternates"] = 0] = "NoStylisticAlternates";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltOneOn"] = 2] = "StylisticAltOneOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltOneOff"] = 3] = "StylisticAltOneOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltTwoOn"] = 4] = "StylisticAltTwoOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltTwoOff"] = 5] = "StylisticAltTwoOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltThreeOn"] = 6] = "StylisticAltThreeOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltThreeOff"] = 7] = "StylisticAltThreeOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltFourOn"] = 8] = "StylisticAltFourOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltFourOff"] = 9] = "StylisticAltFourOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltFiveOn"] = 10] = "StylisticAltFiveOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltFiveOff"] = 11] = "StylisticAltFiveOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltSixOn"] = 12] = "StylisticAltSixOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltSixOff"] = 13] = "StylisticAltSixOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltSevenOn"] = 14] = "StylisticAltSevenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltSevenOff"] = 15] = "StylisticAltSevenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltEightOn"] = 16] = "StylisticAltEightOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltEightOff"] = 17] = "StylisticAltEightOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltNineOn"] = 18] = "StylisticAltNineOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltNineOff"] = 19] = "StylisticAltNineOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltTenOn"] = 20] = "StylisticAltTenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltTenOff"] = 21] = "StylisticAltTenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltElevenOn"] = 22] = "StylisticAltElevenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltElevenOff"] = 23] = "StylisticAltElevenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltTwelveOn"] = 24] = "StylisticAltTwelveOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltTwelveOff"] = 25] = "StylisticAltTwelveOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltThirteenOn"] = 26] = "StylisticAltThirteenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltThirteenOff"] = 27] = "StylisticAltThirteenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltFourteenOn"] = 28] = "StylisticAltFourteenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltFourteenOff"] = 29] = "StylisticAltFourteenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltFifteenOn"] = 30] = "StylisticAltFifteenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltFifteenOff"] = 31] = "StylisticAltFifteenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltSixteenOn"] = 32] = "StylisticAltSixteenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltSixteenOff"] = 33] = "StylisticAltSixteenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltSeventeenOn"] = 34] = "StylisticAltSeventeenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltSeventeenOff"] = 35] = "StylisticAltSeventeenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltEighteenOn"] = 36] = "StylisticAltEighteenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltEighteenOff"] = 37] = "StylisticAltEighteenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltNineteenOn"] = 38] = "StylisticAltNineteenOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltNineteenOff"] = 39] = "StylisticAltNineteenOff";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltTwentyOn"] = 40] = "StylisticAltTwentyOn";
  StylisticAlternativesSetting2[StylisticAlternativesSetting2["StylisticAltTwentyOff"] = 41] = "StylisticAltTwentyOff";
  return StylisticAlternativesSetting2;
})(StylisticAlternativesSetting || {});
var ContextualAlternativesSetting = /* @__PURE__ */ ((ContextualAlternativesSetting2) => {
  ContextualAlternativesSetting2[ContextualAlternativesSetting2["ContextualAlternatesOn"] = 0] = "ContextualAlternatesOn";
  ContextualAlternativesSetting2[ContextualAlternativesSetting2["ContextualAlternatesOff"] = 1] = "ContextualAlternatesOff";
  ContextualAlternativesSetting2[ContextualAlternativesSetting2["SwashAlternatesOn"] = 2] = "SwashAlternatesOn";
  ContextualAlternativesSetting2[ContextualAlternativesSetting2["SwashAlternatesOff"] = 3] = "SwashAlternatesOff";
  ContextualAlternativesSetting2[ContextualAlternativesSetting2["ContextualSwashAlternatesOn"] = 4] = "ContextualSwashAlternatesOn";
  ContextualAlternativesSetting2[ContextualAlternativesSetting2["ContextualSwashAlternatesOff"] = 5] = "ContextualSwashAlternatesOff";
  return ContextualAlternativesSetting2;
})(ContextualAlternativesSetting || {});
var LowerCaseSetting = /* @__PURE__ */ ((LowerCaseSetting2) => {
  LowerCaseSetting2[LowerCaseSetting2["DefaultLowerCase"] = 0] = "DefaultLowerCase";
  LowerCaseSetting2[LowerCaseSetting2["LowerCaseSmallCaps"] = 1] = "LowerCaseSmallCaps";
  LowerCaseSetting2[LowerCaseSetting2["LowerCasePetiteCaps"] = 2] = "LowerCasePetiteCaps";
  return LowerCaseSetting2;
})(LowerCaseSetting || {});
var UpperCaseSetting = /* @__PURE__ */ ((UpperCaseSetting2) => {
  UpperCaseSetting2[UpperCaseSetting2["DefaultUpperCase"] = 0] = "DefaultUpperCase";
  UpperCaseSetting2[UpperCaseSetting2["UpperCaseSmallCaps"] = 1] = "UpperCaseSmallCaps";
  UpperCaseSetting2[UpperCaseSetting2["UpperCasePetiteCaps"] = 2] = "UpperCasePetiteCaps";
  return UpperCaseSetting2;
})(UpperCaseSetting || {});
var SmartSwashSetting = /* @__PURE__ */ ((SmartSwashSetting2) => {
  SmartSwashSetting2[SmartSwashSetting2["WordInitialSwashesOn"] = 0] = "WordInitialSwashesOn";
  SmartSwashSetting2[SmartSwashSetting2["WordInitialSwashesOff"] = 1] = "WordInitialSwashesOff";
  SmartSwashSetting2[SmartSwashSetting2["WordFinalSwashesOn"] = 2] = "WordFinalSwashesOn";
  SmartSwashSetting2[SmartSwashSetting2["WordFinalSwashesOff"] = 3] = "WordFinalSwashesOff";
  SmartSwashSetting2[SmartSwashSetting2["LineInitialSwashesOn"] = 4] = "LineInitialSwashesOn";
  SmartSwashSetting2[SmartSwashSetting2["LineInitialSwashesOff"] = 5] = "LineInitialSwashesOff";
  SmartSwashSetting2[SmartSwashSetting2["LineFinalSwashesOn"] = 6] = "LineFinalSwashesOn";
  SmartSwashSetting2[SmartSwashSetting2["LineFinalSwashesOff"] = 7] = "LineFinalSwashesOff";
  SmartSwashSetting2[SmartSwashSetting2["NonFinalSwashesOn"] = 8] = "NonFinalSwashesOn";
  SmartSwashSetting2[SmartSwashSetting2["NonFinalSwashesOff"] = 9] = "NonFinalSwashesOff";
  return SmartSwashSetting2;
})(SmartSwashSetting || {});
var DiacriticsSetting = /* @__PURE__ */ ((DiacriticsSetting2) => {
  DiacriticsSetting2[DiacriticsSetting2["ShowDiacritics"] = 0] = "ShowDiacritics";
  DiacriticsSetting2[DiacriticsSetting2["HideDiacritics"] = 1] = "HideDiacritics";
  DiacriticsSetting2[DiacriticsSetting2["DecomposeDiacritics"] = 2] = "DecomposeDiacritics";
  return DiacriticsSetting2;
})(DiacriticsSetting || {});
var CharacterShapeSetting = /* @__PURE__ */ ((CharacterShapeSetting2) => {
  CharacterShapeSetting2[CharacterShapeSetting2["TraditionalCharacters"] = 0] = "TraditionalCharacters";
  CharacterShapeSetting2[CharacterShapeSetting2["SimplifiedCharacters"] = 1] = "SimplifiedCharacters";
  CharacterShapeSetting2[CharacterShapeSetting2["JIS1978Characters"] = 2] = "JIS1978Characters";
  CharacterShapeSetting2[CharacterShapeSetting2["JIS1983Characters"] = 3] = "JIS1983Characters";
  CharacterShapeSetting2[CharacterShapeSetting2["JIS1990Characters"] = 4] = "JIS1990Characters";
  CharacterShapeSetting2[CharacterShapeSetting2["TraditionalAltOne"] = 5] = "TraditionalAltOne";
  CharacterShapeSetting2[CharacterShapeSetting2["TraditionalAltTwo"] = 6] = "TraditionalAltTwo";
  CharacterShapeSetting2[CharacterShapeSetting2["TraditionalAltThree"] = 7] = "TraditionalAltThree";
  CharacterShapeSetting2[CharacterShapeSetting2["TraditionalAltFour"] = 8] = "TraditionalAltFour";
  CharacterShapeSetting2[CharacterShapeSetting2["TraditionalAltFive"] = 9] = "TraditionalAltFive";
  CharacterShapeSetting2[CharacterShapeSetting2["ExpertCharacters"] = 10] = "ExpertCharacters";
  CharacterShapeSetting2[CharacterShapeSetting2["NLCCharacters"] = 13] = "NLCCharacters";
  CharacterShapeSetting2[CharacterShapeSetting2["JIS2004Characters"] = 11] = "JIS2004Characters";
  CharacterShapeSetting2[CharacterShapeSetting2["HojoCharacters"] = 12] = "HojoCharacters";
  return CharacterShapeSetting2;
})(CharacterShapeSetting || {});
var FeatureFlags = /* @__PURE__ */ ((FeatureFlags2) => {
  FeatureFlags2[FeatureFlags2["Exclusive"] = 32768] = "Exclusive";
  FeatureFlags2[FeatureFlags2["UseDefault"] = 16384] = "UseDefault";
  return FeatureFlags2;
})(FeatureFlags || {});
function parseFeat(reader) {
  const tableStart = reader.offset;
  const version = reader.fixed();
  const featureNameCount = reader.uint16();
  reader.skip(2);
  reader.skip(4);
  const features2 = [];
  for (let i = 0; i < featureNameCount; i++) {
    const featureType = reader.uint16();
    const nSettings = reader.uint16();
    const settingTableOffset = reader.offset32();
    const featureFlags = reader.uint16();
    const defaultSettingIndex = featureFlags & 255;
    const nameId = reader.uint16();
    const settings = [];
    const savedOffset = reader.offset;
    reader.seek(tableStart + settingTableOffset);
    for (let j = 0; j < nSettings; j++) {
      settings.push({
        settingValue: reader.uint16(),
        nameId: reader.uint16()
      });
    }
    reader.seek(savedOffset);
    features2.push({
      featureType,
      nSettings,
      settingTableOffset,
      featureFlags,
      defaultSettingIndex,
      nameId,
      settings
    });
  }
  return { version, features: features2 };
}
function getFeature2(table, featureType) {
  return table.features.find((f) => f.featureType === featureType);
}
function getAllFeatures(table) {
  return table.features;
}
function isExclusiveFeature(feature2) {
  return (feature2.featureFlags & 32768 /* Exclusive */) !== 0;
}
function getDefaultSetting(feature2) {
  return feature2.settings[feature2.defaultSettingIndex];
}
function getSettingByValue(feature2, settingValue) {
  return feature2.settings.find((s) => s.settingValue === settingValue);
}
function hasSettingValue(feature2, settingValue) {
  return feature2.settings.some((s) => s.settingValue === settingValue);
}
function aatToOpenTypeTag(featureType, settingValue) {
  switch (featureType) {
    case 1 /* Ligatures */:
      switch (settingValue) {
        case 2 /* CommonLigaturesOn */:
          return "liga";
        case 4 /* RareLigaturesOn */:
          return "dlig";
        case 20 /* HistoricalLigaturesOn */:
          return "hlig";
        case 18 /* ContextualLigaturesOn */:
          return "clig";
        case 0 /* RequiredLigaturesOn */:
          return "rlig";
      }
      break;
    case 10 /* VerticalPosition */:
      switch (settingValue) {
        case 1 /* Superiors */:
          return "sups";
        case 2 /* Inferiors */:
          return "subs";
        case 3 /* Ordinals */:
          return "ordn";
        case 4 /* ScientificInferiors */:
          return "sinf";
      }
      break;
    case 11 /* Fractions */:
      if (settingValue === 1 /* VerticalFractions */ || settingValue === 2 /* DiagonalFractions */) {
        return "frac";
      }
      break;
    case 21 /* NumberCase */:
      switch (settingValue) {
        case 0 /* LowerCaseNumbers */:
          return "onum";
        case 1 /* UpperCaseNumbers */:
          return "lnum";
      }
      break;
    case 6 /* NumberSpacing */:
      switch (settingValue) {
        case 0 /* MonospacedNumbers */:
          return "tnum";
        case 1 /* ProportionalNumbers */:
          return "pnum";
      }
      break;
    case 33 /* CaseSensitiveLayout */:
      if (settingValue === 0 /* CaseSensitiveLayoutOn */) {
        return "case";
      }
      break;
    case 37 /* LowerCase */:
      switch (settingValue) {
        case 1 /* LowerCaseSmallCaps */:
          return "smcp";
        case 2 /* LowerCasePetiteCaps */:
          return "pcap";
      }
      break;
    case 38 /* UpperCase */:
      switch (settingValue) {
        case 1 /* UpperCaseSmallCaps */:
          return "c2sc";
        case 2 /* UpperCasePetiteCaps */:
          return "c2pc";
      }
      break;
    case 8 /* SmartSwashes */:
      if (settingValue === 0 /* WordInitialSwashesOn */ || settingValue === 2 /* WordFinalSwashesOn */) {
        return "swsh";
      }
      break;
    case 36 /* ContextualAlternatives */:
      switch (settingValue) {
        case 0 /* ContextualAlternatesOn */:
          return "calt";
        case 2 /* SwashAlternatesOn */:
          return "swsh";
      }
      break;
    case 35 /* StylisticAlternatives */:
      if (settingValue >= 2 && settingValue <= 41) {
        const setNum = Math.floor((settingValue - 2) / 2) + 1;
        if (setNum <= 20) {
          return `ss${setNum.toString().padStart(2, "0")}`;
        }
      }
      break;
    case 20 /* CharacterShape */:
      switch (settingValue) {
        case 0 /* TraditionalCharacters */:
          return "trad";
        case 1 /* SimplifiedCharacters */:
          return "smpl";
        case 2 /* JIS1978Characters */:
          return "jp78";
        case 3 /* JIS1983Characters */:
          return "jp83";
        case 4 /* JIS1990Characters */:
          return "jp90";
        case 11 /* JIS2004Characters */:
          return "jp04";
        case 13 /* NLCCharacters */:
          return "nlck";
        case 10 /* ExpertCharacters */:
          return "expt";
        case 12 /* HojoCharacters */:
          return "hojo";
      }
      break;
    case 4 /* VerticalSubstitution */:
      return "vert";
    case 24 /* Annotation */:
      return "nalt";
    case 28 /* RubyKana */:
      return "ruby";
  }
  return null;
}
function openTypeTagToAat(tag2) {
  switch (tag2) {
    case "liga":
      return {
        featureType: 1 /* Ligatures */,
        settingValue: 2 /* CommonLigaturesOn */
      };
    case "dlig":
      return {
        featureType: 1 /* Ligatures */,
        settingValue: 4 /* RareLigaturesOn */
      };
    case "hlig":
      return {
        featureType: 1 /* Ligatures */,
        settingValue: 20 /* HistoricalLigaturesOn */
      };
    case "clig":
      return {
        featureType: 1 /* Ligatures */,
        settingValue: 18 /* ContextualLigaturesOn */
      };
    case "rlig":
      return {
        featureType: 1 /* Ligatures */,
        settingValue: 0 /* RequiredLigaturesOn */
      };
    case "sups":
      return {
        featureType: 10 /* VerticalPosition */,
        settingValue: 1 /* Superiors */
      };
    case "subs":
      return {
        featureType: 10 /* VerticalPosition */,
        settingValue: 2 /* Inferiors */
      };
    case "ordn":
      return {
        featureType: 10 /* VerticalPosition */,
        settingValue: 3 /* Ordinals */
      };
    case "sinf":
      return {
        featureType: 10 /* VerticalPosition */,
        settingValue: 4 /* ScientificInferiors */
      };
    case "frac":
      return {
        featureType: 11 /* Fractions */,
        settingValue: 2 /* DiagonalFractions */
      };
    case "onum":
      return {
        featureType: 21 /* NumberCase */,
        settingValue: 0 /* LowerCaseNumbers */
      };
    case "lnum":
      return {
        featureType: 21 /* NumberCase */,
        settingValue: 1 /* UpperCaseNumbers */
      };
    case "tnum":
      return {
        featureType: 6 /* NumberSpacing */,
        settingValue: 0 /* MonospacedNumbers */
      };
    case "pnum":
      return {
        featureType: 6 /* NumberSpacing */,
        settingValue: 1 /* ProportionalNumbers */
      };
    case "case":
      return {
        featureType: 33 /* CaseSensitiveLayout */,
        settingValue: 0 /* CaseSensitiveLayoutOn */
      };
    case "smcp":
      return {
        featureType: 37 /* LowerCase */,
        settingValue: 1 /* LowerCaseSmallCaps */
      };
    case "pcap":
      return {
        featureType: 37 /* LowerCase */,
        settingValue: 2 /* LowerCasePetiteCaps */
      };
    case "c2sc":
      return {
        featureType: 38 /* UpperCase */,
        settingValue: 1 /* UpperCaseSmallCaps */
      };
    case "c2pc":
      return {
        featureType: 38 /* UpperCase */,
        settingValue: 2 /* UpperCasePetiteCaps */
      };
    case "swsh":
      return {
        featureType: 8 /* SmartSwashes */,
        settingValue: 0 /* WordInitialSwashesOn */
      };
    case "calt":
      return {
        featureType: 36 /* ContextualAlternatives */,
        settingValue: 0 /* ContextualAlternatesOn */
      };
    case "trad":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 0 /* TraditionalCharacters */
      };
    case "smpl":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 1 /* SimplifiedCharacters */
      };
    case "jp78":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 2 /* JIS1978Characters */
      };
    case "jp83":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 3 /* JIS1983Characters */
      };
    case "jp90":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 4 /* JIS1990Characters */
      };
    case "jp04":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 11 /* JIS2004Characters */
      };
    case "nlck":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 13 /* NLCCharacters */
      };
    case "expt":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 10 /* ExpertCharacters */
      };
    case "hojo":
      return {
        featureType: 20 /* CharacterShape */,
        settingValue: 12 /* HojoCharacters */
      };
    case "vert":
      return { featureType: 4 /* VerticalSubstitution */, settingValue: 0 };
    case "nalt":
      return { featureType: 24 /* Annotation */, settingValue: 0 };
    case "ruby":
      return { featureType: 28 /* RubyKana */, settingValue: 0 };
  }
  if (tag2.startsWith("ss") && tag2.length === 4) {
    const num = parseInt(tag2.slice(2), 10);
    if (num >= 1 && num <= 20) {
      return {
        featureType: 35 /* StylisticAlternatives */,
        settingValue: (num - 1) * 2 + 2
      };
    }
  }
  return null;
}

// src/font/tables/stat.ts
var AxisValueFlags = {
  OlderSiblingFontAttribute: 1,
  ElidableAxisValueName: 2
};
function parseStat(reader) {
  const tableStart = reader.offset;
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const designAxisSize = reader.uint16();
  const designAxisCount = reader.uint16();
  const designAxesOffset = reader.offset32();
  const axisValueCount = reader.uint16();
  const axisValueArrayOffset = reader.offset32();
  let elidedFallbackNameID;
  if (majorVersion >= 1 && minorVersion >= 1) {
    elidedFallbackNameID = reader.uint16();
  }
  const designAxes = [];
  if (designAxesOffset !== 0) {
    const axesReader = reader.sliceFrom(tableStart + designAxesOffset);
    for (let i = 0; i < designAxisCount; i++) {
      designAxes.push({
        axisTag: axesReader.tag(),
        axisNameID: axesReader.uint16(),
        axisOrdering: axesReader.uint16()
      });
      if (designAxisSize > 8) {
        axesReader.skip(designAxisSize - 8);
      }
    }
  }
  const axisValues = [];
  if (axisValueArrayOffset !== 0 && axisValueCount > 0) {
    const arrayReader = reader.sliceFrom(tableStart + axisValueArrayOffset);
    const axisValueOffsets = [];
    for (let i = 0; i < axisValueCount; i++) {
      axisValueOffsets.push(arrayReader.uint16());
    }
    for (const offset of axisValueOffsets) {
      const valueReader = reader.sliceFrom(
        tableStart + axisValueArrayOffset + offset
      );
      const axisValue = parseAxisValue(valueReader);
      if (axisValue) {
        axisValues.push(axisValue);
      }
    }
  }
  return {
    majorVersion,
    minorVersion,
    designAxisCount,
    designAxes,
    axisValueCount,
    axisValues,
    elidedFallbackNameID
  };
}
function parseAxisValue(reader) {
  const format = reader.uint16();
  switch (format) {
    case 1: {
      return {
        format: 1,
        axisIndex: reader.uint16(),
        flags: reader.uint16(),
        valueNameID: reader.uint16(),
        value: reader.fixed()
      };
    }
    case 2: {
      return {
        format: 2,
        axisIndex: reader.uint16(),
        flags: reader.uint16(),
        valueNameID: reader.uint16(),
        nominalValue: reader.fixed(),
        rangeMinValue: reader.fixed(),
        rangeMaxValue: reader.fixed()
      };
    }
    case 3: {
      return {
        format: 3,
        axisIndex: reader.uint16(),
        flags: reader.uint16(),
        valueNameID: reader.uint16(),
        value: reader.fixed(),
        linkedValue: reader.fixed()
      };
    }
    case 4: {
      const axisCount = reader.uint16();
      const flags = reader.uint16();
      const valueNameID = reader.uint16();
      const axisValues = [];
      for (let i = 0; i < axisCount; i++) {
        axisValues.push({
          axisIndex: reader.uint16(),
          value: reader.fixed()
        });
      }
      return {
        format: 4,
        axisCount,
        flags,
        valueNameID,
        axisValues
      };
    }
    default:
      return null;
  }
}
function getAxisRecord(stat, axisTag) {
  return stat.designAxes.find((a) => a.axisTag === axisTag) ?? null;
}
function getAxisIndex(stat, axisTag) {
  return stat.designAxes.findIndex((a) => a.axisTag === axisTag);
}
function getAxisValuesForAxis(stat, axisIndex) {
  return stat.axisValues.filter((v) => {
    if (v.format === 4) {
      return v.axisValues.some((av) => av.axisIndex === axisIndex);
    }
    return v.axisIndex === axisIndex;
  });
}
function findAxisValueByNameId(stat, nameId) {
  return stat.axisValues.find((v) => v.valueNameID === nameId) ?? null;
}
function isElidableAxisValue(axisValue) {
  return (axisValue.flags & AxisValueFlags.ElidableAxisValueName) !== 0;
}
function isOlderSiblingFont(axisValue) {
  return (axisValue.flags & AxisValueFlags.OlderSiblingFontAttribute) !== 0;
}
function getAxisValueNumber(axisValue) {
  switch (axisValue.format) {
    case 1:
    case 3:
      return axisValue.value;
    case 2:
      return axisValue.nominalValue;
    case 4:
      return null;
  }
}
function matchAxisValue(axisValue, coords) {
  switch (axisValue.format) {
    case 1:
    case 3: {
      const coord = coords.get(axisValue.axisIndex);
      return coord !== void 0 && coord === axisValue.value;
    }
    case 2: {
      const coord = coords.get(axisValue.axisIndex);
      return coord !== void 0 && coord >= axisValue.rangeMinValue && coord <= axisValue.rangeMaxValue;
    }
    case 4: {
      return axisValue.axisValues.every((av) => {
        const coord = coords.get(av.axisIndex);
        return coord !== void 0 && coord === av.value;
      });
    }
  }
}

// src/font/tables/svg.ts
function parseSvg(reader) {
  const version = reader.uint16();
  const svgDocumentListOffset = reader.offset32();
  reader.skip(4);
  const listReader = reader.sliceFrom(svgDocumentListOffset);
  const numEntries = listReader.uint16();
  const entries = [];
  for (let i = 0; i < numEntries; i++) {
    entries.push({
      startGlyphID: listReader.uint16(),
      endGlyphID: listReader.uint16(),
      svgDocOffset: listReader.offset32(),
      svgDocLength: listReader.uint32()
    });
  }
  const documentRecords = [];
  const decoder = new TextDecoder("utf-8");
  for (const entry of entries) {
    const docReader = listReader.sliceFrom(entry.svgDocOffset);
    const svgBytes = docReader.bytes(entry.svgDocLength);
    let svgDoc;
    if (svgBytes[0] === 31 && svgBytes[1] === 139) {
      try {
        const decompressed = decompressGzip(svgBytes);
        svgDoc = decoder.decode(decompressed);
      } catch {
        svgDoc = decoder.decode(svgBytes);
      }
    } else {
      svgDoc = decoder.decode(svgBytes);
    }
    documentRecords.push({
      startGlyphID: entry.startGlyphID,
      endGlyphID: entry.endGlyphID,
      svgDoc
    });
  }
  return { version, documentRecords };
}
function getSvgDocument(svg, glyphId) {
  for (const record of svg.documentRecords) {
    if (glyphId >= record.startGlyphID && glyphId <= record.endGlyphID) {
      return record.svgDoc;
    }
  }
  return null;
}
function hasSvgGlyph(svg, glyphId) {
  return getSvgDocument(svg, glyphId) !== null;
}
function getSvgGlyphIds(svg) {
  const glyphIds = [];
  for (const record of svg.documentRecords) {
    for (let gid = record.startGlyphID; gid <= record.endGlyphID; gid++) {
      glyphIds.push(gid);
    }
  }
  return glyphIds;
}
function decompressGzip(data) {
  if (typeof DecompressionStream !== "undefined") {
    return data;
  }
  return data;
}

// src/font/tables/trak.ts
function parseTrak(reader) {
  const version = reader.uint32() / 65536;
  const format = reader.uint16();
  const horizOffset = reader.offset16();
  const vertOffset = reader.offset16();
  reader.skip(2);
  let horizData = null;
  let vertData = null;
  if (horizOffset !== 0) {
    horizData = parseTrackData(reader.sliceFrom(horizOffset));
  }
  if (vertOffset !== 0) {
    vertData = parseTrackData(reader.sliceFrom(vertOffset));
  }
  return {
    version,
    format,
    horizData,
    vertData
  };
}
function parseTrackData(reader) {
  const nTracks = reader.uint16();
  const nSizes = reader.uint16();
  const sizeTableOffset = reader.offset32();
  const trackTable = [];
  for (let i = 0; i < nTracks; i++) {
    const track = reader.int32() / 65536;
    const nameIndex = reader.uint16();
    const offset = reader.uint16();
    trackTable.push({
      track,
      nameIndex,
      offset,
      perSizeTracking: []
    });
  }
  for (const entry of trackTable) {
    const trackReader = reader.sliceFrom(entry.offset);
    entry.perSizeTracking = [];
    for (let i = 0; i < nSizes; i++) {
      entry.perSizeTracking.push(trackReader.int16());
    }
  }
  const sizeReader = reader.sliceFrom(sizeTableOffset);
  const sizeTable = [];
  for (let i = 0; i < nSizes; i++) {
    sizeTable.push(sizeReader.int32() / 65536);
  }
  return {
    nTracks,
    nSizes,
    sizeTableOffset,
    trackTable,
    sizeTable
  };
}
function getTrackingValue(trackData, track, pointSize) {
  let trackEntry = null;
  for (const entry of trackData.trackTable) {
    if (entry.track === track) {
      trackEntry = entry;
      break;
    }
  }
  if (!trackEntry) {
    let lower = null;
    let upper = null;
    for (const entry of trackData.trackTable) {
      if (entry.track <= track && (!lower || entry.track > lower.track)) {
        lower = entry;
      }
      if (entry.track >= track && (!upper || entry.track < upper.track)) {
        upper = entry;
      }
    }
    if (lower && upper && lower !== upper) {
      const t = (track - lower.track) / (upper.track - lower.track);
      const lowerValue = getSizeValue(trackData, lower, pointSize);
      const upperValue = getSizeValue(trackData, upper, pointSize);
      return Math.round(lowerValue + t * (upperValue - lowerValue));
    } else if (lower) {
      trackEntry = lower;
    } else if (upper) {
      trackEntry = upper;
    } else {
      return 0;
    }
  }
  if (!trackEntry) return 0;
  return getSizeValue(trackData, trackEntry, pointSize);
}
function getSizeValue(trackData, entry, pointSize) {
  const sizes = trackData.sizeTable;
  const values = entry.perSizeTracking;
  if (sizes.length === 0 || values.length === 0) return 0;
  const firstSize = sizes[0];
  const firstValue = values[0];
  if (firstSize === void 0 || firstValue === void 0) return 0;
  if (pointSize <= firstSize) {
    return firstValue;
  }
  const lastSize = sizes[sizes.length - 1];
  const lastValue = values[values.length - 1];
  if (lastSize === void 0 || lastValue === void 0) return 0;
  if (pointSize >= lastSize) {
    return lastValue;
  }
  for (let i = 0; i < sizes.length - 1; i++) {
    const size1 = sizes[i];
    const size2 = sizes[i + 1];
    const value1 = values[i];
    const value2 = values[i + 1];
    if (size1 === void 0 || size2 === void 0 || value1 === void 0 || value2 === void 0)
      continue;
    if (pointSize >= size1 && pointSize <= size2) {
      const t = (pointSize - size1) / (size2 - size1);
      return Math.round(value1 + t * (value2 - value1));
    }
  }
  return 0;
}
function applyTracking(trak, advances, pointSize, track = 0, vertical = false) {
  const trackData = vertical ? trak.vertData : trak.horizData;
  if (!trackData) return;
  const trackingValue = getTrackingValue(trackData, track, pointSize);
  if (trackingValue === 0) return;
  for (const [i, advance] of advances.entries()) {
    advances[i] = (advance ?? 0) + trackingValue;
  }
}

// src/font/tables/vhea.ts
function parseVhea(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const ascender = reader.fword();
  const descender = reader.fword();
  const lineGap = reader.fword();
  const advanceHeightMax = reader.uint16();
  const minTopSideBearing = reader.fword();
  const minBottomSideBearing = reader.fword();
  const yMaxExtent = reader.fword();
  const caretSlopeRise = reader.int16();
  const caretSlopeRun = reader.int16();
  const caretOffset = reader.int16();
  reader.skip(8);
  const metricDataFormat = reader.int16();
  const numberOfVMetrics = reader.uint16();
  return {
    version: { major: majorVersion, minor: minorVersion },
    ascender,
    descender,
    lineGap,
    advanceHeightMax,
    minTopSideBearing,
    minBottomSideBearing,
    yMaxExtent,
    caretSlopeRise,
    caretSlopeRun,
    caretOffset,
    metricDataFormat,
    numberOfVMetrics
  };
}

// src/font/tables/vmtx.ts
function parseVmtx(reader, numberOfVMetrics, numGlyphs) {
  const vMetrics = [];
  for (let i = 0; i < numberOfVMetrics; i++) {
    vMetrics.push({
      advanceHeight: reader.uint16(),
      topSideBearing: reader.int16()
    });
  }
  const topSideBearings = [];
  const remaining = numGlyphs - numberOfVMetrics;
  for (let i = 0; i < remaining; i++) {
    topSideBearings.push(reader.int16());
  }
  return { vMetrics, topSideBearings };
}
function getVerticalMetrics(vmtx, glyphId) {
  if (glyphId < vmtx.vMetrics.length) {
    const metric = vmtx.vMetrics[glyphId];
    if (metric) {
      return {
        advanceHeight: metric.advanceHeight,
        topSideBearing: metric.topSideBearing
      };
    }
  }
  const lastMetric = vmtx.vMetrics[vmtx.vMetrics.length - 1];
  const advanceHeight = lastMetric?.advanceHeight ?? 0;
  const tsbIndex = glyphId - vmtx.vMetrics.length;
  const topSideBearing = vmtx.topSideBearings[tsbIndex] ?? 0;
  return { advanceHeight, topSideBearing };
}

// src/font/tables/vorg.ts
function parseVorg(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const defaultVertOriginY = reader.int16();
  const numVertOriginYMetrics = reader.uint16();
  const vertOriginYMetrics = [];
  for (let i = 0; i < numVertOriginYMetrics; i++) {
    vertOriginYMetrics.push({
      glyphIndex: reader.uint16(),
      vertOriginY: reader.int16()
    });
  }
  vertOriginYMetrics.sort((a, b) => a.glyphIndex - b.glyphIndex);
  return {
    majorVersion,
    minorVersion,
    defaultVertOriginY,
    vertOriginYMetrics
  };
}
function getVertOriginY(vorg, glyphId) {
  const metrics = vorg.vertOriginYMetrics;
  let lo = 0;
  let hi = metrics.length - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const metric = metrics[mid];
    if (metric.glyphIndex === glyphId) {
      return metric.vertOriginY;
    } else if (metric.glyphIndex < glyphId) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return vorg.defaultVertOriginY;
}
function hasVertOriginY(vorg, glyphId) {
  const metrics = vorg.vertOriginYMetrics;
  let lo = 0;
  let hi = metrics.length - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const metric = metrics[mid];
    if (metric.glyphIndex === glyphId) {
      return true;
    } else if (metric.glyphIndex < glyphId) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return false;
}

// src/font/tables/vvar.ts
function parseVvar(reader) {
  const majorVersion = reader.uint16();
  const minorVersion = reader.uint16();
  const itemVariationStoreOffset = reader.offset32();
  const advanceHeightMappingOffset = reader.offset32();
  const tsbMappingOffset = reader.offset32();
  const bsbMappingOffset = reader.offset32();
  const vOrgMappingOffset = reader.offset32();
  const itemVariationStore = parseItemVariationStore5(
    reader.sliceFrom(itemVariationStoreOffset)
  );
  const advanceHeightMapping = advanceHeightMappingOffset !== 0 ? parseDeltaSetIndexMap3(reader.sliceFrom(advanceHeightMappingOffset)) : null;
  const tsbMapping = tsbMappingOffset !== 0 ? parseDeltaSetIndexMap3(reader.sliceFrom(tsbMappingOffset)) : null;
  const bsbMapping = bsbMappingOffset !== 0 ? parseDeltaSetIndexMap3(reader.sliceFrom(bsbMappingOffset)) : null;
  const vOrgMapping = vOrgMappingOffset !== 0 ? parseDeltaSetIndexMap3(reader.sliceFrom(vOrgMappingOffset)) : null;
  return {
    majorVersion,
    minorVersion,
    itemVariationStore,
    advanceHeightMapping,
    tsbMapping,
    bsbMapping,
    vOrgMapping
  };
}
function parseItemVariationStore5(reader) {
  const format = reader.uint16();
  const variationRegionListOffset = reader.offset32();
  const itemVariationDataCount = reader.uint16();
  const itemVariationDataOffsets = [];
  for (let i = 0; i < itemVariationDataCount; i++) {
    itemVariationDataOffsets.push(reader.offset32());
  }
  const regionReader = reader.sliceFrom(variationRegionListOffset);
  const axisCount = regionReader.uint16();
  const regionCount = regionReader.uint16();
  const variationRegions = [];
  for (let i = 0; i < regionCount; i++) {
    const regionAxes = [];
    for (let j = 0; j < axisCount; j++) {
      regionAxes.push({
        startCoord: regionReader.f2dot14(),
        peakCoord: regionReader.f2dot14(),
        endCoord: regionReader.f2dot14()
      });
    }
    variationRegions.push({ regionAxes });
  }
  const itemVariationData = [];
  for (const offset of itemVariationDataOffsets) {
    const dataReader = reader.sliceFrom(offset);
    const itemCount = dataReader.uint16();
    const wordDeltaCount = dataReader.uint16();
    const regionIndexCount = dataReader.uint16();
    const regionIndexes = [];
    for (let i = 0; i < regionIndexCount; i++) {
      regionIndexes.push(dataReader.uint16());
    }
    const longWords = (wordDeltaCount & 32768) !== 0;
    const wordCount = wordDeltaCount & 32767;
    const shortCount = regionIndexCount - wordCount;
    const deltaSets = [];
    for (let i = 0; i < itemCount; i++) {
      const deltas = [];
      for (let j = 0; j < wordCount; j++) {
        if (longWords) {
          deltas.push(dataReader.int32());
        } else {
          deltas.push(dataReader.int16());
        }
      }
      for (let j = 0; j < shortCount; j++) {
        if (longWords) {
          deltas.push(dataReader.int16());
        } else {
          deltas.push(dataReader.int8());
        }
      }
      deltaSets.push(deltas);
    }
    itemVariationData.push({ itemCount, regionIndexes, deltaSets });
  }
  return { format, variationRegions, itemVariationData };
}
function parseDeltaSetIndexMap3(reader) {
  const format = reader.uint8();
  const entryFormat = reader.uint8();
  const mapCount = format === 0 ? reader.uint16() : reader.uint32();
  const innerIndexBitCount = (entryFormat & 15) + 1;
  const mapEntrySize = (entryFormat >> 4 & 3) + 1;
  const mapData = [];
  for (let i = 0; i < mapCount; i++) {
    let entry = 0;
    for (let j = 0; j < mapEntrySize; j++) {
      entry = entry << 8 | reader.uint8();
    }
    const inner = entry & (1 << innerIndexBitCount) - 1;
    const outer = entry >> innerIndexBitCount;
    mapData.push({ outer, inner });
  }
  return { format, mapCount, entryFormat, innerIndexBitCount, mapData };
}
function getAdvanceHeightDelta(vvar, glyphId, coords) {
  const mapping = vvar.advanceHeightMapping;
  let outer;
  let inner;
  if (mapping && glyphId < mapping.mapData.length) {
    const entry = mapping.mapData[glyphId];
    if (!entry) {
      return 0;
    }
    outer = entry.outer;
    inner = entry.inner;
  } else {
    outer = 0;
    inner = glyphId;
  }
  return calculateDelta(vvar.itemVariationStore, outer, inner, coords);
}
function getTsbDelta(vvar, glyphId, coords) {
  const mapping = vvar.tsbMapping;
  if (!mapping) return 0;
  if (glyphId >= mapping.mapData.length) return 0;
  const entry = mapping.mapData[glyphId];
  if (!entry) return 0;
  return calculateDelta(
    vvar.itemVariationStore,
    entry.outer,
    entry.inner,
    coords
  );
}
function getBsbDelta(vvar, glyphId, coords) {
  const mapping = vvar.bsbMapping;
  if (!mapping) return 0;
  if (glyphId >= mapping.mapData.length) return 0;
  const entry = mapping.mapData[glyphId];
  if (!entry) return 0;
  return calculateDelta(
    vvar.itemVariationStore,
    entry.outer,
    entry.inner,
    coords
  );
}
function getVorgDelta(vvar, glyphId, coords) {
  const mapping = vvar.vOrgMapping;
  if (!mapping) return 0;
  if (glyphId >= mapping.mapData.length) return 0;
  const entry = mapping.mapData[glyphId];
  if (!entry) return 0;
  return calculateDelta(
    vvar.itemVariationStore,
    entry.outer,
    entry.inner,
    coords
  );
}
function calculateDelta(store, outer, inner, coords) {
  const varData = store.itemVariationData[outer];
  if (!varData || inner >= varData.itemCount) {
    return 0;
  }
  const deltaSet = varData.deltaSets[inner];
  if (!deltaSet) {
    return 0;
  }
  let delta = 0;
  for (const [i, regionIndex] of varData.regionIndexes.entries()) {
    const region = store.variationRegions[regionIndex];
    if (!region) continue;
    const scalar = calculateRegionScalar(region, coords);
    const regionDelta = deltaSet[i] ?? 0;
    delta += scalar * regionDelta;
  }
  return Math.round(delta);
}

// src/font/tables/hinting.ts
function parseFpgm(reader) {
  const instructions = reader.bytes(reader.remaining);
  return { instructions };
}
function parsePrep(reader) {
  const instructions = reader.bytes(reader.remaining);
  return { instructions };
}
function parseCvt(reader) {
  const count = Math.floor(reader.remaining / 2);
  const values = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = reader.int16();
  }
  return { values };
}

// src/font/tables/gasp.ts
function parseGasp(reader) {
  const version = reader.uint16();
  const numRanges = reader.uint16();
  const ranges = [];
  for (let i = 0; i < numRanges; i++) {
    const maxPPEM = reader.uint16();
    const behavior = reader.uint16();
    ranges.push({ maxPPEM, behavior });
  }
  ranges.sort((a, b) => a.maxPPEM - b.maxPPEM);
  return { version, ranges };
}

// src/font/font.ts
var WOFF_MAGIC = 2001684038;
var WOFF2_MAGIC = 2001684018;
function isWoff2(buffer) {
  const view = new DataView(buffer);
  return view.getUint32(0, false) === WOFF2_MAGIC;
}
function isWoff(buffer) {
  const view = new DataView(buffer);
  return view.getUint32(0, false) === WOFF_MAGIC;
}
var Font = class _Font {
  reader;
  directory;
  // Lazy-loaded tables
  _head = null;
  _maxp = null;
  _hhea = null;
  _hmtx = null;
  _cmap = null;
  _gdef = void 0;
  _gsub = void 0;
  _gpos = void 0;
  _kern = void 0;
  _fvar = void 0;
  _hvar = void 0;
  _vhea = void 0;
  _vmtx = void 0;
  _morx = void 0;
  _gvar = void 0;
  _avar = void 0;
  _kerx = void 0;
  _trak = void 0;
  _cff = void 0;
  _cff2 = void 0;
  _colr = void 0;
  _cpal = void 0;
  _vvar = void 0;
  _mvar = void 0;
  _os2 = void 0;
  _name = void 0;
  _post = void 0;
  _base = void 0;
  _jstf = void 0;
  _math = void 0;
  _loca = void 0;
  _glyf = void 0;
  _svg = void 0;
  _vorg = void 0;
  _sbix = void 0;
  _stat = void 0;
  _cbdt = void 0;
  _cblc = void 0;
  _feat = void 0;
  _fpgm = void 0;
  _prep = void 0;
  _cvt = void 0;
  _gasp = void 0;
  constructor(buffer, _options = {}) {
    this.reader = new Reader(buffer);
    this.directory = parseFontDirectory(this.reader);
  }
  /** Load font from ArrayBuffer (sync - does not support WOFF2) */
  static load(buffer, options) {
    if (isWoff2(buffer)) {
      throw new Error("WOFF2 requires async loading. Use Font.loadAsync() instead.");
    }
    if (isWoff(buffer)) {
      throw new Error("WOFF format is not supported. Please use TTF, OTF, or WOFF2.");
    }
    return new _Font(buffer, options);
  }
  /** Load font from ArrayBuffer with WOFF2 support (async) */
  static async loadAsync(buffer, options) {
    if (isWoff2(buffer)) {
      buffer = await woff2ToSfnt(buffer);
    } else if (isWoff(buffer)) {
      throw new Error("WOFF format is not supported. Please use TTF, OTF, or WOFF2.");
    }
    return new _Font(buffer, options);
  }
  /** Load font from URL (works in browser and Bun, supports WOFF2) */
  static async fromURL(url, options) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch font: ${response.status} ${response.statusText}`
      );
    }
    const buffer = await response.arrayBuffer();
    return _Font.loadAsync(buffer, options);
  }
  /** Load font from file path (Bun only, supports WOFF2) */
  static async fromFile(path, options) {
    const file = Bun.file(path);
    const buffer = await file.arrayBuffer();
    return _Font.loadAsync(buffer, options);
  }
  // Table accessors
  /** Check if font has a specific table */
  hasTable(tag2) {
    return this.directory.tables.has(tag2);
  }
  /** Get table record */
  getTableRecord(tag2) {
    return this.directory.tables.get(tag2);
  }
  /** Get reader for a table */
  getTableReader(tag2) {
    const record = this.directory.tables.get(tag2);
    if (!record) return null;
    return this.reader.slice(record.offset, record.length);
  }
  // Required tables (lazy-loaded)
  get head() {
    if (!this._head) {
      const reader = this.getTableReader(Tags.head);
      if (!reader) throw new Error("Missing required 'head' table");
      this._head = parseHead(reader);
    }
    return this._head;
  }
  get maxp() {
    if (!this._maxp) {
      const reader = this.getTableReader(Tags.maxp);
      if (!reader) throw new Error("Missing required 'maxp' table");
      this._maxp = parseMaxp(reader);
    }
    return this._maxp;
  }
  get hhea() {
    if (!this._hhea) {
      const reader = this.getTableReader(Tags.hhea);
      if (!reader) throw new Error("Missing required 'hhea' table");
      this._hhea = parseHhea(reader);
    }
    return this._hhea;
  }
  get hmtx() {
    if (!this._hmtx) {
      const reader = this.getTableReader(Tags.hmtx);
      if (!reader) throw new Error("Missing required 'hmtx' table");
      this._hmtx = parseHmtx(
        reader,
        this.hhea.numberOfHMetrics,
        this.numGlyphs
      );
    }
    return this._hmtx;
  }
  get cmap() {
    if (!this._cmap) {
      const record = this.getTableRecord(Tags.cmap);
      const reader = this.getTableReader(Tags.cmap);
      if (!reader || !record) throw new Error("Missing required 'cmap' table");
      this._cmap = parseCmap(reader, record.length);
    }
    return this._cmap;
  }
  get gdef() {
    if (this._gdef === void 0) {
      const reader = this.getTableReader(Tags.GDEF);
      this._gdef = reader ? parseGdef(reader) : null;
    }
    return this._gdef;
  }
  get gsub() {
    if (this._gsub === void 0) {
      const reader = this.getTableReader(Tags.GSUB);
      this._gsub = reader ? parseGsub(reader) : null;
    }
    return this._gsub;
  }
  get gpos() {
    if (this._gpos === void 0) {
      const reader = this.getTableReader(Tags.GPOS);
      this._gpos = reader ? parseGpos(reader) : null;
    }
    return this._gpos;
  }
  get kern() {
    if (this._kern === void 0) {
      const reader = this.getTableReader(Tags.kern);
      this._kern = reader ? parseKern(reader) : null;
    }
    return this._kern;
  }
  get fvar() {
    if (this._fvar === void 0) {
      const reader = this.getTableReader(Tags.fvar);
      this._fvar = reader ? parseFvar(reader) : null;
    }
    return this._fvar;
  }
  get hvar() {
    if (this._hvar === void 0) {
      const reader = this.getTableReader(Tags.HVAR);
      this._hvar = reader ? parseHvar(reader) : null;
    }
    return this._hvar;
  }
  get vhea() {
    if (this._vhea === void 0) {
      const reader = this.getTableReader(Tags.vhea);
      this._vhea = reader ? parseVhea(reader) : null;
    }
    return this._vhea;
  }
  get vmtx() {
    if (this._vmtx === void 0) {
      const vhea = this.vhea;
      if (!vhea) {
        this._vmtx = null;
      } else {
        const reader = this.getTableReader(Tags.vmtx);
        this._vmtx = reader ? parseVmtx(reader, vhea.numberOfVMetrics, this.numGlyphs) : null;
      }
    }
    return this._vmtx;
  }
  get morx() {
    if (this._morx === void 0) {
      const reader = this.getTableReader(Tags.morx);
      this._morx = reader ? parseMorx(reader) : null;
    }
    return this._morx;
  }
  get gvar() {
    if (this._gvar === void 0) {
      const reader = this.getTableReader(Tags.gvar);
      this._gvar = reader ? parseGvar(reader, this.numGlyphs) : null;
    }
    return this._gvar;
  }
  get avar() {
    if (this._avar === void 0) {
      const fvar = this.fvar;
      if (!fvar) {
        this._avar = null;
      } else {
        const reader = this.getTableReader(Tags.avar);
        this._avar = reader ? parseAvar(reader, fvar.axes.length) : null;
      }
    }
    return this._avar;
  }
  get kerx() {
    if (this._kerx === void 0) {
      const reader = this.getTableReader(Tags.kerx);
      this._kerx = reader ? parseKerx(reader) : null;
    }
    return this._kerx;
  }
  get trak() {
    if (this._trak === void 0) {
      const reader = this.getTableReader(Tags.trak);
      this._trak = reader ? parseTrak(reader) : null;
    }
    return this._trak;
  }
  get cff() {
    if (this._cff === void 0) {
      const reader = this.getTableReader(Tags.CFF);
      this._cff = reader ? parseCff(reader) : null;
    }
    return this._cff;
  }
  get cff2() {
    if (this._cff2 === void 0) {
      const reader = this.getTableReader(Tags.CFF2);
      this._cff2 = reader ? parseCff2(reader) : null;
    }
    return this._cff2;
  }
  get colr() {
    if (this._colr === void 0) {
      const reader = this.getTableReader(Tags.COLR);
      this._colr = reader ? parseColr(reader) : null;
    }
    return this._colr;
  }
  get cpal() {
    if (this._cpal === void 0) {
      const reader = this.getTableReader(Tags.CPAL);
      this._cpal = reader ? parseCpal(reader) : null;
    }
    return this._cpal;
  }
  get vvar() {
    if (this._vvar === void 0) {
      const reader = this.getTableReader(Tags.VVAR);
      this._vvar = reader ? parseVvar(reader) : null;
    }
    return this._vvar;
  }
  get mvar() {
    if (this._mvar === void 0) {
      const reader = this.getTableReader(Tags.MVAR);
      this._mvar = reader ? parseMvar(reader) : null;
    }
    return this._mvar;
  }
  get os2() {
    if (this._os2 === void 0) {
      const reader = this.getTableReader(Tags.OS2);
      this._os2 = reader ? parseOs2(reader) : null;
    }
    return this._os2;
  }
  get name() {
    if (this._name === void 0) {
      const reader = this.getTableReader(Tags.name);
      this._name = reader ? parseName(reader) : null;
    }
    return this._name;
  }
  get post() {
    if (this._post === void 0) {
      const reader = this.getTableReader(Tags.post);
      this._post = reader ? parsePost(reader) : null;
    }
    return this._post;
  }
  get base() {
    if (this._base === void 0) {
      const reader = this.getTableReader(Tags.BASE);
      this._base = reader ? parseBase(reader) : null;
    }
    return this._base;
  }
  get jstf() {
    if (this._jstf === void 0) {
      const reader = this.getTableReader(Tags.JSTF);
      this._jstf = reader ? parseJstf(reader) : null;
    }
    return this._jstf;
  }
  get math() {
    if (this._math === void 0) {
      const reader = this.getTableReader(Tags.MATH);
      this._math = reader ? parseMath(reader) : null;
    }
    return this._math;
  }
  get loca() {
    if (this._loca === void 0) {
      const reader = this.getTableReader(Tags.loca);
      this._loca = reader ? parseLoca(reader, this.numGlyphs, this.head.indexToLocFormat) : null;
    }
    return this._loca;
  }
  get glyf() {
    if (this._glyf === void 0) {
      const reader = this.getTableReader(Tags.glyf);
      this._glyf = reader ? parseGlyf(reader) : null;
    }
    return this._glyf;
  }
  get svg() {
    if (this._svg === void 0) {
      const reader = this.getTableReader(Tags.SVG);
      this._svg = reader ? parseSvg(reader) : null;
    }
    return this._svg;
  }
  get vorg() {
    if (this._vorg === void 0) {
      const reader = this.getTableReader(Tags.VORG);
      this._vorg = reader ? parseVorg(reader) : null;
    }
    return this._vorg;
  }
  get sbix() {
    if (this._sbix === void 0) {
      const reader = this.getTableReader(Tags.sbix);
      this._sbix = reader ? parseSbix(reader, this.numGlyphs) : null;
    }
    return this._sbix;
  }
  get stat() {
    if (this._stat === void 0) {
      const reader = this.getTableReader(Tags.STAT);
      this._stat = reader ? parseStat(reader) : null;
    }
    return this._stat;
  }
  get cblc() {
    if (this._cblc === void 0) {
      const reader = this.getTableReader(Tags.CBLC);
      this._cblc = reader ? parseCblc(reader) : null;
    }
    return this._cblc;
  }
  get cbdt() {
    if (this._cbdt === void 0) {
      const reader = this.getTableReader(Tags.CBDT);
      this._cbdt = reader ? parseCbdt(reader) : null;
    }
    return this._cbdt;
  }
  get feat() {
    if (this._feat === void 0) {
      const reader = this.getTableReader(Tags.feat);
      this._feat = reader ? parseFeat(reader) : null;
    }
    return this._feat;
  }
  get fpgm() {
    if (this._fpgm === void 0) {
      const reader = this.getTableReader(Tags.fpgm);
      this._fpgm = reader ? parseFpgm(reader) : null;
    }
    return this._fpgm;
  }
  get prep() {
    if (this._prep === void 0) {
      const reader = this.getTableReader(Tags.prep);
      this._prep = reader ? parsePrep(reader) : null;
    }
    return this._prep;
  }
  get cvtTable() {
    if (this._cvt === void 0) {
      const reader = this.getTableReader(Tags.cvt);
      this._cvt = reader ? parseCvt(reader) : null;
    }
    return this._cvt;
  }
  get gasp() {
    if (this._gasp === void 0) {
      const reader = this.getTableReader(Tags.gasp);
      this._gasp = reader ? parseGasp(reader) : null;
    }
    return this._gasp;
  }
  // Convenience properties
  /** Number of glyphs in the font */
  get numGlyphs() {
    return this.maxp.numGlyphs;
  }
  /** Units per em */
  get unitsPerEm() {
    return this.head.unitsPerEm;
  }
  /** Ascender (from hhea) */
  get ascender() {
    return this.hhea.ascender;
  }
  /** Descender (from hhea) */
  get descender() {
    return this.hhea.descender;
  }
  /** Line gap (from hhea) */
  get lineGap() {
    return this.hhea.lineGap;
  }
  /** Is this a TrueType font (vs CFF)? */
  get isTrueType() {
    return isTrueType(this.directory);
  }
  /** Is this a CFF font? */
  get isCFF() {
    return this.hasTable(Tags.CFF) || this.hasTable(Tags.CFF2);
  }
  /** Is this a variable font? */
  get isVariable() {
    return this.hasTable(Tags.fvar);
  }
  /** Has OpenType layout tables? */
  get hasOpenTypeLayout() {
    return this.hasTable(Tags.GSUB) || this.hasTable(Tags.GPOS);
  }
  /** Has AAT layout tables? */
  get hasAATLayout() {
    return this.hasTable(Tags.morx) || this.hasTable(Tags.kerx);
  }
  /** Is this a color font? */
  get isColorFont() {
    return this.hasTable(Tags.COLR) || this.hasTable(Tags.SVG) || this.hasTable(Tags.sbix) || this.hasTable(Tags.CBDT);
  }
  /** Does this font have TrueType hinting? */
  get hasHinting() {
    return this.isTrueType && (this.hasTable(Tags.fpgm) || this.hasTable(Tags.prep));
  }
  // Glyph operations
  /** Get glyph ID for a Unicode codepoint */
  glyphId(codepoint) {
    return getGlyphId(this.cmap, codepoint);
  }
  /** Get glyph ID for a character */
  glyphIdForChar(char) {
    const codepoint = char.codePointAt(0);
    if (codepoint === void 0) return 0;
    return this.glyphId(codepoint);
  }
  /** Get advance width for a glyph */
  advanceWidth(glyphId) {
    return getAdvanceWidth(this.hmtx, glyphId);
  }
  /** Get left side bearing for a glyph */
  leftSideBearing(glyphId) {
    return getLeftSideBearing(this.hmtx, glyphId);
  }
  /** List all table tags in the font */
  listTables() {
    return Array.from(this.directory.tables.keys()).map(tagToString);
  }
  // Glyph outline operations
  /** Get raw glyph data (simple or composite) - TrueType only */
  getGlyph(glyphId) {
    if (!this.glyf || !this.loca) return null;
    return parseGlyph(this.glyf, this.loca, glyphId);
  }
  /** Get flattened contours for a glyph (resolves composites) */
  getGlyphContours(glyphId) {
    if (this.glyf && this.loca) {
      return getGlyphContours(this.glyf, this.loca, glyphId);
    }
    if (this.cff) {
      return executeCffCharString(this.cff, glyphId, 0);
    }
    if (this.cff2) {
      return executeCff2CharString(this.cff2, glyphId, null);
    }
    return null;
  }
  /** Get bounding box for a glyph */
  getGlyphBounds(glyphId) {
    if (this.glyf && this.loca) {
      return getGlyphBounds(this.glyf, this.loca, glyphId);
    }
    const contours = this.getGlyphContours(glyphId);
    if (!contours || contours.length === 0) return null;
    let xMin = Infinity;
    let yMin = Infinity;
    let xMax = -Infinity;
    let yMax = -Infinity;
    for (const contour of contours) {
      for (const point of contour) {
        xMin = Math.min(xMin, point.x);
        yMin = Math.min(yMin, point.y);
        xMax = Math.max(xMax, point.x);
        yMax = Math.max(yMax, point.y);
      }
    }
    if (xMin === Infinity) return null;
    return { xMin, yMin, xMax, yMax };
  }
  /** Get contours for a glyph with variation applied */
  getGlyphContoursWithVariation(glyphId, axisCoords) {
    if (this.glyf && this.loca) {
      return getGlyphContoursWithVariation(
        this.glyf,
        this.loca,
        this.gvar,
        glyphId,
        axisCoords
      );
    }
    if (this.cff2) {
      return executeCff2CharString(this.cff2, glyphId, axisCoords);
    }
    return this.getGlyphContours(glyphId);
  }
};

// src/layout/justify.ts
var JustifyMode = /* @__PURE__ */ ((JustifyMode2) => {
  JustifyMode2["Shrink"] = "shrink";
  JustifyMode2["Extend"] = "extend";
  JustifyMode2["Auto"] = "auto";
  return JustifyMode2;
})(JustifyMode || {});
function calculateLineWidth(buffer) {
  let width = 0;
  for (const pos of buffer.positions) {
    width += pos.xAdvance;
  }
  return width;
}
function justify(font, buffer, options) {
  const {
    targetWidth,
    script = tag("DFLT"),
    language,
    mode = "auto" /* Auto */,
    maxPriority = 10,
    enableKashida = true,
    minWordSpacingFactor = 0.8,
    maxWordSpacingFactor = 1.5,
    enableLetterSpacing = true,
    maxLetterSpacing = 100
  } = options;
  const currentWidth = calculateLineWidth(buffer);
  const delta = targetWidth - currentWidth;
  if (Math.abs(delta) < 1) {
    return {
      success: true,
      finalWidth: currentWidth,
      delta: 0,
      priorityLevel: 0,
      adjustments: []
    };
  }
  let actualMode;
  if (mode === "auto" /* Auto */) {
    actualMode = delta > 0 ? "extend" /* Extend */ : "shrink" /* Shrink */;
  } else {
    actualMode = mode;
  }
  const adjustments = [];
  let remainingDelta = delta;
  let priorityLevel = 0;
  const jstf = font.jstf;
  if (jstf) {
    const priorities = getJstfPriorities(jstf, script, language);
    for (let i = 0; i < Math.min(priorities.length, maxPriority); i++) {
      const priority = priorities[i];
      const mods = actualMode === "shrink" /* Shrink */ ? getShrinkageMods(priority) : getExtensionMods(priority);
      if (mods.enableGsub.length > 0 || mods.disableGsub.length > 0 || mods.enableGpos.length > 0 || mods.disableGpos.length > 0) {
        adjustments.push({
          type: "lookup",
          glyphIndices: [],
          value: i
        });
        priorityLevel = i;
      }
    }
    if (enableKashida && actualMode === "extend" /* Extend */) {
      const extenderGlyphs = getExtenderGlyphs(jstf, script);
      if (extenderGlyphs.length > 0) {
        const kashidaResult = insertKashida(
          buffer,
          extenderGlyphs[0],
          remainingDelta,
          font
        );
        remainingDelta -= kashidaResult.totalExtension;
        adjustments.push(...kashidaResult.adjustments);
      }
    }
  }
  const spaceGlyphId = font.glyphId(32);
  if (spaceGlyphId !== 0) {
    const spaceResult = adjustWordSpacing(
      buffer,
      spaceGlyphId,
      remainingDelta,
      actualMode === "shrink" /* Shrink */ ? minWordSpacingFactor : maxWordSpacingFactor
    );
    remainingDelta -= spaceResult.totalAdjustment;
    adjustments.push(...spaceResult.adjustments);
  }
  if (enableLetterSpacing && Math.abs(remainingDelta) > 1) {
    const letterResult = adjustLetterSpacing(
      buffer,
      remainingDelta,
      maxLetterSpacing
    );
    remainingDelta -= letterResult.totalAdjustment;
    adjustments.push(...letterResult.adjustments);
  }
  const finalWidth = calculateLineWidth(buffer);
  return {
    success: Math.abs(remainingDelta) < 1,
    finalWidth,
    delta: targetWidth - finalWidth,
    priorityLevel,
    adjustments
  };
}
function insertKashida(buffer, kashidaGlyph, targetExtension, font) {
  const adjustments = [];
  let totalExtension = 0;
  const insertionPoints = [];
  for (let i = 0; i < buffer.infos.length - 1; i++) {
    const info = buffer.infos[i];
    if (isValidKashidaPoint(info.codepoint)) {
      insertionPoints.push(i);
    }
  }
  if (insertionPoints.length === 0) {
    return { totalExtension: 0, adjustments: [] };
  }
  const kashidaWidth = font.advanceWidth(kashidaGlyph);
  if (kashidaWidth <= 0) {
    return { totalExtension: 0, adjustments: [] };
  }
  const kashidaPerPoint = Math.ceil(
    targetExtension / kashidaWidth / insertionPoints.length
  );
  const adjustmentPerPoint = Math.min(
    kashidaPerPoint * kashidaWidth,
    targetExtension / insertionPoints.length
  );
  for (const point of insertionPoints) {
    if (totalExtension >= targetExtension) break;
    buffer.positions[point].xAdvance += adjustmentPerPoint;
    totalExtension += adjustmentPerPoint;
    adjustments.push({
      type: "kashida",
      glyphIndices: [point],
      value: adjustmentPerPoint
    });
  }
  return { totalExtension, adjustments };
}
function isValidKashidaPoint(codepoint) {
  return codepoint >= 1568 && codepoint <= 1791;
}
function adjustWordSpacing(buffer, spaceGlyph, targetAdjustment, limitFactor) {
  const adjustments = [];
  let totalAdjustment = 0;
  const spaceIndices = [];
  let totalSpaceWidth = 0;
  for (let i = 0; i < buffer.infos.length; i++) {
    if (buffer.infos[i]?.glyphId === spaceGlyph) {
      spaceIndices.push(i);
      totalSpaceWidth += buffer.positions[i]?.xAdvance;
    }
  }
  if (spaceIndices.length === 0) {
    return { totalAdjustment: 0, adjustments: [] };
  }
  const adjustmentPerSpace = targetAdjustment / spaceIndices.length;
  const originalSpaceWidth = totalSpaceWidth / spaceIndices.length;
  const maxAdjustment = originalSpaceWidth * (limitFactor - 1);
  const clampedAdjustment = targetAdjustment > 0 ? Math.min(adjustmentPerSpace, maxAdjustment) : Math.max(adjustmentPerSpace, -maxAdjustment);
  for (const idx of spaceIndices) {
    buffer.positions[idx].xAdvance += clampedAdjustment;
    totalAdjustment += clampedAdjustment;
  }
  if (totalAdjustment !== 0) {
    adjustments.push({
      type: "spacing",
      glyphIndices: spaceIndices,
      value: clampedAdjustment
    });
  }
  return { totalAdjustment, adjustments };
}
function adjustLetterSpacing(buffer, targetAdjustment, maxAdjustment) {
  const adjustments = [];
  const numGlyphs = buffer.infos.length;
  if (numGlyphs <= 1) {
    return { totalAdjustment: 0, adjustments: [] };
  }
  const numGaps = numGlyphs - 1;
  const adjustmentPerGap = targetAdjustment / numGaps;
  const clampedAdjustment = targetAdjustment > 0 ? Math.min(adjustmentPerGap, maxAdjustment) : Math.max(adjustmentPerGap, -maxAdjustment);
  const affectedIndices = [];
  let totalAdjustment = 0;
  for (let i = 0; i < numGlyphs - 1; i++) {
    buffer.positions[i].xAdvance += clampedAdjustment;
    totalAdjustment += clampedAdjustment;
    affectedIndices.push(i);
  }
  if (totalAdjustment !== 0) {
    adjustments.push({
      type: "spacing",
      glyphIndices: affectedIndices,
      value: clampedAdjustment
    });
  }
  return { totalAdjustment, adjustments };
}
function breakIntoLines(buffer, maxWidth, spaceGlyph) {
  const lines = [];
  const breakPoints = [];
  if (buffer.infos.length === 0) {
    return { lines: [], breakPoints: [] };
  }
  let lineStart = 0;
  let currentWidth = 0;
  let lastBreakPoint = -1;
  let _lastBreakWidth = 0;
  for (let i = 0; i < buffer.infos.length; i++) {
    const pos = buffer.positions[i];
    const info = buffer.infos[i];
    currentWidth += pos.xAdvance;
    if (spaceGlyph !== void 0 && info.glyphId === spaceGlyph) {
      lastBreakPoint = i;
      _lastBreakWidth = currentWidth;
    }
    if (currentWidth > maxWidth && lineStart < i) {
      let breakAt;
      if (lastBreakPoint > lineStart) {
        breakAt = lastBreakPoint + 1;
      } else {
        breakAt = i;
      }
      const lineBuffer = createLineBuffer(buffer, lineStart, breakAt);
      lines.push(lineBuffer);
      breakPoints.push(breakAt);
      lineStart = breakAt;
      currentWidth = 0;
      lastBreakPoint = -1;
      for (let j = lineStart; j <= i; j++) {
        currentWidth += buffer.positions[j]?.xAdvance;
      }
    }
  }
  if (lineStart < buffer.infos.length) {
    const lineBuffer = createLineBuffer(buffer, lineStart, buffer.infos.length);
    lines.push(lineBuffer);
  }
  return { lines, breakPoints };
}
function createLineBuffer(source, start, end) {
  const lineBuffer = new GlyphBuffer();
  lineBuffer.direction = source.direction;
  lineBuffer.script = source.script;
  lineBuffer.language = source.language;
  for (let i = start; i < end; i++) {
    lineBuffer.infos.push({ ...source.infos[i] });
    lineBuffer.positions.push({ ...source.positions[i] });
  }
  return lineBuffer;
}
function justifyParagraph(font, lines, options) {
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    if (isLastLine) {
      results.push({
        success: true,
        finalWidth: calculateLineWidth(line),
        delta: 0,
        priorityLevel: 0,
        adjustments: []
      });
    } else {
      results.push(justify(font, line, options));
    }
  }
  return results;
}

// src/layout/structures/feature-variations.ts
function evaluateConditionSet(conditionSet, axisCoords) {
  for (const condition of conditionSet.conditions) {
    const axisValue = axisCoords[condition.axisIndex] ?? 0;
    if (axisValue < condition.filterRangeMinValue || axisValue > condition.filterRangeMaxValue) {
      return false;
    }
  }
  return true;
}
function findMatchingFeatureVariation(featureVariations, axisCoords) {
  for (const record of featureVariations.featureVariationRecords) {
    if (evaluateConditionSet(record.conditionSet, axisCoords)) {
      return record;
    }
  }
  return null;
}
function getSubstitutedLookups(featureVariations, featureIndex, originalLookups, axisCoords) {
  if (!featureVariations || !axisCoords) {
    return originalLookups;
  }
  const matchingRecord = findMatchingFeatureVariation(
    featureVariations,
    axisCoords
  );
  if (!matchingRecord) {
    return originalLookups;
  }
  const substitution = matchingRecord.featureTableSubstitution.substitutions.find(
    (s) => s.featureIndex === featureIndex
  );
  if (substitution) {
    return substitution.alternateFeature.lookupListIndices;
  }
  return originalLookups;
}
function applyFeatureVariations(featureVariations, featureLookups, featureIndices, axisCoords) {
  if (!featureVariations || !axisCoords) {
    return featureLookups;
  }
  const matchingRecord = findMatchingFeatureVariation(
    featureVariations,
    axisCoords
  );
  if (!matchingRecord) {
    return featureLookups;
  }
  const result = new Map(featureLookups);
  for (const substitution of matchingRecord.featureTableSubstitution.substitutions) {
    for (const [tag2, index] of featureIndices) {
      if (index === substitution.featureIndex) {
        result.set(tag2, substitution.alternateFeature.lookupListIndices);
        break;
      }
    }
  }
  return result;
}

// src/render/path.ts
function contourToPath(contour) {
  if (contour.length === 0) return [];
  const commands = [];
  const hasCubic = contour.some((p) => p.cubic);
  if (hasCubic) {
    return contourToPathCubic(contour);
  }
  return contourToPathQuadratic(contour);
}
function contourToPathCubic(contour) {
  if (contour.length === 0) return [];
  const commands = [];
  let i = 0;
  const first = contour[0];
  if (!first) return [];
  commands.push({ type: "M", x: first.x, y: first.y });
  i = 1;
  while (i < contour.length) {
    const point = contour[i];
    if (!point) break;
    if (point.onCurve) {
      commands.push({ type: "L", x: point.x, y: point.y });
      i++;
    } else if (point.cubic) {
      const cp1 = point;
      const cp2 = contour[i + 1];
      const end = contour[i + 2];
      if (!cp2 || !end) {
        i++;
        continue;
      }
      commands.push({
        type: "C",
        x1: cp1.x,
        y1: cp1.y,
        x2: cp2.x,
        y2: cp2.y,
        x: end.x,
        y: end.y
      });
      i += 3;
    } else {
      const cp = point;
      const next = contour[i + 1];
      if (!next) {
        i++;
        continue;
      }
      let endPoint;
      if (next.onCurve) {
        endPoint = next;
        i += 2;
      } else {
        endPoint = {
          x: (cp.x + next.x) / 2,
          y: (cp.y + next.y) / 2,
          onCurve: true
        };
        i++;
      }
      commands.push({
        type: "Q",
        x1: cp.x,
        y1: cp.y,
        x: endPoint.x,
        y: endPoint.y
      });
    }
  }
  commands.push({ type: "Z" });
  return commands;
}
function contourToPathQuadratic(contour) {
  if (contour.length === 0) return [];
  const commands = [];
  let startIndex = 0;
  for (const [i2, point] of contour.entries()) {
    if (point.onCurve) {
      startIndex = i2;
      break;
    }
  }
  const allOffCurve = contour.every((p) => !p.onCurve);
  let startPoint;
  if (allOffCurve) {
    const first = contour[0];
    const last = contour[contour.length - 1];
    if (!first || !last) return [];
    startPoint = {
      x: (first.x + last.x) / 2,
      y: (first.y + last.y) / 2,
      onCurve: true
    };
    startIndex = 0;
  } else {
    const point = contour[startIndex];
    if (!point) return [];
    startPoint = point;
  }
  commands.push({ type: "M", x: startPoint.x, y: startPoint.y });
  const n = contour.length;
  let i = allOffCurve ? 0 : (startIndex + 1) % n;
  let current = startPoint;
  let iterations = 0;
  while (iterations < n) {
    const point = contour[i];
    if (!point) break;
    if (point.onCurve) {
      commands.push({ type: "L", x: point.x, y: point.y });
      current = point;
    } else {
      const nextIndex = (i + 1) % n;
      const nextPoint = contour[nextIndex];
      if (!nextPoint) break;
      let endPoint;
      if (nextPoint.onCurve) {
        endPoint = nextPoint;
        i = nextIndex;
        iterations++;
      } else {
        endPoint = {
          x: (point.x + nextPoint.x) / 2,
          y: (point.y + nextPoint.y) / 2,
          onCurve: true
        };
      }
      commands.push({
        type: "Q",
        x1: point.x,
        y1: point.y,
        x: endPoint.x,
        y: endPoint.y
      });
      current = endPoint;
    }
    i = (i + 1) % n;
    iterations++;
    if (current.x === startPoint.x && current.y === startPoint.y) {
      break;
    }
  }
  commands.push({ type: "Z" });
  return commands;
}
function getGlyphPath(font, glyphId) {
  const contours = font.getGlyphContours(glyphId);
  if (!contours) return null;
  const commands = [];
  for (const contour of contours) {
    commands.push(...contourToPath(contour));
  }
  const bounds = font.getGlyphBounds(glyphId);
  return { commands, bounds };
}
function pathToSVG(path, options) {
  const scale = options?.scale ?? 1;
  const flipY = options?.flipY ?? true;
  const parts = [];
  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M":
        parts.push(
          `M ${cmd.x * scale} ${flipY ? -cmd.y * scale : cmd.y * scale}`
        );
        break;
      case "L":
        parts.push(
          `L ${cmd.x * scale} ${flipY ? -cmd.y * scale : cmd.y * scale}`
        );
        break;
      case "Q":
        parts.push(
          `Q ${cmd.x1 * scale} ${flipY ? -cmd.y1 * scale : cmd.y1 * scale} ${cmd.x * scale} ${flipY ? -cmd.y * scale : cmd.y * scale}`
        );
        break;
      case "C":
        parts.push(
          `C ${cmd.x1 * scale} ${flipY ? -cmd.y1 * scale : cmd.y1 * scale} ${cmd.x2 * scale} ${flipY ? -cmd.y2 * scale : cmd.y2 * scale} ${cmd.x * scale} ${flipY ? -cmd.y * scale : cmd.y * scale}`
        );
        break;
      case "Z":
        parts.push("Z");
        break;
    }
  }
  return parts.join(" ");
}
function pathToCanvas(ctx, path, options) {
  const scale = options?.scale ?? 1;
  const flipY = options?.flipY ?? true;
  const offsetX = options?.offsetX ?? 0;
  const offsetY = options?.offsetY ?? 0;
  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M":
        ctx.moveTo(
          cmd.x * scale + offsetX,
          (flipY ? -cmd.y : cmd.y) * scale + offsetY
        );
        break;
      case "L":
        ctx.lineTo(
          cmd.x * scale + offsetX,
          (flipY ? -cmd.y : cmd.y) * scale + offsetY
        );
        break;
      case "Q":
        ctx.quadraticCurveTo(
          cmd.x1 * scale + offsetX,
          (flipY ? -cmd.y1 : cmd.y1) * scale + offsetY,
          cmd.x * scale + offsetX,
          (flipY ? -cmd.y : cmd.y) * scale + offsetY
        );
        break;
      case "C":
        ctx.bezierCurveTo(
          cmd.x1 * scale + offsetX,
          (flipY ? -cmd.y1 : cmd.y1) * scale + offsetY,
          cmd.x2 * scale + offsetX,
          (flipY ? -cmd.y2 : cmd.y2) * scale + offsetY,
          cmd.x * scale + offsetX,
          (flipY ? -cmd.y : cmd.y) * scale + offsetY
        );
        break;
      case "Z":
        ctx.closePath();
        break;
    }
  }
}
function glyphToSVG(font, glyphId, options) {
  const path = getGlyphPath(font, glyphId);
  if (!path) return null;
  const fontSize = options?.fontSize ?? 100;
  const fill = options?.fill ?? "currentColor";
  const scale = fontSize / font.unitsPerEm;
  const bounds = path.bounds;
  if (!bounds) return null;
  const width = Math.ceil((bounds.xMax - bounds.xMin) * scale);
  const height = Math.ceil((bounds.yMax - bounds.yMin) * scale);
  const viewBox = `${bounds.xMin} ${-bounds.yMax} ${bounds.xMax - bounds.xMin} ${bounds.yMax - bounds.yMin}`;
  const pathData = pathToSVG(path, { flipY: true, scale: 1 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${pathData}" fill="${fill}"/>
</svg>`;
}
function renderShapedText(ctx, font, glyphs, options) {
  const fontSize = options?.fontSize ?? 16;
  const startX = options?.x ?? 0;
  const startY = options?.y ?? 0;
  const fill = options?.fill ?? "black";
  const scale = fontSize / font.unitsPerEm;
  ctx.fillStyle = fill;
  let x = startX;
  let y = startY;
  for (const glyph of glyphs) {
    const path = getGlyphPath(font, glyph.glyphId);
    if (path) {
      ctx.beginPath();
      pathToCanvas(ctx, path, {
        scale,
        flipY: true,
        offsetX: x + glyph.xOffset * scale,
        offsetY: y - glyph.yOffset * scale
      });
      ctx.fill();
    }
    x += glyph.xAdvance * scale;
    y += glyph.yAdvance * scale;
  }
}
function shapedTextToSVG(font, glyphs, options) {
  const fontSize = options?.fontSize ?? 100;
  const fill = options?.fill ?? "currentColor";
  const scale = fontSize / font.unitsPerEm;
  const paths = [];
  let x = 0;
  let y = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const glyph of glyphs) {
    const path = getGlyphPath(font, glyph.glyphId);
    if (path?.bounds) {
      const offsetX = x + glyph.xOffset * scale;
      const offsetY = y - glyph.yOffset * scale;
      const transformedCommands = path.commands.map((cmd) => {
        switch (cmd.type) {
          case "M":
          case "L":
            return {
              type: cmd.type,
              x: cmd.x * scale + offsetX,
              y: -cmd.y * scale + offsetY
            };
          case "Q":
            return {
              type: "Q",
              x1: cmd.x1 * scale + offsetX,
              y1: -cmd.y1 * scale + offsetY,
              x: cmd.x * scale + offsetX,
              y: -cmd.y * scale + offsetY
            };
          case "C":
            return {
              type: "C",
              x1: cmd.x1 * scale + offsetX,
              y1: -cmd.y1 * scale + offsetY,
              x2: cmd.x2 * scale + offsetX,
              y2: -cmd.y2 * scale + offsetY,
              x: cmd.x * scale + offsetX,
              y: -cmd.y * scale + offsetY
            };
          case "Z":
            return { type: "Z" };
          default:
            return cmd;
        }
      });
      const pathStr = pathToSVG(
        { commands: transformedCommands, bounds: null },
        { flipY: false, scale: 1 }
      );
      paths.push(pathStr);
      const b = path.bounds;
      minX = Math.min(minX, offsetX + b.xMin * scale);
      maxX = Math.max(maxX, offsetX + b.xMax * scale);
      minY = Math.min(minY, offsetY - b.yMax * scale);
      maxY = Math.max(maxY, offsetY - b.yMin * scale);
    }
    x += glyph.xAdvance * scale;
    y += glyph.yAdvance * scale;
  }
  if (paths.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  }
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);
  const viewBox = `${Math.floor(minX)} ${Math.floor(minY)} ${width} ${height}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${paths.join(" ")}" fill="${fill}"/>
</svg>`;
}
function glyphBufferToShapedGlyphs(buffer) {
  const result = [];
  for (const [i, info] of buffer.infos.entries()) {
    const pos = buffer.positions[i];
    if (!pos) continue;
    result.push({
      glyphId: info.glyphId,
      xOffset: pos.xOffset,
      yOffset: pos.yOffset,
      xAdvance: pos.xAdvance,
      yAdvance: pos.yAdvance
    });
  }
  return result;
}
function getGlyphPathWithVariation(font, glyphId, axisCoords) {
  const contours = font.getGlyphContoursWithVariation(glyphId, axisCoords);
  if (!contours) return null;
  const commands = [];
  for (const contour of contours) {
    commands.push(...contourToPath(contour));
  }
  const bounds = font.getGlyphBounds(glyphId);
  return { commands, bounds };
}
function renderShapedTextWithVariation(ctx, font, glyphs, axisCoords, options) {
  const fontSize = options?.fontSize ?? 16;
  const startX = options?.x ?? 0;
  const startY = options?.y ?? 0;
  const fill = options?.fill ?? "black";
  const scale = fontSize / font.unitsPerEm;
  ctx.fillStyle = fill;
  let x = startX;
  let y = startY;
  for (const glyph of glyphs) {
    const path = getGlyphPathWithVariation(font, glyph.glyphId, axisCoords);
    if (path) {
      ctx.beginPath();
      pathToCanvas(ctx, path, {
        scale,
        flipY: true,
        offsetX: x + glyph.xOffset * scale,
        offsetY: y - glyph.yOffset * scale
      });
      ctx.fill();
    }
    x += glyph.xAdvance * scale;
    y += glyph.yAdvance * scale;
  }
}
function shapedTextToSVGWithVariation(font, glyphs, axisCoords, options) {
  const fontSize = options?.fontSize ?? 100;
  const fill = options?.fill ?? "currentColor";
  const scale = fontSize / font.unitsPerEm;
  const paths = [];
  let x = 0;
  let y = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const glyph of glyphs) {
    const path = getGlyphPathWithVariation(font, glyph.glyphId, axisCoords);
    if (path?.bounds) {
      const offsetX = x + glyph.xOffset * scale;
      const offsetY = y - glyph.yOffset * scale;
      const transformedCommands = path.commands.map((cmd) => {
        switch (cmd.type) {
          case "M":
          case "L":
            return {
              type: cmd.type,
              x: cmd.x * scale + offsetX,
              y: -cmd.y * scale + offsetY
            };
          case "Q":
            return {
              type: "Q",
              x1: cmd.x1 * scale + offsetX,
              y1: -cmd.y1 * scale + offsetY,
              x: cmd.x * scale + offsetX,
              y: -cmd.y * scale + offsetY
            };
          case "C":
            return {
              type: "C",
              x1: cmd.x1 * scale + offsetX,
              y1: -cmd.y1 * scale + offsetY,
              x2: cmd.x2 * scale + offsetX,
              y2: -cmd.y2 * scale + offsetY,
              x: cmd.x * scale + offsetX,
              y: -cmd.y * scale + offsetY
            };
          case "Z":
            return { type: "Z" };
          default:
            return cmd;
        }
      });
      const pathStr = pathToSVG(
        { commands: transformedCommands, bounds: null },
        { flipY: false, scale: 1 }
      );
      paths.push(pathStr);
      const b = path.bounds;
      minX = Math.min(minX, offsetX + b.xMin * scale);
      maxX = Math.max(maxX, offsetX + b.xMax * scale);
      minY = Math.min(minY, offsetY - b.yMax * scale);
      maxY = Math.max(maxY, offsetY - b.yMin * scale);
    }
    x += glyph.xAdvance * scale;
    y += glyph.yAdvance * scale;
  }
  if (paths.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  }
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);
  const viewBox = `${Math.floor(minX)} ${Math.floor(minY)} ${width} ${height}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${paths.join(" ")}" fill="${fill}"/>
</svg>`;
}
function getTextWidth(glyphs, font, fontSize) {
  const scale = fontSize / font.unitsPerEm;
  let width = 0;
  for (const glyph of glyphs) {
    width += glyph.xAdvance;
  }
  return width * scale;
}
function createPath2D(path, options) {
  const p = new Path2D();
  pathToCanvas(p, path, options);
  return p;
}

// src/unicode/normalize.ts
var NormalizationMode = /* @__PURE__ */ ((NormalizationMode2) => {
  NormalizationMode2[NormalizationMode2["None"] = 0] = "None";
  NormalizationMode2[NormalizationMode2["Decompose"] = 1] = "Decompose";
  NormalizationMode2[NormalizationMode2["Compose"] = 2] = "Compose";
  NormalizationMode2[NormalizationMode2["Auto"] = 3] = "Auto";
  return NormalizationMode2;
})(NormalizationMode || {});
function getCombiningClass(cp) {
  if (cp >= 1425 && cp <= 1469) return getHebrewCcc(cp);
  if (cp === 1471) return 23;
  if (cp === 1473) return 24;
  if (cp === 1474) return 25;
  if (cp === 1476) return 230;
  if (cp === 1477) return 220;
  if (cp === 1479) return 18;
  if (cp >= 1611 && cp <= 1631) return getArabicCcc(cp);
  if (cp === 1648) return 35;
  if (cp >= 1552 && cp <= 1562) return 230;
  if (cp >= 1750 && cp <= 1756) return 230;
  if (cp >= 1759 && cp <= 1764) return 230;
  if (cp >= 1767 && cp <= 1768) return 230;
  if (cp >= 1770 && cp <= 1773) return 220;
  if (cp === 2260) return 230;
  if (cp >= 2275 && cp <= 2303) return 220;
  if (cp === 2364) return 7;
  if (cp === 2381) return 9;
  if (cp >= 2385 && cp <= 2388) return 230;
  if (cp === 2389) return 0;
  if (cp >= 2390 && cp <= 2391) return 0;
  if (cp === 2492) return 7;
  if (cp === 2509) return 9;
  if (cp === 2558) return 230;
  if (cp === 2620) return 7;
  if (cp === 2637) return 9;
  if (cp === 2748) return 7;
  if (cp === 2765) return 9;
  if (cp === 2876) return 7;
  if (cp === 2893) return 9;
  if (cp === 3021) return 9;
  if (cp === 3149) return 9;
  if (cp === 3157) return 84;
  if (cp === 3158) return 91;
  if (cp === 3260) return 7;
  if (cp === 3277) return 9;
  if (cp === 3405) return 9;
  if (cp === 3530) return 9;
  if (cp >= 3633 && cp <= 3642) return 0;
  if (cp >= 3655 && cp <= 3662) return getThaiCcc(cp);
  if (cp >= 3761 && cp <= 3772) return 0;
  if (cp >= 3784 && cp <= 3789) return getThaiCcc(cp);
  if (cp >= 3864 && cp <= 3865) return 220;
  if (cp === 3893) return 220;
  if (cp === 3895) return 220;
  if (cp === 3897) return 216;
  if (cp >= 3953 && cp <= 3966) return getTibetanCcc(cp);
  if (cp >= 3968 && cp <= 3972) return getTibetanCcc(cp);
  if (cp >= 3974 && cp <= 3975) return 230;
  if (cp === 4151) return 7;
  if (cp === 4153) return 9;
  if (cp === 4154) return 9;
  if (cp >= 12330 && cp <= 12335) return getHangulCcc(cp);
  if (cp >= 12441 && cp <= 12442) return 8;
  if (cp >= 768 && cp <= 879) return getLatinCcc(cp);
  if (cp >= 6832 && cp <= 6911) return getCdmeClass(cp);
  if (cp >= 7616 && cp <= 7679) return getCdmsClass(cp);
  if (cp >= 65056 && cp <= 65071) return 230;
  return 0;
}
function getThaiCcc(cp) {
  if (cp >= 3656 && cp <= 3659) return 107;
  if (cp === 3660) return 0;
  if (cp === 3661) return 0;
  if (cp === 3662) return 0;
  if (cp >= 3784 && cp <= 3787) return 122;
  return 0;
}
function getTibetanCcc(cp) {
  if (cp === 3953) return 129;
  if (cp === 3954) return 130;
  if (cp === 3955) return 0;
  if (cp === 3956) return 132;
  if (cp === 3957) return 0;
  if (cp === 3958) return 0;
  if (cp === 3959) return 0;
  if (cp === 3960) return 0;
  if (cp === 3961) return 0;
  if (cp === 3962) return 130;
  if (cp === 3963) return 130;
  if (cp === 3964) return 130;
  if (cp === 3965) return 130;
  if (cp === 3966) return 0;
  if (cp === 3968) return 130;
  if (cp === 3969) return 0;
  if (cp === 3970) return 230;
  if (cp === 3971) return 230;
  if (cp === 3972) return 9;
  return 0;
}
function getHangulCcc(cp) {
  if (cp === 12330) return 218;
  if (cp === 12331) return 228;
  if (cp === 12332) return 232;
  if (cp === 12333) return 222;
  if (cp === 12334) return 224;
  if (cp === 12335) return 224;
  return 0;
}
function getCdmeClass(cp) {
  if (cp >= 6832 && cp <= 6846) return 230;
  if (cp === 6847) return 220;
  if (cp === 6848) return 220;
  return 230;
}
function getCdmsClass(cp) {
  if (cp >= 7616 && cp <= 7617) return 230;
  if (cp === 7618) return 220;
  if (cp >= 7619 && cp <= 7626) return 230;
  if (cp === 7627) return 230;
  if (cp === 7628) return 230;
  if (cp === 7629) return 234;
  if (cp === 7630) return 214;
  if (cp === 7631) return 220;
  if (cp === 7632) return 202;
  if (cp >= 7633 && cp <= 7669) return 230;
  if (cp >= 7670 && cp <= 7672) return 232;
  if (cp === 7673) return 220;
  if (cp === 7674) return 218;
  if (cp >= 7675 && cp <= 7679) return 230;
  return 230;
}
function getHebrewCcc(cp) {
  if (cp >= 1425 && cp <= 1441) return 220;
  if (cp >= 1442 && cp <= 1455) return 230;
  if (cp >= 1456 && cp <= 1465) {
    if (cp === 1456) return 10;
    if (cp === 1457) return 11;
    if (cp === 1458) return 12;
    if (cp === 1459) return 13;
    if (cp === 1460) return 14;
    if (cp === 1461) return 15;
    if (cp === 1462) return 16;
    if (cp === 1463) return 17;
    if (cp === 1464) return 18;
    if (cp === 1465) return 19;
  }
  if (cp === 1466) return 19;
  if (cp === 1467) return 20;
  if (cp === 1468) return 21;
  if (cp === 1469) return 22;
  return 0;
}
function getArabicCcc(cp) {
  if (cp === 1611) return 27;
  if (cp === 1612) return 28;
  if (cp === 1613) return 29;
  if (cp === 1614) return 30;
  if (cp === 1615) return 31;
  if (cp === 1616) return 32;
  if (cp === 1617) return 33;
  if (cp === 1618) return 34;
  if (cp >= 1619 && cp <= 1621) return 230;
  if (cp === 1622) return 220;
  if (cp === 1623) return 230;
  if (cp === 1624) return 230;
  if (cp >= 1625 && cp <= 1631) return 230;
  return 0;
}
function getLatinCcc(cp) {
  if (cp >= 768 && cp <= 788) return 230;
  if (cp >= 789 && cp <= 789) return 232;
  if (cp >= 790 && cp <= 793) return 220;
  if (cp >= 794 && cp <= 794) return 232;
  if (cp >= 795 && cp <= 795) return 216;
  if (cp >= 796 && cp <= 800) return 220;
  if (cp >= 801 && cp <= 802) return 202;
  if (cp >= 803 && cp <= 806) return 220;
  if (cp >= 807 && cp <= 808) return 202;
  if (cp >= 809 && cp <= 819) return 220;
  if (cp >= 820 && cp <= 824) return 1;
  if (cp >= 825 && cp <= 828) return 220;
  if (cp >= 829 && cp <= 836) return 230;
  if (cp === 837) return 240;
  if (cp >= 838 && cp <= 846) return 230;
  if (cp === 847) return 0;
  if (cp >= 848 && cp <= 850) return 230;
  if (cp >= 851 && cp <= 854) return 220;
  if (cp >= 855 && cp <= 856) return 230;
  if (cp >= 857 && cp <= 858) return 220;
  if (cp >= 859 && cp <= 859) return 230;
  if (cp >= 860 && cp <= 860) return 233;
  if (cp >= 861 && cp <= 862) return 234;
  if (cp >= 863 && cp <= 863) return 233;
  if (cp >= 864 && cp <= 865) return 234;
  if (cp >= 866 && cp <= 866) return 233;
  if (cp >= 867 && cp <= 879) return 230;
  return 0;
}
function reorderMarks(infos) {
  const n = infos.length;
  let i = 1;
  while (i < n) {
    const info = infos[i];
    if (!info) {
      i++;
      continue;
    }
    const ccc = getCombiningClass(info.codepoint);
    if (ccc === 0) {
      i++;
      continue;
    }
    let j = i;
    while (j > 0) {
      const prevInfo = infos[j - 1];
      if (!prevInfo) break;
      const prevCcc = getCombiningClass(prevInfo.codepoint);
      if (prevCcc === 0) break;
      if (prevCcc <= ccc) break;
      infos[j] = prevInfo;
      infos[j - 1] = info;
      j--;
    }
    i++;
  }
}
var DECOMPOSITIONS = /* @__PURE__ */ new Map([
  // Latin precomposed characters (Latin-1 Supplement)
  [192, [65, 768]],
  // À = A + grave
  [193, [65, 769]],
  // Á = A + acute
  [194, [65, 770]],
  // Â = A + circumflex
  [195, [65, 771]],
  // Ã = A + tilde
  [196, [65, 776]],
  // Ä = A + diaeresis
  [197, [65, 778]],
  // Å = A + ring
  [199, [67, 807]],
  // Ç = C + cedilla
  [200, [69, 768]],
  // È = E + grave
  [201, [69, 769]],
  // É = E + acute
  [202, [69, 770]],
  // Ê = E + circumflex
  [203, [69, 776]],
  // Ë = E + diaeresis
  [204, [73, 768]],
  // Ì = I + grave
  [205, [73, 769]],
  // Í = I + acute
  [206, [73, 770]],
  // Î = I + circumflex
  [207, [73, 776]],
  // Ï = I + diaeresis
  [209, [78, 771]],
  // Ñ = N + tilde
  [210, [79, 768]],
  // Ò = O + grave
  [211, [79, 769]],
  // Ó = O + acute
  [212, [79, 770]],
  // Ô = O + circumflex
  [213, [79, 771]],
  // Õ = O + tilde
  [214, [79, 776]],
  // Ö = O + diaeresis
  [217, [85, 768]],
  // Ù = U + grave
  [218, [85, 769]],
  // Ú = U + acute
  [219, [85, 770]],
  // Û = U + circumflex
  [220, [85, 776]],
  // Ü = U + diaeresis
  [221, [89, 769]],
  // Ý = Y + acute
  // Lowercase Latin-1
  [224, [97, 768]],
  // à = a + grave
  [225, [97, 769]],
  // á = a + acute
  [226, [97, 770]],
  // â = a + circumflex
  [227, [97, 771]],
  // ã = a + tilde
  [228, [97, 776]],
  // ä = a + diaeresis
  [229, [97, 778]],
  // å = a + ring
  [231, [99, 807]],
  // ç = c + cedilla
  [232, [101, 768]],
  // è = e + grave
  [233, [101, 769]],
  // é = e + acute
  [234, [101, 770]],
  // ê = e + circumflex
  [235, [101, 776]],
  // ë = e + diaeresis
  [236, [105, 768]],
  // ì = i + grave
  [237, [105, 769]],
  // í = i + acute
  [238, [105, 770]],
  // î = i + circumflex
  [239, [105, 776]],
  // ï = i + diaeresis
  [241, [110, 771]],
  // ñ = n + tilde
  [242, [111, 768]],
  // ò = o + grave
  [243, [111, 769]],
  // ó = o + acute
  [244, [111, 770]],
  // ô = o + circumflex
  [245, [111, 771]],
  // õ = o + tilde
  [246, [111, 776]],
  // ö = o + diaeresis
  [249, [117, 768]],
  // ù = u + grave
  [250, [117, 769]],
  // ú = u + acute
  [251, [117, 770]],
  // û = u + circumflex
  [252, [117, 776]],
  // ü = u + diaeresis
  [253, [121, 769]],
  // ý = y + acute
  [255, [121, 776]],
  // ÿ = y + diaeresis
  // Latin Extended-A
  [256, [65, 772]],
  // Ā = A + macron
  [257, [97, 772]],
  // ā = a + macron
  [258, [65, 774]],
  // Ă = A + breve
  [259, [97, 774]],
  // ă = a + breve
  [260, [65, 808]],
  // Ą = A + ogonek
  [261, [97, 808]],
  // ą = a + ogonek
  [262, [67, 769]],
  // Ć = C + acute
  [263, [99, 769]],
  // ć = c + acute
  [264, [67, 770]],
  // Ĉ = C + circumflex
  [265, [99, 770]],
  // ĉ = c + circumflex
  [266, [67, 775]],
  // Ċ = C + dot above
  [267, [99, 775]],
  // ċ = c + dot above
  [268, [67, 780]],
  // Č = C + caron
  [269, [99, 780]],
  // č = c + caron
  [270, [68, 780]],
  // Ď = D + caron
  [271, [100, 780]],
  // ď = d + caron
  [274, [69, 772]],
  // Ē = E + macron
  [275, [101, 772]],
  // ē = e + macron
  [276, [69, 774]],
  // Ĕ = E + breve
  [277, [101, 774]],
  // ĕ = e + breve
  [278, [69, 775]],
  // Ė = E + dot above
  [279, [101, 775]],
  // ė = e + dot above
  [280, [69, 808]],
  // Ę = E + ogonek
  [281, [101, 808]],
  // ę = e + ogonek
  [282, [69, 780]],
  // Ě = E + caron
  [283, [101, 780]],
  // ě = e + caron
  [284, [71, 770]],
  // Ĝ = G + circumflex
  [285, [103, 770]],
  // ĝ = g + circumflex
  [286, [71, 774]],
  // Ğ = G + breve
  [287, [103, 774]],
  // ğ = g + breve
  [288, [71, 775]],
  // Ġ = G + dot above
  [289, [103, 775]],
  // ġ = g + dot above
  [290, [71, 807]],
  // Ģ = G + cedilla
  [291, [103, 807]],
  // ģ = g + cedilla
  [292, [72, 770]],
  // Ĥ = H + circumflex
  [293, [104, 770]],
  // ĥ = h + circumflex
  [296, [73, 771]],
  // Ĩ = I + tilde
  [297, [105, 771]],
  // ĩ = i + tilde
  [298, [73, 772]],
  // Ī = I + macron
  [299, [105, 772]],
  // ī = i + macron
  [300, [73, 774]],
  // Ĭ = I + breve
  [301, [105, 774]],
  // ĭ = i + breve
  [302, [73, 808]],
  // Į = I + ogonek
  [303, [105, 808]],
  // į = i + ogonek
  [304, [73, 775]],
  // İ = I + dot above
  [308, [74, 770]],
  // Ĵ = J + circumflex
  [309, [106, 770]],
  // ĵ = j + circumflex
  [310, [75, 807]],
  // Ķ = K + cedilla
  [311, [107, 807]],
  // ķ = k + cedilla
  [313, [76, 769]],
  // Ĺ = L + acute
  [314, [108, 769]],
  // ĺ = l + acute
  [315, [76, 807]],
  // Ļ = L + cedilla
  [316, [108, 807]],
  // ļ = l + cedilla
  [317, [76, 780]],
  // Ľ = L + caron
  [318, [108, 780]],
  // ľ = l + caron
  [323, [78, 769]],
  // Ń = N + acute
  [324, [110, 769]],
  // ń = n + acute
  [325, [78, 807]],
  // Ņ = N + cedilla
  [326, [110, 807]],
  // ņ = n + cedilla
  [327, [78, 780]],
  // Ň = N + caron
  [328, [110, 780]],
  // ň = n + caron
  [332, [79, 772]],
  // Ō = O + macron
  [333, [111, 772]],
  // ō = o + macron
  [334, [79, 774]],
  // Ŏ = O + breve
  [335, [111, 774]],
  // ŏ = o + breve
  [336, [79, 779]],
  // Ő = O + double acute
  [337, [111, 779]],
  // ő = o + double acute
  [340, [82, 769]],
  // Ŕ = R + acute
  [341, [114, 769]],
  // ŕ = r + acute
  [342, [82, 807]],
  // Ŗ = R + cedilla
  [343, [114, 807]],
  // ŗ = r + cedilla
  [344, [82, 780]],
  // Ř = R + caron
  [345, [114, 780]],
  // ř = r + caron
  [346, [83, 769]],
  // Ś = S + acute
  [347, [115, 769]],
  // ś = s + acute
  [348, [83, 770]],
  // Ŝ = S + circumflex
  [349, [115, 770]],
  // ŝ = s + circumflex
  [350, [83, 807]],
  // Ş = S + cedilla
  [351, [115, 807]],
  // ş = s + cedilla
  [352, [83, 780]],
  // Š = S + caron
  [353, [115, 780]],
  // š = s + caron
  [354, [84, 807]],
  // Ţ = T + cedilla
  [355, [116, 807]],
  // ţ = t + cedilla
  [356, [84, 780]],
  // Ť = T + caron
  [357, [116, 780]],
  // ť = t + caron
  [360, [85, 771]],
  // Ũ = U + tilde
  [361, [117, 771]],
  // ũ = u + tilde
  [362, [85, 772]],
  // Ū = U + macron
  [363, [117, 772]],
  // ū = u + macron
  [364, [85, 774]],
  // Ŭ = U + breve
  [365, [117, 774]],
  // ŭ = u + breve
  [366, [85, 778]],
  // Ů = U + ring
  [367, [117, 778]],
  // ů = u + ring
  [368, [85, 779]],
  // Ű = U + double acute
  [369, [117, 779]],
  // ű = u + double acute
  [370, [85, 808]],
  // Ų = U + ogonek
  [371, [117, 808]],
  // ų = u + ogonek
  [372, [87, 770]],
  // Ŵ = W + circumflex
  [373, [119, 770]],
  // ŵ = w + circumflex
  [374, [89, 770]],
  // Ŷ = Y + circumflex
  [375, [121, 770]],
  // ŷ = y + circumflex
  [376, [89, 776]],
  // Ÿ = Y + diaeresis
  [377, [90, 769]],
  // Ź = Z + acute
  [378, [122, 769]],
  // ź = z + acute
  [379, [90, 775]],
  // Ż = Z + dot above
  [380, [122, 775]],
  // ż = z + dot above
  [381, [90, 780]],
  // Ž = Z + caron
  [382, [122, 780]],
  // ž = z + caron
  // Vietnamese characters (Latin Extended Additional)
  [7840, [65, 803]],
  // Ạ = A + dot below
  [7841, [97, 803]],
  // ạ = a + dot below
  [7842, [65, 777]],
  // Ả = A + hook above
  [7843, [97, 777]],
  // ả = a + hook above
  [7864, [69, 803]],
  // Ẹ = E + dot below
  [7865, [101, 803]],
  // ẹ = e + dot below
  [7866, [69, 777]],
  // Ẻ = E + hook above
  [7867, [101, 777]],
  // ẻ = e + hook above
  [7868, [69, 771]],
  // Ẽ = E + tilde
  [7869, [101, 771]],
  // ẽ = e + tilde
  [7880, [73, 777]],
  // Ỉ = I + hook above
  [7881, [105, 777]],
  // ỉ = i + hook above
  [7882, [73, 803]],
  // Ị = I + dot below
  [7883, [105, 803]],
  // ị = i + dot below
  [7884, [79, 803]],
  // Ọ = O + dot below
  [7885, [111, 803]],
  // ọ = o + dot below
  [7886, [79, 777]],
  // Ỏ = O + hook above
  [7887, [111, 777]],
  // ỏ = o + hook above
  [7908, [85, 803]],
  // Ụ = U + dot below
  [7909, [117, 803]],
  // ụ = u + dot below
  [7910, [85, 777]],
  // Ủ = U + hook above
  [7911, [117, 777]],
  // ủ = u + hook above
  [7922, [89, 768]],
  // Ỳ = Y + grave
  [7923, [121, 768]],
  // ỳ = y + grave
  [7924, [89, 803]],
  // Ỵ = Y + dot below
  [7925, [121, 803]],
  // ỵ = y + dot below
  [7926, [89, 777]],
  // Ỷ = Y + hook above
  [7927, [121, 777]],
  // ỷ = y + hook above
  [7928, [89, 771]],
  // Ỹ = Y + tilde
  [7929, [121, 771]],
  // ỹ = y + tilde
  // Greek Extended
  [7936, [945, 787]],
  // ἀ = α + psili
  [7937, [945, 788]],
  // ἁ = α + dasia
  [7944, [913, 787]],
  // Ἀ = Α + psili
  [7945, [913, 788]],
  // Ἁ = Α + dasia
  // Cyrillic (common)
  [1081, [1080, 774]],
  // й = и + breve
  [1049, [1048, 774]],
  // Й = И + breve
  [1105, [1077, 776]],
  // ё = е + diaeresis
  [1025, [1045, 776]]
  // Ё = Е + diaeresis
]);
function decompose(cp) {
  return DECOMPOSITIONS.get(cp) ?? null;
}
var COMPOSITIONS = /* @__PURE__ */ new Map([
  // Latin A compositions
  [
    65,
    /* @__PURE__ */ new Map([
      [768, 192],
      // A + grave = À
      [769, 193],
      // A + acute = Á
      [770, 194],
      // A + circumflex = Â
      [771, 195],
      // A + tilde = Ã
      [776, 196],
      // A + diaeresis = Ä
      [778, 197],
      // A + ring = Å
      [808, 260],
      // A + ogonek = Ą
      [780, 461],
      // A + caron = Ǎ
      [772, 256],
      // A + macron = Ā
      [774, 258]
      // A + breve = Ă
    ])
  ],
  // Latin C compositions
  [
    67,
    /* @__PURE__ */ new Map([
      [807, 199],
      // C + cedilla = Ç
      [769, 262],
      // C + acute = Ć
      [770, 264],
      // C + circumflex = Ĉ
      [780, 268],
      // C + caron = Č
      [775, 266]
      // C + dot above = Ċ
    ])
  ],
  // Latin E compositions
  [
    69,
    /* @__PURE__ */ new Map([
      [768, 200],
      // E + grave = È
      [769, 201],
      // E + acute = É
      [770, 202],
      // E + circumflex = Ê
      [776, 203],
      // E + diaeresis = Ë
      [808, 280],
      // E + ogonek = Ę
      [780, 282],
      // E + caron = Ě
      [772, 274],
      // E + macron = Ē
      [774, 276],
      // E + breve = Ĕ
      [775, 278]
      // E + dot above = Ė
    ])
  ],
  // Latin I compositions
  [
    73,
    /* @__PURE__ */ new Map([
      [768, 204],
      // I + grave = Ì
      [769, 205],
      // I + acute = Í
      [770, 206],
      // I + circumflex = Î
      [776, 207],
      // I + diaeresis = Ï
      [771, 296],
      // I + tilde = Ĩ
      [772, 298],
      // I + macron = Ī
      [774, 300],
      // I + breve = Ĭ
      [808, 302],
      // I + ogonek = Į
      [775, 304]
      // I + dot above = İ
    ])
  ],
  // Latin N compositions
  [
    78,
    /* @__PURE__ */ new Map([
      [771, 209],
      // N + tilde = Ñ
      [769, 323],
      // N + acute = Ń
      [807, 325],
      // N + cedilla = Ņ
      [780, 327]
      // N + caron = Ň
    ])
  ],
  // Latin O compositions
  [
    79,
    /* @__PURE__ */ new Map([
      [768, 210],
      // O + grave = Ò
      [769, 211],
      // O + acute = Ó
      [770, 212],
      // O + circumflex = Ô
      [771, 213],
      // O + tilde = Õ
      [776, 214],
      // O + diaeresis = Ö
      [772, 332],
      // O + macron = Ō
      [774, 334],
      // O + breve = Ŏ
      [779, 336],
      // O + double acute = Ő
      [808, 490]
      // O + ogonek = Ǫ
    ])
  ],
  // Latin U compositions
  [
    85,
    /* @__PURE__ */ new Map([
      [768, 217],
      // U + grave = Ù
      [769, 218],
      // U + acute = Ú
      [770, 219],
      // U + circumflex = Û
      [776, 220],
      // U + diaeresis = Ü
      [771, 360],
      // U + tilde = Ũ
      [772, 362],
      // U + macron = Ū
      [774, 364],
      // U + breve = Ŭ
      [778, 366],
      // U + ring = Ů
      [779, 368],
      // U + double acute = Ű
      [808, 370],
      // U + ogonek = Ų
      [780, 467]
      // U + caron = Ǔ
    ])
  ],
  // Latin Y compositions
  [
    89,
    /* @__PURE__ */ new Map([
      [769, 221],
      // Y + acute = Ý
      [770, 374],
      // Y + circumflex = Ŷ
      [776, 376]
      // Y + diaeresis = Ÿ
    ])
  ],
  // Lowercase a compositions
  [
    97,
    /* @__PURE__ */ new Map([
      [768, 224],
      // a + grave = à
      [769, 225],
      // a + acute = á
      [770, 226],
      // a + circumflex = â
      [771, 227],
      // a + tilde = ã
      [776, 228],
      // a + diaeresis = ä
      [778, 229],
      // a + ring = å
      [808, 261],
      // a + ogonek = ą
      [780, 462],
      // a + caron = ǎ
      [772, 257],
      // a + macron = ā
      [774, 259]
      // a + breve = ă
    ])
  ],
  // Lowercase c compositions
  [
    99,
    /* @__PURE__ */ new Map([
      [807, 231],
      // c + cedilla = ç
      [769, 263],
      // c + acute = ć
      [770, 265],
      // c + circumflex = ĉ
      [780, 269],
      // c + caron = č
      [775, 267]
      // c + dot above = ċ
    ])
  ],
  // Lowercase e compositions
  [
    101,
    /* @__PURE__ */ new Map([
      [768, 232],
      // e + grave = è
      [769, 233],
      // e + acute = é
      [770, 234],
      // e + circumflex = ê
      [776, 235],
      // e + diaeresis = ë
      [808, 281],
      // e + ogonek = ę
      [780, 283],
      // e + caron = ě
      [772, 275],
      // e + macron = ē
      [774, 277],
      // e + breve = ĕ
      [775, 279]
      // e + dot above = ė
    ])
  ],
  // Lowercase i compositions
  [
    105,
    /* @__PURE__ */ new Map([
      [768, 236],
      // i + grave = ì
      [769, 237],
      // i + acute = í
      [770, 238],
      // i + circumflex = î
      [776, 239],
      // i + diaeresis = ï
      [771, 297],
      // i + tilde = ĩ
      [772, 299],
      // i + macron = ī
      [774, 301],
      // i + breve = ĭ
      [808, 303]
      // i + ogonek = į
    ])
  ],
  // Lowercase n compositions
  [
    110,
    /* @__PURE__ */ new Map([
      [771, 241],
      // n + tilde = ñ
      [769, 324],
      // n + acute = ń
      [807, 326],
      // n + cedilla = ņ
      [780, 328]
      // n + caron = ň
    ])
  ],
  // Lowercase o compositions
  [
    111,
    /* @__PURE__ */ new Map([
      [768, 242],
      // o + grave = ò
      [769, 243],
      // o + acute = ó
      [770, 244],
      // o + circumflex = ô
      [771, 245],
      // o + tilde = õ
      [776, 246],
      // o + diaeresis = ö
      [772, 333],
      // o + macron = ō
      [774, 335],
      // o + breve = ŏ
      [779, 337],
      // o + double acute = ő
      [808, 491]
      // o + ogonek = ǫ
    ])
  ],
  // Lowercase u compositions
  [
    117,
    /* @__PURE__ */ new Map([
      [768, 249],
      // u + grave = ù
      [769, 250],
      // u + acute = ú
      [770, 251],
      // u + circumflex = û
      [776, 252],
      // u + diaeresis = ü
      [771, 361],
      // u + tilde = ũ
      [772, 363],
      // u + macron = ū
      [774, 365],
      // u + breve = ŭ
      [778, 367],
      // u + ring = ů
      [779, 369],
      // u + double acute = ű
      [808, 371],
      // u + ogonek = ų
      [780, 468]
      // u + caron = ǔ
    ])
  ],
  // Lowercase y compositions
  [
    121,
    /* @__PURE__ */ new Map([
      [769, 253],
      // y + acute = ý
      [776, 255],
      // y + diaeresis = ÿ
      [770, 375]
      // y + circumflex = ŷ
    ])
  ],
  // Other common compositions
  [
    83,
    /* @__PURE__ */ new Map([
      // S
      [769, 346],
      // S + acute = Ś
      [770, 348],
      // S + circumflex = Ŝ
      [807, 350],
      // S + cedilla = Ş
      [780, 352]
      // S + caron = Š
    ])
  ],
  [
    115,
    /* @__PURE__ */ new Map([
      // s
      [769, 347],
      // s + acute = ś
      [770, 349],
      // s + circumflex = ŝ
      [807, 351],
      // s + cedilla = ş
      [780, 353]
      // s + caron = š
    ])
  ],
  [
    90,
    /* @__PURE__ */ new Map([
      // Z
      [769, 377],
      // Z + acute = Ź
      [775, 379],
      // Z + dot above = Ż
      [780, 381]
      // Z + caron = Ž
    ])
  ],
  [
    122,
    /* @__PURE__ */ new Map([
      // z
      [769, 378],
      // z + acute = ź
      [775, 380],
      // z + dot above = ż
      [780, 382]
      // z + caron = ž
    ])
  ]
]);
function tryCompose(base, combining) {
  const baseCompositions = COMPOSITIONS.get(base);
  if (!baseCompositions) return null;
  return baseCompositions.get(combining) ?? null;
}
function composeMarks(infos) {
  if (infos.length === 0) return infos;
  const result = [];
  let i = 0;
  while (i < infos.length) {
    const current = infos[i];
    if (!current) {
      i++;
      continue;
    }
    const currentCcc = getCombiningClass(current.codepoint);
    if (currentCcc === 0) {
      let composedCp = current.codepoint;
      let lastCcc = 0;
      let j = i + 1;
      while (j < infos.length) {
        const mark = infos[j];
        if (!mark) break;
        const markCcc = getCombiningClass(mark.codepoint);
        if (markCcc === 0) break;
        if (markCcc > lastCcc || lastCcc === 0) {
          const composed = tryCompose(composedCp, mark.codepoint);
          if (composed !== null) {
            composedCp = composed;
            j++;
            continue;
          }
        }
        lastCcc = markCcc;
        j++;
      }
      result.push({
        glyphId: current.glyphId,
        cluster: current.cluster,
        mask: current.mask,
        codepoint: composedCp
      });
      for (let k = i + 1; k < j; k++) {
        const mark = infos[k];
        if (!mark) continue;
        const markCcc = getCombiningClass(mark.codepoint);
        const compositionExists = tryCompose(composedCp, mark.codepoint) !== null;
        if (!compositionExists && markCcc !== 0) {
          result.push(mark);
        }
      }
      i = j;
    } else {
      result.push(current);
      i++;
    }
  }
  return result;
}
function normalize(infos, mode) {
  if (mode === 0 /* None */) {
    return infos;
  }
  if (mode === 1 /* Decompose */) {
    const result = [];
    for (const info of infos) {
      const decomposed = decompose(info.codepoint);
      if (decomposed) {
        for (const cp of decomposed) {
          result.push({
            glyphId: info.glyphId,
            // Will be remapped later
            cluster: info.cluster,
            mask: info.mask,
            codepoint: cp
          });
        }
      } else {
        result.push(info);
      }
    }
    reorderMarks(result);
    return result;
  }
  if (mode === 2 /* Compose */) {
    const decomposed = [];
    for (const info of infos) {
      const dec = decompose(info.codepoint);
      if (dec) {
        for (const cp of dec) {
          decomposed.push({
            glyphId: info.glyphId,
            cluster: info.cluster,
            mask: info.mask,
            codepoint: cp
          });
        }
      } else {
        decomposed.push(info);
      }
    }
    reorderMarks(decomposed);
    return composeMarks(decomposed);
  }
  if (mode === 3 /* Auto */) {
    const result = [];
    for (const info of infos) {
      const decomposed = decompose(info.codepoint);
      if (decomposed) {
        for (const cp of decomposed) {
          result.push({
            glyphId: info.glyphId,
            cluster: info.cluster,
            mask: info.mask,
            codepoint: cp
          });
        }
      } else {
        result.push(info);
      }
    }
    reorderMarks(result);
    return result;
  }
  return infos;
}

// src/shaper/fallback.ts
function applyFallbackMarkPositioning(font, infos, positions) {
  for (let i = 0; i < infos.length; i++) {
    const info = infos[i];
    const pos = positions[i];
    if (!info || !pos) continue;
    const glyphClass = font.gdef ? getGlyphClass2(font.gdef, info.glyphId) : 0;
    const ccc = getCombiningClass(info.codepoint);
    if (glyphClass !== 3 /* Mark */ && ccc === 0) continue;
    let baseIndex = -1;
    for (let j = i - 1; j >= 0; j--) {
      const prevInfo = infos[j];
      if (!prevInfo) continue;
      const prevClass = font.gdef ? getGlyphClass2(font.gdef, prevInfo.glyphId) : 0;
      const prevCcc = getCombiningClass(prevInfo.codepoint);
      if (prevClass === 1 /* Base */ || prevClass === 0 && prevCcc === 0) {
        baseIndex = j;
        break;
      }
    }
    if (baseIndex < 0) continue;
    const baseInfo = infos[baseIndex];
    const basePos = positions[baseIndex];
    if (!baseInfo || !basePos) continue;
    const baseAdvance = font.advanceWidth(baseInfo.glyphId);
    positionMarkFallback(font, info, pos, baseInfo, basePos, baseAdvance, ccc);
    pos.xAdvance = 0;
    pos.yAdvance = 0;
  }
}
function positionMarkFallback(font, markInfo, markPos, _baseInfo, basePos, baseAdvance, ccc) {
  const markAdvance = font.advanceWidth(markInfo.glyphId);
  const unitsPerEm = font.unitsPerEm;
  let xOffset = (baseAdvance - markAdvance) / 2;
  let yOffset = 0;
  if (ccc >= 200 && ccc <= 240) {
    yOffset = unitsPerEm * 0.7;
    xOffset = (baseAdvance - markAdvance) / 2;
  } else if (ccc >= 202 && ccc <= 220) {
    yOffset = -unitsPerEm * 0.15;
    xOffset = (baseAdvance - markAdvance) / 2;
  } else if (ccc === 1) {
    xOffset = (baseAdvance - markAdvance) / 2;
    yOffset = unitsPerEm * 0.3;
  } else if (ccc >= 7 && ccc <= 9) {
    yOffset = -unitsPerEm * 0.1;
    xOffset = (baseAdvance - markAdvance) / 2;
  } else if (ccc >= 10 && ccc <= 35) {
    if (ccc <= 22) {
      yOffset = -unitsPerEm * 0.2;
    } else {
      yOffset = ccc < 30 ? -unitsPerEm * 0.15 : unitsPerEm * 0.6;
    }
    xOffset = (baseAdvance - markAdvance) / 2;
  }
  markPos.xOffset = basePos.xOffset + xOffset - baseAdvance;
  markPos.yOffset = basePos.yOffset + yOffset;
}
function applyFallbackKerning(font, infos, positions) {
  const kern = font.kern;
  if (!kern) return;
  for (let i = 0; i < infos.length - 1; i++) {
    const info1 = infos[i];
    const info2 = infos[i + 1];
    if (!info1 || !info2) continue;
    const pos1 = positions[i];
    if (!pos1) continue;
    const class1 = font.gdef ? getGlyphClass2(font.gdef, info1.glyphId) : 0;
    const class2 = font.gdef ? getGlyphClass2(font.gdef, info2.glyphId) : 0;
    if (class1 === 3 /* Mark */ || class2 === 3 /* Mark */) continue;
    const kernValue = getKernValueFromTable(font, info1.glyphId, info2.glyphId);
    if (kernValue !== 0) {
      pos1.xAdvance += kernValue;
    }
  }
}
function getKernValueFromTable(font, left, right) {
  const kern = font.kern;
  if (!kern) return 0;
  return getKernValue(kern, left, right);
}

// src/shaper/features.ts
function stylisticSet(setNumber, enabled = true) {
  if (setNumber < 1 || setNumber > 20) {
    throw new Error(`Stylistic set number must be 1-20, got ${setNumber}`);
  }
  const tagStr = `ss${setNumber.toString().padStart(2, "0")}`;
  return { tag: tag(tagStr), enabled };
}
function stylisticSets(setNumbers, enabled = true) {
  return setNumbers.map((n) => stylisticSet(n, enabled));
}
function characterVariant(variantNumber, enabled = true) {
  if (variantNumber < 1 || variantNumber > 99) {
    throw new Error(
      `Character variant number must be 1-99, got ${variantNumber}`
    );
  }
  const tagStr = `cv${variantNumber.toString().padStart(2, "0")}`;
  return { tag: tag(tagStr), enabled };
}
function characterVariants(variantNumbers, enabled = true) {
  return variantNumbers.map((n) => characterVariant(n, enabled));
}
function standardLigatures(enabled = true) {
  return { tag: tag("liga"), enabled };
}
function discretionaryLigatures(enabled = true) {
  return { tag: tag("dlig"), enabled };
}
function historicalLigatures(enabled = true) {
  return { tag: tag("hlig"), enabled };
}
function contextualAlternates(enabled = true) {
  return { tag: tag("calt"), enabled };
}
function stylisticAlternates(enabled = true) {
  return { tag: tag("salt"), enabled };
}
function swash(enabled = true) {
  return { tag: tag("swsh"), enabled };
}
function smallCaps(enabled = true) {
  return { tag: tag("smcp"), enabled };
}
function capsToSmallCaps(enabled = true) {
  return { tag: tag("c2sc"), enabled };
}
function petiteCaps(enabled = true) {
  return { tag: tag("pcap"), enabled };
}
function allSmallCaps(enabled = true) {
  return [smallCaps(enabled), capsToSmallCaps(enabled)];
}
function oldstyleFigures(enabled = true) {
  return { tag: tag("onum"), enabled };
}
function liningFigures(enabled = true) {
  return { tag: tag("lnum"), enabled };
}
function proportionalFigures(enabled = true) {
  return { tag: tag("pnum"), enabled };
}
function tabularFigures(enabled = true) {
  return { tag: tag("tnum"), enabled };
}
function fractions(enabled = true) {
  return { tag: tag("frac"), enabled };
}
function ordinals(enabled = true) {
  return { tag: tag("ordn"), enabled };
}
function slashedZero(enabled = true) {
  return { tag: tag("zero"), enabled };
}
function superscript(enabled = true) {
  return { tag: tag("sups"), enabled };
}
function subscript(enabled = true) {
  return { tag: tag("subs"), enabled };
}
function scientificInferiors(enabled = true) {
  return { tag: tag("sinf"), enabled };
}
function caseSensitiveForms(enabled = true) {
  return { tag: tag("case"), enabled };
}
function capitalSpacing(enabled = true) {
  return { tag: tag("cpsp"), enabled };
}
function kerning(enabled = true) {
  return { tag: tag("kern"), enabled };
}
function verticalForms(enabled = true) {
  return { tag: tag("vert"), enabled };
}
function verticalAlternatesRotation(enabled = true) {
  return { tag: tag("vrt2"), enabled };
}
function verticalKanaAlternates(enabled = true) {
  return { tag: tag("vkna"), enabled };
}
function verticalLayoutFeatures(enabled = true) {
  return [
    verticalForms(enabled),
    verticalAlternatesRotation(enabled),
    verticalKanaAlternates(enabled)
  ];
}
function ruby(enabled = true) {
  return { tag: tag("ruby"), enabled };
}
function halfWidthForms(enabled = true) {
  return { tag: tag("hwid"), enabled };
}
function fullWidthForms(enabled = true) {
  return { tag: tag("fwid"), enabled };
}
function proportionalWidthForms(enabled = true) {
  return { tag: tag("pwid"), enabled };
}
function quarterWidthForms(enabled = true) {
  return { tag: tag("qwid"), enabled };
}
function thirdWidthForms(enabled = true) {
  return { tag: tag("twid"), enabled };
}
function jis78Forms(enabled = true) {
  return { tag: tag("jp78"), enabled };
}
function jis83Forms(enabled = true) {
  return { tag: tag("jp83"), enabled };
}
function jis90Forms(enabled = true) {
  return { tag: tag("jp90"), enabled };
}
function jis2004Forms(enabled = true) {
  return { tag: tag("jp04"), enabled };
}
function simplifiedForms(enabled = true) {
  return { tag: tag("smpl"), enabled };
}
function traditionalForms(enabled = true) {
  return { tag: tag("trad"), enabled };
}
function feature(tagStr, enabled = true) {
  return { tag: tag(tagStr), enabled };
}
function features(tagStrs, enabled = true) {
  return tagStrs.map((t) => feature(t, enabled));
}
function combineFeatures(...featureSets) {
  const result = [];
  for (const set of featureSets) {
    if (Array.isArray(set)) {
      result.push(...set);
    } else {
      result.push(set);
    }
  }
  return result;
}

// src/shaper/shape-plan.ts
var shapePlanCache = /* @__PURE__ */ new WeakMap();
var MAX_CACHE_SIZE = 64;
var DEFAULT_GSUB_FEATURES = [
  "ccmp",
  // Glyph composition/decomposition
  "locl",
  // Localized forms
  "rlig",
  // Required ligatures
  "rclt",
  // Required contextual alternates
  "calt",
  // Contextual alternates
  "liga"
  // Standard ligatures
];
var DEFAULT_GPOS_FEATURES = [
  "kern",
  // Kerning
  "mark",
  // Mark positioning
  "mkmk"
  // Mark-to-mark positioning
];
function getCacheKey(script, language, direction, userFeatures, axisCoords) {
  const featuresKey = userFeatures.map((f) => `${tagToString(f.tag)}:${f.enabled ? "1" : "0"}`).sort().join(",");
  const coordsKey = axisCoords ? axisCoords.map((c) => c.toFixed(4)).join(",") : "";
  return `${script}|${language || ""}|${direction}|${featuresKey}|${coordsKey}`;
}
function getOrCreateShapePlan(font, script, language, direction, userFeatures = [], axisCoords = null) {
  const cacheKey = getCacheKey(script, language, direction, userFeatures, axisCoords);
  let fontCache = shapePlanCache.get(font);
  if (!fontCache) {
    fontCache = /* @__PURE__ */ new Map();
    shapePlanCache.set(font, fontCache);
  }
  const cached = fontCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const plan = createShapePlanInternal(
    font,
    script,
    language,
    direction,
    userFeatures,
    axisCoords
  );
  if (fontCache.size >= MAX_CACHE_SIZE) {
    const firstKey = fontCache.keys().next().value;
    if (firstKey !== void 0) {
      fontCache.delete(firstKey);
    }
  }
  fontCache.set(cacheKey, plan);
  return plan;
}
function createShapePlan(font, script, language, direction, userFeatures = [], axisCoords = null) {
  return getOrCreateShapePlan(font, script, language, direction, userFeatures, axisCoords);
}
function createShapePlanInternal(font, script, language, direction, userFeatures = [], axisCoords = null) {
  const scriptTag = tag(script.padEnd(4, " "));
  const languageTag = language ? tag(language.padEnd(4, " ")) : null;
  const enabledFeatures = /* @__PURE__ */ new Set();
  for (const feat of DEFAULT_GSUB_FEATURES) {
    enabledFeatures.add(tag(feat));
  }
  for (const feat of DEFAULT_GPOS_FEATURES) {
    enabledFeatures.add(tag(feat));
  }
  for (const feat of userFeatures) {
    if (feat.enabled) {
      enabledFeatures.add(feat.tag);
    } else {
      enabledFeatures.delete(feat.tag);
    }
  }
  const gsubLookups = collectLookups(
    font.gsub,
    scriptTag,
    languageTag,
    enabledFeatures,
    axisCoords
  );
  const gposLookups = collectLookups(
    font.gpos,
    scriptTag,
    languageTag,
    enabledFeatures,
    axisCoords
  );
  return {
    script: scriptTag,
    language: languageTag,
    direction,
    gsubLookups,
    gposLookups
  };
}
function collectLookups(table, scriptTag, languageTag, enabledFeatures, axisCoords) {
  if (!table) return [];
  const gsub = table;
  const lookupIndices = /* @__PURE__ */ new Set();
  let script = findScript(gsub.scriptList, scriptTag);
  if (!script) {
    script = findScript(gsub.scriptList, tag("DFLT"));
  }
  if (!script) {
    script = findScript(gsub.scriptList, tag("latn"));
  }
  if (!script) return [];
  const langSys = findLangSys(script, languageTag);
  if (!langSys) return [];
  const featureVariations = gsub.featureVariations;
  const matchingVariation = featureVariations && axisCoords ? findMatchingFeatureVariation(featureVariations, axisCoords) : null;
  const featureSubstitutions = /* @__PURE__ */ new Map();
  if (matchingVariation) {
    for (const subst of matchingVariation.featureTableSubstitution.substitutions) {
      featureSubstitutions.set(subst.featureIndex, subst.alternateFeature.lookupListIndices);
    }
  }
  if (langSys.requiredFeatureIndex !== 65535) {
    const feature2 = getFeature(gsub.featureList, langSys.requiredFeatureIndex);
    if (feature2) {
      const substitutedLookups = featureSubstitutions.get(langSys.requiredFeatureIndex);
      const lookups = substitutedLookups ?? feature2.feature.lookupListIndices;
      for (const lookupIndex of lookups) {
        lookupIndices.add(lookupIndex);
      }
    }
  }
  for (const featureIndex of langSys.featureIndices) {
    const featureRecord = getFeature(gsub.featureList, featureIndex);
    if (!featureRecord) continue;
    if (enabledFeatures.has(featureRecord.featureTag)) {
      const substitutedLookups = featureSubstitutions.get(featureIndex);
      const lookups = substitutedLookups ?? featureRecord.feature.lookupListIndices;
      for (const lookupIndex of lookups) {
        lookupIndices.add(lookupIndex);
      }
    }
  }
  const result = [];
  const sortedIndices = Array.from(lookupIndices).sort((a, b) => a - b);
  for (const index of sortedIndices) {
    const lookup = gsub.lookups[index];
    if (lookup) {
      result.push({ index, lookup });
    }
  }
  return result;
}

// src/shaper/complex/arabic.ts
var ARABIC_START = 1536;
var ARABIC_END = 1791;
var ARABIC_SUPPLEMENT_START = 1872;
var ARABIC_SUPPLEMENT_END = 1919;
var ARABIC_EXTENDED_A_START = 2208;
var ARABIC_EXTENDED_A_END = 2303;
var ARABIC_PRESENTATION_A_START = 64336;
var ARABIC_PRESENTATION_A_END = 65023;
var ARABIC_PRESENTATION_B_START = 65136;
var ARABIC_PRESENTATION_B_END = 65279;
function isArabic(cp) {
  return cp >= ARABIC_START && cp <= ARABIC_END || cp >= ARABIC_SUPPLEMENT_START && cp <= ARABIC_SUPPLEMENT_END || cp >= ARABIC_EXTENDED_A_START && cp <= ARABIC_EXTENDED_A_END || cp >= ARABIC_PRESENTATION_A_START && cp <= ARABIC_PRESENTATION_A_END || cp >= ARABIC_PRESENTATION_B_START && cp <= ARABIC_PRESENTATION_B_END;
}
function getJoiningType(cp) {
  if (cp < ARABIC_START) return "U" /* NonJoining */;
  if (cp >= 1536 && cp <= 1541) return "U" /* NonJoining */;
  if (cp === 1544) return "U" /* NonJoining */;
  if (cp === 1547) return "U" /* NonJoining */;
  if (cp === 1549) return "U" /* NonJoining */;
  if (cp === 1574) return "D" /* DualJoining */;
  if (cp === 1576) return "D" /* DualJoining */;
  if (cp === 1578) return "D" /* DualJoining */;
  if (cp === 1579) return "D" /* DualJoining */;
  if (cp === 1580) return "D" /* DualJoining */;
  if (cp === 1581) return "D" /* DualJoining */;
  if (cp === 1582) return "D" /* DualJoining */;
  if (cp === 1587) return "D" /* DualJoining */;
  if (cp === 1588) return "D" /* DualJoining */;
  if (cp === 1589) return "D" /* DualJoining */;
  if (cp === 1590) return "D" /* DualJoining */;
  if (cp === 1591) return "D" /* DualJoining */;
  if (cp === 1592) return "D" /* DualJoining */;
  if (cp === 1593) return "D" /* DualJoining */;
  if (cp === 1594) return "D" /* DualJoining */;
  if (cp >= 1595 && cp <= 1599) return "D" /* DualJoining */;
  if (cp === 1601) return "D" /* DualJoining */;
  if (cp === 1602) return "D" /* DualJoining */;
  if (cp === 1603) return "D" /* DualJoining */;
  if (cp === 1604) return "D" /* DualJoining */;
  if (cp === 1605) return "D" /* DualJoining */;
  if (cp === 1606) return "D" /* DualJoining */;
  if (cp === 1607) return "D" /* DualJoining */;
  if (cp === 1609) return "D" /* DualJoining */;
  if (cp === 1610) return "D" /* DualJoining */;
  if (cp >= 1646 && cp <= 1647) return "D" /* DualJoining */;
  if (cp >= 1656 && cp <= 1671) return "D" /* DualJoining */;
  if (cp >= 1690 && cp <= 1727) return "D" /* DualJoining */;
  if (cp >= 1729 && cp <= 1730) return "D" /* DualJoining */;
  if (cp === 1740) return "D" /* DualJoining */;
  if (cp >= 1742 && cp <= 1745) return "D" /* DualJoining */;
  if (cp === 1749) return "D" /* DualJoining */;
  if (cp >= 1786 && cp <= 1788) return "D" /* DualJoining */;
  if (cp === 1791) return "D" /* DualJoining */;
  if (cp === 1570) return "R" /* RightJoining */;
  if (cp === 1571) return "R" /* RightJoining */;
  if (cp === 1572) return "R" /* RightJoining */;
  if (cp === 1573) return "R" /* RightJoining */;
  if (cp === 1575) return "R" /* RightJoining */;
  if (cp === 1577) return "R" /* RightJoining */;
  if (cp === 1583) return "R" /* RightJoining */;
  if (cp === 1584) return "R" /* RightJoining */;
  if (cp === 1585) return "R" /* RightJoining */;
  if (cp === 1586) return "R" /* RightJoining */;
  if (cp === 1608) return "R" /* RightJoining */;
  if (cp === 1649) return "R" /* RightJoining */;
  if (cp >= 1650 && cp <= 1655) return "R" /* RightJoining */;
  if (cp >= 1672 && cp <= 1689) return "R" /* RightJoining */;
  if (cp >= 1728 && cp <= 1728) return "R" /* RightJoining */;
  if (cp === 1731) return "R" /* RightJoining */;
  if (cp >= 1732 && cp <= 1739) return "R" /* RightJoining */;
  if (cp === 1741) return "R" /* RightJoining */;
  if (cp >= 1746 && cp <= 1747) return "R" /* RightJoining */;
  if (cp === 1600) return "C" /* JoinCausing */;
  if (cp >= 1611 && cp <= 1631) return "T" /* Transparent */;
  if (cp === 1648) return "T" /* Transparent */;
  if (cp >= 1750 && cp <= 1773) return "T" /* Transparent */;
  if (cp >= 2259 && cp <= 2303) return "T" /* Transparent */;
  if (isArabic(cp)) return "U" /* NonJoining */;
  return "U" /* NonJoining */;
}
function analyzeJoining(infos) {
  const n = infos.length;
  const actions = new Array(n).fill(0 /* None */);
  const types = [];
  for (const info of infos) {
    const cp = info.codepoint ?? 0;
    types.push(getJoiningType(cp));
  }
  for (let i = 0; i < n; i++) {
    const type = types[i];
    if (!type) continue;
    if (type === "U" /* NonJoining */ || type === "T" /* Transparent */) {
      continue;
    }
    let prevType = null;
    for (let j = i - 1; j >= 0; j--) {
      const jType = types[j];
      if (jType && jType !== "T" /* Transparent */) {
        prevType = jType;
        break;
      }
    }
    let nextType = null;
    for (let j = i + 1; j < n; j++) {
      const jType = types[j];
      if (jType && jType !== "T" /* Transparent */) {
        nextType = jType;
        break;
      }
    }
    const joinsLeft = prevType === "D" /* DualJoining */ || prevType === "L" /* LeftJoining */ || prevType === "C" /* JoinCausing */;
    const joinsRight = nextType === "D" /* DualJoining */ || nextType === "R" /* RightJoining */ || nextType === "C" /* JoinCausing */;
    if (type === "D" /* DualJoining */) {
      if (joinsLeft && joinsRight) {
        actions[i] = 3 /* Medi */;
      } else if (joinsLeft) {
        actions[i] = 2 /* Fina */;
      } else if (joinsRight) {
        actions[i] = 4 /* Init */;
      } else {
        actions[i] = 1 /* Isol */;
      }
    } else if (type === "R" /* RightJoining */) {
      if (joinsLeft) {
        actions[i] = 2 /* Fina */;
      } else {
        actions[i] = 1 /* Isol */;
      }
    } else if (type === "L" /* LeftJoining */) {
      if (joinsRight) {
        actions[i] = 4 /* Init */;
      } else {
        actions[i] = 1 /* Isol */;
      }
    } else if (type === "C" /* JoinCausing */) {
      actions[i] = 0 /* None */;
    }
  }
  return actions;
}
function setupArabicMasks(infos) {
  const actions = analyzeJoining(infos);
  for (const [i, action] of actions.entries()) {
    const info = infos[i];
    if (!info) continue;
    switch (action) {
      case 1 /* Isol */:
        info.mask = info.mask & 4294967280 | 1;
        break;
      case 2 /* Fina */:
        info.mask = info.mask & 4294967280 | 2;
        break;
      case 3 /* Medi */:
        info.mask = info.mask & 4294967280 | 4;
        break;
      case 4 /* Init */:
        info.mask = info.mask & 4294967280 | 8;
        break;
    }
  }
}

// src/shaper/complex/hangul.ts
var HANGUL_BASE = 44032;
var HANGUL_END = 55203;
var JAMO_L_BASE = 4352;
var JAMO_V_BASE = 4449;
var JAMO_T_BASE = 4519;
var JAMO_L_COUNT = 19;
var JAMO_V_COUNT = 21;
var JAMO_T_COUNT = 28;
var JAMO_VT_COUNT = JAMO_V_COUNT * JAMO_T_COUNT;
var _JAMO_LVT_COUNT = JAMO_L_COUNT * JAMO_VT_COUNT;
var COMPAT_JAMO_START = 12593;
var COMPAT_JAMO_END = 12686;
var JAMO_EXT_A_START = 43360;
var JAMO_EXT_A_END = 43388;
var JAMO_EXT_B_START = 55216;
var JAMO_EXT_B_END = 55291;
function isHangulSyllable(cp) {
  return cp >= HANGUL_BASE && cp <= HANGUL_END;
}
function isHangulJamo(cp) {
  return cp >= JAMO_L_BASE && cp <= 4607 || cp >= JAMO_EXT_A_START && cp <= JAMO_EXT_A_END || cp >= JAMO_EXT_B_START && cp <= JAMO_EXT_B_END;
}
function isJamoL(cp) {
  return cp >= JAMO_L_BASE && cp < JAMO_L_BASE + JAMO_L_COUNT || cp >= JAMO_EXT_A_START && cp <= JAMO_EXT_A_END;
}
function isJamoV(cp) {
  return cp >= JAMO_V_BASE && cp < JAMO_V_BASE + JAMO_V_COUNT || cp >= 55216 && cp <= 55238;
}
function isJamoT(cp) {
  return cp > JAMO_T_BASE && cp <= JAMO_T_BASE + JAMO_T_COUNT - 1 || cp >= 55243 && cp <= 55291;
}
function decomposeHangul(cp) {
  if (!isHangulSyllable(cp)) return [cp];
  const syllableIndex = cp - HANGUL_BASE;
  const l = Math.floor(syllableIndex / JAMO_VT_COUNT);
  const v = Math.floor(syllableIndex % JAMO_VT_COUNT / JAMO_T_COUNT);
  const t = syllableIndex % JAMO_T_COUNT;
  const result = [JAMO_L_BASE + l, JAMO_V_BASE + v];
  if (t > 0) {
    result.push(JAMO_T_BASE + t);
  }
  return result;
}
function composeHangul(l, v, t = 0) {
  const lIndex = l - JAMO_L_BASE;
  const vIndex = v - JAMO_V_BASE;
  const tIndex = t === 0 ? 0 : t - JAMO_T_BASE;
  if (lIndex < 0 || lIndex >= JAMO_L_COUNT) return null;
  if (vIndex < 0 || vIndex >= JAMO_V_COUNT) return null;
  if (tIndex < 0 || tIndex >= JAMO_T_COUNT) return null;
  return HANGUL_BASE + lIndex * JAMO_VT_COUNT + vIndex * JAMO_T_COUNT + tIndex;
}
function getHangulSyllableType(cp) {
  if (isJamoL(cp)) return 1 /* LeadingJamo */;
  if (isJamoV(cp)) return 2 /* VowelJamo */;
  if (isJamoT(cp)) return 3 /* TrailingJamo */;
  if (isHangulSyllable(cp)) {
    const syllableIndex = cp - HANGUL_BASE;
    const t = syllableIndex % JAMO_T_COUNT;
    return t === 0 ? 4 /* LVSyllable */ : 5 /* LVTSyllable */;
  }
  return 0 /* NotApplicable */;
}
var HangulFeatureMask = {
  ljmo: 1,
  // Leading jamo forms
  vjmo: 2,
  // Vowel jamo forms
  tjmo: 4
  // Trailing jamo forms
};
function setupHangulMasks(infos) {
  for (const info of infos) {
    const type = getHangulSyllableType(info.codepoint);
    switch (type) {
      case 1 /* LeadingJamo */:
        info.mask |= HangulFeatureMask.ljmo;
        break;
      case 2 /* VowelJamo */:
        info.mask |= HangulFeatureMask.vjmo;
        break;
      case 3 /* TrailingJamo */:
        info.mask |= HangulFeatureMask.tjmo;
        break;
      case 4 /* LVSyllable */:
      case 5 /* LVTSyllable */:
        break;
    }
  }
}
function normalizeHangul(infos) {
  const result = [];
  let i = 0;
  while (i < infos.length) {
    const info = infos[i];
    if (!info) {
      i++;
      continue;
    }
    const type = getHangulSyllableType(info.codepoint);
    if (type === 1 /* LeadingJamo */ && i + 1 < infos.length) {
      const nextInfo = infos[i + 1];
      if (!nextInfo) {
        result.push(info);
        i++;
        continue;
      }
      const nextType = getHangulSyllableType(nextInfo.codepoint);
      if (nextType === 2 /* VowelJamo */) {
        let t = 0;
        let consumed = 2;
        if (i + 2 < infos.length) {
          const thirdInfo = infos[i + 2];
          if (thirdInfo) {
            const thirdType = getHangulSyllableType(thirdInfo.codepoint);
            if (thirdType === 3 /* TrailingJamo */) {
              t = thirdInfo.codepoint;
              consumed = 3;
            }
          }
        }
        const composed = composeHangul(info.codepoint, nextInfo.codepoint, t);
        if (composed !== null) {
          result.push({
            glyphId: info.glyphId,
            // Will be remapped
            cluster: info.cluster,
            mask: info.mask,
            codepoint: composed
          });
          i += consumed;
          continue;
        }
      }
    }
    if (type === 4 /* LVSyllable */ && i + 1 < infos.length) {
      const nextInfo = infos[i + 1];
      if (!nextInfo) {
        result.push(info);
        i++;
        continue;
      }
      const nextType = getHangulSyllableType(nextInfo.codepoint);
      if (nextType === 3 /* TrailingJamo */) {
        const decomposed = decomposeHangul(info.codepoint);
        const [firstJamo, secondJamo] = decomposed;
        if (decomposed.length === 2 && firstJamo !== void 0 && secondJamo !== void 0) {
          const composed = composeHangul(
            firstJamo,
            secondJamo,
            nextInfo.codepoint
          );
          if (composed !== null) {
            result.push({
              glyphId: info.glyphId,
              cluster: info.cluster,
              mask: info.mask,
              codepoint: composed
            });
            i += 2;
            continue;
          }
        }
      }
    }
    result.push(info);
    i++;
  }
  return result;
}
function isKorean(cp) {
  return isHangulSyllable(cp) || isHangulJamo(cp) || cp >= COMPAT_JAMO_START && cp <= COMPAT_JAMO_END;
}

// src/shaper/complex/hebrew.ts
var HEBREW_START = 1424;
var HEBREW_END = 1535;
var HEBREW_EXTENDED_START = 64285;
var HEBREW_EXTENDED_END = 64335;
function isHebrew(cp) {
  return cp >= HEBREW_START && cp <= HEBREW_END || cp >= HEBREW_EXTENDED_START && cp <= HEBREW_EXTENDED_END;
}
function getHebrewCategory(cp) {
  if (cp >= 1425 && cp <= 1455) return 6 /* Accent */;
  if (cp >= 1456 && cp <= 1469) return 2 /* Point */;
  if (cp === 1470) return 7 /* Maqaf */;
  if (cp === 1471) return 5 /* Rafe */;
  if (cp === 1472 || cp === 1475) return 8 /* Punctuation */;
  if (cp === 1473 || cp === 1474) return 4 /* Shin */;
  if (cp === 1468) return 3 /* Dagesh */;
  if (cp === 1469) return 2 /* Point */;
  if (cp >= 1488 && cp <= 1514) return 1 /* Letter */;
  if (cp >= 1520 && cp <= 1524) return 1 /* Letter */;
  if (cp >= 64285 && cp <= 64335) return 1 /* Letter */;
  if (isHebrew(cp)) return 0 /* Other */;
  return 0 /* Other */;
}
function setupHebrewMasks(infos) {
  let baseIndex = 0;
  for (let i = 0; i < infos.length; i++) {
    const info = infos[i];
    if (!info) continue;
    const cat = getHebrewCategory(info.codepoint);
    if (cat === 1 /* Letter */) {
      baseIndex = i;
    }
    info.mask = info.mask & 4294901760 | baseIndex & 65535;
  }
}

// src/shaper/complex/indic.ts
function isDevanagari(cp) {
  return cp >= 2304 && cp <= 2431;
}
function isBengali(cp) {
  return cp >= 2432 && cp <= 2559;
}
function isGurmukhi(cp) {
  return cp >= 2560 && cp <= 2687;
}
function isGujarati(cp) {
  return cp >= 2688 && cp <= 2815;
}
function isOriya(cp) {
  return cp >= 2816 && cp <= 2943;
}
function isTamil(cp) {
  return cp >= 2944 && cp <= 3071;
}
function isTelugu(cp) {
  return cp >= 3072 && cp <= 3199;
}
function isKannada(cp) {
  return cp >= 3200 && cp <= 3327;
}
function isMalayalam(cp) {
  return cp >= 3328 && cp <= 3455;
}
function isIndic(cp) {
  return isDevanagari(cp) || isBengali(cp) || isGurmukhi(cp) || isGujarati(cp) || isOriya(cp) || isTamil(cp) || isTelugu(cp) || isKannada(cp) || isMalayalam(cp);
}
function getIndicCategory(cp) {
  if (cp === 8204) return 5 /* ZWNJ */;
  if (cp === 8205) return 6 /* ZWJ */;
  if (cp === 9676) return 12 /* Dotted_Circle */;
  if (isDevanagari(cp)) {
    if (cp >= 2362 && cp <= 2363 || cp >= 2366 && cp <= 2380 || cp >= 2382 && cp <= 2383 || cp >= 2389 && cp <= 2391) {
      return 7 /* M */;
    }
    if (cp === 2381) return 4 /* H */;
    if (cp === 2364) return 3 /* N */;
    if (cp >= 2305 && cp <= 2307) return 8 /* SM */;
    if (cp >= 2385 && cp <= 2388) return 9 /* A */;
    if (cp >= 2308 && cp <= 2324 || cp === 2400 || cp === 2401 || cp === 2418 || cp >= 2422 && cp <= 2423) {
      return 2 /* V */;
    }
    if (cp >= 2325 && cp <= 2361 || cp >= 2392 && cp <= 2399 || cp === 2424 || cp === 2425 || cp === 2426 || cp >= 2427 && cp <= 2428 || cp >= 2430 && cp <= 2431) {
      if (cp === 2352) return 15 /* Ra */;
      return 1 /* C */;
    }
    if (cp >= 2406 && cp <= 2415) return 17 /* Symbol */;
    return 0 /* X */;
  }
  if (isBengali(cp)) {
    if (cp >= 2494 && cp <= 2500 || cp >= 2503 && cp <= 2504 || cp >= 2507 && cp <= 2508 || cp === 2519) {
      return 7 /* M */;
    }
    if (cp === 2509) return 4 /* H */;
    if (cp === 2492) return 3 /* N */;
    if (cp >= 2433 && cp <= 2435) return 8 /* SM */;
    if (cp >= 2437 && cp <= 2444 || cp >= 2447 && cp <= 2448 || cp >= 2451 && cp <= 2452 || cp === 2528 || cp === 2529) {
      return 2 /* V */;
    }
    if (cp >= 2453 && cp <= 2472 || cp >= 2474 && cp <= 2480 || cp === 2482 || cp >= 2486 && cp <= 2489 || cp >= 2524 && cp <= 2525 || cp >= 2527 && cp <= 2529) {
      if (cp === 2480) return 15 /* Ra */;
      return 1 /* C */;
    }
    return 0 /* X */;
  }
  if (isGurmukhi(cp) || isGujarati(cp) || isOriya(cp) || isTamil(cp) || isTelugu(cp) || isKannada(cp) || isMalayalam(cp)) {
    const offset = cp & 127;
    if (offset >= 1 && offset <= 3) return 8 /* SM */;
    if (offset >= 5 && offset <= 20) return 2 /* V */;
    if (offset >= 21 && offset <= 57) return 1 /* C */;
    if (offset === 60) return 3 /* N */;
    if (offset >= 62 && offset <= 76) return 7 /* M */;
    if (offset === 77) return 4 /* H */;
    return 0 /* X */;
  }
  return 0 /* X */;
}
function findSyllables(infos) {
  const syllables = [];
  const n = infos.length;
  if (n === 0) return syllables;
  let start = 0;
  while (start < n) {
    const syllable = parseSyllable(infos, start);
    syllables.push(syllable);
    start = syllable.end;
  }
  return syllables;
}
function parseSyllable(infos, start) {
  const n = infos.length;
  let pos = start;
  let baseConsonant = -1;
  let hasReph = false;
  if (pos + 1 < n) {
    const info1 = infos[pos];
    const info2 = infos[pos + 1];
    if (info1 && info2) {
      const cat1 = getIndicCategory(info1.codepoint ?? 0);
      const cat2 = getIndicCategory(info2.codepoint ?? 0);
      if (cat1 === 15 /* Ra */ && cat2 === 4 /* H */) {
        hasReph = true;
        pos += 2;
      }
    }
  }
  let lastConsonant = -1;
  while (pos < n) {
    const info = infos[pos];
    if (!info) {
      pos++;
      continue;
    }
    const cp = info.codepoint ?? 0;
    const cat = getIndicCategory(cp);
    if (cat === 1 /* C */ || cat === 15 /* Ra */) {
      lastConsonant = pos;
      pos++;
      if (pos < n) {
        const nextInfo = infos[pos];
        if (nextInfo && getIndicCategory(nextInfo.codepoint ?? 0) === 3 /* N */) {
          pos++;
        }
      }
      if (pos < n) {
        const hInfo = infos[pos];
        if (hInfo && getIndicCategory(hInfo.codepoint ?? 0) === 4 /* H */) {
          pos++;
          if (pos < n) {
            const afterH = infos[pos];
            if (afterH) {
              const nextCat = getIndicCategory(afterH.codepoint ?? 0);
              if (nextCat === 6 /* ZWJ */ || nextCat === 5 /* ZWNJ */) {
                pos++;
              }
            }
          }
          continue;
        }
      }
      break;
    } else if (cat === 2 /* V */) {
      pos++;
      break;
    } else if (cat === 3 /* N */) {
      pos++;
    } else {
      if (lastConsonant === -1) {
        pos++;
      }
      break;
    }
  }
  baseConsonant = lastConsonant >= 0 ? lastConsonant : start;
  while (pos < n) {
    const info = infos[pos];
    if (!info) {
      pos++;
      continue;
    }
    const cp = info.codepoint ?? 0;
    const cat = getIndicCategory(cp);
    if (cat === 7 /* M */ || cat === 8 /* SM */ || cat === 9 /* A */ || cat === 3 /* N */) {
      pos++;
    } else if (cat === 4 /* H */) {
      pos++;
      break;
    } else {
      break;
    }
  }
  if (pos === start) {
    pos = start + 1;
  }
  return {
    start,
    end: pos,
    hasReph,
    baseConsonant
  };
}
var IndicFeatureMask = {
  nukt: 1,
  // Nukta forms
  akhn: 2,
  // Akhand forms
  rphf: 4,
  // Reph forms
  rkrf: 8,
  // Rakaar forms
  pref: 16,
  // Pre-base forms
  blwf: 32,
  // Below-base forms
  abvf: 64,
  // Above-base forms
  half: 128,
  // Half forms
  pstf: 256,
  // Post-base forms
  vatu: 512,
  // Vattu variants
  cjct: 1024,
  // Conjunct forms
  init: 2048,
  // Initial forms
  pres: 4096,
  // Pre-base substitutions
  abvs: 8192,
  // Above-base substitutions
  blws: 16384,
  // Below-base substitutions
  psts: 32768
  // Post-base substitutions
};
function getMatraPosition(cp) {
  if (cp >= 2304 && cp <= 2431) {
    if (cp === 2367) return 0 /* PreBase */;
    if (cp >= 2373 && cp <= 2376) return 1 /* AboveBase */;
    if (cp >= 2369 && cp <= 2372) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  if (cp >= 2432 && cp <= 2559) {
    if (cp === 2495) return 0 /* PreBase */;
    if (cp === 2503 || cp === 2504) return 0 /* PreBase */;
    if (cp >= 2497 && cp <= 2500) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  if (cp >= 2944 && cp <= 3071) {
    if (cp >= 3014 && cp <= 3016) return 0 /* PreBase */;
    if (cp === 3009 || cp === 3010) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  if (cp >= 3072 && cp <= 3199) {
    if (cp >= 3134 && cp <= 3136 || cp >= 3142 && cp <= 3144) {
      return 1 /* AboveBase */;
    }
    if (cp >= 3137 && cp <= 3140) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  if (cp >= 3200 && cp <= 3327) {
    if (cp >= 3262 && cp <= 3264 || cp >= 3270 && cp <= 3272) {
      return 1 /* AboveBase */;
    }
    if (cp >= 3265 && cp <= 3268) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  if (cp >= 3328 && cp <= 3455) {
    if (cp >= 3398 && cp <= 3400) return 0 /* PreBase */;
    if (cp >= 3393 && cp <= 3395) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  if (cp >= 2560 && cp <= 2687) {
    if (cp === 2623) return 0 /* PreBase */;
    if (cp === 2625 || cp === 2626) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  if (cp >= 2688 && cp <= 2815) {
    if (cp === 2751) return 0 /* PreBase */;
    if (cp >= 2753 && cp <= 2756) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  if (cp >= 2816 && cp <= 2943) {
    if (cp === 2879) return 0 /* PreBase */;
    if (cp >= 2881 && cp <= 2883) return 2 /* BelowBase */;
    return 3 /* PostBase */;
  }
  return 3 /* PostBase */;
}
function setupIndicMasks(infos) {
  const syllables = findSyllables(infos);
  for (const [i, syllable] of syllables.entries()) {
    for (let j = syllable.start; j < syllable.end; j++) {
      const info = infos[j];
      if (info) {
        info.mask = info.mask & 65535 | (i & 65535) << 16;
        const cat = getIndicCategory(info.codepoint);
        if (cat === 3 /* N */) {
          info.mask |= IndicFeatureMask.nukt;
        }
        if (cat === 4 /* H */) {
          if (j < syllable.baseConsonant) {
            info.mask |= IndicFeatureMask.half;
          } else if (j > syllable.baseConsonant) {
            info.mask |= IndicFeatureMask.blwf | IndicFeatureMask.pstf;
          }
        }
        if (cat === 1 /* C */ || cat === 15 /* Ra */) {
          if (j < syllable.baseConsonant) {
            info.mask |= IndicFeatureMask.half | IndicFeatureMask.cjct;
          } else if (j > syllable.baseConsonant) {
            info.mask |= IndicFeatureMask.blwf | IndicFeatureMask.pstf | IndicFeatureMask.vatu;
          }
        }
        if (syllable.hasReph && j < syllable.start + 2) {
          info.mask |= IndicFeatureMask.rphf;
        }
        if (cat === 7 /* M */) {
          const matraPos = getMatraPosition(info.codepoint);
          switch (matraPos) {
            case 0 /* PreBase */:
              info.mask |= IndicFeatureMask.pref | IndicFeatureMask.pres;
              break;
            case 1 /* AboveBase */:
              info.mask |= IndicFeatureMask.abvf | IndicFeatureMask.abvs;
              break;
            case 2 /* BelowBase */:
              info.mask |= IndicFeatureMask.blwf | IndicFeatureMask.blws;
              break;
            case 3 /* PostBase */:
              info.mask |= IndicFeatureMask.pstf | IndicFeatureMask.psts;
              break;
          }
        }
        if (cat === 8 /* SM */) {
          info.mask |= IndicFeatureMask.abvs | IndicFeatureMask.psts;
        }
      }
    }
  }
}
function reorderIndic(infos) {
  const syllables = findSyllables(infos);
  for (const syllable of syllables) {
    reorderSyllable(infos, syllable);
  }
}
function reorderSyllable(infos, syllable) {
  const { start, end, baseConsonant, hasReph } = syllable;
  const preBaseMatras = [];
  for (let i = baseConsonant + 1; i < end; i++) {
    const info = infos[i];
    if (!info) continue;
    const cat = getIndicCategory(info.codepoint);
    if (cat === 7 /* M */) {
      const matraPos = getMatraPosition(info.codepoint);
      if (matraPos === 0 /* PreBase */) {
        preBaseMatras.push({ index: i, info });
      }
    }
  }
  if (preBaseMatras.length > 0) {
    preBaseMatras.sort((a, b) => b.index - a.index);
    for (const { index, info } of preBaseMatras) {
      infos.splice(index, 1);
      const insertPos = hasReph ? start + 2 : start;
      infos.splice(insertPos, 0, info);
    }
  }
  if (hasReph && end > start + 2) {
    const rephRa = infos[start];
    const rephH = infos[start + 1];
    if (rephRa && rephH) {
      let rephTarget = end - 1;
      while (rephTarget > baseConsonant) {
        const targetInfo = infos[rephTarget];
        if (!targetInfo) break;
        const cat = getIndicCategory(targetInfo.codepoint);
        if (cat === 8 /* SM */ || cat === 9 /* A */) {
          rephTarget--;
        } else {
          break;
        }
      }
      if (rephTarget > start + 1) {
        infos.splice(start, 2);
        const adjustedTarget = rephTarget - 2;
        infos.splice(adjustedTarget + 1, 0, rephRa, rephH);
      }
    }
  }
}

// src/shaper/complex/khmer.ts
var KHMER_START = 6016;
var KHMER_END = 6143;
var KHMER_SYMBOLS_START = 6624;
var KHMER_SYMBOLS_END = 6655;
function getKhmerCategory(cp) {
  if (cp < KHMER_START || cp > KHMER_END) return 0 /* Other */;
  if (cp >= 6016 && cp <= 6050) return 1 /* Consonant */;
  if (cp === 6051 || cp === 6052) return 2 /* IndependentVowel */;
  if (cp >= 6053 && cp <= 6067) return 2 /* IndependentVowel */;
  if (cp >= 6070 && cp <= 6085) return 3 /* DependentVowel */;
  if (cp === 6086) return 8 /* Anusvara */;
  if (cp === 6087) return 9 /* Visarga */;
  if (cp === 6088) return 7 /* Sign */;
  if (cp === 6089 || cp === 6090) return 5 /* Register */;
  if (cp === 6098) return 4 /* Coeng */;
  if (cp === 6092) return 6 /* Robat */;
  if (cp >= 6091 && cp <= 6097) return 7 /* Sign */;
  if (cp >= 6099 && cp <= 6109) return 7 /* Sign */;
  return 0 /* Other */;
}
var KhmerFeatureMask = {
  pref: 1,
  // Pre-base forms
  blwf: 2,
  // Below-base forms
  abvf: 4,
  // Above-base forms
  pstf: 8,
  // Post-base forms
  cfar: 16,
  // Conjunct form after Ra
  pres: 32,
  // Pre-base substitutions
  abvs: 64,
  // Above-base substitutions
  blws: 128,
  // Below-base substitutions
  psts: 256,
  // Post-base substitutions
  clig: 512
  // Contextual ligatures
};
function isKhmer(cp) {
  return cp >= KHMER_START && cp <= KHMER_END || cp >= KHMER_SYMBOLS_START && cp <= KHMER_SYMBOLS_END;
}
function setupKhmerMasks(infos) {
  let i = 0;
  while (i < infos.length) {
    const info = infos[i];
    if (!info) {
      i++;
      continue;
    }
    const cat = getKhmerCategory(info.codepoint);
    if (cat === 0 /* Other */) {
      i++;
      continue;
    }
    const _syllableStart = i;
    let _base = -1;
    if (cat === 1 /* Consonant */) {
      _base = i;
    }
    let j = i + 1;
    while (j < infos.length) {
      const nextInfo = infos[j];
      if (!nextInfo) {
        j++;
        continue;
      }
      const nextCat = getKhmerCategory(nextInfo.codepoint);
      if (nextCat === 0 /* Other */) break;
      if (nextCat === 1 /* Consonant */) {
        const prevInfo = infos[j - 1];
        if (prevInfo && getKhmerCategory(prevInfo.codepoint) !== 4 /* Coeng */) {
          break;
        }
      }
      if (nextCat === 4 /* Coeng */ && j + 1 < infos.length) {
        const afterCoeng = infos[j + 1];
        if (afterCoeng && getKhmerCategory(afterCoeng.codepoint) === 1 /* Consonant */) {
          nextInfo.mask |= KhmerFeatureMask.blwf;
          afterCoeng.mask |= KhmerFeatureMask.blwf;
          j += 2;
          continue;
        }
      }
      if (nextCat === 3 /* DependentVowel */) {
        if (nextInfo.codepoint >= 6081 && nextInfo.codepoint <= 6083) {
          nextInfo.mask |= KhmerFeatureMask.pref;
        } else if (nextInfo.codepoint >= 6071 && nextInfo.codepoint <= 6074) {
          nextInfo.mask |= KhmerFeatureMask.abvf;
        } else if (nextInfo.codepoint === 6075 || nextInfo.codepoint === 6076 || nextInfo.codepoint === 6077) {
          nextInfo.mask |= KhmerFeatureMask.blwf;
        } else {
          nextInfo.mask |= KhmerFeatureMask.pstf;
        }
      }
      if (nextCat === 5 /* Register */) {
        nextInfo.mask |= KhmerFeatureMask.abvs;
      }
      if (nextCat === 6 /* Robat */) {
        nextInfo.mask |= KhmerFeatureMask.abvs;
      }
      j++;
    }
    i = j;
  }
}
function reorderKhmer(infos) {
  let i = 0;
  while (i < infos.length) {
    const info = infos[i];
    if (!info) {
      i++;
      continue;
    }
    const cat = getKhmerCategory(info.codepoint);
    if (cat !== 1 /* Consonant */) {
      i++;
      continue;
    }
    const base = i;
    let j = i + 1;
    while (j < infos.length) {
      const jInfo = infos[j];
      if (!jInfo) break;
      const jCat = getKhmerCategory(jInfo.codepoint);
      if (jCat === 4 /* Coeng */ && j + 1 < infos.length) {
        j += 2;
      } else {
        break;
      }
    }
    if (j < infos.length) {
      const jInfo = infos[j];
      if (jInfo) {
        const cp = jInfo.codepoint;
        if (cp >= 6081 && cp <= 6083) {
          const vowel = jInfo;
          for (let k = j; k > base; k--) {
            const prevInfo = infos[k - 1];
            if (prevInfo) {
              infos[k] = prevInfo;
            }
          }
          infos[base] = vowel;
        }
      }
    }
    i = j + 1;
  }
}

// src/shaper/complex/myanmar.ts
var MYANMAR_START = 4096;
var MYANMAR_END = 4255;
var MYANMAR_EXT_A_START = 43616;
var MYANMAR_EXT_A_END = 43647;
var MYANMAR_EXT_B_START = 43488;
var MYANMAR_EXT_B_END = 43519;
function getMyanmarCategory(cp) {
  if (cp >= MYANMAR_START && cp <= MYANMAR_END) {
    if (cp >= 4096 && cp <= 4129) return 1 /* Consonant */;
    if (cp >= 4131 && cp <= 4135) return 2 /* IndependentVowel */;
    if (cp >= 4137 && cp <= 4138) return 2 /* IndependentVowel */;
    if (cp >= 4139 && cp <= 4149) return 3 /* DependentVowel */;
    if (cp === 4150) return 6 /* Anusvara */;
    if (cp === 4151) return 8 /* Sign */;
    if (cp === 4152) return 7 /* Visarga */;
    if (cp === 4153) return 5 /* Asat */;
    if (cp === 4154) return 5 /* Asat */;
    if (cp >= 4155 && cp <= 4158) return 4 /* Medial */;
    if (cp >= 4159 && cp <= 4169) {
      if (cp === 4159) return 1 /* Consonant */;
      return 9 /* Number */;
    }
    if (cp >= 4170 && cp <= 4175) return 8 /* Sign */;
    if (cp >= 4176 && cp <= 4185) return 1 /* Consonant */;
    if (cp >= 4186 && cp <= 4189) return 1 /* Consonant */;
    if (cp >= 4192 && cp <= 4193) return 1 /* Consonant */;
    if (cp >= 4194 && cp <= 4196) return 3 /* DependentVowel */;
    if (cp >= 4197 && cp <= 4198) return 1 /* Consonant */;
    if (cp >= 4199 && cp <= 4205) return 3 /* DependentVowel */;
    if (cp >= 4206 && cp <= 4208) return 1 /* Consonant */;
    if (cp >= 4209 && cp <= 4212) return 3 /* DependentVowel */;
    if (cp >= 4213 && cp <= 4225) return 1 /* Consonant */;
    if (cp >= 4226 && cp <= 4226) return 4 /* Medial */;
    if (cp >= 4227 && cp <= 4236) return 3 /* DependentVowel */;
    if (cp === 4237) return 8 /* Sign */;
    if (cp === 4238) return 1 /* Consonant */;
    if (cp === 4239) return 8 /* Sign */;
    if (cp >= 4240 && cp <= 4249) return 9 /* Number */;
  }
  if (cp >= MYANMAR_EXT_A_START && cp <= MYANMAR_EXT_A_END) {
    if (cp >= 43616 && cp <= 43638) return 1 /* Consonant */;
    if (cp >= 43639 && cp <= 43641) return 8 /* Sign */;
    if (cp === 43642) return 1 /* Consonant */;
    if (cp === 43643) return 8 /* Sign */;
    if (cp === 43644) return 8 /* Sign */;
    if (cp === 43645) return 8 /* Sign */;
    if (cp >= 43646 && cp <= 43647) return 1 /* Consonant */;
  }
  if (cp >= MYANMAR_EXT_B_START && cp <= MYANMAR_EXT_B_END) {
    if (cp >= 43488 && cp <= 43492) return 1 /* Consonant */;
    if (cp === 43493) return 3 /* DependentVowel */;
    if (cp >= 43494 && cp <= 43503) return 1 /* Consonant */;
    if (cp >= 43504 && cp <= 43513) return 9 /* Number */;
    if (cp >= 43514 && cp <= 43518) return 1 /* Consonant */;
  }
  return 0 /* Other */;
}
var MyanmarFeatureMask = {
  rphf: 1,
  // Reph forms
  pref: 2,
  // Pre-base forms
  blwf: 4,
  // Below-base forms
  pstf: 8,
  // Post-base forms
  pres: 16,
  // Pre-base substitutions
  abvs: 32,
  // Above-base substitutions
  blws: 64,
  // Below-base substitutions
  psts: 128
  // Post-base substitutions
};
function isMyanmar(cp) {
  return cp >= MYANMAR_START && cp <= MYANMAR_END || cp >= MYANMAR_EXT_A_START && cp <= MYANMAR_EXT_A_END || cp >= MYANMAR_EXT_B_START && cp <= MYANMAR_EXT_B_END;
}
function setupMyanmarMasks(infos) {
  let i = 0;
  while (i < infos.length) {
    const info = infos[i];
    if (!info) {
      i++;
      continue;
    }
    const cat = getMyanmarCategory(info.codepoint);
    if (cat === 0 /* Other */) {
      i++;
      continue;
    }
    let _base = -1;
    let hasAsat = false;
    if (cat === 1 /* Consonant */) {
      _base = i;
    }
    let j = i + 1;
    while (j < infos.length) {
      const nextInfo = infos[j];
      if (!nextInfo) {
        j++;
        continue;
      }
      const nextCat = getMyanmarCategory(nextInfo.codepoint);
      if (nextCat === 0 /* Other */) break;
      if (nextCat === 5 /* Asat */) {
        hasAsat = true;
        nextInfo.mask |= MyanmarFeatureMask.blwf;
        if (j + 1 < infos.length) {
          const afterAsat = infos[j + 1];
          if (afterAsat && getMyanmarCategory(afterAsat.codepoint) === 1 /* Consonant */) {
            afterAsat.mask |= MyanmarFeatureMask.blwf;
            j += 2;
            continue;
          }
        }
      }
      if (nextCat === 4 /* Medial */) {
        const cp = nextInfo.codepoint;
        if (cp === 4155) {
          nextInfo.mask |= MyanmarFeatureMask.pref;
        } else if (cp === 4156) {
          nextInfo.mask |= MyanmarFeatureMask.pref;
        } else if (cp === 4157) {
          nextInfo.mask |= MyanmarFeatureMask.blwf;
        } else if (cp === 4158) {
          nextInfo.mask |= MyanmarFeatureMask.blwf;
        }
      }
      if (nextCat === 3 /* DependentVowel */) {
        const cp = nextInfo.codepoint;
        if (cp === 4145) {
          nextInfo.mask |= MyanmarFeatureMask.pref;
        } else if (cp === 4141 || cp === 4142 || cp === 4146) {
          nextInfo.mask |= MyanmarFeatureMask.abvs;
        } else if (cp === 4143 || cp === 4144) {
          nextInfo.mask |= MyanmarFeatureMask.blws;
        } else {
          nextInfo.mask |= MyanmarFeatureMask.psts;
        }
      }
      if (nextCat === 6 /* Anusvara */ || nextCat === 8 /* Sign */) {
        nextInfo.mask |= MyanmarFeatureMask.abvs;
      }
      if (nextCat === 1 /* Consonant */ && !hasAsat) {
        if (j > 0) {
          const prevInfo = infos[j - 1];
          if (prevInfo) {
            const prevCat = getMyanmarCategory(prevInfo.codepoint);
            if (prevCat !== 5 /* Asat */) {
              break;
            }
          }
        }
      }
      hasAsat = false;
      j++;
    }
    i = j;
  }
}
function reorderMyanmar(infos) {
  let i = 0;
  while (i < infos.length) {
    const info = infos[i];
    if (!info) {
      i++;
      continue;
    }
    const cat = getMyanmarCategory(info.codepoint);
    if (cat !== 1 /* Consonant */) {
      i++;
      continue;
    }
    const base = i;
    const preBase = [];
    let j = i + 1;
    while (j < infos.length) {
      const jInfo = infos[j];
      if (!jInfo) {
        j++;
        continue;
      }
      const jCat = getMyanmarCategory(jInfo.codepoint);
      if (jInfo.codepoint === 4145) {
        preBase.push(jInfo);
        infos.splice(j, 1);
        continue;
      }
      if (jInfo.codepoint === 4156) {
        preBase.push(jInfo);
        infos.splice(j, 1);
        continue;
      }
      if (jCat === 1 /* Consonant */ || jCat === 0 /* Other */) {
        break;
      }
      j++;
    }
    if (preBase.length > 0) {
      infos.splice(base, 0, ...preBase);
      i += preBase.length;
    }
    i++;
  }
}

// src/shaper/complex/thai-lao.ts
function isThai(cp) {
  return cp >= 3584 && cp <= 3711;
}
function isLao(cp) {
  return cp >= 3712 && cp <= 3839;
}
function getThaiLaoCategory(cp) {
  if (isThai(cp)) {
    if (cp >= 3585 && cp <= 3630) return 1 /* Consonant */;
    if (cp === 3631) return 1 /* Consonant */;
    if (cp >= 3648 && cp <= 3652) return 2 /* LeadingVowel */;
    if (cp === 3633) return 3 /* AboveVowel */;
    if (cp >= 3636 && cp <= 3639) return 3 /* AboveVowel */;
    if (cp === 3655) return 3 /* AboveVowel */;
    if (cp >= 3640 && cp <= 3642) return 4 /* BelowVowel */;
    if (cp === 3632) return 5 /* FollowingVowel */;
    if (cp === 3634 || cp === 3635) return 5 /* FollowingVowel */;
    if (cp === 3653) return 5 /* FollowingVowel */;
    if (cp === 3635) return 8 /* SaraAm */;
    if (cp >= 3656 && cp <= 3659) return 6 /* Tone */;
    if (cp === 3660) return 6 /* Tone */;
    if (cp === 3661) return 7 /* NikhahitMaiEk */;
    if (cp === 3662) return 7 /* NikhahitMaiEk */;
    if (cp >= 3664 && cp <= 3675) return 9 /* Symbol */;
    return 0 /* Other */;
  }
  if (isLao(cp)) {
    if (cp >= 3713 && cp <= 3758) return 1 /* Consonant */;
    if (cp >= 3776 && cp <= 3780) return 2 /* LeadingVowel */;
    if (cp === 3761) return 3 /* AboveVowel */;
    if (cp >= 3764 && cp <= 3767) return 3 /* AboveVowel */;
    if (cp === 3771) return 3 /* AboveVowel */;
    if (cp >= 3768 && cp <= 3769) return 4 /* BelowVowel */;
    if (cp === 3772) return 4 /* BelowVowel */;
    if (cp === 3760) return 5 /* FollowingVowel */;
    if (cp === 3762 || cp === 3763) return 5 /* FollowingVowel */;
    if (cp >= 3784 && cp <= 3789) return 6 /* Tone */;
    if (cp >= 3792 && cp <= 3801) return 9 /* Symbol */;
    return 0 /* Other */;
  }
  return 0 /* Other */;
}
function setupThaiLaoMasks(infos) {
  let clusterIndex = 0;
  let _consonantIndex = -1;
  for (let i = 0; i < infos.length; i++) {
    const info = infos[i];
    if (!info) continue;
    const cat = getThaiLaoCategory(info.codepoint);
    if (cat === 1 /* Consonant */) {
      clusterIndex++;
      _consonantIndex = i;
    }
    info.mask = info.mask & 4294967040 | cat & 255;
    info.mask = info.mask & 65535 | (clusterIndex & 65535) << 16;
    if (cat === 2 /* LeadingVowel */) {
      info.mask |= 256;
    }
  }
}
function reorderThaiLao(infos) {
  let i = 0;
  while (i < infos.length) {
    const info = infos[i];
    if (!info) {
      i++;
      continue;
    }
    const cat = getThaiLaoCategory(info.codepoint);
    if (cat === 2 /* LeadingVowel */) {
      let j = i + 1;
      while (j < infos.length) {
        const nextInfo = infos[j];
        if (!nextInfo) {
          j++;
          continue;
        }
        const nextCat = getThaiLaoCategory(nextInfo.codepoint ?? 0);
        if (nextCat === 1 /* Consonant */) {
          const temp = info;
          infos[i] = nextInfo;
          infos[j] = temp;
          break;
        }
        if (nextCat !== 2 /* LeadingVowel */) {
          break;
        }
        j++;
      }
    }
    i++;
  }
}

// src/shaper/complex/use.ts
function usesUSE(script) {
  const useScripts = [
    "bali",
    // Balinese
    "batk",
    // Batak
    "brah",
    // Brahmi
    "bugi",
    // Buginese
    "buhd",
    // Buhid
    "cakm",
    // Chakma
    "cham",
    // Cham
    "dupl",
    // Duployan
    "egyp",
    // Egyptian Hieroglyphs
    "gran",
    // Grantha
    "hano",
    // Hanunoo
    "java",
    // Javanese
    "kthi",
    // Kaithi
    "khar",
    // Kharoshthi
    "khmr",
    // Khmer
    "khoj",
    // Khojki
    "lana",
    // Tai Tham
    "lepc",
    // Lepcha
    "limb",
    // Limbu
    "mahj",
    // Mahajani
    "modi",
    // Modi
    "mtei",
    // Meetei Mayek
    "mymr",
    // Myanmar
    "newa",
    // Newa
    "phlp",
    // Psalter Pahlavi
    "rjng",
    // Rejang
    "saur",
    // Saurashtra
    "shrd",
    // Sharada
    "sidd",
    // Siddham
    "sind",
    // Sindhi (Khudawadi)
    "sinh",
    // Sinhala
    "sund",
    // Sundanese
    "sylo",
    // Syloti Nagri
    "tagb",
    // Tagbanwa
    "takr",
    // Takri
    "tale",
    // Tai Le
    "talu",
    // New Tai Lue
    "tavt",
    // Tai Viet
    "tibt",
    // Tibetan
    "tirh"
    // Tirhuta
  ];
  return useScripts.includes(script);
}
function getUseCategory(cp) {
  if (cp === 8204) return 21 /* ZWNJ */;
  if (cp === 8205) return 20 /* ZWJ */;
  if (cp === 847) return 2 /* CGJ */;
  if (cp === 8288) return 19 /* WJ */;
  if (cp >= 65024 && cp <= 65039) return 18 /* VS */;
  if (cp >= 917760 && cp <= 917999) return 18 /* VS */;
  if (cp >= 4096 && cp <= 4255) {
    if (cp >= 4096 && cp <= 4128) return 1 /* B */;
    if (cp >= 4129 && cp <= 4138) return 10 /* IND */;
    if (cp >= 4139 && cp <= 4146) return 31 /* VPst */;
    if (cp >= 4150 && cp <= 4151) return 32 /* SMAbv */;
    if (cp === 4153) return 8 /* H */;
    if (cp === 4154) return 8 /* H */;
    if (cp >= 4155 && cp <= 4158) return 38 /* MBlw */;
    if (cp >= 4160 && cp <= 4169) return 7 /* GB */;
    return 0 /* O */;
  }
  if (cp >= 6016 && cp <= 6143) {
    if (cp >= 6016 && cp <= 6050) return 1 /* B */;
    if (cp >= 6051 && cp <= 6067) return 10 /* IND */;
    if (cp >= 6070 && cp <= 6085) return 31 /* VPst */;
    if (cp === 6098) return 8 /* H */;
    if (cp >= 6086 && cp <= 6088) return 32 /* SMAbv */;
    return 0 /* O */;
  }
  if (cp >= 3840 && cp <= 4095) {
    if (cp >= 3840 && cp <= 3863) return 14 /* S */;
    if (cp >= 3953 && cp <= 3965) return 28 /* VAbv */;
    if (cp >= 3984 && cp <= 4028) return 17 /* SUB */;
    if (cp >= 3904 && cp <= 3948) return 1 /* B */;
    return 0 /* O */;
  }
  if (cp >= 3584 && cp <= 3711) {
    if (cp >= 3585 && cp <= 3630) return 1 /* B */;
    if (cp >= 3632 && cp <= 3642) return 31 /* VPst */;
    if (cp >= 3648 && cp <= 3652) return 30 /* VPre */;
    if (cp >= 3656 && cp <= 3659) return 32 /* SMAbv */;
    return 0 /* O */;
  }
  if (cp >= 3712 && cp <= 3839) {
    if (cp >= 3713 && cp <= 3747) return 1 /* B */;
    if (cp >= 3760 && cp <= 3772) return 31 /* VPst */;
    if (cp >= 3776 && cp <= 3780) return 30 /* VPre */;
    if (cp >= 3784 && cp <= 3789) return 32 /* SMAbv */;
    return 0 /* O */;
  }
  if (cp >= 57344 && cp <= 57599) {
    if (cp === 57344) return 13 /* R */;
    if (cp === 57345) return 24 /* VMAbv */;
    if (cp === 57346) return 25 /* VMBlw */;
    if (cp === 57347) return 26 /* VMPre */;
    if (cp === 57348) return 27 /* VMPst */;
    if (cp === 57349) return 4 /* CS */;
    if (cp === 57350) return 12 /* N */;
    if (cp === 57351) return 9 /* HN */;
    if (cp === 57352) return 23 /* VD */;
    if (cp === 57353) return 29 /* VBlw */;
    if (cp === 57354) return 37 /* MAbv */;
    if (cp === 57355) return 39 /* MPre */;
    if (cp === 57356) return 40 /* MPst */;
    if (cp === 57357) return 33 /* SMBlw */;
    if (cp === 57358) return 34 /* FAbv */;
    if (cp === 57359) return 35 /* FBlw */;
    if (cp === 57360) return 36 /* FPst */;
    if (cp === 57361) return 5 /* F */;
    if (cp === 57362) return 6 /* FM */;
  }
  return 0 /* O */;
}
var UseFeatureMask = {
  rphf: 1,
  // Reph forms
  pref: 2,
  // Pre-base forms
  blwf: 4,
  // Below-base forms
  abvf: 8,
  // Above-base forms
  pstf: 16,
  // Post-base forms
  half: 32,
  // Half forms
  cjct: 64,
  // Conjunct forms
  vatu: 128,
  // Vattu variants
  pres: 256,
  // Pre-base substitutions
  abvs: 512,
  // Above-base substitutions
  blws: 1024,
  // Below-base substitutions
  psts: 2048,
  // Post-base substitutions
  haln: 4096
  // Halant forms
};
function findUseSyllables(infos) {
  const syllables = [];
  const n = infos.length;
  if (n === 0) return syllables;
  let start = 0;
  while (start < n) {
    const syllable = parseUseSyllable(infos, start);
    syllables.push(syllable);
    start = syllable.end;
  }
  return syllables;
}
function parseUseSyllable(infos, start) {
  const n = infos.length;
  let pos = start;
  let base = -1;
  let hasReph = false;
  if (pos + 1 < n) {
    const info1 = infos[pos];
    const info2 = infos[pos + 1];
    if (info1 && info2) {
      const cat1 = getUseCategory(info1.codepoint ?? 0);
      const cat2 = getUseCategory(info2.codepoint ?? 0);
      if (cat1 === 13 /* R */ && cat2 === 8 /* H */) {
        hasReph = true;
        pos += 2;
      }
    }
  }
  while (pos < n) {
    const info = infos[pos];
    if (!info) {
      pos++;
      continue;
    }
    const cat = getUseCategory(info.codepoint ?? 0);
    if (cat === 1 /* B */ || cat === 10 /* IND */ || cat === 7 /* GB */ || cat === 22 /* V */) {
      base = pos;
      pos++;
      break;
    }
    if (cat === 26 /* VMPre */ || cat === 30 /* VPre */ || cat === 39 /* MPre */) {
      pos++;
      continue;
    }
    if (base === -1) {
      pos++;
    }
    break;
  }
  if (base === -1) base = start;
  while (pos < n) {
    const posInfo = infos[pos];
    if (!posInfo) {
      pos++;
      continue;
    }
    const cat = getUseCategory(posInfo.codepoint ?? 0);
    if (cat === 8 /* H */) {
      pos++;
      if (pos < n) {
        const nextInfo = infos[pos];
        if (nextInfo) {
          const nextCat = getUseCategory(nextInfo.codepoint ?? 0);
          if (nextCat === 1 /* B */ || nextCat === 4 /* CS */ || nextCat === 17 /* SUB */) {
            pos++;
            continue;
          }
          if (nextCat === 20 /* ZWJ */ || nextCat === 21 /* ZWNJ */) {
            pos++;
          }
        }
      }
      continue;
    }
    if (cat === 17 /* SUB */ || cat === 4 /* CS */) {
      pos++;
      continue;
    }
    if (cat === 12 /* N */ || cat === 9 /* HN */) {
      pos++;
      continue;
    }
    break;
  }
  while (pos < n) {
    const posInfo = infos[pos];
    if (!posInfo) {
      pos++;
      continue;
    }
    const cat = getUseCategory(posInfo.codepoint ?? 0);
    if (cat === 28 /* VAbv */ || cat === 29 /* VBlw */ || cat === 30 /* VPre */ || cat === 31 /* VPst */ || cat === 23 /* VD */) {
      pos++;
      continue;
    }
    if (cat === 37 /* MAbv */ || cat === 38 /* MBlw */ || cat === 39 /* MPre */ || cat === 40 /* MPst */) {
      pos++;
      continue;
    }
    if (cat === 24 /* VMAbv */ || cat === 25 /* VMBlw */ || cat === 26 /* VMPre */ || cat === 27 /* VMPst */) {
      pos++;
      continue;
    }
    if (cat === 32 /* SMAbv */ || cat === 33 /* SMBlw */) {
      pos++;
      continue;
    }
    if (cat === 34 /* FAbv */ || cat === 35 /* FBlw */ || cat === 36 /* FPst */ || cat === 5 /* F */ || cat === 6 /* FM */) {
      pos++;
      continue;
    }
    if (cat === 2 /* CGJ */ || cat === 18 /* VS */) {
      pos++;
      continue;
    }
    break;
  }
  if (pos === start) {
    pos = start + 1;
  }
  return { start, end: pos, base, hasReph };
}
function setupUseMasks(infos) {
  const syllables = findUseSyllables(infos);
  for (const [i, syllable] of syllables.entries()) {
    for (let j = syllable.start; j < syllable.end; j++) {
      const info = infos[j];
      if (!info) continue;
      info.mask = info.mask & 65535 | (i & 65535) << 16;
      const cat = getUseCategory(info.codepoint);
      if (syllable.hasReph && j < syllable.start + 2) {
        info.mask |= UseFeatureMask.rphf;
      }
      if (j < syllable.base) {
        if (cat === 1 /* B */ || cat === 4 /* CS */ || cat === 17 /* SUB */) {
          info.mask |= UseFeatureMask.half | UseFeatureMask.cjct;
        }
      }
      if (j > syllable.base) {
        if (cat === 1 /* B */ || cat === 4 /* CS */ || cat === 17 /* SUB */) {
          info.mask |= UseFeatureMask.blwf | UseFeatureMask.pstf | UseFeatureMask.vatu;
        }
      }
      if (cat === 8 /* H */ || cat === 9 /* HN */) {
        if (j < syllable.base) {
          info.mask |= UseFeatureMask.half;
        } else {
          info.mask |= UseFeatureMask.haln;
        }
      }
      if (cat === 30 /* VPre */) {
        info.mask |= UseFeatureMask.pref | UseFeatureMask.pres;
      } else if (cat === 28 /* VAbv */) {
        info.mask |= UseFeatureMask.abvf | UseFeatureMask.abvs;
      } else if (cat === 29 /* VBlw */) {
        info.mask |= UseFeatureMask.blwf | UseFeatureMask.blws;
      } else if (cat === 31 /* VPst */ || cat === 23 /* VD */) {
        info.mask |= UseFeatureMask.pstf | UseFeatureMask.psts;
      }
      if (cat === 37 /* MAbv */) {
        info.mask |= UseFeatureMask.abvs;
      } else if (cat === 38 /* MBlw */) {
        info.mask |= UseFeatureMask.blws;
      } else if (cat === 39 /* MPre */) {
        info.mask |= UseFeatureMask.pres;
      } else if (cat === 40 /* MPst */) {
        info.mask |= UseFeatureMask.psts;
      }
      if (cat === 32 /* SMAbv */) {
        info.mask |= UseFeatureMask.abvs;
      } else if (cat === 33 /* SMBlw */) {
        info.mask |= UseFeatureMask.blws;
      }
      if (cat === 34 /* FAbv */) {
        info.mask |= UseFeatureMask.abvs;
      } else if (cat === 35 /* FBlw */) {
        info.mask |= UseFeatureMask.blws;
      } else if (cat === 36 /* FPst */ || cat === 5 /* F */ || cat === 6 /* FM */) {
        info.mask |= UseFeatureMask.psts;
      }
    }
  }
}
function reorderUSE(infos) {
  const syllables = findUseSyllables(infos);
  for (const syllable of syllables) {
    reorderUseSyllable(infos, syllable);
  }
}
function reorderUseSyllable(infos, syllable) {
  const { start, end, base, hasReph } = syllable;
  const preBaseVowels = [];
  for (let i = base + 1; i < end; i++) {
    const info = infos[i];
    if (!info) continue;
    const cat = getUseCategory(info.codepoint);
    if (cat === 30 /* VPre */ || cat === 39 /* MPre */) {
      preBaseVowels.push({ index: i, info });
    }
  }
  if (preBaseVowels.length > 0) {
    preBaseVowels.sort((a, b) => b.index - a.index);
    for (const { index, info } of preBaseVowels) {
      infos.splice(index, 1);
      const insertPos = hasReph ? start + 2 : start;
      infos.splice(insertPos, 0, info);
    }
  }
  if (hasReph && end > start + 2) {
    const rephStart = infos[start];
    const rephH = infos[start + 1];
    if (rephStart && rephH) {
      let rephTarget = end - 1;
      while (rephTarget > base) {
        const targetInfo = infos[rephTarget];
        if (!targetInfo) break;
        const cat = getUseCategory(targetInfo.codepoint);
        if (cat === 32 /* SMAbv */ || cat === 33 /* SMBlw */ || cat === 34 /* FAbv */ || cat === 35 /* FBlw */ || cat === 36 /* FPst */ || cat === 5 /* F */ || cat === 6 /* FM */) {
          rephTarget--;
        } else {
          break;
        }
      }
      if (rephTarget > start + 1) {
        infos.splice(start, 2);
        const adjustedTarget = rephTarget - 2;
        infos.splice(adjustedTarget + 1, 0, rephStart, rephH);
      }
    }
  }
}

// src/shaper/shaper.ts
function getFont(fontLike) {
  return fontLike instanceof Face ? fontLike.font : fontLike;
}
function getFace(fontLike) {
  return fontLike instanceof Face ? fontLike : new Face(fontLike);
}
function shape(fontLike, buffer, options = {}) {
  const font = getFont(fontLike);
  const face = getFace(fontLike);
  const script = options.script ?? buffer.script ?? "latn";
  const language = options.language ?? buffer.language ?? null;
  const direction = options.direction ?? "ltr";
  const features2 = options.features ?? [];
  const axisCoords = face.normalizedCoords.length > 0 ? face.normalizedCoords : null;
  const plan = createShapePlan(font, script, language, direction, features2, axisCoords);
  const glyphBuffer = new GlyphBuffer();
  glyphBuffer.direction = buffer.direction;
  glyphBuffer.script = script;
  glyphBuffer.language = language;
  const infos = [];
  for (const [i, codepoint] of buffer.codepoints.entries()) {
    const cluster = buffer.clusters[i];
    if (cluster === void 0) continue;
    const glyphId = font.glyphId(codepoint);
    infos.push({
      glyphId,
      cluster,
      mask: 4294967295,
      codepoint
    });
  }
  glyphBuffer.initFromInfos(infos);
  preShape(glyphBuffer, script);
  applyGsub(font, glyphBuffer, plan);
  initializePositions(face, glyphBuffer);
  const hasGpos = font.gpos !== null && plan.gposLookups.length > 0;
  if (hasGpos) {
    applyGpos(font, glyphBuffer, plan);
  } else {
    applyFallbackKerning(font, glyphBuffer.infos, glyphBuffer.positions);
    applyFallbackMarkPositioning(
      font,
      glyphBuffer.infos,
      glyphBuffer.positions
    );
  }
  if (!font.gsub && font.morx) {
    applyMorx(font, glyphBuffer);
  }
  if (direction === "rtl") {
    glyphBuffer.reverse();
  }
  return glyphBuffer;
}
function preShape(buffer, script) {
  if (script === "arab" || script === "syrc" || script === "mand" || script === "nko ") {
    setupArabicMasks(buffer.infos);
    return;
  }
  if (script === "hebr") {
    setupHebrewMasks(buffer.infos);
    return;
  }
  if (script === "hang" || script === "kore") {
    const normalized = normalizeHangul(buffer.infos);
    if (normalized.length !== buffer.infos.length) {
      buffer.initFromInfos(normalized);
    }
    setupHangulMasks(buffer.infos);
    return;
  }
  if (script === "deva" || script === "beng" || script === "guru" || script === "gujr" || script === "orya" || script === "taml" || script === "telu" || script === "knda" || script === "mlym") {
    setupIndicMasks(buffer.infos);
    reorderIndic(buffer.infos);
    return;
  }
  if (script === "thai" || script === "lao ") {
    setupThaiLaoMasks(buffer.infos);
    reorderThaiLao(buffer.infos);
    return;
  }
  if (script === "khmr") {
    setupKhmerMasks(buffer.infos);
    reorderKhmer(buffer.infos);
    return;
  }
  if (script === "mymr") {
    setupMyanmarMasks(buffer.infos);
    reorderMyanmar(buffer.infos);
    return;
  }
  if (usesUSE(script)) {
    setupUseMasks(buffer.infos);
    reorderUSE(buffer.infos);
    return;
  }
  if (script === "Zyyy" || script === "Zinh" || script === "Zzzz") {
    detectAndApplyComplexShaping(buffer.infos);
  }
}
function detectAndApplyComplexShaping(infos) {
  if (infos.length === 0) return;
  const sample = infos.slice(0, Math.min(10, infos.length));
  for (const info of sample) {
    const cp = info.codepoint;
    if (cp >= 1536 && cp <= 1791 || cp >= 1872 && cp <= 1919 || cp >= 2208 && cp <= 2303) {
      setupArabicMasks(infos);
      return;
    }
    if (cp >= 1424 && cp <= 1535) {
      setupHebrewMasks(infos);
      return;
    }
    if (isKorean(cp)) {
      const normalized = normalizeHangul(infos);
      if (normalized.length !== infos.length) {
        infos.length = 0;
        infos.push(...normalized);
      }
      setupHangulMasks(infos);
      return;
    }
    if (isIndic(cp)) {
      setupIndicMasks(infos);
      reorderIndic(infos);
      return;
    }
    if (isThai(cp)) {
      setupThaiLaoMasks(infos);
      reorderThaiLao(infos);
      return;
    }
    if (isLao(cp)) {
      setupThaiLaoMasks(infos);
      reorderThaiLao(infos);
      return;
    }
    if (isKhmer(cp)) {
      setupKhmerMasks(infos);
      reorderKhmer(infos);
      return;
    }
    if (isMyanmar(cp)) {
      setupMyanmarMasks(infos);
      reorderMyanmar(infos);
      return;
    }
  }
}
function applyGsub(font, buffer, plan) {
  for (const { lookup } of plan.gsubLookups) {
    applyGsubLookup(font, buffer, lookup, plan);
  }
}
function applyGsubLookup(font, buffer, lookup, plan) {
  switch (lookup.type) {
    case 1 /* Single */:
      applySingleSubstLookup(font, buffer, lookup);
      break;
    case 2 /* Multiple */:
      applyMultipleSubstLookup(font, buffer, lookup);
      break;
    case 3 /* Alternate */:
      applyAlternateSubstLookup(font, buffer, lookup);
      break;
    case 4 /* Ligature */:
      applyLigatureSubstLookup(font, buffer, lookup);
      break;
    case 5 /* Context */:
      applyContextSubstLookup(font, buffer, lookup, plan);
      break;
    case 6 /* ChainingContext */:
      applyChainingContextSubstLookup(font, buffer, lookup, plan);
      break;
    // Note: Extension lookups (Type 7) are unwrapped during parsing
    // and converted to their actual lookup types, so no case needed here
    case 8 /* ReverseChainingSingle */:
      applyReverseChainingSingleSubstLookup(font, buffer, lookup);
      break;
  }
}
function applySingleSubstLookup(font, buffer, lookup) {
  for (const info of buffer.infos) {
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
    const replacement = applySingleSubst(lookup, info.glyphId);
    if (replacement !== null) {
      info.glyphId = replacement;
    }
  }
}
function applyMultipleSubstLookup(font, buffer, lookup) {
  let i = 0;
  while (i < buffer.infos.length) {
    const info = buffer.infos[i];
    if (!info) {
      i++;
      continue;
    }
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) {
      i++;
      continue;
    }
    let applied = false;
    for (const subtable of lookup.subtables) {
      const coverageIndex = subtable.coverage.get(info.glyphId);
      if (coverageIndex === null) continue;
      const sequence = subtable.sequences[coverageIndex];
      if (!sequence || sequence.length === 0) continue;
      const [firstGlyph, ...restGlyphs] = sequence;
      if (firstGlyph === void 0) continue;
      info.glyphId = firstGlyph;
      for (const [j, glyphId] of restGlyphs.entries()) {
        const newInfo = {
          glyphId,
          cluster: info.cluster,
          mask: info.mask,
          codepoint: info.codepoint
        };
        const newPos = {
          xAdvance: 0,
          yAdvance: 0,
          xOffset: 0,
          yOffset: 0
        };
        buffer.insertGlyph(i + j + 1, newInfo, newPos);
      }
      i += sequence.length;
      applied = true;
      break;
    }
    if (!applied) i++;
  }
}
function applyAlternateSubstLookup(font, buffer, lookup) {
  for (const info of buffer.infos) {
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
    for (const subtable of lookup.subtables) {
      const coverageIndex = subtable.coverage.get(info.glyphId);
      if (coverageIndex === null) continue;
      const alternateSet = subtable.alternateSets[coverageIndex];
      if (!alternateSet || alternateSet.length === 0) continue;
      const [firstAlternate] = alternateSet;
      if (firstAlternate === void 0) continue;
      info.glyphId = firstAlternate;
      break;
    }
  }
}
function applyLigatureSubstLookup(font, buffer, lookup) {
  let i = 0;
  while (i < buffer.infos.length) {
    const info = buffer.infos[i];
    if (!info) {
      i++;
      continue;
    }
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) {
      i++;
      continue;
    }
    const matchIndices = [i];
    const matchGlyphs = [info.glyphId];
    for (let j = i + 1; j < buffer.infos.length && matchGlyphs.length < 16; j++) {
      const nextInfo = buffer.infos[j];
      if (!nextInfo) continue;
      if (shouldSkipGlyph(font, nextInfo.glyphId, lookup.flag)) continue;
      matchIndices.push(j);
      matchGlyphs.push(nextInfo.glyphId);
    }
    const result = applyLigatureSubst(lookup, matchGlyphs, 0);
    if (result) {
      info.glyphId = result.ligatureGlyph;
      const indicesToRemove = [];
      for (let k = 1; k < result.consumed; k++) {
        const idx = matchIndices[k];
        if (idx !== void 0) {
          const targetInfo = buffer.infos[idx];
          if (targetInfo) {
            info.cluster = Math.min(info.cluster, targetInfo.cluster);
          }
          indicesToRemove.push(idx);
        }
      }
      for (const idx of indicesToRemove.reverse()) {
        buffer.removeRange(idx, idx + 1);
      }
    }
    i++;
  }
}
function applyContextSubstLookup(font, buffer, lookup, plan) {
  for (let i = 0; i < buffer.infos.length; i++) {
    const info = buffer.infos[i];
    if (!info) continue;
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
    for (const subtable of lookup.subtables) {
      let matched = false;
      let lookupRecords = [];
      if (subtable.format === 1) {
        const result = matchContextFormat1(
          font,
          buffer,
          i,
          subtable,
          lookup.flag
        );
        if (result) {
          matched = true;
          lookupRecords = result;
        }
      } else if (subtable.format === 2) {
        const result = matchContextFormat2(
          font,
          buffer,
          i,
          subtable,
          lookup.flag
        );
        if (result) {
          matched = true;
          lookupRecords = result;
        }
      } else if (subtable.format === 3) {
        if (matchContextFormat3(font, buffer, i, subtable, lookup.flag)) {
          matched = true;
          lookupRecords = subtable.lookupRecords;
        }
      }
      if (matched) {
        applyNestedLookups(font, buffer, i, lookupRecords, plan);
        break;
      }
    }
  }
}
function applyChainingContextSubstLookup(font, buffer, lookup, plan) {
  for (let i = 0; i < buffer.infos.length; i++) {
    const info = buffer.infos[i];
    if (!info) continue;
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
    for (const subtable of lookup.subtables) {
      let matched = false;
      let lookupRecords = [];
      if (subtable.format === 1) {
        const result = matchChainingFormat1(
          font,
          buffer,
          i,
          subtable,
          lookup.flag
        );
        if (result) {
          matched = true;
          lookupRecords = result;
        }
      } else if (subtable.format === 2) {
        const result = matchChainingFormat2(
          font,
          buffer,
          i,
          subtable,
          lookup.flag
        );
        if (result) {
          matched = true;
          lookupRecords = result;
        }
      } else if (subtable.format === 3) {
        if (matchChainingFormat3(font, buffer, i, subtable, lookup.flag)) {
          matched = true;
          lookupRecords = subtable.lookupRecords;
        }
      }
      if (matched) {
        applyNestedLookups(font, buffer, i, lookupRecords, plan);
        break;
      }
    }
  }
}
function applyReverseChainingSingleSubstLookup(font, buffer, lookup) {
  for (let i = buffer.infos.length - 1; i >= 0; i--) {
    const info = buffer.infos[i];
    if (!info) continue;
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
    for (const subtable of lookup.subtables) {
      const coverageIndex = subtable.coverage.get(info.glyphId);
      if (coverageIndex === null) continue;
      let backtrackMatch = true;
      let backtrackPos = i + 1;
      for (const backCov of subtable.backtrackCoverages) {
        while (backtrackPos < buffer.infos.length && shouldSkipGlyph(
          font,
          buffer.infos[backtrackPos]?.glyphId,
          lookup.flag
        )) {
          backtrackPos++;
        }
        if (backtrackPos >= buffer.infos.length || backCov.get(buffer.infos[backtrackPos]?.glyphId) === null) {
          backtrackMatch = false;
          break;
        }
        backtrackPos++;
      }
      if (!backtrackMatch) continue;
      let lookaheadMatch = true;
      let lookaheadPos = i - 1;
      for (const lookCov of subtable.lookaheadCoverages) {
        while (lookaheadPos >= 0 && shouldSkipGlyph(
          font,
          buffer.infos[lookaheadPos]?.glyphId,
          lookup.flag
        )) {
          lookaheadPos--;
        }
        if (lookaheadPos < 0 || lookCov.get(buffer.infos[lookaheadPos]?.glyphId) === null) {
          lookaheadMatch = false;
          break;
        }
        lookaheadPos--;
      }
      if (!lookaheadMatch) continue;
      const substitute = subtable.substituteGlyphIds[coverageIndex];
      if (substitute !== void 0) {
        info.glyphId = substitute;
      }
      break;
    }
  }
}
function matchContextFormat1(font, buffer, startIndex, subtable, lookupFlag) {
  const firstGlyph = buffer.infos[startIndex]?.glyphId;
  const coverageIndex = subtable.coverage.get(firstGlyph);
  if (coverageIndex === null) return null;
  const ruleSet = subtable.ruleSets[coverageIndex];
  if (!ruleSet) return null;
  for (const rule of ruleSet) {
    if (matchGlyphSequence(
      font,
      buffer,
      startIndex + 1,
      rule.inputSequence,
      lookupFlag
    )) {
      return rule.lookupRecords;
    }
  }
  return null;
}
function matchContextFormat2(font, buffer, startIndex, subtable, lookupFlag) {
  const firstGlyph = buffer.infos[startIndex]?.glyphId;
  const coverageIndex = subtable.coverage.get(firstGlyph);
  if (coverageIndex === null) return null;
  const firstClass = subtable.classDef.get(firstGlyph);
  const classRuleSet = subtable.classRuleSets[firstClass];
  if (!classRuleSet) return null;
  for (const rule of classRuleSet) {
    if (matchClassSequence(
      font,
      buffer,
      startIndex + 1,
      rule.inputClasses,
      subtable.classDef,
      lookupFlag
    )) {
      return rule.lookupRecords;
    }
  }
  return null;
}
function matchContextFormat3(font, buffer, startIndex, subtable, lookupFlag) {
  let pos = startIndex;
  for (const coverage of subtable.coverages) {
    while (pos < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)) {
      pos++;
    }
    if (pos >= buffer.infos.length) return false;
    if (coverage.get(buffer.infos[pos]?.glyphId) === null) return false;
    pos++;
  }
  return true;
}
function matchChainingFormat1(font, buffer, startIndex, subtable, lookupFlag) {
  const firstGlyph = buffer.infos[startIndex]?.glyphId;
  const coverageIndex = subtable.coverage.get(firstGlyph);
  if (coverageIndex === null) return null;
  const chainRuleSet = subtable.chainRuleSets[coverageIndex];
  if (!chainRuleSet) return null;
  for (const rule of chainRuleSet) {
    if (!matchGlyphSequenceBackward(
      font,
      buffer,
      startIndex - 1,
      rule.backtrackSequence,
      lookupFlag
    )) {
      continue;
    }
    if (!matchGlyphSequence(
      font,
      buffer,
      startIndex + 1,
      rule.inputSequence,
      lookupFlag
    )) {
      continue;
    }
    let inputEnd = startIndex + 1;
    for (let i = 0; i < rule.inputSequence.length; i++) {
      while (inputEnd < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[inputEnd]?.glyphId, lookupFlag)) {
        inputEnd++;
      }
      inputEnd++;
    }
    if (!matchGlyphSequence(
      font,
      buffer,
      inputEnd,
      rule.lookaheadSequence,
      lookupFlag
    )) {
      continue;
    }
    return rule.lookupRecords;
  }
  return null;
}
function matchChainingFormat2(font, buffer, startIndex, subtable, lookupFlag) {
  const firstGlyph = buffer.infos[startIndex]?.glyphId;
  const coverageIndex = subtable.coverage.get(firstGlyph);
  if (coverageIndex === null) return null;
  const firstClass = subtable.inputClassDef.get(firstGlyph);
  const chainClassRuleSet = subtable.chainClassRuleSets[firstClass];
  if (!chainClassRuleSet) return null;
  for (const rule of chainClassRuleSet) {
    if (!matchClassSequenceBackward(
      font,
      buffer,
      startIndex - 1,
      rule.backtrackClasses,
      subtable.backtrackClassDef,
      lookupFlag
    )) {
      continue;
    }
    if (!matchClassSequence(
      font,
      buffer,
      startIndex + 1,
      rule.inputClasses,
      subtable.inputClassDef,
      lookupFlag
    )) {
      continue;
    }
    let inputEnd = startIndex + 1;
    for (let i = 0; i < rule.inputClasses.length; i++) {
      while (inputEnd < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[inputEnd]?.glyphId, lookupFlag)) {
        inputEnd++;
      }
      inputEnd++;
    }
    if (!matchClassSequence(
      font,
      buffer,
      inputEnd,
      rule.lookaheadClasses,
      subtable.lookaheadClassDef,
      lookupFlag
    )) {
      continue;
    }
    return rule.lookupRecords;
  }
  return null;
}
function matchChainingFormat3(font, buffer, startIndex, subtable, lookupFlag) {
  let backtrackPos = startIndex - 1;
  for (const coverage of subtable.backtrackCoverages) {
    while (backtrackPos >= 0 && shouldSkipGlyph(font, buffer.infos[backtrackPos]?.glyphId, lookupFlag)) {
      backtrackPos--;
    }
    if (backtrackPos < 0) return false;
    if (coverage.get(buffer.infos[backtrackPos]?.glyphId) === null)
      return false;
    backtrackPos--;
  }
  let inputPos = startIndex;
  for (const coverage of subtable.inputCoverages) {
    while (inputPos < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[inputPos]?.glyphId, lookupFlag)) {
      inputPos++;
    }
    if (inputPos >= buffer.infos.length) return false;
    if (coverage.get(buffer.infos[inputPos]?.glyphId) === null) return false;
    inputPos++;
  }
  let lookaheadPos = inputPos;
  for (const coverage of subtable.lookaheadCoverages) {
    while (lookaheadPos < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[lookaheadPos]?.glyphId, lookupFlag)) {
      lookaheadPos++;
    }
    if (lookaheadPos >= buffer.infos.length) return false;
    if (coverage.get(buffer.infos[lookaheadPos]?.glyphId) === null)
      return false;
    lookaheadPos++;
  }
  return true;
}
function applyNestedLookups(_font, buffer, startIndex, lookupRecords, plan) {
  const sorted = [...lookupRecords].sort(
    (a, b) => b.sequenceIndex - a.sequenceIndex
  );
  for (const record of sorted) {
    const lookupEntry = plan.gsubLookups.find(
      (l) => l.index === record.lookupListIndex
    );
    if (!lookupEntry) continue;
    const pos = startIndex + record.sequenceIndex;
    if (pos >= buffer.infos.length) continue;
    const targetInfo = buffer.infos[pos];
    if (!targetInfo) continue;
    if (lookupEntry.lookup.type === 1 /* Single */) {
      const replacement = applySingleSubst(
        lookupEntry.lookup,
        targetInfo.glyphId
      );
      if (replacement !== null) {
        targetInfo.glyphId = replacement;
      }
    }
  }
}
function initializePositions(face, buffer) {
  for (const [i, info] of buffer.infos.entries()) {
    const advance = face.advanceWidth(info.glyphId);
    buffer.setAdvance(i, advance, 0);
  }
}
function applyGpos(font, buffer, plan) {
  for (const { lookup } of plan.gposLookups) {
    applyGposLookup(font, buffer, lookup, plan);
  }
}
function applyGposLookup(font, buffer, lookup, plan) {
  switch (lookup.type) {
    case 1 /* Single */:
      applySinglePosLookup(font, buffer, lookup);
      break;
    case 2 /* Pair */:
      applyPairPosLookup(font, buffer, lookup);
      break;
    case 3 /* Cursive */:
      applyCursivePosLookup(font, buffer, lookup);
      break;
    case 4 /* MarkToBase */:
      applyMarkBasePosLookup(font, buffer, lookup);
      break;
    case 5 /* MarkToLigature */:
      applyMarkLigaturePosLookup(font, buffer, lookup);
      break;
    case 6 /* MarkToMark */:
      applyMarkMarkPosLookup(font, buffer, lookup);
      break;
    case 7 /* Context */:
      applyContextPosLookup(font, buffer, lookup, plan);
      break;
    case 8 /* ChainingContext */:
      applyChainingContextPosLookup(
        font,
        buffer,
        lookup,
        plan
      );
      break;
  }
}
function applySinglePosLookup(font, buffer, lookup) {
  for (const [i, info] of buffer.infos.entries()) {
    const pos = buffer.positions[i];
    if (!pos) continue;
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
    for (const subtable of lookup.subtables) {
      const coverageIndex = subtable.coverage.get(info.glyphId);
      if (coverageIndex === null) continue;
      const value = subtable.format === 1 ? subtable.value : subtable.values?.[coverageIndex];
      if (value) {
        if (value.xPlacement) pos.xOffset += value.xPlacement;
        if (value.yPlacement) pos.yOffset += value.yPlacement;
        if (value.xAdvance) pos.xAdvance += value.xAdvance;
        if (value.yAdvance) pos.yAdvance += value.yAdvance;
      }
      break;
    }
  }
}
function applyPairPosLookup(font, buffer, lookup) {
  for (let i = 0; i < buffer.infos.length - 1; i++) {
    const info1 = buffer.infos[i];
    if (!info1) continue;
    if (shouldSkipGlyph(font, info1.glyphId, lookup.flag)) continue;
    let j = i + 1;
    while (j < buffer.infos.length) {
      const nextInfo = buffer.infos[j];
      if (nextInfo && !shouldSkipGlyph(font, nextInfo.glyphId, lookup.flag)) {
        break;
      }
      j++;
    }
    if (j >= buffer.infos.length) break;
    const info2 = buffer.infos[j];
    if (!info2) continue;
    const kern = getKerning(lookup, info1.glyphId, info2.glyphId);
    if (kern) {
      const pos1 = buffer.positions[i];
      const pos2 = buffer.positions[j];
      if (pos1) pos1.xAdvance += kern.xAdvance1;
      if (pos2) pos2.xAdvance += kern.xAdvance2;
    }
  }
}
function applyCursivePosLookup(font, buffer, lookup) {
  for (let i = 0; i < buffer.infos.length - 1; i++) {
    const info1 = buffer.infos[i];
    if (!info1) continue;
    if (shouldSkipGlyph(font, info1.glyphId, lookup.flag)) continue;
    let j = i + 1;
    while (j < buffer.infos.length) {
      const nextInfo = buffer.infos[j];
      if (nextInfo && !shouldSkipGlyph(font, nextInfo.glyphId, lookup.flag)) {
        break;
      }
      j++;
    }
    if (j >= buffer.infos.length) break;
    const info2 = buffer.infos[j];
    if (!info2) continue;
    for (const subtable of lookup.subtables) {
      const exitIndex = subtable.coverage.get(info1.glyphId);
      const entryIndex = subtable.coverage.get(info2.glyphId);
      if (exitIndex === null || entryIndex === null) continue;
      const exitRecord = subtable.entryExitRecords[exitIndex];
      const entryRecord = subtable.entryExitRecords[entryIndex];
      if (!exitRecord?.exitAnchor || !entryRecord?.entryAnchor) continue;
      const exitAnchor = exitRecord.exitAnchor;
      const entryAnchor = entryRecord.entryAnchor;
      const pos2 = buffer.positions[j];
      if (pos2) {
        pos2.yOffset = exitAnchor.yCoordinate - entryAnchor.yCoordinate;
      }
      break;
    }
  }
}
function applyMarkBasePosLookup(font, buffer, lookup) {
  for (let i = 0; i < buffer.infos.length; i++) {
    const markInfo = buffer.infos[i];
    if (!markInfo) continue;
    if (getGlyphClass2(font.gdef, markInfo.glyphId) !== 3 /* Mark */)
      continue;
    let baseIndex = -1;
    for (let j = i - 1; j >= 0; j--) {
      const prevInfo = buffer.infos[j];
      if (!prevInfo) continue;
      const prevClass = getGlyphClass2(font.gdef, prevInfo.glyphId);
      if (prevClass === 1 /* Base */ || prevClass === 0) {
        baseIndex = j;
        break;
      }
      if (prevClass === 3 /* Mark */) continue;
      if (prevClass === 2 /* Ligature */) {
        baseIndex = j;
        break;
      }
    }
    if (baseIndex < 0) continue;
    const baseInfo = buffer.infos[baseIndex];
    if (!baseInfo) continue;
    for (const subtable of lookup.subtables) {
      const markCoverageIndex = subtable.markCoverage.get(markInfo.glyphId);
      const baseCoverageIndex = subtable.baseCoverage.get(baseInfo.glyphId);
      if (markCoverageIndex === null || baseCoverageIndex === null) continue;
      const markRecord = subtable.markArray.markRecords[markCoverageIndex];
      const baseRecord = subtable.baseArray[baseCoverageIndex];
      if (!markRecord || !baseRecord) continue;
      const baseAnchor = baseRecord.baseAnchors[markRecord.markClass];
      if (!baseAnchor) continue;
      const markAnchor = markRecord.markAnchor;
      const markPos = buffer.positions[i];
      const basePos = buffer.positions[baseIndex];
      if (!markPos || !basePos) continue;
      markPos.xOffset = baseAnchor.xCoordinate - markAnchor.xCoordinate + basePos.xOffset;
      markPos.yOffset = baseAnchor.yCoordinate - markAnchor.yCoordinate + basePos.yOffset;
      markPos.xAdvance = 0;
      markPos.yAdvance = 0;
      break;
    }
  }
}
function applyMarkLigaturePosLookup(font, buffer, lookup) {
  for (let i = 0; i < buffer.infos.length; i++) {
    const markInfo = buffer.infos[i];
    if (!markInfo) continue;
    if (getGlyphClass2(font.gdef, markInfo.glyphId) !== 3 /* Mark */)
      continue;
    let ligIndex = -1;
    let componentIndex = 0;
    for (let j = i - 1; j >= 0; j--) {
      const prevInfo = buffer.infos[j];
      if (!prevInfo) continue;
      const prevClass = getGlyphClass2(font.gdef, prevInfo.glyphId);
      if (prevClass === 2 /* Ligature */) {
        ligIndex = j;
        break;
      }
      if (prevClass === 3 /* Mark */) {
        componentIndex++;
        continue;
      }
      break;
    }
    if (ligIndex < 0) continue;
    const ligInfo = buffer.infos[ligIndex];
    if (!ligInfo) continue;
    for (const subtable of lookup.subtables) {
      const markCoverageIndex = subtable.markCoverage.get(markInfo.glyphId);
      const ligCoverageIndex = subtable.ligatureCoverage.get(ligInfo.glyphId);
      if (markCoverageIndex === null || ligCoverageIndex === null) continue;
      const markRecord = subtable.markArray.markRecords[markCoverageIndex];
      const ligAttach = subtable.ligatureArray[ligCoverageIndex];
      if (!markRecord || !ligAttach) continue;
      const compIdx = Math.min(
        componentIndex,
        ligAttach.componentRecords.length - 1
      );
      const component = ligAttach.componentRecords[compIdx];
      if (!component) continue;
      const ligAnchor = component.ligatureAnchors[markRecord.markClass];
      if (!ligAnchor) continue;
      const markAnchor = markRecord.markAnchor;
      const markPos = buffer.positions[i];
      const ligPos = buffer.positions[ligIndex];
      if (!markPos || !ligPos) continue;
      markPos.xOffset = ligAnchor.xCoordinate - markAnchor.xCoordinate + ligPos.xOffset;
      markPos.yOffset = ligAnchor.yCoordinate - markAnchor.yCoordinate + ligPos.yOffset;
      markPos.xAdvance = 0;
      markPos.yAdvance = 0;
      break;
    }
  }
}
function applyMarkMarkPosLookup(font, buffer, lookup) {
  for (let i = 0; i < buffer.infos.length; i++) {
    const mark1Info = buffer.infos[i];
    if (!mark1Info) continue;
    if (getGlyphClass2(font.gdef, mark1Info.glyphId) !== 3 /* Mark */)
      continue;
    let mark2Index = -1;
    if (i > 0) {
      const prevInfo = buffer.infos[i - 1];
      if (prevInfo) {
        const prevClass = getGlyphClass2(font.gdef, prevInfo.glyphId);
        if (prevClass === 3 /* Mark */) {
          mark2Index = i - 1;
        }
      }
    }
    if (mark2Index < 0) continue;
    const mark2Info = buffer.infos[mark2Index];
    if (!mark2Info) continue;
    for (const subtable of lookup.subtables) {
      const mark1CoverageIndex = subtable.mark1Coverage.get(mark1Info.glyphId);
      const mark2CoverageIndex = subtable.mark2Coverage.get(mark2Info.glyphId);
      if (mark1CoverageIndex === null || mark2CoverageIndex === null) continue;
      const mark1Record = subtable.mark1Array.markRecords[mark1CoverageIndex];
      const mark2Record = subtable.mark2Array[mark2CoverageIndex];
      if (!mark1Record || !mark2Record) continue;
      const mark2Anchor = mark2Record.mark2Anchors[mark1Record.markClass];
      if (!mark2Anchor) continue;
      const mark1Anchor = mark1Record.markAnchor;
      const mark1Pos = buffer.positions[i];
      const mark2Pos = buffer.positions[mark2Index];
      if (!mark1Pos || !mark2Pos) continue;
      mark1Pos.xOffset = mark2Anchor.xCoordinate - mark1Anchor.xCoordinate + mark2Pos.xOffset;
      mark1Pos.yOffset = mark2Anchor.yCoordinate - mark1Anchor.yCoordinate + mark2Pos.yOffset;
      break;
    }
  }
}
function applyContextPosLookup(font, buffer, lookup, plan) {
  for (let i = 0; i < buffer.infos.length; i++) {
    const info = buffer.infos[i];
    if (!info) continue;
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
    for (const subtable of lookup.subtables) {
      let matched = false;
      let lookupRecords = [];
      if (subtable.format === 1) {
        const result = matchContextPosFormat1(
          font,
          buffer,
          i,
          subtable,
          lookup.flag
        );
        if (result) {
          matched = true;
          lookupRecords = result;
        }
      } else if (subtable.format === 2) {
        const result = matchContextPosFormat2(
          font,
          buffer,
          i,
          subtable,
          lookup.flag
        );
        if (result) {
          matched = true;
          lookupRecords = result;
        }
      } else if (subtable.format === 3) {
        if (matchContextPosFormat3(font, buffer, i, subtable, lookup.flag)) {
          matched = true;
          lookupRecords = subtable.lookupRecords;
        }
      }
      if (matched) {
        applyNestedPosLookups(font, buffer, i, lookupRecords, plan);
        break;
      }
    }
  }
}
function applyChainingContextPosLookup(font, buffer, lookup, plan) {
  for (let i = 0; i < buffer.infos.length; i++) {
    const info = buffer.infos[i];
    if (!info) continue;
    if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
    for (const subtable of lookup.subtables) {
      let matched = false;
      let lookupRecords = [];
      if (subtable.format === 1) {
        const result = matchChainingContextPosFormat1(
          font,
          buffer,
          i,
          subtable,
          lookup.flag
        );
        if (result) {
          matched = true;
          lookupRecords = result;
        }
      } else if (subtable.format === 2) {
        const result = matchChainingContextPosFormat2(
          font,
          buffer,
          i,
          subtable,
          lookup.flag
        );
        if (result) {
          matched = true;
          lookupRecords = result;
        }
      } else if (subtable.format === 3) {
        if (matchChainingContextPosFormat3(font, buffer, i, subtable, lookup.flag)) {
          matched = true;
          lookupRecords = subtable.lookupRecords;
        }
      }
      if (matched) {
        applyNestedPosLookups(font, buffer, i, lookupRecords, plan);
        break;
      }
    }
  }
}
function matchContextPosFormat1(font, buffer, startIndex, subtable, lookupFlag) {
  const firstGlyph = buffer.infos[startIndex]?.glyphId;
  const coverageIndex = subtable.coverage.get(firstGlyph);
  if (coverageIndex === null) return null;
  const ruleSet = subtable.ruleSets[coverageIndex];
  if (!ruleSet) return null;
  for (const rule of ruleSet) {
    if (matchGlyphSequence(
      font,
      buffer,
      startIndex + 1,
      rule.inputSequence,
      lookupFlag
    )) {
      return rule.lookupRecords;
    }
  }
  return null;
}
function matchContextPosFormat2(font, buffer, startIndex, subtable, lookupFlag) {
  const firstGlyph = buffer.infos[startIndex]?.glyphId;
  const coverageIndex = subtable.coverage.get(firstGlyph);
  if (coverageIndex === null) return null;
  const firstClass = subtable.classDef.get(firstGlyph);
  const classRuleSet = subtable.classRuleSets[firstClass];
  if (!classRuleSet) return null;
  for (const rule of classRuleSet) {
    if (matchClassSequence(
      font,
      buffer,
      startIndex + 1,
      rule.inputClasses,
      subtable.classDef,
      lookupFlag
    )) {
      return rule.lookupRecords;
    }
  }
  return null;
}
function matchContextPosFormat3(font, buffer, startIndex, subtable, lookupFlag) {
  let pos = startIndex;
  for (const coverage of subtable.coverages) {
    while (pos < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)) {
      pos++;
    }
    if (pos >= buffer.infos.length) return false;
    if (coverage.get(buffer.infos[pos]?.glyphId) === null) return false;
    pos++;
  }
  return true;
}
function matchChainingContextPosFormat1(font, buffer, startIndex, subtable, lookupFlag) {
  const firstGlyph = buffer.infos[startIndex]?.glyphId;
  const coverageIndex = subtable.coverage.get(firstGlyph);
  if (coverageIndex === null) return null;
  const chainRuleSet = subtable.chainRuleSets[coverageIndex];
  if (!chainRuleSet) return null;
  for (const rule of chainRuleSet) {
    if (!matchGlyphSequenceBackward(
      font,
      buffer,
      startIndex - 1,
      rule.backtrackSequence,
      lookupFlag
    )) {
      continue;
    }
    if (!matchGlyphSequence(
      font,
      buffer,
      startIndex + 1,
      rule.inputSequence,
      lookupFlag
    )) {
      continue;
    }
    let inputEnd = startIndex + 1;
    for (let i = 0; i < rule.inputSequence.length; i++) {
      while (inputEnd < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[inputEnd]?.glyphId, lookupFlag)) {
        inputEnd++;
      }
      inputEnd++;
    }
    if (!matchGlyphSequence(
      font,
      buffer,
      inputEnd,
      rule.lookaheadSequence,
      lookupFlag
    )) {
      continue;
    }
    return rule.lookupRecords;
  }
  return null;
}
function matchChainingContextPosFormat2(font, buffer, startIndex, subtable, lookupFlag) {
  const firstGlyph = buffer.infos[startIndex]?.glyphId;
  const coverageIndex = subtable.coverage.get(firstGlyph);
  if (coverageIndex === null) return null;
  const firstClass = subtable.inputClassDef.get(firstGlyph);
  const chainClassRuleSet = subtable.chainClassRuleSets[firstClass];
  if (!chainClassRuleSet) return null;
  for (const rule of chainClassRuleSet) {
    if (!matchClassSequenceBackward(
      font,
      buffer,
      startIndex - 1,
      rule.backtrackClasses,
      subtable.backtrackClassDef,
      lookupFlag
    )) {
      continue;
    }
    if (!matchClassSequence(
      font,
      buffer,
      startIndex + 1,
      rule.inputClasses,
      subtable.inputClassDef,
      lookupFlag
    )) {
      continue;
    }
    let inputEnd = startIndex + 1;
    for (let i = 0; i < rule.inputClasses.length; i++) {
      while (inputEnd < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[inputEnd]?.glyphId, lookupFlag)) {
        inputEnd++;
      }
      inputEnd++;
    }
    if (!matchClassSequence(
      font,
      buffer,
      inputEnd,
      rule.lookaheadClasses,
      subtable.lookaheadClassDef,
      lookupFlag
    )) {
      continue;
    }
    return rule.lookupRecords;
  }
  return null;
}
function matchChainingContextPosFormat3(font, buffer, startIndex, subtable, lookupFlag) {
  let backtrackPos = startIndex - 1;
  for (const coverage of subtable.backtrackCoverages) {
    while (backtrackPos >= 0 && shouldSkipGlyph(font, buffer.infos[backtrackPos]?.glyphId, lookupFlag)) {
      backtrackPos--;
    }
    if (backtrackPos < 0) return false;
    if (coverage.get(buffer.infos[backtrackPos]?.glyphId) === null)
      return false;
    backtrackPos--;
  }
  let inputPos = startIndex;
  for (const coverage of subtable.inputCoverages) {
    while (inputPos < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[inputPos]?.glyphId, lookupFlag)) {
      inputPos++;
    }
    if (inputPos >= buffer.infos.length) return false;
    if (coverage.get(buffer.infos[inputPos]?.glyphId) === null) return false;
    inputPos++;
  }
  let lookaheadPos = inputPos;
  for (const coverage of subtable.lookaheadCoverages) {
    while (lookaheadPos < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[lookaheadPos]?.glyphId, lookupFlag)) {
      lookaheadPos++;
    }
    if (lookaheadPos >= buffer.infos.length) return false;
    if (coverage.get(buffer.infos[lookaheadPos]?.glyphId) === null)
      return false;
    lookaheadPos++;
  }
  return true;
}
function applyNestedPosLookups(font, buffer, startIndex, lookupRecords, plan) {
  const sorted = [...lookupRecords].sort(
    (a, b) => b.sequenceIndex - a.sequenceIndex
  );
  for (const record of sorted) {
    const lookupEntry = plan.gposLookups.find(
      (l) => l.index === record.lookupListIndex
    );
    if (!lookupEntry) continue;
    const pos = startIndex + record.sequenceIndex;
    if (pos >= buffer.infos.length) continue;
    applyGposLookup(font, buffer, lookupEntry.lookup, plan);
  }
}
function matchGlyphSequence(font, buffer, startPos, glyphs, lookupFlag) {
  let pos = startPos;
  for (const glyph of glyphs) {
    while (pos < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)) {
      pos++;
    }
    if (pos >= buffer.infos.length) return false;
    if (buffer.infos[pos]?.glyphId !== glyph) return false;
    pos++;
  }
  return true;
}
function matchGlyphSequenceBackward(font, buffer, startPos, glyphs, lookupFlag) {
  let pos = startPos;
  for (const glyph of glyphs) {
    while (pos >= 0 && shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)) {
      pos--;
    }
    if (pos < 0) return false;
    if (buffer.infos[pos]?.glyphId !== glyph) return false;
    pos--;
  }
  return true;
}
function matchClassSequence(font, buffer, startPos, classes, classDef, lookupFlag) {
  let pos = startPos;
  for (const cls of classes) {
    while (pos < buffer.infos.length && shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)) {
      pos++;
    }
    if (pos >= buffer.infos.length) return false;
    if (classDef.get(buffer.infos[pos]?.glyphId) !== cls) return false;
    pos++;
  }
  return true;
}
function matchClassSequenceBackward(font, buffer, startPos, classes, classDef, lookupFlag) {
  let pos = startPos;
  for (const cls of classes) {
    while (pos >= 0 && shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)) {
      pos--;
    }
    if (pos < 0) return false;
    if (classDef.get(buffer.infos[pos]?.glyphId) !== cls) return false;
    pos--;
  }
  return true;
}
function shouldSkipGlyph(font, glyphId, lookupFlag) {
  const gdef = font.gdef;
  if (!gdef) return false;
  const glyphClass = getGlyphClass2(gdef, glyphId);
  if (lookupFlag & LookupFlag.IgnoreBaseGlyphs && glyphClass === 1 /* Base */)
    return true;
  if (lookupFlag & LookupFlag.IgnoreLigatures && glyphClass === 2 /* Ligature */)
    return true;
  if (lookupFlag & LookupFlag.IgnoreMarks && glyphClass === 3 /* Mark */)
    return true;
  const markAttachmentType = getMarkAttachmentType(lookupFlag);
  if (markAttachmentType !== 0 && glyphClass === 3 /* Mark */) {
    const glyphMarkClass = gdef.markAttachClassDef.get(glyphId);
    if (glyphMarkClass !== markAttachmentType) return true;
  }
  return false;
}
function applyMorx(font, buffer) {
  const morx = font.morx;
  if (!morx) return;
  for (const chain of morx.chains) {
    for (const subtable of chain.subtables) {
      if ((chain.defaultFlags & subtable.subFeatureFlags) === 0) continue;
      switch (subtable.type) {
        case 4 /* NonContextual */:
          for (const info of buffer.infos) {
            const replacement = applyNonContextual(
              subtable,
              info.glyphId
            );
            if (replacement !== null) {
              info.glyphId = replacement;
            }
          }
          break;
        case 0 /* Rearrangement */:
          processRearrangement(
            subtable,
            buffer.infos
          );
          break;
        case 1 /* Contextual */:
          processContextual(subtable, buffer.infos);
          break;
        case 2 /* Ligature */: {
          const newInfos = processLigature(
            subtable,
            buffer.infos
          );
          if (newInfos.length !== buffer.infos.length) {
            buffer.initFromInfos(newInfos);
          }
          break;
        }
        case 5 /* Insertion */: {
          const newInfos = processInsertion(
            subtable,
            buffer.infos
          );
          if (newInfos.length !== buffer.infos.length) {
            buffer.initFromInfos(newInfos);
          }
          break;
        }
      }
    }
  }
}

// src/unicode/bidi/brackets.data.ts
var brackets_data_default = {
  pairs: "14>1,1e>2,u>2,2wt>1,1>1,1ge>1,1wp>1,1j>1,f>1,hm>1,1>1,u>1,u6>1,1>1,+5,28>1,w>1,1>1,+3,b8>1,1>1,+3,1>3,-1>-1,3>1,1>1,+2,1s>1,1>1,x>1,th>1,1>1,+2,db>1,1>1,+3,3>1,1>1,+2,14qm>1,1>1,+1,4q>1,1e>2,u>2,2>1,+1",
  canonical: "6f1>-6dx,6dy>-6dx,6ec>-6ed,6ee>-6ed,6ww>2jj,-2ji>2jj,14r4>-1e7l,1e7m>-1e7l,1e7m>-1e5c,1e5d>-1e5b,1e5c>-14qx,14qy>-14qx,14vn>-1ecg,1ech>-1ecg,1edu>-1ecg,1eci>-1ecg,1eda>-1ecg,1eci>-1ecg,1eci>-168q,168r>-168q,168s>-14ye,14yf>-14ye"
};

// src/unicode/bidi/parse-character-map.ts
function parseCharacterMap(encodedString, includeReverse) {
  const radix = 36;
  let lastCode = 0;
  const map2 = /* @__PURE__ */ new Map();
  const reverseMap = includeReverse ? /* @__PURE__ */ new Map() : null;
  let prevPair = "";
  function visit(entry) {
    if (entry.indexOf("+") !== -1) {
      for (let i = +entry; i--; ) {
        visit(prevPair);
      }
    } else {
      prevPair = entry;
      const parts = entry.split(">");
      const aStr = parts[0] ?? "";
      const bStr = parts[1] ?? "";
      lastCode += parseInt(aStr, radix);
      const a = String.fromCodePoint(lastCode);
      lastCode += parseInt(bStr, radix);
      const b = String.fromCodePoint(lastCode);
      map2.set(a, b);
      if (reverseMap) {
        reverseMap.set(b, a);
      }
    }
  }
  encodedString.split(",").forEach(visit);
  return { map: map2, reverseMap };
}

// src/unicode/bidi/brackets.ts
var openToClose = null;
var closeToOpen = null;
var canonical = null;
function parse() {
  if (!openToClose) {
    const { map: map2, reverseMap } = parseCharacterMap(brackets_data_default.pairs, true);
    openToClose = map2;
    closeToOpen = reverseMap;
    canonical = parseCharacterMap(brackets_data_default.canonical, false).map;
  }
}
function openingToClosingBracket(char) {
  parse();
  return openToClose?.get(char) || null;
}
function closingToOpeningBracket(char) {
  parse();
  return closeToOpen?.get(char) || null;
}
function getCanonicalBracket(char) {
  parse();
  return canonical?.get(char) || null;
}

// src/unicode/bidi/char-types.data.ts
var char_types_data_default = {
  R: "13k,1a,2,3,3,2+1j,ch+16,a+1,5+2,2+n,5,a,4,6+16,4+3,h+1b,4mo,179q,2+9,2+11,2i9+7y,2+68,4,3+4,5+13,4+3,2+4k,3+29,8+cf,1t+7z,w+17,3+3m,1t+3z,16o1+5r,8+30,8+mc,29+1r,29+4v,75+73",
  EN: "1c+9,3d+1,6,187+9,513,4+5,7+9,sf+j,175h+9,qw+q,161f+1d,4xt+a,25i+9",
  ES: "17,2,6dp+1,f+1,av,16vr,mx+1,4o,2",
  ET: "z+2,3h+3,b+1,ym,3e+1,2o,p4+1,8,6u,7c,g6,1wc,1n9+4,30+1b,2n,6d,qhx+1,h0m,a+1,49+2,63+1,4+1,6bb+3,12jj",
  AN: "16o+5,2j+9,2+1,35,ed,1ff2+9,87+u",
  CS: "18,2+1,b,2u,12k,55v,l,17v0,2,3,53,2+1,b",
  B: "a,3,f+2,2v,690",
  S: "9,2,k",
  WS: "c,k,4f4,1vk+a,u,1j,335",
  ON: "x+1,4+4,h+5,r+5,r+3,z,5+3,2+1,2+1,5,2+2,3+4,o,w,ci+1,8+d,3+d,6+8,2+g,39+1,9,6+1,2,33,b8,3+1,3c+1,7+1,5r,b,7h+3,sa+5,2,3i+6,jg+3,ur+9,2v,ij+1,9g+9,7+a,8m,4+1,49+x,14u,2+2,c+2,e+2,e+2,e+1,i+n,e+e,2+p,u+2,e+2,36+1,2+3,2+1,b,2+2,6+5,2,2,2,h+1,5+4,6+3,3+f,16+2,5+3l,3+81,1y+p,2+40,q+a,m+13,2r+ch,2+9e,75+hf,3+v,2+2w,6e+5,f+6,75+2a,1a+p,2+2g,d+5x,r+b,6+3,4+o,g,6+1,6+2,2k+1,4,2j,5h+z,1m+1,1e+f,t+2,1f+e,d+3,4o+3,2s+1,w,535+1r,h3l+1i,93+2,2s,b+1,3l+x,2v,4g+3,21+3,kz+1,g5v+1,5a,j+9,n+v,2,3,2+8,2+1,3+2,2,3,46+1,4+4,h+5,r+5,r+a,3h+2,4+6,b+4,78,1r+24,4+c,4,1hb,ey+6,103+j,16j+c,1ux+7,5+g,fsh,jdq+1t,4,57+2e,p1,1m,1m,1m,1m,4kt+1,7j+17,5+2r,d+e,3+e,2+e,2+10,m+4,w,1n+5,1q,4z+5,4b+rb,9+c,4+c,4+37,d+2g,8+b,l+b,5+1j,9+9,7+13,9+t,3+1,27+3c,2+29,2+3q,d+d,3+4,4+2,6+6,a+o,8+6,a+2,e+6,16+42,2+1i",
  BN: "0+8,6+d,2s+5,2+p,e,4m9,1kt+2,2b+5,5+5,17q9+v,7k,6p+8,6+1,119d+3,440+7,96s+1,1ekf+1,1ekf+1,1ekf+1,1ekf+1,1ekf+1,1ekf+1,1ekf+1,1ekf+1,1ekf+1,1ekf+1,1ekf+1,1ekf+75,6p+2rz,1ben+1,1ekf+1,1ekf+1",
  NSM: "lc+33,7o+6,7c+18,2,2+1,2+1,2,21+a,1d+k,h,2u+6,3+5,3+1,2+3,10,v+q,2k+a,1n+8,a,p+3,2+8,2+2,2+4,18+2,3c+e,2+v,1k,2,5+7,5,4+6,b+1,u,1n,5+3,9,l+1,r,3+1,1m,5+1,5+1,3+2,4,v+1,4,c+1,1m,5+4,2+1,5,l+1,n+5,2,1n,3,2+3,9,8+1,c+1,v,1q,d,1f,4,1m+2,6+2,2+3,8+1,c+1,u,1n,g+1,l+1,t+1,1m+1,5+3,9,l+1,u,21,8+2,2,2j,3+6,d+7,2r,3+8,c+5,23+1,s,2,2,1k+d,2+4,2+1,6+a,2+z,a,2v+3,2+5,2+1,3+1,q+1,5+2,h+3,e,3+1,7,g,jk+2,qb+2,u+2,u+1,v+1,1t+1,2+6,9,3+a,a,1a+2,3c+1,z,3b+2,5+1,a,7+2,64+1,3,1n,2+6,2,2,3+7,7+9,3,1d+g,1s+3,1d,2+4,2,6,15+8,d+1,x+3,3+1,2+2,1l,2+1,4,2+2,1n+7,3+1,49+2,2+c,2+6,5,7,4+1,5j+1l,2+4,k1+w,2db+2,3y,2p+v,ff+3,30+1,n9x+3,2+9,x+1,29+1,7l,4,5,q+1,6,48+1,r+h,e,13+7,q+a,1b+2,1d,3+3,3+1,14,1w+5,3+1,3+1,d,9,1c,1g,2+2,3+1,6+1,2,17+1,9,6n,3,5,fn5,ki+f,h+f,r2,6b,46+4,1af+2,2+1,6+3,15+2,5,4m+1,fy+3,as+1,4a+a,4x,1j+e,1l+2,1e+3,3+1,1y+2,11+4,2+7,1r,d+1,1h+8,b+3,3,2o+2,3,2+1,7,4h,4+7,m+1,1m+1,4,12+6,4+4,5g+7,3+2,2,o,2d+5,2,5+1,2+1,6n+3,7+1,2+1,s+1,2e+7,3,2+1,2z,2,3+5,2,2u+2,3+3,2+4,78+8,2+1,75+1,2,5,41+3,3+1,5,x+5,3+1,15+5,3+3,9,a+5,3+2,1b+c,2+1,bb+6,2+5,2d+l,3+6,2+1,2+1,3f+5,4,2+1,2+6,2,21+1,4,2,9o+1,f0c+4,1o+6,t5,1s+3,2a,f5l+1,43t+2,i+7,3+6,v+3,45+2,1j0+1i,5+1d,9,f,n+4,2+e,11t+6,2+g,3+6,2+1,2+4,7a+6,c6+3,15t+6,32+6,gzhy+6n",
  AL: "16w,3,2,e+1b,z+2,2+2s,g+1,8+1,b+m,2+t,s+2i,c+e,4h+f,1d+1e,1bwe+dp,3+3z,x+c,2+1,35+3y,2rm+z,5+7,b+5,dt+l,c+u,17nl+27,1t+27,4x+6n,3+d",
  LRO: "6ct",
  RLO: "6cu",
  LRE: "6cq",
  RLE: "6cr",
  PDF: "6cs",
  LRI: "6ee",
  RLI: "6ef",
  FSI: "6eg",
  PDI: "6eh"
};

// src/unicode/bidi/char-types.ts
var TYPES = {};
var TYPES_TO_NAMES = {};
TYPES.L = 1;
TYPES_TO_NAMES[1] = "L";
Object.keys(char_types_data_default).forEach((type, i) => {
  TYPES[type] = 1 << i + 1;
  const typeVal = TYPES[type];
  if (typeVal !== void 0) {
    TYPES_TO_NAMES[typeVal] = type;
  }
});
Object.freeze(TYPES);
function getType(name) {
  return TYPES[name] ?? 0;
}
var ISOLATE_INIT_TYPES = getType("LRI") | getType("RLI") | getType("FSI");
var STRONG_TYPES = getType("L") | getType("R") | getType("AL");
var NEUTRAL_ISOLATE_TYPES = getType("B") | getType("S") | getType("WS") | getType("ON") | getType("FSI") | getType("LRI") | getType("RLI") | getType("PDI");
var BN_LIKE_TYPES = getType("BN") | getType("RLE") | getType("LRE") | getType("RLO") | getType("LRO") | getType("PDF");
var TRAILING_TYPES = getType("S") | getType("WS") | getType("B") | ISOLATE_INIT_TYPES | getType("PDI") | BN_LIKE_TYPES;
var map = null;
function parseData() {
  if (!map) {
    map = /* @__PURE__ */ new Map();
    let start = 0;
    for (const type in char_types_data_default) {
      if (Object.hasOwn(char_types_data_default, type)) {
        const segments = char_types_data_default[type];
        let temp = "";
        let end = 0;
        let state = false;
        let lastCode = 0;
        for (let i = 0; i <= segments.length + 1; i += 1) {
          const char = segments[i];
          if (char !== "," && i !== segments.length) {
            if (char === "+") {
              state = true;
              lastCode = start = lastCode + parseInt(temp, 36);
              temp = "";
            } else {
              temp += char;
            }
          } else {
            if (!state) {
              lastCode = start = lastCode + parseInt(temp, 36);
              end = start;
            } else {
              end = start + parseInt(temp, 36);
            }
            state = false;
            temp = "";
            lastCode = end;
            const typeVal = getType(type);
            for (let j = start; j < end + 1; j += 1) {
              map.set(j, typeVal);
            }
          }
        }
      }
    }
  }
}
function getBidiCharType(char) {
  parseData();
  const codepoint = char.codePointAt(0);
  if (codepoint === void 0) return getType("L");
  return map?.get(codepoint) ?? getType("L");
}

// src/unicode/bidi/embedding-levels.ts
var TYPE_L = TYPES.L ?? 1;
var TYPE_R = TYPES.R ?? 2;
var TYPE_EN = TYPES.EN ?? 4;
var TYPE_ES = TYPES.ES ?? 8;
var TYPE_ET = TYPES.ET ?? 16;
var TYPE_AN = TYPES.AN ?? 32;
var TYPE_CS = TYPES.CS ?? 64;
var TYPE_B = TYPES.B ?? 128;
var TYPE_S = TYPES.S ?? 256;
var TYPE_ON = TYPES.ON ?? 512;
var TYPE_BN = TYPES.BN ?? 1024;
var TYPE_NSM = TYPES.NSM ?? 2048;
var TYPE_AL = TYPES.AL ?? 4096;
var TYPE_LRO = TYPES.LRO ?? 8192;
var TYPE_RLO = TYPES.RLO ?? 16384;
var TYPE_LRE = TYPES.LRE ?? 32768;
var TYPE_RLE = TYPES.RLE ?? 65536;
var TYPE_PDF = TYPES.PDF ?? 131072;
var TYPE_LRI = TYPES.LRI ?? 262144;
var TYPE_RLI = TYPES.RLI ?? 524288;
var TYPE_FSI = TYPES.FSI ?? 1048576;
var TYPE_PDI = TYPES.PDI ?? 2097152;
function getCharType(charTypes, i) {
  return charTypes[i] ?? 0;
}
function getSeqIndex(seqIndices, i) {
  return seqIndices[i] ?? 0;
}
function getCharAt(s, i) {
  return s[i] ?? "";
}
function getEmbeddingLevels(string, baseDirection) {
  const MAX_DEPTH = 125;
  const charTypes = new Uint32Array(string.length);
  for (let i = 0; i < string.length; i++) {
    charTypes[i] = getBidiCharType(getCharAt(string, i));
  }
  const charTypeCounts = /* @__PURE__ */ new Map();
  function changeCharType(i, type) {
    const oldType = getCharType(charTypes, i);
    charTypes[i] = type;
    charTypeCounts.set(oldType, (charTypeCounts.get(oldType) ?? 0) - 1);
    if (oldType & NEUTRAL_ISOLATE_TYPES) {
      charTypeCounts.set(
        NEUTRAL_ISOLATE_TYPES,
        (charTypeCounts.get(NEUTRAL_ISOLATE_TYPES) ?? 0) - 1
      );
    }
    charTypeCounts.set(type, (charTypeCounts.get(type) ?? 0) + 1);
    if (type & NEUTRAL_ISOLATE_TYPES) {
      charTypeCounts.set(
        NEUTRAL_ISOLATE_TYPES,
        (charTypeCounts.get(NEUTRAL_ISOLATE_TYPES) ?? 0) + 1
      );
    }
  }
  const embedLevels = new Uint8Array(string.length);
  const isolationPairs = /* @__PURE__ */ new Map();
  const paragraphs = [];
  let paragraph = null;
  function determineAutoEmbedLevel(start, isFSI) {
    for (let i = start; i < string.length; i++) {
      const charType = getCharType(charTypes, i);
      if (charType & (TYPE_R | TYPE_AL)) {
        return 1;
      }
      if (charType & (TYPE_B | TYPE_L) || isFSI && charType === TYPE_PDI) {
        return 0;
      }
      if (charType & ISOLATE_INIT_TYPES) {
        const pdi = indexOfMatchingPDI(i);
        i = pdi === -1 ? string.length : pdi;
      }
    }
    return 0;
  }
  function indexOfMatchingPDI(isolateStart) {
    let isolationLevel = 1;
    for (let i = isolateStart + 1; i < string.length; i++) {
      const charType = getCharType(charTypes, i);
      if (charType & TYPE_B) {
        break;
      }
      if (charType & TYPE_PDI) {
        if (--isolationLevel === 0) {
          return i;
        }
      } else if (charType & ISOLATE_INIT_TYPES) {
        isolationLevel++;
      }
    }
    return -1;
  }
  for (let i = 0; i < string.length; i++) {
    if (!paragraph) {
      paragraph = {
        start: i,
        end: string.length - 1,
        level: baseDirection === "rtl" ? 1 : baseDirection === "ltr" ? 0 : determineAutoEmbedLevel(i, false)
      };
      paragraphs.push(paragraph);
    }
    if (getCharType(charTypes, i) & TYPE_B) {
      paragraph.end = i;
      paragraph = null;
    }
  }
  const FORMATTING_TYPES = TYPE_RLE | TYPE_LRE | TYPE_RLO | TYPE_LRO | ISOLATE_INIT_TYPES | TYPE_PDI | TYPE_PDF | TYPE_B;
  const nextEven = (n) => n + (n & 1 ? 1 : 2);
  const nextOdd = (n) => n + (n & 1 ? 2 : 1);
  for (let paraIdx = 0; paraIdx < paragraphs.length; paraIdx++) {
    const para = paragraphs[paraIdx];
    if (!para) continue;
    paragraph = para;
    const statusStack = [
      {
        _level: paragraph.level,
        _override: 0,
        _isolate: 0
      }
    ];
    let overflowIsolateCount = 0;
    let overflowEmbeddingCount = 0;
    let validIsolateCount = 0;
    charTypeCounts.clear();
    for (let i = paragraph.start; i <= paragraph.end; i++) {
      let charType = getCharType(charTypes, i);
      let stackTop = statusStack[statusStack.length - 1];
      if (!stackTop) continue;
      charTypeCounts.set(charType, (charTypeCounts.get(charType) ?? 0) + 1);
      if (charType & NEUTRAL_ISOLATE_TYPES) {
        charTypeCounts.set(
          NEUTRAL_ISOLATE_TYPES,
          (charTypeCounts.get(NEUTRAL_ISOLATE_TYPES) ?? 0) + 1
        );
      }
      if (charType & FORMATTING_TYPES) {
        if (charType & (TYPE_RLE | TYPE_LRE)) {
          embedLevels[i] = stackTop._level;
          const level = (charType === TYPE_RLE ? nextOdd : nextEven)(
            stackTop._level
          );
          if (level <= MAX_DEPTH && !overflowIsolateCount && !overflowEmbeddingCount) {
            statusStack.push({
              _level: level,
              _override: 0,
              _isolate: 0
            });
          } else if (!overflowIsolateCount) {
            overflowEmbeddingCount++;
          }
        } else if (charType & (TYPE_RLO | TYPE_LRO)) {
          embedLevels[i] = stackTop._level;
          const level = (charType === TYPE_RLO ? nextOdd : nextEven)(
            stackTop._level
          );
          if (level <= MAX_DEPTH && !overflowIsolateCount && !overflowEmbeddingCount) {
            statusStack.push({
              _level: level,
              _override: charType & TYPE_RLO ? TYPE_R : TYPE_L,
              _isolate: 0
            });
          } else if (!overflowIsolateCount) {
            overflowEmbeddingCount++;
          }
        } else if (charType & ISOLATE_INIT_TYPES) {
          if (charType & TYPE_FSI) {
            charType = determineAutoEmbedLevel(i + 1, true) === 1 ? TYPE_RLI : TYPE_LRI;
          }
          embedLevels[i] = stackTop._level;
          if (stackTop._override) {
            changeCharType(i, stackTop._override);
          }
          const level = (charType === TYPE_RLI ? nextOdd : nextEven)(
            stackTop._level
          );
          if (level <= MAX_DEPTH && overflowIsolateCount === 0 && overflowEmbeddingCount === 0) {
            validIsolateCount++;
            statusStack.push({
              _level: level,
              _override: 0,
              _isolate: 1,
              _isolInitIndex: i
            });
          } else {
            overflowIsolateCount++;
          }
        } else if (charType & TYPE_PDI) {
          if (overflowIsolateCount > 0) {
            overflowIsolateCount--;
          } else if (validIsolateCount > 0) {
            overflowEmbeddingCount = 0;
            while (statusStack.length > 0) {
              const top2 = statusStack[statusStack.length - 1];
              if (top2?._isolate) break;
              statusStack.pop();
            }
            const top = statusStack[statusStack.length - 1];
            const isolInitIndex = top?._isolInitIndex;
            if (isolInitIndex != null) {
              isolationPairs.set(isolInitIndex, i);
              isolationPairs.set(i, isolInitIndex);
            }
            statusStack.pop();
            validIsolateCount--;
          }
          stackTop = statusStack[statusStack.length - 1];
          if (!stackTop) continue;
          embedLevels[i] = stackTop._level;
          if (stackTop._override) {
            changeCharType(i, stackTop._override);
          }
        } else if (charType & TYPE_PDF) {
          if (overflowIsolateCount === 0) {
            if (overflowEmbeddingCount > 0) {
              overflowEmbeddingCount--;
            } else if (!stackTop._isolate && statusStack.length > 1) {
              statusStack.pop();
              stackTop = statusStack[statusStack.length - 1];
              if (!stackTop) continue;
            }
          }
          embedLevels[i] = stackTop._level;
        } else if (charType & TYPE_B) {
          embedLevels[i] = paragraph.level;
        }
      } else {
        embedLevels[i] = stackTop._level;
        if (stackTop._override && charType !== TYPE_BN) {
          changeCharType(i, stackTop._override);
        }
      }
    }
    const levelRuns = [];
    let currentRun = null;
    for (let i = paragraph.start; i <= paragraph.end; i++) {
      const charType = getCharType(charTypes, i);
      if (!(charType & BN_LIKE_TYPES)) {
        const lvl = embedLevels[i] ?? 0;
        const isIsolInit = !!(charType & ISOLATE_INIT_TYPES);
        const isPDI = charType === TYPE_PDI;
        if (currentRun && lvl === currentRun._level) {
          currentRun._end = i;
          currentRun._endsWithIsolInit = isIsolInit;
        } else {
          currentRun = {
            _start: i,
            _end: i,
            _level: lvl,
            _startsWithPDI: isPDI,
            _endsWithIsolInit: isIsolInit
          };
          levelRuns.push(currentRun);
        }
      }
    }
    const isolatingRunSeqs = [];
    for (let runIdx = 0; runIdx < levelRuns.length; runIdx++) {
      const run = levelRuns[runIdx];
      if (!run) continue;
      if (!run._startsWithPDI || run._startsWithPDI && !isolationPairs.has(run._start)) {
        currentRun = run;
        const seqRuns = [run];
        while (currentRun?._endsWithIsolInit) {
          const pdiIndex = isolationPairs.get(currentRun._end);
          if (pdiIndex == null) break;
          let found = false;
          for (let i = runIdx + 1; i < levelRuns.length; i++) {
            const nextRun = levelRuns[i];
            if (nextRun?._start === pdiIndex) {
              currentRun = nextRun;
              seqRuns.push(nextRun);
              found = true;
              break;
            }
          }
          if (!found) break;
        }
        const seqIndices = [];
        for (const seqRun of seqRuns) {
          for (let j = seqRun._start; j <= seqRun._end; j++) {
            seqIndices.push(j);
          }
        }
        const firstIdx = seqIndices[0] ?? 0;
        const firstLevel = embedLevels[firstIdx] ?? 0;
        let prevLevel = paragraph.level;
        for (let i = firstIdx - 1; i >= 0; i--) {
          if (!(getCharType(charTypes, i) & BN_LIKE_TYPES)) {
            prevLevel = embedLevels[i] ?? 0;
            break;
          }
        }
        const lastIndex = seqIndices[seqIndices.length - 1] ?? 0;
        const lastLevel = embedLevels[lastIndex] ?? 0;
        let nextLevel = paragraph.level;
        if (!(getCharType(charTypes, lastIndex) & ISOLATE_INIT_TYPES)) {
          for (let i = lastIndex + 1; i <= paragraph.end; i++) {
            if (!(getCharType(charTypes, i) & BN_LIKE_TYPES)) {
              nextLevel = embedLevels[i] ?? 0;
              break;
            }
          }
        }
        isolatingRunSeqs.push({
          _seqIndices: seqIndices,
          _sosType: Math.max(prevLevel, firstLevel) % 2 ? TYPE_R : TYPE_L,
          _eosType: Math.max(nextLevel, lastLevel) % 2 ? TYPE_R : TYPE_L
        });
      }
    }
    for (const seq of isolatingRunSeqs) {
      const {
        _seqIndices: seqIndices,
        _sosType: sosType,
        _eosType: eosType
      } = seq;
      const firstSeqIdx = seqIndices[0] ?? 0;
      const embedDirection = (embedLevels[firstSeqIdx] ?? 0) & 1 ? TYPE_R : TYPE_L;
      if (charTypeCounts.get(TYPE_NSM)) {
        for (let si = 0; si < seqIndices.length; si++) {
          const i = getSeqIndex(seqIndices, si);
          if (getCharType(charTypes, i) & TYPE_NSM) {
            let prevType = sosType;
            for (let sj = si - 1; sj >= 0; sj--) {
              const sjIdx = getSeqIndex(seqIndices, sj);
              if (!(getCharType(charTypes, sjIdx) & BN_LIKE_TYPES)) {
                prevType = getCharType(charTypes, sjIdx);
                break;
              }
            }
            changeCharType(
              i,
              prevType & (ISOLATE_INIT_TYPES | TYPE_PDI) ? TYPE_ON : prevType
            );
          }
        }
      }
      if (charTypeCounts.get(TYPE_EN)) {
        for (let si = 0; si < seqIndices.length; si++) {
          const i = getSeqIndex(seqIndices, si);
          if (getCharType(charTypes, i) & TYPE_EN) {
            for (let sj = si - 1; sj >= -1; sj--) {
              const prevCharType = sj === -1 ? sosType : getCharType(charTypes, getSeqIndex(seqIndices, sj));
              if (prevCharType & STRONG_TYPES) {
                if (prevCharType === TYPE_AL) {
                  changeCharType(i, TYPE_AN);
                }
                break;
              }
            }
          }
        }
      }
      if (charTypeCounts.get(TYPE_AL)) {
        for (let si = 0; si < seqIndices.length; si++) {
          const i = getSeqIndex(seqIndices, si);
          if (getCharType(charTypes, i) & TYPE_AL) {
            changeCharType(i, TYPE_R);
          }
        }
      }
      if (charTypeCounts.get(TYPE_ES) || charTypeCounts.get(TYPE_CS)) {
        for (let si = 1; si < seqIndices.length - 1; si++) {
          const i = getSeqIndex(seqIndices, si);
          if (getCharType(charTypes, i) & (TYPE_ES | TYPE_CS)) {
            let prevType = 0;
            let nextType = 0;
            for (let sj = si - 1; sj >= 0; sj--) {
              prevType = getCharType(charTypes, getSeqIndex(seqIndices, sj));
              if (!(prevType & BN_LIKE_TYPES)) break;
            }
            for (let sj = si + 1; sj < seqIndices.length; sj++) {
              nextType = getCharType(charTypes, getSeqIndex(seqIndices, sj));
              if (!(nextType & BN_LIKE_TYPES)) break;
            }
            if (prevType === nextType && (getCharType(charTypes, i) === TYPE_ES ? prevType === TYPE_EN : prevType & (TYPE_EN | TYPE_AN))) {
              changeCharType(i, prevType);
            }
          }
        }
      }
      if (charTypeCounts.get(TYPE_EN)) {
        for (let si = 0; si < seqIndices.length; si++) {
          const i = getSeqIndex(seqIndices, si);
          if (getCharType(charTypes, i) & TYPE_EN) {
            for (let sj = si - 1; sj >= 0; sj--) {
              const sjIdx = getSeqIndex(seqIndices, sj);
              if (!(getCharType(charTypes, sjIdx) & (TYPE_ET | BN_LIKE_TYPES)))
                break;
              changeCharType(sjIdx, TYPE_EN);
            }
            for (si++; si < seqIndices.length; si++) {
              const siIdx = getSeqIndex(seqIndices, si);
              if (!(getCharType(charTypes, siIdx) & (TYPE_ET | BN_LIKE_TYPES | TYPE_EN)))
                break;
              if (getCharType(charTypes, siIdx) !== TYPE_EN) {
                changeCharType(siIdx, TYPE_EN);
              }
            }
          }
        }
      }
      if (charTypeCounts.get(TYPE_ET) || charTypeCounts.get(TYPE_ES) || charTypeCounts.get(TYPE_CS)) {
        for (let si = 0; si < seqIndices.length; si++) {
          const i = getSeqIndex(seqIndices, si);
          if (getCharType(charTypes, i) & (TYPE_ET | TYPE_ES | TYPE_CS)) {
            changeCharType(i, TYPE_ON);
            for (let sj = si - 1; sj >= 0; sj--) {
              const sjIdx = getSeqIndex(seqIndices, sj);
              if (!(getCharType(charTypes, sjIdx) & BN_LIKE_TYPES)) break;
              changeCharType(sjIdx, TYPE_ON);
            }
            for (let sj = si + 1; sj < seqIndices.length; sj++) {
              const sjIdx = getSeqIndex(seqIndices, sj);
              if (!(getCharType(charTypes, sjIdx) & BN_LIKE_TYPES)) break;
              changeCharType(sjIdx, TYPE_ON);
            }
          }
        }
      }
      if (charTypeCounts.get(TYPE_EN)) {
        let prevStrongType = sosType;
        for (let si = 0; si < seqIndices.length; si++) {
          const i = getSeqIndex(seqIndices, si);
          const type = getCharType(charTypes, i);
          if (type & TYPE_EN) {
            if (prevStrongType === TYPE_L) {
              changeCharType(i, TYPE_L);
            }
          } else if (type & STRONG_TYPES) {
            prevStrongType = type;
          }
        }
      }
      if (charTypeCounts.get(NEUTRAL_ISOLATE_TYPES)) {
        const R_TYPES_FOR_N_STEPS = TYPE_R | TYPE_EN | TYPE_AN;
        const STRONG_TYPES_FOR_N_STEPS = R_TYPES_FOR_N_STEPS | TYPE_L;
        const bracketPairs = [];
        const openerStack = [];
        for (let si = 0; si < seqIndices.length; si++) {
          const siIdx = getSeqIndex(seqIndices, si);
          if (getCharType(charTypes, siIdx) & NEUTRAL_ISOLATE_TYPES) {
            const char = getCharAt(string, siIdx);
            const closingBracket = openingToClosingBracket(char);
            if (closingBracket !== null) {
              if (openerStack.length < 63) {
                openerStack.push({ char, seqIndex: si });
              } else {
                break;
              }
            } else {
              const oppositeBracket = closingToOpeningBracket(char);
              if (oppositeBracket !== null) {
                for (let stackIdx = openerStack.length - 1; stackIdx >= 0; stackIdx--) {
                  const opener = openerStack[stackIdx];
                  if (!opener) continue;
                  const stackChar = opener.char;
                  const canonicalChar = getCanonicalBracket(char);
                  const canonicalStack = getCanonicalBracket(stackChar);
                  if (stackChar === oppositeBracket || canonicalChar && stackChar === closingToOpeningBracket(canonicalChar) || canonicalStack && openingToClosingBracket(canonicalStack) === char) {
                    bracketPairs.push([opener.seqIndex, si]);
                    openerStack.length = stackIdx;
                    break;
                  }
                }
              }
            }
          }
        }
        bracketPairs.sort((a, b) => a[0] - b[0]);
        for (const pair of bracketPairs) {
          const [openSeqIdx, closeSeqIdx] = pair;
          let foundStrongType = false;
          let useStrongType = 0;
          for (let si = openSeqIdx + 1; si < closeSeqIdx; si++) {
            const i = getSeqIndex(seqIndices, si);
            const ct = getCharType(charTypes, i);
            if (ct & STRONG_TYPES_FOR_N_STEPS) {
              foundStrongType = true;
              const lr = ct & R_TYPES_FOR_N_STEPS ? TYPE_R : TYPE_L;
              if (lr === embedDirection) {
                useStrongType = lr;
                break;
              }
            }
          }
          if (foundStrongType && !useStrongType) {
            useStrongType = sosType;
            for (let si = openSeqIdx - 1; si >= 0; si--) {
              const i = getSeqIndex(seqIndices, si);
              const ct = getCharType(charTypes, i);
              if (ct & STRONG_TYPES_FOR_N_STEPS) {
                const lr = ct & R_TYPES_FOR_N_STEPS ? TYPE_R : TYPE_L;
                useStrongType = lr !== embedDirection ? lr : embedDirection;
                break;
              }
            }
          }
          if (useStrongType) {
            charTypes[getSeqIndex(seqIndices, openSeqIdx)] = useStrongType;
            charTypes[getSeqIndex(seqIndices, closeSeqIdx)] = useStrongType;
            if (useStrongType !== embedDirection) {
              for (let si = openSeqIdx + 1; si < seqIndices.length; si++) {
                const siIdx = getSeqIndex(seqIndices, si);
                if (!(getCharType(charTypes, siIdx) & BN_LIKE_TYPES)) {
                  if (getBidiCharType(getCharAt(string, siIdx)) & TYPE_NSM) {
                    charTypes[siIdx] = useStrongType;
                  }
                  break;
                }
              }
              for (let si = closeSeqIdx + 1; si < seqIndices.length; si++) {
                const siIdx = getSeqIndex(seqIndices, si);
                if (!(getCharType(charTypes, siIdx) & BN_LIKE_TYPES)) {
                  if (getBidiCharType(getCharAt(string, siIdx)) & TYPE_NSM) {
                    charTypes[siIdx] = useStrongType;
                  }
                  break;
                }
              }
            }
          }
        }
        for (let si = 0; si < seqIndices.length; si++) {
          const siIdx = getSeqIndex(seqIndices, si);
          if (getCharType(charTypes, siIdx) & NEUTRAL_ISOLATE_TYPES) {
            let niRunStart = si;
            let niRunEnd = si;
            let prevType = sosType;
            for (let si2 = si - 1; si2 >= 0; si2--) {
              const si2Idx = getSeqIndex(seqIndices, si2);
              if (getCharType(charTypes, si2Idx) & BN_LIKE_TYPES) {
                niRunStart = si2;
              } else {
                prevType = getCharType(charTypes, si2Idx) & R_TYPES_FOR_N_STEPS ? TYPE_R : TYPE_L;
                break;
              }
            }
            let nextType = eosType;
            for (let si2 = si + 1; si2 < seqIndices.length; si2++) {
              const si2Idx = getSeqIndex(seqIndices, si2);
              if (getCharType(charTypes, si2Idx) & (NEUTRAL_ISOLATE_TYPES | BN_LIKE_TYPES)) {
                niRunEnd = si2;
              } else {
                nextType = getCharType(charTypes, si2Idx) & R_TYPES_FOR_N_STEPS ? TYPE_R : TYPE_L;
                break;
              }
            }
            for (let sj = niRunStart; sj <= niRunEnd; sj++) {
              charTypes[getSeqIndex(seqIndices, sj)] = prevType === nextType ? prevType : embedDirection;
            }
            si = niRunEnd;
          }
        }
      }
    }
    for (let i = paragraph.start; i <= paragraph.end; i++) {
      const level = embedLevels[i] ?? 0;
      const type = getCharType(charTypes, i);
      if (level & 1) {
        if (type & (TYPE_L | TYPE_EN | TYPE_AN)) {
          embedLevels[i]++;
        }
      } else {
        if (type & TYPE_R) {
          embedLevels[i]++;
        } else if (type & (TYPE_AN | TYPE_EN)) {
          embedLevels[i] += 2;
        }
      }
      if (type & BN_LIKE_TYPES) {
        embedLevels[i] = i === 0 ? paragraph.level : embedLevels[i - 1] ?? paragraph.level;
      }
      if (i === paragraph.end || getBidiCharType(getCharAt(string, i)) & (TYPE_S | TYPE_B)) {
        for (let j = i; j >= 0 && getBidiCharType(getCharAt(string, j)) & TRAILING_TYPES; j--) {
          embedLevels[j] = paragraph.level;
        }
      }
    }
  }
  return {
    levels: embedLevels,
    paragraphs
  };
}

// src/unicode/bidi/mirroring.data.ts
var mirroring_data_default = "14>1,j>2,t>2,u>2,1a>g,2v3>1,1>1,1ge>1,1wd>1,b>1,1j>1,f>1,ai>3,-2>3,+1,8>1k0,-1jq>1y7,-1y6>1hf,-1he>1h6,-1h5>1ha,-1h8>1qi,-1pu>1,6>3u,-3s>7,6>1,1>1,f>1,1>1,+2,3>1,1>1,+13,4>1,1>1,6>1eo,-1ee>1,3>1mg,-1me>1mk,-1mj>1mi,-1mg>1mi,-1md>1,1>1,+2,1>10k,-103>1,1>1,4>1,5>1,1>1,+10,3>1,1>8,-7>8,+1,-6>7,+1,a>1,1>1,u>1,u6>1,1>1,+5,26>1,1>1,2>1,2>2,8>1,7>1,4>1,1>1,+5,b8>1,1>1,+3,1>3,-2>1,2>1,1>1,+2,c>1,3>1,1>1,+2,h>1,3>1,a>1,1>1,2>1,3>1,1>1,d>1,f>1,3>1,1a>1,1>1,6>1,7>1,13>1,k>1,1>1,+19,4>1,1>1,+2,2>1,1>1,+18,m>1,a>1,1>1,lk>1,1>1,4>1,2>1,f>1,3>1,1>1,+3,db>1,1>1,+3,3>1,1>1,+2,14qm>1,1>1,+1,6>1,4j>1,j>2,t>2,u>2,2>1,+1";

// src/unicode/bidi/mirroring.ts
var mirrorMap = null;
function parse2() {
  if (!mirrorMap) {
    const { map: map2, reverseMap } = parseCharacterMap(mirroring_data_default, true);
    if (reverseMap) {
      reverseMap.forEach((value, key) => {
        map2.set(key, value);
      });
    }
    mirrorMap = map2;
  }
}
function getMirroredCharacter(char) {
  parse2();
  return mirrorMap?.get(char) || null;
}

// src/unicode/bidi/reordering.ts
function getReorderSegments(string, embeddingLevelsResult, start, end) {
  const strLen = string.length;
  const startPos = Math.max(0, start == null ? 0 : +start);
  const endPos = Math.min(strLen - 1, end == null ? strLen - 1 : +end);
  const segments = [];
  for (const paragraph of embeddingLevelsResult.paragraphs) {
    const lineStart = Math.max(startPos, paragraph.start);
    const lineEnd = Math.min(endPos, paragraph.end);
    if (lineStart < lineEnd) {
      const lineLevels = embeddingLevelsResult.levels.slice(
        lineStart,
        lineEnd + 1
      );
      for (let i = lineEnd; i >= lineStart; i--) {
        const char = string[i];
        if (char === void 0) break;
        if (!(getBidiCharType(char) & TRAILING_TYPES)) break;
        lineLevels[i - lineStart] = paragraph.level;
      }
      let maxLevel = paragraph.level;
      let minOddLevel = Infinity;
      for (let i = 0; i < lineLevels.length; i++) {
        const level = lineLevels[i] ?? 0;
        if (level > maxLevel) maxLevel = level;
        if (level < minOddLevel) minOddLevel = level | 1;
      }
      for (let lvl = maxLevel; lvl >= minOddLevel; lvl--) {
        for (let i = 0; i < lineLevels.length; i++) {
          const level = lineLevels[i] ?? 0;
          if (level >= lvl) {
            const segStart = i;
            while (i + 1 < lineLevels.length) {
              const nextLevel = lineLevels[i + 1] ?? 0;
              if (nextLevel < lvl) break;
              i++;
            }
            if (i > segStart) {
              segments.push([segStart + lineStart, i + lineStart]);
            }
          }
        }
      }
    }
  }
  return segments;
}
function getReorderedIndices(string, embedLevelsResult, start, end) {
  const segments = getReorderSegments(string, embedLevelsResult, start, end);
  const indices = [];
  for (let i = 0; i < string.length; i++) {
    indices[i] = i;
  }
  for (const [segStart, segEnd] of segments) {
    const slice = indices.slice(segStart, segEnd + 1);
    for (let i = slice.length; i--; ) {
      const val = slice[i];
      if (val !== void 0) {
        indices[segEnd - i] = val;
      }
    }
  }
  return indices;
}

// src/unicode/bidi.ts
function getEmbeddings(text, baseDirection = 4 /* LTR */) {
  const dir = baseDirection === 5 /* RTL */ ? "rtl" : baseDirection === 4 /* LTR */ ? "ltr" : "auto";
  const result = getEmbeddingLevels(text, dir);
  return {
    levels: result.levels,
    paragraphs: result.paragraphs
  };
}
function getVisualOrder(text, result, start = 0, end = text.length) {
  return Array.from(getReorderedIndices(text, result, start, end));
}
function reorderGlyphs(infos, result) {
  if (infos.length === 0) return infos;
  const dummyString = "x".repeat(infos.length);
  const indices = getReorderedIndices(dummyString, result, 0, infos.length);
  const reordered = [];
  for (const idx of indices) {
    if (idx < infos.length) {
      const info = infos[idx];
      if (info) {
        reordered.push(info);
      }
    }
  }
  return reordered;
}
function getMirror(codepoint) {
  const char = String.fromCodePoint(codepoint);
  const mirrored = getMirroredCharacter(char);
  return mirrored ? mirrored.codePointAt(0) ?? codepoint : codepoint;
}
function applyMirroring(infos, levels) {
  for (const [i, info] of infos.entries()) {
    const level = levels[i];
    if (level === void 0) continue;
    if (level & 1) {
      const mirrored = getMirror(info.codepoint);
      if (mirrored !== info.codepoint) {
        info.codepoint = mirrored;
      }
    }
  }
}
var BidiType = {
  L: 1,
  // Left-to-Right
  R: 2,
  // Right-to-Left
  EN: 4,
  // European Number
  ES: 8,
  // European Separator
  ET: 16,
  // European Terminator
  AN: 32,
  // Arabic Number
  CS: 64,
  // Common Separator
  B: 128,
  // Paragraph Separator
  S: 256,
  // Segment Separator
  WS: 512,
  // Whitespace
  ON: 1024,
  // Other Neutral
  BN: 2048,
  // Boundary Neutral
  NSM: 4096,
  // Non-Spacing Mark
  AL: 8192,
  // Arabic Letter
  LRO: 16384,
  // Left-to-Right Override
  RLO: 32768,
  // Right-to-Left Override
  LRE: 65536,
  // Left-to-Right Embedding
  RLE: 131072,
  // Right-to-Left Embedding
  PDF: 262144,
  // Pop Directional Format
  LRI: 524288,
  // Left-to-Right Isolate
  RLI: 1048576,
  // Right-to-Left Isolate
  FSI: 2097152,
  // First Strong Isolate
  PDI: 4194304
  // Pop Directional Isolate
};
function getCharType2(char) {
  return getBidiCharType(char);
}
function isRTL(codepoint) {
  const char = String.fromCodePoint(codepoint);
  const type = getBidiCharType(char);
  return (type & (BidiType.R | BidiType.AL)) !== 0;
}
function isLTR(codepoint) {
  const char = String.fromCodePoint(codepoint);
  const type = getBidiCharType(char);
  return (type & BidiType.L) !== 0;
}
function detectDirection(text) {
  for (const char of text) {
    const type = getBidiCharType(char);
    if (type & BidiType.L) return 4 /* LTR */;
    if (type & (BidiType.R | BidiType.AL)) return 5 /* RTL */;
  }
  return 4 /* LTR */;
}
function processBidi(infos, baseDirection = 4 /* LTR */) {
  if (infos.length === 0) {
    return { infos, levels: new Uint8Array(0) };
  }
  const text = infos.map((i) => String.fromCodePoint(i.codepoint)).join("");
  const result = getEmbeddings(text, baseDirection);
  applyMirroring(infos, result.levels);
  const reordered = reorderGlyphs(infos, result);
  return { infos: reordered, levels: result.levels };
}

// src/unicode/line-break.ts
var LineBreakClass = /* @__PURE__ */ ((LineBreakClass2) => {
  LineBreakClass2[LineBreakClass2["BK"] = 0] = "BK";
  LineBreakClass2[LineBreakClass2["CR"] = 1] = "CR";
  LineBreakClass2[LineBreakClass2["LF"] = 2] = "LF";
  LineBreakClass2[LineBreakClass2["CM"] = 3] = "CM";
  LineBreakClass2[LineBreakClass2["NL"] = 4] = "NL";
  LineBreakClass2[LineBreakClass2["SG"] = 5] = "SG";
  LineBreakClass2[LineBreakClass2["WJ"] = 6] = "WJ";
  LineBreakClass2[LineBreakClass2["ZW"] = 7] = "ZW";
  LineBreakClass2[LineBreakClass2["GL"] = 8] = "GL";
  LineBreakClass2[LineBreakClass2["SP"] = 9] = "SP";
  LineBreakClass2[LineBreakClass2["ZWJ"] = 10] = "ZWJ";
  LineBreakClass2[LineBreakClass2["B2"] = 11] = "B2";
  LineBreakClass2[LineBreakClass2["BA"] = 12] = "BA";
  LineBreakClass2[LineBreakClass2["BB"] = 13] = "BB";
  LineBreakClass2[LineBreakClass2["HY"] = 14] = "HY";
  LineBreakClass2[LineBreakClass2["CB"] = 15] = "CB";
  LineBreakClass2[LineBreakClass2["CL"] = 16] = "CL";
  LineBreakClass2[LineBreakClass2["CP"] = 17] = "CP";
  LineBreakClass2[LineBreakClass2["EX"] = 18] = "EX";
  LineBreakClass2[LineBreakClass2["IN"] = 19] = "IN";
  LineBreakClass2[LineBreakClass2["NS"] = 20] = "NS";
  LineBreakClass2[LineBreakClass2["OP"] = 21] = "OP";
  LineBreakClass2[LineBreakClass2["QU"] = 22] = "QU";
  LineBreakClass2[LineBreakClass2["IS"] = 23] = "IS";
  LineBreakClass2[LineBreakClass2["NU"] = 24] = "NU";
  LineBreakClass2[LineBreakClass2["PO"] = 25] = "PO";
  LineBreakClass2[LineBreakClass2["PR"] = 26] = "PR";
  LineBreakClass2[LineBreakClass2["SY"] = 27] = "SY";
  LineBreakClass2[LineBreakClass2["AI"] = 28] = "AI";
  LineBreakClass2[LineBreakClass2["AL"] = 29] = "AL";
  LineBreakClass2[LineBreakClass2["CJ"] = 30] = "CJ";
  LineBreakClass2[LineBreakClass2["EB"] = 31] = "EB";
  LineBreakClass2[LineBreakClass2["EM"] = 32] = "EM";
  LineBreakClass2[LineBreakClass2["H2"] = 33] = "H2";
  LineBreakClass2[LineBreakClass2["H3"] = 34] = "H3";
  LineBreakClass2[LineBreakClass2["HL"] = 35] = "HL";
  LineBreakClass2[LineBreakClass2["ID"] = 36] = "ID";
  LineBreakClass2[LineBreakClass2["JL"] = 37] = "JL";
  LineBreakClass2[LineBreakClass2["JV"] = 38] = "JV";
  LineBreakClass2[LineBreakClass2["JT"] = 39] = "JT";
  LineBreakClass2[LineBreakClass2["RI"] = 40] = "RI";
  LineBreakClass2[LineBreakClass2["SA"] = 41] = "SA";
  LineBreakClass2[LineBreakClass2["XX"] = 42] = "XX";
  return LineBreakClass2;
})(LineBreakClass || {});
var BreakAction = /* @__PURE__ */ ((BreakAction2) => {
  BreakAction2[BreakAction2["Direct"] = 0] = "Direct";
  BreakAction2[BreakAction2["Indirect"] = 1] = "Indirect";
  BreakAction2[BreakAction2["CombiningIndirect"] = 2] = "CombiningIndirect";
  BreakAction2[BreakAction2["CombiningProhibited"] = 3] = "CombiningProhibited";
  BreakAction2[BreakAction2["Prohibited"] = 4] = "Prohibited";
  BreakAction2[BreakAction2["Explicit"] = 5] = "Explicit";
  return BreakAction2;
})(BreakAction || {});
var BreakOpportunity = /* @__PURE__ */ ((BreakOpportunity2) => {
  BreakOpportunity2[BreakOpportunity2["NoBreak"] = 0] = "NoBreak";
  BreakOpportunity2[BreakOpportunity2["Optional"] = 1] = "Optional";
  BreakOpportunity2[BreakOpportunity2["Mandatory"] = 2] = "Mandatory";
  return BreakOpportunity2;
})(BreakOpportunity || {});
function getLineBreakClass(cp) {
  if (cp === 10) return 2 /* LF */;
  if (cp === 13) return 1 /* CR */;
  if (cp === 133) return 4 /* NL */;
  if (cp === 11 || cp === 12) return 0 /* BK */;
  if (cp === 8232) return 0 /* BK */;
  if (cp === 8233) return 0 /* BK */;
  if (cp === 8203) return 7 /* ZW */;
  if (cp === 8205) return 10 /* ZWJ */;
  if (cp === 8288) return 6 /* WJ */;
  if (cp === 65279) return 6 /* WJ */;
  if (cp === 32) return 9 /* SP */;
  if (cp === 160) return 8 /* GL */;
  if (cp === 8239) return 8 /* GL */;
  if (cp === 8199) return 8 /* GL */;
  if (cp === 8209) return 8 /* GL */;
  if (cp === 9) return 12 /* BA */;
  if (cp >= 8192 && cp <= 8202) return 12 /* BA */;
  if (cp >= 768 && cp <= 879) return 3 /* CM */;
  if (cp >= 1155 && cp <= 1161) return 3 /* CM */;
  if (cp >= 1425 && cp <= 1469) return 3 /* CM */;
  if (cp >= 1471 && cp <= 1479) return 3 /* CM */;
  if (cp >= 1552 && cp <= 1562) return 3 /* CM */;
  if (cp >= 1611 && cp <= 1631) return 3 /* CM */;
  if (cp >= 1648 && cp <= 1648) return 3 /* CM */;
  if (cp >= 1750 && cp <= 1773) return 3 /* CM */;
  if (cp >= 1809 && cp <= 1809) return 3 /* CM */;
  if (cp >= 1840 && cp <= 1866) return 3 /* CM */;
  if (cp >= 1958 && cp <= 1968) return 3 /* CM */;
  if (cp >= 2070 && cp <= 2083) return 3 /* CM */;
  if (cp >= 2085 && cp <= 2093) return 3 /* CM */;
  if (cp >= 2137 && cp <= 2139) return 3 /* CM */;
  if (cp >= 2259 && cp <= 2273) return 3 /* CM */;
  if (cp >= 2275 && cp <= 2307) return 3 /* CM */;
  if (cp >= 2362 && cp <= 2364) return 3 /* CM */;
  if (cp >= 2366 && cp <= 2383) return 3 /* CM */;
  if (cp >= 2385 && cp <= 2391) return 3 /* CM */;
  if (cp >= 2402 && cp <= 2403) return 3 /* CM */;
  if (cp >= 2433 && cp <= 2435) return 3 /* CM */;
  if (cp === 2492) return 3 /* CM */;
  if (cp >= 2494 && cp <= 2509) return 3 /* CM */;
  if (cp >= 2519 && cp <= 2519) return 3 /* CM */;
  if (cp >= 2530 && cp <= 2531) return 3 /* CM */;
  if (cp >= 2558 && cp <= 2558) return 3 /* CM */;
  if (cp >= 2561 && cp <= 2563) return 3 /* CM */;
  if (cp >= 2620 && cp <= 2641) return 3 /* CM */;
  if (cp >= 2672 && cp <= 2673) return 3 /* CM */;
  if (cp >= 2677 && cp <= 2677) return 3 /* CM */;
  if (cp >= 2689 && cp <= 2691) return 3 /* CM */;
  if (cp >= 2748 && cp <= 2765) return 3 /* CM */;
  if (cp >= 2786 && cp <= 2787) return 3 /* CM */;
  if (cp >= 2810 && cp <= 2815) return 3 /* CM */;
  if (cp >= 2817 && cp <= 2819) return 3 /* CM */;
  if (cp >= 2876 && cp <= 2903) return 3 /* CM */;
  if (cp >= 2914 && cp <= 2915) return 3 /* CM */;
  if (cp >= 2946 && cp <= 2946) return 3 /* CM */;
  if (cp >= 3006 && cp <= 3021) return 3 /* CM */;
  if (cp >= 3031 && cp <= 3031) return 3 /* CM */;
  if (cp >= 3072 && cp <= 3076) return 3 /* CM */;
  if (cp >= 3134 && cp <= 3158) return 3 /* CM */;
  if (cp >= 3170 && cp <= 3171) return 3 /* CM */;
  if (cp >= 3201 && cp <= 3203) return 3 /* CM */;
  if (cp >= 3260 && cp <= 3286) return 3 /* CM */;
  if (cp >= 3298 && cp <= 3299) return 3 /* CM */;
  if (cp >= 3328 && cp <= 3331) return 3 /* CM */;
  if (cp >= 3387 && cp <= 3405) return 3 /* CM */;
  if (cp >= 3415 && cp <= 3415) return 3 /* CM */;
  if (cp >= 3426 && cp <= 3427) return 3 /* CM */;
  if (cp >= 3457 && cp <= 3459) return 3 /* CM */;
  if (cp >= 3530 && cp <= 3571) return 3 /* CM */;
  if (cp >= 3864 && cp <= 3865) return 3 /* CM */;
  if (cp >= 3893 && cp <= 3897) return 3 /* CM */;
  if (cp >= 3902 && cp <= 3903) return 3 /* CM */;
  if (cp >= 3953 && cp <= 3972) return 3 /* CM */;
  if (cp >= 3974 && cp <= 3975) return 3 /* CM */;
  if (cp >= 3981 && cp <= 4028) return 3 /* CM */;
  if (cp === 4038) return 3 /* CM */;
  if (cp >= 5906 && cp <= 5908) return 3 /* CM */;
  if (cp >= 5938 && cp <= 5940) return 3 /* CM */;
  if (cp >= 5970 && cp <= 5971) return 3 /* CM */;
  if (cp >= 6002 && cp <= 6003) return 3 /* CM */;
  if (cp >= 6068 && cp <= 6099) return 3 /* CM */;
  if (cp === 6109) return 3 /* CM */;
  if (cp >= 6155 && cp <= 6157) return 3 /* CM */;
  if (cp === 6159) return 3 /* CM */;
  if (cp >= 6277 && cp <= 6278) return 3 /* CM */;
  if (cp === 6313) return 3 /* CM */;
  if (cp >= 6432 && cp <= 6459) return 3 /* CM */;
  if (cp >= 6679 && cp <= 6683) return 3 /* CM */;
  if (cp >= 6741 && cp <= 6783) return 3 /* CM */;
  if (cp >= 6832 && cp <= 6862) return 3 /* CM */;
  if (cp >= 6912 && cp <= 6916) return 3 /* CM */;
  if (cp >= 6964 && cp <= 6980) return 3 /* CM */;
  if (cp >= 7019 && cp <= 7027) return 3 /* CM */;
  if (cp >= 7040 && cp <= 7042) return 3 /* CM */;
  if (cp >= 7073 && cp <= 7085) return 3 /* CM */;
  if (cp >= 7142 && cp <= 7155) return 3 /* CM */;
  if (cp >= 7204 && cp <= 7223) return 3 /* CM */;
  if (cp >= 7376 && cp <= 7417) return 3 /* CM */;
  if (cp >= 7616 && cp <= 7679) return 3 /* CM */;
  if (cp >= 8400 && cp <= 8432) return 3 /* CM */;
  if (cp >= 11503 && cp <= 11505) return 3 /* CM */;
  if (cp === 11647) return 3 /* CM */;
  if (cp >= 11744 && cp <= 11775) return 3 /* CM */;
  if (cp >= 12330 && cp <= 12335) return 3 /* CM */;
  if (cp >= 12441 && cp <= 12442) return 3 /* CM */;
  if (cp >= 42607 && cp <= 42610) return 3 /* CM */;
  if (cp >= 42612 && cp <= 42621) return 3 /* CM */;
  if (cp >= 42654 && cp <= 42655) return 3 /* CM */;
  if (cp >= 42736 && cp <= 42737) return 3 /* CM */;
  if (cp >= 43010 && cp <= 43047) return 3 /* CM */;
  if (cp >= 43052 && cp <= 43052) return 3 /* CM */;
  if (cp >= 43136 && cp <= 43137) return 3 /* CM */;
  if (cp >= 43188 && cp <= 43205) return 3 /* CM */;
  if (cp >= 43232 && cp <= 43249) return 3 /* CM */;
  if (cp === 43263) return 3 /* CM */;
  if (cp >= 43302 && cp <= 43309) return 3 /* CM */;
  if (cp >= 43335 && cp <= 43347) return 3 /* CM */;
  if (cp >= 43392 && cp <= 43395) return 3 /* CM */;
  if (cp >= 43443 && cp <= 43469) return 3 /* CM */;
  if (cp === 43493) return 3 /* CM */;
  if (cp >= 43561 && cp <= 43574) return 3 /* CM */;
  if (cp >= 43587 && cp <= 43587) return 3 /* CM */;
  if (cp >= 43596 && cp <= 43597) return 3 /* CM */;
  if (cp >= 43643 && cp <= 43645) return 3 /* CM */;
  if (cp >= 43696 && cp <= 43714) return 3 /* CM */;
  if (cp >= 43755 && cp <= 43759) return 3 /* CM */;
  if (cp >= 43765 && cp <= 43766) return 3 /* CM */;
  if (cp >= 44003 && cp <= 44010) return 3 /* CM */;
  if (cp >= 44012 && cp <= 44013) return 3 /* CM */;
  if (cp === 64286) return 3 /* CM */;
  if (cp >= 65024 && cp <= 65039) return 3 /* CM */;
  if (cp >= 65056 && cp <= 65071) return 3 /* CM */;
  if (cp >= 66045 && cp <= 66045) return 3 /* CM */;
  if (cp >= 66272 && cp <= 66272) return 3 /* CM */;
  if (cp >= 66422 && cp <= 66426) return 3 /* CM */;
  if (cp >= 68097 && cp <= 68111) return 3 /* CM */;
  if (cp >= 68152 && cp <= 68159) return 3 /* CM */;
  if (cp >= 68325 && cp <= 68326) return 3 /* CM */;
  if (cp >= 68900 && cp <= 68903) return 3 /* CM */;
  if (cp >= 69291 && cp <= 69292) return 3 /* CM */;
  if (cp >= 69446 && cp <= 69456) return 3 /* CM */;
  if (cp >= 69506 && cp <= 69509) return 3 /* CM */;
  if (cp >= 69632 && cp <= 69634) return 3 /* CM */;
  if (cp >= 69688 && cp <= 69702) return 3 /* CM */;
  if (cp >= 69744 && cp <= 69744) return 3 /* CM */;
  if (cp >= 69747 && cp <= 69748) return 3 /* CM */;
  if (cp >= 69759 && cp <= 69762) return 3 /* CM */;
  if (cp >= 69808 && cp <= 69826) return 3 /* CM */;
  if (cp >= 69888 && cp <= 69890) return 3 /* CM */;
  if (cp >= 69927 && cp <= 69940) return 3 /* CM */;
  if (cp === 69957) return 3 /* CM */;
  if (cp === 69958) return 3 /* CM */;
  if (cp >= 70003 && cp <= 70003) return 3 /* CM */;
  if (cp >= 70016 && cp <= 70018) return 3 /* CM */;
  if (cp >= 70067 && cp <= 70080) return 3 /* CM */;
  if (cp >= 70089 && cp <= 70092) return 3 /* CM */;
  if (cp === 70094) return 3 /* CM */;
  if (cp === 70095) return 3 /* CM */;
  if (cp >= 70188 && cp <= 70199) return 3 /* CM */;
  if (cp === 70206) return 3 /* CM */;
  if (cp >= 70367 && cp <= 70378) return 3 /* CM */;
  if (cp >= 70400 && cp <= 70403) return 3 /* CM */;
  if (cp >= 70459 && cp <= 70460) return 3 /* CM */;
  if (cp >= 70462 && cp <= 70477) return 3 /* CM */;
  if (cp >= 70487 && cp <= 70487) return 3 /* CM */;
  if (cp >= 70498 && cp <= 70516) return 3 /* CM */;
  if (cp >= 70709 && cp <= 70726) return 3 /* CM */;
  if (cp === 70750) return 3 /* CM */;
  if (cp >= 70832 && cp <= 70851) return 3 /* CM */;
  if (cp >= 71087 && cp <= 71104) return 3 /* CM */;
  if (cp >= 71132 && cp <= 71133) return 3 /* CM */;
  if (cp >= 71216 && cp <= 71232) return 3 /* CM */;
  if (cp >= 71339 && cp <= 71351) return 3 /* CM */;
  if (cp >= 71453 && cp <= 71467) return 3 /* CM */;
  if (cp >= 71724 && cp <= 71738) return 3 /* CM */;
  if (cp >= 71984 && cp <= 71989) return 3 /* CM */;
  if (cp >= 71991 && cp <= 71992) return 3 /* CM */;
  if (cp >= 71995 && cp <= 71998) return 3 /* CM */;
  if (cp === 72e3) return 3 /* CM */;
  if (cp >= 72002 && cp <= 72003) return 3 /* CM */;
  if (cp >= 72145 && cp <= 72151) return 3 /* CM */;
  if (cp >= 72154 && cp <= 72160) return 3 /* CM */;
  if (cp === 72164) return 3 /* CM */;
  if (cp >= 72193 && cp <= 72202) return 3 /* CM */;
  if (cp >= 72243 && cp <= 72249) return 3 /* CM */;
  if (cp >= 72251 && cp <= 72254) return 3 /* CM */;
  if (cp === 72263) return 3 /* CM */;
  if (cp >= 72273 && cp <= 72283) return 3 /* CM */;
  if (cp >= 72330 && cp <= 72345) return 3 /* CM */;
  if (cp >= 72751 && cp <= 72758) return 3 /* CM */;
  if (cp >= 72760 && cp <= 72767) return 3 /* CM */;
  if (cp >= 72850 && cp <= 72871) return 3 /* CM */;
  if (cp >= 72873 && cp <= 72886) return 3 /* CM */;
  if (cp >= 73009 && cp <= 73029) return 3 /* CM */;
  if (cp === 73031) return 3 /* CM */;
  if (cp >= 73098 && cp <= 73111) return 3 /* CM */;
  if (cp >= 73459 && cp <= 73462) return 3 /* CM */;
  if (cp >= 92912 && cp <= 92916) return 3 /* CM */;
  if (cp >= 92976 && cp <= 92982) return 3 /* CM */;
  if (cp === 94031) return 3 /* CM */;
  if (cp >= 94033 && cp <= 94087) return 3 /* CM */;
  if (cp >= 94095 && cp <= 94098) return 3 /* CM */;
  if (cp >= 94180 && cp <= 94180) return 3 /* CM */;
  if (cp >= 94192 && cp <= 94193) return 3 /* CM */;
  if (cp >= 113821 && cp <= 113822) return 3 /* CM */;
  if (cp >= 118528 && cp <= 118598) return 3 /* CM */;
  if (cp >= 119141 && cp <= 119145) return 3 /* CM */;
  if (cp >= 119149 && cp <= 119154) return 3 /* CM */;
  if (cp >= 119163 && cp <= 119170) return 3 /* CM */;
  if (cp >= 119173 && cp <= 119179) return 3 /* CM */;
  if (cp >= 119210 && cp <= 119213) return 3 /* CM */;
  if (cp >= 119362 && cp <= 119364) return 3 /* CM */;
  if (cp >= 121344 && cp <= 121398) return 3 /* CM */;
  if (cp >= 121403 && cp <= 121452) return 3 /* CM */;
  if (cp === 121461) return 3 /* CM */;
  if (cp === 121476) return 3 /* CM */;
  if (cp >= 121499 && cp <= 121519) return 3 /* CM */;
  if (cp >= 122880 && cp <= 122922) return 3 /* CM */;
  if (cp >= 123184 && cp <= 123190) return 3 /* CM */;
  if (cp >= 123566 && cp <= 123566) return 3 /* CM */;
  if (cp >= 123628 && cp <= 123631) return 3 /* CM */;
  if (cp >= 125136 && cp <= 125142) return 3 /* CM */;
  if (cp >= 125252 && cp <= 125258) return 3 /* CM */;
  if (cp >= 917760 && cp <= 917999) return 3 /* CM */;
  if (cp === 33) return 18 /* EX */;
  if (cp === 63) return 18 /* EX */;
  if (cp === 34) return 22 /* QU */;
  if (cp === 39) return 22 /* QU */;
  if (cp === 40) return 21 /* OP */;
  if (cp === 41) return 17 /* CP */;
  if (cp === 91) return 21 /* OP */;
  if (cp === 93) return 17 /* CP */;
  if (cp === 123) return 21 /* OP */;
  if (cp === 125) return 16 /* CL */;
  if (cp === 44) return 23 /* IS */;
  if (cp === 46) return 23 /* IS */;
  if (cp === 58) return 23 /* IS */;
  if (cp === 59) return 23 /* IS */;
  if (cp === 45) return 14 /* HY */;
  if (cp === 8208) return 12 /* BA */;
  if (cp === 8211) return 12 /* BA */;
  if (cp === 8212) return 11 /* B2 */;
  if (cp === 8216 || cp === 8217) return 22 /* QU */;
  if (cp === 8220 || cp === 8221) return 22 /* QU */;
  if (cp === 8230) return 19 /* IN */;
  if (cp === 12289 || cp === 12290) return 16 /* CL */;
  if (cp === 12296) return 21 /* OP */;
  if (cp === 12297) return 16 /* CL */;
  if (cp === 12298) return 21 /* OP */;
  if (cp === 12299) return 16 /* CL */;
  if (cp === 12300) return 21 /* OP */;
  if (cp === 12301) return 16 /* CL */;
  if (cp === 12302) return 21 /* OP */;
  if (cp === 12303) return 16 /* CL */;
  if (cp === 12304) return 21 /* OP */;
  if (cp === 12305) return 16 /* CL */;
  if (cp === 12308) return 21 /* OP */;
  if (cp === 12309) return 16 /* CL */;
  if (cp === 12310) return 21 /* OP */;
  if (cp === 12311) return 16 /* CL */;
  if (cp >= 12312 && cp <= 12315)
    return cp % 2 === 0 ? 21 /* OP */ : 16 /* CL */;
  if (cp === 65288) return 21 /* OP */;
  if (cp === 65289) return 16 /* CL */;
  if (cp === 65292) return 16 /* CL */;
  if (cp === 65294) return 16 /* CL */;
  if (cp === 65306) return 20 /* NS */;
  if (cp === 65307) return 20 /* NS */;
  if (cp === 65311) return 18 /* EX */;
  if (cp === 65281) return 18 /* EX */;
  if (cp >= 12353 && cp <= 12438) {
    if (cp === 12353 || cp === 12355 || cp === 12357 || cp === 12359 || cp === 12361 || cp === 12387 || cp === 12419 || cp === 12421 || cp === 12423 || cp === 12430 || cp === 12437 || cp === 12438)
      return 30 /* CJ */;
    return 36 /* ID */;
  }
  if (cp >= 12449 && cp <= 12538) {
    if (cp === 12449 || cp === 12451 || cp === 12453 || cp === 12455 || cp === 12457 || cp === 12483 || cp === 12515 || cp === 12517 || cp === 12519 || cp === 12526 || cp === 12533 || cp === 12534)
      return 30 /* CJ */;
    return 36 /* ID */;
  }
  if (cp === 12540) return 30 /* CJ */;
  if (cp >= 4352 && cp <= 4447) return 37 /* JL */;
  if (cp >= 43360 && cp <= 43388) return 37 /* JL */;
  if (cp >= 4448 && cp <= 4519) return 38 /* JV */;
  if (cp >= 55216 && cp <= 55238) return 38 /* JV */;
  if (cp >= 4520 && cp <= 4607) return 39 /* JT */;
  if (cp >= 55243 && cp <= 55291) return 39 /* JT */;
  if (cp >= 44032 && cp <= 55203) {
    const sIndex = cp - 44032;
    if (sIndex % 28 === 0) return 33 /* H2 */;
    return 34 /* H3 */;
  }
  if (cp >= 48 && cp <= 57) return 24 /* NU */;
  if (cp >= 1632 && cp <= 1641) return 24 /* NU */;
  if (cp >= 1776 && cp <= 1785) return 24 /* NU */;
  if (cp >= 2406 && cp <= 2415) return 24 /* NU */;
  if (cp >= 65296 && cp <= 65305) return 24 /* NU */;
  if (cp === 36) return 26 /* PR */;
  if (cp === 163) return 26 /* PR */;
  if (cp === 165) return 26 /* PR */;
  if (cp === 8364) return 26 /* PR */;
  if (cp === 37) return 25 /* PO */;
  if (cp >= 1488 && cp <= 1514) return 35 /* HL */;
  if (cp >= 64285 && cp <= 64335) return 35 /* HL */;
  if (cp >= 19968 && cp <= 40959) return 36 /* ID */;
  if (cp >= 13312 && cp <= 19903) return 36 /* ID */;
  if (cp >= 131072 && cp <= 173791) return 36 /* ID */;
  if (cp >= 173824 && cp <= 177983) return 36 /* ID */;
  if (cp >= 177984 && cp <= 178207) return 36 /* ID */;
  if (cp >= 178208 && cp <= 183983) return 36 /* ID */;
  if (cp >= 183984 && cp <= 191471) return 36 /* ID */;
  if (cp >= 196608 && cp <= 201551) return 36 /* ID */;
  if (cp >= 63744 && cp <= 64255) return 36 /* ID */;
  if (cp >= 194560 && cp <= 195103) return 36 /* ID */;
  if (cp >= 127744 && cp <= 129535) return 36 /* ID */;
  if (cp >= 129536 && cp <= 129791) return 36 /* ID */;
  if (cp >= 9728 && cp <= 9983) return 36 /* ID */;
  if (cp >= 9984 && cp <= 10175) return 36 /* ID */;
  if (cp >= 127456 && cp <= 127487) return 40 /* RI */;
  if (cp >= 127995 && cp <= 127999) return 32 /* EM */;
  if (cp >= 3584 && cp <= 3711) return 41 /* SA */;
  if (cp >= 3712 && cp <= 3839) return 41 /* SA */;
  if (cp >= 4096 && cp <= 4255) return 41 /* SA */;
  if (cp >= 43488 && cp <= 43519) return 41 /* SA */;
  if (cp >= 43616 && cp <= 43647) return 41 /* SA */;
  if (cp >= 6016 && cp <= 6143) return 41 /* SA */;
  if (cp >= 6624 && cp <= 6655) return 41 /* SA */;
  if (cp >= 65 && cp <= 90) return 29 /* AL */;
  if (cp >= 97 && cp <= 122) return 29 /* AL */;
  if (cp >= 192 && cp <= 591) return 29 /* AL */;
  if (cp >= 1536 && cp <= 1791) return 29 /* AL */;
  if (cp >= 1872 && cp <= 1919) return 29 /* AL */;
  if (cp >= 2208 && cp <= 2303) return 29 /* AL */;
  if (cp >= 2304 && cp <= 2431) return 29 /* AL */;
  if (cp >= 2432 && cp <= 2559) return 29 /* AL */;
  if (cp >= 2560 && cp <= 2687) return 29 /* AL */;
  if (cp >= 2688 && cp <= 2815) return 29 /* AL */;
  if (cp >= 2816 && cp <= 2943) return 29 /* AL */;
  if (cp >= 2944 && cp <= 3071) return 29 /* AL */;
  if (cp >= 3072 && cp <= 3199) return 29 /* AL */;
  if (cp >= 3200 && cp <= 3327) return 29 /* AL */;
  if (cp >= 3328 && cp <= 3455) return 29 /* AL */;
  if (cp >= 1024 && cp <= 1279) return 29 /* AL */;
  if (cp >= 1280 && cp <= 1327) return 29 /* AL */;
  if (cp >= 880 && cp <= 1023) return 29 /* AL */;
  return 42 /* XX */;
}
function getPairAction(before, after) {
  if (before === 28 /* AI */) before = 29 /* AL */;
  if (before === 41 /* SA */) before = 29 /* AL */;
  if (before === 5 /* SG */) before = 29 /* AL */;
  if (before === 42 /* XX */) before = 29 /* AL */;
  if (before === 30 /* CJ */) before = 20 /* NS */;
  if (after === 28 /* AI */) after = 29 /* AL */;
  if (after === 41 /* SA */) after = 29 /* AL */;
  if (after === 5 /* SG */) after = 29 /* AL */;
  if (after === 42 /* XX */) after = 29 /* AL */;
  if (after === 30 /* CJ */) after = 20 /* NS */;
  if (before === 0 /* BK */) return 5 /* Explicit */;
  if (before === 1 /* CR */ && after === 2 /* LF */)
    return 4 /* Prohibited */;
  if (before === 1 /* CR */ || before === 2 /* LF */ || before === 4 /* NL */)
    return 5 /* Explicit */;
  if (after === 0 /* BK */ || after === 1 /* CR */ || after === 2 /* LF */ || after === 4 /* NL */)
    return 4 /* Prohibited */;
  if (after === 9 /* SP */ || after === 7 /* ZW */)
    return 4 /* Prohibited */;
  if (before === 7 /* ZW */) return 0 /* Direct */;
  if (before === 10 /* ZWJ */) return 4 /* Prohibited */;
  if (after === 3 /* CM */ || after === 10 /* ZWJ */) {
    if (before !== 9 /* SP */) return 4 /* Prohibited */;
  }
  let beforeResolved = before;
  let afterResolved = after;
  if (before === 3 /* CM */ || before === 10 /* ZWJ */)
    beforeResolved = 29 /* AL */;
  if (after === 3 /* CM */ || after === 10 /* ZWJ */)
    afterResolved = 29 /* AL */;
  before = beforeResolved;
  after = afterResolved;
  if (before === 6 /* WJ */ || after === 6 /* WJ */)
    return 4 /* Prohibited */;
  if (before === 8 /* GL */) return 4 /* Prohibited */;
  if (after === 8 /* GL */) {
    if (before !== 9 /* SP */ && before !== 12 /* BA */ && before !== 14 /* HY */)
      return 4 /* Prohibited */;
  }
  if (after === 16 /* CL */ || after === 17 /* CP */ || after === 18 /* EX */ || after === 23 /* IS */ || after === 27 /* SY */)
    return 4 /* Prohibited */;
  if (before === 21 /* OP */) return 4 /* Prohibited */;
  if (before === 22 /* QU */ && after === 21 /* OP */)
    return 4 /* Prohibited */;
  if ((before === 16 /* CL */ || before === 17 /* CP */) && after === 20 /* NS */)
    return 4 /* Prohibited */;
  if (before === 11 /* B2 */ && after === 11 /* B2 */)
    return 4 /* Prohibited */;
  if (before === 9 /* SP */) return 0 /* Direct */;
  if (before === 22 /* QU */ || after === 22 /* QU */)
    return 4 /* Prohibited */;
  if (before === 15 /* CB */ || after === 15 /* CB */)
    return 0 /* Direct */;
  if (after === 12 /* BA */ || after === 14 /* HY */ || after === 20 /* NS */)
    return 4 /* Prohibited */;
  if (before === 13 /* BB */) return 4 /* Prohibited */;
  if (before === 27 /* SY */ && after === 35 /* HL */)
    return 4 /* Prohibited */;
  if (after === 19 /* IN */) return 4 /* Prohibited */;
  if ((before === 29 /* AL */ || before === 35 /* HL */) && after === 24 /* NU */)
    return 4 /* Prohibited */;
  if (before === 24 /* NU */ && (after === 29 /* AL */ || after === 35 /* HL */))
    return 4 /* Prohibited */;
  if (before === 26 /* PR */ && after === 36 /* ID */)
    return 4 /* Prohibited */;
  if (before === 36 /* ID */ && after === 25 /* PO */)
    return 4 /* Prohibited */;
  if ((before === 26 /* PR */ || before === 25 /* PO */) && (after === 29 /* AL */ || after === 35 /* HL */))
    return 4 /* Prohibited */;
  if ((before === 29 /* AL */ || before === 35 /* HL */) && (after === 26 /* PR */ || after === 25 /* PO */))
    return 4 /* Prohibited */;
  if ((before === 16 /* CL */ || before === 17 /* CP */) && after === 24 /* NU */)
    return 4 /* Prohibited */;
  if (before === 24 /* NU */ && (after === 25 /* PO */ || after === 26 /* PR */))
    return 4 /* Prohibited */;
  if ((before === 25 /* PO */ || before === 26 /* PR */ || before === 14 /* HY */ || before === 23 /* IS */ || before === 24 /* NU */ || before === 27 /* SY */) && after === 24 /* NU */)
    return 4 /* Prohibited */;
  if (before === 37 /* JL */) {
    if (after === 37 /* JL */ || after === 38 /* JV */ || after === 33 /* H2 */ || after === 34 /* H3 */)
      return 4 /* Prohibited */;
  }
  if (before === 38 /* JV */ || before === 33 /* H2 */) {
    if (after === 38 /* JV */ || after === 39 /* JT */)
      return 4 /* Prohibited */;
  }
  if (before === 39 /* JT */ || before === 34 /* H3 */) {
    if (after === 39 /* JT */) return 4 /* Prohibited */;
  }
  if (before === 37 /* JL */ || before === 38 /* JV */ || before === 39 /* JT */ || before === 33 /* H2 */ || before === 34 /* H3 */) {
    if (after === 25 /* PO */) return 4 /* Prohibited */;
  }
  if (after === 37 /* JL */ || after === 38 /* JV */ || after === 39 /* JT */ || after === 33 /* H2 */ || after === 34 /* H3 */) {
    if (before === 26 /* PR */) return 4 /* Prohibited */;
  }
  if ((before === 29 /* AL */ || before === 35 /* HL */) && (after === 29 /* AL */ || after === 35 /* HL */))
    return 4 /* Prohibited */;
  if (before === 23 /* IS */ && (after === 29 /* AL */ || after === 35 /* HL */))
    return 4 /* Prohibited */;
  if ((before === 29 /* AL */ || before === 35 /* HL */ || before === 24 /* NU */) && after === 21 /* OP */)
    return 4 /* Prohibited */;
  if (before === 17 /* CP */ && (after === 29 /* AL */ || after === 35 /* HL */ || after === 24 /* NU */))
    return 4 /* Prohibited */;
  if (before === 40 /* RI */ && after === 40 /* RI */)
    return 4 /* Prohibited */;
  if (before === 31 /* EB */ && after === 32 /* EM */)
    return 4 /* Prohibited */;
  return 0 /* Direct */;
}
function analyzeLineBreaks(text) {
  const codepoints = [];
  for (const char of text) {
    codepoints.push(char.codePointAt(0) ?? 0);
  }
  return analyzeLineBreaksFromCodepoints(codepoints);
}
function analyzeLineBreaksFromCodepoints(codepoints) {
  const len = codepoints.length;
  const classes = [];
  const breaks = [];
  for (const cp of codepoints) {
    classes.push(getLineBreakClass(cp));
  }
  breaks.push(0 /* NoBreak */);
  for (let i = 1; i < len; i++) {
    const before = classes[i - 1];
    const after = classes[i];
    const action = getPairAction(before, after);
    switch (action) {
      case 5 /* Explicit */:
        breaks.push(2 /* Mandatory */);
        break;
      case 0 /* Direct */:
        breaks.push(1 /* Optional */);
        break;
      case 1 /* Indirect */:
        if (before === 9 /* SP */) {
          breaks.push(1 /* Optional */);
        } else {
          breaks.push(0 /* NoBreak */);
        }
        break;
      default:
        breaks.push(0 /* NoBreak */);
    }
  }
  breaks.push(2 /* Mandatory */);
  return { breaks, classes };
}
function analyzeLineBreaksForGlyphs(infos) {
  const codepoints = infos.map((info) => info.codepoint);
  return analyzeLineBreaksFromCodepoints(codepoints);
}
function findNextBreak(analysis, startIndex) {
  for (let i = startIndex + 1; i < analysis.breaks.length; i++) {
    if (analysis.breaks[i] !== 0 /* NoBreak */) {
      return i;
    }
  }
  return analysis.breaks.length - 1;
}
function canBreakAt(analysis, index) {
  if (index < 0 || index >= analysis.breaks.length) return false;
  return analysis.breaks[index] !== 0 /* NoBreak */;
}
function mustBreakAt(analysis, index) {
  if (index < 0 || index >= analysis.breaks.length) return false;
  return analysis.breaks[index] === 2 /* Mandatory */;
}
function getAllBreakOpportunities(analysis) {
  const opportunities = [];
  for (let i = 0; i < analysis.breaks.length; i++) {
    if (analysis.breaks[i] !== 0 /* NoBreak */) {
      opportunities.push(i);
    }
  }
  return opportunities;
}

// src/unicode/segmentation.ts
var GraphemeBreakProperty = /* @__PURE__ */ ((GraphemeBreakProperty2) => {
  GraphemeBreakProperty2[GraphemeBreakProperty2["Other"] = 0] = "Other";
  GraphemeBreakProperty2[GraphemeBreakProperty2["CR"] = 1] = "CR";
  GraphemeBreakProperty2[GraphemeBreakProperty2["LF"] = 2] = "LF";
  GraphemeBreakProperty2[GraphemeBreakProperty2["Control"] = 3] = "Control";
  GraphemeBreakProperty2[GraphemeBreakProperty2["Extend"] = 4] = "Extend";
  GraphemeBreakProperty2[GraphemeBreakProperty2["ZWJ"] = 5] = "ZWJ";
  GraphemeBreakProperty2[GraphemeBreakProperty2["Regional_Indicator"] = 6] = "Regional_Indicator";
  GraphemeBreakProperty2[GraphemeBreakProperty2["Prepend"] = 7] = "Prepend";
  GraphemeBreakProperty2[GraphemeBreakProperty2["SpacingMark"] = 8] = "SpacingMark";
  GraphemeBreakProperty2[GraphemeBreakProperty2["L"] = 9] = "L";
  GraphemeBreakProperty2[GraphemeBreakProperty2["V"] = 10] = "V";
  GraphemeBreakProperty2[GraphemeBreakProperty2["T"] = 11] = "T";
  GraphemeBreakProperty2[GraphemeBreakProperty2["LV"] = 12] = "LV";
  GraphemeBreakProperty2[GraphemeBreakProperty2["LVT"] = 13] = "LVT";
  GraphemeBreakProperty2[GraphemeBreakProperty2["Extended_Pictographic"] = 14] = "Extended_Pictographic";
  return GraphemeBreakProperty2;
})(GraphemeBreakProperty || {});
var WordBreakProperty = /* @__PURE__ */ ((WordBreakProperty2) => {
  WordBreakProperty2[WordBreakProperty2["Other"] = 0] = "Other";
  WordBreakProperty2[WordBreakProperty2["CR"] = 1] = "CR";
  WordBreakProperty2[WordBreakProperty2["LF"] = 2] = "LF";
  WordBreakProperty2[WordBreakProperty2["Newline"] = 3] = "Newline";
  WordBreakProperty2[WordBreakProperty2["Extend"] = 4] = "Extend";
  WordBreakProperty2[WordBreakProperty2["ZWJ"] = 5] = "ZWJ";
  WordBreakProperty2[WordBreakProperty2["Regional_Indicator"] = 6] = "Regional_Indicator";
  WordBreakProperty2[WordBreakProperty2["Format"] = 7] = "Format";
  WordBreakProperty2[WordBreakProperty2["Katakana"] = 8] = "Katakana";
  WordBreakProperty2[WordBreakProperty2["Hebrew_Letter"] = 9] = "Hebrew_Letter";
  WordBreakProperty2[WordBreakProperty2["ALetter"] = 10] = "ALetter";
  WordBreakProperty2[WordBreakProperty2["Single_Quote"] = 11] = "Single_Quote";
  WordBreakProperty2[WordBreakProperty2["Double_Quote"] = 12] = "Double_Quote";
  WordBreakProperty2[WordBreakProperty2["MidNumLet"] = 13] = "MidNumLet";
  WordBreakProperty2[WordBreakProperty2["MidLetter"] = 14] = "MidLetter";
  WordBreakProperty2[WordBreakProperty2["MidNum"] = 15] = "MidNum";
  WordBreakProperty2[WordBreakProperty2["Numeric"] = 16] = "Numeric";
  WordBreakProperty2[WordBreakProperty2["ExtendNumLet"] = 17] = "ExtendNumLet";
  WordBreakProperty2[WordBreakProperty2["WSegSpace"] = 18] = "WSegSpace";
  WordBreakProperty2[WordBreakProperty2["Extended_Pictographic"] = 19] = "Extended_Pictographic";
  return WordBreakProperty2;
})(WordBreakProperty || {});
function getGraphemeBreakProperty(cp) {
  if (cp === 13) return 1 /* CR */;
  if (cp === 10) return 2 /* LF */;
  if (cp >= 0 && cp <= 31 && cp !== 10 && cp !== 13)
    return 3 /* Control */;
  if (cp >= 127 && cp <= 159) return 3 /* Control */;
  if (cp === 173) return 3 /* Control */;
  if (cp === 1564) return 3 /* Control */;
  if (cp === 6158) return 3 /* Control */;
  if (cp === 8203) return 3 /* Control */;
  if (cp >= 8206 && cp <= 8207) return 3 /* Control */;
  if (cp >= 8232 && cp <= 8238) return 3 /* Control */;
  if (cp >= 8288 && cp <= 8303) return 3 /* Control */;
  if (cp === 65279) return 3 /* Control */;
  if (cp >= 65520 && cp <= 65531) return 3 /* Control */;
  if (cp === 8205) return 5 /* ZWJ */;
  if (cp >= 127456 && cp <= 127487) return 6 /* Regional_Indicator */;
  if (cp === 1536 || cp === 1537 || cp === 1538 || cp === 1539 || cp === 1540 || cp === 1541 || cp === 1757 || cp === 1807 || cp === 2192 || cp === 2193 || cp === 2274 || cp === 69821 || cp === 69837)
    return 7 /* Prepend */;
  if (cp >= 4352 && cp <= 4447) return 9 /* L */;
  if (cp >= 43360 && cp <= 43388) return 9 /* L */;
  if (cp >= 4448 && cp <= 4519) return 10 /* V */;
  if (cp >= 55216 && cp <= 55238) return 10 /* V */;
  if (cp >= 4520 && cp <= 4607) return 11 /* T */;
  if (cp >= 55243 && cp <= 55291) return 11 /* T */;
  if (cp >= 44032 && cp <= 55203) {
    const sIndex = cp - 44032;
    if (sIndex % 28 === 0) return 12 /* LV */;
    return 13 /* LVT */;
  }
  if (cp >= 127744 && cp <= 129535) return 14 /* Extended_Pictographic */;
  if (cp >= 129536 && cp <= 129791) return 14 /* Extended_Pictographic */;
  if (cp >= 9728 && cp <= 9983) return 14 /* Extended_Pictographic */;
  if (cp >= 9984 && cp <= 10175) return 14 /* Extended_Pictographic */;
  if (cp === 169 || cp === 174) return 14 /* Extended_Pictographic */;
  if (cp >= 8960 && cp <= 9215) return 14 /* Extended_Pictographic */;
  if (cp >= 126976 && cp <= 127023) return 14 /* Extended_Pictographic */;
  if (cp >= 127136 && cp <= 127231) return 14 /* Extended_Pictographic */;
  if (cp >= 127232 && cp <= 127487) return 14 /* Extended_Pictographic */;
  if (cp >= 127488 && cp <= 127743) return 14 /* Extended_Pictographic */;
  if (cp >= 2307 && cp <= 2307) return 8 /* SpacingMark */;
  if (cp >= 2363 && cp <= 2363) return 8 /* SpacingMark */;
  if (cp >= 2366 && cp <= 2368) return 8 /* SpacingMark */;
  if (cp >= 2377 && cp <= 2380) return 8 /* SpacingMark */;
  if (cp >= 2382 && cp <= 2383) return 8 /* SpacingMark */;
  if (cp >= 2434 && cp <= 2435) return 8 /* SpacingMark */;
  if (cp >= 2494 && cp <= 2496) return 8 /* SpacingMark */;
  if (cp >= 2503 && cp <= 2508) return 8 /* SpacingMark */;
  if (cp === 2519) return 8 /* SpacingMark */;
  if (cp >= 2563 && cp <= 2563) return 8 /* SpacingMark */;
  if (cp >= 2622 && cp <= 2624) return 8 /* SpacingMark */;
  if (cp >= 2691 && cp <= 2691) return 8 /* SpacingMark */;
  if (cp >= 2750 && cp <= 2752) return 8 /* SpacingMark */;
  if (cp === 2761) return 8 /* SpacingMark */;
  if (cp >= 2763 && cp <= 2764) return 8 /* SpacingMark */;
  if (cp >= 2818 && cp <= 2819) return 8 /* SpacingMark */;
  if (cp === 2878) return 8 /* SpacingMark */;
  if (cp === 2880) return 8 /* SpacingMark */;
  if (cp >= 2887 && cp <= 2892) return 8 /* SpacingMark */;
  if (cp === 2903) return 8 /* SpacingMark */;
  if (cp >= 3006 && cp <= 3007) return 8 /* SpacingMark */;
  if (cp >= 3009 && cp <= 3020) return 8 /* SpacingMark */;
  if (cp === 3031) return 8 /* SpacingMark */;
  if (cp >= 3073 && cp <= 3075) return 8 /* SpacingMark */;
  if (cp >= 3137 && cp <= 3140) return 8 /* SpacingMark */;
  if (cp >= 3202 && cp <= 3203) return 8 /* SpacingMark */;
  if (cp === 3262) return 8 /* SpacingMark */;
  if (cp >= 3264 && cp <= 3268) return 8 /* SpacingMark */;
  if (cp >= 3271 && cp <= 3275) return 8 /* SpacingMark */;
  if (cp >= 3285 && cp <= 3286) return 8 /* SpacingMark */;
  if (cp >= 3330 && cp <= 3331) return 8 /* SpacingMark */;
  if (cp >= 3390 && cp <= 3392) return 8 /* SpacingMark */;
  if (cp >= 3398 && cp <= 3404) return 8 /* SpacingMark */;
  if (cp === 3415) return 8 /* SpacingMark */;
  if (cp >= 3458 && cp <= 3459) return 8 /* SpacingMark */;
  if (cp >= 3535 && cp <= 3537) return 8 /* SpacingMark */;
  if (cp >= 3544 && cp <= 3551) return 8 /* SpacingMark */;
  if (cp >= 3570 && cp <= 3571) return 8 /* SpacingMark */;
  if (cp === 3902 || cp === 3903) return 8 /* SpacingMark */;
  if (cp === 3967) return 8 /* SpacingMark */;
  if (cp >= 4139 && cp <= 4140) return 8 /* SpacingMark */;
  if (cp === 4145) return 8 /* SpacingMark */;
  if (cp === 4152) return 8 /* SpacingMark */;
  if (cp >= 4155 && cp <= 4156) return 8 /* SpacingMark */;
  if (cp >= 4182 && cp <= 4183) return 8 /* SpacingMark */;
  if (cp === 4194) return 8 /* SpacingMark */;
  if (cp >= 4199 && cp <= 4200) return 8 /* SpacingMark */;
  if (cp >= 4227 && cp <= 4228) return 8 /* SpacingMark */;
  if (cp >= 4231 && cp <= 4236) return 8 /* SpacingMark */;
  if (cp === 4239) return 8 /* SpacingMark */;
  if (cp >= 4250 && cp <= 4252) return 8 /* SpacingMark */;
  if (cp >= 6070 && cp <= 6070) return 8 /* SpacingMark */;
  if (cp >= 6078 && cp <= 6085) return 8 /* SpacingMark */;
  if (cp >= 6087 && cp <= 6088) return 8 /* SpacingMark */;
  if (cp >= 6435 && cp <= 6438) return 8 /* SpacingMark */;
  if (cp >= 6441 && cp <= 6443) return 8 /* SpacingMark */;
  if (cp >= 6448 && cp <= 6449) return 8 /* SpacingMark */;
  if (cp >= 6451 && cp <= 6456) return 8 /* SpacingMark */;
  if (cp >= 768 && cp <= 879) return 4 /* Extend */;
  if (cp >= 1155 && cp <= 1161) return 4 /* Extend */;
  if (cp >= 1425 && cp <= 1469) return 4 /* Extend */;
  if (cp === 1471) return 4 /* Extend */;
  if (cp >= 1473 && cp <= 1474) return 4 /* Extend */;
  if (cp >= 1476 && cp <= 1477) return 4 /* Extend */;
  if (cp === 1479) return 4 /* Extend */;
  if (cp >= 1552 && cp <= 1562) return 4 /* Extend */;
  if (cp >= 1611 && cp <= 1631) return 4 /* Extend */;
  if (cp === 1648) return 4 /* Extend */;
  if (cp >= 1750 && cp <= 1756) return 4 /* Extend */;
  if (cp >= 1759 && cp <= 1764) return 4 /* Extend */;
  if (cp >= 1767 && cp <= 1768) return 4 /* Extend */;
  if (cp >= 1770 && cp <= 1773) return 4 /* Extend */;
  if (cp === 1809) return 4 /* Extend */;
  if (cp >= 1840 && cp <= 1866) return 4 /* Extend */;
  if (cp >= 1958 && cp <= 1968) return 4 /* Extend */;
  if (cp >= 2027 && cp <= 2035) return 4 /* Extend */;
  if (cp === 2045) return 4 /* Extend */;
  if (cp >= 2070 && cp <= 2073) return 4 /* Extend */;
  if (cp >= 2075 && cp <= 2083) return 4 /* Extend */;
  if (cp >= 2085 && cp <= 2087) return 4 /* Extend */;
  if (cp >= 2089 && cp <= 2093) return 4 /* Extend */;
  if (cp >= 2137 && cp <= 2139) return 4 /* Extend */;
  if (cp >= 2259 && cp <= 2273) return 4 /* Extend */;
  if (cp >= 2275 && cp <= 2306) return 4 /* Extend */;
  if (cp === 2362) return 4 /* Extend */;
  if (cp === 2364) return 4 /* Extend */;
  if (cp >= 2369 && cp <= 2376) return 4 /* Extend */;
  if (cp === 2381) return 4 /* Extend */;
  if (cp >= 2385 && cp <= 2391) return 4 /* Extend */;
  if (cp >= 2402 && cp <= 2403) return 4 /* Extend */;
  if (cp === 2433) return 4 /* Extend */;
  if (cp === 2492) return 4 /* Extend */;
  if (cp >= 2497 && cp <= 2500) return 4 /* Extend */;
  if (cp === 2509) return 4 /* Extend */;
  if (cp >= 2530 && cp <= 2531) return 4 /* Extend */;
  if (cp === 2558) return 4 /* Extend */;
  if (cp >= 2561 && cp <= 2562) return 4 /* Extend */;
  if (cp === 2620) return 4 /* Extend */;
  if (cp >= 2625 && cp <= 2626) return 4 /* Extend */;
  if (cp >= 2631 && cp <= 2632) return 4 /* Extend */;
  if (cp >= 2635 && cp <= 2637) return 4 /* Extend */;
  if (cp === 2641) return 4 /* Extend */;
  if (cp >= 2672 && cp <= 2673) return 4 /* Extend */;
  if (cp === 2677) return 4 /* Extend */;
  if (cp >= 2689 && cp <= 2690) return 4 /* Extend */;
  if (cp === 2748) return 4 /* Extend */;
  if (cp >= 2753 && cp <= 2757) return 4 /* Extend */;
  if (cp >= 2759 && cp <= 2760) return 4 /* Extend */;
  if (cp === 2765) return 4 /* Extend */;
  if (cp >= 2786 && cp <= 2787) return 4 /* Extend */;
  if (cp >= 2810 && cp <= 2815) return 4 /* Extend */;
  if (cp === 2817) return 4 /* Extend */;
  if (cp === 2876) return 4 /* Extend */;
  if (cp === 2879) return 4 /* Extend */;
  if (cp >= 2881 && cp <= 2884) return 4 /* Extend */;
  if (cp === 2893) return 4 /* Extend */;
  if (cp >= 2901 && cp <= 2902) return 4 /* Extend */;
  if (cp >= 2914 && cp <= 2915) return 4 /* Extend */;
  if (cp === 2946) return 4 /* Extend */;
  if (cp === 3008) return 4 /* Extend */;
  if (cp === 3021) return 4 /* Extend */;
  if (cp === 3072) return 4 /* Extend */;
  if (cp === 3076) return 4 /* Extend */;
  if (cp >= 3134 && cp <= 3136) return 4 /* Extend */;
  if (cp >= 3142 && cp <= 3144) return 4 /* Extend */;
  if (cp >= 3146 && cp <= 3149) return 4 /* Extend */;
  if (cp >= 3157 && cp <= 3158) return 4 /* Extend */;
  if (cp >= 3170 && cp <= 3171) return 4 /* Extend */;
  if (cp === 3201) return 4 /* Extend */;
  if (cp === 3260) return 4 /* Extend */;
  if (cp === 3263) return 4 /* Extend */;
  if (cp === 3270) return 4 /* Extend */;
  if (cp >= 3276 && cp <= 3277) return 4 /* Extend */;
  if (cp >= 3298 && cp <= 3299) return 4 /* Extend */;
  if (cp >= 3328 && cp <= 3329) return 4 /* Extend */;
  if (cp >= 3387 && cp <= 3388) return 4 /* Extend */;
  if (cp >= 3393 && cp <= 3396) return 4 /* Extend */;
  if (cp === 3405) return 4 /* Extend */;
  if (cp >= 3426 && cp <= 3427) return 4 /* Extend */;
  if (cp === 3457) return 4 /* Extend */;
  if (cp === 3530) return 4 /* Extend */;
  if (cp >= 3538 && cp <= 3540) return 4 /* Extend */;
  if (cp === 3542) return 4 /* Extend */;
  if (cp === 3633) return 4 /* Extend */;
  if (cp >= 3636 && cp <= 3642) return 4 /* Extend */;
  if (cp >= 3655 && cp <= 3662) return 4 /* Extend */;
  if (cp === 3761) return 4 /* Extend */;
  if (cp >= 3764 && cp <= 3772) return 4 /* Extend */;
  if (cp >= 3784 && cp <= 3789) return 4 /* Extend */;
  if (cp >= 3864 && cp <= 3865) return 4 /* Extend */;
  if (cp === 3893) return 4 /* Extend */;
  if (cp === 3895) return 4 /* Extend */;
  if (cp === 3897) return 4 /* Extend */;
  if (cp >= 3953 && cp <= 3966) return 4 /* Extend */;
  if (cp >= 3968 && cp <= 3972) return 4 /* Extend */;
  if (cp >= 3974 && cp <= 3975) return 4 /* Extend */;
  if (cp >= 3981 && cp <= 3991) return 4 /* Extend */;
  if (cp >= 3993 && cp <= 4028) return 4 /* Extend */;
  if (cp === 4038) return 4 /* Extend */;
  if (cp >= 4141 && cp <= 4144) return 4 /* Extend */;
  if (cp >= 4146 && cp <= 4151) return 4 /* Extend */;
  if (cp >= 4153 && cp <= 4154) return 4 /* Extend */;
  if (cp >= 4157 && cp <= 4158) return 4 /* Extend */;
  if (cp >= 4184 && cp <= 4185) return 4 /* Extend */;
  if (cp >= 4190 && cp <= 4192) return 4 /* Extend */;
  if (cp >= 4209 && cp <= 4212) return 4 /* Extend */;
  if (cp === 4226) return 4 /* Extend */;
  if (cp >= 4229 && cp <= 4230) return 4 /* Extend */;
  if (cp === 4237) return 4 /* Extend */;
  if (cp === 4253) return 4 /* Extend */;
  if (cp >= 4957 && cp <= 4959) return 4 /* Extend */;
  if (cp >= 5906 && cp <= 5908) return 4 /* Extend */;
  if (cp >= 5938 && cp <= 5940) return 4 /* Extend */;
  if (cp >= 5970 && cp <= 5971) return 4 /* Extend */;
  if (cp >= 6002 && cp <= 6003) return 4 /* Extend */;
  if (cp >= 6068 && cp <= 6069) return 4 /* Extend */;
  if (cp >= 6071 && cp <= 6077) return 4 /* Extend */;
  if (cp === 6086) return 4 /* Extend */;
  if (cp >= 6089 && cp <= 6099) return 4 /* Extend */;
  if (cp === 6109) return 4 /* Extend */;
  if (cp >= 6155 && cp <= 6157) return 4 /* Extend */;
  if (cp === 6159) return 4 /* Extend */;
  if (cp >= 6277 && cp <= 6278) return 4 /* Extend */;
  if (cp === 6313) return 4 /* Extend */;
  if (cp >= 6432 && cp <= 6434) return 4 /* Extend */;
  if (cp >= 6439 && cp <= 6440) return 4 /* Extend */;
  if (cp === 6450) return 4 /* Extend */;
  if (cp >= 6457 && cp <= 6459) return 4 /* Extend */;
  if (cp >= 6679 && cp <= 6680) return 4 /* Extend */;
  if (cp === 6683) return 4 /* Extend */;
  if (cp === 6742) return 4 /* Extend */;
  if (cp >= 6744 && cp <= 6750) return 4 /* Extend */;
  if (cp === 6752) return 4 /* Extend */;
  if (cp === 6754) return 4 /* Extend */;
  if (cp >= 6757 && cp <= 6764) return 4 /* Extend */;
  if (cp >= 6771 && cp <= 6780) return 4 /* Extend */;
  if (cp === 6783) return 4 /* Extend */;
  if (cp >= 6832 && cp <= 6862) return 4 /* Extend */;
  if (cp >= 6912 && cp <= 6915) return 4 /* Extend */;
  if (cp === 6964) return 4 /* Extend */;
  if (cp >= 6966 && cp <= 6970) return 4 /* Extend */;
  if (cp === 6972) return 4 /* Extend */;
  if (cp === 6978) return 4 /* Extend */;
  if (cp >= 7019 && cp <= 7027) return 4 /* Extend */;
  if (cp >= 7040 && cp <= 7041) return 4 /* Extend */;
  if (cp >= 7074 && cp <= 7077) return 4 /* Extend */;
  if (cp >= 7080 && cp <= 7081) return 4 /* Extend */;
  if (cp >= 7083 && cp <= 7085) return 4 /* Extend */;
  if (cp === 7142) return 4 /* Extend */;
  if (cp >= 7144 && cp <= 7145) return 4 /* Extend */;
  if (cp === 7149) return 4 /* Extend */;
  if (cp >= 7151 && cp <= 7153) return 4 /* Extend */;
  if (cp >= 7212 && cp <= 7219) return 4 /* Extend */;
  if (cp >= 7222 && cp <= 7223) return 4 /* Extend */;
  if (cp >= 7376 && cp <= 7378) return 4 /* Extend */;
  if (cp >= 7380 && cp <= 7392) return 4 /* Extend */;
  if (cp >= 7394 && cp <= 7400) return 4 /* Extend */;
  if (cp === 7405) return 4 /* Extend */;
  if (cp === 7412) return 4 /* Extend */;
  if (cp >= 7416 && cp <= 7417) return 4 /* Extend */;
  if (cp >= 7616 && cp <= 7679) return 4 /* Extend */;
  if (cp >= 8400 && cp <= 8432) return 4 /* Extend */;
  if (cp >= 11503 && cp <= 11505) return 4 /* Extend */;
  if (cp === 11647) return 4 /* Extend */;
  if (cp >= 11744 && cp <= 11775) return 4 /* Extend */;
  if (cp >= 12330 && cp <= 12335) return 4 /* Extend */;
  if (cp >= 12441 && cp <= 12442) return 4 /* Extend */;
  if (cp >= 42607 && cp <= 42610) return 4 /* Extend */;
  if (cp >= 42612 && cp <= 42621) return 4 /* Extend */;
  if (cp >= 42654 && cp <= 42655) return 4 /* Extend */;
  if (cp >= 42736 && cp <= 42737) return 4 /* Extend */;
  if (cp === 43010) return 4 /* Extend */;
  if (cp === 43014) return 4 /* Extend */;
  if (cp === 43019) return 4 /* Extend */;
  if (cp >= 43045 && cp <= 43046) return 4 /* Extend */;
  if (cp === 43052) return 4 /* Extend */;
  if (cp >= 43204 && cp <= 43205) return 4 /* Extend */;
  if (cp >= 43232 && cp <= 43249) return 4 /* Extend */;
  if (cp === 43263) return 4 /* Extend */;
  if (cp >= 43302 && cp <= 43309) return 4 /* Extend */;
  if (cp >= 43335 && cp <= 43345) return 4 /* Extend */;
  if (cp >= 43392 && cp <= 43394) return 4 /* Extend */;
  if (cp === 43443) return 4 /* Extend */;
  if (cp >= 43446 && cp <= 43449) return 4 /* Extend */;
  if (cp >= 43452 && cp <= 43453) return 4 /* Extend */;
  if (cp === 43493) return 4 /* Extend */;
  if (cp >= 43561 && cp <= 43566) return 4 /* Extend */;
  if (cp >= 43569 && cp <= 43570) return 4 /* Extend */;
  if (cp >= 43573 && cp <= 43574) return 4 /* Extend */;
  if (cp === 43587) return 4 /* Extend */;
  if (cp === 43596) return 4 /* Extend */;
  if (cp === 43644) return 4 /* Extend */;
  if (cp === 43696) return 4 /* Extend */;
  if (cp >= 43698 && cp <= 43700) return 4 /* Extend */;
  if (cp >= 43703 && cp <= 43704) return 4 /* Extend */;
  if (cp >= 43710 && cp <= 43711) return 4 /* Extend */;
  if (cp === 43713) return 4 /* Extend */;
  if (cp >= 43756 && cp <= 43757) return 4 /* Extend */;
  if (cp === 43766) return 4 /* Extend */;
  if (cp === 44005) return 4 /* Extend */;
  if (cp === 44008) return 4 /* Extend */;
  if (cp === 44013) return 4 /* Extend */;
  if (cp === 64286) return 4 /* Extend */;
  if (cp >= 65024 && cp <= 65039) return 4 /* Extend */;
  if (cp >= 65056 && cp <= 65071) return 4 /* Extend */;
  if (cp >= 127995 && cp <= 127999) return 4 /* Extend */;
  if (cp >= 917760 && cp <= 917999) return 4 /* Extend */;
  return 0 /* Other */;
}
function getWordBreakProperty(cp) {
  if (cp === 13) return 1 /* CR */;
  if (cp === 10) return 2 /* LF */;
  if (cp === 11 || cp === 12 || cp === 133 || cp === 8232 || cp === 8233)
    return 3 /* Newline */;
  if (cp === 8205) return 5 /* ZWJ */;
  if (cp === 173) return 7 /* Format */;
  if (cp === 1564) return 7 /* Format */;
  if (cp === 8203) return 7 /* Format */;
  if (cp >= 8206 && cp <= 8207) return 7 /* Format */;
  if (cp >= 8288 && cp <= 8303) return 7 /* Format */;
  if (cp === 65279) return 7 /* Format */;
  if (cp >= 127456 && cp <= 127487) return 6 /* Regional_Indicator */;
  if (cp >= 127744 && cp <= 129535) return 19 /* Extended_Pictographic */;
  if (cp >= 129536 && cp <= 129791) return 19 /* Extended_Pictographic */;
  if (cp >= 9728 && cp <= 9983) return 19 /* Extended_Pictographic */;
  if (cp >= 9984 && cp <= 10175) return 19 /* Extended_Pictographic */;
  if (cp >= 1488 && cp <= 1514) return 9 /* Hebrew_Letter */;
  if (cp >= 64285 && cp <= 64335) return 9 /* Hebrew_Letter */;
  if (cp >= 12448 && cp <= 12543) return 8 /* Katakana */;
  if (cp === 12337 || cp === 12338 || cp === 12339 || cp === 12340 || cp === 12341)
    return 8 /* Katakana */;
  if (cp === 12443 || cp === 12444) return 8 /* Katakana */;
  if (cp >= 12784 && cp <= 12799) return 8 /* Katakana */;
  if (cp >= 13008 && cp <= 13054) return 8 /* Katakana */;
  if (cp >= 13056 && cp <= 13143) return 8 /* Katakana */;
  if (cp >= 65382 && cp <= 65437) return 8 /* Katakana */;
  if (cp === 39) return 11 /* Single_Quote */;
  if (cp === 34) return 12 /* Double_Quote */;
  if (cp === 46) return 13 /* MidNumLet */;
  if (cp === 8216 || cp === 8217) return 13 /* MidNumLet */;
  if (cp === 8228) return 13 /* MidNumLet */;
  if (cp === 65106) return 13 /* MidNumLet */;
  if (cp === 65287) return 13 /* MidNumLet */;
  if (cp === 65294) return 13 /* MidNumLet */;
  if (cp === 58) return 14 /* MidLetter */;
  if (cp === 183) return 14 /* MidLetter */;
  if (cp === 903) return 14 /* MidLetter */;
  if (cp === 1524) return 14 /* MidLetter */;
  if (cp === 8231) return 14 /* MidLetter */;
  if (cp === 65043) return 14 /* MidLetter */;
  if (cp === 65109) return 14 /* MidLetter */;
  if (cp === 65306) return 14 /* MidLetter */;
  if (cp === 44) return 15 /* MidNum */;
  if (cp === 59) return 15 /* MidNum */;
  if (cp === 894) return 15 /* MidNum */;
  if (cp === 1417) return 15 /* MidNum */;
  if (cp === 1548 || cp === 1549) return 15 /* MidNum */;
  if (cp === 1644) return 15 /* MidNum */;
  if (cp === 2040) return 15 /* MidNum */;
  if (cp === 8260) return 15 /* MidNum */;
  if (cp === 65040) return 15 /* MidNum */;
  if (cp === 65044) return 15 /* MidNum */;
  if (cp === 65104) return 15 /* MidNum */;
  if (cp === 65108) return 15 /* MidNum */;
  if (cp === 65292) return 15 /* MidNum */;
  if (cp === 65307) return 15 /* MidNum */;
  if (cp >= 48 && cp <= 57) return 16 /* Numeric */;
  if (cp >= 1632 && cp <= 1641) return 16 /* Numeric */;
  if (cp >= 1776 && cp <= 1785) return 16 /* Numeric */;
  if (cp >= 1984 && cp <= 1993) return 16 /* Numeric */;
  if (cp >= 2406 && cp <= 2415) return 16 /* Numeric */;
  if (cp >= 2534 && cp <= 2543) return 16 /* Numeric */;
  if (cp >= 2662 && cp <= 2671) return 16 /* Numeric */;
  if (cp >= 2790 && cp <= 2799) return 16 /* Numeric */;
  if (cp >= 2918 && cp <= 2927) return 16 /* Numeric */;
  if (cp >= 3046 && cp <= 3055) return 16 /* Numeric */;
  if (cp >= 3174 && cp <= 3183) return 16 /* Numeric */;
  if (cp >= 3302 && cp <= 3311) return 16 /* Numeric */;
  if (cp >= 3430 && cp <= 3439) return 16 /* Numeric */;
  if (cp >= 3558 && cp <= 3567) return 16 /* Numeric */;
  if (cp >= 3664 && cp <= 3673) return 16 /* Numeric */;
  if (cp >= 3792 && cp <= 3801) return 16 /* Numeric */;
  if (cp >= 3872 && cp <= 3881) return 16 /* Numeric */;
  if (cp >= 4160 && cp <= 4169) return 16 /* Numeric */;
  if (cp >= 4240 && cp <= 4249) return 16 /* Numeric */;
  if (cp >= 6112 && cp <= 6121) return 16 /* Numeric */;
  if (cp >= 6160 && cp <= 6169) return 16 /* Numeric */;
  if (cp >= 6470 && cp <= 6479) return 16 /* Numeric */;
  if (cp >= 6608 && cp <= 6617) return 16 /* Numeric */;
  if (cp >= 6784 && cp <= 6793) return 16 /* Numeric */;
  if (cp >= 6800 && cp <= 6809) return 16 /* Numeric */;
  if (cp >= 6992 && cp <= 7001) return 16 /* Numeric */;
  if (cp >= 7088 && cp <= 7097) return 16 /* Numeric */;
  if (cp >= 7232 && cp <= 7241) return 16 /* Numeric */;
  if (cp >= 7248 && cp <= 7257) return 16 /* Numeric */;
  if (cp >= 42528 && cp <= 42537) return 16 /* Numeric */;
  if (cp >= 43216 && cp <= 43225) return 16 /* Numeric */;
  if (cp >= 43264 && cp <= 43273) return 16 /* Numeric */;
  if (cp >= 43472 && cp <= 43481) return 16 /* Numeric */;
  if (cp >= 43504 && cp <= 43513) return 16 /* Numeric */;
  if (cp >= 43600 && cp <= 43609) return 16 /* Numeric */;
  if (cp >= 44016 && cp <= 44025) return 16 /* Numeric */;
  if (cp >= 65296 && cp <= 65305) return 16 /* Numeric */;
  if (cp === 95) return 17 /* ExtendNumLet */;
  if (cp === 8239) return 17 /* ExtendNumLet */;
  if (cp === 8256) return 17 /* ExtendNumLet */;
  if (cp === 8276) return 17 /* ExtendNumLet */;
  if (cp === 65075 || cp === 65076) return 17 /* ExtendNumLet */;
  if (cp >= 65101 && cp <= 65103) return 17 /* ExtendNumLet */;
  if (cp === 65343) return 17 /* ExtendNumLet */;
  if (cp === 32) return 18 /* WSegSpace */;
  if (cp === 5760) return 18 /* WSegSpace */;
  if (cp >= 8192 && cp <= 8202 && cp !== 8199) return 18 /* WSegSpace */;
  if (cp === 8287) return 18 /* WSegSpace */;
  if (cp === 12288) return 18 /* WSegSpace */;
  const gbp = getGraphemeBreakProperty(cp);
  if (gbp === 4 /* Extend */) return 4 /* Extend */;
  if (cp >= 65 && cp <= 90) return 10 /* ALetter */;
  if (cp >= 97 && cp <= 122) return 10 /* ALetter */;
  if (cp >= 192 && cp <= 214) return 10 /* ALetter */;
  if (cp >= 216 && cp <= 246) return 10 /* ALetter */;
  if (cp >= 248 && cp <= 591) return 10 /* ALetter */;
  if (cp >= 592 && cp <= 687) return 10 /* ALetter */;
  if (cp >= 880 && cp <= 1023) return 10 /* ALetter */;
  if (cp >= 1024 && cp <= 1279) return 10 /* ALetter */;
  if (cp >= 1280 && cp <= 1327) return 10 /* ALetter */;
  if (cp >= 1329 && cp <= 1366) return 10 /* ALetter */;
  if (cp >= 1376 && cp <= 1416) return 10 /* ALetter */;
  if (cp >= 1536 && cp <= 1791) return 10 /* ALetter */;
  if (cp >= 2304 && cp <= 2431) return 10 /* ALetter */;
  if (cp >= 2432 && cp <= 2559) return 10 /* ALetter */;
  if (cp >= 2560 && cp <= 2687) return 10 /* ALetter */;
  if (cp >= 2688 && cp <= 2815) return 10 /* ALetter */;
  if (cp >= 2816 && cp <= 2943) return 10 /* ALetter */;
  if (cp >= 2944 && cp <= 3071) return 10 /* ALetter */;
  if (cp >= 3072 && cp <= 3199) return 10 /* ALetter */;
  if (cp >= 3200 && cp <= 3327) return 10 /* ALetter */;
  if (cp >= 3328 && cp <= 3455) return 10 /* ALetter */;
  if (cp >= 3584 && cp <= 3711) return 10 /* ALetter */;
  if (cp >= 3712 && cp <= 3839) return 10 /* ALetter */;
  if (cp >= 4096 && cp <= 4255) return 10 /* ALetter */;
  if (cp >= 4256 && cp <= 4351) return 10 /* ALetter */;
  if (cp >= 4352 && cp <= 4607) return 10 /* ALetter */;
  if (cp >= 6016 && cp <= 6143) return 10 /* ALetter */;
  if (cp >= 12352 && cp <= 12447) return 10 /* ALetter */;
  if (cp >= 7936 && cp <= 8191) return 10 /* ALetter */;
  if (cp >= 11264 && cp <= 11359) return 10 /* ALetter */;
  if (cp >= 40960 && cp <= 42127) return 10 /* ALetter */;
  if (cp >= 42192 && cp <= 42239) return 10 /* ALetter */;
  if (cp >= 42240 && cp <= 42559) return 10 /* ALetter */;
  if (cp >= 42560 && cp <= 42655) return 10 /* ALetter */;
  if (cp >= 42784 && cp <= 43007) return 10 /* ALetter */;
  if (cp >= 43776 && cp <= 43887) return 10 /* ALetter */;
  if (cp >= 44032 && cp <= 55215) return 10 /* ALetter */;
  if (cp >= 64256 && cp <= 64262) return 10 /* ALetter */;
  if (cp >= 65313 && cp <= 65338) return 10 /* ALetter */;
  if (cp >= 65345 && cp <= 65370) return 10 /* ALetter */;
  return 0 /* Other */;
}
function findGraphemeBoundaries(codepoints) {
  const len = codepoints.length;
  const properties = [];
  const boundaries = [];
  for (const cp of codepoints) {
    properties.push(getGraphemeBreakProperty(cp));
  }
  if (len === 0) return { boundaries, properties };
  let riCount = 0;
  let inExtendedPictographicSequence = false;
  for (let i = 1; i < len; i++) {
    const prev = properties[i - 1];
    const curr = properties[i];
    let shouldBreak = true;
    if (prev === 1 /* CR */ && curr === 2 /* LF */) {
      shouldBreak = false;
    } else if (prev === 3 /* Control */ || prev === 1 /* CR */ || prev === 2 /* LF */) {
      shouldBreak = true;
    } else if (curr === 3 /* Control */ || curr === 1 /* CR */ || curr === 2 /* LF */) {
      shouldBreak = true;
    } else if (prev === 9 /* L */ && (curr === 9 /* L */ || curr === 10 /* V */ || curr === 12 /* LV */ || curr === 13 /* LVT */)) {
      shouldBreak = false;
    } else if ((prev === 12 /* LV */ || prev === 10 /* V */) && (curr === 10 /* V */ || curr === 11 /* T */)) {
      shouldBreak = false;
    } else if ((prev === 13 /* LVT */ || prev === 11 /* T */) && curr === 11 /* T */) {
      shouldBreak = false;
    } else if (curr === 4 /* Extend */ || curr === 5 /* ZWJ */) {
      shouldBreak = false;
    } else if (curr === 8 /* SpacingMark */) {
      shouldBreak = false;
    } else if (prev === 7 /* Prepend */) {
      shouldBreak = false;
    } else if (inExtendedPictographicSequence && prev === 5 /* ZWJ */ && curr === 14 /* Extended_Pictographic */) {
      shouldBreak = false;
    } else if (prev === 6 /* Regional_Indicator */ && curr === 6 /* Regional_Indicator */) {
      if (riCount % 2 === 1) {
        shouldBreak = false;
      }
    }
    if (curr === 14 /* Extended_Pictographic */) {
      inExtendedPictographicSequence = true;
    } else if (curr !== 4 /* Extend */ && curr !== 5 /* ZWJ */) {
      inExtendedPictographicSequence = false;
    }
    if (curr === 6 /* Regional_Indicator */) {
      riCount++;
    } else {
      riCount = 0;
    }
    if (shouldBreak) {
      boundaries.push(i);
    }
  }
  boundaries.push(len);
  return { boundaries, properties };
}
function findWordBoundaries(codepoints) {
  const len = codepoints.length;
  const properties = [];
  const boundaries = [];
  for (const cp of codepoints) {
    properties.push(getWordBreakProperty(cp));
  }
  if (len === 0) return { boundaries, properties };
  boundaries.push(0);
  let riCount = 0;
  for (let i = 1; i < len; i++) {
    const prev = properties[i - 1];
    const curr = properties[i];
    let shouldBreak = true;
    if (prev === 1 /* CR */ && curr === 2 /* LF */) {
      shouldBreak = false;
    } else if (prev === 3 /* Newline */ || prev === 1 /* CR */ || prev === 2 /* LF */) {
      shouldBreak = true;
    } else if (curr === 3 /* Newline */ || curr === 1 /* CR */ || curr === 2 /* LF */) {
      shouldBreak = true;
    } else if (prev === 5 /* ZWJ */ && curr === 19 /* Extended_Pictographic */) {
      shouldBreak = false;
    } else if (prev === 18 /* WSegSpace */ && curr === 18 /* WSegSpace */) {
      shouldBreak = false;
    } else if (curr === 7 /* Format */ || curr === 4 /* Extend */ || curr === 5 /* ZWJ */) {
      shouldBreak = false;
    } else if ((prev === 10 /* ALetter */ || prev === 9 /* Hebrew_Letter */) && (curr === 10 /* ALetter */ || curr === 9 /* Hebrew_Letter */)) {
      shouldBreak = false;
    } else if ((prev === 10 /* ALetter */ || prev === 9 /* Hebrew_Letter */) && (curr === 14 /* MidLetter */ || curr === 13 /* MidNumLet */ || curr === 11 /* Single_Quote */)) {
      if (i + 1 < len) {
        const next = properties[i + 1];
        if (next === 10 /* ALetter */ || next === 9 /* Hebrew_Letter */) {
          shouldBreak = false;
        }
      }
    } else if (prev === 16 /* Numeric */ && curr === 16 /* Numeric */) {
      shouldBreak = false;
    } else if ((prev === 10 /* ALetter */ || prev === 9 /* Hebrew_Letter */) && curr === 16 /* Numeric */) {
      shouldBreak = false;
    } else if (prev === 16 /* Numeric */ && (curr === 10 /* ALetter */ || curr === 9 /* Hebrew_Letter */)) {
      shouldBreak = false;
    } else if (prev === 16 /* Numeric */ && (curr === 15 /* MidNum */ || curr === 13 /* MidNumLet */ || curr === 11 /* Single_Quote */)) {
      if (i + 1 < len && properties[i + 1] === 16 /* Numeric */) {
        shouldBreak = false;
      }
    } else if (prev === 8 /* Katakana */ && curr === 8 /* Katakana */) {
      shouldBreak = false;
    } else if ((prev === 10 /* ALetter */ || prev === 9 /* Hebrew_Letter */ || prev === 16 /* Numeric */ || prev === 8 /* Katakana */ || prev === 17 /* ExtendNumLet */) && curr === 17 /* ExtendNumLet */) {
      shouldBreak = false;
    } else if (prev === 17 /* ExtendNumLet */ && (curr === 10 /* ALetter */ || curr === 9 /* Hebrew_Letter */ || curr === 16 /* Numeric */ || curr === 8 /* Katakana */)) {
      shouldBreak = false;
    } else if (prev === 6 /* Regional_Indicator */ && curr === 6 /* Regional_Indicator */) {
      if (riCount % 2 === 1) {
        shouldBreak = false;
      }
    }
    if (curr === 6 /* Regional_Indicator */) {
      riCount++;
    } else {
      riCount = 0;
    }
    if (shouldBreak) {
      boundaries.push(i);
    }
  }
  boundaries.push(len);
  return { boundaries, properties };
}
function splitGraphemes(text) {
  const codepoints = [];
  const chars = [];
  for (const char of text) {
    codepoints.push(char.codePointAt(0) ?? 0);
    chars.push(char);
  }
  const { boundaries } = findGraphemeBoundaries(codepoints);
  const graphemes = [];
  let start = 0;
  for (const end of boundaries) {
    if (end > start) {
      graphemes.push(chars.slice(start, end).join(""));
    }
    start = end;
  }
  return graphemes;
}
function splitWords(text) {
  const codepoints = [];
  const chars = [];
  for (const char of text) {
    codepoints.push(char.codePointAt(0) ?? 0);
    chars.push(char);
  }
  const { boundaries, properties } = findWordBoundaries(codepoints);
  const words = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    let hasContent = false;
    for (let j = start; j < end; j++) {
      const prop = properties[j];
      if (prop !== 18 /* WSegSpace */ && prop !== 1 /* CR */ && prop !== 2 /* LF */ && prop !== 3 /* Newline */) {
        hasContent = true;
        break;
      }
    }
    if (hasContent) {
      words.push(chars.slice(start, end).join(""));
    }
  }
  return words;
}
function countGraphemes(text) {
  const codepoints = [];
  for (const char of text) {
    codepoints.push(char.codePointAt(0) ?? 0);
  }
  const { boundaries } = findGraphemeBoundaries(codepoints);
  return boundaries.length;
}

// src/unicode/script.ts
var Script = /* @__PURE__ */ ((Script2) => {
  Script2["Common"] = "Zyyy";
  Script2["Inherited"] = "Zinh";
  Script2["Unknown"] = "Zzzz";
  Script2["Latin"] = "Latn";
  Script2["Greek"] = "Grek";
  Script2["Cyrillic"] = "Cyrl";
  Script2["Armenian"] = "Armn";
  Script2["Hebrew"] = "Hebr";
  Script2["Arabic"] = "Arab";
  Script2["Syriac"] = "Syrc";
  Script2["Thaana"] = "Thaa";
  Script2["Devanagari"] = "Deva";
  Script2["Bengali"] = "Beng";
  Script2["Gurmukhi"] = "Guru";
  Script2["Gujarati"] = "Gujr";
  Script2["Oriya"] = "Orya";
  Script2["Tamil"] = "Taml";
  Script2["Telugu"] = "Telu";
  Script2["Kannada"] = "Knda";
  Script2["Malayalam"] = "Mlym";
  Script2["Sinhala"] = "Sinh";
  Script2["Thai"] = "Thai";
  Script2["Lao"] = "Laoo";
  Script2["Tibetan"] = "Tibt";
  Script2["Myanmar"] = "Mymr";
  Script2["Georgian"] = "Geor";
  Script2["Hangul"] = "Hang";
  Script2["Ethiopic"] = "Ethi";
  Script2["Cherokee"] = "Cher";
  Script2["CanadianAboriginal"] = "Cans";
  Script2["Ogham"] = "Ogam";
  Script2["Runic"] = "Runr";
  Script2["Khmer"] = "Khmr";
  Script2["Mongolian"] = "Mong";
  Script2["Hiragana"] = "Hira";
  Script2["Katakana"] = "Kana";
  Script2["Bopomofo"] = "Bopo";
  Script2["Han"] = "Hani";
  Script2["Yi"] = "Yiii";
  Script2["OldItalic"] = "Ital";
  Script2["Gothic"] = "Goth";
  Script2["Deseret"] = "Dsrt";
  Script2["Tagalog"] = "Tglg";
  Script2["Hanunoo"] = "Hano";
  Script2["Buhid"] = "Buhd";
  Script2["Tagbanwa"] = "Tagb";
  Script2["Limbu"] = "Limb";
  Script2["TaiLe"] = "Tale";
  Script2["LinearB"] = "Linb";
  Script2["Ugaritic"] = "Ugar";
  Script2["Shavian"] = "Shaw";
  Script2["Osmanya"] = "Osma";
  Script2["Cypriot"] = "Cprt";
  Script2["Braille"] = "Brai";
  Script2["Buginese"] = "Bugi";
  Script2["Coptic"] = "Copt";
  Script2["NewTaiLue"] = "Talu";
  Script2["Glagolitic"] = "Glag";
  Script2["Tifinagh"] = "Tfng";
  Script2["SylotiNagri"] = "Sylo";
  Script2["OldPersian"] = "Xpeo";
  Script2["Kharoshthi"] = "Khar";
  Script2["Balinese"] = "Bali";
  Script2["Cuneiform"] = "Xsux";
  Script2["Phoenician"] = "Phnx";
  Script2["PhagsPa"] = "Phag";
  Script2["Nko"] = "Nkoo";
  Script2["Sundanese"] = "Sund";
  Script2["Lepcha"] = "Lepc";
  Script2["OlChiki"] = "Olck";
  Script2["Vai"] = "Vaii";
  Script2["Saurashtra"] = "Saur";
  Script2["KayahLi"] = "Kali";
  Script2["Rejang"] = "Rjng";
  Script2["Lycian"] = "Lyci";
  Script2["Carian"] = "Cari";
  Script2["Lydian"] = "Lydi";
  Script2["Cham"] = "Cham";
  Script2["TaiTham"] = "Lana";
  Script2["TaiViet"] = "Tavt";
  Script2["Avestan"] = "Avst";
  Script2["EgyptianHieroglyphs"] = "Egyp";
  Script2["Samaritan"] = "Samr";
  Script2["Lisu"] = "Lisu";
  Script2["Bamum"] = "Bamu";
  Script2["Javanese"] = "Java";
  Script2["MeeteiMayek"] = "Mtei";
  Script2["ImperialAramaic"] = "Armi";
  Script2["OldSouthArabian"] = "Sarb";
  Script2["InscriptionalParthian"] = "Prti";
  Script2["InscriptionalPahlavi"] = "Phli";
  Script2["OldTurkic"] = "Orkh";
  Script2["Kaithi"] = "Kthi";
  Script2["Batak"] = "Batk";
  Script2["Brahmi"] = "Brah";
  Script2["Mandaic"] = "Mand";
  Script2["Chakma"] = "Cakm";
  Script2["MeroiticCursive"] = "Merc";
  Script2["MeroiticHieroglyphs"] = "Mero";
  Script2["Miao"] = "Plrd";
  Script2["Sharada"] = "Shrd";
  Script2["SoraSompeng"] = "Sora";
  Script2["Takri"] = "Takr";
  Script2["CaucasianAlbanian"] = "Aghb";
  Script2["BassaVah"] = "Bass";
  Script2["Duployan"] = "Dupl";
  Script2["Elbasan"] = "Elba";
  Script2["Grantha"] = "Gran";
  Script2["PahawhHmong"] = "Hmng";
  Script2["Khojki"] = "Khoj";
  Script2["LinearA"] = "Lina";
  Script2["Mahajani"] = "Mahj";
  Script2["Manichaean"] = "Mani";
  Script2["MendeKikakui"] = "Mend";
  Script2["Modi"] = "Modi";
  Script2["Mro"] = "Mroo";
  Script2["OldNorthArabian"] = "Narb";
  Script2["Nabataean"] = "Nbat";
  Script2["Palmyrene"] = "Palm";
  Script2["PauCinHau"] = "Pauc";
  Script2["OldPermic"] = "Perm";
  Script2["PsalterPahlavi"] = "Phlp";
  Script2["Siddham"] = "Sidd";
  Script2["Khudawadi"] = "Sind";
  Script2["Tirhuta"] = "Tirh";
  Script2["WarangCiti"] = "Wara";
  Script2["Ahom"] = "Ahom";
  Script2["AnatolianHieroglyphs"] = "Hluw";
  Script2["Hatran"] = "Hatr";
  Script2["Multani"] = "Mult";
  Script2["OldHungarian"] = "Hung";
  Script2["SignWriting"] = "Sgnw";
  Script2["Adlam"] = "Adlm";
  Script2["Bhaiksuki"] = "Bhks";
  Script2["Marchen"] = "Marc";
  Script2["Newa"] = "Newa";
  Script2["Osage"] = "Osge";
  Script2["Tangut"] = "Tang";
  Script2["MasaramGondi"] = "Gonm";
  Script2["Nushu"] = "Nshu";
  Script2["Soyombo"] = "Soyo";
  Script2["ZanabazarSquare"] = "Zanb";
  Script2["Dogra"] = "Dogr";
  Script2["GunjalaGondi"] = "Gong";
  Script2["Makasar"] = "Maka";
  Script2["Medefaidrin"] = "Medf";
  Script2["HanifiRohingya"] = "Rohg";
  Script2["Sogdian"] = "Sogd";
  Script2["OldSogdian"] = "Sogo";
  Script2["Elymaic"] = "Elym";
  Script2["Nandinagari"] = "Nand";
  Script2["NyiakengPuachueHmong"] = "Hmnp";
  Script2["Wancho"] = "Wcho";
  Script2["Yezidi"] = "Yezi";
  Script2["Chorasmian"] = "Chrs";
  Script2["DivesAkuru"] = "Diak";
  Script2["KhitanSmallScript"] = "Kits";
  Script2["Vithkuqi"] = "Vith";
  Script2["OldUyghur"] = "Ougr";
  Script2["Cypro_Minoan"] = "Cpmn";
  Script2["Tangsa"] = "Tnsa";
  Script2["Toto"] = "Toto";
  Script2["Kawi"] = "Kawi";
  Script2["NagMundari"] = "Nagm";
  return Script2;
})(Script || {});
var SCRIPT_RANGES = [
  // Basic Latin
  { start: 0, end: 127, script: "Zyyy" /* Common */ },
  // Latin-1 Supplement
  { start: 128, end: 255, script: "Latn" /* Latin */ },
  // Latin Extended-A
  { start: 256, end: 383, script: "Latn" /* Latin */ },
  // Latin Extended-B
  { start: 384, end: 591, script: "Latn" /* Latin */ },
  // IPA Extensions
  { start: 592, end: 687, script: "Latn" /* Latin */ },
  // Spacing Modifier Letters
  { start: 688, end: 767, script: "Zyyy" /* Common */ },
  // Combining Diacritical Marks
  { start: 768, end: 879, script: "Zinh" /* Inherited */ },
  // Greek and Coptic
  { start: 880, end: 1023, script: "Grek" /* Greek */ },
  // Cyrillic
  { start: 1024, end: 1279, script: "Cyrl" /* Cyrillic */ },
  // Cyrillic Supplement
  { start: 1280, end: 1327, script: "Cyrl" /* Cyrillic */ },
  // Armenian
  { start: 1328, end: 1423, script: "Armn" /* Armenian */ },
  // Hebrew
  { start: 1424, end: 1535, script: "Hebr" /* Hebrew */ },
  // Arabic
  { start: 1536, end: 1791, script: "Arab" /* Arabic */ },
  // Syriac
  { start: 1792, end: 1871, script: "Syrc" /* Syriac */ },
  // Arabic Supplement
  { start: 1872, end: 1919, script: "Arab" /* Arabic */ },
  // Thaana
  { start: 1920, end: 1983, script: "Thaa" /* Thaana */ },
  // NKo
  { start: 1984, end: 2047, script: "Nkoo" /* Nko */ },
  // Samaritan
  { start: 2048, end: 2111, script: "Samr" /* Samaritan */ },
  // Mandaic
  { start: 2112, end: 2143, script: "Mand" /* Mandaic */ },
  // Syriac Supplement
  { start: 2144, end: 2159, script: "Syrc" /* Syriac */ },
  // Arabic Extended-B
  { start: 2160, end: 2207, script: "Arab" /* Arabic */ },
  // Arabic Extended-A
  { start: 2208, end: 2303, script: "Arab" /* Arabic */ },
  // Devanagari
  { start: 2304, end: 2431, script: "Deva" /* Devanagari */ },
  // Bengali
  { start: 2432, end: 2559, script: "Beng" /* Bengali */ },
  // Gurmukhi
  { start: 2560, end: 2687, script: "Guru" /* Gurmukhi */ },
  // Gujarati
  { start: 2688, end: 2815, script: "Gujr" /* Gujarati */ },
  // Oriya
  { start: 2816, end: 2943, script: "Orya" /* Oriya */ },
  // Tamil
  { start: 2944, end: 3071, script: "Taml" /* Tamil */ },
  // Telugu
  { start: 3072, end: 3199, script: "Telu" /* Telugu */ },
  // Kannada
  { start: 3200, end: 3327, script: "Knda" /* Kannada */ },
  // Malayalam
  { start: 3328, end: 3455, script: "Mlym" /* Malayalam */ },
  // Sinhala
  { start: 3456, end: 3583, script: "Sinh" /* Sinhala */ },
  // Thai
  { start: 3584, end: 3711, script: "Thai" /* Thai */ },
  // Lao
  { start: 3712, end: 3839, script: "Laoo" /* Lao */ },
  // Tibetan
  { start: 3840, end: 4095, script: "Tibt" /* Tibetan */ },
  // Myanmar
  { start: 4096, end: 4255, script: "Mymr" /* Myanmar */ },
  // Georgian
  { start: 4256, end: 4351, script: "Geor" /* Georgian */ },
  // Hangul Jamo
  { start: 4352, end: 4607, script: "Hang" /* Hangul */ },
  // Ethiopic
  { start: 4608, end: 4991, script: "Ethi" /* Ethiopic */ },
  // Ethiopic Supplement
  { start: 4992, end: 5023, script: "Ethi" /* Ethiopic */ },
  // Cherokee
  { start: 5024, end: 5119, script: "Cher" /* Cherokee */ },
  // Unified Canadian Aboriginal Syllabics
  { start: 5120, end: 5759, script: "Cans" /* CanadianAboriginal */ },
  // Ogham
  { start: 5760, end: 5791, script: "Ogam" /* Ogham */ },
  // Runic
  { start: 5792, end: 5887, script: "Runr" /* Runic */ },
  // Tagalog
  { start: 5888, end: 5919, script: "Tglg" /* Tagalog */ },
  // Hanunoo
  { start: 5920, end: 5951, script: "Hano" /* Hanunoo */ },
  // Buhid
  { start: 5952, end: 5983, script: "Buhd" /* Buhid */ },
  // Tagbanwa
  { start: 5984, end: 6015, script: "Tagb" /* Tagbanwa */ },
  // Khmer
  { start: 6016, end: 6143, script: "Khmr" /* Khmer */ },
  // Mongolian
  { start: 6144, end: 6319, script: "Mong" /* Mongolian */ },
  // Unified Canadian Aboriginal Syllabics Extended
  { start: 6320, end: 6399, script: "Cans" /* CanadianAboriginal */ },
  // Limbu
  { start: 6400, end: 6479, script: "Limb" /* Limbu */ },
  // Tai Le
  { start: 6480, end: 6527, script: "Tale" /* TaiLe */ },
  // New Tai Lue
  { start: 6528, end: 6623, script: "Talu" /* NewTaiLue */ },
  // Khmer Symbols
  { start: 6624, end: 6655, script: "Khmr" /* Khmer */ },
  // Buginese
  { start: 6656, end: 6687, script: "Bugi" /* Buginese */ },
  // Tai Tham
  { start: 6688, end: 6831, script: "Lana" /* TaiTham */ },
  // Combining Diacritical Marks Extended
  { start: 6832, end: 6911, script: "Zinh" /* Inherited */ },
  // Balinese
  { start: 6912, end: 7039, script: "Bali" /* Balinese */ },
  // Sundanese
  { start: 7040, end: 7103, script: "Sund" /* Sundanese */ },
  // Batak
  { start: 7104, end: 7167, script: "Batk" /* Batak */ },
  // Lepcha
  { start: 7168, end: 7247, script: "Lepc" /* Lepcha */ },
  // Ol Chiki
  { start: 7248, end: 7295, script: "Olck" /* OlChiki */ },
  // Cyrillic Extended-C
  { start: 7296, end: 7311, script: "Cyrl" /* Cyrillic */ },
  // Georgian Extended
  { start: 7312, end: 7359, script: "Geor" /* Georgian */ },
  // Sundanese Supplement
  { start: 7360, end: 7375, script: "Sund" /* Sundanese */ },
  // Vedic Extensions
  { start: 7376, end: 7423, script: "Zinh" /* Inherited */ },
  // Phonetic Extensions
  { start: 7424, end: 7551, script: "Latn" /* Latin */ },
  // Phonetic Extensions Supplement
  { start: 7552, end: 7615, script: "Latn" /* Latin */ },
  // Combining Diacritical Marks Supplement
  { start: 7616, end: 7679, script: "Zinh" /* Inherited */ },
  // Latin Extended Additional
  { start: 7680, end: 7935, script: "Latn" /* Latin */ },
  // Greek Extended
  { start: 7936, end: 8191, script: "Grek" /* Greek */ },
  // General Punctuation
  { start: 8192, end: 8303, script: "Zyyy" /* Common */ },
  // Superscripts and Subscripts
  { start: 8304, end: 8351, script: "Zyyy" /* Common */ },
  // Currency Symbols
  { start: 8352, end: 8399, script: "Zyyy" /* Common */ },
  // Combining Diacritical Marks for Symbols
  { start: 8400, end: 8447, script: "Zinh" /* Inherited */ },
  // Letterlike Symbols
  { start: 8448, end: 8527, script: "Zyyy" /* Common */ },
  // Number Forms
  { start: 8528, end: 8591, script: "Zyyy" /* Common */ },
  // Arrows
  { start: 8592, end: 8703, script: "Zyyy" /* Common */ },
  // Mathematical Operators
  { start: 8704, end: 8959, script: "Zyyy" /* Common */ },
  // Miscellaneous Technical
  { start: 8960, end: 9215, script: "Zyyy" /* Common */ },
  // Control Pictures
  { start: 9216, end: 9279, script: "Zyyy" /* Common */ },
  // OCR
  { start: 9280, end: 9311, script: "Zyyy" /* Common */ },
  // Enclosed Alphanumerics
  { start: 9312, end: 9471, script: "Zyyy" /* Common */ },
  // Box Drawing
  { start: 9472, end: 9599, script: "Zyyy" /* Common */ },
  // Block Elements
  { start: 9600, end: 9631, script: "Zyyy" /* Common */ },
  // Geometric Shapes
  { start: 9632, end: 9727, script: "Zyyy" /* Common */ },
  // Miscellaneous Symbols
  { start: 9728, end: 9983, script: "Zyyy" /* Common */ },
  // Dingbats
  { start: 9984, end: 10175, script: "Zyyy" /* Common */ },
  // Miscellaneous Mathematical Symbols-A
  { start: 10176, end: 10223, script: "Zyyy" /* Common */ },
  // Supplemental Arrows-A
  { start: 10224, end: 10239, script: "Zyyy" /* Common */ },
  // Braille Patterns
  { start: 10240, end: 10495, script: "Brai" /* Braille */ },
  // Supplemental Arrows-B
  { start: 10496, end: 10623, script: "Zyyy" /* Common */ },
  // Miscellaneous Mathematical Symbols-B
  { start: 10624, end: 10751, script: "Zyyy" /* Common */ },
  // Supplemental Mathematical Operators
  { start: 10752, end: 11007, script: "Zyyy" /* Common */ },
  // Miscellaneous Symbols and Arrows
  { start: 11008, end: 11263, script: "Zyyy" /* Common */ },
  // Glagolitic
  { start: 11264, end: 11359, script: "Glag" /* Glagolitic */ },
  // Latin Extended-C
  { start: 11360, end: 11391, script: "Latn" /* Latin */ },
  // Coptic
  { start: 11392, end: 11519, script: "Copt" /* Coptic */ },
  // Georgian Supplement
  { start: 11520, end: 11567, script: "Geor" /* Georgian */ },
  // Tifinagh
  { start: 11568, end: 11647, script: "Tfng" /* Tifinagh */ },
  // Ethiopic Extended
  { start: 11648, end: 11743, script: "Ethi" /* Ethiopic */ },
  // Cyrillic Extended-A
  { start: 11744, end: 11775, script: "Cyrl" /* Cyrillic */ },
  // Supplemental Punctuation
  { start: 11776, end: 11903, script: "Zyyy" /* Common */ },
  // CJK Radicals Supplement
  { start: 11904, end: 12031, script: "Hani" /* Han */ },
  // Kangxi Radicals
  { start: 12032, end: 12255, script: "Hani" /* Han */ },
  // Ideographic Description Characters
  { start: 12272, end: 12287, script: "Zyyy" /* Common */ },
  // CJK Symbols and Punctuation
  { start: 12288, end: 12351, script: "Zyyy" /* Common */ },
  // Hiragana
  { start: 12352, end: 12447, script: "Hira" /* Hiragana */ },
  // Katakana
  { start: 12448, end: 12543, script: "Kana" /* Katakana */ },
  // Bopomofo
  { start: 12544, end: 12591, script: "Bopo" /* Bopomofo */ },
  // Hangul Compatibility Jamo
  { start: 12592, end: 12687, script: "Hang" /* Hangul */ },
  // Kanbun
  { start: 12688, end: 12703, script: "Zyyy" /* Common */ },
  // Bopomofo Extended
  { start: 12704, end: 12735, script: "Bopo" /* Bopomofo */ },
  // CJK Strokes
  { start: 12736, end: 12783, script: "Zyyy" /* Common */ },
  // Katakana Phonetic Extensions
  { start: 12784, end: 12799, script: "Kana" /* Katakana */ },
  // Enclosed CJK Letters and Months
  { start: 12800, end: 13055, script: "Zyyy" /* Common */ },
  // CJK Compatibility
  { start: 13056, end: 13311, script: "Zyyy" /* Common */ },
  // CJK Unified Ideographs Extension A
  { start: 13312, end: 19903, script: "Hani" /* Han */ },
  // Yijing Hexagram Symbols
  { start: 19904, end: 19967, script: "Zyyy" /* Common */ },
  // CJK Unified Ideographs
  { start: 19968, end: 40959, script: "Hani" /* Han */ },
  // Yi Syllables
  { start: 40960, end: 42127, script: "Yiii" /* Yi */ },
  // Yi Radicals
  { start: 42128, end: 42191, script: "Yiii" /* Yi */ },
  // Lisu
  { start: 42192, end: 42239, script: "Lisu" /* Lisu */ },
  // Vai
  { start: 42240, end: 42559, script: "Vaii" /* Vai */ },
  // Cyrillic Extended-B
  { start: 42560, end: 42655, script: "Cyrl" /* Cyrillic */ },
  // Bamum
  { start: 42656, end: 42751, script: "Bamu" /* Bamum */ },
  // Modifier Tone Letters
  { start: 42752, end: 42783, script: "Zyyy" /* Common */ },
  // Latin Extended-D
  { start: 42784, end: 43007, script: "Latn" /* Latin */ },
  // Syloti Nagri
  { start: 43008, end: 43055, script: "Sylo" /* SylotiNagri */ },
  // Common Indic Number Forms
  { start: 43056, end: 43071, script: "Zyyy" /* Common */ },
  // Phags-pa
  { start: 43072, end: 43135, script: "Phag" /* PhagsPa */ },
  // Saurashtra
  { start: 43136, end: 43231, script: "Saur" /* Saurashtra */ },
  // Devanagari Extended
  { start: 43232, end: 43263, script: "Deva" /* Devanagari */ },
  // Kayah Li
  { start: 43264, end: 43311, script: "Kali" /* KayahLi */ },
  // Rejang
  { start: 43312, end: 43359, script: "Rjng" /* Rejang */ },
  // Hangul Jamo Extended-A
  { start: 43360, end: 43391, script: "Hang" /* Hangul */ },
  // Javanese
  { start: 43392, end: 43487, script: "Java" /* Javanese */ },
  // Myanmar Extended-B
  { start: 43488, end: 43519, script: "Mymr" /* Myanmar */ },
  // Cham
  { start: 43520, end: 43615, script: "Cham" /* Cham */ },
  // Myanmar Extended-A
  { start: 43616, end: 43647, script: "Mymr" /* Myanmar */ },
  // Tai Viet
  { start: 43648, end: 43743, script: "Tavt" /* TaiViet */ },
  // Meetei Mayek Extensions
  { start: 43744, end: 43775, script: "Mtei" /* MeeteiMayek */ },
  // Ethiopic Extended-A
  { start: 43776, end: 43823, script: "Ethi" /* Ethiopic */ },
  // Latin Extended-E
  { start: 43824, end: 43887, script: "Latn" /* Latin */ },
  // Cherokee Supplement
  { start: 43888, end: 43967, script: "Cher" /* Cherokee */ },
  // Meetei Mayek
  { start: 43968, end: 44031, script: "Mtei" /* MeeteiMayek */ },
  // Hangul Syllables
  { start: 44032, end: 55215, script: "Hang" /* Hangul */ },
  // Hangul Jamo Extended-B
  { start: 55216, end: 55295, script: "Hang" /* Hangul */ },
  // High Surrogates, Low Surrogates
  { start: 55296, end: 57343, script: "Zzzz" /* Unknown */ },
  // Private Use Area
  { start: 57344, end: 63743, script: "Zzzz" /* Unknown */ },
  // CJK Compatibility Ideographs
  { start: 63744, end: 64255, script: "Hani" /* Han */ },
  // Alphabetic Presentation Forms
  { start: 64256, end: 64335, script: "Latn" /* Latin */ },
  // Arabic Presentation Forms-A
  { start: 64336, end: 65023, script: "Arab" /* Arabic */ },
  // Variation Selectors
  { start: 65024, end: 65039, script: "Zinh" /* Inherited */ },
  // Vertical Forms
  { start: 65040, end: 65055, script: "Zyyy" /* Common */ },
  // Combining Half Marks
  { start: 65056, end: 65071, script: "Zinh" /* Inherited */ },
  // CJK Compatibility Forms
  { start: 65072, end: 65103, script: "Zyyy" /* Common */ },
  // Small Form Variants
  { start: 65104, end: 65135, script: "Zyyy" /* Common */ },
  // Arabic Presentation Forms-B
  { start: 65136, end: 65279, script: "Arab" /* Arabic */ },
  // Halfwidth and Fullwidth Forms
  { start: 65280, end: 65519, script: "Zyyy" /* Common */ },
  // Specials
  { start: 65520, end: 65535, script: "Zyyy" /* Common */ },
  // Linear B Syllabary
  { start: 65536, end: 65663, script: "Linb" /* LinearB */ },
  // Linear B Ideograms
  { start: 65664, end: 65791, script: "Linb" /* LinearB */ },
  // Aegean Numbers
  { start: 65792, end: 65855, script: "Zyyy" /* Common */ },
  // Ancient Greek Numbers
  { start: 65856, end: 65935, script: "Grek" /* Greek */ },
  // Ancient Symbols
  { start: 65936, end: 65999, script: "Zyyy" /* Common */ },
  // Phaistos Disc
  { start: 66e3, end: 66047, script: "Zyyy" /* Common */ },
  // Lycian
  { start: 66176, end: 66207, script: "Lyci" /* Lycian */ },
  // Carian
  { start: 66208, end: 66271, script: "Cari" /* Carian */ },
  // Coptic Epact Numbers
  { start: 66272, end: 66303, script: "Zinh" /* Inherited */ },
  // Old Italic
  { start: 66304, end: 66351, script: "Ital" /* OldItalic */ },
  // Gothic
  { start: 66352, end: 66383, script: "Goth" /* Gothic */ },
  // Old Permic
  { start: 66384, end: 66431, script: "Perm" /* OldPermic */ },
  // Ugaritic
  { start: 66432, end: 66463, script: "Ugar" /* Ugaritic */ },
  // Old Persian
  { start: 66464, end: 66527, script: "Xpeo" /* OldPersian */ },
  // Deseret
  { start: 66560, end: 66639, script: "Dsrt" /* Deseret */ },
  // Shavian
  { start: 66640, end: 66687, script: "Shaw" /* Shavian */ },
  // Osmanya
  { start: 66688, end: 66735, script: "Osma" /* Osmanya */ },
  // Osage
  { start: 66736, end: 66815, script: "Osge" /* Osage */ },
  // Elbasan
  { start: 66816, end: 66863, script: "Elba" /* Elbasan */ },
  // Caucasian Albanian
  { start: 66864, end: 66927, script: "Aghb" /* CaucasianAlbanian */ },
  // Vithkuqi
  { start: 66928, end: 67007, script: "Vith" /* Vithkuqi */ },
  // Linear A
  { start: 67072, end: 67455, script: "Lina" /* LinearA */ },
  // Latin Extended-F
  { start: 67456, end: 67519, script: "Latn" /* Latin */ },
  // Cypriot Syllabary
  { start: 67584, end: 67647, script: "Cprt" /* Cypriot */ },
  // Imperial Aramaic
  { start: 67648, end: 67679, script: "Armi" /* ImperialAramaic */ },
  // Palmyrene
  { start: 67680, end: 67711, script: "Palm" /* Palmyrene */ },
  // Nabataean
  { start: 67712, end: 67759, script: "Nbat" /* Nabataean */ },
  // Hatran
  { start: 67808, end: 67839, script: "Hatr" /* Hatran */ },
  // Phoenician
  { start: 67840, end: 67871, script: "Phnx" /* Phoenician */ },
  // Lydian
  { start: 67872, end: 67903, script: "Lydi" /* Lydian */ },
  // Meroitic Hieroglyphs
  { start: 67968, end: 67999, script: "Mero" /* MeroiticHieroglyphs */ },
  // Meroitic Cursive
  { start: 68e3, end: 68095, script: "Merc" /* MeroiticCursive */ },
  // Kharoshthi
  { start: 68096, end: 68191, script: "Khar" /* Kharoshthi */ },
  // Old South Arabian
  { start: 68192, end: 68223, script: "Sarb" /* OldSouthArabian */ },
  // Old North Arabian
  { start: 68224, end: 68255, script: "Narb" /* OldNorthArabian */ },
  // Manichaean
  { start: 68288, end: 68351, script: "Mani" /* Manichaean */ },
  // Avestan
  { start: 68352, end: 68415, script: "Avst" /* Avestan */ },
  // Inscriptional Parthian
  { start: 68416, end: 68447, script: "Prti" /* InscriptionalParthian */ },
  // Inscriptional Pahlavi
  { start: 68448, end: 68479, script: "Phli" /* InscriptionalPahlavi */ },
  // Psalter Pahlavi
  { start: 68480, end: 68527, script: "Phlp" /* PsalterPahlavi */ },
  // Old Turkic
  { start: 68608, end: 68687, script: "Orkh" /* OldTurkic */ },
  // Old Hungarian
  { start: 68736, end: 68863, script: "Hung" /* OldHungarian */ },
  // Hanifi Rohingya
  { start: 68864, end: 68927, script: "Rohg" /* HanifiRohingya */ },
  // Yezidi
  { start: 69248, end: 69311, script: "Yezi" /* Yezidi */ },
  // Old Sogdian
  { start: 69376, end: 69423, script: "Sogo" /* OldSogdian */ },
  // Sogdian
  { start: 69424, end: 69487, script: "Sogd" /* Sogdian */ },
  // Old Uyghur
  { start: 69488, end: 69551, script: "Ougr" /* OldUyghur */ },
  // Chorasmian
  { start: 69552, end: 69599, script: "Chrs" /* Chorasmian */ },
  // Elymaic
  { start: 69600, end: 69631, script: "Elym" /* Elymaic */ },
  // Brahmi
  { start: 69632, end: 69759, script: "Brah" /* Brahmi */ },
  // Kaithi
  { start: 69760, end: 69839, script: "Kthi" /* Kaithi */ },
  // Sora Sompeng
  { start: 69840, end: 69887, script: "Sora" /* SoraSompeng */ },
  // Chakma
  { start: 69888, end: 69967, script: "Cakm" /* Chakma */ },
  // Mahajani
  { start: 69968, end: 70015, script: "Mahj" /* Mahajani */ },
  // Sharada
  { start: 70016, end: 70111, script: "Shrd" /* Sharada */ },
  // Sinhala Archaic Numbers
  { start: 70112, end: 70143, script: "Sinh" /* Sinhala */ },
  // Khojki
  { start: 70144, end: 70223, script: "Khoj" /* Khojki */ },
  // Multani
  { start: 70272, end: 70319, script: "Mult" /* Multani */ },
  // Khudawadi
  { start: 70320, end: 70399, script: "Sind" /* Khudawadi */ },
  // Grantha
  { start: 70400, end: 70527, script: "Gran" /* Grantha */ },
  // Newa
  { start: 70656, end: 70783, script: "Newa" /* Newa */ },
  // Tirhuta
  { start: 70784, end: 70879, script: "Tirh" /* Tirhuta */ },
  // Siddham
  { start: 71040, end: 71167, script: "Sidd" /* Siddham */ },
  // Modi
  { start: 71168, end: 71263, script: "Modi" /* Modi */ },
  // Mongolian Supplement
  { start: 71264, end: 71295, script: "Mong" /* Mongolian */ },
  // Takri
  { start: 71296, end: 71375, script: "Takr" /* Takri */ },
  // Ahom
  { start: 71424, end: 71503, script: "Ahom" /* Ahom */ },
  // Dogra
  { start: 71680, end: 71759, script: "Dogr" /* Dogra */ },
  // Warang Citi
  { start: 71840, end: 71935, script: "Wara" /* WarangCiti */ },
  // Dives Akuru
  { start: 71936, end: 72031, script: "Diak" /* DivesAkuru */ },
  // Nandinagari
  { start: 72096, end: 72191, script: "Nand" /* Nandinagari */ },
  // Zanabazar Square
  { start: 72192, end: 72271, script: "Zanb" /* ZanabazarSquare */ },
  // Soyombo
  { start: 72272, end: 72367, script: "Soyo" /* Soyombo */ },
  // UCAS Extended-A
  { start: 72368, end: 72383, script: "Cans" /* CanadianAboriginal */ },
  // Pau Cin Hau
  { start: 72384, end: 72447, script: "Pauc" /* PauCinHau */ },
  // Bhaiksuki
  { start: 72704, end: 72815, script: "Bhks" /* Bhaiksuki */ },
  // Marchen
  { start: 72816, end: 72895, script: "Marc" /* Marchen */ },
  // Masaram Gondi
  { start: 72960, end: 73055, script: "Gonm" /* MasaramGondi */ },
  // Gunjala Gondi
  { start: 73056, end: 73135, script: "Gong" /* GunjalaGondi */ },
  // Makasar
  { start: 73440, end: 73471, script: "Maka" /* Makasar */ },
  // Kawi
  { start: 73472, end: 73567, script: "Kawi" /* Kawi */ },
  // Cuneiform
  { start: 73728, end: 74751, script: "Xsux" /* Cuneiform */ },
  // Cuneiform Numbers and Punctuation
  { start: 74752, end: 74879, script: "Xsux" /* Cuneiform */ },
  // Early Dynastic Cuneiform
  { start: 74880, end: 75087, script: "Xsux" /* Cuneiform */ },
  // Cypro-Minoan
  { start: 77712, end: 77823, script: "Cpmn" /* Cypro_Minoan */ },
  // Egyptian Hieroglyphs
  { start: 77824, end: 78895, script: "Egyp" /* EgyptianHieroglyphs */ },
  // Egyptian Hieroglyph Format Controls
  { start: 78896, end: 78943, script: "Egyp" /* EgyptianHieroglyphs */ },
  // Anatolian Hieroglyphs
  { start: 82944, end: 83583, script: "Hluw" /* AnatolianHieroglyphs */ },
  // Bamum Supplement
  { start: 92160, end: 92735, script: "Bamu" /* Bamum */ },
  // Mro
  { start: 92736, end: 92783, script: "Mroo" /* Mro */ },
  // Tangsa
  { start: 92784, end: 92879, script: "Tnsa" /* Tangsa */ },
  // Bassa Vah
  { start: 92880, end: 92927, script: "Bass" /* BassaVah */ },
  // Pahawh Hmong
  { start: 92928, end: 93071, script: "Hmng" /* PahawhHmong */ },
  // Medefaidrin
  { start: 93760, end: 93855, script: "Medf" /* Medefaidrin */ },
  // Miao
  { start: 93952, end: 94111, script: "Plrd" /* Miao */ },
  // Ideographic Symbols and Punctuation
  { start: 94176, end: 94207, script: "Zyyy" /* Common */ },
  // Tangut
  { start: 94208, end: 100351, script: "Tang" /* Tangut */ },
  // Tangut Components
  { start: 100352, end: 101119, script: "Tang" /* Tangut */ },
  // Khitan Small Script
  { start: 101120, end: 101631, script: "Kits" /* KhitanSmallScript */ },
  // Tangut Supplement
  { start: 101632, end: 101759, script: "Tang" /* Tangut */ },
  // Kana Extended-B
  { start: 110576, end: 110591, script: "Kana" /* Katakana */ },
  // Kana Supplement
  { start: 110592, end: 110847, script: "Hira" /* Hiragana */ },
  // Kana Extended-A
  { start: 110848, end: 110895, script: "Hira" /* Hiragana */ },
  // Small Kana Extension
  { start: 110896, end: 110959, script: "Kana" /* Katakana */ },
  // Nushu
  { start: 110960, end: 111359, script: "Nshu" /* Nushu */ },
  // Duployan
  { start: 113664, end: 113823, script: "Dupl" /* Duployan */ },
  // Shorthand Format Controls
  { start: 113824, end: 113839, script: "Zyyy" /* Common */ },
  // Znamenny Musical Notation
  { start: 118528, end: 118735, script: "Zyyy" /* Common */ },
  // Byzantine Musical Symbols
  { start: 118784, end: 119039, script: "Zyyy" /* Common */ },
  // Musical Symbols
  { start: 119040, end: 119295, script: "Zyyy" /* Common */ },
  // Ancient Greek Musical Notation
  { start: 119296, end: 119375, script: "Grek" /* Greek */ },
  // Kaktovik Numerals
  { start: 119488, end: 119519, script: "Zyyy" /* Common */ },
  // Mayan Numerals
  { start: 119520, end: 119551, script: "Zyyy" /* Common */ },
  // Tai Xuan Jing Symbols
  { start: 119552, end: 119647, script: "Zyyy" /* Common */ },
  // Counting Rod Numerals
  { start: 119648, end: 119679, script: "Zyyy" /* Common */ },
  // Mathematical Alphanumeric Symbols
  { start: 119808, end: 120831, script: "Zyyy" /* Common */ },
  // Sutton SignWriting
  { start: 120832, end: 121519, script: "Sgnw" /* SignWriting */ },
  // Latin Extended-G
  { start: 122624, end: 122879, script: "Latn" /* Latin */ },
  // Glagolitic Supplement
  { start: 122880, end: 122927, script: "Glag" /* Glagolitic */ },
  // Cyrillic Extended-D
  { start: 122928, end: 123023, script: "Cyrl" /* Cyrillic */ },
  // Nyiakeng Puachue Hmong
  { start: 123136, end: 123215, script: "Hmnp" /* NyiakengPuachueHmong */ },
  // Toto
  { start: 123536, end: 123583, script: "Toto" /* Toto */ },
  // Wancho
  { start: 123584, end: 123647, script: "Wcho" /* Wancho */ },
  // Nag Mundari
  { start: 124112, end: 124159, script: "Nagm" /* NagMundari */ },
  // Ethiopic Extended-B
  { start: 124896, end: 124927, script: "Ethi" /* Ethiopic */ },
  // Mende Kikakui
  { start: 124928, end: 125151, script: "Mend" /* MendeKikakui */ },
  // Adlam
  { start: 125184, end: 125279, script: "Adlm" /* Adlam */ },
  // Indic Siyaq Numbers
  { start: 126064, end: 126143, script: "Zyyy" /* Common */ },
  // Ottoman Siyaq Numbers
  { start: 126208, end: 126287, script: "Zyyy" /* Common */ },
  // Arabic Mathematical Alphabetic Symbols
  { start: 126464, end: 126719, script: "Arab" /* Arabic */ },
  // Mahjong Tiles
  { start: 126976, end: 127023, script: "Zyyy" /* Common */ },
  // Domino Tiles
  { start: 127024, end: 127135, script: "Zyyy" /* Common */ },
  // Playing Cards
  { start: 127136, end: 127231, script: "Zyyy" /* Common */ },
  // Enclosed Alphanumeric Supplement
  { start: 127232, end: 127487, script: "Zyyy" /* Common */ },
  // Enclosed Ideographic Supplement
  { start: 127488, end: 127743, script: "Zyyy" /* Common */ },
  // Miscellaneous Symbols and Pictographs
  { start: 127744, end: 128511, script: "Zyyy" /* Common */ },
  // Emoticons
  { start: 128512, end: 128591, script: "Zyyy" /* Common */ },
  // Ornamental Dingbats
  { start: 128592, end: 128639, script: "Zyyy" /* Common */ },
  // Transport and Map Symbols
  { start: 128640, end: 128767, script: "Zyyy" /* Common */ },
  // Alchemical Symbols
  { start: 128768, end: 128895, script: "Zyyy" /* Common */ },
  // Geometric Shapes Extended
  { start: 128896, end: 129023, script: "Zyyy" /* Common */ },
  // Supplemental Arrows-C
  { start: 129024, end: 129279, script: "Zyyy" /* Common */ },
  // Supplemental Symbols and Pictographs
  { start: 129280, end: 129535, script: "Zyyy" /* Common */ },
  // Chess Symbols
  { start: 129536, end: 129647, script: "Zyyy" /* Common */ },
  // Symbols and Pictographs Extended-A
  { start: 129648, end: 129791, script: "Zyyy" /* Common */ },
  // Symbols for Legacy Computing
  { start: 129792, end: 130047, script: "Zyyy" /* Common */ },
  // CJK Unified Ideographs Extension B
  { start: 131072, end: 173791, script: "Hani" /* Han */ },
  // CJK Unified Ideographs Extension C
  { start: 173824, end: 177983, script: "Hani" /* Han */ },
  // CJK Unified Ideographs Extension D
  { start: 177984, end: 178207, script: "Hani" /* Han */ },
  // CJK Unified Ideographs Extension E
  { start: 178208, end: 183983, script: "Hani" /* Han */ },
  // CJK Unified Ideographs Extension F
  { start: 183984, end: 191471, script: "Hani" /* Han */ },
  // CJK Compatibility Ideographs Supplement
  { start: 194560, end: 195103, script: "Hani" /* Han */ },
  // CJK Unified Ideographs Extension G
  { start: 196608, end: 201551, script: "Hani" /* Han */ },
  // CJK Unified Ideographs Extension H
  { start: 201552, end: 205743, script: "Hani" /* Han */ },
  // Tags
  { start: 917504, end: 917631, script: "Zyyy" /* Common */ },
  // Variation Selectors Supplement
  { start: 917760, end: 917999, script: "Zinh" /* Inherited */ },
  // Supplementary Private Use Area-A
  { start: 983040, end: 1048575, script: "Zzzz" /* Unknown */ },
  // Supplementary Private Use Area-B
  { start: 1048576, end: 1114111, script: "Zzzz" /* Unknown */ }
];
function getScript(cp) {
  let left = 0;
  let right = SCRIPT_RANGES.length - 1;
  while (left <= right) {
    const mid = left + right >>> 1;
    const range = SCRIPT_RANGES[mid];
    if (cp < range.start) {
      right = mid - 1;
    } else if (cp > range.end) {
      left = mid + 1;
    } else {
      return range.script;
    }
  }
  return "Zzzz" /* Unknown */;
}
function detectScript(text) {
  const counts = /* @__PURE__ */ new Map();
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    const script = getScript(cp);
    if (script === "Zyyy" /* Common */ || script === "Zinh" /* Inherited */) {
      continue;
    }
    counts.set(script, (counts.get(script) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return "Zyyy" /* Common */;
  }
  let maxScript = "Zyyy" /* Common */;
  let maxCount = 0;
  for (const [script, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxScript = script;
    }
  }
  return maxScript;
}
function getScripts(text) {
  const scripts = /* @__PURE__ */ new Set();
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    const script = getScript(cp);
    scripts.add(script);
  }
  return Array.from(scripts);
}
function isScript(text, script) {
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    const charScript = getScript(cp);
    if (charScript !== script && charScript !== "Zyyy" /* Common */ && charScript !== "Zinh" /* Inherited */) {
      return false;
    }
  }
  return true;
}
function getScriptRuns(text) {
  const runs = [];
  if (text.length === 0) return runs;
  let currentScript = null;
  let runStart = 0;
  let charIndex = 0;
  const chars = [];
  for (const char of text) {
    chars.push(char);
  }
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const cp = char.codePointAt(0) ?? 0;
    let script = getScript(cp);
    if (script === "Zyyy" /* Common */ || script === "Zinh" /* Inherited */) {
      if (currentScript !== null) {
        script = currentScript;
      }
    }
    if (currentScript === null) {
      currentScript = script;
      runStart = i;
    } else if (script !== currentScript && script !== "Zyyy" /* Common */ && script !== "Zinh" /* Inherited */) {
      runs.push({
        script: currentScript,
        start: runStart,
        end: i,
        text: chars.slice(runStart, i).join("")
      });
      currentScript = script;
      runStart = i;
    }
  }
  if (currentScript !== null) {
    runs.push({
      script: currentScript,
      start: runStart,
      end: chars.length,
      text: chars.slice(runStart).join("")
    });
  }
  return runs;
}
function getScriptTag(script) {
  const tagMap = {
    ["Zyyy" /* Common */]: "DFLT",
    ["Zinh" /* Inherited */]: "DFLT",
    ["Zzzz" /* Unknown */]: "DFLT",
    ["Latn" /* Latin */]: "latn",
    ["Grek" /* Greek */]: "grek",
    ["Cyrl" /* Cyrillic */]: "cyrl",
    ["Armn" /* Armenian */]: "armn",
    ["Hebr" /* Hebrew */]: "hebr",
    ["Arab" /* Arabic */]: "arab",
    ["Syrc" /* Syriac */]: "syrc",
    ["Thaa" /* Thaana */]: "thaa",
    ["Deva" /* Devanagari */]: "deva",
    ["Beng" /* Bengali */]: "beng",
    ["Guru" /* Gurmukhi */]: "guru",
    ["Gujr" /* Gujarati */]: "gujr",
    ["Orya" /* Oriya */]: "orya",
    ["Taml" /* Tamil */]: "taml",
    ["Telu" /* Telugu */]: "telu",
    ["Knda" /* Kannada */]: "knda",
    ["Mlym" /* Malayalam */]: "mlym",
    ["Sinh" /* Sinhala */]: "sinh",
    ["Thai" /* Thai */]: "thai",
    ["Laoo" /* Lao */]: "lao ",
    ["Tibt" /* Tibetan */]: "tibt",
    ["Mymr" /* Myanmar */]: "mymr",
    ["Geor" /* Georgian */]: "geor",
    ["Hang" /* Hangul */]: "hang",
    ["Ethi" /* Ethiopic */]: "ethi",
    ["Cher" /* Cherokee */]: "cher",
    ["Cans" /* CanadianAboriginal */]: "cans",
    ["Ogam" /* Ogham */]: "ogam",
    ["Runr" /* Runic */]: "runr",
    ["Khmr" /* Khmer */]: "khmr",
    ["Mong" /* Mongolian */]: "mong",
    ["Hira" /* Hiragana */]: "kana",
    ["Kana" /* Katakana */]: "kana",
    ["Bopo" /* Bopomofo */]: "bopo",
    ["Hani" /* Han */]: "hani",
    ["Yiii" /* Yi */]: "yi  ",
    ["Ital" /* OldItalic */]: "ital",
    ["Goth" /* Gothic */]: "goth",
    ["Dsrt" /* Deseret */]: "dsrt",
    ["Tglg" /* Tagalog */]: "tglg",
    ["Hano" /* Hanunoo */]: "hano",
    ["Buhd" /* Buhid */]: "buhd",
    ["Tagb" /* Tagbanwa */]: "tagb",
    ["Limb" /* Limbu */]: "limb",
    ["Tale" /* TaiLe */]: "tale",
    ["Linb" /* LinearB */]: "linb",
    ["Ugar" /* Ugaritic */]: "ugar",
    ["Shaw" /* Shavian */]: "shaw",
    ["Osma" /* Osmanya */]: "osma",
    ["Cprt" /* Cypriot */]: "cprt",
    ["Brai" /* Braille */]: "brai",
    ["Bugi" /* Buginese */]: "bugi",
    ["Copt" /* Coptic */]: "copt",
    ["Talu" /* NewTaiLue */]: "talu",
    ["Glag" /* Glagolitic */]: "glag",
    ["Tfng" /* Tifinagh */]: "tfng",
    ["Sylo" /* SylotiNagri */]: "sylo",
    ["Xpeo" /* OldPersian */]: "xpeo",
    ["Khar" /* Kharoshthi */]: "khar",
    ["Bali" /* Balinese */]: "bali",
    ["Xsux" /* Cuneiform */]: "xsux",
    ["Phnx" /* Phoenician */]: "phnx",
    ["Phag" /* PhagsPa */]: "phag",
    ["Nkoo" /* Nko */]: "nko ",
    ["Sund" /* Sundanese */]: "sund",
    ["Lepc" /* Lepcha */]: "lepc",
    ["Olck" /* OlChiki */]: "olck",
    ["Vaii" /* Vai */]: "vai ",
    ["Saur" /* Saurashtra */]: "saur",
    ["Kali" /* KayahLi */]: "kali",
    ["Rjng" /* Rejang */]: "rjng",
    ["Lyci" /* Lycian */]: "lyci",
    ["Cari" /* Carian */]: "cari",
    ["Lydi" /* Lydian */]: "lydi",
    ["Cham" /* Cham */]: "cham",
    ["Lana" /* TaiTham */]: "lana",
    ["Tavt" /* TaiViet */]: "tavt",
    ["Avst" /* Avestan */]: "avst",
    ["Egyp" /* EgyptianHieroglyphs */]: "egyp",
    ["Samr" /* Samaritan */]: "samr",
    ["Lisu" /* Lisu */]: "lisu",
    ["Bamu" /* Bamum */]: "bamu",
    ["Java" /* Javanese */]: "java",
    ["Mtei" /* MeeteiMayek */]: "mtei",
    ["Armi" /* ImperialAramaic */]: "armi",
    ["Sarb" /* OldSouthArabian */]: "sarb",
    ["Prti" /* InscriptionalParthian */]: "prti",
    ["Phli" /* InscriptionalPahlavi */]: "phli",
    ["Orkh" /* OldTurkic */]: "orkh",
    ["Kthi" /* Kaithi */]: "kthi",
    ["Batk" /* Batak */]: "batk",
    ["Brah" /* Brahmi */]: "brah",
    ["Mand" /* Mandaic */]: "mand",
    ["Cakm" /* Chakma */]: "cakm",
    ["Merc" /* MeroiticCursive */]: "merc",
    ["Mero" /* MeroiticHieroglyphs */]: "mero",
    ["Plrd" /* Miao */]: "plrd",
    ["Shrd" /* Sharada */]: "shrd",
    ["Sora" /* SoraSompeng */]: "sora",
    ["Takr" /* Takri */]: "takr",
    ["Aghb" /* CaucasianAlbanian */]: "aghb",
    ["Bass" /* BassaVah */]: "bass",
    ["Dupl" /* Duployan */]: "dupl",
    ["Elba" /* Elbasan */]: "elba",
    ["Gran" /* Grantha */]: "gran",
    ["Hmng" /* PahawhHmong */]: "hmng",
    ["Khoj" /* Khojki */]: "khoj",
    ["Lina" /* LinearA */]: "lina",
    ["Mahj" /* Mahajani */]: "mahj",
    ["Mani" /* Manichaean */]: "mani",
    ["Mend" /* MendeKikakui */]: "mend",
    ["Modi" /* Modi */]: "modi",
    ["Mroo" /* Mro */]: "mroo",
    ["Narb" /* OldNorthArabian */]: "narb",
    ["Nbat" /* Nabataean */]: "nbat",
    ["Palm" /* Palmyrene */]: "palm",
    ["Pauc" /* PauCinHau */]: "pauc",
    ["Perm" /* OldPermic */]: "perm",
    ["Phlp" /* PsalterPahlavi */]: "phlp",
    ["Sidd" /* Siddham */]: "sidd",
    ["Sind" /* Khudawadi */]: "sind",
    ["Tirh" /* Tirhuta */]: "tirh",
    ["Wara" /* WarangCiti */]: "wara",
    ["Ahom" /* Ahom */]: "ahom",
    ["Hluw" /* AnatolianHieroglyphs */]: "hluw",
    ["Hatr" /* Hatran */]: "hatr",
    ["Mult" /* Multani */]: "mult",
    ["Hung" /* OldHungarian */]: "hung",
    ["Sgnw" /* SignWriting */]: "sgnw",
    ["Adlm" /* Adlam */]: "adlm",
    ["Bhks" /* Bhaiksuki */]: "bhks",
    ["Marc" /* Marchen */]: "marc",
    ["Newa" /* Newa */]: "newa",
    ["Osge" /* Osage */]: "osge",
    ["Tang" /* Tangut */]: "tang",
    ["Gonm" /* MasaramGondi */]: "gonm",
    ["Nshu" /* Nushu */]: "nshu",
    ["Soyo" /* Soyombo */]: "soyo",
    ["Zanb" /* ZanabazarSquare */]: "zanb",
    ["Dogr" /* Dogra */]: "dogr",
    ["Gong" /* GunjalaGondi */]: "gong",
    ["Maka" /* Makasar */]: "maka",
    ["Medf" /* Medefaidrin */]: "medf",
    ["Rohg" /* HanifiRohingya */]: "rohg",
    ["Sogd" /* Sogdian */]: "sogd",
    ["Sogo" /* OldSogdian */]: "sogo",
    ["Elym" /* Elymaic */]: "elym",
    ["Nand" /* Nandinagari */]: "nand",
    ["Hmnp" /* NyiakengPuachueHmong */]: "hmnp",
    ["Wcho" /* Wancho */]: "wcho",
    ["Yezi" /* Yezidi */]: "yezi",
    ["Chrs" /* Chorasmian */]: "chrs",
    ["Diak" /* DivesAkuru */]: "diak",
    ["Kits" /* KhitanSmallScript */]: "kits",
    ["Vith" /* Vithkuqi */]: "vith",
    ["Ougr" /* OldUyghur */]: "ougr",
    ["Cpmn" /* Cypro_Minoan */]: "cpmn",
    ["Tnsa" /* Tangsa */]: "tnsa",
    ["Toto" /* Toto */]: "toto",
    ["Kawi" /* Kawi */]: "kawi",
    ["Nagm" /* NagMundari */]: "nagm"
  };
  return tagMap[script] ?? "DFLT";
}
function isComplexScript(script) {
  const complexScripts = /* @__PURE__ */ new Set([
    "Arab" /* Arabic */,
    "Syrc" /* Syriac */,
    "Hebr" /* Hebrew */,
    "Thaa" /* Thaana */,
    "Nkoo" /* Nko */,
    "Deva" /* Devanagari */,
    "Beng" /* Bengali */,
    "Guru" /* Gurmukhi */,
    "Gujr" /* Gujarati */,
    "Orya" /* Oriya */,
    "Taml" /* Tamil */,
    "Telu" /* Telugu */,
    "Knda" /* Kannada */,
    "Mlym" /* Malayalam */,
    "Sinh" /* Sinhala */,
    "Thai" /* Thai */,
    "Laoo" /* Lao */,
    "Tibt" /* Tibetan */,
    "Mymr" /* Myanmar */,
    "Khmr" /* Khmer */,
    "Mong" /* Mongolian */,
    "Hang" /* Hangul */
  ]);
  return complexScripts.has(script);
}
function getScriptDirection(script) {
  const rtlScripts = /* @__PURE__ */ new Set([
    "Arab" /* Arabic */,
    "Hebr" /* Hebrew */,
    "Syrc" /* Syriac */,
    "Thaa" /* Thaana */,
    "Nkoo" /* Nko */,
    "Samr" /* Samaritan */,
    "Mand" /* Mandaic */,
    "Armi" /* ImperialAramaic */,
    "Phnx" /* Phoenician */,
    "Sarb" /* OldSouthArabian */,
    "Narb" /* OldNorthArabian */,
    "Avst" /* Avestan */,
    "Prti" /* InscriptionalParthian */,
    "Phli" /* InscriptionalPahlavi */,
    "Phlp" /* PsalterPahlavi */,
    "Hatr" /* Hatran */,
    "Lydi" /* Lydian */,
    "Nbat" /* Nabataean */,
    "Palm" /* Palmyrene */,
    "Mani" /* Manichaean */,
    "Mend" /* MendeKikakui */,
    "Rohg" /* HanifiRohingya */,
    "Yezi" /* Yezidi */,
    "Sogo" /* OldSogdian */,
    "Sogd" /* Sogdian */,
    "Elym" /* Elymaic */,
    "Chrs" /* Chorasmian */,
    "Ougr" /* OldUyghur */,
    "Adlm" /* Adlam */
  ]);
  return rtlScripts.has(script) ? "rtl" : "ltr";
}

// src/raster/types.ts
var PixelMode = /* @__PURE__ */ ((PixelMode2) => {
  PixelMode2[PixelMode2["Mono"] = 0] = "Mono";
  PixelMode2[PixelMode2["Gray"] = 1] = "Gray";
  PixelMode2[PixelMode2["LCD"] = 2] = "LCD";
  PixelMode2[PixelMode2["LCD_V"] = 3] = "LCD_V";
  return PixelMode2;
})(PixelMode || {});
var FillRule = /* @__PURE__ */ ((FillRule2) => {
  FillRule2[FillRule2["NonZero"] = 0] = "NonZero";
  FillRule2[FillRule2["EvenOdd"] = 1] = "EvenOdd";
  return FillRule2;
})(FillRule || {});
function createBitmap(width, height, pixelMode = 1 /* Gray */) {
  let bytesPerPixel;
  switch (pixelMode) {
    case 0 /* Mono */:
      bytesPerPixel = 1 / 8;
      break;
    case 1 /* Gray */:
      bytesPerPixel = 1;
      break;
    case 2 /* LCD */:
    case 3 /* LCD_V */:
      bytesPerPixel = 3;
      break;
  }
  const pitch = pixelMode === 0 /* Mono */ ? Math.ceil(width / 8) : width * bytesPerPixel;
  return {
    buffer: new Uint8Array(pitch * height),
    width,
    rows: height,
    pitch,
    pixelMode,
    numGrays: pixelMode === 0 /* Mono */ ? 2 : 256
  };
}
function clearBitmap(bitmap) {
  bitmap.buffer.fill(0);
}

// src/raster/fixed-point.ts
var PIXEL_BITS2 = 8;
var ONE_PIXEL = 1 << PIXEL_BITS2;
var PIXEL_MASK = ONE_PIXEL - 1;
var F26DOT6_SHIFT = 6;
var F26DOT6_ONE = 1 << F26DOT6_SHIFT;
var F16DOT16_SHIFT = 16;
var F16DOT16_ONE = 1 << F16DOT16_SHIFT;
function truncPixel(x) {
  return x >> PIXEL_BITS2;
}
function fracPixel(x) {
  return x & PIXEL_MASK;
}
function abs(x) {
  return x < 0 ? -x : x;
}

// src/raster/cell.ts
var DEFAULT_POOL_SIZE = 2048;
var CELL_MAX_X = 2147483647;
var PoolOverflowError = class extends Error {
  constructor() {
    super("Cell pool overflow");
    this.name = "PoolOverflowError";
  }
};
var CellBuffer = class {
  /** Fixed-size cell pool */
  pool;
  /** Pool size */
  poolSize;
  /** Next free cell index */
  freeIndex;
  /** Per-scanline linked list heads (index into pool, -1 for empty) */
  ycells;
  /** Band bounds (Y range for current render pass) */
  bandMinY = 0;
  bandMaxY = 0;
  /** Bounding box of active cells */
  minY = Infinity;
  maxY = -Infinity;
  minX = Infinity;
  maxX = -Infinity;
  /** Current position for incremental cell updates */
  currentX = 0;
  currentY = 0;
  currentCellIndex = -1;
  /** Clip bounds in pixels */
  clipMinX = -Infinity;
  clipMinY = -Infinity;
  clipMaxX = Infinity;
  clipMaxY = Infinity;
  /** Null cell index (sentinel at end of pool) */
  nullCellIndex;
  /** Whether band bounds have been set */
  bandSet = false;
  constructor(poolSize = DEFAULT_POOL_SIZE) {
    this.poolSize = poolSize;
    this.nullCellIndex = poolSize - 1;
    this.pool = new Array(poolSize);
    for (let i = 0; i < poolSize; i++) {
      this.pool[i] = { x: 0, area: 0, cover: 0, next: -1 };
    }
    this.pool[this.nullCellIndex].x = CELL_MAX_X;
    this.pool[this.nullCellIndex].next = -1;
    this.ycells = [];
    this.freeIndex = 0;
    this.bandMinY = -1e4;
    this.bandMaxY = 1e4;
  }
  /**
   * Set clipping bounds
   */
  setClip(minX, minY, maxX, maxY) {
    this.clipMinX = minX;
    this.clipMinY = minY;
    this.clipMaxX = maxX;
    this.clipMaxY = maxY;
  }
  /**
   * Set band bounds for current render pass
   */
  setBandBounds(minY, maxY) {
    this.bandMinY = minY;
    this.bandMaxY = maxY;
    this.bandSet = true;
    const height = maxY - minY;
    if (this.ycells.length < height) {
      this.ycells = new Array(height);
    }
    for (let i = 0; i < height; i++) {
      this.ycells[i] = this.nullCellIndex;
    }
    this.freeIndex = 0;
  }
  /**
   * Clear all cells for new band
   */
  reset() {
    this.freeIndex = 0;
    this.pool[this.nullCellIndex].x = CELL_MAX_X;
    this.pool[this.nullCellIndex].area = 0;
    this.pool[this.nullCellIndex].cover = 0;
    this.pool[this.nullCellIndex].next = -1;
    if (this.bandSet) {
      for (let i = 0; i < this.ycells.length; i++) {
        this.ycells[i] = this.nullCellIndex;
      }
    } else {
      this.ycells = [];
      this.bandMinY = -1e5;
      this.bandMaxY = 1e5;
    }
    this.minY = Infinity;
    this.maxY = -Infinity;
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.currentCellIndex = -1;
  }
  /**
   * Set current position (in subpixel coordinates)
   * @throws PoolOverflowError if pool is exhausted
   */
  setCurrentCell(x, y) {
    const px = truncPixel(x);
    const py = truncPixel(y);
    if (this.currentCellIndex >= 0 && this.currentX === px && this.currentY === py) {
      return;
    }
    if (py < this.bandMinY || py >= this.bandMaxY || px < this.clipMinX || px >= this.clipMaxX) {
      this.currentCellIndex = this.nullCellIndex;
      this.currentX = px;
      this.currentY = py;
      return;
    }
    this.currentX = px;
    this.currentY = py;
    this.currentCellIndex = this.findOrCreateCell(px, py);
    this.minY = Math.min(this.minY, py);
    this.maxY = Math.max(this.maxY, py);
    this.minX = Math.min(this.minX, px);
    this.maxX = Math.max(this.maxX, px);
  }
  /**
   * Find or create a cell at the given pixel position
   * @throws PoolOverflowError if pool is exhausted
   */
  findOrCreateCell(x, y) {
    if (!this.bandSet) {
      this.ensureYCellsCapacity(y);
    }
    const rowIndex = y - this.bandMinY;
    if (rowIndex < 0 || rowIndex >= this.ycells.length) {
      return this.nullCellIndex;
    }
    let prevIndex = -1;
    let cellIndex = this.ycells[rowIndex];
    while (cellIndex !== this.nullCellIndex) {
      const cell = this.pool[cellIndex];
      if (cell.x === x) {
        return cellIndex;
      }
      if (cell.x > x) {
        break;
      }
      prevIndex = cellIndex;
      cellIndex = cell.next;
    }
    if (this.freeIndex >= this.nullCellIndex) {
      throw new PoolOverflowError();
    }
    const newIndex = this.freeIndex++;
    const newCell = this.pool[newIndex];
    newCell.x = x;
    newCell.area = 0;
    newCell.cover = 0;
    newCell.next = cellIndex;
    if (prevIndex === -1) {
      this.ycells[rowIndex] = newIndex;
    } else {
      this.pool[prevIndex].next = newIndex;
    }
    return newIndex;
  }
  /**
   * Ensure ycells array can accommodate the given Y coordinate
   * Used for backward compatibility when setBandBounds is not called
   */
  ensureYCellsCapacity(y) {
    if (this.ycells.length === 0) {
      this.bandMinY = Math.min(y, 0);
      this.bandMaxY = Math.max(y + 1, 256);
      const height = this.bandMaxY - this.bandMinY;
      this.ycells = new Array(height);
      for (let i = 0; i < height; i++) {
        this.ycells[i] = this.nullCellIndex;
      }
      return;
    }
    if (y < this.bandMinY) {
      const expand = this.bandMinY - y;
      const newYcells = new Array(this.ycells.length + expand);
      for (let i = 0; i < expand; i++) {
        newYcells[i] = this.nullCellIndex;
      }
      for (let i = 0; i < this.ycells.length; i++) {
        newYcells[expand + i] = this.ycells[i];
      }
      this.ycells = newYcells;
      this.bandMinY = y;
    } else if (y >= this.bandMaxY) {
      const newMaxY = y + 1;
      const oldLen = this.ycells.length;
      const newLen = newMaxY - this.bandMinY;
      if (newLen > oldLen) {
        const newYcells = new Array(newLen);
        for (let i = 0; i < oldLen; i++) {
          newYcells[i] = this.ycells[i];
        }
        for (let i = oldLen; i < newLen; i++) {
          newYcells[i] = this.nullCellIndex;
        }
        this.ycells = newYcells;
      }
      this.bandMaxY = newMaxY;
    }
  }
  /**
   * Add area and cover to current cell
   */
  addArea(area, cover) {
    if (this.currentCellIndex >= 0) {
      const cell = this.pool[this.currentCellIndex];
      cell.area += area;
      cell.cover += cover;
    }
  }
  /**
   * Get current cell area (for accumulation)
   */
  getArea() {
    if (this.currentCellIndex >= 0) {
      return this.pool[this.currentCellIndex].area;
    }
    return 0;
  }
  /**
   * Get current cell cover
   */
  getCover() {
    if (this.currentCellIndex >= 0) {
      return this.pool[this.currentCellIndex].cover;
    }
    return 0;
  }
  /**
   * Get all cells for a given Y coordinate, sorted by X
   */
  getCellsForRow(y) {
    const rowIndex = y - this.bandMinY;
    if (rowIndex < 0 || rowIndex >= this.ycells.length) {
      return [];
    }
    const cells = [];
    let cellIndex = this.ycells[rowIndex];
    while (cellIndex !== this.nullCellIndex) {
      cells.push(this.pool[cellIndex]);
      cellIndex = this.pool[cellIndex].next;
    }
    return cells;
  }
  /**
   * Iterate over all cells in scanline order within band
   */
  *iterateCells() {
    for (let i = 0; i < this.ycells.length; i++) {
      const y = this.bandMinY + i;
      let cellIndex = this.ycells[i];
      if (cellIndex === this.nullCellIndex) continue;
      const cells = [];
      while (cellIndex !== this.nullCellIndex) {
        cells.push(this.pool[cellIndex]);
        cellIndex = this.pool[cellIndex].next;
      }
      if (cells.length > 0) {
        yield { y, cells };
      }
    }
  }
  /**
   * Iterate cells for a single row (for band sweep)
   */
  *iterateRowCells(y) {
    const rowIndex = y - this.bandMinY;
    if (rowIndex < 0 || rowIndex >= this.ycells.length) return;
    let cellIndex = this.ycells[rowIndex];
    while (cellIndex !== this.nullCellIndex) {
      yield this.pool[cellIndex];
      cellIndex = this.pool[cellIndex].next;
    }
  }
  /**
   * Get number of cells currently allocated
   */
  getCellCount() {
    return this.freeIndex;
  }
  /**
   * Check if pool is near capacity
   */
  isNearCapacity() {
    return this.freeIndex > this.poolSize * 0.9;
  }
};

// src/raster/gray-raster.ts
var MAX_BAND_DEPTH = 32;
var MAX_GRAY_SPANS = 16;
var GrayRaster = class {
  cells;
  // Current position in subpixel coordinates
  x = 0;
  y = 0;
  // Clip bounds in pixels
  minX = 0;
  minY = 0;
  maxX = 0;
  maxY = 0;
  constructor() {
    this.cells = new CellBuffer();
  }
  /**
   * Set clip rectangle (in pixels)
   */
  setClip(minX, minY, maxX, maxY) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.cells.setClip(minX, minY, maxX, maxY);
  }
  /**
   * Set band bounds for current render pass
   */
  setBandBounds(minY, maxY) {
    this.cells.setBandBounds(minY, maxY);
  }
  /**
   * Reset rasterizer state
   */
  reset() {
    this.cells.reset();
    this.x = 0;
    this.y = 0;
  }
  /**
   * Move to a new position (start new contour)
   * Coordinates are in subpixel units (ONE_PIXEL per pixel)
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
    this.cells.setCurrentCell(x, y);
  }
  /**
   * Draw line to position
   */
  lineTo(toX, toY) {
    this.renderLine(toX, toY);
    this.x = toX;
    this.y = toY;
  }
  /**
   * Render a line from current position to (toX, toY)
   * This is the core rasterization algorithm.
   */
  renderLine(toX, toY) {
    let ey1 = truncPixel(this.y);
    let ey2 = truncPixel(toY);
    if (ey1 >= this.maxY && ey2 >= this.maxY || ey1 < this.minY && ey2 < this.minY) {
      return;
    }
    let fy1 = fracPixel(this.y);
    let fy2 = fracPixel(toY);
    if (ey1 === ey2) {
      this.renderScanline(ey1, this.x, fy1, toX, fy2);
      return;
    }
    const dx = toX - this.x;
    const dy = toY - this.y;
    if (dx === 0) {
      const ex = truncPixel(this.x);
      const twoFx = fracPixel(this.x) * 2;
      let first2;
      let incr2;
      if (dy > 0) {
        first2 = ONE_PIXEL;
        incr2 = 1;
      } else {
        first2 = 0;
        incr2 = -1;
      }
      let delta2 = first2 - fy1;
      this.cells.setCurrentCell(this.x, ey1 << PIXEL_BITS2);
      this.cells.addArea(delta2 * twoFx, delta2);
      ey1 += incr2;
      this.cells.setCurrentCell(this.x, ey1 << PIXEL_BITS2);
      delta2 = first2 + first2 - ONE_PIXEL;
      while (ey1 !== ey2) {
        this.cells.addArea(delta2 * twoFx, delta2);
        ey1 += incr2;
        this.cells.setCurrentCell(this.x, ey1 << PIXEL_BITS2);
      }
      delta2 = fy2 - ONE_PIXEL + first2;
      this.cells.addArea(delta2 * twoFx, delta2);
      return;
    }
    let x = this.x;
    let incr;
    let first;
    if (dy > 0) {
      first = ONE_PIXEL;
      incr = 1;
    } else {
      first = 0;
      incr = -1;
    }
    let delta = first - fy1;
    const xDelta = this.mulDiv(dx, delta, abs(dy));
    let x2 = x + xDelta;
    this.renderScanline(ey1, x, fy1, x2, first);
    x = x2;
    ey1 += incr;
    this.cells.setCurrentCell(x, ey1 << PIXEL_BITS2);
    if (ey1 !== ey2) {
      const xLift = this.mulDiv(dx, ONE_PIXEL, abs(dy));
      delta = first + first - ONE_PIXEL;
      while (ey1 !== ey2) {
        x2 = x + xLift;
        this.renderScanline(ey1, x, ONE_PIXEL - first, x2, first);
        x = x2;
        ey1 += incr;
        this.cells.setCurrentCell(x, ey1 << PIXEL_BITS2);
      }
    }
    delta = fy2 - ONE_PIXEL + first;
    this.renderScanline(ey1, x, ONE_PIXEL - first, toX, fy2);
  }
  /**
   * Render a line segment within a single scanline
   */
  renderScanline(ey, x1, y1, x2, y2) {
    const ex1 = truncPixel(x1);
    const ex2 = truncPixel(x2);
    if (y1 === y2) {
      this.cells.setCurrentCell(x2, ey << PIXEL_BITS2);
      return;
    }
    const fx1 = fracPixel(x1);
    const fx2 = fracPixel(x2);
    if (ex1 === ex2) {
      const delta2 = y2 - y1;
      this.cells.setCurrentCell(x1, ey << PIXEL_BITS2);
      this.cells.addArea(delta2 * (fx1 + fx2), delta2);
      return;
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    let first;
    let incr;
    if (dx > 0) {
      first = ONE_PIXEL;
      incr = 1;
    } else {
      first = 0;
      incr = -1;
    }
    let delta = this.mulDiv(dy, first - fx1, abs(dx));
    this.cells.setCurrentCell(x1, ey << PIXEL_BITS2);
    this.cells.addArea(delta * (fx1 + first), delta);
    let y = y1 + delta;
    let ex = ex1 + incr;
    this.cells.setCurrentCell(ex << PIXEL_BITS2, ey << PIXEL_BITS2);
    if (ex !== ex2) {
      const yLift = this.mulDiv(dy, ONE_PIXEL, abs(dx));
      while (ex !== ex2) {
        delta = yLift;
        this.cells.addArea(delta * ONE_PIXEL, delta);
        y += delta;
        ex += incr;
        this.cells.setCurrentCell(ex << PIXEL_BITS2, ey << PIXEL_BITS2);
      }
    }
    delta = y2 - y;
    this.cells.addArea(delta * (fx2 + ONE_PIXEL - first), delta);
  }
  /**
   * Multiply and divide with 64-bit precision
   */
  mulDiv(a, b, c) {
    if (c === 0) return 0;
    return Math.trunc(a * b / c);
  }
  /**
   * Draw a quadratic Bezier curve using simple parametric sampling
   */
  conicTo(cx, cy, toX, toY) {
    const p0x = this.x;
    const p0y = this.y;
    const dx1 = cx - p0x;
    const dy1 = cy - p0y;
    const dx2 = toX - cx;
    const dy2 = toY - cy;
    const len = Math.sqrt(dx1 * dx1 + dy1 * dy1) + Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const numSegments = Math.max(4, Math.ceil(len / (ONE_PIXEL * 4)));
    for (let i = 1; i <= numSegments; i++) {
      const t = i / numSegments;
      const ti = 1 - t;
      const x = Math.round(ti * ti * p0x + 2 * ti * t * cx + t * t * toX);
      const y = Math.round(ti * ti * p0y + 2 * ti * t * cy + t * t * toY);
      this.renderLine(x, y);
      this.x = x;
      this.y = y;
    }
    this.x = toX;
    this.y = toY;
  }
  /**
   * Draw a cubic Bezier curve
   */
  cubicTo(cx1, cy1, cx2, cy2, x, y) {
    this.subdivCubic(this.x, this.y, cx1, cy1, cx2, cy2, x, y, 0);
    this.x = x;
    this.y = y;
  }
  subdivCubic(x1, y1, cx1, cy1, cx2, cy2, x4, y4, level) {
    if (level > 16) {
      this.renderLine(x4, y4);
      this.x = x4;
      this.y = y4;
      return;
    }
    const x12 = x1 + cx1 >> 1;
    const y12 = y1 + cy1 >> 1;
    const x23 = cx1 + cx2 >> 1;
    const y23 = cy1 + cy2 >> 1;
    const x34 = cx2 + x4 >> 1;
    const y34 = cy2 + y4 >> 1;
    const x123 = x12 + x23 >> 1;
    const y123 = y12 + y23 >> 1;
    const x234 = x23 + x34 >> 1;
    const y234 = y23 + y34 >> 1;
    const x1234 = x123 + x234 >> 1;
    const y1234 = y123 + y234 >> 1;
    const dx = x4 - x1;
    const dy = y4 - y1;
    const d1 = abs((cx1 - x4) * dy - (cy1 - y4) * dx);
    const d2 = abs((cx2 - x4) * dy - (cy2 - y4) * dx);
    if (d1 + d2 <= (ONE_PIXEL >> 1) * (abs(dx) + abs(dy))) {
      this.renderLine(x4, y4);
      this.x = x4;
      this.y = y4;
      return;
    }
    this.subdivCubic(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
    this.subdivCubic(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
  }
  /**
   * Sweep all cells and render to bitmap
   *
   * Supports both top-down (positive pitch) and bottom-up (negative pitch) bitmaps.
   * For positive pitch: y=0 is at top of image (first row in buffer)
   * For negative pitch: y=0 is at bottom of image (last row in buffer)
   */
  sweep(bitmap, fillRule = 0 /* NonZero */) {
    const pitch = bitmap.pitch;
    const origin = pitch < 0 ? (bitmap.rows - 1) * -pitch : 0;
    for (const { y, cells } of this.cells.iterateCells()) {
      if (y < 0 || y >= bitmap.rows) continue;
      let cover = 0;
      let x = 0;
      const row = pitch < 0 ? origin - y * -pitch : y * pitch;
      for (const cell of cells) {
        if (cell.x > x && cover !== 0) {
          const gray2 = this.applyFillRule(cover, fillRule);
          if (gray2 > 0) {
            const start = Math.max(0, x);
            const end = Math.min(bitmap.width, cell.x);
            this.fillSpan(bitmap, row, start, end, gray2);
          }
        }
        const scaledCover = cover * (ONE_PIXEL * 2);
        const area = scaledCover - cell.area;
        const gray = this.applyFillRule(area >> PIXEL_BITS2 + 1, fillRule);
        if (gray > 0 && cell.x >= 0 && cell.x < bitmap.width) {
          this.setPixel(bitmap, row, cell.x, gray);
        }
        cover += cell.cover;
        x = cell.x + 1;
      }
      if (x < bitmap.width && cover !== 0) {
        const gray = this.applyFillRule(cover, fillRule);
        if (gray > 0) {
          this.fillSpan(bitmap, row, x, bitmap.width, gray);
        }
      }
    }
  }
  applyFillRule(value, fillRule) {
    let v = value;
    if (v < 0) v = -v;
    if (fillRule === 1 /* EvenOdd */) {
      v &= 511;
      if (v > 256) v = 512 - v;
    }
    return v > 255 ? 255 : v;
  }
  fillSpan(bitmap, row, start, end, gray) {
    if (bitmap.pixelMode === 1 /* Gray */) {
      for (let x = start; x < end; x++) {
        bitmap.buffer[row + x] = gray;
      }
    } else if (bitmap.pixelMode === 0 /* Mono */) {
      if (gray >= 128) {
        for (let x = start; x < end; x++) {
          const byteIdx = row + (x >> 3);
          const bitIdx = 7 - (x & 7);
          bitmap.buffer[byteIdx] |= 1 << bitIdx;
        }
      }
    } else if (bitmap.pixelMode === 2 /* LCD */) {
      for (let x = start; x < end; x++) {
        const idx = row + x * 3;
        bitmap.buffer[idx] = gray;
        bitmap.buffer[idx + 1] = gray;
        bitmap.buffer[idx + 2] = gray;
      }
    }
  }
  setPixel(bitmap, row, x, gray) {
    if (bitmap.pixelMode === 1 /* Gray */) {
      bitmap.buffer[row + x] = gray;
    } else if (bitmap.pixelMode === 0 /* Mono */) {
      if (gray >= 128) {
        const byteIdx = row + (x >> 3);
        const bitIdx = 7 - (x & 7);
        bitmap.buffer[byteIdx] |= 1 << bitIdx;
      }
    } else if (bitmap.pixelMode === 2 /* LCD */) {
      const idx = row + x * 3;
      bitmap.buffer[idx] = gray;
      bitmap.buffer[idx + 1] = gray;
      bitmap.buffer[idx + 2] = gray;
    }
  }
  /**
   * Sweep and call span callback (unbuffered)
   * @param callback Span callback function
   * @param fillRule Fill rule to apply
   * @param userData User data passed to callback (like FreeType's render_span_data)
   */
  sweepSpans(callback, fillRule = 0 /* NonZero */, userData) {
    for (const { y, cells } of this.cells.iterateCells()) {
      const spans = [];
      let cover = 0;
      let spanStart = -1;
      for (const cell of cells) {
        if (cover !== 0 && cell.x > spanStart + 1) {
          const gray2 = this.applyFillRule(cover, fillRule);
          if (gray2 > 0) {
            spans.push({
              x: spanStart + 1,
              len: cell.x - spanStart - 1,
              coverage: gray2
            });
          }
        }
        const scaledCover = cover * (ONE_PIXEL * 2);
        const area = scaledCover - cell.area;
        const gray = this.applyFillRule(area >> PIXEL_BITS2 + 1, fillRule);
        if (gray > 0) {
          spans.push({ x: cell.x, len: 1, coverage: gray });
        }
        cover += cell.cover;
        spanStart = cell.x;
      }
      if (spans.length > 0) {
        callback(y, spans, userData);
      }
    }
  }
  /**
   * Sweep with span buffering (like FreeType's gray_sweep_direct)
   * Buffers up to 16 spans before flushing for better performance
   * @param callback Span callback function
   * @param fillRule Fill rule to apply
   * @param minX Minimum X clip bound
   * @param maxX Maximum X clip bound
   * @param userData User data passed to callback (like FreeType's render_span_data)
   */
  sweepDirect(callback, fillRule = 0 /* NonZero */, minX = 0, maxX = Infinity, userData) {
    const spanBuffer = [];
    for (const { y, cells } of this.cells.iterateCells()) {
      let cover = 0;
      let x = minX;
      for (const cell of cells) {
        if (cover !== 0 && cell.x > x) {
          const gray2 = this.applyFillRule(cover, fillRule);
          if (gray2 > 0) {
            spanBuffer.push({ x, len: cell.x - x, coverage: gray2 });
            if (spanBuffer.length >= MAX_GRAY_SPANS) {
              callback(y, spanBuffer.splice(0, spanBuffer.length), userData);
            }
          }
        }
        const scaledCover = cover * (ONE_PIXEL * 2);
        const area = scaledCover - cell.area;
        const gray = this.applyFillRule(area >> PIXEL_BITS2 + 1, fillRule);
        if (gray > 0 && cell.x >= minX && cell.x < maxX) {
          spanBuffer.push({ x: cell.x, len: 1, coverage: gray });
          if (spanBuffer.length >= MAX_GRAY_SPANS) {
            callback(y, spanBuffer.splice(0, spanBuffer.length), userData);
          }
        }
        cover += cell.cover;
        x = cell.x + 1;
      }
      if (cover !== 0 && x < maxX) {
        const gray = this.applyFillRule(cover, fillRule);
        if (gray > 0) {
          spanBuffer.push({ x, len: Math.min(maxX, this.maxX + 1) - x, coverage: gray });
        }
      }
      if (spanBuffer.length > 0) {
        callback(y, spanBuffer.splice(0, spanBuffer.length), userData);
      }
    }
  }
  /**
   * Render with band processing for bounded memory.
   * Divides large glyphs into bands, retries with bisection on overflow.
   * Supports both Y-dimension (vertical) and X-dimension (horizontal) bisection
   * like FreeType's ftgrays.c gray_convert_glyph.
   *
   * @param bitmap Target bitmap
   * @param decomposeFn Function that decomposes outline to rasterizer commands
   * @param bounds Glyph bounds (minY, maxY, optionally minX, maxX)
   * @param fillRule Fill rule to apply
   */
  renderWithBands(bitmap, decomposeFn, bounds, fillRule = 0 /* NonZero */) {
    const poolSize = 2048;
    const height = bounds.maxY - bounds.minY;
    let bandHeight = Math.max(1, Math.floor(poolSize / 8));
    if (height <= bandHeight) {
      bandHeight = height;
    }
    const xMin = bounds.minX ?? 0;
    const xMax = bounds.maxX ?? bitmap.width;
    const bandStack = [];
    for (let y = bounds.minY; y < bounds.maxY; y += bandHeight) {
      bandStack.push({
        minY: y,
        maxY: Math.min(y + bandHeight, bounds.maxY),
        minX: xMin,
        maxX: xMax
      });
    }
    let depth = 0;
    while (bandStack.length > 0 && depth < MAX_BAND_DEPTH) {
      const band = bandStack.pop();
      if (this.renderBandWithXClip(bitmap, decomposeFn, band.minY, band.maxY, band.minX, band.maxX, fillRule)) {
        continue;
      }
      const midX = band.minX + band.maxX >> 1;
      if (midX > band.minX) {
        bandStack.push({ minY: band.minY, maxY: band.maxY, minX: midX, maxX: band.maxX });
        bandStack.push({ minY: band.minY, maxY: band.maxY, minX: band.minX, maxX: midX });
        depth++;
        continue;
      }
      const midY = band.minY + band.maxY >> 1;
      if (midY > band.minY) {
        bandStack.push({ minY: midY, maxY: band.maxY, minX: band.minX, maxX: band.maxX });
        bandStack.push({ minY: band.minY, maxY: midY, minX: band.minX, maxX: band.maxX });
        depth++;
        continue;
      }
      console.warn(`Rasterizer: band overflow at (${band.minX},${band.minY}), cannot bisect further`);
    }
  }
  /**
   * Render a single band with X clipping
   * @returns true on success, false on pool overflow
   */
  renderBandWithXClip(bitmap, decomposeFn, minY, maxY, minX, maxX, fillRule) {
    this.cells.setBandBounds(minY, maxY);
    this.cells.reset();
    this.minY = minY;
    this.maxY = maxY;
    try {
      decomposeFn();
      this.sweepBandWithXClip(bitmap, minY, maxY, minX, maxX, fillRule);
      return true;
    } catch (e) {
      if (e instanceof PoolOverflowError) {
        return false;
      }
      throw e;
    }
  }
  /**
   * Sweep a band with X clipping and render to bitmap
   */
  sweepBandWithXClip(bitmap, minY, maxY, minX, maxX, fillRule) {
    const pitch = bitmap.pitch;
    const origin = pitch < 0 ? (bitmap.rows - 1) * -pitch : 0;
    for (let y = minY; y < maxY; y++) {
      if (y < 0 || y >= bitmap.rows) continue;
      let cover = 0;
      let x = minX;
      const row = pitch < 0 ? origin - y * -pitch : y * pitch;
      for (const cell of this.cells.iterateRowCells(y)) {
        if (cell.x < minX) {
          cover += cell.cover;
          continue;
        }
        if (cell.x >= maxX) {
          if (cover !== 0 && x < maxX) {
            const gray2 = this.applyFillRule(cover, fillRule);
            if (gray2 > 0) {
              this.fillSpan(bitmap, row, Math.max(0, x), Math.min(bitmap.width, maxX), gray2);
            }
          }
          break;
        }
        if (cell.x > x && cover !== 0) {
          const gray2 = this.applyFillRule(cover, fillRule);
          if (gray2 > 0) {
            const start = Math.max(0, x);
            const end = Math.min(bitmap.width, cell.x);
            this.fillSpan(bitmap, row, start, end, gray2);
          }
        }
        const scaledCover = cover * (ONE_PIXEL * 2);
        const area = scaledCover - cell.area;
        const gray = this.applyFillRule(area >> PIXEL_BITS2 + 1, fillRule);
        if (gray > 0 && cell.x >= 0 && cell.x < bitmap.width) {
          this.setPixel(bitmap, row, cell.x, gray);
        }
        cover += cell.cover;
        x = cell.x + 1;
      }
      if (x < maxX && x < bitmap.width && cover !== 0) {
        const gray = this.applyFillRule(cover, fillRule);
        if (gray > 0) {
          this.fillSpan(bitmap, row, x, Math.min(bitmap.width, maxX), gray);
        }
      }
    }
  }
};

// src/raster/outline-decompose.ts
function decomposePath(raster, path, scale, offsetX = 0, offsetY = 0, flipY = true) {
  let startX = 0;
  let startY = 0;
  let inContour = false;
  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M": {
        if (inContour) {
          raster.lineTo(startX, startY);
        }
        const x = toSubpixel(cmd.x, scale, offsetX);
        const y = flipY ? toSubpixelFlipY(cmd.y, scale, offsetY) : toSubpixel(cmd.y, scale, offsetY);
        raster.moveTo(x, y);
        startX = x;
        startY = y;
        inContour = true;
        break;
      }
      case "L": {
        const x = toSubpixel(cmd.x, scale, offsetX);
        const y = flipY ? toSubpixelFlipY(cmd.y, scale, offsetY) : toSubpixel(cmd.y, scale, offsetY);
        raster.lineTo(x, y);
        break;
      }
      case "Q": {
        const cx = toSubpixel(cmd.x1, scale, offsetX);
        const cy = flipY ? toSubpixelFlipY(cmd.y1, scale, offsetY) : toSubpixel(cmd.y1, scale, offsetY);
        const x = toSubpixel(cmd.x, scale, offsetX);
        const y = flipY ? toSubpixelFlipY(cmd.y, scale, offsetY) : toSubpixel(cmd.y, scale, offsetY);
        raster.conicTo(cx, cy, x, y);
        break;
      }
      case "C": {
        const cx1 = toSubpixel(cmd.x1, scale, offsetX);
        const cy1 = flipY ? toSubpixelFlipY(cmd.y1, scale, offsetY) : toSubpixel(cmd.y1, scale, offsetY);
        const cx2 = toSubpixel(cmd.x2, scale, offsetX);
        const cy2 = flipY ? toSubpixelFlipY(cmd.y2, scale, offsetY) : toSubpixel(cmd.y2, scale, offsetY);
        const x = toSubpixel(cmd.x, scale, offsetX);
        const y = flipY ? toSubpixelFlipY(cmd.y, scale, offsetY) : toSubpixel(cmd.y, scale, offsetY);
        raster.cubicTo(cx1, cy1, cx2, cy2, x, y);
        break;
      }
      case "Z": {
        if (inContour) {
          raster.lineTo(startX, startY);
          inContour = false;
        }
        break;
      }
    }
  }
  if (inContour) {
    raster.lineTo(startX, startY);
  }
}
function toSubpixel(value, scale, offset) {
  return Math.round((value * scale + offset) * ONE_PIXEL);
}
function toSubpixelFlipY(value, scale, offset) {
  return Math.round((-value * scale + offset) * ONE_PIXEL);
}
function getPathBounds(path, scale, flipY = true) {
  if (!path.bounds) return null;
  const b = path.bounds;
  if (flipY) {
    return {
      minX: Math.floor(b.xMin * scale),
      minY: Math.floor(-b.yMax * scale),
      maxX: Math.ceil(b.xMax * scale),
      maxY: Math.ceil(-b.yMin * scale)
    };
  } else {
    return {
      minX: Math.floor(b.xMin * scale),
      minY: Math.floor(b.yMin * scale),
      maxX: Math.ceil(b.xMax * scale),
      maxY: Math.ceil(b.yMax * scale)
    };
  }
}

// src/hinting/types.ts
function createDefaultGraphicsState() {
  return {
    rp0: 0,
    rp1: 0,
    rp2: 0,
    dualVector: { x: 16384, y: 0 },
    // 1.0, 0.0 in 2.14
    projVector: { x: 16384, y: 0 },
    freeVector: { x: 16384, y: 0 },
    loop: 1,
    minimumDistance: 64,
    // 1 pixel in 26.6
    roundState: 1 /* ToGrid */,
    autoFlip: true,
    controlValueCutIn: 68,
    // 17/16 pixel in 26.6
    singleWidthCutIn: 0,
    singleWidthValue: 0,
    deltaBase: 9,
    deltaShift: 3,
    instructControl: 0,
    scanControl: 0,
    scanType: 0,
    gep0: 1,
    gep1: 1,
    gep2: 1,
    period: 64,
    phase: 0,
    threshold: 32
  };
}
function createGlyphZone(maxPoints, maxContours) {
  return {
    nPoints: 0,
    nContours: 0,
    org: new Array(maxPoints).fill(null).map(() => ({ x: 0, y: 0 })),
    cur: new Array(maxPoints).fill(null).map(() => ({ x: 0, y: 0 })),
    orus: new Array(maxPoints).fill(null).map(() => ({ x: 0, y: 0 })),
    tags: new Uint8Array(maxPoints),
    contours: new Uint16Array(maxContours)
  };
}
function createExecContext(maxStack = 256, maxStorage = 64, maxFDefs = 64, maxIDefs = 64, maxCallStack = 32, maxTwilightPoints = 16) {
  const defaultGS = createDefaultGraphicsState();
  return {
    GS: { ...defaultGS },
    defaultGS,
    zp0: createGlyphZone(0, 0),
    zp1: createGlyphZone(0, 0),
    zp2: createGlyphZone(0, 0),
    twilight: createGlyphZone(maxTwilightPoints, 1),
    pts: createGlyphZone(0, 0),
    stack: new Int32Array(maxStack),
    stackTop: 0,
    IP: 0,
    code: new Uint8Array(0),
    codeSize: 0,
    currentRange: 0 /* None */,
    opcode: 0,
    numArgs: 0,
    cvt: new Int32Array(0),
    cvtSize: 0,
    storage: new Int32Array(maxStorage),
    storageSize: maxStorage,
    FDefs: new Array(maxFDefs).fill(null).map((_, i) => ({
      id: i,
      start: 0,
      end: 0,
      active: false,
      range: 0 /* None */
    })),
    maxFDefs,
    IDefs: new Array(maxIDefs).fill(null).map((_, i) => ({
      opcode: i,
      start: 0,
      end: 0,
      active: false,
      range: 0 /* None */
    })),
    maxIDefs,
    callStack: new Array(maxCallStack).fill(null).map(() => ({
      callerIP: 0,
      callerRange: 0 /* None */,
      def: { id: 0, start: 0, end: 0, active: false, range: 0 /* None */ },
      count: 0
    })),
    callStackTop: 0,
    maxCallStack,
    codeRanges: /* @__PURE__ */ new Map(),
    ppem: 12,
    pointSize: 12,
    scale: 1,
    error: null,
    instructionCount: 0,
    maxInstructions: 1e6
  };
}
var Opcode = {
  // Push instructions
  NPUSHB: 64,
  NPUSHW: 65,
  PUSHB_0: 176,
  PUSHB_1: 177,
  PUSHB_2: 178,
  PUSHB_3: 179,
  PUSHB_4: 180,
  PUSHB_5: 181,
  PUSHB_6: 182,
  PUSHB_7: 183,
  PUSHW_0: 184,
  PUSHW_1: 185,
  PUSHW_2: 186,
  PUSHW_3: 187,
  PUSHW_4: 188,
  PUSHW_5: 189,
  PUSHW_6: 190,
  PUSHW_7: 191,
  // Storage instructions
  RS: 67,
  WS: 66,
  // CVT instructions
  RCVT: 69,
  WCVTP: 68,
  WCVTF: 112,
  // Stack operations
  DUP: 32,
  POP: 33,
  CLEAR: 34,
  SWAP: 35,
  DEPTH: 36,
  CINDEX: 37,
  MINDEX: 38,
  ROLL: 138,
  // Arithmetic
  ADD: 96,
  SUB: 97,
  DIV: 98,
  MUL: 99,
  ABS: 100,
  NEG: 101,
  FLOOR: 102,
  CEILING: 103,
  MAX: 139,
  MIN: 140,
  // Comparison
  LT: 80,
  LTEQ: 81,
  GT: 82,
  GTEQ: 83,
  EQ: 84,
  NEQ: 85,
  ODD: 86,
  EVEN: 87,
  // Logic
  AND: 90,
  OR: 91,
  NOT: 92,
  // Control flow
  IF: 88,
  ELSE: 27,
  EIF: 89,
  JMPR: 28,
  JROT: 120,
  JROF: 121,
  // Functions
  FDEF: 44,
  ENDF: 45,
  CALL: 43,
  LOOPCALL: 42,
  IDEF: 137,
  // Graphics state - vectors
  SVTCA_Y: 0,
  SVTCA_X: 1,
  SPVTCA_Y: 2,
  SPVTCA_X: 3,
  SFVTCA_Y: 4,
  SFVTCA_X: 5,
  SPVTL_0: 6,
  SPVTL_1: 7,
  SFVTL_0: 8,
  SFVTL_1: 9,
  SDPVTL_0: 134,
  SDPVTL_1: 135,
  SPVFS: 10,
  SFVFS: 11,
  GPV: 12,
  GFV: 13,
  SFVTPV: 14,
  ISECT: 15,
  // Graphics state - reference points
  SRP0: 16,
  SRP1: 17,
  SRP2: 18,
  // Graphics state - zone pointers
  SZP0: 19,
  SZP1: 20,
  SZP2: 21,
  SZPS: 22,
  // Graphics state - other
  SLOOP: 23,
  RTG: 24,
  RTHG: 25,
  SMD: 26,
  RDTG: 125,
  RUTG: 124,
  ROFF: 122,
  SROUND: 118,
  S45ROUND: 119,
  SCVTCI: 29,
  SSWCI: 30,
  SSW: 31,
  FLIPON: 77,
  FLIPOFF: 78,
  SANGW: 126,
  SDB: 94,
  SDS: 95,
  // Point operations
  GC_0: 70,
  GC_1: 71,
  SCFS: 72,
  MD_0: 73,
  MD_1: 74,
  MPPEM: 75,
  MPS: 76,
  FLIPPT: 128,
  FLIPRGON: 129,
  FLIPRGOFF: 130,
  // Point movement
  SHP_0: 50,
  SHP_1: 51,
  SHC_0: 52,
  SHC_1: 53,
  SHZ_0: 54,
  SHZ_1: 55,
  SHPIX: 56,
  IP: 57,
  MSIRP_0: 58,
  MSIRP_1: 59,
  ALIGNRP: 60,
  RTDG: 61,
  MIAP_0: 62,
  MIAP_1: 63,
  // ALIGNPTS - Align Points
  ALIGNPTS: 39,
  // UTP - UnTouch Point
  UTP: 41,
  // MDAP - Move Direct Absolute Point
  MDAP_0: 46,
  MDAP_1: 47,
  // IUP - Interpolate Untouched Points
  IUP_Y: 48,
  IUP_X: 49,
  // Delta instructions
  DELTAP1: 93,
  DELTAP2: 113,
  DELTAP3: 114,
  DELTAC1: 115,
  DELTAC2: 116,
  DELTAC3: 117,
  // Rounding
  ROUND_0: 104,
  ROUND_1: 105,
  ROUND_2: 106,
  ROUND_3: 107,
  NROUND_0: 108,
  NROUND_1: 109,
  NROUND_2: 110,
  NROUND_3: 111,
  // Other
  GETINFO: 136,
  INSTCTRL: 142,
  SCANCTRL: 133,
  SCANTYPE: 141,
  AA: 127,
  DEBUG: 79,
  // MDRP - Move Direct Relative Point (32 variants: 0xc0-0xdf)
  MDRP_BASE: 192,
  // MIRP - Move Indirect Relative Point (32 variants: 0xe0-0xff)
  MIRP_BASE: 224
};
var OpcodePops = {
  [Opcode.RS]: 1,
  [Opcode.WS]: 2,
  [Opcode.RCVT]: 1,
  [Opcode.WCVTP]: 2,
  [Opcode.WCVTF]: 2,
  [Opcode.DUP]: 1,
  [Opcode.POP]: 1,
  [Opcode.CLEAR]: 0,
  [Opcode.SWAP]: 2,
  [Opcode.DEPTH]: 0,
  [Opcode.CINDEX]: 1,
  [Opcode.MINDEX]: 1,
  [Opcode.ROLL]: 3,
  [Opcode.ADD]: 2,
  [Opcode.SUB]: 2,
  [Opcode.DIV]: 2,
  [Opcode.MUL]: 2,
  [Opcode.ABS]: 1,
  [Opcode.NEG]: 1,
  [Opcode.FLOOR]: 1,
  [Opcode.CEILING]: 1,
  [Opcode.MAX]: 2,
  [Opcode.MIN]: 2,
  [Opcode.LT]: 2,
  [Opcode.LTEQ]: 2,
  [Opcode.GT]: 2,
  [Opcode.GTEQ]: 2,
  [Opcode.EQ]: 2,
  [Opcode.NEQ]: 2,
  [Opcode.ODD]: 1,
  [Opcode.EVEN]: 1,
  [Opcode.AND]: 2,
  [Opcode.OR]: 2,
  [Opcode.NOT]: 1,
  [Opcode.IF]: 1,
  [Opcode.JMPR]: 1,
  [Opcode.JROT]: 2,
  [Opcode.JROF]: 2,
  [Opcode.CALL]: 1,
  [Opcode.LOOPCALL]: 2,
  [Opcode.SRP0]: 1,
  [Opcode.SRP1]: 1,
  [Opcode.SRP2]: 1,
  [Opcode.SZP0]: 1,
  [Opcode.SZP1]: 1,
  [Opcode.SZP2]: 1,
  [Opcode.SZPS]: 1,
  [Opcode.SLOOP]: 1,
  [Opcode.SMD]: 1,
  [Opcode.SCVTCI]: 1,
  [Opcode.SSWCI]: 1,
  [Opcode.SSW]: 1,
  [Opcode.SDB]: 1,
  [Opcode.SDS]: 1,
  [Opcode.SPVFS]: 2,
  [Opcode.SFVFS]: 2,
  [Opcode.SPVTL_0]: 2,
  [Opcode.SPVTL_1]: 2,
  [Opcode.SFVTL_0]: 2,
  [Opcode.SFVTL_1]: 2,
  [Opcode.SCFS]: 2,
  [Opcode.GC_0]: 1,
  [Opcode.GC_1]: 1,
  [Opcode.MD_0]: 2,
  [Opcode.MD_1]: 2,
  [Opcode.ISECT]: 5,
  [Opcode.ALIGNRP]: 0,
  // Uses loop
  [Opcode.IP]: 0,
  // Uses loop
  [Opcode.SHPIX]: 1,
  // Plus loop points
  [Opcode.MSIRP_0]: 2,
  [Opcode.MSIRP_1]: 2,
  [Opcode.MIAP_0]: 2,
  [Opcode.MIAP_1]: 2,
  [Opcode.MDAP_0]: 1,
  [Opcode.MDAP_1]: 1,
  [Opcode.DELTAP1]: 1,
  [Opcode.DELTAP2]: 1,
  [Opcode.DELTAP3]: 1,
  [Opcode.DELTAC1]: 1,
  [Opcode.DELTAC2]: 1,
  [Opcode.DELTAC3]: 1,
  [Opcode.SROUND]: 1,
  [Opcode.S45ROUND]: 1,
  [Opcode.ROUND_0]: 1,
  [Opcode.ROUND_1]: 1,
  [Opcode.ROUND_2]: 1,
  [Opcode.ROUND_3]: 1,
  [Opcode.NROUND_0]: 1,
  [Opcode.NROUND_1]: 1,
  [Opcode.NROUND_2]: 1,
  [Opcode.NROUND_3]: 1,
  [Opcode.INSTCTRL]: 2,
  [Opcode.SCANCTRL]: 1,
  [Opcode.SCANTYPE]: 1,
  [Opcode.GETINFO]: 1,
  [Opcode.FLIPPT]: 0,
  // Uses loop
  [Opcode.FLIPRGON]: 2,
  [Opcode.FLIPRGOFF]: 2
};

// src/hinting/instructions/stack.ts
function DUP(ctx) {
  const val = ctx.stack[ctx.stackTop - 1];
  ctx.stack[ctx.stackTop++] = val;
}
function POP(ctx) {
  ctx.stackTop--;
}
function CLEAR(ctx) {
  ctx.stackTop = 0;
}
function SWAP(ctx) {
  const a = ctx.stack[ctx.stackTop - 1];
  const b = ctx.stack[ctx.stackTop - 2];
  ctx.stack[ctx.stackTop - 1] = b;
  ctx.stack[ctx.stackTop - 2] = a;
}
function DEPTH(ctx) {
  const depth = ctx.stackTop;
  ctx.stack[ctx.stackTop++] = depth;
}
function CINDEX(ctx) {
  const index = ctx.stack[--ctx.stackTop];
  if (index <= 0 || index > ctx.stackTop) {
    ctx.error = `CINDEX: invalid index ${index}`;
    return;
  }
  ctx.stack[ctx.stackTop++] = ctx.stack[ctx.stackTop - index];
}
function MINDEX(ctx) {
  const index = ctx.stack[--ctx.stackTop];
  if (index <= 0 || index > ctx.stackTop) {
    ctx.error = `MINDEX: invalid index ${index}`;
    return;
  }
  const val = ctx.stack[ctx.stackTop - index];
  for (let i = ctx.stackTop - index; i < ctx.stackTop - 1; i++) {
    ctx.stack[i] = ctx.stack[i + 1];
  }
  ctx.stack[ctx.stackTop - 1] = val;
}
function ROLL(ctx) {
  const a = ctx.stack[ctx.stackTop - 1];
  const b = ctx.stack[ctx.stackTop - 2];
  const c = ctx.stack[ctx.stackTop - 3];
  ctx.stack[ctx.stackTop - 1] = c;
  ctx.stack[ctx.stackTop - 2] = a;
  ctx.stack[ctx.stackTop - 3] = b;
}
function PUSHB(ctx, count) {
  for (let i = 0; i < count; i++) {
    ctx.stack[ctx.stackTop++] = ctx.code[ctx.IP++];
  }
}
function PUSHW(ctx, count) {
  for (let i = 0; i < count; i++) {
    const hi = ctx.code[ctx.IP++];
    const lo = ctx.code[ctx.IP++];
    let val = hi << 8 | lo;
    if (val >= 32768) val -= 65536;
    ctx.stack[ctx.stackTop++] = val;
  }
}
function NPUSHB(ctx) {
  const n = ctx.code[ctx.IP++];
  PUSHB(ctx, n);
}
function NPUSHW(ctx) {
  const n = ctx.code[ctx.IP++];
  PUSHW(ctx, n);
}

// src/hinting/instructions/arithmetic.ts
function ADD(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a + b;
}
function SUB(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a - b;
}
function DIV(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  if (b === 0) {
    ctx.error = "DIV: division by zero";
    ctx.stack[ctx.stackTop++] = 0;
    return;
  }
  ctx.stack[ctx.stackTop++] = Math.trunc(a * 64 / b);
}
function MUL(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = Math.trunc(a * b / 64);
}
function ABS(ctx) {
  const val = ctx.stack[ctx.stackTop - 1];
  ctx.stack[ctx.stackTop - 1] = val < 0 ? -val : val;
}
function NEG(ctx) {
  ctx.stack[ctx.stackTop - 1] = -ctx.stack[ctx.stackTop - 1];
}
function FLOOR(ctx) {
  const val = ctx.stack[ctx.stackTop - 1];
  ctx.stack[ctx.stackTop - 1] = val & ~63;
}
function CEILING(ctx) {
  const val = ctx.stack[ctx.stackTop - 1];
  ctx.stack[ctx.stackTop - 1] = val + 63 & ~63;
}
function MAX(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a > b ? a : b;
}
function MIN(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a < b ? a : b;
}
function LT(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a < b ? 1 : 0;
}
function LTEQ(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a <= b ? 1 : 0;
}
function GT(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a > b ? 1 : 0;
}
function GTEQ(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a >= b ? 1 : 0;
}
function EQ(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a === b ? 1 : 0;
}
function NEQ(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a !== b ? 1 : 0;
}
function ODD(ctx) {
  const val = ctx.stack[ctx.stackTop - 1];
  const rounded = val + 32 & ~63;
  ctx.stack[ctx.stackTop - 1] = rounded & 64 ? 1 : 0;
}
function EVEN(ctx) {
  const val = ctx.stack[ctx.stackTop - 1];
  const rounded = val + 32 & ~63;
  ctx.stack[ctx.stackTop - 1] = rounded & 64 ? 0 : 1;
}
function AND(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a && b ? 1 : 0;
}
function OR(ctx) {
  const b = ctx.stack[--ctx.stackTop];
  const a = ctx.stack[--ctx.stackTop];
  ctx.stack[ctx.stackTop++] = a || b ? 1 : 0;
}
function NOT(ctx) {
  const val = ctx.stack[ctx.stackTop - 1];
  ctx.stack[ctx.stackTop - 1] = val ? 0 : 1;
}

// src/hinting/instructions/control-flow.ts
function IF(ctx) {
  const condition = ctx.stack[--ctx.stackTop];
  if (condition) {
    return;
  }
  let depth = 1;
  while (ctx.IP < ctx.codeSize) {
    const opcode = ctx.code[ctx.IP++];
    switch (opcode) {
      case 88:
        depth++;
        break;
      case 27:
        if (depth === 1) {
          return;
        }
        break;
      case 89:
        depth--;
        if (depth === 0) {
          return;
        }
        break;
      // Skip push instructions
      case 64:
        ctx.IP += 1 + ctx.code[ctx.IP];
        break;
      case 65:
        ctx.IP += 1 + ctx.code[ctx.IP] * 2;
        break;
      default:
        if (opcode >= 176 && opcode <= 183) {
          ctx.IP += opcode - 176 + 1;
        } else if (opcode >= 184 && opcode <= 191) {
          ctx.IP += (opcode - 184 + 1) * 2;
        }
    }
  }
  ctx.error = "IF: missing EIF";
}
function ELSE(ctx) {
  let depth = 1;
  while (ctx.IP < ctx.codeSize) {
    const opcode = ctx.code[ctx.IP++];
    switch (opcode) {
      case 88:
        depth++;
        break;
      case 89:
        depth--;
        if (depth === 0) {
          return;
        }
        break;
      case 64:
        ctx.IP += 1 + ctx.code[ctx.IP];
        break;
      case 65:
        ctx.IP += 1 + ctx.code[ctx.IP] * 2;
        break;
      default:
        if (opcode >= 176 && opcode <= 183) {
          ctx.IP += opcode - 176 + 1;
        } else if (opcode >= 184 && opcode <= 191) {
          ctx.IP += (opcode - 184 + 1) * 2;
        }
    }
  }
  ctx.error = "ELSE: missing EIF";
}
function EIF(_ctx) {
}
function JMPR(ctx) {
  const offset = ctx.stack[--ctx.stackTop];
  ctx.IP += offset - 1;
}
function JROT(ctx) {
  const condition = ctx.stack[--ctx.stackTop];
  const offset = ctx.stack[--ctx.stackTop];
  if (condition) {
    ctx.IP += offset - 1;
  }
}
function JROF(ctx) {
  const condition = ctx.stack[--ctx.stackTop];
  const offset = ctx.stack[--ctx.stackTop];
  if (!condition) {
    ctx.IP += offset - 1;
  }
}
function FDEF(ctx) {
  const funcNum = ctx.stack[--ctx.stackTop];
  if (funcNum < 0 || funcNum >= ctx.maxFDefs) {
    ctx.error = `FDEF: invalid function number ${funcNum}`;
    return;
  }
  const def = ctx.FDefs[funcNum];
  def.id = funcNum;
  def.start = ctx.IP;
  def.active = true;
  def.range = ctx.currentRange;
  while (ctx.IP < ctx.codeSize) {
    const opcode = ctx.code[ctx.IP++];
    if (opcode === 45) {
      def.end = ctx.IP;
      return;
    }
    if (opcode === 64) {
      ctx.IP += 1 + ctx.code[ctx.IP];
    } else if (opcode === 65) {
      ctx.IP += 1 + ctx.code[ctx.IP] * 2;
    } else if (opcode >= 176 && opcode <= 183) {
      ctx.IP += opcode - 176 + 1;
    } else if (opcode >= 184 && opcode <= 191) {
      ctx.IP += (opcode - 184 + 1) * 2;
    }
  }
  ctx.error = "FDEF: missing ENDF";
}
function ENDF(ctx) {
  if (ctx.callStackTop <= 0) {
    ctx.error = "ENDF: not in function call";
    return;
  }
  const call = ctx.callStack[ctx.callStackTop - 1];
  call.count--;
  if (call.count > 0) {
    ctx.IP = call.def.start;
  } else {
    ctx.callStackTop--;
    ctx.IP = call.callerIP;
    ctx.currentRange = call.callerRange;
    const range = ctx.codeRanges.get(ctx.currentRange);
    if (range) {
      ctx.code = range.code;
      ctx.codeSize = range.size;
    }
  }
}
function CALL(ctx) {
  const funcNum = ctx.stack[--ctx.stackTop];
  if (funcNum < 0 || funcNum >= ctx.maxFDefs) {
    ctx.error = `CALL: invalid function number ${funcNum}`;
    return;
  }
  const def = ctx.FDefs[funcNum];
  if (!def.active) {
    ctx.error = `CALL: function ${funcNum} not defined`;
    return;
  }
  if (ctx.callStackTop >= ctx.maxCallStack) {
    ctx.error = "CALL: call stack overflow";
    return;
  }
  const call = ctx.callStack[ctx.callStackTop++];
  call.callerIP = ctx.IP;
  call.callerRange = ctx.currentRange;
  call.def = def;
  call.count = 1;
  ctx.currentRange = def.range;
  const range = ctx.codeRanges.get(ctx.currentRange);
  if (range) {
    ctx.code = range.code;
    ctx.codeSize = range.size;
  }
  ctx.IP = def.start;
}
function LOOPCALL(ctx) {
  const funcNum = ctx.stack[--ctx.stackTop];
  const count = ctx.stack[--ctx.stackTop];
  if (funcNum < 0 || funcNum >= ctx.maxFDefs) {
    ctx.error = `LOOPCALL: invalid function number ${funcNum}`;
    return;
  }
  const def = ctx.FDefs[funcNum];
  if (!def.active) {
    ctx.error = `LOOPCALL: function ${funcNum} not defined`;
    return;
  }
  if (count <= 0) {
    return;
  }
  if (ctx.callStackTop >= ctx.maxCallStack) {
    ctx.error = "LOOPCALL: call stack overflow";
    return;
  }
  const call = ctx.callStack[ctx.callStackTop++];
  call.callerIP = ctx.IP;
  call.callerRange = ctx.currentRange;
  call.def = def;
  call.count = count;
  ctx.currentRange = def.range;
  const range = ctx.codeRanges.get(ctx.currentRange);
  if (range) {
    ctx.code = range.code;
    ctx.codeSize = range.size;
  }
  ctx.IP = def.start;
}
function IDEF(ctx) {
  const opcode = ctx.stack[--ctx.stackTop];
  if (opcode < 0 || opcode >= ctx.maxIDefs) {
    ctx.error = `IDEF: invalid opcode ${opcode}`;
    return;
  }
  const def = ctx.IDefs[opcode];
  def.opcode = opcode;
  def.start = ctx.IP;
  def.active = true;
  def.range = ctx.currentRange;
  while (ctx.IP < ctx.codeSize) {
    const op = ctx.code[ctx.IP++];
    if (op === 45) {
      def.end = ctx.IP;
      return;
    }
    if (op === 64) {
      ctx.IP += 1 + ctx.code[ctx.IP];
    } else if (op === 65) {
      ctx.IP += 1 + ctx.code[ctx.IP] * 2;
    } else if (op >= 176 && op <= 183) {
      ctx.IP += op - 176 + 1;
    } else if (op >= 184 && op <= 191) {
      ctx.IP += (op - 184 + 1) * 2;
    }
  }
  ctx.error = "IDEF: missing ENDF";
}

// src/hinting/rounding.ts
function roundToGrid(distance, compensation) {
  if (distance >= 0) {
    return distance + 32 + compensation & -64;
  } else {
    return -(-distance + 32 + compensation & -64);
  }
}
function roundToHalfGrid(distance, compensation) {
  if (distance >= 0) {
    return (distance + 32 + compensation & -64) + 32;
  } else {
    return -((-distance + 32 + compensation & -64) + 32);
  }
}
function roundToDoubleGrid(distance, compensation) {
  if (distance >= 0) {
    return distance + 16 + compensation & -32;
  } else {
    return -(-distance + 16 + compensation & -32);
  }
}
function roundDownToGrid(distance, compensation) {
  if (distance >= 0) {
    return distance + compensation & -64;
  } else {
    return -(compensation - distance & -64);
  }
}
function roundUpToGrid(distance, compensation) {
  if (distance >= 0) {
    return distance + 63 + compensation & -64;
  } else {
    return -(63 + compensation - distance & -64);
  }
}
function roundOff(distance, _compensation) {
  return distance;
}
function roundSuper(distance, compensation, GS) {
  const { period, phase, threshold } = GS;
  if (distance >= 0) {
    const val = distance + threshold - phase + compensation & -period;
    return val + phase;
  } else {
    const val = -distance + threshold - phase + compensation & -period;
    return -(val + phase);
  }
}
function roundSuper45(distance, compensation, GS) {
  const { period, phase, threshold } = GS;
  const period45 = Math.round(period * 46 / 64);
  if (distance >= 0) {
    const val = distance + threshold - phase + compensation & -period45;
    return val + phase;
  } else {
    const val = -distance + threshold - phase + compensation & -period45;
    return -(val + phase);
  }
}
function round(distance, compensation, GS) {
  switch (GS.roundState) {
    case 1 /* ToGrid */:
      return roundToGrid(distance, compensation);
    case 0 /* ToHalfGrid */:
      return roundToHalfGrid(distance, compensation);
    case 2 /* ToDoubleGrid */:
      return roundToDoubleGrid(distance, compensation);
    case 3 /* DownToGrid */:
      return roundDownToGrid(distance, compensation);
    case 4 /* UpToGrid */:
      return roundUpToGrid(distance, compensation);
    case 5 /* Off */:
      return roundOff(distance, compensation);
    case 6 /* Super */:
      return roundSuper(distance, compensation, GS);
    case 7 /* Super45 */:
      return roundSuper45(distance, compensation, GS);
    default:
      return roundToGrid(distance, compensation);
  }
}
function parseSuperRound(selector, GS) {
  switch (selector >> 6 & 3) {
    case 0:
      GS.period = 32;
      break;
    case 1:
      GS.period = 64;
      break;
    case 2:
      GS.period = 128;
      break;
    default:
      GS.period = 64;
  }
  switch (selector >> 4 & 3) {
    case 0:
      GS.phase = 0;
      break;
    case 1:
      GS.phase = GS.period >> 2;
      break;
    case 2:
      GS.phase = GS.period >> 1;
      break;
    case 3:
      GS.phase = GS.period * 3 >> 2;
      break;
  }
  const thresholdBits = selector & 15;
  if (thresholdBits === 0) {
    GS.threshold = GS.period - 1;
  } else {
    GS.threshold = (thresholdBits - 4) * GS.period >> 3;
  }
}
function compensate(distance, GS) {
  return 0;
}

// src/hinting/instructions/graphics-state.ts
function SVTCA(ctx, axis) {
  if (axis === 0) {
    ctx.GS.projVector = { x: 0, y: 16384 };
    ctx.GS.freeVector = { x: 0, y: 16384 };
    ctx.GS.dualVector = { x: 0, y: 16384 };
  } else {
    ctx.GS.projVector = { x: 16384, y: 0 };
    ctx.GS.freeVector = { x: 16384, y: 0 };
    ctx.GS.dualVector = { x: 16384, y: 0 };
  }
}
function SPVTCA(ctx, axis) {
  if (axis === 0) {
    ctx.GS.projVector = { x: 0, y: 16384 };
    ctx.GS.dualVector = { x: 0, y: 16384 };
  } else {
    ctx.GS.projVector = { x: 16384, y: 0 };
    ctx.GS.dualVector = { x: 16384, y: 0 };
  }
}
function SFVTCA(ctx, axis) {
  if (axis === 0) {
    ctx.GS.freeVector = { x: 0, y: 16384 };
  } else {
    ctx.GS.freeVector = { x: 16384, y: 0 };
  }
}
function vectorFromPoints(ctx, p1, p2, zone1, zone2) {
  const z1 = zone1 === 0 ? ctx.twilight : ctx.pts;
  const z2 = zone2 === 0 ? ctx.twilight : ctx.pts;
  const pt1 = z1.cur[p1];
  const pt2 = z2.cur[p2];
  if (!pt1 || !pt2) {
    return { x: 16384, y: 0 };
  }
  const dx = pt2.x - pt1.x;
  const dy = pt2.y - pt1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) {
    return { x: 16384, y: 0 };
  }
  return {
    x: Math.round(dx / len * 16384),
    y: Math.round(dy / len * 16384)
  };
}
function SPVTL(ctx, perpendicular) {
  const p2 = ctx.stack[--ctx.stackTop];
  const p1 = ctx.stack[--ctx.stackTop];
  let vec = vectorFromPoints(ctx, p1, p2, ctx.GS.gep1, ctx.GS.gep2);
  if (perpendicular) {
    const temp = vec.x;
    vec.x = vec.y;
    vec.y = -temp;
  }
  ctx.GS.projVector = vec;
  ctx.GS.dualVector = vec;
}
function SFVTL(ctx, perpendicular) {
  const p2 = ctx.stack[--ctx.stackTop];
  const p1 = ctx.stack[--ctx.stackTop];
  let vec = vectorFromPoints(ctx, p1, p2, ctx.GS.gep1, ctx.GS.gep2);
  if (perpendicular) {
    const temp = vec.x;
    vec.x = vec.y;
    vec.y = -temp;
  }
  ctx.GS.freeVector = vec;
}
function SDPVTL(ctx, perpendicular) {
  const p2 = ctx.stack[--ctx.stackTop];
  const p1 = ctx.stack[--ctx.stackTop];
  let vec = vectorFromPoints(ctx, p1, p2, ctx.GS.gep1, ctx.GS.gep2);
  if (perpendicular) {
    const temp = vec.x;
    vec.x = vec.y;
    vec.y = -temp;
  }
  ctx.GS.dualVector = vec;
}
function SPVFS(ctx) {
  const y = ctx.stack[--ctx.stackTop];
  const x = ctx.stack[--ctx.stackTop];
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) {
    ctx.GS.projVector = { x: 16384, y: 0 };
  } else {
    ctx.GS.projVector = {
      x: Math.round(x / len * 16384),
      y: Math.round(y / len * 16384)
    };
  }
  ctx.GS.dualVector = { ...ctx.GS.projVector };
}
function SFVFS(ctx) {
  const y = ctx.stack[--ctx.stackTop];
  const x = ctx.stack[--ctx.stackTop];
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) {
    ctx.GS.freeVector = { x: 16384, y: 0 };
  } else {
    ctx.GS.freeVector = {
      x: Math.round(x / len * 16384),
      y: Math.round(y / len * 16384)
    };
  }
}
function GPV(ctx) {
  ctx.stack[ctx.stackTop++] = ctx.GS.projVector.x;
  ctx.stack[ctx.stackTop++] = ctx.GS.projVector.y;
}
function GFV(ctx) {
  ctx.stack[ctx.stackTop++] = ctx.GS.freeVector.x;
  ctx.stack[ctx.stackTop++] = ctx.GS.freeVector.y;
}
function SFVTPV(ctx) {
  ctx.GS.freeVector = { ...ctx.GS.projVector };
}
function SRP0(ctx) {
  ctx.GS.rp0 = ctx.stack[--ctx.stackTop];
}
function SRP1(ctx) {
  ctx.GS.rp1 = ctx.stack[--ctx.stackTop];
}
function SRP2(ctx) {
  ctx.GS.rp2 = ctx.stack[--ctx.stackTop];
}
function SZP0(ctx) {
  const zone = ctx.stack[--ctx.stackTop];
  if (zone !== 0 && zone !== 1) {
    ctx.error = `SZP0: invalid zone ${zone}`;
    return;
  }
  ctx.GS.gep0 = zone;
  ctx.zp0 = zone === 0 ? ctx.twilight : ctx.pts;
}
function SZP1(ctx) {
  const zone = ctx.stack[--ctx.stackTop];
  if (zone !== 0 && zone !== 1) {
    ctx.error = `SZP1: invalid zone ${zone}`;
    return;
  }
  ctx.GS.gep1 = zone;
  ctx.zp1 = zone === 0 ? ctx.twilight : ctx.pts;
}
function SZP2(ctx) {
  const zone = ctx.stack[--ctx.stackTop];
  if (zone !== 0 && zone !== 1) {
    ctx.error = `SZP2: invalid zone ${zone}`;
    return;
  }
  ctx.GS.gep2 = zone;
  ctx.zp2 = zone === 0 ? ctx.twilight : ctx.pts;
}
function SZPS(ctx) {
  const zone = ctx.stack[--ctx.stackTop];
  if (zone !== 0 && zone !== 1) {
    ctx.error = `SZPS: invalid zone ${zone}`;
    return;
  }
  ctx.GS.gep0 = zone;
  ctx.GS.gep1 = zone;
  ctx.GS.gep2 = zone;
  const z = zone === 0 ? ctx.twilight : ctx.pts;
  ctx.zp0 = z;
  ctx.zp1 = z;
  ctx.zp2 = z;
}
function SLOOP(ctx) {
  const count = ctx.stack[--ctx.stackTop];
  if (count <= 0) {
    ctx.error = `SLOOP: invalid count ${count}`;
    return;
  }
  ctx.GS.loop = count;
}
function SMD(ctx) {
  ctx.GS.minimumDistance = ctx.stack[--ctx.stackTop];
}
function SCVTCI(ctx) {
  ctx.GS.controlValueCutIn = ctx.stack[--ctx.stackTop];
}
function SSWCI(ctx) {
  ctx.GS.singleWidthCutIn = ctx.stack[--ctx.stackTop];
}
function SSW(ctx) {
  ctx.GS.singleWidthValue = ctx.stack[--ctx.stackTop];
}
function SDB(ctx) {
  ctx.GS.deltaBase = ctx.stack[--ctx.stackTop];
}
function SDS(ctx) {
  ctx.GS.deltaShift = ctx.stack[--ctx.stackTop];
}
function RTG(ctx) {
  ctx.GS.roundState = 1 /* ToGrid */;
}
function RTHG(ctx) {
  ctx.GS.roundState = 0 /* ToHalfGrid */;
}
function RTDG(ctx) {
  ctx.GS.roundState = 2 /* ToDoubleGrid */;
}
function RDTG(ctx) {
  ctx.GS.roundState = 3 /* DownToGrid */;
}
function RUTG(ctx) {
  ctx.GS.roundState = 4 /* UpToGrid */;
}
function ROFF(ctx) {
  ctx.GS.roundState = 5 /* Off */;
}
function SROUND(ctx) {
  const selector = ctx.stack[--ctx.stackTop];
  parseSuperRound(selector, ctx.GS);
  ctx.GS.roundState = 6 /* Super */;
}
function S45ROUND(ctx) {
  const selector = ctx.stack[--ctx.stackTop];
  parseSuperRound(selector, ctx.GS);
  ctx.GS.roundState = 7 /* Super45 */;
}
function FLIPON(ctx) {
  ctx.GS.autoFlip = true;
}
function FLIPOFF(ctx) {
  ctx.GS.autoFlip = false;
}
function SCANCTRL(ctx) {
  ctx.GS.scanControl = ctx.stack[--ctx.stackTop];
}
function SCANTYPE(ctx) {
  ctx.GS.scanType = ctx.stack[--ctx.stackTop];
}
function INSTCTRL(ctx) {
  const selector = ctx.stack[--ctx.stackTop];
  const value = ctx.stack[--ctx.stackTop];
  if (selector === 1 || selector === 2) {
    if (value) {
      ctx.GS.instructControl |= selector;
    } else {
      ctx.GS.instructControl &= ~selector;
    }
  }
}
function GETINFO(ctx) {
  const selector = ctx.stack[--ctx.stackTop];
  let result = 0;
  if (selector & 1) {
    result |= 35;
  }
  if (selector & 32) {
    result |= 1 << 12;
  }
  ctx.stack[ctx.stackTop++] = result;
}
function RS(ctx) {
  const index = ctx.stack[--ctx.stackTop];
  if (index < 0 || index >= ctx.storageSize) {
    ctx.error = `RS: invalid index ${index}`;
    ctx.stack[ctx.stackTop++] = 0;
    return;
  }
  ctx.stack[ctx.stackTop++] = ctx.storage[index];
}
function WS(ctx) {
  const value = ctx.stack[--ctx.stackTop];
  const index = ctx.stack[--ctx.stackTop];
  if (index < 0 || index >= ctx.storageSize) {
    ctx.error = `WS: invalid index ${index}`;
    return;
  }
  ctx.storage[index] = value;
}
function RCVT(ctx) {
  const index = ctx.stack[--ctx.stackTop];
  if (index < 0 || index >= ctx.cvtSize) {
    ctx.error = `RCVT: invalid index ${index}`;
    ctx.stack[ctx.stackTop++] = 0;
    return;
  }
  ctx.stack[ctx.stackTop++] = ctx.cvt[index];
}
function WCVTP(ctx) {
  const value = ctx.stack[--ctx.stackTop];
  const index = ctx.stack[--ctx.stackTop];
  if (index < 0 || index >= ctx.cvtSize) {
    ctx.error = `WCVTP: invalid index ${index}`;
    return;
  }
  ctx.cvt[index] = value;
}
function WCVTF(ctx) {
  const value = ctx.stack[--ctx.stackTop];
  const index = ctx.stack[--ctx.stackTop];
  if (index < 0 || index >= ctx.cvtSize) {
    ctx.error = `WCVTF: invalid index ${index}`;
    return;
  }
  ctx.cvt[index] = Math.round(value * ctx.scale);
}
function UTP(ctx) {
  const pointIndex = ctx.stack[--ctx.stackTop];
  const zone = ctx.zp0;
  if (pointIndex < 0 || pointIndex >= zone.nPoints) {
    ctx.error = `UTP: invalid point ${pointIndex}`;
    return;
  }
  const fv = ctx.GS.freeVector;
  if (fv.y !== 0) {
    zone.tags[pointIndex] &= ~2 /* Y */;
  }
  if (fv.x !== 0) {
    zone.tags[pointIndex] &= ~1 /* X */;
  }
}

// src/hinting/instructions/points.ts
function project(ctx, p) {
  return p.x * ctx.GS.projVector.x + p.y * ctx.GS.projVector.y + 8192 >> 14;
}
function dualProject(ctx, p) {
  return p.x * ctx.GS.dualVector.x + p.y * ctx.GS.dualVector.y + 8192 >> 14;
}
function movePoint(ctx, zone, pointIndex, distance) {
  const pt = zone.cur[pointIndex];
  const fv = ctx.GS.freeVector;
  const pv = ctx.GS.projVector;
  const dot = fv.x * pv.x + fv.y * pv.y + 8192 >> 14;
  if (dot === 0) {
    return;
  }
  const dx = Math.round(distance * fv.x / dot);
  const dy = Math.round(distance * fv.y / dot);
  pt.x += dx;
  pt.y += dy;
}
function getCurrent(ctx, zone, pointIndex) {
  const pt = zone.cur[pointIndex];
  if (!pt) return 0;
  return project(ctx, pt);
}
function getOriginal(ctx, zone, pointIndex) {
  const pt = zone.org[pointIndex];
  if (!pt) return 0;
  return dualProject(ctx, pt);
}
function touchPoint(ctx, zone, pointIndex) {
  const fv = ctx.GS.freeVector;
  if (fv.y !== 0) {
    zone.tags[pointIndex] |= 2 /* Y */;
  }
  if (fv.x !== 0) {
    zone.tags[pointIndex] |= 1 /* X */;
  }
}
function MDAP(ctx, doRound) {
  const pointIndex = ctx.stack[--ctx.stackTop];
  const zone = ctx.zp0;
  if (pointIndex < 0 || pointIndex >= zone.nPoints) {
    ctx.error = `MDAP: invalid point ${pointIndex}`;
    return;
  }
  let distance = getCurrent(ctx, zone, pointIndex);
  if (doRound) {
    const comp = compensate(distance, ctx.GS);
    distance = round(distance, comp, ctx.GS) - distance;
  } else {
    distance = 0;
  }
  movePoint(ctx, zone, pointIndex, distance);
  touchPoint(ctx, zone, pointIndex);
  ctx.GS.rp0 = pointIndex;
  ctx.GS.rp1 = pointIndex;
}
function MIAP(ctx, doRound) {
  const cvtIndex = ctx.stack[--ctx.stackTop];
  const pointIndex = ctx.stack[--ctx.stackTop];
  const zone = ctx.zp0;
  if (pointIndex < 0 || pointIndex >= zone.nPoints) {
    ctx.error = `MIAP: invalid point ${pointIndex}`;
    return;
  }
  if (cvtIndex < 0 || cvtIndex >= ctx.cvtSize) {
    ctx.error = `MIAP: invalid CVT index ${cvtIndex}`;
    return;
  }
  let cvtDistance = ctx.cvt[cvtIndex];
  let currentPos = getCurrent(ctx, zone, pointIndex);
  if (doRound) {
    const diff = Math.abs(cvtDistance - currentPos);
    if (diff > ctx.GS.controlValueCutIn) {
      cvtDistance = currentPos;
    }
    const comp = compensate(cvtDistance, ctx.GS);
    cvtDistance = round(cvtDistance, comp, ctx.GS);
  }
  const distance = cvtDistance - currentPos;
  movePoint(ctx, zone, pointIndex, distance);
  touchPoint(ctx, zone, pointIndex);
  ctx.GS.rp0 = pointIndex;
  ctx.GS.rp1 = pointIndex;
}
function MDRP(ctx, flags) {
  const pointIndex = ctx.stack[--ctx.stackTop];
  const setRp0 = (flags & 16) !== 0;
  const keepMinDist = (flags & 8) !== 0;
  const doRound = (flags & 4) !== 0;
  const zp0 = ctx.zp0;
  const zp1 = ctx.zp1;
  if (pointIndex < 0 || pointIndex >= zp1.nPoints) {
    ctx.error = `MDRP: invalid point ${pointIndex}`;
    return;
  }
  const rp0 = ctx.GS.rp0;
  if (rp0 < 0 || rp0 >= zp0.nPoints) {
    ctx.error = `MDRP: invalid rp0 ${rp0}`;
    return;
  }
  let distance = getOriginal(ctx, zp1, pointIndex) - getOriginal(ctx, zp0, rp0);
  if (ctx.GS.autoFlip && distance < 0) {
    distance = -distance;
  }
  if (doRound) {
    const comp = compensate(distance, ctx.GS);
    distance = round(distance, comp, ctx.GS);
  }
  if (keepMinDist) {
    if (distance >= 0) {
      if (distance < ctx.GS.minimumDistance) {
        distance = ctx.GS.minimumDistance;
      }
    } else {
      if (distance > -ctx.GS.minimumDistance) {
        distance = -ctx.GS.minimumDistance;
      }
    }
  }
  const currentDist = getCurrent(ctx, zp1, pointIndex) - getCurrent(ctx, zp0, rp0);
  const move = distance - currentDist;
  movePoint(ctx, zp1, pointIndex, move);
  touchPoint(ctx, zp1, pointIndex);
  ctx.GS.rp1 = ctx.GS.rp0;
  ctx.GS.rp2 = pointIndex;
  if (setRp0) {
    ctx.GS.rp0 = pointIndex;
  }
}
function MIRP(ctx, flags) {
  const cvtIndex = ctx.stack[--ctx.stackTop];
  const pointIndex = ctx.stack[--ctx.stackTop];
  const setRp0 = (flags & 16) !== 0;
  const keepMinDist = (flags & 8) !== 0;
  const doRound = (flags & 4) !== 0;
  const zp0 = ctx.zp0;
  const zp1 = ctx.zp1;
  if (pointIndex < 0 || pointIndex >= zp1.nPoints) {
    ctx.error = `MIRP: invalid point ${pointIndex}`;
    return;
  }
  if (cvtIndex < 0 || cvtIndex >= ctx.cvtSize) {
    ctx.error = `MIRP: invalid CVT index ${cvtIndex}`;
    return;
  }
  const rp0 = ctx.GS.rp0;
  if (rp0 < 0 || rp0 >= zp0.nPoints) {
    ctx.error = `MIRP: invalid rp0 ${rp0}`;
    return;
  }
  let orgDist = getOriginal(ctx, zp1, pointIndex) - getOriginal(ctx, zp0, rp0);
  let cvtDist = ctx.cvt[cvtIndex];
  if (ctx.GS.autoFlip) {
    if (orgDist < 0 && cvtDist > 0 || orgDist > 0 && cvtDist < 0) {
      cvtDist = -cvtDist;
    }
  }
  const diff = Math.abs(orgDist - cvtDist);
  let distance;
  if (diff > ctx.GS.controlValueCutIn) {
    distance = orgDist;
  } else {
    distance = cvtDist;
  }
  if (doRound) {
    const comp = compensate(distance, ctx.GS);
    distance = round(distance, comp, ctx.GS);
  }
  if (keepMinDist) {
    if (orgDist >= 0) {
      if (distance < ctx.GS.minimumDistance) {
        distance = ctx.GS.minimumDistance;
      }
    } else {
      if (distance > -ctx.GS.minimumDistance) {
        distance = -ctx.GS.minimumDistance;
      }
    }
  }
  const currentDist = getCurrent(ctx, zp1, pointIndex) - getCurrent(ctx, zp0, rp0);
  const move = distance - currentDist;
  movePoint(ctx, zp1, pointIndex, move);
  touchPoint(ctx, zp1, pointIndex);
  ctx.GS.rp1 = ctx.GS.rp0;
  ctx.GS.rp2 = pointIndex;
  if (setRp0) {
    ctx.GS.rp0 = pointIndex;
  }
}
function SHP(ctx, useRp1) {
  const refZone = useRp1 ? ctx.zp0 : ctx.zp1;
  const refPoint = useRp1 ? ctx.GS.rp1 : ctx.GS.rp2;
  if (refPoint < 0 || refPoint >= refZone.nPoints) {
    ctx.error = `SHP: invalid reference point ${refPoint}`;
    return;
  }
  const orgRef = getOriginal(ctx, refZone, refPoint);
  const curRef = getCurrent(ctx, refZone, refPoint);
  const shift = curRef - orgRef;
  const zone = ctx.zp2;
  const count = ctx.GS.loop;
  ctx.GS.loop = 1;
  for (let i = 0; i < count; i++) {
    const pointIndex = ctx.stack[--ctx.stackTop];
    if (pointIndex < 0 || pointIndex >= zone.nPoints) {
      ctx.error = `SHP: invalid point ${pointIndex}`;
      return;
    }
    movePoint(ctx, zone, pointIndex, shift);
    touchPoint(ctx, zone, pointIndex);
  }
}
function SHC(ctx, useRp1) {
  const contourIndex = ctx.stack[--ctx.stackTop];
  const refZone = useRp1 ? ctx.zp0 : ctx.zp1;
  const refPoint = useRp1 ? ctx.GS.rp1 : ctx.GS.rp2;
  if (refPoint < 0 || refPoint >= refZone.nPoints) {
    ctx.error = `SHC: invalid reference point ${refPoint}`;
    return;
  }
  const zone = ctx.zp2;
  if (contourIndex < 0 || contourIndex >= zone.nContours) {
    ctx.error = `SHC: invalid contour ${contourIndex}`;
    return;
  }
  const orgRef = getOriginal(ctx, refZone, refPoint);
  const curRef = getCurrent(ctx, refZone, refPoint);
  const shift = curRef - orgRef;
  const start = contourIndex === 0 ? 0 : zone.contours[contourIndex - 1] + 1;
  const end = zone.contours[contourIndex];
  for (let i = start; i <= end; i++) {
    if (zone === refZone && i === refPoint) continue;
    movePoint(ctx, zone, i, shift);
    touchPoint(ctx, zone, i);
  }
}
function SHZ(ctx, useRp1) {
  const zoneIndex = ctx.stack[--ctx.stackTop];
  const refZone = useRp1 ? ctx.zp0 : ctx.zp1;
  const refPoint = useRp1 ? ctx.GS.rp1 : ctx.GS.rp2;
  if (refPoint < 0 || refPoint >= refZone.nPoints) {
    ctx.error = `SHZ: invalid reference point ${refPoint}`;
    return;
  }
  const zone = zoneIndex === 0 ? ctx.twilight : ctx.pts;
  const orgRef = getOriginal(ctx, refZone, refPoint);
  const curRef = getCurrent(ctx, refZone, refPoint);
  const shift = curRef - orgRef;
  for (let i = 0; i < zone.nPoints; i++) {
    if (zone === refZone && i === refPoint) continue;
    movePoint(ctx, zone, i, shift);
  }
}
function SHPIX(ctx) {
  const distance = ctx.stack[--ctx.stackTop];
  const zone = ctx.zp2;
  const count = ctx.GS.loop;
  ctx.GS.loop = 1;
  for (let i = 0; i < count; i++) {
    const pointIndex = ctx.stack[--ctx.stackTop];
    if (pointIndex < 0 || pointIndex >= zone.nPoints) {
      ctx.error = `SHPIX: invalid point ${pointIndex}`;
      return;
    }
    movePoint(ctx, zone, pointIndex, distance);
    touchPoint(ctx, zone, pointIndex);
  }
}
function IP(ctx) {
  const rp1 = ctx.GS.rp1;
  const rp2 = ctx.GS.rp2;
  if (rp1 < 0 || rp1 >= ctx.zp0.nPoints) {
    ctx.error = `IP: invalid rp1 ${rp1}`;
    return;
  }
  if (rp2 < 0 || rp2 >= ctx.zp1.nPoints) {
    ctx.error = `IP: invalid rp2 ${rp2}`;
    return;
  }
  const org1 = getOriginal(ctx, ctx.zp0, rp1);
  const org2 = getOriginal(ctx, ctx.zp1, rp2);
  const cur1 = getCurrent(ctx, ctx.zp0, rp1);
  const cur2 = getCurrent(ctx, ctx.zp1, rp2);
  const orgRange = org2 - org1;
  const curRange = cur2 - cur1;
  const zone = ctx.zp2;
  const count = ctx.GS.loop;
  ctx.GS.loop = 1;
  for (let i = 0; i < count; i++) {
    const pointIndex = ctx.stack[--ctx.stackTop];
    if (pointIndex < 0 || pointIndex >= zone.nPoints) {
      ctx.error = `IP: invalid point ${pointIndex}`;
      return;
    }
    const orgPt = getOriginal(ctx, zone, pointIndex);
    const curPt = getCurrent(ctx, zone, pointIndex);
    let newPos;
    if (orgRange !== 0) {
      const t = orgPt - org1;
      newPos = cur1 + Math.round(t * curRange / orgRange);
    } else {
      newPos = curPt + (cur1 - org1);
    }
    movePoint(ctx, zone, pointIndex, newPos - curPt);
    touchPoint(ctx, zone, pointIndex);
  }
}
function ALIGNRP(ctx) {
  const rp0 = ctx.GS.rp0;
  if (rp0 < 0 || rp0 >= ctx.zp0.nPoints) {
    ctx.error = `ALIGNRP: invalid rp0 ${rp0}`;
    return;
  }
  const refPos = getCurrent(ctx, ctx.zp0, rp0);
  const zone = ctx.zp1;
  const count = ctx.GS.loop;
  ctx.GS.loop = 1;
  for (let i = 0; i < count; i++) {
    const pointIndex = ctx.stack[--ctx.stackTop];
    if (pointIndex < 0 || pointIndex >= zone.nPoints) {
      ctx.error = `ALIGNRP: invalid point ${pointIndex}`;
      return;
    }
    const curPos = getCurrent(ctx, zone, pointIndex);
    const distance = refPos - curPos;
    movePoint(ctx, zone, pointIndex, distance);
    touchPoint(ctx, zone, pointIndex);
  }
}
function MSIRP(ctx, setRp0) {
  const distance = ctx.stack[--ctx.stackTop];
  const pointIndex = ctx.stack[--ctx.stackTop];
  const zp0 = ctx.zp0;
  const zp1 = ctx.zp1;
  if (pointIndex < 0 || pointIndex >= zp1.nPoints) {
    ctx.error = `MSIRP: invalid point ${pointIndex}`;
    return;
  }
  const rp0 = ctx.GS.rp0;
  if (rp0 < 0 || rp0 >= zp0.nPoints) {
    ctx.error = `MSIRP: invalid rp0 ${rp0}`;
    return;
  }
  const currentDist = getCurrent(ctx, zp1, pointIndex) - getCurrent(ctx, zp0, rp0);
  const move = distance - currentDist;
  movePoint(ctx, zp1, pointIndex, move);
  touchPoint(ctx, zp1, pointIndex);
  ctx.GS.rp1 = ctx.GS.rp0;
  ctx.GS.rp2 = pointIndex;
  if (setRp0) {
    ctx.GS.rp0 = pointIndex;
  }
}
function ISECT(ctx) {
  const b1 = ctx.stack[--ctx.stackTop];
  const b0 = ctx.stack[--ctx.stackTop];
  const a1 = ctx.stack[--ctx.stackTop];
  const a0 = ctx.stack[--ctx.stackTop];
  const point = ctx.stack[--ctx.stackTop];
  const zone0 = ctx.zp0;
  const zone1 = ctx.zp1;
  const zone2 = ctx.zp2;
  if (a0 < 0 || a0 >= zone0.nPoints || a1 < 0 || a1 >= zone0.nPoints) {
    ctx.error = `ISECT: invalid line A points`;
    return;
  }
  if (b0 < 0 || b0 >= zone1.nPoints || b1 < 0 || b1 >= zone1.nPoints) {
    ctx.error = `ISECT: invalid line B points`;
    return;
  }
  if (point < 0 || point >= zone2.nPoints) {
    ctx.error = `ISECT: invalid point ${point}`;
    return;
  }
  const pa0 = zone0.cur[a0];
  const pa1 = zone0.cur[a1];
  const pb0 = zone1.cur[b0];
  const pb1 = zone1.cur[b1];
  const dax = pa1.x - pa0.x;
  const day = pa1.y - pa0.y;
  const dbx = pb1.x - pb0.x;
  const dby = pb1.y - pb0.y;
  const denom = dax * dby - day * dbx;
  const pt = zone2.cur[point];
  if (denom === 0) {
    pt.x = pa0.x + pa1.x + pb0.x + pb1.x >> 2;
    pt.y = pa0.y + pa1.y + pb0.y + pb1.y >> 2;
  } else {
    const dx = pb0.x - pa0.x;
    const dy = pb0.y - pa0.y;
    const t = (dx * dby - dy * dbx) / denom;
    pt.x = Math.round(pa0.x + t * dax);
    pt.y = Math.round(pa0.y + t * day);
  }
  zone2.tags[point] |= 3 /* Both */;
}
function ALIGNPTS(ctx) {
  const p2 = ctx.stack[--ctx.stackTop];
  const p1 = ctx.stack[--ctx.stackTop];
  const zone1 = ctx.zp0;
  const zone2 = ctx.zp1;
  if (p1 < 0 || p1 >= zone1.nPoints) {
    ctx.error = `ALIGNPTS: invalid point ${p1}`;
    return;
  }
  if (p2 < 0 || p2 >= zone2.nPoints) {
    ctx.error = `ALIGNPTS: invalid point ${p2}`;
    return;
  }
  const pos1 = getCurrent(ctx, zone1, p1);
  const pos2 = getCurrent(ctx, zone2, p2);
  const mid = pos1 + pos2 >> 1;
  movePoint(ctx, zone1, p1, mid - pos1);
  movePoint(ctx, zone2, p2, mid - pos2);
  touchPoint(ctx, zone1, p1);
  touchPoint(ctx, zone2, p2);
}
function GC(ctx, useOriginal) {
  const pointIndex = ctx.stack[--ctx.stackTop];
  const zone = ctx.zp2;
  if (pointIndex < 0 || pointIndex >= zone.nPoints) {
    ctx.error = `GC: invalid point ${pointIndex}`;
    ctx.stack[ctx.stackTop++] = 0;
    return;
  }
  const coord = useOriginal ? getOriginal(ctx, zone, pointIndex) : getCurrent(ctx, zone, pointIndex);
  ctx.stack[ctx.stackTop++] = coord;
}
function SCFS(ctx) {
  const coord = ctx.stack[--ctx.stackTop];
  const pointIndex = ctx.stack[--ctx.stackTop];
  const zone = ctx.zp2;
  if (pointIndex < 0 || pointIndex >= zone.nPoints) {
    ctx.error = `SCFS: invalid point ${pointIndex}`;
    return;
  }
  const current = getCurrent(ctx, zone, pointIndex);
  movePoint(ctx, zone, pointIndex, coord - current);
  touchPoint(ctx, zone, pointIndex);
}
function MD(ctx, useOriginal) {
  const p2 = ctx.stack[--ctx.stackTop];
  const p1 = ctx.stack[--ctx.stackTop];
  const zone0 = ctx.zp0;
  const zone1 = ctx.zp1;
  if (p1 < 0 || p1 >= zone0.nPoints) {
    ctx.error = `MD: invalid point ${p1}`;
    ctx.stack[ctx.stackTop++] = 0;
    return;
  }
  if (p2 < 0 || p2 >= zone1.nPoints) {
    ctx.error = `MD: invalid point ${p2}`;
    ctx.stack[ctx.stackTop++] = 0;
    return;
  }
  let distance;
  if (useOriginal) {
    distance = getOriginal(ctx, zone1, p2) - getOriginal(ctx, zone0, p1);
  } else {
    distance = getCurrent(ctx, zone1, p2) - getCurrent(ctx, zone0, p1);
  }
  ctx.stack[ctx.stackTop++] = distance;
}
function MPPEM(ctx) {
  ctx.stack[ctx.stackTop++] = ctx.ppem;
}
function MPS(ctx) {
  ctx.stack[ctx.stackTop++] = ctx.pointSize;
}
function FLIPPT(ctx) {
  const zone = ctx.pts;
  const count = ctx.GS.loop;
  ctx.GS.loop = 1;
  for (let i = 0; i < count; i++) {
    const pointIndex = ctx.stack[--ctx.stackTop];
    if (pointIndex < 0 || pointIndex >= zone.nPoints) {
      ctx.error = `FLIPPT: invalid point ${pointIndex}`;
      return;
    }
    zone.tags[pointIndex] ^= 1;
  }
}
function FLIPRGON(ctx) {
  const endPoint = ctx.stack[--ctx.stackTop];
  const startPoint = ctx.stack[--ctx.stackTop];
  const zone = ctx.pts;
  if (startPoint < 0 || endPoint >= zone.nPoints || startPoint > endPoint) {
    ctx.error = `FLIPRGON: invalid range ${startPoint}-${endPoint}`;
    return;
  }
  for (let i = startPoint; i <= endPoint; i++) {
    zone.tags[i] |= 1;
  }
}
function FLIPRGOFF(ctx) {
  const endPoint = ctx.stack[--ctx.stackTop];
  const startPoint = ctx.stack[--ctx.stackTop];
  const zone = ctx.pts;
  if (startPoint < 0 || endPoint >= zone.nPoints || startPoint > endPoint) {
    ctx.error = `FLIPRGOFF: invalid range ${startPoint}-${endPoint}`;
    return;
  }
  for (let i = startPoint; i <= endPoint; i++) {
    zone.tags[i] &= ~1;
  }
}
function ROUND(ctx, _colorIndex) {
  const value = ctx.stack[--ctx.stackTop];
  const comp = compensate(value, ctx.GS);
  ctx.stack[ctx.stackTop++] = round(value, comp, ctx.GS);
}
function NROUND(ctx, _colorIndex) {
  const value = ctx.stack[--ctx.stackTop];
  const comp = compensate(value, ctx.GS);
  ctx.stack[ctx.stackTop++] = value + comp;
}

// src/hinting/instructions/interpolate.ts
function IUP_X(ctx) {
  interpolateUntouched(ctx, 1 /* X */, true);
}
function IUP_Y(ctx) {
  interpolateUntouched(ctx, 2 /* Y */, false);
}
function interpolateUntouched(ctx, touchFlag, isX) {
  const zone = ctx.pts;
  const nPoints = zone.nPoints;
  const nContours = zone.nContours;
  if (nPoints === 0 || nContours === 0) return;
  let contourStart = 0;
  for (let c = 0; c < nContours; c++) {
    const contourEnd = zone.contours[c];
    let firstTouched = -1;
    for (let i2 = contourStart; i2 <= contourEnd; i2++) {
      if (zone.tags[i2] & touchFlag) {
        firstTouched = i2;
        break;
      }
    }
    if (firstTouched < 0) {
      contourStart = contourEnd + 1;
      continue;
    }
    let prevTouched = firstTouched;
    let i = firstTouched + 1;
    let wrapped = false;
    while (true) {
      if (i > contourEnd) {
        if (wrapped) break;
        i = contourStart;
        wrapped = true;
      }
      if (i === firstTouched && wrapped) {
        if (prevTouched !== firstTouched) {
          interpolateRange(
            zone,
            prevTouched,
            firstTouched,
            contourStart,
            contourEnd,
            isX
          );
        }
        break;
      }
      if (zone.tags[i] & touchFlag) {
        if (prevTouched !== i) {
          interpolateRange(
            zone,
            prevTouched,
            i,
            contourStart,
            contourEnd,
            isX
          );
        }
        prevTouched = i;
      }
      i++;
    }
    contourStart = contourEnd + 1;
  }
}
function interpolateRange(zone, p1, p2, contourStart, contourEnd, isX) {
  const org1 = isX ? zone.org[p1].x : zone.org[p1].y;
  const org2 = isX ? zone.org[p2].x : zone.org[p2].y;
  const cur1 = isX ? zone.cur[p1].x : zone.cur[p1].y;
  const cur2 = isX ? zone.cur[p2].x : zone.cur[p2].y;
  let lo_org, hi_org;
  let lo_cur, hi_cur;
  if (org1 <= org2) {
    lo_org = org1;
    hi_org = org2;
    lo_cur = cur1;
    hi_cur = cur2;
  } else {
    lo_org = org2;
    hi_org = org1;
    lo_cur = cur2;
    hi_cur = cur1;
  }
  const orgRange = hi_org - lo_org;
  const curRange = hi_cur - lo_cur;
  let i = p1 + 1;
  if (i > contourEnd) i = contourStart;
  while (i !== p2) {
    const org = isX ? zone.org[i].x : zone.org[i].y;
    let newPos;
    if (org <= lo_org) {
      newPos = (isX ? zone.cur[i].x : zone.cur[i].y) + (lo_cur - lo_org);
    } else if (org >= hi_org) {
      newPos = (isX ? zone.cur[i].x : zone.cur[i].y) + (hi_cur - hi_org);
    } else {
      if (orgRange !== 0) {
        const t = org - lo_org;
        newPos = lo_cur + Math.round(t * curRange / orgRange);
      } else {
        newPos = lo_cur;
      }
    }
    if (isX) {
      zone.cur[i].x = newPos;
    } else {
      zone.cur[i].y = newPos;
    }
    i++;
    if (i > contourEnd) i = contourStart;
  }
}

// src/hinting/instructions/delta.ts
function DELTAP1(ctx) {
  deltaPoint(ctx, 0);
}
function DELTAP2(ctx) {
  deltaPoint(ctx, 16);
}
function DELTAP3(ctx) {
  deltaPoint(ctx, 32);
}
function deltaPoint(ctx, rangeOffset) {
  const count = ctx.stack[--ctx.stackTop];
  if (count < 0) {
    ctx.error = `DELTAP: invalid count ${count}`;
    return;
  }
  const zone = ctx.zp0;
  for (let i = 0; i < count; i++) {
    const argByte = ctx.stack[--ctx.stackTop];
    const pointIndex = ctx.stack[--ctx.stackTop];
    if (pointIndex < 0 || pointIndex >= zone.nPoints) {
      ctx.error = `DELTAP: invalid point ${pointIndex}`;
      return;
    }
    const ppemDelta = (argByte >> 4 & 15) + ctx.GS.deltaBase + rangeOffset;
    const magnitude = argByte & 15;
    if (ppemDelta !== ctx.ppem) {
      continue;
    }
    let delta;
    if (magnitude < 8) {
      delta = magnitude + 1 << 6 - ctx.GS.deltaShift;
    } else {
      delta = -(magnitude - 7 << 6 - ctx.GS.deltaShift);
    }
    movePoint(ctx, zone, pointIndex, delta);
    touchPoint(ctx, zone, pointIndex);
  }
}
function DELTAC1(ctx) {
  deltaCVT(ctx, 0);
}
function DELTAC2(ctx) {
  deltaCVT(ctx, 16);
}
function DELTAC3(ctx) {
  deltaCVT(ctx, 32);
}
function deltaCVT(ctx, rangeOffset) {
  const count = ctx.stack[--ctx.stackTop];
  if (count < 0) {
    ctx.error = `DELTAC: invalid count ${count}`;
    return;
  }
  for (let i = 0; i < count; i++) {
    const argByte = ctx.stack[--ctx.stackTop];
    const cvtIndex = ctx.stack[--ctx.stackTop];
    if (cvtIndex < 0 || cvtIndex >= ctx.cvtSize) {
      ctx.error = `DELTAC: invalid CVT index ${cvtIndex}`;
      return;
    }
    const ppemDelta = (argByte >> 4 & 15) + ctx.GS.deltaBase + rangeOffset;
    const magnitude = argByte & 15;
    if (ppemDelta !== ctx.ppem) {
      continue;
    }
    let delta;
    if (magnitude < 8) {
      delta = magnitude + 1 << 6 - ctx.GS.deltaShift;
    } else {
      delta = -(magnitude - 7 << 6 - ctx.GS.deltaShift);
    }
    ctx.cvt[cvtIndex] += delta;
  }
}

// src/hinting/interpreter.ts
function execute(ctx) {
  while (ctx.IP < ctx.codeSize && ctx.error === null) {
    if (++ctx.instructionCount > ctx.maxInstructions) {
      ctx.error = "Instruction limit exceeded (possible infinite loop)";
      return;
    }
    const opcode = ctx.code[ctx.IP++];
    ctx.opcode = opcode;
    executeOpcode(ctx, opcode);
  }
}
function executeOpcode(ctx, opcode) {
  if (opcode >= 176 && opcode <= 183) {
    PUSHB(ctx, opcode - 176 + 1);
    return;
  }
  if (opcode >= 184 && opcode <= 191) {
    PUSHW(ctx, opcode - 184 + 1);
    return;
  }
  if (opcode >= 192 && opcode <= 223) {
    MDRP(ctx, opcode & 31);
    return;
  }
  if (opcode >= 224 && opcode <= 255) {
    MIRP(ctx, opcode & 31);
    return;
  }
  switch (opcode) {
    // Vector setting
    case Opcode.SVTCA_Y:
      SVTCA(ctx, 0);
      break;
    case Opcode.SVTCA_X:
      SVTCA(ctx, 1);
      break;
    case Opcode.SPVTCA_Y:
      SPVTCA(ctx, 0);
      break;
    case Opcode.SPVTCA_X:
      SPVTCA(ctx, 1);
      break;
    case Opcode.SFVTCA_Y:
      SFVTCA(ctx, 0);
      break;
    case Opcode.SFVTCA_X:
      SFVTCA(ctx, 1);
      break;
    case Opcode.SPVTL_0:
      SPVTL(ctx, false);
      break;
    case Opcode.SPVTL_1:
      SPVTL(ctx, true);
      break;
    case Opcode.SFVTL_0:
      SFVTL(ctx, false);
      break;
    case Opcode.SFVTL_1:
      SFVTL(ctx, true);
      break;
    case Opcode.SDPVTL_0:
      SDPVTL(ctx, false);
      break;
    case Opcode.SDPVTL_1:
      SDPVTL(ctx, true);
      break;
    case Opcode.SPVFS:
      SPVFS(ctx);
      break;
    case Opcode.SFVFS:
      SFVFS(ctx);
      break;
    case Opcode.GPV:
      GPV(ctx);
      break;
    case Opcode.GFV:
      GFV(ctx);
      break;
    case Opcode.SFVTPV:
      SFVTPV(ctx);
      break;
    case Opcode.ISECT:
      ISECT(ctx);
      break;
    // Reference points
    case Opcode.SRP0:
      SRP0(ctx);
      break;
    case Opcode.SRP1:
      SRP1(ctx);
      break;
    case Opcode.SRP2:
      SRP2(ctx);
      break;
    // Zone pointers
    case Opcode.SZP0:
      SZP0(ctx);
      break;
    case Opcode.SZP1:
      SZP1(ctx);
      break;
    case Opcode.SZP2:
      SZP2(ctx);
      break;
    case Opcode.SZPS:
      SZPS(ctx);
      break;
    // Loop and other GS
    case Opcode.SLOOP:
      SLOOP(ctx);
      break;
    case Opcode.RTG:
      RTG(ctx);
      break;
    case Opcode.RTHG:
      RTHG(ctx);
      break;
    case Opcode.SMD:
      SMD(ctx);
      break;
    case Opcode.ELSE:
      ELSE(ctx);
      break;
    case Opcode.JMPR:
      JMPR(ctx);
      break;
    case Opcode.SCVTCI:
      SCVTCI(ctx);
      break;
    case Opcode.SSWCI:
      SSWCI(ctx);
      break;
    case Opcode.SSW:
      SSW(ctx);
      break;
    // Stack operations
    case Opcode.DUP:
      DUP(ctx);
      break;
    case Opcode.POP:
      POP(ctx);
      break;
    case Opcode.CLEAR:
      CLEAR(ctx);
      break;
    case Opcode.SWAP:
      SWAP(ctx);
      break;
    case Opcode.DEPTH:
      DEPTH(ctx);
      break;
    case Opcode.CINDEX:
      CINDEX(ctx);
      break;
    case Opcode.MINDEX:
      MINDEX(ctx);
      break;
    case Opcode.ROLL:
      ROLL(ctx);
      break;
    // Functions
    case Opcode.FDEF:
      FDEF(ctx);
      break;
    case Opcode.ENDF:
      ENDF(ctx);
      break;
    case Opcode.CALL:
      CALL(ctx);
      break;
    case Opcode.LOOPCALL:
      LOOPCALL(ctx);
      break;
    // Point movement
    case Opcode.MDAP_0:
      MDAP(ctx, false);
      break;
    case Opcode.MDAP_1:
      MDAP(ctx, true);
      break;
    case Opcode.IUP_Y:
      IUP_Y(ctx);
      break;
    case Opcode.IUP_X:
      IUP_X(ctx);
      break;
    case Opcode.SHP_0:
      SHP(ctx, false);
      break;
    case Opcode.SHP_1:
      SHP(ctx, true);
      break;
    case Opcode.SHC_0:
      SHC(ctx, false);
      break;
    case Opcode.SHC_1:
      SHC(ctx, true);
      break;
    case Opcode.SHZ_0:
      SHZ(ctx, false);
      break;
    case Opcode.SHZ_1:
      SHZ(ctx, true);
      break;
    case Opcode.SHPIX:
      SHPIX(ctx);
      break;
    case Opcode.IP:
      IP(ctx);
      break;
    case Opcode.MSIRP_0:
      MSIRP(ctx, false);
      break;
    case Opcode.MSIRP_1:
      MSIRP(ctx, true);
      break;
    case Opcode.ALIGNRP:
      ALIGNRP(ctx);
      break;
    case Opcode.ALIGNPTS:
      ALIGNPTS(ctx);
      break;
    case Opcode.UTP:
      UTP(ctx);
      break;
    case Opcode.RTDG:
      RTDG(ctx);
      break;
    case Opcode.MIAP_0:
      MIAP(ctx, false);
      break;
    case Opcode.MIAP_1:
      MIAP(ctx, true);
      break;
    // Push instructions
    case Opcode.NPUSHB:
      NPUSHB(ctx);
      break;
    case Opcode.NPUSHW:
      NPUSHW(ctx);
      break;
    // Storage
    case Opcode.WS:
      WS(ctx);
      break;
    case Opcode.RS:
      RS(ctx);
      break;
    // CVT
    case Opcode.WCVTP:
      WCVTP(ctx);
      break;
    case Opcode.RCVT:
      RCVT(ctx);
      break;
    // Point operations
    case Opcode.GC_0:
      GC(ctx, false);
      break;
    case Opcode.GC_1:
      GC(ctx, true);
      break;
    case Opcode.SCFS:
      SCFS(ctx);
      break;
    case Opcode.MD_0:
      MD(ctx, false);
      break;
    case Opcode.MD_1:
      MD(ctx, true);
      break;
    case Opcode.MPPEM:
      MPPEM(ctx);
      break;
    case Opcode.MPS:
      MPS(ctx);
      break;
    case Opcode.FLIPON:
      FLIPON(ctx);
      break;
    case Opcode.FLIPOFF:
      FLIPOFF(ctx);
      break;
    case Opcode.DEBUG:
      break;
    // Comparison
    case Opcode.LT:
      LT(ctx);
      break;
    case Opcode.LTEQ:
      LTEQ(ctx);
      break;
    case Opcode.GT:
      GT(ctx);
      break;
    case Opcode.GTEQ:
      GTEQ(ctx);
      break;
    case Opcode.EQ:
      EQ(ctx);
      break;
    case Opcode.NEQ:
      NEQ(ctx);
      break;
    case Opcode.ODD:
      ODD(ctx);
      break;
    case Opcode.EVEN:
      EVEN(ctx);
      break;
    // Control flow
    case Opcode.IF:
      IF(ctx);
      break;
    case Opcode.EIF:
      EIF(ctx);
      break;
    // Logic
    case Opcode.AND:
      AND(ctx);
      break;
    case Opcode.OR:
      OR(ctx);
      break;
    case Opcode.NOT:
      NOT(ctx);
      break;
    // Delta instructions
    case Opcode.DELTAP1:
      DELTAP1(ctx);
      break;
    case Opcode.SDB:
      SDB(ctx);
      break;
    case Opcode.SDS:
      SDS(ctx);
      break;
    // Arithmetic
    case Opcode.ADD:
      ADD(ctx);
      break;
    case Opcode.SUB:
      SUB(ctx);
      break;
    case Opcode.DIV:
      DIV(ctx);
      break;
    case Opcode.MUL:
      MUL(ctx);
      break;
    case Opcode.ABS:
      ABS(ctx);
      break;
    case Opcode.NEG:
      NEG(ctx);
      break;
    case Opcode.FLOOR:
      FLOOR(ctx);
      break;
    case Opcode.CEILING:
      CEILING(ctx);
      break;
    // Rounding
    case Opcode.ROUND_0:
      ROUND(ctx, 0);
      break;
    case Opcode.ROUND_1:
      ROUND(ctx, 1);
      break;
    case Opcode.ROUND_2:
      ROUND(ctx, 2);
      break;
    case Opcode.ROUND_3:
      ROUND(ctx, 3);
      break;
    case Opcode.NROUND_0:
      NROUND(ctx, 0);
      break;
    case Opcode.NROUND_1:
      NROUND(ctx, 1);
      break;
    case Opcode.NROUND_2:
      NROUND(ctx, 2);
      break;
    case Opcode.NROUND_3:
      NROUND(ctx, 3);
      break;
    // CVT font units
    case Opcode.WCVTF:
      WCVTF(ctx);
      break;
    // Delta
    case Opcode.DELTAP2:
      DELTAP2(ctx);
      break;
    case Opcode.DELTAP3:
      DELTAP3(ctx);
      break;
    case Opcode.DELTAC1:
      DELTAC1(ctx);
      break;
    case Opcode.DELTAC2:
      DELTAC2(ctx);
      break;
    case Opcode.DELTAC3:
      DELTAC3(ctx);
      break;
    // Super rounding
    case Opcode.SROUND:
      SROUND(ctx);
      break;
    case Opcode.S45ROUND:
      S45ROUND(ctx);
      break;
    // Jump
    case Opcode.JROT:
      JROT(ctx);
      break;
    case Opcode.JROF:
      JROF(ctx);
      break;
    // Rounding modes
    case Opcode.ROFF:
      ROFF(ctx);
      break;
    case Opcode.RUTG:
      RUTG(ctx);
      break;
    case Opcode.RDTG:
      RDTG(ctx);
      break;
    // Other
    case Opcode.SANGW:
      ctx.stackTop--;
      break;
    case Opcode.AA:
      ctx.stackTop--;
      break;
    // Flip
    case Opcode.FLIPPT:
      FLIPPT(ctx);
      break;
    case Opcode.FLIPRGON:
      FLIPRGON(ctx);
      break;
    case Opcode.FLIPRGOFF:
      FLIPRGOFF(ctx);
      break;
    // Scan
    case Opcode.SCANCTRL:
      SCANCTRL(ctx);
      break;
    case Opcode.SCANTYPE:
      SCANTYPE(ctx);
      break;
    // Min/Max
    case Opcode.MAX:
      MAX(ctx);
      break;
    case Opcode.MIN:
      MIN(ctx);
      break;
    // Getinfo and instctrl
    case Opcode.GETINFO:
      GETINFO(ctx);
      break;
    case Opcode.IDEF:
      IDEF(ctx);
      break;
    case Opcode.INSTCTRL:
      INSTCTRL(ctx);
      break;
    default:
      if (opcode < ctx.maxIDefs && ctx.IDefs[opcode]?.active) {
        const def = ctx.IDefs[opcode];
        if (ctx.callStackTop >= ctx.maxCallStack) {
          ctx.error = "IDEF call: call stack overflow";
          return;
        }
        const call = ctx.callStack[ctx.callStackTop++];
        call.callerIP = ctx.IP;
        call.callerRange = ctx.currentRange;
        call.def = {
          id: opcode,
          start: def.start,
          end: def.end,
          active: true,
          range: def.range
        };
        call.count = 1;
        ctx.currentRange = def.range;
        const range = ctx.codeRanges.get(ctx.currentRange);
        if (range) {
          ctx.code = range.code;
          ctx.codeSize = range.size;
        }
        ctx.IP = def.start;
      } else {
        ctx.error = `Unknown opcode 0x${opcode.toString(16)}`;
      }
  }
}
function setCodeRange(ctx, range, code) {
  ctx.codeRanges.set(range, { code, size: code.length });
}
function runProgram(ctx, range) {
  const codeRange = ctx.codeRanges.get(range);
  if (!codeRange) {
    return;
  }
  ctx.currentRange = range;
  ctx.code = codeRange.code;
  ctx.codeSize = codeRange.size;
  ctx.IP = 0;
  ctx.instructionCount = 0;
  execute(ctx);
}
function runFontProgram(ctx) {
  runProgram(ctx, 1 /* Font */);
}
function runCVTProgram(ctx) {
  ctx.GS = { ...ctx.defaultGS };
  runProgram(ctx, 2 /* CVT */);
  ctx.defaultGS = { ...ctx.GS };
}
function runGlyphProgram(ctx, instructions) {
  ctx.GS = { ...ctx.defaultGS };
  ctx.zp0 = ctx.pts;
  ctx.zp1 = ctx.pts;
  ctx.zp2 = ctx.pts;
  setCodeRange(ctx, 3 /* Glyph */, instructions);
  runProgram(ctx, 3 /* Glyph */);
}

// src/hinting/programs.ts
function createHintingEngine(unitsPerEM, maxStack = 256, maxStorage = 64, maxFDefs = 64, maxTwilightPoints = 16, cvtValues) {
  const ctx = createExecContext(
    maxStack,
    maxStorage,
    maxFDefs,
    maxFDefs,
    // maxIDefs
    32,
    // maxCallStack
    maxTwilightPoints
  );
  if (cvtValues) {
    ctx.cvt = new Int32Array(cvtValues);
    ctx.cvtSize = cvtValues.length;
  }
  return {
    ctx,
    unitsPerEM,
    fpgmExecuted: false,
    currentPpem: 0
  };
}
function loadFontProgram(engine, fpgm) {
  setCodeRange(engine.ctx, 1 /* Font */, fpgm);
}
function loadCVTProgram(engine, prep) {
  setCodeRange(engine.ctx, 2 /* CVT */, prep);
}
function executeFontProgram(engine) {
  if (engine.fpgmExecuted) return null;
  engine.ctx.error = null;
  runFontProgram(engine.ctx);
  engine.fpgmExecuted = true;
  return engine.ctx.error;
}
function setSize(engine, ppem, pointSize) {
  if (!engine.fpgmExecuted) {
    const fpgmError = executeFontProgram(engine);
    if (fpgmError) return fpgmError;
  }
  if (engine.currentPpem === ppem) return null;
  engine.ctx.scale = ppem * 64 / engine.unitsPerEM;
  engine.ctx.ppem = ppem;
  engine.ctx.pointSize = pointSize;
  scaleCVT(engine.ctx);
  engine.ctx.error = null;
  runCVTProgram(engine.ctx);
  engine.currentPpem = ppem;
  return engine.ctx.error;
}
function scaleCVT(ctx) {
  for (let i = 0; i < ctx.cvtSize; i++) {
    ctx.cvt[i] = Math.round(ctx.cvt[i] * ctx.scale);
  }
}
function hintGlyph(engine, outline) {
  const ctx = engine.ctx;
  const nPoints = outline.xCoords.length;
  const nContours = outline.contourEnds.length;
  const totalPoints = nPoints + 4;
  const zone = createGlyphZone(totalPoints, nContours);
  zone.nPoints = totalPoints;
  zone.nContours = nContours;
  for (let i = 0; i < nPoints; i++) {
    const x = Math.round(outline.xCoords[i] * ctx.scale);
    const y = Math.round(outline.yCoords[i] * ctx.scale);
    zone.org[i].x = x;
    zone.org[i].y = y;
    zone.cur[i].x = x;
    zone.cur[i].y = y;
    zone.orus[i].x = outline.xCoords[i];
    zone.orus[i].y = outline.yCoords[i];
    zone.tags[i] = outline.flags[i];
  }
  let xMin = Infinity;
  for (let i = 0; i < nPoints; i++) {
    if (outline.xCoords[i] < xMin) xMin = outline.xCoords[i];
  }
  if (!isFinite(xMin)) xMin = 0;
  const lsb = outline.lsb ?? 0;
  const advW = outline.advanceWidth ?? 0;
  const pp0x = Math.round((xMin - lsb) * ctx.scale);
  zone.org[nPoints].x = pp0x;
  zone.org[nPoints].y = 0;
  zone.cur[nPoints].x = pp0x;
  zone.cur[nPoints].y = 0;
  zone.orus[nPoints].x = xMin - lsb;
  zone.orus[nPoints].y = 0;
  zone.tags[nPoints] = 0;
  const pp1x = Math.round((xMin - lsb + advW) * ctx.scale);
  zone.org[nPoints + 1].x = pp1x;
  zone.org[nPoints + 1].y = 0;
  zone.cur[nPoints + 1].x = pp1x;
  zone.cur[nPoints + 1].y = 0;
  zone.orus[nPoints + 1].x = xMin - lsb + advW;
  zone.orus[nPoints + 1].y = 0;
  zone.tags[nPoints + 1] = 0;
  for (let i = nPoints + 2; i < totalPoints; i++) {
    zone.org[i].x = 0;
    zone.org[i].y = 0;
    zone.cur[i].x = 0;
    zone.cur[i].y = 0;
    zone.orus[i].x = 0;
    zone.orus[i].y = 0;
    zone.tags[i] = 0;
  }
  for (let i = 0; i < nContours; i++) {
    zone.contours[i] = outline.contourEnds[i];
  }
  ctx.pts = zone;
  ctx.zp0 = zone;
  ctx.zp1 = zone;
  ctx.zp2 = zone;
  ctx.twilight.nPoints = ctx.twilight.org.length;
  for (let i = 0; i < ctx.twilight.nPoints; i++) {
    ctx.twilight.org[i].x = 0;
    ctx.twilight.org[i].y = 0;
    ctx.twilight.cur[i].x = 0;
    ctx.twilight.cur[i].y = 0;
    ctx.twilight.tags[i] = 0;
  }
  ctx.error = null;
  if (outline.instructions.length > 0) {
    runGlyphProgram(ctx, outline.instructions);
  }
  const xCoords = new Array(nPoints);
  const yCoords = new Array(nPoints);
  for (let i = 0; i < nPoints; i++) {
    xCoords[i] = zone.cur[i].x;
    yCoords[i] = zone.cur[i].y;
  }
  return {
    xCoords,
    yCoords,
    flags: outline.flags,
    contourEnds: outline.contourEnds,
    error: ctx.error
  };
}

// src/raster/rasterize.ts
var hintingEngineCache = /* @__PURE__ */ new WeakMap();
function getHintingEngine(font) {
  if (!font.isTrueType || !font.hasHinting) return null;
  let engine = hintingEngineCache.get(font);
  if (engine) return engine;
  const cvt = font.cvtTable;
  const cvtValues = cvt ? new Int32Array(cvt.values) : void 0;
  engine = createHintingEngine(
    font.unitsPerEm,
    font.maxp.maxStackElements || 256,
    font.maxp.maxStorage || 64,
    font.maxp.maxFunctionDefs || 64,
    font.maxp.maxTwilightPoints || 16,
    cvtValues
  );
  const fpgm = font.fpgm;
  if (fpgm) loadFontProgram(engine, fpgm.instructions);
  const prep = font.prep;
  if (prep) loadCVTProgram(engine, prep.instructions);
  hintingEngineCache.set(font, engine);
  return engine;
}
function glyphToOutline(font, glyphId) {
  const glyph = font.getGlyph(glyphId);
  if (!glyph || glyph.type === "empty") return null;
  const xCoords = [];
  const yCoords = [];
  const flags = [];
  const contourEnds = [];
  const advanceWidth = font.advanceWidth(glyphId);
  const lsb = font.leftSideBearing(glyphId);
  if (glyph.type === "simple") {
    let pointIndex = 0;
    for (const contour of glyph.contours) {
      for (const point of contour) {
        xCoords.push(point.x);
        yCoords.push(point.y);
        flags.push(point.onCurve ? 1 : 0);
        pointIndex++;
      }
      contourEnds.push(pointIndex - 1);
    }
    return {
      xCoords,
      yCoords,
      flags: new Uint8Array(flags),
      contourEnds,
      instructions: glyph.instructions,
      lsb,
      advanceWidth
    };
  } else {
    for (const component of glyph.components) {
      const compGlyph = font.getGlyph(component.glyphId);
      if (!compGlyph || compGlyph.type !== "simple") continue;
      const [a, b, c, d] = component.transform;
      const ox = component.arg1, oy = component.arg2;
      let pointOffset = xCoords.length;
      for (const contour of compGlyph.contours) {
        for (const point of contour) {
          xCoords.push(point.x * a + point.y * c + ox);
          yCoords.push(point.x * b + point.y * d + oy);
          flags.push(point.onCurve ? 1 : 0);
          pointOffset++;
        }
        contourEnds.push(pointOffset - 1);
      }
    }
    if (xCoords.length === 0) return null;
    return {
      xCoords,
      yCoords,
      flags: new Uint8Array(flags),
      contourEnds,
      instructions: glyph.instructions,
      lsb,
      advanceWidth
    };
  }
}
function decomposeHintedGlyph(raster, hinted, offsetX, offsetY) {
  const { xCoords, yCoords, flags, contourEnds } = hinted;
  let contourIdx = 0, contourStart = 0;
  for (let i = 0; i < xCoords.length; i++) {
    const isEnd = i === contourEnds[contourIdx];
    const x = (xCoords[i] << 2 | 0) + (offsetX << 8);
    const y = (-yCoords[i] << 2 | 0) + (offsetY << 8);
    const onCurve = (flags[i] & 1) !== 0;
    if (i === contourStart) {
      raster.moveTo(x, y);
    } else if (onCurve) {
      raster.lineTo(x, y);
    } else {
      const nextIdx = isEnd ? contourStart : i + 1;
      const nx = (xCoords[nextIdx] << 2 | 0) + (offsetX << 8);
      const ny = (-yCoords[nextIdx] << 2 | 0) + (offsetY << 8);
      const nextOn = (flags[nextIdx] & 1) !== 0;
      if (nextOn) {
        raster.conicTo(x, y, nx, ny);
        if (!isEnd) i++;
      } else {
        raster.conicTo(x, y, x + nx >> 1, y + ny >> 1);
      }
    }
    if (isEnd) {
      const sx = (xCoords[contourStart] << 2 | 0) + (offsetX << 8);
      const sy = (-yCoords[contourStart] << 2 | 0) + (offsetY << 8);
      if (onCurve && i !== contourStart) raster.lineTo(sx, sy);
      contourIdx++;
      contourStart = i + 1;
    }
  }
}
var BAND_PROCESSING_THRESHOLD = 256;
function rasterizePath(path, options) {
  const {
    width,
    height,
    scale,
    offsetX = 0,
    offsetY = 0,
    pixelMode = 1 /* Gray */,
    fillRule = 0 /* NonZero */,
    flipY = true
  } = options;
  const bitmap = createBitmap(width, height, pixelMode);
  const raster = new GrayRaster();
  raster.setClip(0, 0, width, height);
  if (height > BAND_PROCESSING_THRESHOLD) {
    const decomposeFn = () => decomposePath(raster, path, scale, offsetX, offsetY, flipY);
    raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: height }, fillRule);
  } else {
    raster.setBandBounds(0, height);
    raster.reset();
    decomposePath(raster, path, scale, offsetX, offsetY, flipY);
    raster.sweep(bitmap, fillRule);
  }
  return bitmap;
}
function rasterizeGlyph(font, glyphId, fontSize, options) {
  const padding = options?.padding ?? 1;
  const pixelMode = options?.pixelMode ?? 1 /* Gray */;
  const useHinting = options?.hinting ?? false;
  if (useHinting && font.hasHinting) {
    const result = rasterizeHintedGlyph(font, glyphId, fontSize, padding, pixelMode);
    if (result) return result;
  }
  const path = getGlyphPath(font, glyphId);
  if (!path) return null;
  const scale = fontSize / font.unitsPerEm;
  const bounds = getPathBounds(path, scale, true);
  if (!bounds) {
    return {
      bitmap: createBitmap(1, 1, pixelMode),
      bearingX: 0,
      bearingY: 0
    };
  }
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;
  if (width <= 0 || height <= 0) {
    return {
      bitmap: createBitmap(1, 1, pixelMode),
      bearingX: 0,
      bearingY: 0
    };
  }
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;
  const bitmap = rasterizePath(path, {
    width,
    height,
    scale,
    offsetX,
    offsetY,
    pixelMode,
    flipY: true
  });
  return {
    bitmap,
    bearingX: bounds.minX - padding,
    bearingY: -(bounds.minY - padding)
  };
}
function rasterizeHintedGlyph(font, glyphId, fontSize, padding, pixelMode) {
  const engine = getHintingEngine(font);
  if (!engine) return null;
  const outline = glyphToOutline(font, glyphId);
  if (!outline) return null;
  const ppem = Math.round(fontSize);
  const error = setSize(engine, ppem, ppem);
  if (error) return null;
  const hinted = hintGlyph(engine, outline);
  if (hinted.error || hinted.xCoords.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < hinted.xCoords.length; i++) {
    const x = hinted.xCoords[i] / 64;
    const y = hinted.yCoords[i] / 64;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!isFinite(minX)) {
    return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
  }
  const bMinX = Math.floor(minX), bMinY = Math.floor(minY);
  const bMaxX = Math.ceil(maxX), bMaxY = Math.ceil(maxY);
  const width = bMaxX - bMinX + padding * 2;
  const height = bMaxY - bMinY + padding * 2;
  if (width <= 0 || height <= 0) {
    return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
  }
  const bitmap = createBitmap(width, height, pixelMode);
  const raster = new GrayRaster();
  raster.setClip(0, 0, width, height);
  raster.reset();
  const offsetX = -bMinX + padding;
  const offsetY = height - 1 + bMinY - padding;
  decomposeHintedGlyph(raster, hinted, offsetX, offsetY);
  raster.sweep(bitmap, 0 /* NonZero */);
  return {
    bitmap,
    bearingX: bMinX - padding,
    bearingY: bMaxY + padding
  };
}
function rasterizeText(font, text, fontSize, options) {
  const scale = fontSize / font.unitsPerEm;
  const padding = options?.padding ?? 2;
  const pixelMode = options?.pixelMode ?? 1 /* Gray */;
  const glyphs = [];
  let totalAdvance = 0;
  let maxAscent = 0;
  let maxDescent = 0;
  for (const char of text) {
    const codepoint = char.codePointAt(0);
    if (codepoint === void 0) continue;
    const glyphId = font.glyphId(codepoint);
    if (glyphId === void 0) continue;
    const advance = font.advanceWidth(glyphId) * scale;
    const path = getGlyphPath(font, glyphId);
    if (path?.bounds) {
      maxAscent = Math.max(maxAscent, -path.bounds.yMin * scale);
      maxDescent = Math.max(maxDescent, path.bounds.yMax * scale);
    }
    glyphs.push({ glyphId, advance });
    totalAdvance += advance;
  }
  if (glyphs.length === 0) return null;
  const width = Math.ceil(totalAdvance) + padding * 2;
  const height = Math.ceil(maxAscent + maxDescent) + padding * 2;
  const bitmap = createBitmap(width, height, pixelMode);
  const raster = new GrayRaster();
  raster.setClip(0, 0, width, height);
  let x = padding;
  const baseline = maxDescent + padding;
  for (const { glyphId, advance } of glyphs) {
    const path = getGlyphPath(font, glyphId);
    if (path) {
      raster.reset();
      decomposePath(raster, path, scale, x, baseline, true);
      raster.sweep(bitmap);
    }
    x += advance;
  }
  return bitmap;
}
function bitmapToRGBA(bitmap) {
  const isLCD = bitmap.pixelMode === 2 /* LCD */;
  const rgba = new Uint8Array(bitmap.width * bitmap.rows * 4);
  for (let y = 0; y < bitmap.rows; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const dstIdx = (y * bitmap.width + x) * 4;
      if (bitmap.pixelMode === 1 /* Gray */) {
        const srcIdx = y * bitmap.pitch + x;
        const alpha = bitmap.buffer[srcIdx] ?? 0;
        rgba[dstIdx] = 255 - alpha;
        rgba[dstIdx + 1] = 255 - alpha;
        rgba[dstIdx + 2] = 255 - alpha;
        rgba[dstIdx + 3] = 255;
      } else if (bitmap.pixelMode === 0 /* Mono */) {
        const byteIdx = y * bitmap.pitch + (x >> 3);
        const bitIdx = 7 - (x & 7);
        const alpha = (bitmap.buffer[byteIdx] ?? 0) >> bitIdx & 1 ? 255 : 0;
        rgba[dstIdx] = 255 - alpha;
        rgba[dstIdx + 1] = 255 - alpha;
        rgba[dstIdx + 2] = 255 - alpha;
        rgba[dstIdx + 3] = 255;
      } else if (isLCD) {
        const srcIdx = y * bitmap.pitch + x * 3;
        const r = bitmap.buffer[srcIdx] ?? 0;
        const g = bitmap.buffer[srcIdx + 1] ?? 0;
        const b = bitmap.buffer[srcIdx + 2] ?? 0;
        rgba[dstIdx] = 255 - r;
        rgba[dstIdx + 1] = 255 - g;
        rgba[dstIdx + 2] = 255 - b;
        rgba[dstIdx + 3] = 255;
      } else {
        const srcIdx = y * bitmap.pitch + x;
        const alpha = bitmap.buffer[srcIdx] ?? 0;
        rgba[dstIdx] = 255 - alpha;
        rgba[dstIdx + 1] = 255 - alpha;
        rgba[dstIdx + 2] = 255 - alpha;
        rgba[dstIdx + 3] = 255;
      }
    }
  }
  return rgba;
}
function bitmapToGray(bitmap) {
  if (bitmap.pixelMode === 1 /* Gray */ && bitmap.pitch === bitmap.width) {
    return bitmap.buffer;
  }
  const gray = new Uint8Array(bitmap.width * bitmap.rows);
  for (let y = 0; y < bitmap.rows; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const dstIdx = y * bitmap.width + x;
      if (bitmap.pixelMode === 1 /* Gray */) {
        gray[dstIdx] = bitmap.buffer[y * bitmap.pitch + x] ?? 0;
      } else if (bitmap.pixelMode === 0 /* Mono */) {
        const byteIdx = y * bitmap.pitch + (x >> 3);
        const bitIdx = 7 - (x & 7);
        gray[dstIdx] = (bitmap.buffer[byteIdx] ?? 0) >> bitIdx & 1 ? 255 : 0;
      }
    }
  }
  return gray;
}
export {
  AxisValueFlags,
  BidiType,
  BreakAction,
  BreakOpportunity,
  BufferFlags,
  CaseSensitiveLayoutSetting,
  CbdtImageFormat,
  CharacterShapeSetting,
  ClusterLevel,
  CompositeMode,
  ContextualAlternativesSetting,
  DiacriticsSetting,
  Direction,
  Extend,
  Face,
  FeatureFlags,
  FeatureTags,
  FeatureType,
  FillRule,
  Font,
  FractionsSetting,
  GlyphBuffer,
  GlyphClass,
  GraphemeBreakProperty,
  JustifyMode,
  LigatureSetting,
  LineBreakClass,
  LowerCaseSetting,
  MorxSubtableType,
  MvarTags,
  NormalizationMode,
  NumberCaseSetting,
  NumberSpacingSetting,
  PaintFormat,
  PaletteType,
  PixelMode,
  Reader,
  SbixGraphicType,
  Script,
  SmartSwashSetting,
  StylisticAlternativesSetting,
  Tags,
  UnicodeBuffer,
  UpperCaseSetting,
  VerticalPositionSetting,
  WordBreakProperty,
  aatToOpenTypeTag,
  allSmallCaps,
  analyzeLineBreaks,
  analyzeLineBreaksForGlyphs,
  analyzeLineBreaksFromCodepoints,
  applyAvar,
  applyAvarMapping,
  applyDeviceAdjustment,
  applyFallbackKerning,
  applyFallbackMarkPositioning,
  applyFeatureVariations,
  applyMirroring,
  applyNonContextual,
  applyTracking,
  bitmapToGray,
  bitmapToRGBA,
  breakIntoLines,
  calculateLineWidth,
  calculateTupleScalar,
  canBreakAt,
  capitalSpacing,
  capsToSmallCaps,
  caseSensitiveForms,
  characterVariant,
  characterVariants,
  clearBitmap,
  colorToHex,
  colorToRgba,
  combineFeatures,
  contextualAlternates,
  contourToPath,
  countGraphemes,
  createBitmap,
  createFace,
  createPath2D,
  createShapePlan,
  decompose,
  detectDirection,
  detectScript,
  discretionaryLigatures,
  evaluateConditionSet,
  executeCff2CharString,
  executeCffCharString,
  feature,
  features,
  findAxisValueByNameId,
  findGraphemeBoundaries,
  findMatchingFeatureVariation,
  findNextBreak,
  findWordBoundaries,
  fractions,
  fullWidthForms,
  getAdvanceHeightDelta,
  getAdvanceWidthDelta,
  getAllBreakOpportunities,
  getAllFeatures,
  getAvailablePpemSizes,
  getAxisIndex,
  getAxisRecord,
  getAxisValueNumber,
  getAxisValuesForAxis,
  getBitmapGlyph,
  getBsbDelta,
  getCapHeightDelta,
  getCffGlyphWidth,
  getCharType2 as getCharType,
  getClipBox,
  getColor,
  getColorBitmapSizes,
  getColorLayers,
  getColorPaint,
  getColorVariationDelta,
  getCombiningClass,
  getDefaultSetting,
  getDeviceDelta,
  getEmbeddings,
  getFeature2 as getFeature,
  getGlyphDelta,
  getGlyphLocation,
  getGlyphPath,
  getGlyphPathWithVariation,
  getGraphemeBreakProperty,
  getHAscenderDelta,
  getHDescenderDelta,
  getKernValue,
  getKerxValue,
  getLayerPaint,
  getLineBreakClass,
  getMetricDelta,
  getMirror,
  getOrCreateShapePlan,
  getGlyphBitmap as getSbixGlyphBitmap,
  getScript,
  getScriptDirection,
  getScriptRuns,
  getScriptTag,
  getScripts,
  getSettingByValue,
  getStrikeForPpem,
  getSubstitutedLookups,
  getSvgDocument,
  getSvgGlyphIds,
  getTextWidth,
  getTrackingValue,
  getTsbDelta,
  getVertOriginY,
  getVerticalMetrics,
  getVisualOrder,
  getVorgDelta,
  getWordBreakProperty,
  getXHeightDelta,
  glyphBufferToShapedGlyphs,
  glyphToSVG,
  halfWidthForms,
  hasColorBitmap,
  hasColorGlyph,
  hasGlyphBitmap,
  hasGlyphOutline,
  hasSettingValue,
  hasSvgGlyph,
  hasVertOriginY,
  historicalLigatures,
  isColrV1,
  isComplexScript,
  isElidableAxisValue,
  isExclusiveFeature,
  isLTR,
  isOlderSiblingFont,
  isRTL,
  isScript,
  isVariationIndexTable,
  jis2004Forms,
  jis78Forms,
  jis83Forms,
  jis90Forms,
  justify,
  justifyParagraph,
  kerning,
  liningFigures,
  matchAxisValue,
  mustBreakAt,
  normalize,
  normalizeAxisValue,
  oldstyleFigures,
  openTypeTagToAat,
  ordinals,
  parseColr,
  parseCpal,
  parseFeat,
  pathToCanvas,
  pathToSVG,
  petiteCaps,
  processBidi,
  processContextual,
  processInsertion,
  processLigature,
  processRearrangement,
  proportionalFigures,
  proportionalWidthForms,
  quarterWidthForms,
  rasterizeGlyph,
  rasterizePath,
  rasterizeText,
  renderShapedText,
  renderShapedTextWithVariation,
  reorderGlyphs,
  reorderMarks,
  resolveDupeGlyph,
  ruby,
  scientificInferiors,
  shape,
  shapedTextToSVG,
  shapedTextToSVGWithVariation,
  simplifiedForms,
  slashedZero,
  smallCaps,
  splitGraphemes,
  splitWords,
  standardLigatures,
  stylisticAlternates,
  stylisticSet,
  stylisticSets,
  subscript,
  superscript,
  swash,
  tabularFigures,
  tag,
  tagToString,
  thirdWidthForms,
  traditionalForms,
  verticalAlternatesRotation,
  verticalForms,
  verticalKanaAlternates,
  verticalLayoutFeatures
};
//# sourceMappingURL=text-shaper.js.map
