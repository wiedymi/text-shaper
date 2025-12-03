import { describe, test, expect } from "bun:test";
import {
	createExecContext,
	createGlyphZone,
	TouchFlag,
	type ExecContext,
} from "../../../src/hinting/types.ts";
import { IUP_X, IUP_Y } from "../../../src/hinting/instructions/interpolate.ts";

describe("IUP - Interpolate Untouched Points", () => {
	function createTestZone(nPoints: number, nContours: number): ExecContext {
		const ctx = createExecContext();
		const zone = createGlyphZone(nPoints, nContours);
		zone.nPoints = nPoints;
		zone.nContours = nContours;
		ctx.pts = zone;
		ctx.zp0 = zone;
		ctx.zp1 = zone;
		ctx.zp2 = zone;
		return ctx;
	}

	describe("IUP_X - X direction interpolation", () => {
		test("does nothing with empty zone", () => {
			const ctx = createTestZone(0, 0);
			IUP_X(ctx);
			expect(ctx.error).toBeNull();
		});

		test("does nothing with no contours", () => {
			const ctx = createTestZone(5, 0);
			ctx.pts.nContours = 0;
			IUP_X(ctx);
			expect(ctx.error).toBeNull();
		});

		test("skips contour with no touched points", () => {
			const ctx = createTestZone(4, 1);
			ctx.pts.contours[0] = 3;

			// Set up original and current positions
			for (let i = 0; i < 4; i++) {
				ctx.pts.org[i] = { x: i * 100, y: 0 };
				ctx.pts.cur[i] = { x: i * 100, y: 0 };
				ctx.pts.tags[i] = 0; // All untouched
			}

			IUP_X(ctx);
			expect(ctx.error).toBeNull();

			// Points should remain unchanged
			for (let i = 0; i < 4; i++) {
				expect(ctx.pts.cur[i]!.x).toBe(i * 100);
			}
		});

		test("interpolates between two touched points", () => {
			const ctx = createTestZone(5, 1);
			ctx.pts.contours[0] = 4;

			// Set up a contour with touched points at 0 and 4
			ctx.pts.org[0] = { x: 0, y: 0 };
			ctx.pts.cur[0] = { x: 0, y: 0 };
			ctx.pts.tags[0] = TouchFlag.X;

			ctx.pts.org[1] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 100, y: 0 };
			ctx.pts.tags[1] = 0; // Untouched

			ctx.pts.org[2] = { x: 200, y: 0 };
			ctx.pts.cur[2] = { x: 200, y: 0 };
			ctx.pts.tags[2] = 0; // Untouched

			ctx.pts.org[3] = { x: 300, y: 0 };
			ctx.pts.cur[3] = { x: 300, y: 0 };
			ctx.pts.tags[3] = 0; // Untouched

			ctx.pts.org[4] = { x: 400, y: 0 };
			ctx.pts.cur[4] = { x: 480, y: 0 }; // Moved +80
			ctx.pts.tags[4] = TouchFlag.X;

			IUP_X(ctx);

			// Points should be interpolated based on original distance
			// Point 1: 25% of the way -> 25% of 80 = 20
			expect(ctx.pts.cur[1]!.x).toBe(120);
			// Point 2: 50% of the way -> 50% of 80 = 40
			expect(ctx.pts.cur[2]!.x).toBe(240);
			// Point 3: 75% of the way -> 75% of 80 = 60
			expect(ctx.pts.cur[3]!.x).toBe(360);
		});

		test("handles points outside reference range", () => {
			const ctx = createTestZone(6, 1);
			ctx.pts.contours[0] = 5;

			// Touch points 2 and 4
			ctx.pts.org[0] = { x: 50, y: 0 }; // Below low
			ctx.pts.cur[0] = { x: 50, y: 0 };
			ctx.pts.tags[0] = 0;

			ctx.pts.org[1] = { x: 75, y: 0 }; // Below low
			ctx.pts.cur[1] = { x: 75, y: 0 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 100, y: 0 }; // Reference low
			ctx.pts.cur[2] = { x: 110, y: 0 }; // Moved +10
			ctx.pts.tags[2] = TouchFlag.X;

			ctx.pts.org[3] = { x: 150, y: 0 }; // Between
			ctx.pts.cur[3] = { x: 150, y: 0 };
			ctx.pts.tags[3] = 0;

			ctx.pts.org[4] = { x: 200, y: 0 }; // Reference high
			ctx.pts.cur[4] = { x: 230, y: 0 }; // Moved +30
			ctx.pts.tags[4] = TouchFlag.X;

			ctx.pts.org[5] = { x: 300, y: 0 }; // Above high
			ctx.pts.cur[5] = { x: 300, y: 0 };
			ctx.pts.tags[5] = 0;

			IUP_X(ctx);

			// Points below low reference shift by +10
			expect(ctx.pts.cur[0]!.x).toBe(60);
			expect(ctx.pts.cur[1]!.x).toBe(85);

			// Point between interpolates: 50% -> +10 + (20 * 0.5) = +20
			expect(ctx.pts.cur[3]!.x).toBe(170);

			// Point above high reference shifts by +30
			expect(ctx.pts.cur[5]!.x).toBe(330);
		});

		test("handles contour wrapping", () => {
			const ctx = createTestZone(4, 1);
			ctx.pts.contours[0] = 3;

			// Touch point 0 and 2, leave 1 and 3 untouched
			ctx.pts.org[0] = { x: 0, y: 0 };
			ctx.pts.cur[0] = { x: 10, y: 0 }; // Moved +10
			ctx.pts.tags[0] = TouchFlag.X;

			ctx.pts.org[1] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 100, y: 0 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 200, y: 0 };
			ctx.pts.cur[2] = { x: 220, y: 0 }; // Moved +20
			ctx.pts.tags[2] = TouchFlag.X;

			ctx.pts.org[3] = { x: 300, y: 0 };
			ctx.pts.cur[3] = { x: 300, y: 0 };
			ctx.pts.tags[3] = 0;

			IUP_X(ctx);

			// Point 1 between 0 and 2: 100/200 = 50% -> +10 + (10 * 0.5) = +15
			expect(ctx.pts.cur[1]!.x).toBe(115);

			// Point 3 wraps around: between 2 and 0
			// Distance from 2 to 0 (wrapping): from 200 to 0 (through 300)
			// Point 3 at 300 is between 200 and 0 (wrapped)
			expect(ctx.pts.cur[3]!.x).toBeGreaterThanOrEqual(300);
		});

		test("handles multiple contours", () => {
			const ctx = createTestZone(8, 2);
			ctx.pts.contours[0] = 3; // First contour: points 0-3
			ctx.pts.contours[1] = 7; // Second contour: points 4-7

			// First contour
			ctx.pts.org[0] = { x: 0, y: 0 };
			ctx.pts.cur[0] = { x: 10, y: 0 };
			ctx.pts.tags[0] = TouchFlag.X;

			ctx.pts.org[1] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 100, y: 0 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 200, y: 0 };
			ctx.pts.cur[2] = { x: 220, y: 0 };
			ctx.pts.tags[2] = TouchFlag.X;

			ctx.pts.org[3] = { x: 300, y: 0 };
			ctx.pts.cur[3] = { x: 300, y: 0 };
			ctx.pts.tags[3] = 0;

			// Second contour
			ctx.pts.org[4] = { x: 500, y: 0 };
			ctx.pts.cur[4] = { x: 550, y: 0 };
			ctx.pts.tags[4] = TouchFlag.X;

			ctx.pts.org[5] = { x: 600, y: 0 };
			ctx.pts.cur[5] = { x: 600, y: 0 };
			ctx.pts.tags[5] = 0;

			ctx.pts.org[6] = { x: 700, y: 0 };
			ctx.pts.cur[6] = { x: 750, y: 0 };
			ctx.pts.tags[6] = TouchFlag.X;

			ctx.pts.org[7] = { x: 800, y: 0 };
			ctx.pts.cur[7] = { x: 800, y: 0 };
			ctx.pts.tags[7] = 0;

			IUP_X(ctx);

			// First contour point 1
			expect(ctx.pts.cur[1]!.x).toBe(115);

			// Second contour point 5
			expect(ctx.pts.cur[5]!.x).toBe(650);
		});

		test("handles zero range (coincident reference points)", () => {
			const ctx = createTestZone(3, 1);
			ctx.pts.contours[0] = 2;

			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.cur[0] = { x: 150, y: 0 }; // Moved to same position as point 2
			ctx.pts.tags[0] = TouchFlag.X;

			ctx.pts.org[1] = { x: 100, y: 0 }; // Same original position
			ctx.pts.cur[1] = { x: 100, y: 0 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 100, y: 0 }; // Same original position
			ctx.pts.cur[2] = { x: 150, y: 0 };
			ctx.pts.tags[2] = TouchFlag.X;

			IUP_X(ctx);

			// With zero range, point should get lo_cur value
			expect(ctx.pts.cur[1]!.x).toBe(150);
		});

		test("only affects X coordinates", () => {
			const ctx = createTestZone(3, 1);
			ctx.pts.contours[0] = 2;

			ctx.pts.org[0] = { x: 0, y: 100 };
			ctx.pts.cur[0] = { x: 10, y: 200 };
			ctx.pts.tags[0] = TouchFlag.X;

			ctx.pts.org[1] = { x: 100, y: 150 };
			ctx.pts.cur[1] = { x: 100, y: 250 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 200, y: 200 };
			ctx.pts.cur[2] = { x: 220, y: 300 };
			ctx.pts.tags[2] = TouchFlag.X;

			const originalY = ctx.pts.cur[1]!.y;

			IUP_X(ctx);

			// X should be interpolated
			expect(ctx.pts.cur[1]!.x).toBe(115);
			// Y should remain unchanged
			expect(ctx.pts.cur[1]!.y).toBe(originalY);
		});
	});

	describe("IUP_Y - Y direction interpolation", () => {
		test("interpolates Y coordinates", () => {
			const ctx = createTestZone(5, 1);
			ctx.pts.contours[0] = 4;

			ctx.pts.org[0] = { x: 0, y: 0 };
			ctx.pts.cur[0] = { x: 0, y: 0 };
			ctx.pts.tags[0] = TouchFlag.Y;

			ctx.pts.org[1] = { x: 0, y: 100 };
			ctx.pts.cur[1] = { x: 0, y: 100 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 0, y: 200 };
			ctx.pts.cur[2] = { x: 0, y: 200 };
			ctx.pts.tags[2] = 0;

			ctx.pts.org[3] = { x: 0, y: 300 };
			ctx.pts.cur[3] = { x: 0, y: 300 };
			ctx.pts.tags[3] = 0;

			ctx.pts.org[4] = { x: 0, y: 400 };
			ctx.pts.cur[4] = { x: 0, y: 480 }; // Moved +80
			ctx.pts.tags[4] = TouchFlag.Y;

			IUP_Y(ctx);

			// Points should be interpolated
			expect(ctx.pts.cur[1]!.y).toBe(120);
			expect(ctx.pts.cur[2]!.y).toBe(240);
			expect(ctx.pts.cur[3]!.y).toBe(360);
		});

		test("only affects Y coordinates", () => {
			const ctx = createTestZone(3, 1);
			ctx.pts.contours[0] = 2;

			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.cur[0] = { x: 200, y: 10 };
			ctx.pts.tags[0] = TouchFlag.Y;

			ctx.pts.org[1] = { x: 150, y: 100 };
			ctx.pts.cur[1] = { x: 250, y: 100 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 200, y: 200 };
			ctx.pts.cur[2] = { x: 300, y: 220 };
			ctx.pts.tags[2] = TouchFlag.Y;

			const originalX = ctx.pts.cur[1]!.x;

			IUP_Y(ctx);

			// Y should be interpolated
			expect(ctx.pts.cur[1]!.y).toBe(115);
			// X should remain unchanged
			expect(ctx.pts.cur[1]!.x).toBe(originalX);
		});

		test("handles both X and Y touch flags correctly", () => {
			const ctx = createTestZone(3, 1);
			ctx.pts.contours[0] = 2;

			// Point touched in both directions
			ctx.pts.org[0] = { x: 0, y: 0 };
			ctx.pts.cur[0] = { x: 10, y: 10 };
			ctx.pts.tags[0] = TouchFlag.Both;

			ctx.pts.org[1] = { x: 100, y: 100 };
			ctx.pts.cur[1] = { x: 100, y: 100 };
			ctx.pts.tags[1] = TouchFlag.X; // Only X touched

			ctx.pts.org[2] = { x: 200, y: 200 };
			ctx.pts.cur[2] = { x: 220, y: 220 };
			ctx.pts.tags[2] = TouchFlag.Both;

			IUP_Y(ctx);

			// Point 1 is not touched in Y, so should be interpolated
			expect(ctx.pts.cur[1]!.y).toBe(115);
		});
	});

	describe("edge cases", () => {
		test("handles single point contour", () => {
			const ctx = createTestZone(1, 1);
			ctx.pts.contours[0] = 0;

			ctx.pts.org[0] = { x: 100, y: 100 };
			ctx.pts.cur[0] = { x: 150, y: 150 };
			ctx.pts.tags[0] = TouchFlag.X;

			IUP_X(ctx);

			// Should not crash or modify the point
			expect(ctx.pts.cur[0]!.x).toBe(150);
		});

		test("handles all points touched", () => {
			const ctx = createTestZone(4, 1);
			ctx.pts.contours[0] = 3;

			for (let i = 0; i < 4; i++) {
				ctx.pts.org[i] = { x: i * 100, y: 0 };
				ctx.pts.cur[i] = { x: i * 100 + 10, y: 0 };
				ctx.pts.tags[i] = TouchFlag.X;
			}

			IUP_X(ctx);

			// All points already touched, should remain unchanged
			for (let i = 0; i < 4; i++) {
				expect(ctx.pts.cur[i]!.x).toBe(i * 100 + 10);
			}
		});

		test("handles negative coordinates", () => {
			const ctx = createTestZone(3, 1);
			ctx.pts.contours[0] = 2;

			ctx.pts.org[0] = { x: -200, y: 0 };
			ctx.pts.cur[0] = { x: -180, y: 0 }; // Moved +20
			ctx.pts.tags[0] = TouchFlag.X;

			ctx.pts.org[1] = { x: -100, y: 0 };
			ctx.pts.cur[1] = { x: -100, y: 0 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 0, y: 0 };
			ctx.pts.cur[2] = { x: 20, y: 0 }; // Moved +20
			ctx.pts.tags[2] = TouchFlag.X;

			IUP_X(ctx);

			// Point 1 at 50% should get -100 + 20 = -80
			expect(ctx.pts.cur[1]!.x).toBe(-80);
		});

		test("handles reversed ordering (high to low)", () => {
			const ctx = createTestZone(3, 1);
			ctx.pts.contours[0] = 2;

			// Points in reverse X order
			ctx.pts.org[0] = { x: 200, y: 0 };
			ctx.pts.cur[0] = { x: 220, y: 0 };
			ctx.pts.tags[0] = TouchFlag.X;

			ctx.pts.org[1] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 100, y: 0 };
			ctx.pts.tags[1] = 0;

			ctx.pts.org[2] = { x: 0, y: 0 };
			ctx.pts.cur[2] = { x: 10, y: 0 };
			ctx.pts.tags[2] = TouchFlag.X;

			IUP_X(ctx);

			// Should still interpolate correctly
			// lo_org=0, hi_org=200, point at 100 is 50%
			expect(ctx.pts.cur[1]!.x).toBe(115);
		});
	});
});
