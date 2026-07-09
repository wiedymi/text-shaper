// Optional WASM(+SIMD) fast path for the FreeType-style gray fill
// scan-conversion (renderLine + cell accumulate + single-band sweep).
//
// The pure-TS GrayRaster in ../gray-raster.ts stays the default/baseline. This
// module is used ONLY when: WebAssembly is present, the module compiles, and the
// compiled kernel is proven byte-identical to the JS scalar sweep over a
// self-verification corpus at init. Any failure leaves the JS path in place.
// The .wasm is base64-embedded (no runtime fetch, CSP-safe) and instantiated
// per module/worker.
//
// Kernel: freestanding wasm32 + SIMD128 (see fill.c / build.sh). It reproduces
// GrayRaster.renderLine + renderScanline + CellBuffer find/create/accumulate +
// sweep() for PixelMode.Gray exactly (i64 division intermediates, i32 cell
// storage with Int32Array wrap, `>> 9` on ToInt32 values, FreeType coverage +
// fill-rule math). The bezier subdivision (subdivConic/subdivCubic) stays in JS
// and is unchanged; only the post-flatten polyline is shipped to wasm.

import { GrayRaster } from "../gray-raster.ts";
import { createBitmap, FillRule, PixelMode } from "../types.ts";
import { FILL_WASM_BASE64 } from "./wasm-bytes.ts";

/** Cell pool size (must match cell.ts DEFAULT_POOL_SIZE). */
const POOL_SIZE = 16384;

type Status = "uninit" | "ready" | "disabled";

let status: Status = "uninit";
let enabled = false; // only true once compiled + self-verified
let forceDisabled = false; // test/perf override

let memory: WebAssembly.Memory | null = null;
let heapBase = 0;
let fillFn: ((...a: number[]) => number) | null = null;
let u8view: Uint8Array | null = null;
let i32view: Int32Array | null = null;

// WebAssembly.Memory is grow-only. Very large transformed drawings can require
// a one-off scan-conversion workspace hundreds of MiB wide; decline those and
// use the byte-identical scalar GrayRaster path instead of pinning that memory
// for the lifetime of the worker/page realm.
const MAX_FILL_WASM_WORK_BYTES = 64 * 1024 * 1024;

export function isFillWasmEnabled(): boolean {
	return enabled && !forceDisabled;
}
export function setFillWasmEnabled(v: boolean): void {
	forceDisabled = !v;
}
export function fillWasmStatus(): {
	status: Status;
	enabled: boolean;
	forceDisabled: boolean;
} {
	return { status, enabled, forceDisabled };
}

function b64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64);
	const n = bin.length;
	const out = new Uint8Array(n);
	for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function refreshViews(): void {
	if (!memory) return;
	u8view = new Uint8Array(memory.buffer);
	i32view = new Int32Array(memory.buffer);
}

function align16(n: number): number {
	return (n + 15) & ~15;
}

function ensureCapacity(bytesFromHeap: number): boolean {
	if (!memory) return false;
	const need = heapBase + bytesFromHeap;
	if (need <= memory.buffer.byteLength) return true;
	const pages = Math.ceil((need - memory.buffer.byteLength) / 65536);
	try {
		if (memory.grow(pages) === -1) return false;
	} catch {
		return false;
	}
	refreshViews();
	return need <= memory.buffer.byteLength;
}

function setupInstance(inst: WebAssembly.Instance): boolean {
	const ex = inst.exports as Record<string, unknown>;
	const mem = ex.memory as WebAssembly.Memory | undefined;
	const fn = ex.fill_glyph as ((...a: number[]) => number) | undefined;
	const hb = ex.__heap_base as WebAssembly.Global | undefined;
	if (!mem || !fn || !hb) return false;
	memory = mem;
	fillFn = fn;
	heapBase = align16(Number(hb.value));
	refreshViews();
	return true;
}

/**
 * Run the kernel for one glyph command stream into `outBuffer` (length
 * width*height, PixelMode.Gray). Returns false (caller uses JS) when the kernel
 * is not enabled, memory can't grow, or the cell pool overflows.
 */
