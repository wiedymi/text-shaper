// Optional libass-compatible 16x16 tiled rasterizer. This is intentionally a
// separate path from fill-wasm: fill-wasm accelerates the existing FreeType-
// style scan converter, while this module owns libass curve subdivision and
// coverage generation end to end.

import type { GlyphPath } from "../../render/path.ts";
import { ASS_FILL_WASM_BASE64 } from "./wasm-bytes.ts";

type Status = "uninit" | "ready" | "disabled";

const COMMAND_WORDS = 8;
const SEGMENT_BYTES = 40;
const TILE_SIZE = 16;
const MAX_WORK_BYTES = 64 * 1024 * 1024;

let status: Status = "uninit";
let enabled = false;
let forceDisabled = false;
let memory: WebAssembly.Memory | null = null;
let heapBase = 0;
let fillFn: ((...args: number[]) => number) | null = null;
let u8View: Uint8Array | null = null;
let i32View: Int32Array | null = null;
let commandBuffer = new Int32Array(64 * COMMAND_WORDS);

export function isAssRasterWasmEnabled(): boolean {
	return enabled && !forceDisabled;
}

export function setAssRasterWasmEnabled(value: boolean): void {
	forceDisabled = !value;
}

export function assRasterWasmStatus(): {
	status: Status;
	enabled: boolean;
	forceDisabled: boolean;
} {
	return { status, enabled, forceDisabled };
}

function align16(value: number): number {
	return (value + 15) & ~15;
}

function pad16(value: number): number {
	return (value + TILE_SIZE - 1) & ~(TILE_SIZE - 1);
}

function refreshViews(): void {
	if (!memory) return;
	u8View = new Uint8Array(memory.buffer);
	i32View = new Int32Array(memory.buffer);
}

function ensureMemory(end: number): boolean {
	if (!memory) return false;
	if (end <= memory.buffer.byteLength) return true;
	try {
		memory.grow(Math.ceil((end - memory.buffer.byteLength) / 65536));
	} catch {
		return false;
	}
	refreshViews();
	return end <= memory.buffer.byteLength;
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes as Uint8Array<ArrayBuffer>;
}

function setup(instance: WebAssembly.Instance): boolean {
	const exports = instance.exports as Record<string, unknown>;
	const exportedMemory = exports.memory as WebAssembly.Memory | undefined;
	const exportedFill = exports.ass_fill_path as
		| ((...args: number[]) => number)
		| undefined;
	const exportedHeapBase = exports.__heap_base as
		| WebAssembly.Global
		| undefined;
	if (!exportedMemory || !exportedFill || !exportedHeapBase) return false;
	memory = exportedMemory;
	fillFn = exportedFill;
	heapBase = align16(Number(exportedHeapBase.value));
	refreshViews();
	return true;
}

function ensureCommandCapacity(commandCount: number): void {
	const words = commandCount * COMMAND_WORDS;
	if (commandBuffer.length >= words) return;
	let capacity = commandBuffer.length;
	while (capacity < words) capacity *= 2;
	commandBuffer = new Int32Array(capacity);
}

function encodePath(
	path: GlyphPath,
	scale: number,
	offsetX: number,
	offsetY: number,
	flipY: boolean,
): number {
	ensureCommandCapacity(path.commands.length * 2 + 1);
	const scaleX = scale * 64;
	const scaleY = (flipY ? -scale : scale) * 64;
	const offX = offsetX * 64;
	const offY = offsetY * 64;
	let count = 0;
	let open = false;
	const point = (x: number, y: number): [number, number] => [
		Math.round(x * scaleX + offX),
		Math.round(y * scaleY + offY),
	];
	const begin = (op: number): number => {
		const base = count * COMMAND_WORDS;
		commandBuffer.fill(0, base, base + COMMAND_WORDS);
		commandBuffer[base] = op;
		count++;
		return base;
	};

	for (let i = 0; i < path.commands.length; i++) {
		const command = path.commands[i]!;
		if (command.type === "M") {
			if (open) begin(4);
			const base = begin(0);
			const [x, y] = point(command.x, command.y);
			commandBuffer[base + 1] = x;
			commandBuffer[base + 2] = y;
			open = true;
		} else if (command.type === "L") {
			const base = begin(1);
			const [x, y] = point(command.x, command.y);
			commandBuffer[base + 1] = x;
			commandBuffer[base + 2] = y;
		} else if (command.type === "Q") {
			const base = begin(2);
			const [cx, cy] = point(command.x1, command.y1);
			const [x, y] = point(command.x, command.y);
			commandBuffer[base + 1] = cx;
			commandBuffer[base + 2] = cy;
			commandBuffer[base + 3] = x;
			commandBuffer[base + 4] = y;
		} else if (command.type === "C") {
			const base = begin(3);
			const [cx1, cy1] = point(command.x1, command.y1);
			const [cx2, cy2] = point(command.x2, command.y2);
			const [x, y] = point(command.x, command.y);
			commandBuffer[base + 1] = cx1;
			commandBuffer[base + 2] = cy1;
			commandBuffer[base + 3] = cx2;
			commandBuffer[base + 4] = cy2;
			commandBuffer[base + 5] = x;
			commandBuffer[base + 6] = y;
		} else if (open) {
			begin(4);
			open = false;
		}
	}
	if (open) begin(4);
	return count;
}

