// Core types
export * from "./types.ts";

// Font parsing
export { Font, type FontLoadOptions } from "./font/font.ts";
export { Reader } from "./font/binary/reader.ts";

// Tables
export type { HeadTable } from "./font/tables/head.ts";
export type { MaxpTable } from "./font/tables/maxp.ts";
export type { HheaTable } from "./font/tables/hhea.ts";
export type { HmtxTable } from "./font/tables/hmtx.ts";
export type { CmapTable } from "./font/tables/cmap.ts";
export type { GdefTable } from "./font/tables/gdef.ts";
export type { GsubTable } from "./font/tables/gsub.ts";
export type { GposTable } from "./font/tables/gpos.ts";

// Layout structures
export type { Coverage } from "./layout/structures/coverage.ts";
export type { ClassDef } from "./layout/structures/class-def.ts";

// Buffers
export { UnicodeBuffer } from "./buffer/unicode-buffer.ts";
export { GlyphBuffer } from "./buffer/glyph-buffer.ts";
