import { describe, test, expect } from "bun:test";
import {
	createExecContext,
	createGlyphZone,
	RoundMode,
	type ExecContext,
} from "../../../src/hinting/types.ts";
import {
	SVTCA,
	SPVTCA,
	SFVTCA,
	SPVTL,
	SFVTL,
	SDPVTL,
	SPVFS,
	SFVFS,
	GPV,
	GFV,
	SFVTPV,
	SRP0,
	SRP1,
	SRP2,
	SZP0,
	SZP1,
	SZP2,
	SZPS,
	SLOOP,
	SMD,
	SCVTCI,
	SSWCI,
	SSW,
	SDB,
	SDS,
	RTG,
	RTHG,
	RTDG,
	RDTG,
	RUTG,
	ROFF,
	SROUND,
	S45ROUND,
	FLIPON,
	FLIPOFF,
	SCANCTRL,
	SCANTYPE,
	INSTCTRL,
	GETINFO,
	RS,
	WS,
	RCVT,
	WCVTP,
	WCVTF,
	UTP,
} from "../../../src/hinting/instructions/graphics-state.ts";
import { TouchFlag } from "../../../src/hinting/types.ts";

describe("Graphics State Instructions", () => {
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
			zone.orus[i] = { x: i * 64, y: i * 64 };
			zone.tags[i] = 0;
		}

		ctx.pts = zone;
		ctx.zp0 = zone;
		ctx.zp1 = zone;
		ctx.zp2 = zone;

		return ctx;
	}

	describe("Vector Instructions", () => {
		describe("SVTCA", () => {
			test("sets vectors to Y axis", () => {
				const ctx = createTestContext();
				SVTCA(ctx, 0);

				expect(ctx.GS.projVector).toEqual({ x: 0, y: 0x4000 });
				expect(ctx.GS.freeVector).toEqual({ x: 0, y: 0x4000 });
				expect(ctx.GS.dualVector).toEqual({ x: 0, y: 0x4000 });
			});

			test("sets vectors to X axis", () => {
				const ctx = createTestContext();
				SVTCA(ctx, 1);

				expect(ctx.GS.projVector).toEqual({ x: 0x4000, y: 0 });
				expect(ctx.GS.freeVector).toEqual({ x: 0x4000, y: 0 });
				expect(ctx.GS.dualVector).toEqual({ x: 0x4000, y: 0 });
			});
		});

		describe("SPVTCA", () => {
			test("sets projection vector to Y axis", () => {
				const ctx = createTestContext();
				ctx.GS.freeVector = { x: 0x2000, y: 0x2000 };

				SPVTCA(ctx, 0);

				expect(ctx.GS.projVector).toEqual({ x: 0, y: 0x4000 });
				expect(ctx.GS.dualVector).toEqual({ x: 0, y: 0x4000 });
				expect(ctx.GS.freeVector).toEqual({ x: 0x2000, y: 0x2000 });
			});

			test("sets projection vector to X axis", () => {
				const ctx = createTestContext();
				SPVTCA(ctx, 1);

				expect(ctx.GS.projVector).toEqual({ x: 0x4000, y: 0 });
				expect(ctx.GS.dualVector).toEqual({ x: 0x4000, y: 0 });
			});
		});

		describe("SFVTCA", () => {
			test("sets freedom vector to Y axis", () => {
				const ctx = createTestContext();
				ctx.GS.projVector = { x: 0x2000, y: 0x2000 };

				SFVTCA(ctx, 0);

				expect(ctx.GS.freeVector).toEqual({ x: 0, y: 0x4000 });
				expect(ctx.GS.projVector).toEqual({ x: 0x2000, y: 0x2000 });
			});

			test("sets freedom vector to X axis", () => {
				const ctx = createTestContext();
				SFVTCA(ctx, 1);

				expect(ctx.GS.freeVector).toEqual({ x: 0x4000, y: 0 });
			});
		});

		describe("SPVTL", () => {
			test("sets projection vector to line", () => {
				const ctx = createTestContext();
				ctx.pts.cur[0] = { x: 0, y: 0 };
				ctx.pts.cur[2] = { x: 400, y: 0 };

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 2;

				SPVTL(ctx, false);

				expect(ctx.GS.projVector.x).toBe(0x4000);
				expect(ctx.GS.projVector.y).toBe(0);
			});

			test("sets projection vector perpendicular to line", () => {
				const ctx = createTestContext();
				ctx.pts.cur[0] = { x: 0, y: 0 };
				ctx.pts.cur[2] = { x: 400, y: 0 };

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 2;

				SPVTL(ctx, true);

				expect(ctx.GS.projVector.x).toBe(0);
				expect(ctx.GS.projVector.y).toBe(-0x4000);
			});

			test("handles zero length vector", () => {
				const ctx = createTestContext();
				ctx.pts.cur[0] = { x: 100, y: 100 };
				ctx.pts.cur[1] = { x: 100, y: 100 };

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 1;

				SPVTL(ctx, false);

				expect(ctx.GS.projVector).toEqual({ x: 0x4000, y: 0 });
			});

			test("handles diagonal vector", () => {
				const ctx = createTestContext();
				ctx.pts.cur[0] = { x: 0, y: 0 };
				ctx.pts.cur[1] = { x: 300, y: 400 };

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 1;

				SPVTL(ctx, false);

				expect(ctx.GS.projVector.x).toBeGreaterThan(0);
				expect(ctx.GS.projVector.y).toBeGreaterThan(0);
			});

			test("handles out of bounds points", () => {
				const ctx = createTestContext();
				ctx.pts.cur.length = 5; // Limit array

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 999; // Out of bounds

				SPVTL(ctx, false);

				expect(ctx.GS.projVector).toEqual({ x: 0x4000, y: 0 });
			});
		});

		describe("SFVTL", () => {
			test("sets freedom vector to line", () => {
				const ctx = createTestContext();
				ctx.pts.cur[0] = { x: 0, y: 0 };
				ctx.pts.cur[2] = { x: 0, y: 400 };

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 2;

				SFVTL(ctx, false);

				expect(ctx.GS.freeVector.x).toBe(0);
				expect(ctx.GS.freeVector.y).toBe(0x4000);
			});

			test("sets freedom vector perpendicular to line", () => {
				const ctx = createTestContext();
				ctx.pts.cur[0] = { x: 0, y: 0 };
				ctx.pts.cur[2] = { x: 0, y: 400 };

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 2;

				SFVTL(ctx, true);

				expect(ctx.GS.freeVector.x).toBe(0x4000);
				expect(Math.abs(ctx.GS.freeVector.y)).toBe(0);
			});
		});

		describe("SDPVTL", () => {
			test("sets dual projection vector to line", () => {
				const ctx = createTestContext();
				const originalProj = { ...ctx.GS.projVector };
				ctx.pts.cur[0] = { x: 0, y: 0 };
				ctx.pts.cur[2] = { x: 400, y: 0 };
				ctx.pts.org[0] = { x: 0, y: 0 };
				ctx.pts.org[2] = { x: 400, y: 0 };

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 2;

			SDPVTL(ctx, false);

			expect(ctx.GS.dualVector.x).toBe(0x4000);
			expect(ctx.GS.projVector).toEqual(originalProj);
		});

			test("sets dual vector perpendicular to line", () => {
				const ctx = createTestContext();
				ctx.pts.cur[0] = { x: 0, y: 0 };
				ctx.pts.cur[2] = { x: 400, y: 0 };
				ctx.pts.org[0] = { x: 0, y: 0 };
				ctx.pts.org[2] = { x: 400, y: 0 };

				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 2;

			SDPVTL(ctx, true);

			expect(ctx.GS.dualVector.x).toBe(0);
			expect(ctx.GS.dualVector.y).toBe(-0x4000);
		});
	});

		describe("SPVFS", () => {
			test("sets projection vector from stack", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 0x4000;
				ctx.stack[ctx.stackTop++] = 0;

				SPVFS(ctx);

				expect(ctx.GS.projVector).toEqual({ x: 0x4000, y: 0 });
				expect(ctx.GS.dualVector).toEqual({ x: 0x4000, y: 0 });
			});

			test("normalizes vector", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 100;

				SPVFS(ctx);

				const len = Math.sqrt(ctx.GS.projVector.x ** 2 + ctx.GS.projVector.y ** 2);
				expect(Math.abs(len - 0x4000)).toBeLessThan(10);
			});

			test("handles zero vector", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 0;

				SPVFS(ctx);

				expect(ctx.GS.projVector).toEqual({ x: 0x4000, y: 0 });
			});
		});

		describe("SFVFS", () => {
			test("sets freedom vector from stack", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 0x4000;

				SFVFS(ctx);

				expect(ctx.GS.freeVector).toEqual({ x: 0, y: 0x4000 });
			});

			test("normalizes vector", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 300;
				ctx.stack[ctx.stackTop++] = 400;

				SFVFS(ctx);

				const len = Math.sqrt(ctx.GS.freeVector.x ** 2 + ctx.GS.freeVector.y ** 2);
				expect(Math.abs(len - 0x4000)).toBeLessThan(10);
			});
		});

		describe("GPV", () => {
			test("gets projection vector", () => {
				const ctx = createTestContext();
				ctx.GS.projVector = { x: 0x2000, y: 0x3000 };

				GPV(ctx);

				expect(ctx.stack[0]).toBe(0x2000);
				expect(ctx.stack[1]).toBe(0x3000);
				expect(ctx.stackTop).toBe(2);
			});
		});

		describe("GFV", () => {
			test("gets freedom vector", () => {
				const ctx = createTestContext();
				ctx.GS.freeVector = { x: 0x1000, y: 0x3800 };

				GFV(ctx);

				expect(ctx.stack[0]).toBe(0x1000);
				expect(ctx.stack[1]).toBe(0x3800);
				expect(ctx.stackTop).toBe(2);
			});
		});

		describe("SFVTPV", () => {
			test("sets freedom vector to projection vector", () => {
				const ctx = createTestContext();
				ctx.GS.projVector = { x: 0x2000, y: 0x2000 };
				ctx.GS.freeVector = { x: 0x4000, y: 0 };

				SFVTPV(ctx);

				expect(ctx.GS.freeVector).toEqual({ x: 0x2000, y: 0x2000 });
			});
		});
	});

	describe("Reference Point Instructions", () => {
		test("SRP0 sets reference point 0", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 5;

			SRP0(ctx);

			expect(ctx.GS.rp0).toBe(5);
			expect(ctx.stackTop).toBe(0);
		});

		test("SRP1 sets reference point 1", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 7;

			SRP1(ctx);

			expect(ctx.GS.rp1).toBe(7);
		});

		test("SRP2 sets reference point 2", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 3;

			SRP2(ctx);

			expect(ctx.GS.rp2).toBe(3);
		});
	});

	describe("Zone Pointer Instructions", () => {
		test("SZP0 sets zone pointer 0", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 0;

			SZP0(ctx);

			expect(ctx.GS.gep0).toBe(0);
			expect(ctx.zp0).toBe(ctx.twilight);
		});

		test("SZP0 sets zone pointer to glyph zone", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 1;

			SZP0(ctx);

			expect(ctx.GS.gep0).toBe(1);
			expect(ctx.zp0).toBe(ctx.pts);
		});

		test("SZP0 rejects invalid zone", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 2;

			SZP0(ctx);

			expect(ctx.error).toContain("invalid zone");
		});

		test("SZP1 sets zone pointer 1", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 0;

			SZP1(ctx);

			expect(ctx.GS.gep1).toBe(0);
			expect(ctx.zp1).toBe(ctx.twilight);
		});

		test("SZP1 rejects invalid zone", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 3;

			SZP1(ctx);

			expect(ctx.error).toContain("invalid zone");
		});

		test("SZP2 sets zone pointer 2", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 1;

			SZP2(ctx);

			expect(ctx.GS.gep2).toBe(1);
			expect(ctx.zp2).toBe(ctx.pts);
		});

		test("SZP2 rejects invalid zone", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = -1;

			SZP2(ctx);

			expect(ctx.error).toContain("invalid zone");
		});

		test("SZPS sets all zone pointers", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 0;

			SZPS(ctx);

			expect(ctx.GS.gep0).toBe(0);
			expect(ctx.GS.gep1).toBe(0);
			expect(ctx.GS.gep2).toBe(0);
			expect(ctx.zp0).toBe(ctx.twilight);
			expect(ctx.zp1).toBe(ctx.twilight);
			expect(ctx.zp2).toBe(ctx.twilight);
		});

		test("SZPS rejects invalid zone", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 5;

			SZPS(ctx);

			expect(ctx.error).toContain("invalid zone");
		});
	});

	describe("Graphics State Parameters", () => {
		test("SLOOP sets loop counter", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;

			SLOOP(ctx);

			expect(ctx.GS.loop).toBe(10);
		});

		test("SLOOP rejects zero or negative count", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 0;

			SLOOP(ctx);

			expect(ctx.error).toBeNull();
			expect(ctx.GS.loop).toBe(0);
		});

		test("SLOOP rejects negative count", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = -5;

			SLOOP(ctx);

			expect(ctx.error).toBeNull();
			expect(ctx.GS.loop).toBe(0);
		});

		test("SMD sets minimum distance", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 128;

			SMD(ctx);

			expect(ctx.GS.minimumDistance).toBe(128);
		});

		test("SCVTCI sets control value cut-in", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			SCVTCI(ctx);

			expect(ctx.GS.controlValueCutIn).toBe(100);
		});

		test("SSWCI sets single width cut-in", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 50;

			SSWCI(ctx);

			expect(ctx.GS.singleWidthCutIn).toBe(50);
		});

		test("SSW sets single width value", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 75;

			SSW(ctx);

			expect(ctx.GS.singleWidthValue).toBe(75);
		});

		test("SDB sets delta base", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 12;

			SDB(ctx);

			expect(ctx.GS.deltaBase).toBe(12);
		});

		test("SDS sets delta shift", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 4;

			SDS(ctx);

			expect(ctx.GS.deltaShift).toBe(4);
		});
	});

	describe("Rounding State Instructions", () => {
		test("RTG sets round to grid", () => {
			const ctx = createTestContext();
			RTG(ctx);

			expect(ctx.GS.roundState).toBe(RoundMode.ToGrid);
		});

		test("RTHG sets round to half grid", () => {
			const ctx = createTestContext();
			RTHG(ctx);

			expect(ctx.GS.roundState).toBe(RoundMode.ToHalfGrid);
		});

		test("RTDG sets round to double grid", () => {
			const ctx = createTestContext();
			RTDG(ctx);

			expect(ctx.GS.roundState).toBe(RoundMode.ToDoubleGrid);
		});

		test("RDTG sets round down to grid", () => {
			const ctx = createTestContext();
			RDTG(ctx);

			expect(ctx.GS.roundState).toBe(RoundMode.DownToGrid);
		});

		test("RUTG sets round up to grid", () => {
			const ctx = createTestContext();
			RUTG(ctx);

			expect(ctx.GS.roundState).toBe(RoundMode.UpToGrid);
		});

		test("ROFF sets rounding off", () => {
			const ctx = createTestContext();
			ROFF(ctx);

			expect(ctx.GS.roundState).toBe(RoundMode.Off);
		});

		test("SROUND sets super round mode", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 0x40; // Period = 1 pixel, phase = 0

			SROUND(ctx);

			expect(ctx.GS.roundState).toBe(RoundMode.Super);
			expect(ctx.GS.period).toBe(64);
		});

		test("SROUND parses selector byte", () => {
			const ctx = createTestContext();
			// Bits 6-7: 01 (period = 64)
			// Bits 4-5: 10 (phase = period/2)
			// Bits 0-3: 1000 (threshold)
			ctx.stack[ctx.stackTop++] = 0x68;

			SROUND(ctx);

			expect(ctx.GS.period).toBe(64);
			expect(ctx.GS.phase).toBe(32);
			expect(ctx.GS.roundState).toBe(RoundMode.Super);
		});

		test("S45ROUND sets super round 45 mode", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 0x40;

			S45ROUND(ctx);

			expect(ctx.GS.roundState).toBe(RoundMode.Super45);
			expect(ctx.GS.period).toBe(64);
		});
	});

	describe("Auto-flip Instructions", () => {
		test("FLIPON enables auto-flip", () => {
			const ctx = createTestContext();
			ctx.GS.autoFlip = false;

			FLIPON(ctx);

			expect(ctx.GS.autoFlip).toBe(true);
		});

		test("FLIPOFF disables auto-flip", () => {
			const ctx = createTestContext();
			ctx.GS.autoFlip = true;

			FLIPOFF(ctx);

			expect(ctx.GS.autoFlip).toBe(false);
		});
	});

	describe("Scan Control Instructions", () => {
		test("SCANCTRL sets scan control", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 0x1234;

			SCANCTRL(ctx);

			expect(ctx.GS.scanControl).toBe(0x1234);
		});

		test("SCANTYPE sets scan type", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 2;

			SCANTYPE(ctx);

			expect(ctx.GS.scanType).toBe(2);
		});
	});

	describe("INSTCTRL", () => {
		test("sets bit 0 (inhibit grid-fitting)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 1;

			INSTCTRL(ctx);

			expect(ctx.GS.instructControl & 1).toBe(1);
		});

		test("clears bit 0", () => {
			const ctx = createTestContext();
			ctx.GS.instructControl = 1;
			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 1;

			INSTCTRL(ctx);

			expect(ctx.GS.instructControl & 1).toBe(0);
		});

		test("sets bit 1 (ignore CVT)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 2;

			INSTCTRL(ctx);

			expect(ctx.GS.instructControl & 2).toBe(2);
		});

		test("clears bit 1", () => {
			const ctx = createTestContext();
			ctx.GS.instructControl = 2;
			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = 2;

			INSTCTRL(ctx);

			expect(ctx.GS.instructControl & 2).toBe(0);
		});

		test("ignores invalid selectors", () => {
			const ctx = createTestContext();
			const originalControl = ctx.GS.instructControl;
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 3;

			INSTCTRL(ctx);

			expect(ctx.GS.instructControl).toBe(originalControl);
		});
	});

	describe("GETINFO", () => {
		test("returns version info", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 1;

			GETINFO(ctx);

			expect(ctx.stack[0]).toBe(40);
		});

		test("returns grayscale flag", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 32;

			GETINFO(ctx);

			expect(ctx.stack[0] & (1 << 12)).toBeTruthy();
		});

		test("combines multiple flags", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 1 | 32;

			GETINFO(ctx);

			const result = ctx.stack[0]!;
			expect(result & 40).toBeTruthy();
			expect(result & (1 << 12)).toBeTruthy();
		});

		test("returns zero for unsupported flags", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 0;

			GETINFO(ctx);

			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("Storage Instructions", () => {
		test("RS reads storage", () => {
			const ctx = createTestContext();
			ctx.storage[5] = 1234;
			ctx.stack[ctx.stackTop++] = 5;

			RS(ctx);

			expect(ctx.stack[0]).toBe(1234);
			expect(ctx.stackTop).toBe(1);
		});

		test("RS handles invalid index (negative)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = -1;

			RS(ctx);

			expect(ctx.error).toContain("invalid index");
			expect(ctx.stack[0]).toBe(0);
		});

		test("RS handles invalid index (too large)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 999;

			RS(ctx);

			expect(ctx.error).toContain("invalid index");
		});

		test("WS writes storage", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 5678;

			WS(ctx);

			expect(ctx.storage[10]).toBe(5678);
		});

		test("WS handles invalid index (negative)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = -1;
			ctx.stack[ctx.stackTop++] = 100;

			WS(ctx);

			expect(ctx.error).toContain("invalid index");
		});

		test("WS handles invalid index (too large)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 999;
			ctx.stack[ctx.stackTop++] = 100;

			WS(ctx);

			expect(ctx.error).toContain("invalid index");
		});
	});

	describe("CVT Instructions", () => {
		test("RCVT reads CVT value", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([100, 200, 300]);
			ctx.cvtSize = 3;
			ctx.stack[ctx.stackTop++] = 1;

			RCVT(ctx);

			expect(ctx.stack[0]).toBe(200);
		});

		test("RCVT handles invalid index (negative)", () => {
			const ctx = createTestContext();
			ctx.cvtSize = 5;
			ctx.stack[ctx.stackTop++] = -1;

			RCVT(ctx);

			expect(ctx.error).toContain("invalid index");
			expect(ctx.stack[0]).toBe(0);
		});

		test("RCVT handles invalid index (too large)", () => {
			const ctx = createTestContext();
			ctx.cvtSize = 5;
			ctx.stack[ctx.stackTop++] = 999;

			RCVT(ctx);

			expect(ctx.error).toContain("invalid index");
		});

		test("WCVTP writes CVT value in pixels", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = 256;

			WCVTP(ctx);

			expect(ctx.cvt[3]).toBe(256);
		});

		test("WCVTP handles invalid index", () => {
			const ctx = createTestContext();
			ctx.cvtSize = 5;
			ctx.stack[ctx.stackTop++] = 999;
			ctx.stack[ctx.stackTop++] = 100;

			WCVTP(ctx);

			expect(ctx.error).toContain("invalid index");
		});

		test("WCVTF writes CVT value in font units", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.scale = 1.5;
			ctx.scaleFix = Math.round(ctx.scale * 0x10000);
			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = 100;

			WCVTF(ctx);

			expect(ctx.cvt[2]).toBe(150);
		});

		test("WCVTF handles invalid index", () => {
			const ctx = createTestContext();
			ctx.cvtSize = 5;
			ctx.stack[ctx.stackTop++] = -5;
			ctx.stack[ctx.stackTop++] = 100;

			WCVTF(ctx);

			expect(ctx.error).toContain("invalid index");
		});
	});

	describe("UTP - UnTouch Point", () => {
		test("clears Y touch flag", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0, y: 0x4000 };
			ctx.pts.tags[3] = TouchFlag.Both;
			ctx.stack[ctx.stackTop++] = 3;

			UTP(ctx);

			expect(ctx.pts.tags[3]! & TouchFlag.Y).toBe(0);
			expect(ctx.pts.tags[3]! & TouchFlag.X).toBe(TouchFlag.X);
		});

		test("clears X touch flag", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0x4000, y: 0 };
			ctx.pts.tags[3] = TouchFlag.Both;
			ctx.stack[ctx.stackTop++] = 3;

			UTP(ctx);

			expect(ctx.pts.tags[3]! & TouchFlag.X).toBe(0);
			expect(ctx.pts.tags[3]! & TouchFlag.Y).toBe(TouchFlag.Y);
		});

		test("clears both flags for diagonal vector", () => {
			const ctx = createTestContext();
			ctx.GS.freeVector = { x: 0x2000, y: 0x2000 };
			ctx.pts.tags[3] = TouchFlag.Both;
			ctx.stack[ctx.stackTop++] = 3;

			UTP(ctx);

			expect(ctx.pts.tags[3]).toBe(0);
		});

		test("handles invalid point index", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 999;

			UTP(ctx);

			expect(ctx.error).toContain("invalid point");
		});

		test("handles negative point index", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = -1;

			UTP(ctx);

			expect(ctx.error).toContain("invalid point");
		});
	});
});