function copyOutput(
	outOffset: number,
	paddedWidth: number,
	width: number,
	height: number,
	out: Uint8Array,
): void {
	const source = u8View!;
	if (paddedWidth === width) {
		out.set(source.subarray(outOffset, outOffset + width * height));
		return;
	}
	for (let y = 0; y < height; y++) {
		const start = outOffset + y * paddedWidth;
		out.set(source.subarray(start, start + width), y * width);
	}
}

export function fillAssPathWasm(
	path: GlyphPath,
	width: number,
	height: number,
	scale: number,
	offsetX: number,
	offsetY: number,
	flipY: boolean,
	out: Uint8Array,
): boolean {
	if (!enabled || forceDisabled || !fillFn || !memory) return false;
	if (width <= 0 || height <= 0 || out.length !== width * height) return false;
	const commandCount = encodePath(path, scale, offsetX, offsetY, flipY);
	if (commandCount === 0) {
		out.fill(0);
		return true;
	}

	const paddedWidth = pad16(width);
	const paddedHeight = pad16(height);
	let capacity = Math.max(64, commandCount * 16);
	for (;;) {
		let cursor = heapBase;
		const commandOffset = cursor;
		cursor = align16(cursor + commandCount * COMMAND_WORDS * 4);
		const firstLinesOffset = cursor;
		cursor = align16(cursor + capacity * SEGMENT_BYTES);
		const secondLinesOffset = cursor;
		cursor = align16(cursor + capacity * SEGMENT_BYTES);
		const tileOffset = cursor;
		cursor = align16(cursor + TILE_SIZE * TILE_SIZE);
		const outputOffset = cursor;
		cursor = align16(cursor + paddedWidth * paddedHeight);
		if (cursor - heapBase > MAX_WORK_BYTES || !ensureMemory(cursor))
			return false;

		i32View!.set(
			commandBuffer.subarray(0, commandCount * COMMAND_WORDS),
			commandOffset >> 2,
		);
		const ok = fillFn(
			commandOffset,
			commandCount,
			paddedWidth,
			paddedHeight,
			firstLinesOffset,
			capacity,
			secondLinesOffset,
			capacity,
			tileOffset,
			outputOffset,
		);
		if (ok) {
			copyOutput(outputOffset, paddedWidth, width, height, out);
			return true;
		}
		capacity *= 2;
	}
}

function fnv1a(bytes: Uint8Array): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < bytes.length; i++) {
		hash = Math.imul(hash ^ bytes[i]!, 0x01000193) >>> 0;
	}
	return hash;
}

function selfVerify(): boolean {
	const paths: Array<[GlyphPath, number]> = [
		[
			{
				bounds: null,
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "L", x: 75, y: 30 },
					{ type: "L", x: 0, y: 30 },
					{ type: "Z" },
				],
			},
			0x64a28964,
		],
		[
			{
				bounds: null,
				commands: [
					{ type: "M", x: 0, y: 30 },
					{ type: "C", x1: 0, y1: 0, x2: 100, y2: 0, x: 100, y: 30 },
					{ type: "C", x1: 100, y1: 60, x2: 0, y2: 60, x: 0, y: 30 },
					{ type: "Z" },
				],
			},
			0x3558e551,
		],
	];
	for (let i = 0; i < paths.length; i++) {
		const [path, expected] = paths[i]!;
		const out = new Uint8Array(640 * 360);
		if (!fillAssPathWasm(path, 640, 360, 1, 80, 80, false, out)) return false;
		if (fnv1a(out) !== expected) return false;
	}
	return true;
}

export function ensureAssRasterWasmReady(): void {
	if (status !== "uninit") return;
	if (typeof WebAssembly === "undefined") {
		status = "disabled";
		return;
	}
	try {
		const module = new WebAssembly.Module(decodeBase64(ASS_FILL_WASM_BASE64));
		if (!setup(new WebAssembly.Instance(module, {}))) {
			status = "disabled";
			return;
		}
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
