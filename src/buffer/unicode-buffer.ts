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
		let cluster = startCluster;
		for (const char of text) {
			const codepoint = char.codePointAt(0)!;
			this.codepoints.push(codepoint);
			this.clusters.push(cluster);
			cluster++;
		}
		return this;
	}

	/** Add codepoints directly */
	addCodepoints(codepoints: number[], startCluster = 0): this {
		let cluster = startCluster;
		for (const cp of codepoints) {
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
		for (const char of text) {
			this.preContext.push(char.codePointAt(0)!);
		}
		return this;
	}

	/** Set post-context string */
	setPostContext(text: string): this {
		this.postContext = [];
		for (const char of text) {
			this.postContext.push(char.codePointAt(0)!);
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
			cluster: this.clusters[i]!,
			mask: 0,
			codepoint,
		}));
	}
}
