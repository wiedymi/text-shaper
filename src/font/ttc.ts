import { Reader } from "./binary/reader.ts";

const TTCF_MAGIC = 0x74746366; // "ttcf"

export interface TtcHeader {
	version: number;
	numFonts: number;
	offsets: number[];
	dsigTag?: number;
	dsigOffset?: number;
	dsigLength?: number;
}

export function isTtc(buffer: ArrayBuffer): boolean {
	const view = new DataView(buffer);
	return view.getUint32(0, false) === TTCF_MAGIC;
}

export function parseTtcHeader(buffer: ArrayBuffer): TtcHeader {
	const reader = new Reader(buffer);
	const tag = reader.uint32();
	if (tag !== TTCF_MAGIC) {
		throw new Error("Invalid TTC header");
	}

	const version = reader.uint32();
	const numFonts = reader.uint32();
	if (numFonts <= 0) {
		throw new Error("Invalid TTC font count");
	}

	const maxFonts = Math.floor((buffer.byteLength - 12) / 4);
	if (numFonts > maxFonts) {
		throw new Error("Invalid TTC font count");
	}

	const offsets: number[] = new Array(numFonts);
	for (let i = 0; i < numFonts; i++) {
		offsets[i] = reader.uint32();
	}

	if (version === 0x00020000 && reader.remaining >= 12) {
		const dsigTag = reader.uint32();
		const dsigOffset = reader.uint32();
		const dsigLength = reader.uint32();
		return { version, numFonts, offsets, dsigTag, dsigOffset, dsigLength };
	}

	return { version, numFonts, offsets };
}
