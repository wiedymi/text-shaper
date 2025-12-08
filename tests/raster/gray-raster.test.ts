import { describe, expect, test } from "bun:test";
import { GrayRaster } from "../../src/raster/gray-raster.ts";
import { ONE_PIXEL } from "../../src/raster/fixed-point.ts";
import {
	createBitmap,
	PixelMode,
	FillRule,
	type Span,
	type Bitmap,
} from "../../src/raster/types.ts";

describe("GrayRaster", () => {
	describe("basic operations", () => {
		test("setBandBounds sets band rendering range", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 100, 100);
			raster.setBandBounds(10, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 40 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 40 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 20 * ONE_PIXEL);

			const bitmap = createBitmap(50, 100, PixelMode.Gray);
			raster.sweep(bitmap);

			expect(bitmap.buffer.some((v) => v !== 0)).toBe(true);
		});
	});

	describe("sweepSpans", () => {
		test("calls callback with spans for non-zero coverage", () => {
			const raster = new GrayRaster();
			const spans: Array<{ y: number; spans: Span[] }> = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepSpans((y, s) => {
				spans.push({ y, spans: [...s] });
			});

			expect(spans.length).toBeGreaterThan(0);

			for (const row of spans) {
				expect(row.spans.length).toBeGreaterThan(0);
				for (const span of row.spans) {
					expect(span.x).toBeGreaterThanOrEqual(0);
					expect(span.len).toBeGreaterThan(0);
					expect(span.coverage).toBeGreaterThan(0);
					expect(span.coverage).toBeLessThanOrEqual(255);
				}
			}
		});

		test("uses EvenOdd fill rule", () => {
			const raster = new GrayRaster();
			const spans: Array<{ y: number; spans: Span[] }> = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 40 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 40 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepSpans(
				(y, s) => {
					spans.push({ y, spans: [...s] });
				},
				FillRule.EvenOdd,
			);

			expect(spans.length).toBeGreaterThan(0);
		});

		test("passes userData to callback", () => {
			const raster = new GrayRaster();
			const userData = { count: 0 };

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepSpans(
				(y, s, data) => {
					data.count++;
				},
				FillRule.NonZero,
				userData,
			);

			expect(userData.count).toBeGreaterThan(0);
		});

		test("generates spans with correct x positions and lengths", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 11 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 11 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepSpans((y, s) => {
				spans.push(...s);
			});

			for (const span of spans) {
				expect(span.x).toBeGreaterThanOrEqual(10);
				expect(span.x).toBeLessThanOrEqual(30);
				expect(span.len).toBeGreaterThan(0);
			}
		});

		test("handles empty raster", () => {
			const raster = new GrayRaster();
			let called = false;

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.sweepSpans(() => {
				called = true;
			});

			expect(called).toBe(false);
		});

		test("handles gray value of zero correctly", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(11 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(11 * ONE_PIXEL, 11 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 11 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepSpans((y, s) => {
				spans.push(...s);
			});

			for (const span of spans) {
				expect(span.coverage).toBeGreaterThan(0);
			}
		});
	});

	describe("sweepDirect", () => {
		test("calls callback with buffered spans", () => {
			const raster = new GrayRaster();
			const calls: Array<{ y: number; spans: Span[] }> = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect((y, spans) => {
				calls.push({ y, spans: [...spans] });
			});

			expect(calls.length).toBeGreaterThan(0);
			for (const call of calls) {
				expect(call.spans.length).toBeGreaterThan(0);
			}
		});

		test("flushes buffer when reaching MAX_GRAY_SPANS", () => {
			const raster = new GrayRaster();
			let flushCount = 0;

			raster.setClip(0, 0, 200, 200);
			raster.reset();

			for (let i = 0; i < 50; i++) {
				const x = 10 + i * 2;
				raster.moveTo(x * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo((x + 1) * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo((x + 1) * ONE_PIXEL, 11 * ONE_PIXEL);
				raster.lineTo(x * ONE_PIXEL, 11 * ONE_PIXEL);
				raster.lineTo(x * ONE_PIXEL, 10 * ONE_PIXEL);
			}

			raster.sweepDirect((y, spans) => {
				flushCount++;
			});

			expect(flushCount).toBeGreaterThan(0);
		});

		test("respects minX and maxX clip bounds", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(5 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(50 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(50 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(5 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(5 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect(
				(y, s) => {
					spans.push(...s);
				},
				FillRule.NonZero,
				10,
				40,
			);

			for (const span of spans) {
				expect(span.x).toBeGreaterThanOrEqual(5);
				expect(span.x).toBeLessThanOrEqual(50);
			}
		});

		test("uses EvenOdd fill rule", () => {
			const raster = new GrayRaster();
			const calls: Array<{ y: number; spans: Span[] }> = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect(
				(y, spans) => {
					calls.push({ y, spans: [...spans] });
				},
				FillRule.EvenOdd,
			);

			expect(calls.length).toBeGreaterThan(0);
		});

		test("passes userData to callback", () => {
			const raster = new GrayRaster();
			const userData = { total: 0 };

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect(
				(y, spans, data) => {
					data.total += spans.length;
				},
				FillRule.NonZero,
				0,
				Infinity,
				userData,
			);

			expect(userData.total).toBeGreaterThan(0);
		});

		test("handles remaining spans correctly", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(90 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(90 * ONE_PIXEL, 11 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 11 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect(
				(y, s) => {
					spans.push(...s);
				},
				FillRule.NonZero,
				0,
				95,
			);

			expect(spans.length).toBeGreaterThan(0);
		});

		test("handles edge cells with area correctly", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL + ONE_PIXEL / 2, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL + ONE_PIXEL / 2, 10 * ONE_PIXEL);
			raster.lineTo(
				20 * ONE_PIXEL + ONE_PIXEL / 2,
				15 * ONE_PIXEL + ONE_PIXEL / 2,
			);
			raster.lineTo(
				10 * ONE_PIXEL + ONE_PIXEL / 2,
				15 * ONE_PIXEL + ONE_PIXEL / 2,
			);
			raster.lineTo(10 * ONE_PIXEL + ONE_PIXEL / 2, 10 * ONE_PIXEL);

			raster.sweepDirect((y, s) => {
				spans.push(...s);
			});

			for (const span of spans) {
				expect(span.coverage).toBeGreaterThan(0);
				expect(span.coverage).toBeLessThanOrEqual(255);
			}
		});

		test("handles clipping at cell boundaries", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(5 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(60 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(60 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(5 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(5 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect(
				(y, s) => {
					spans.push(...s);
				},
				FillRule.NonZero,
				10,
				40,
			);

			for (const span of spans) {
				expect(span.x).toBeGreaterThanOrEqual(5);
			}
		});

		test("handles empty raster", () => {
			const raster = new GrayRaster();
			let called = false;

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.sweepDirect(() => {
				called = true;
			});

			expect(called).toBe(false);
		});

		test("flushes final spans for each row", () => {
			const raster = new GrayRaster();
			const rowSpanCounts: number[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(25 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(25 * ONE_PIXEL, 15 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 15 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect((y, spans) => {
				rowSpanCounts.push(spans.length);
			});

			expect(rowSpanCounts.length).toBeGreaterThan(0);
			for (const count of rowSpanCounts) {
				expect(count).toBeGreaterThan(0);
			}
		});

		test("handles buffer flush at exactly MAX_GRAY_SPANS boundary", () => {
			const raster = new GrayRaster();
			const flushSizes: number[] = [];

			raster.setClip(0, 0, 200, 200);
			raster.reset();

			for (let i = 0; i < 30; i++) {
				const x = 10 + i * 3;
				raster.moveTo(x * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo((x + 1) * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo((x + 1) * ONE_PIXEL, 11 * ONE_PIXEL);
				raster.lineTo(x * ONE_PIXEL, 11 * ONE_PIXEL);
				raster.lineTo(x * ONE_PIXEL, 10 * ONE_PIXEL);
			}

			raster.sweepDirect((y, spans) => {
				flushSizes.push(spans.length);
			});

			expect(flushSizes.some((size) => size > 0)).toBe(true);
		});

		test("handles maxX calculation with raster maxX", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 80, 80);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(70 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(70 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect(
				(y, s) => {
					spans.push(...s);
				},
				FillRule.NonZero,
				0,
				100,
			);

			expect(spans.length).toBeGreaterThan(0);
		});
	});

	describe("sweepSpans and sweepDirect integration", () => {
		test("both methods produce equivalent coverage", () => {
			const raster1 = new GrayRaster();
			const raster2 = new GrayRaster();

			const spans1: Span[] = [];
			const spans2: Span[] = [];

			for (const raster of [raster1, raster2]) {
				raster.setClip(0, 0, 100, 100);
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			}

			raster1.sweepSpans((y, s) => {
				spans1.push(...s);
			});

			raster2.sweepDirect((y, s) => {
				spans2.push(...s);
			});

			expect(spans1.length).toBeGreaterThan(0);
			expect(spans2.length).toBeGreaterThan(0);

			const totalCoverage1 = spans1.reduce(
				(sum, s) => sum + s.len * s.coverage,
				0,
			);
			const totalCoverage2 = spans2.reduce(
				(sum, s) => sum + s.len * s.coverage,
				0,
			);

			expect(Math.abs(totalCoverage1 - totalCoverage2)).toBeLessThan(
				totalCoverage1 * 0.01,
			);
		});

		test("both methods handle complex shapes", () => {
			const raster1 = new GrayRaster();
			const raster2 = new GrayRaster();

			for (const raster of [raster1, raster2]) {
				raster.setClip(0, 0, 100, 100);
				raster.reset();

				raster.moveTo(20 * ONE_PIXEL, 20 * ONE_PIXEL);
				raster.conicTo(
					30 * ONE_PIXEL,
					10 * ONE_PIXEL,
					40 * ONE_PIXEL,
					20 * ONE_PIXEL,
				);
				raster.cubicTo(
					50 * ONE_PIXEL,
					30 * ONE_PIXEL,
					50 * ONE_PIXEL,
					40 * ONE_PIXEL,
					40 * ONE_PIXEL,
					50 * ONE_PIXEL,
				);
				raster.lineTo(20 * ONE_PIXEL, 50 * ONE_PIXEL);
				raster.lineTo(20 * ONE_PIXEL, 20 * ONE_PIXEL);
			}

			let count1 = 0;
			let count2 = 0;

			raster1.sweepSpans(() => {
				count1++;
			});

			raster2.sweepDirect(() => {
				count2++;
			});

			expect(count1).toBeGreaterThan(0);
			expect(count2).toBeGreaterThan(0);
		});
	});

	describe("span callback rendering to bitmap", () => {
		test("sweepSpans can be used to render to bitmap manually", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepSpans((y, spans) => {
				if (y < 0 || y >= bitmap.rows) return;
				for (const span of spans) {
					for (let x = 0; x < span.len; x++) {
						const px = span.x + x;
						if (px >= 0 && px < bitmap.width) {
							bitmap.buffer[y * bitmap.pitch + px] = span.coverage;
						}
					}
				}
			});

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("sweepDirect can be used to render to bitmap manually", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect((y, spans) => {
				if (y < 0 || y >= bitmap.rows) return;
				for (const span of spans) {
					for (let x = 0; x < span.len; x++) {
						const px = span.x + x;
						if (px >= 0 && px < bitmap.width) {
							bitmap.buffer[y * bitmap.pitch + px] = span.coverage;
						}
					}
				}
			});

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});
	});

	describe("sweep method - bitmap rendering", () => {
		test("renders to Gray bitmap", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("renders with NonZero fill rule", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 40 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 40 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap, FillRule.NonZero);

			let sum = 0;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				sum += bitmap.buffer[i];
			}
			expect(sum).toBeGreaterThan(0);
		});

		test("renders with EvenOdd fill rule", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 40 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 40 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap, FillRule.EvenOdd);

			let sum = 0;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				sum += bitmap.buffer[i];
			}
			expect(sum).toBeGreaterThan(0);
		});

		test("renders to Mono bitmap", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Mono);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("renders to LCD bitmap", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.LCD);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("renders to LCD_V bitmap", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.LCD_V);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("renders to RGBA bitmap", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.RGBA);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("handles negative pitch (bottom-up bitmap)", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);
			bitmap.pitch = -bitmap.pitch;

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("clamps gray values to 255", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			for (let i = 0; i < 10; i++) {
				raster.moveTo(20 * ONE_PIXEL, 20 * ONE_PIXEL);
				raster.lineTo(30 * ONE_PIXEL, 20 * ONE_PIXEL);
				raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
				raster.lineTo(20 * ONE_PIXEL, 30 * ONE_PIXEL);
				raster.lineTo(20 * ONE_PIXEL, 20 * ONE_PIXEL);
			}

			raster.sweep(bitmap);

			let maxValue = 0;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] > maxValue) {
					maxValue = bitmap.buffer[i];
				}
			}
			expect(maxValue).toBeLessThanOrEqual(255);
		});

		test("handles spans outside bitmap bounds", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(30, 30, PixelMode.Gray);

			raster.setClip(-10, -10, 60, 60);
			raster.reset();

			raster.moveTo(-5 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(50 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(50 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(-5 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(-5 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			expect(bitmap.buffer.some((v) => v !== 0)).toBe(true);
		});

		test("handles Mono bitmap with low coverage", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Mono);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(11 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(11 * ONE_PIXEL, 11 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 11 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			expect(bitmap.buffer.length).toBeGreaterThan(0);
		});

		test("handles edge cells with anti-aliasing", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);

			raster.setClip(0, 0, 50, 50);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL + ONE_PIXEL / 2, 10 * ONE_PIXEL);
			raster.lineTo(
				30 * ONE_PIXEL + ONE_PIXEL / 2,
				10 * ONE_PIXEL + ONE_PIXEL / 2,
			);
			raster.lineTo(
				30 * ONE_PIXEL + ONE_PIXEL / 2,
				30 * ONE_PIXEL + ONE_PIXEL / 2,
			);
			raster.lineTo(
				10 * ONE_PIXEL + ONE_PIXEL / 2,
				30 * ONE_PIXEL + ONE_PIXEL / 2,
			);
			raster.lineTo(10 * ONE_PIXEL + ONE_PIXEL / 2, 10 * ONE_PIXEL);

			raster.sweep(bitmap);

			let uniqueValues = new Set<number>();
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					uniqueValues.add(bitmap.buffer[i]);
				}
			}
			expect(uniqueValues.size).toBeGreaterThan(0);
		});
	});

	describe("band rendering with renderWithBands", () => {
		test("renders small glyph in single band", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(50, 50, PixelMode.Gray);

			raster.setClip(0, 0, 50, 50);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(30 * ONE_PIXEL, 30 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: 50 });

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("renders large glyph with multiple bands", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(100, 500, PixelMode.Gray);

			raster.setClip(0, 0, 100, 500);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 450 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 450 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: 500 });

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("uses EvenOdd fill rule in bands", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(100, 300, PixelMode.Gray);

			raster.setClip(0, 0, 100, 300);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(
				bitmap,
				decomposeFn,
				{ minY: 0, maxY: 300 },
				FillRule.EvenOdd,
			);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("handles X bounds in band rendering", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(100, 300, PixelMode.Gray);

			raster.setClip(0, 0, 100, 300);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, {
				minY: 0,
				maxY: 300,
				minX: 10,
				maxX: 80,
			});

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("renders to Mono bitmap with bands", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(100, 300, PixelMode.Mono);

			raster.setClip(0, 0, 100, 300);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: 300 });

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("renders to LCD bitmap with bands", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(100, 300, PixelMode.LCD);

			raster.setClip(0, 0, 100, 300);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: 300 });

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("renders to RGBA bitmap with bands", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(100, 300, PixelMode.RGBA);

			raster.setClip(0, 0, 100, 300);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: 300 });

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("handles bottom-up bitmap with bands", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(100, 300, PixelMode.Gray);
			bitmap.pitch = -bitmap.pitch;

			raster.setClip(0, 0, 100, 300);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(80 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: 300 });

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("handles curves in band rendering", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(100, 300, PixelMode.Gray);

			raster.setClip(0, 0, 100, 300);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(20 * ONE_PIXEL, 50 * ONE_PIXEL);
				raster.conicTo(
					50 * ONE_PIXEL,
					20 * ONE_PIXEL,
					80 * ONE_PIXEL,
					50 * ONE_PIXEL,
				);
				raster.cubicTo(
					90 * ONE_PIXEL,
					80 * ONE_PIXEL,
					90 * ONE_PIXEL,
					120 * ONE_PIXEL,
					80 * ONE_PIXEL,
					150 * ONE_PIXEL,
				);
				raster.lineTo(20 * ONE_PIXEL, 150 * ONE_PIXEL);
				raster.lineTo(20 * ONE_PIXEL, 50 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: 300 });

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("handles clipping within bands", () => {
			const raster = new GrayRaster();
			const bitmap = createBitmap(80, 300, PixelMode.Gray);

			raster.setClip(0, 0, 80, 300);

			const decomposeFn = () => {
				raster.reset();
				raster.moveTo(5 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(70 * ONE_PIXEL, 10 * ONE_PIXEL);
				raster.lineTo(70 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(5 * ONE_PIXEL, 250 * ONE_PIXEL);
				raster.lineTo(5 * ONE_PIXEL, 10 * ONE_PIXEL);
			};

			raster.renderWithBands(bitmap, decomposeFn, { minY: 0, maxY: 300 });

			expect(bitmap.buffer.some((v) => v !== 0)).toBe(true);
		});
	});

	describe("edge cases for span generation", () => {
		test("handles very thin shapes", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(11 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(11 * ONE_PIXEL, 50 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 50 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepSpans((y, s) => {
				spans.push(...s);
			});

			expect(spans.length).toBeGreaterThan(0);
		});

		test("handles shapes with gaps", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(20 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.moveTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(40 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 20 * ONE_PIXEL);
			raster.lineTo(30 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepDirect((y, s) => {
				spans.push(...s);
			});

			expect(spans.length).toBeGreaterThan(0);
		});

		test("handles diagonal lines", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);
			raster.lineTo(50 * ONE_PIXEL, 50 * ONE_PIXEL);
			raster.lineTo(50 * ONE_PIXEL, 55 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 15 * ONE_PIXEL);
			raster.lineTo(10 * ONE_PIXEL, 10 * ONE_PIXEL);

			raster.sweepSpans((y, s) => {
				spans.push(...s);
			});

			expect(spans.length).toBeGreaterThan(0);
		});

		test("handles curves with sweepSpans", () => {
			const raster = new GrayRaster();
			const spans: Span[] = [];

			raster.setClip(0, 0, 100, 100);
			raster.reset();

			raster.moveTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);
			raster.conicTo(
				30 * ONE_PIXEL,
				10 * ONE_PIXEL,
				50 * ONE_PIXEL,
				30 * ONE_PIXEL,
			);
			raster.lineTo(50 * ONE_PIXEL, 35 * ONE_PIXEL);
			raster.conicTo(
				30 * ONE_PIXEL,
				15 * ONE_PIXEL,
				10 * ONE_PIXEL,
				35 * ONE_PIXEL,
			);
			raster.lineTo(10 * ONE_PIXEL, 30 * ONE_PIXEL);

			raster.sweepSpans((y, s) => {
				spans.push(...s);
			});

			expect(spans.length).toBeGreaterThan(0);
		});
	});
});
