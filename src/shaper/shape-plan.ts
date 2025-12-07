import type { Font } from "../font/font.ts";
import type { AnyGposLookup, GposTable } from "../font/tables/gpos.ts";
import type { AnyGsubLookup, GsubTable } from "../font/tables/gsub.ts";
import {
	type FeatureVariations,
	findMatchingFeatureVariation,
} from "../layout/structures/feature-variations.ts";
import {
	findLangSys,
	findScript,
	getFeature,
} from "../layout/structures/layout-common.ts";
import type { Tag, uint16 } from "../types.ts";
import { tag, tagToString } from "../types.ts";

/** Shape plan cache for reusing computed plans */
const shapePlanCache = new WeakMap<Font, Map<string, ShapePlan>>();

/** Maximum cache size per font */
const MAX_CACHE_SIZE = 64;

/** Feature with optional value */
export interface ShapeFeature {
	tag: Tag;
	enabled: boolean;
}

/** Lookup entry with index */
export interface LookupEntry<T> {
	index: number;
	lookup: T;
}

/** Collected lookups for shaping */
export interface ShapePlan {
	script: Tag;
	language: Tag | null;
	direction: "ltr" | "rtl";

	/** GSUB lookups to apply, in order */
	gsubLookups: LookupEntry<AnyGsubLookup>[];

	/** GPOS lookups to apply, in order */
	gposLookups: LookupEntry<AnyGposLookup>[];

	/** Fast O(1) lookup by index for nested GSUB lookups */
	gsubLookupMap: Map<number, LookupEntry<AnyGsubLookup>>;

	/** Fast O(1) lookup by index for nested GPOS lookups */
	gposLookupMap: Map<number, LookupEntry<AnyGposLookup>>;
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
	axisCoords: number[] | null,
): string {
	// Fast path for common case: no user features, no axis coords
	if (userFeatures.length === 0 && axisCoords === null) {
		return language === null
			? `${script}||${direction}||`
			: `${script}|${language}|${direction}||`;
	}

	const featuresKey = userFeatures
		.map((f) => `${tagToString(f.tag)}:${f.enabled ? "1" : "0"}`)
		.sort()
		.join(",");
	const coordsKey = axisCoords
		? axisCoords.map((c) => c.toFixed(4)).join(",")
		: "";
	return `${script}|${language || ""}|${direction}|${featuresKey}|${coordsKey}`;
}

/** Get or create a cached shape plan */
export function getOrCreateShapePlan(
	font: Font,
	script: string,
	language: string | null,
	direction: "ltr" | "rtl",
	userFeatures: ShapeFeature[] = [],
	axisCoords: number[] | null = null,
): ShapePlan {
	const cacheKey = getCacheKey(
		script,
		language,
		direction,
		userFeatures,
		axisCoords,
	);

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
	const plan = createShapePlanInternal(
		font,
		script,
		language,
		direction,
		userFeatures,
		axisCoords,
	);

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
	axisCoords: number[] | null = null,
): ShapePlan {
	// Use caching by default
	return getOrCreateShapePlan(
		font,
		script,
		language,
		direction,
		userFeatures,
		axisCoords,
	);
}

