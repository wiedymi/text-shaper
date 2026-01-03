import { describe, test, expect } from "bun:test";
import {
	createExecContext,
	createGlyphZone,
	TouchFlag,
	type ExecContext,
	type GlyphZone,
} from "../../../src/hinting/types.ts";
import {
	project,
	dualProject,
	movePoint,
	getCurrent,
	getOriginal,
	touchPoint,
	MDAP,
	MIAP,
	MDRP,
	MIRP,
	SHP,
	SHC,
	SHZ,
	SHPIX,
	IP,
	ALIGNRP,
	MSIRP,
	ISECT,
	ALIGNPTS,
	GC,
	SCFS,
	MD,
	MPPEM,
	MPS,
	FLIPPT,
	FLIPRGON,
	FLIPRGOFF,
	ROUND,
	NROUND,
} from "../../../src/hinting/instructions/points.ts";

describe("Point Movement Instructions", () => {
	function createTestContext(): ExecContext {
		const ctx = createExecContext();
		const zone = createGlyphZone(10, 2);
		zone.nPoints = 10;
		zone.nContours = 2;
		zone.contours[0] = 4;
		zone.contours[1] = 9;

		for (let i = 0; i < 10; i++) {
			zone.org[i] = { x: i * 64, y: i * 64 };
			zone.cur[i] = { x: i * 64, y: i * 64 };
			zone.tags[i] = 0;
		}
		zone.orus = zone.org;

		ctx.pts = zone;
		ctx.zp0 = zone;
		ctx.zp1 = zone;
		ctx.zp2 = zone;

		return ctx;
	}

	describe("project and dualProject", () => {
		test("project onto X axis", () => {
			const ctx = createTestContext();
			ctx.GS.projVector = { x: 0x4000, y: 0 }; // X axis

			const result = project(ctx, { x: 128, y: 64 });
			expect(result).toBe(128);
		});

		test("project onto Y axis", () => {
			const ctx = createTestContext();
			ctx.GS.projVector = { x: 0, y: 0x4000 }; // Y axis

			const result = project(ctx, { x: 128, y: 64 });
			expect(result).toBe(64);
		});

		test("dualProject uses dual vector", () => {
			const ctx = createTestContext();
			ctx.GS.dualVector = { x: 0x4000, y: 0 };

			const result = dualProject(ctx, { x: 256, y: 128 });
			expect(result).toBe(256);
		});

		test("project with diagonal vector", () => {
			const ctx = createTestContext();
			// 45 degree vector (normalized)
			const val = Math.floor(0x4000 * Math.sqrt(0.5));
			ctx.GS.projVector = { x: val, y: val };

			const result = project(ctx, { x: 100, y: 100 });
			// Result should be roughly sqrt(2) * 100 in projection
			expect(result).toBeGreaterThan(0);
		});
	});

	describe("movePoint", () => {
		test("moves point along freedom vector (X axis)", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0x4000, y: 0 };
			ctx.GS.projVector = { x: 0x4000, y: 0 };

			const originalX = ctx.pts.cur[0]!.x;
			movePoint(ctx, ctx.pts, 0, 64);

			expect(ctx.pts.cur[0]!.x).toBe(originalX + 64);
		});

		test("moves point along freedom vector (Y axis)", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0, y: 0x4000 };
			ctx.GS.projVector = { x: 0, y: 0x4000 };

			const originalY = ctx.pts.cur[0]!.y;
			movePoint(ctx, ctx.pts, 0, 64);

			expect(ctx.pts.cur[0]!.y).toBe(originalY + 64);
		});

		test("does not move when vectors are perpendicular", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0x4000, y: 0 };
			ctx.GS.projVector = { x: 0, y: 0x4000 };

			const originalX = ctx.pts.cur[0]!.x;
			const originalY = ctx.pts.cur[0]!.y;

			movePoint(ctx, ctx.pts, 0, 64);

			expect(ctx.pts.cur[0]!.x).toBe(originalX);
			expect(ctx.pts.cur[0]!.y).toBe(originalY);
		});
	});

	describe("touchPoint", () => {
		test("sets X touch flag when freedom vector has X component", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0x4000, y: 0 };

			touchPoint(ctx, ctx.pts, 0);
			expect(ctx.pts.tags[0]! & TouchFlag.X).toBeTruthy();
		});

		test("sets Y touch flag when freedom vector has Y component", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0, y: 0x4000 };

			touchPoint(ctx, ctx.pts, 0);
			expect(ctx.pts.tags[0]! & TouchFlag.Y).toBeTruthy();
		});

		test("sets both flags for diagonal vector", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0x2000, y: 0x2000 };

			touchPoint(ctx, ctx.pts, 0);
			expect(ctx.pts.tags[0]! & TouchFlag.Both).toBe(TouchFlag.Both);
		});
	});

	describe("MDAP - Move Direct Absolute Point", () => {
		test("rounds point to grid", () => {
			const ctx = createTestContext();
			ctx.pts.cur[0] = { x: 100, y: 0 }; // 100 in 26.6 = 1.5625 pixels
			ctx.stack[ctx.stackTop++] = 0; // Point index

			MDAP(ctx, true); // With rounding

			// Should round to nearest pixel (64 or 128)
			expect(ctx.pts.cur[0]!.x).toBeGreaterThanOrEqual(64);
			expect(ctx.GS.rp0).toBe(0);
			expect(ctx.GS.rp1).toBe(0);
		});

		test("does not round when flag is false", () => {
			const ctx = createTestContext();
			const originalX = ctx.pts.cur[0]!.x;
			ctx.stack[ctx.stackTop++] = 0;

			MDAP(ctx, false);

			expect(ctx.pts.cur[0]!.x).toBe(originalX);
			expect(ctx.GS.rp0).toBe(0);
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 999;

			MDAP(ctx, true);

			expect(ctx.error).toContain("invalid point");
		});
	});

	describe("MIAP - Move Indirect Absolute Point", () => {
		test("moves point to CVT value", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([128, 256, 384]);
			ctx.cvtSize = 3;

			ctx.stack[ctx.stackTop++] = 1; // Point index
			ctx.stack[ctx.stackTop++] = 1; // CVT index

			MIAP(ctx, false);

			expect(ctx.error).toBeNull();
			expect(ctx.GS.rp0).toBe(1);
			expect(ctx.GS.rp1).toBe(1);
		});

		test("uses control value cut-in", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([1000]);
			ctx.cvtSize = 1;
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.GS.controlValueCutIn = 50;

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 0;

			MIAP(ctx, true); // With rounding

			expect(ctx.error).toBeNull();
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([128]);
			ctx.cvtSize = 1;

			ctx.stack[ctx.stackTop++] = 999; // Invalid point
			ctx.stack[ctx.stackTop++] = 0;

			MIAP(ctx, false);

			expect(ctx.error).toContain("invalid point");
		});

		test("sets error for invalid CVT index", () => {
			const ctx = createTestContext();
			ctx.cvtSize = 5;

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 999;

			MIAP(ctx, false);

			expect(ctx.error).toContain("invalid CVT index");
		});
	});

	describe("MDRP - Move Direct Relative Point", () => {
		test("maintains relative distance", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 0;
			ctx.stack[ctx.stackTop++] = 2;

			const orgDist = ctx.pts.org[2]!.x - ctx.pts.org[0]!.x;
			MDRP(ctx, 0);

			expect(ctx.error).toBeNull();
			expect(ctx.GS.rp2).toBe(2);
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 0;
			ctx.stack[ctx.stackTop++] = 999;

			MDRP(ctx, 0);

			expect(ctx.error).toContain("invalid point");
		});

		test("sets error for invalid rp0", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 999; // Invalid
			ctx.stack[ctx.stackTop++] = 2;

			MDRP(ctx, 0);

			expect(ctx.error).toContain("invalid rp0");
		});

		test("applies auto-flip when enabled", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 2;
			ctx.GS.autoFlip = true;
			ctx.pts.org[2] = { x: 200, y: 0 };
			ctx.pts.org[1] = { x: 100, y: 0 }; // Negative original distance
			ctx.pts.cur[2] = { x: 200, y: 0 };
			ctx.pts.cur[1] = { x: 100, y: 0 };

			ctx.stack[ctx.stackTop++] = 1;

			MDRP(ctx, 0);

			expect(ctx.error).toBeNull();
		});

		test("applies rounding when flag is set", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 0;
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.org[1] = { x: 165, y: 0 }; // Distance will be rounded
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 165, y: 0 };

			ctx.stack[ctx.stackTop++] = 1;

			MDRP(ctx, 0x04); // doRound flag

			expect(ctx.error).toBeNull();
		});

		test("applies minimum distance for positive values", () => {
			const ctx = createTestContext();
			ctx.GS.minimumDistance = 64;
			ctx.GS.rp0 = 0;
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.org[1] = { x: 110, y: 0 }; // Very close
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 110, y: 0 };

			ctx.stack[ctx.stackTop++] = 1;

			MDRP(ctx, 0x08); // keepMinDist flag

			expect(ctx.error).toBeNull();
		});

		test("applies minimum distance for negative values", () => {
			const ctx = createTestContext();
			ctx.GS.minimumDistance = 64;
			ctx.GS.rp0 = 1;
			ctx.GS.autoFlip = false; // Don't flip
			ctx.pts.org[1] = { x: 110, y: 0 };
			ctx.pts.org[0] = { x: 100, y: 0 }; // orgDist = -10 (negative, close to zero)
			ctx.pts.cur[1] = { x: 110, y: 0 };
			ctx.pts.cur[0] = { x: 100, y: 0 };

			ctx.stack[ctx.stackTop++] = 0;

			MDRP(ctx, 0x08); // keepMinDist flag only (no rounding to keep it negative)

			expect(ctx.error).toBeNull();
		});

		test("sets rp0 when flag is set", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 0;
			ctx.stack[ctx.stackTop++] = 3;

			MDRP(ctx, 0x10); // setRp0 flag

			expect(ctx.GS.rp0).toBe(3);
		});
	});

	describe("MIRP - Move Indirect Relative Point", () => {
		test("uses CVT for distance", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([128]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 0;

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0);

			expect(ctx.error).toBeNull();
			expect(ctx.GS.rp2).toBe(2);
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([128]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 0;

			ctx.stack[ctx.stackTop++] = 999;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0);

			expect(ctx.error).toContain("invalid point");
		});

		test("sets error for invalid CVT index", () => {
			const ctx = createTestContext();
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 0;

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 999;

			MIRP(ctx, 0);

			expect(ctx.error).toContain("invalid CVT index");
		});

		test("sets error for invalid rp0", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([128]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 999;

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0);

			expect(ctx.error).toContain("invalid rp0");
		});

		test("uses original distance when diff > controlValueCutIn", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([1000]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 0;
			ctx.GS.controlValueCutIn = 50;

			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.org[2] = { x: 200, y: 0 }; // orgDist = 100
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[2] = { x: 200, y: 0 };

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0);

			expect(ctx.error).toBeNull();
		});

		test("applies rounding when flag is set", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([165]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 0;

			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.org[2] = { x: 265, y: 0 };
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[2] = { x: 265, y: 0 };

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0x04); // doRound flag

			expect(ctx.error).toBeNull();
		});

		test("applies minimum distance for positive original distance", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([10]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 0;
			ctx.GS.minimumDistance = 64;

			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.org[2] = { x: 110, y: 0 }; // orgDist = 10 (positive)
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[2] = { x: 110, y: 0 };

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0x08); // keepMinDist flag

			expect(ctx.error).toBeNull();
		});

		test("applies minimum distance for negative original distance", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([-10]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 1;
			ctx.GS.minimumDistance = 64;
			ctx.GS.controlValueCutIn = 100; // Large enough to use CVT value

			ctx.pts.org[1] = { x: 110, y: 0 };
			ctx.pts.org[0] = { x: 100, y: 0 }; // orgDist = -10 (negative)
			ctx.pts.cur[1] = { x: 110, y: 0 };
			ctx.pts.cur[0] = { x: 100, y: 0 };

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0x0C); // keepMinDist + doRound flags

			expect(ctx.error).toBeNull();
		});

		test("sets rp0 when flag is set", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([128]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 0;

			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0x10); // setRp0 flag

			expect(ctx.GS.rp0).toBe(3);
		});

		test("auto-flips CVT distance", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([128]);
			ctx.cvtSize = 1;
			ctx.GS.rp0 = 2;
			ctx.GS.autoFlip = true;

			ctx.pts.org[2] = { x: 200, y: 0 };
			ctx.pts.org[1] = { x: 100, y: 0 }; // Negative original distance

			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 0;

			MIRP(ctx, 0);

			expect(ctx.error).toBeNull();
		});
	});

	describe("SHP - Shift Point", () => {
		test("shifts points by reference movement", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 0;
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.cur[0] = { x: 150, y: 0 }; // Moved +50
			ctx.pts.cur[2] = { x: 200, y: 0 };

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 2;

			SHP(ctx, false); // Use rp2

			expect(ctx.pts.cur[2]!.x).toBe(250); // +50
		});

		test("sets error for invalid reference point", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 999; // Invalid

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 2;

			SHP(ctx, false);

			expect(ctx.error).toContain("invalid reference point");
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 0;
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.cur[0] = { x: 150, y: 0 };

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 999; // Invalid

			SHP(ctx, false);

			expect(ctx.error).toContain("invalid point");
		});

		test("processes loop count", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 0;
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.cur[0] = { x: 150, y: 0 };

			ctx.GS.loop = 3;
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 3;

			SHP(ctx, false);

			expect(ctx.GS.loop).toBe(1); // Reset
		});
	});

	describe("SHC - Shift Contour", () => {
		test("shifts entire contour", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 0;
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.cur[0] = { x: 150, y: 0 }; // Moved +50

			const originalPositions = [1, 2, 3, 4].map(i => ctx.pts.cur[i]!.x);

			ctx.stack[ctx.stackTop++] = 0; // Contour 0 (points 0-4)

			SHC(ctx, false);

			// Points 1-4 should be shifted (point 0 is reference)
			for (let i = 1; i <= 4; i++) {
				expect(ctx.pts.cur[i]!.x).toBe(originalPositions[i - 1]! + 50);
			}
		});

		test("sets error for invalid reference point", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 999; // Invalid

			ctx.stack[ctx.stackTop++] = 0;

			SHC(ctx, false);

			expect(ctx.error).toContain("invalid reference point");
		});

		test("sets error for invalid contour", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 0;
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.cur[0] = { x: 150, y: 0 };

			ctx.stack[ctx.stackTop++] = 999; // Invalid contour

			SHC(ctx, false);

			expect(ctx.error).toContain("invalid contour");
		});
	});

	describe("SHZ - Shift Zone", () => {
		test("shifts all points in zone", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 0;
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.cur[0] = { x: 150, y: 0 }; // Moved +50

			const originalPositions = ctx.pts.cur.map(p => p.x);

			ctx.stack[ctx.stackTop++] = 1; // Zone 1 (glyph zone)

			SHZ(ctx, false);

			// All points except reference should be shifted
			for (let i = 1; i < ctx.pts.nPoints; i++) {
				expect(ctx.pts.cur[i]!.x).toBe(originalPositions[i]! + 50);
			}
		});

		test("sets error for invalid reference point", () => {
			const ctx = createTestContext();
			ctx.GS.rp2 = 999; // Invalid

			ctx.stack[ctx.stackTop++] = 1;

			SHZ(ctx, false);

			expect(ctx.error).toContain("invalid reference point");
		});
	});

	describe("SHPIX - Shift Point by Pixel Amount", () => {
		test("shifts point by exact distance", () => {
			const ctx = createTestContext();
			const originalX = ctx.pts.cur[1]!.x;

			ctx.stack[ctx.stackTop++] = 1; // Point index
			ctx.stack[ctx.stackTop++] = 64; // Distance (1 pixel)
			ctx.GS.loop = 1;

			SHPIX(ctx);

			expect(ctx.pts.cur[1]!.x).toBe(originalX + 64);
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 999; // Invalid point
			ctx.stack[ctx.stackTop++] = 64;
			ctx.GS.loop = 1;

			SHPIX(ctx);

			expect(ctx.error).toContain("invalid point");
		});
	});

	describe("IP - Interpolate Point", () => {
		test("interpolates point between references", () => {
			const ctx = createTestContext();
			ctx.GS.rp1 = 0;
			ctx.GS.rp2 = 4;

			ctx.pts.org[0] = { x: 0, y: 0 };
			ctx.pts.cur[0] = { x: 0, y: 0 };
			ctx.pts.org[4] = { x: 400, y: 0 };
			ctx.pts.cur[4] = { x: 480, y: 0 }; // Moved +80

			ctx.pts.org[2] = { x: 200, y: 0 }; // 50% of the way
			ctx.pts.cur[2] = { x: 200, y: 0 };

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 2;

			IP(ctx);

			// Should move to 50% of new distance: 240
			expect(ctx.pts.cur[2]!.x).toBe(240);
		});

		test("sets error for invalid rp1", () => {
			const ctx = createTestContext();
			ctx.GS.rp1 = 999; // Invalid
			ctx.GS.rp2 = 4;

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 2;

			IP(ctx);

			expect(ctx.error).toContain("invalid rp1");
		});

		test("sets error for invalid rp2", () => {
			const ctx = createTestContext();
			ctx.GS.rp1 = 0;
			ctx.GS.rp2 = 999; // Invalid

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 2;

			IP(ctx);

			expect(ctx.error).toContain("invalid rp2");
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();
			ctx.GS.rp1 = 0;
			ctx.GS.rp2 = 4;

			ctx.pts.org[0] = { x: 0, y: 0 };
			ctx.pts.cur[0] = { x: 0, y: 0 };
			ctx.pts.org[4] = { x: 400, y: 0 };
			ctx.pts.cur[4] = { x: 480, y: 0 };

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 999; // Invalid

			IP(ctx);

			expect(ctx.error).toContain("invalid point");
		});

		test("handles zero range", () => {
			const ctx = createTestContext();
			ctx.GS.rp1 = 0;
			ctx.GS.rp2 = 1;

			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.org[1] = { x: 100, y: 0 }; // Same position
			ctx.pts.cur[0] = { x: 150, y: 0 };
			ctx.pts.cur[1] = { x: 150, y: 0 };

			ctx.pts.org[2] = { x: 200, y: 0 };
			ctx.pts.cur[2] = { x: 200, y: 0 };

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 2;

			IP(ctx);

			expect(ctx.error).toBeNull();
		});
	});

	describe("ALIGNRP - Align Reference Point", () => {
		test("aligns point to reference", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 0;
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 200, y: 0 };

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 1;

			ALIGNRP(ctx);

			expect(ctx.pts.cur[1]!.x).toBe(100);
		});

		test("sets error for invalid rp0", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 999; // Invalid

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 1;

			ALIGNRP(ctx);

			expect(ctx.error).toContain("invalid rp0");
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 0;
			ctx.pts.cur[0] = { x: 100, y: 0 };

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 999; // Invalid

			ALIGNRP(ctx);

			expect(ctx.error).toContain("invalid point");
		});
	});

	describe("MSIRP - Move Stack Indirect Relative Point", () => {
		test("moves point to specified distance", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 0;
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[2] = { x: 200, y: 0 };

			ctx.stack[ctx.stackTop++] = 2; // Point
			ctx.stack[ctx.stackTop++] = 128; // Distance (2 pixels)

			MSIRP(ctx, true);

			expect(ctx.GS.rp0).toBe(2); // setRp0 = true
			expect(ctx.GS.rp2).toBe(2);
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 0;

			ctx.stack[ctx.stackTop++] = 999; // Invalid
			ctx.stack[ctx.stackTop++] = 128;

			MSIRP(ctx, true);

			expect(ctx.error).toContain("invalid point");
		});

		test("sets error for invalid rp0", () => {
			const ctx = createTestContext();
			ctx.GS.rp0 = 999; // Invalid

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 128;

			MSIRP(ctx, true);

			expect(ctx.error).toContain("invalid rp0");
		});
	});

	describe("ISECT - Move Point to Intersection", () => {
		test("finds intersection of two lines", () => {
			const ctx = createTestContext();

			// Line A: (0, 0) to (100, 100)
			ctx.pts.cur[0] = { x: 0, y: 0 };
			ctx.pts.cur[1] = { x: 100, y: 100 };

			// Line B: (0, 100) to (100, 0)
			ctx.pts.cur[2] = { x: 0, y: 100 };
			ctx.pts.cur[3] = { x: 100, y: 0 };

			ctx.pts.cur[4] = { x: 0, y: 0 }; // Point to move

			ctx.stack[ctx.stackTop++] = 4; // Point to move
			ctx.stack[ctx.stackTop++] = 0; // Line A point 0
			ctx.stack[ctx.stackTop++] = 1; // Line A point 1
			ctx.stack[ctx.stackTop++] = 2; // Line B point 0
			ctx.stack[ctx.stackTop++] = 3; // Line B point 1

			ISECT(ctx);

			// Lines intersect at (50, 50)
			expect(ctx.pts.cur[4]!.x).toBe(50);
			expect(ctx.pts.cur[4]!.y).toBe(50);
		});

		test("sets error for invalid line A points", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 4;
			ctx.stack[ctx.stackTop++] = 999; // Invalid
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 3;

			ISECT(ctx);

			expect(ctx.error).toContain("invalid line A points");
		});

		test("sets error for invalid line B points", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 4;
			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 999; // Invalid
			ctx.stack[ctx.stackTop++] = 3;

			ISECT(ctx);

			expect(ctx.error).toContain("invalid line B points");
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 999; // Invalid
			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 3;

			ISECT(ctx);

			expect(ctx.error).toContain("invalid point");
		});

		test("handles parallel lines", () => {
			const ctx = createTestContext();

			// Parallel horizontal lines
			ctx.pts.cur[0] = { x: 0, y: 0 };
			ctx.pts.cur[1] = { x: 100, y: 0 };
			ctx.pts.cur[2] = { x: 0, y: 100 };
			ctx.pts.cur[3] = { x: 100, y: 100 };
			ctx.pts.cur[4] = { x: 0, y: 0 };

			ctx.stack[ctx.stackTop++] = 4;
			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 3;

			ISECT(ctx);

			// Should move to midpoint of all four endpoints
			// (0 + 100 + 0 + 100) / 4 = 50, (0 + 0 + 100 + 100) / 4 = 50
			expect(ctx.pts.cur[4]!.x).toBe(50);
			expect(ctx.pts.cur[4]!.y).toBe(50);
		});
	});

	describe("ALIGNPTS - Align Points", () => {
		test("aligns two points to midpoint", () => {
			const ctx = createTestContext();
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 200, y: 0 };

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 1;

			ALIGNPTS(ctx);

			// Both should be at midpoint (150)
			expect(ctx.pts.cur[0]!.x).toBe(150);
			expect(ctx.pts.cur[1]!.x).toBe(150);
		});

		test("sets error for invalid p1", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 999; // Invalid
			ctx.stack[ctx.stackTop++] = 1;

			ALIGNPTS(ctx);

			expect(ctx.error).toContain("invalid point");
		});

		test("sets error for invalid p2", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 999; // Invalid

			ALIGNPTS(ctx);

			expect(ctx.error).toContain("invalid point");
		});
	});

	describe("GC - Get Coordinate", () => {
		test("gets current coordinate", () => {
			const ctx = createTestContext();
			ctx.pts.cur[5] = { x: 256, y: 128 };

			ctx.stack[ctx.stackTop++] = 5;

			GC(ctx, false);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(256);
		});

		test("gets original coordinate", () => {
			const ctx = createTestContext();
			ctx.pts.org[5] = { x: 200, y: 100 };
			ctx.pts.cur[5] = { x: 256, y: 128 };

			ctx.stack[ctx.stackTop++] = 5;

			GC(ctx, true);

			expect(ctx.stack[0]).toBe(200);
		});

		test("sets error for invalid point and pushes 0", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 999; // Invalid

			GC(ctx, false);

			expect(ctx.error).toContain("invalid point");
			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("SCFS - Set Coordinate From Stack", () => {
		test("sets coordinate", () => {
			const ctx = createTestContext();
			ctx.pts.cur[3] = { x: 100, y: 0 };

			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = 256;

			SCFS(ctx);

			expect(ctx.pts.cur[3]!.x).toBe(256);
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 999; // Invalid
			ctx.stack[ctx.stackTop++] = 256;

			SCFS(ctx);

			expect(ctx.error).toContain("invalid point");
		});
	});

	describe("MD - Measure Distance", () => {
		test("measures current distance", () => {
			const ctx = createTestContext();
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[2] = { x: 300, y: 0 };

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 2;

			MD(ctx, false);

			expect(ctx.stack[0]).toBe(200);
		});

		test("measures original distance", () => {
			const ctx = createTestContext();
			ctx.pts.org[0] = { x: 100, y: 0 };
			ctx.pts.org[2] = { x: 250, y: 0 };
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[2] = { x: 300, y: 0 };

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 2;

			MD(ctx, true);

			expect(ctx.stack[0]).toBe(150);
		});

		test("sets error for invalid p1 and pushes 0", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 999; // Invalid
			ctx.stack[ctx.stackTop++] = 2;

			MD(ctx, false);

			expect(ctx.error).toContain("invalid point");
			expect(ctx.stack[0]).toBe(0);
		});

		test("sets error for invalid p2 and pushes 0", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 999; // Invalid

			MD(ctx, false);

			expect(ctx.error).toContain("invalid point");
			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("MPPEM / MPS", () => {
		test("MPPEM pushes pixels per em", () => {
			const ctx = createTestContext();
			ctx.ppem = 24;

			MPPEM(ctx);

			expect(ctx.stack[0]).toBe(24);
		});

		test("MPS pushes point size", () => {
			const ctx = createTestContext();
			ctx.pointSize = 18;

			MPS(ctx);

			expect(ctx.stack[0]).toBe(18);
		});
	});

	describe("FLIPPT - Flip Point", () => {
		test("toggles on-curve flag", () => {
			const ctx = createTestContext();
			ctx.pts.tags[2] = 0x01; // On-curve

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 2;

			FLIPPT(ctx);

			expect(ctx.pts.tags[2]! & 0x01).toBe(0); // Now off-curve
		});

		test("sets error for invalid point", () => {
			const ctx = createTestContext();

			ctx.GS.loop = 1;
			ctx.stack[ctx.stackTop++] = 999; // Invalid

			FLIPPT(ctx);

			expect(ctx.error).toContain("invalid point");
		});
	});

	describe("FLIPRGON / FLIPRGOFF", () => {
		test("FLIPRGON sets range to on-curve", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 3;

			FLIPRGON(ctx);

			for (let i = 1; i <= 3; i++) {
				expect(ctx.pts.tags[i]! & 0x01).toBe(0x01);
			}
		});

		test("FLIPRGON sets error for invalid range", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 999; // Invalid

			FLIPRGON(ctx);

			expect(ctx.error).toContain("invalid range");
		});

		test("FLIPRGOFF clears range to off-curve", () => {
			const ctx = createTestContext();
			ctx.pts.tags[1] = 0x01;
			ctx.pts.tags[2] = 0x01;

			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 2;

			FLIPRGOFF(ctx);

			expect(ctx.pts.tags[1]! & 0x01).toBe(0);
			expect(ctx.pts.tags[2]! & 0x01).toBe(0);
		});

		test("FLIPRGOFF sets error for invalid range", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 999; // Invalid

			FLIPRGOFF(ctx);

			expect(ctx.error).toContain("invalid range");
		});
	});

	describe("ROUND / NROUND", () => {
		test("ROUND rounds value", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 100; // 1.5625 pixels

			ROUND(ctx, 0);

			expect(ctx.stack[0]).toBeGreaterThanOrEqual(64);
			expect(ctx.stack[0]).toBeLessThanOrEqual(128);
		});

		test("NROUND applies compensation only", () => {
			const ctx = createTestContext();
			const value = 100;

			ctx.stack[ctx.stackTop++] = value;

			NROUND(ctx, 0);

			// With zero compensation, should return original
			expect(ctx.stack[0]).toBe(value);
		});
	});
});
