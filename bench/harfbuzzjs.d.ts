declare module "harfbuzzjs" {
	const hb: {
		createBlob(data: ArrayBuffer | Uint8Array): HarfBuzzBlob;
		createFace(blob: HarfBuzzBlob, faceIndex: number): HarfBuzzFace;
		createFont(face: HarfBuzzFace): HarfBuzzFont;
		createBuffer(): HarfBuzzBuffer;
		shape(font: HarfBuzzFont, buffer: HarfBuzzBuffer): void;
	};

	interface HarfBuzzBlob {
		destroy(): void;
	}

	interface HarfBuzzFace {
		destroy(): void;
	}

	interface HarfBuzzFont {
		glyphToPath(glyphId: number): string;
		destroy(): void;
	}

	interface HarfBuzzBuffer {
		addText(text: string): void;
		guessSegmentProperties(): void;
		json(): Array<{ g: number; cl: number; ax: number; ay: number; dx: number; dy: number }>;
		destroy(): void;
	}

	export default hb;
}