/** Create a shape plan without caching */
function createShapePlanInternal(
	font: Font,
	script: string,
	language: string | null,
	direction: "ltr" | "rtl",
	userFeatures: ShapeFeature[] = [],
	axisCoords: number[] | null = null,
): ShapePlan {
	const scriptTag = tag(script.padEnd(4, " "));
	const languageTag = language ? tag(language.padEnd(4, " ")) : null;

	// Collect enabled features
	const enabledFeatures = new Set<Tag>();

	// Add default features
	for (let i = 0; i < DEFAULT_GSUB_FEATURES.length; i++) {
		enabledFeatures.add(tag(DEFAULT_GSUB_FEATURES[i]!));
	}
	for (let i = 0; i < DEFAULT_GPOS_FEATURES.length; i++) {
		enabledFeatures.add(tag(DEFAULT_GPOS_FEATURES[i]!));
	}

	// Apply user features
	for (let i = 0; i < userFeatures.length; i++) {
		const feat = userFeatures[i]!;
		if (feat.enabled) {
			enabledFeatures.add(feat.tag);
		} else {
			enabledFeatures.delete(feat.tag);
		}
	}

	// Collect GSUB lookups (with feature variations support)
	const gsubLookups = collectLookups(
		font.gsub,
		scriptTag,
		languageTag,
		enabledFeatures,
		axisCoords,
	) as LookupEntry<AnyGsubLookup>[];

	// Collect GPOS lookups (with feature variations support)
	const gposLookups = collectLookups(
		font.gpos,
		scriptTag,
		languageTag,
		enabledFeatures,
		axisCoords,
	) as LookupEntry<AnyGposLookup>[];

	// Build lookup index maps for O(1) nested lookup access
	const gsubLookupMap = new Map<number, LookupEntry<AnyGsubLookup>>();
	for (let i = 0; i < gsubLookups.length; i++) {
		const entry = gsubLookups[i]!;
		gsubLookupMap.set(entry.index, entry);
	}

	const gposLookupMap = new Map<number, LookupEntry<AnyGposLookup>>();
	for (let i = 0; i < gposLookups.length; i++) {
		const entry = gposLookups[i]!;
		gposLookupMap.set(entry.index, entry);
	}

	return {
		script: scriptTag,
		language: languageTag,
		direction,
		gsubLookups,
		gposLookups,
		gsubLookupMap,
		gposLookupMap,
	};
}

function collectLookups<T extends { lookups: unknown[] }>(
	table: T | null,
	scriptTag: Tag,
	languageTag: Tag | null,
	enabledFeatures: Set<Tag>,
	axisCoords: number[] | null,
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

	// Get feature variations substitutions if applicable
	const featureVariations = (gsub as { featureVariations?: FeatureVariations })
		.featureVariations;
	const matchingVariation =
		featureVariations && axisCoords
			? findMatchingFeatureVariation(featureVariations, axisCoords)
			: null;

	// Build a map of feature indices to their substituted lookup lists
	const featureSubstitutions = new Map<uint16, uint16[]>();
	if (matchingVariation) {
		const subs = matchingVariation.featureTableSubstitution.substitutions;
		for (let i = 0; i < subs.length; i++) {
			const subst = subs[i]!;
			featureSubstitutions.set(
				subst.featureIndex,
				subst.alternateFeature.lookupListIndices,
			);
		}
	}

	// Add required feature
	if (langSys.requiredFeatureIndex !== 0xffff) {
		const feature = getFeature(gsub.featureList, langSys.requiredFeatureIndex);
		if (feature) {
			// Check if this feature has a substitution
			const substitutedLookups = featureSubstitutions.get(
				langSys.requiredFeatureIndex,
			);
			const lookups = substitutedLookups ?? feature.feature.lookupListIndices;
			for (let i = 0; i < lookups.length; i++) {
				lookupIndices.add(lookups[i]!);
			}
		}
	}

	// Add enabled features
	const featureIndices = langSys.featureIndices;
	for (let f = 0; f < featureIndices.length; f++) {
		const featureIndex = featureIndices[f]!;
		const featureRecord = getFeature(gsub.featureList, featureIndex);
		if (!featureRecord) continue;

		if (enabledFeatures.has(featureRecord.featureTag)) {
			// Check if this feature has a substitution
			const substitutedLookups = featureSubstitutions.get(featureIndex);
			const lookups =
				substitutedLookups ?? featureRecord.feature.lookupListIndices;
			for (let i = 0; i < lookups.length; i++) {
				lookupIndices.add(lookups[i]!);
			}
		}
	}

	// Convert to sorted array with lookup objects
	const result: Array<{ index: number; lookup: unknown }> = [];
	const sortedIndices = [...lookupIndices].sort((a, b) => a - b);

	for (let i = 0; i < sortedIndices.length; i++) {
		const index = sortedIndices[i]!;
		const lookup = gsub.lookups[index];
		if (lookup) {
			result.push({ index, lookup });
		}
	}

	return result;
}
