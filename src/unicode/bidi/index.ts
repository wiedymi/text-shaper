/**
 * Bidi algorithm implementation
 * Port of bidi-js
 */

export {
	closingToOpeningBracket,
	getCanonicalBracket,
	openingToClosingBracket,
} from "./brackets.ts";

export {
	BN_LIKE_TYPES,
	getBidiCharType,
	getBidiCharTypeName,
	ISOLATE_INIT_TYPES,
	NEUTRAL_ISOLATE_TYPES,
	STRONG_TYPES,
	TRAILING_TYPES,
	TYPES,
	TYPES_TO_NAMES,
} from "./char-types.ts";

export {
	type EmbeddingLevelsResult,
	getEmbeddingLevels,
} from "./embedding-levels.ts";

export {
	getMirroredCharacter,
	getMirroredCharactersMap,
} from "./mirroring.ts";

export {
	getReorderedIndices,
	getReorderedString,
	getReorderSegments,
} from "./reordering.ts";
