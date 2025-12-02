import type { Tag } from "../types.ts";
import { tag, tagToString } from "../types.ts";
import type { Font } from "../font/font.ts";
import type { GsubTable, AnyGsubLookup } from "../font/tables/gsub.ts";
import type { GposTable, AnyGposLookup } from "../font/tables/gpos.ts";
import {
	findScript,
	findLangSys,
	getFeature,
} from "../layout/structures/layout-common.ts";

/** Shape plan cache for reusing computed plans */
const shapePlanCache = new WeakMap<Font, Map<string, ShapePlan>>();

/** Maximum cache size per font */
const MAX_CACHE_SIZE = 64;

/** Feature with optional value */
export interface ShapeFeature {
	tag: Tag;
	enabled: boolean;
}

/** Collected lookups for shaping */
export interface ShapePlan {
	script: Tag;
	language: Tag | null;
	direction: "ltr" | "rtl";

	/** GSUB lookups to apply, in order */
	gsubLookups: Array<{ index: number; lookup: AnyGsubLookup }>;

	/** GPOS lookups to apply, in order */
	gposLookups: Array<{ index: number; lookup: AnyGposLookup }>;
}

/** Default GSUB features (always enabled) */
const DEFAULT_GSUB_FEATURES = [
	"ccmp", // Glyph composition/decomposition
	"locl", // Localized forms
	"rlig", // Required ligatures
	"rclt", // Required contextual alternates
	"calt", // Contextual alternates
	"liga", // Standard ligatures
];

/** Default GPOS features (always enabled) */
const DEFAULT_GPOS_FEATURES = [
	"kern", // Kerning
	"mark", // Mark positioning
	"mkmk", // Mark-to-mark positioning
];

/** Generate cache key for shape plan */
function getCacheKey(
	script: string,
	language: string | null,
	direction: "ltr" | "rtl",
	userFeatures: ShapeFeature[],
): string {
	const featuresKey = userFeatures
		.map(f => `${tagToString(f.tag)}:${f.enabled ? "1" : "0"}`)
		.sort()
		.join(",");
	return `${script}|${language || ""}|${direction}|${featuresKey}`;
}

/** Get or create a cached shape plan */
export function getOrCreateShapePlan(
	font: Font,
	script: string,
	language: string | null,
	direction: "ltr" | "rtl",
	userFeatures: ShapeFeature[] = [],
): ShapePlan {
	const cacheKey = getCacheKey(script, language, direction, userFeatures);

	// Get or create font's cache map
	let fontCache = shapePlanCache.get(font);
	if (!fontCache) {
		fontCache = new Map();
		shapePlanCache.set(font, fontCache);
	}

	// Check cache
	const cached = fontCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	// Create new plan
	const plan = createShapePlanInternal(font, script, language, direction, userFeatures);

	// Evict if cache is too large
	if (fontCache.size >= MAX_CACHE_SIZE) {
		const firstKey = fontCache.keys().next().value;
		if (firstKey !== undefined) {
			fontCache.delete(firstKey);
		}
	}

	fontCache.set(cacheKey, plan);
	return plan;
}

/** Create a shape plan for the given font and settings */
export function createShapePlan(
	font: Font,
	script: string,
	language: string | null,
	direction: "ltr" | "rtl",
	userFeatures: ShapeFeature[] = [],
): ShapePlan {
	// Use caching by default
	return getOrCreateShapePlan(font, script, language, direction, userFeatures);
}

/** Create a shape plan without caching */
function createShapePlanInternal(
	font: Font,
	script: string,
	language: string | null,
	direction: "ltr" | "rtl",
	userFeatures: ShapeFeature[] = [],
): ShapePlan {
	const scriptTag = tag(script.padEnd(4, " "));
	const languageTag = language ? tag(language.padEnd(4, " ")) : null;

	// Collect enabled features
	const enabledFeatures = new Set<Tag>();

	// Add default features
	for (const feat of DEFAULT_GSUB_FEATURES) {
		enabledFeatures.add(tag(feat));
	}
	for (const feat of DEFAULT_GPOS_FEATURES) {
		enabledFeatures.add(tag(feat));
	}

	// Apply user features
	for (const feat of userFeatures) {
		if (feat.enabled) {
			enabledFeatures.add(feat.tag);
		} else {
			enabledFeatures.delete(feat.tag);
		}
	}

	// Collect GSUB lookups
	const gsubLookups = collectLookups(
		font.gsub,
		scriptTag,
		languageTag,
		enabledFeatures,
	);

	// Collect GPOS lookups
	const gposLookups = collectLookups(
		font.gpos,
		scriptTag,
		languageTag,
		enabledFeatures,
	);

	return {
		script: scriptTag,
		language: languageTag,
		direction,
		gsubLookups: gsubLookups as Array<{ index: number; lookup: AnyGsubLookup }>,
		gposLookups: gposLookups as Array<{ index: number; lookup: AnyGposLookup }>,
	};
}

function collectLookups<T extends { lookups: unknown[] }>(
	table: T | null,
	scriptTag: Tag,
	languageTag: Tag | null,
	enabledFeatures: Set<Tag>,
): Array<{ index: number; lookup: unknown }> {
	if (!table) return [];

	const gsub = table as unknown as GsubTable | GposTable;
	const lookupIndices = new Set<number>();

	// Find script
	let script = findScript(gsub.scriptList, scriptTag);
	if (!script) {
		// Try DFLT script
		script = findScript(gsub.scriptList, tag("DFLT"));
	}
	if (!script) {
		// Try latn as fallback
		script = findScript(gsub.scriptList, tag("latn"));
	}
	if (!script) return [];

	// Find language system
	const langSys = findLangSys(script, languageTag);
	if (!langSys) return [];

	// Add required feature
	if (langSys.requiredFeatureIndex !== 0xffff) {
		const feature = getFeature(gsub.featureList, langSys.requiredFeatureIndex);
		if (feature) {
			for (const lookupIndex of feature.feature.lookupListIndices) {
				lookupIndices.add(lookupIndex);
			}
		}
	}

	// Add enabled features
	for (const featureIndex of langSys.featureIndices) {
		const featureRecord = getFeature(gsub.featureList, featureIndex);
		if (!featureRecord) continue;

		if (enabledFeatures.has(featureRecord.featureTag)) {
			for (const lookupIndex of featureRecord.feature.lookupListIndices) {
				lookupIndices.add(lookupIndex);
			}
		}
	}

	// Convert to sorted array with lookup objects
	const result: Array<{ index: number; lookup: unknown }> = [];
	const sortedIndices = Array.from(lookupIndices).sort((a, b) => a - b);

	for (const index of sortedIndices) {
		const lookup = gsub.lookups[index];
		if (lookup) {
			result.push({ index, lookup });
		}
	}

	return result;
}
