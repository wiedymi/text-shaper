import {
	BufferFlags,
	ClusterLevel,
	Direction,
	type GlyphInfo,
} from "../types.ts";

/**
 * Input buffer for text to be shaped.
 * Holds Unicode codepoints with associated properties.
 */
export class UnicodeBuffer {
	private _direction: Direction = Direction.LTR;
	private _script: string = "Zyyy"; // Common/Unknown
	private _language: string | null = null;
	private _clusterLevel: ClusterLevel = ClusterLevel.MonotoneGraphemes;
	private _flags: BufferFlags = BufferFlags.Default;

	/** Codepoints to shape */
	readonly codepoints: number[] = [];
	/** Cluster indices (maps each codepoint to its cluster) */
	readonly clusters: number[] = [];

	/** Pre-context (text before the buffer for contextual shaping) */
	preContext: number[] = [];
	/** Post-context (text after the buffer for contextual shaping) */
	postContext: number[] = [];

	/** Add a string to the buffer */
	addStr(text: string, startCluster = 0): this {
		const len = text.length;
		if (len === 0) return this;

		const baseLen = this.codepoints.length;

		// For appending to existing data, use push (rare case)
		if (baseLen > 0) {
			return this._addStrAppend(text, startCluster);
		}

		// Fast path: fresh buffer - use new Array for speed
		const codepoints = new Array<number>(len);
		const clusters = new Array<number>(len);

		let cluster = startCluster;
		let writeIdx = 0;

		for (let i = 0; i < len; i++) {
			const code = text.charCodeAt(i);
			// Check for high surrogate (emoji, etc.)
			if (code >= 0xd800 && code <= 0xdbff && i + 1 < len) {
				const low = text.charCodeAt(i + 1);
				if (low >= 0xdc00 && low <= 0xdfff) {
					// Decode surrogate pair
					codepoints[writeIdx] =
						((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
					clusters[writeIdx] = cluster;
					writeIdx++;
					cluster++;
					i++; // Skip low surrogate
					continue;
				}
			}
			codepoints[writeIdx] = code;
			clusters[writeIdx] = cluster;
			writeIdx++;
			cluster++;
		}

		// Trim if surrogates reduced length
		if (writeIdx < len) {
			codepoints.length = writeIdx;
			clusters.length = writeIdx;
		}

		// Replace arrays (cast to bypass readonly)
		(this as { codepoints: number[] }).codepoints = codepoints;
		(this as { clusters: number[] }).clusters = clusters;

		return this;
	}

	/** Append to existing buffer (slower path) */
	private _addStrAppend(text: string, startCluster: number): this {
		let cluster = startCluster;
		const len = text.length;
		for (let i = 0; i < len; i++) {
			const code = text.charCodeAt(i);
			if (code >= 0xd800 && code <= 0xdbff && i + 1 < len) {
				const low = text.charCodeAt(i + 1);
				if (low >= 0xdc00 && low <= 0xdfff) {
					this.codepoints.push(
						((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000,
					);
					this.clusters.push(cluster);
					cluster++;
					i++;
					continue;
				}
			}
			this.codepoints.push(code);
			this.clusters.push(cluster);
			cluster++;
		}
		return this;
	}

	/** Add codepoints directly */
	addCodepoints(codepoints: number[], startCluster = 0): this {
		let cluster = startCluster;
		for (let i = 0; i < codepoints.length; i++) {
			const cp = codepoints[i]!;
			this.codepoints.push(cp);
			this.clusters.push(cluster);
			cluster++;
		}
		return this;
	}

	/** Add a single codepoint */
	addCodepoint(codepoint: number, cluster?: number): this {
		this.codepoints.push(codepoint);
		this.clusters.push(cluster ?? this.codepoints.length - 1);
		return this;
	}

	/** Set text direction */
	setDirection(direction: Direction): this {
		this._direction = direction;
		return this;
	}

	/** Set script (ISO 15924 tag, e.g., 'Latn', 'Arab') */
	setScript(script: string): this {
		this._script = script;
		return this;
	}

	/** Set language (BCP 47 tag, e.g., 'en', 'ar') */
	setLanguage(language: string | null): this {
		this._language = language;
		return this;
	}

	/** Set cluster level */
	setClusterLevel(level: ClusterLevel): this {
		this._clusterLevel = level;
		return this;
	}

	/** Set buffer flags */
	setFlags(flags: BufferFlags): this {
		this._flags = flags;
		return this;
	}

	/** Set pre-context string */
	setPreContext(text: string): this {
		this.preContext = [];
		const len = text.length;
		for (let i = 0; i < len; i++) {
			const code = text.charCodeAt(i);
			if (code >= 0xd800 && code <= 0xdbff && i + 1 < len) {
				const low = text.charCodeAt(i + 1);
				if (low >= 0xdc00 && low <= 0xdfff) {
					this.preContext.push(
						((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000,
					);
					i++;
					continue;
				}
			}
			this.preContext.push(code);
		}
		return this;
	}

	/** Set post-context string */
	setPostContext(text: string): this {
		this.postContext = [];
		const len = text.length;
		for (let i = 0; i < len; i++) {
			const code = text.charCodeAt(i);
			if (code >= 0xd800 && code <= 0xdbff && i + 1 < len) {
				const low = text.charCodeAt(i + 1);
				if (low >= 0xdc00 && low <= 0xdfff) {
					this.postContext.push(
						((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000,
					);
					i++;
					continue;
				}
			}
			this.postContext.push(code);
		}
		return this;
	}

	/** Clear the buffer */
	clear(): this {
		this.codepoints.length = 0;
		this.clusters.length = 0;
		this.preContext.length = 0;
		this.postContext.length = 0;
		return this;
	}

	/** Number of codepoints */
	get length(): number {
		return this.codepoints.length;
	}

	get direction(): Direction {
		return this._direction;
	}

	get script(): string {
		return this._script;
	}

	get language(): string | null {
		return this._language;
	}

	get clusterLevel(): ClusterLevel {
		return this._clusterLevel;
	}

	get flags(): BufferFlags {
		return this._flags;
	}

	/** Convert to initial glyph infos (codepoint = glyphId initially) */
	toGlyphInfos(): GlyphInfo[] {
		return this.codepoints.map((codepoint, i) => ({
			glyphId: 0, // Will be set during shaping
			cluster: this.clusters[i] ?? 0,
			mask: 0,
			codepoint,
		}));
	}
}