export function fillGlyphGrayWasm(
	cmd: Int32Array,
	cmdCount: number,
	width: number,
	height: number,
	fillRule: number,
	outBuffer: Uint8Array,
): boolean {
	if (!enabled || forceDisabled || !fillFn || !memory) return false;
	if (width <= 0 || height <= 0) return false;

	let p = heapBase;
	const cmdOff = p;
	p = align16(p + cmdCount * 3 * 4);
	const cellsOff = p;
	p = align16(p + POOL_SIZE * 4 * 4);
	const ycellsOff = p;
	p = align16(p + height * 4);
	const outOff = p;
	p = align16(p + width * height);

	const workBytes = p - heapBase;
	if (workBytes > MAX_FILL_WASM_WORK_BYTES) return false;
	if (!ensureCapacity(workBytes)) return false;
	const u8 = u8view!;
	const i32 = i32view!;

	i32.set(cmd.subarray(0, cmdCount * 3), cmdOff >> 2);
	u8.fill(0, outOff, outOff + width * height);

	const ok = fillFn(
		cmdOff,
		cmdCount,
		width,
		height,
		fillRule,
		cellsOff,
		ycellsOff,
		outOff,
		POOL_SIZE,
	);
	if (!ok) return false;

	outBuffer.set(u8.subarray(outOff, outOff + width * height));
	return true;
}

// --- self-verification corpus ---------------------------------------------
// Random self-intersecting polylines exercise both fill rules, small + banded
// heights, and out-of-clip coordinates. Ground truth is GrayRaster's scalar
// replay + sweep; any byte mismatch disables the wasm path.

function selfVerify(): boolean {
	const raster = new GrayRaster();
	let seed = 0x1234_5678 >>> 0;
	const rnd = () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x7fffffff;
	};

	for (let t = 0; t < 600; t++) {
		const width = 1 + Math.floor(rnd() * 160);
		const height = 1 + Math.floor(rnd() * 320);
		const fr = rnd() < 0.5 ? FillRule.NonZero : FillRule.EvenOdd;
		const nPts = 3 + Math.floor(rnd() * 20);
		const cmd: number[] = [];
		const sx = Math.floor(rnd() * width * 256);
		const sy = Math.floor(rnd() * height * 256);
		cmd.push(0, sx, sy);
		for (let i = 0; i < nPts; i++) {
			const over = rnd() < 0.2;
			const x =
				Math.floor(rnd() * (over ? 1.35 : 1) * width * 256) - (over ? 180 : 0);
			const y =
				Math.floor(rnd() * (over ? 1.35 : 1) * height * 256) - (over ? 180 : 0);
			cmd.push(1, x, y);
		}
		cmd.push(1, sx, sy);
		const cmdA = new Int32Array(cmd);
		const count = cmdA.length / 3;

		// wasm output
		const ws = new Uint8Array(width * height);
		let ok: boolean;
		try {
			ok = fillGlyphGrayWasm(cmdA, count, width, height, fr, ws);
		} catch {
			return false;
		}
		if (!ok) continue; // overflow / memory: not a correctness failure

		// scalar ground truth
		const bmp = createBitmap(width, height, PixelMode.Gray);
		raster.setClip(0, 0, width, height);
		raster.setBandBounds(0, height);
		raster.reset();
		for (let c = 0; c < count; c++) {
			const op = cmdA[c * 3]!;
			const x = cmdA[c * 3 + 1]!;
			const y = cmdA[c * 3 + 2]!;
			if (op === 0) raster.moveTo(x, y);
			else raster.lineTo(x, y);
		}
		raster.sweep(bmp, fr);

		const js = bmp.buffer;
		if (js.length !== ws.length) return false;
		for (let i = 0; i < js.length; i++) if (js[i] !== ws[i]) return false;
	}
	return true;
}

/**
 * Idempotent: compiles + self-verifies once. The module is < 4KB so the
 * synchronous compile succeeds on the browser main thread too (no async path
 * needed, unlike the larger blur kernel).
 */
export function ensureFillWasmReady(): void {
	if (status !== "uninit") return;
	if (typeof WebAssembly === "undefined") {
		status = "disabled";
		return;
	}
	try {
		const bytes = b64ToBytes(FILL_WASM_BASE64) as Uint8Array<ArrayBuffer>;
		const mod = new WebAssembly.Module(bytes);
		const inst = new WebAssembly.Instance(mod, {});
		if (!setupInstance(inst)) {
			status = "disabled";
			return;
		}
		// Enable provisionally so fillGlyphGrayWasm runs inside selfVerify.
		// Ignore the external force-disable switch during verification; otherwise
		// disabling before first init could mark an unverified module as ready.
		const previousForceDisabled = forceDisabled;
		enabled = true;
		forceDisabled = false;
		let verified = false;
		try {
			verified = selfVerify();
		} finally {
			forceDisabled = previousForceDisabled;
		}
		if (verified) {
			status = "ready";
		} else {
			enabled = false;
			fillFn = null;
			memory = null;
			status = "disabled";
		}
	} catch {
		enabled = false;
		fillFn = null;
		memory = null;
		status = "disabled";
	}
}
