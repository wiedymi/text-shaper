import { describe, expect, test } from "bun:test";
import { GlyphBuffer } from "../../src/buffer/glyph-buffer.ts";
import { Direction, type GlyphInfo, type GlyphPosition } from "../../src/types.ts";

function createInfo(glyphId: number, cluster: number, codepoint = 0): GlyphInfo {
	return { glyphId, cluster, mask: 0, codepoint };
}

function createPosition(xAdvance = 0, yAdvance = 0, xOffset = 0, yOffset = 0): GlyphPosition {
	return { xAdvance, yAdvance, xOffset, yOffset };
}

describe("GlyphBuffer", () => {
	describe("construction", () => {
		test("creates empty buffer", () => {
			const buffer = new GlyphBuffer();
			expect(buffer.length).toBe(0);
			expect(buffer.infos).toEqual([]);
			expect(buffer.positions).toEqual([]);
		});

		test("has default values", () => {
			const buffer = new GlyphBuffer();
			expect(buffer.direction).toBe(Direction.LTR);
			expect(buffer.script).toBe("Zyyy");
			expect(buffer.language).toBeNull();
		});

		test("withCapacity creates empty buffer with capacity hint", () => {
			const buffer = GlyphBuffer.withCapacity(10);
			// Lazy allocation - arrays start empty, objects created on demand
			expect(buffer.length).toBe(0);
		});
	});

	describe("initFromInfos", () => {
		test("initializes from glyph infos", () => {
			const buffer = new GlyphBuffer();
			const infos = [
				createInfo(1, 0, 0x41),
				createInfo(2, 1, 0x42),
			];
			buffer.initFromInfos(infos);

			expect(buffer.length).toBe(2);
			expect(buffer.infos).toBe(infos);
		});

		test("creates zeroed positions", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);

			expect(buffer.positions[0]).toEqual({
				xAdvance: 0,
				yAdvance: 0,
				xOffset: 0,
				yOffset: 0,
			});
		});

		test("positions array matches infos length", () => {
			const buffer = new GlyphBuffer();
			const infos = [createInfo(1, 0), createInfo(2, 1), createInfo(3, 2)];
			buffer.initFromInfos(infos);

			expect(buffer.positions.length).toBe(infos.length);
		});
	});

	describe("setAdvance", () => {
		test("sets advance width", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.setAdvance(0, 500);

			expect(buffer.positions[0].xAdvance).toBe(500);
			expect(buffer.positions[0].yAdvance).toBe(0);
		});

		test("sets both x and y advance", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.setAdvance(0, 500, 100);

			expect(buffer.positions[0].xAdvance).toBe(500);
			expect(buffer.positions[0].yAdvance).toBe(100);
		});

		test("handles out of bounds gracefully", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.setAdvance(10, 500); // No error thrown
		});
	});

	describe("addOffset", () => {
		test("adds to offset", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.addOffset(0, 10, 20);

			expect(buffer.positions[0].xOffset).toBe(10);
			expect(buffer.positions[0].yOffset).toBe(20);
		});

		test("accumulates offsets", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.addOffset(0, 10, 20);
			buffer.addOffset(0, 5, 10);

			expect(buffer.positions[0].xOffset).toBe(15);
			expect(buffer.positions[0].yOffset).toBe(30);
		});

		test("handles out of bounds gracefully", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.addOffset(10, 5, 5); // No error thrown
		});
	});

	describe("replaceGlyph", () => {
		test("replaces glyph ID", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.replaceGlyph(0, 100);

			expect(buffer.infos[0].glyphId).toBe(100);
		});

		test("preserves other info", () => {
			const buffer = new GlyphBuffer();
			const info = createInfo(1, 5, 0x41);
			info.mask = 0xff;
			buffer.initFromInfos([info]);
			buffer.replaceGlyph(0, 100);

			expect(buffer.infos[0].cluster).toBe(5);
			expect(buffer.infos[0].codepoint).toBe(0x41);
			expect(buffer.infos[0].mask).toBe(0xff);
		});

		test("handles out of bounds gracefully", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.replaceGlyph(10, 100); // No error thrown
		});
	});

	describe("insertGlyph", () => {
		test("inserts at beginning", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(2, 1)]);
			buffer.insertGlyph(0, createInfo(1, 0), createPosition(100));

			expect(buffer.length).toBe(2);
			expect(buffer.infos[0].glyphId).toBe(1);
			expect(buffer.infos[1].glyphId).toBe(2);
		});

		test("inserts at end", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.insertGlyph(1, createInfo(2, 1), createPosition(100));

			expect(buffer.length).toBe(2);
			expect(buffer.infos[1].glyphId).toBe(2);
		});

		test("inserts in middle", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(3, 2)]);
			buffer.insertGlyph(1, createInfo(2, 1), createPosition(100));

			expect(buffer.length).toBe(3);
			expect(buffer.infos[0].glyphId).toBe(1);
			expect(buffer.infos[1].glyphId).toBe(2);
			expect(buffer.infos[2].glyphId).toBe(3);
		});

		test("inserts position correctly", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.insertGlyph(0, createInfo(2, 0), createPosition(500, 0, 10, 20));

			expect(buffer.positions[0]).toEqual({
				xAdvance: 500,
				yAdvance: 0,
				xOffset: 10,
				yOffset: 20,
			});
		});
	});

	describe("removeRange", () => {
		test("removes single element", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1), createInfo(3, 2)]);
			buffer.removeRange(1, 2);

			expect(buffer.length).toBe(2);
			expect(buffer.infos[0].glyphId).toBe(1);
			expect(buffer.infos[1].glyphId).toBe(3);
		});

		test("removes multiple elements", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([
				createInfo(1, 0),
				createInfo(2, 1),
				createInfo(3, 2),
				createInfo(4, 3),
			]);
			buffer.removeRange(1, 3);

			expect(buffer.length).toBe(2);
			expect(buffer.infos[0].glyphId).toBe(1);
			expect(buffer.infos[1].glyphId).toBe(4);
		});

		test("removes from beginning", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1)]);
			buffer.removeRange(0, 1);

			expect(buffer.length).toBe(1);
			expect(buffer.infos[0].glyphId).toBe(2);
		});

		test("removes positions too", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1)]);
			buffer.setAdvance(0, 100);
			buffer.setAdvance(1, 200);
			buffer.removeRange(0, 1);

			expect(buffer.positions.length).toBe(1);
			expect(buffer.positions[0].xAdvance).toBe(200);
		});
	});

	describe("mergeClusters", () => {
		test("merges cluster values", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([
				createInfo(1, 0),
				createInfo(2, 1),
				createInfo(3, 2),
			]);
			buffer.mergeClusters(0, 2);

			expect(buffer.infos[0].cluster).toBe(0);
			expect(buffer.infos[1].cluster).toBe(0);
			expect(buffer.infos[2].cluster).toBe(0);
		});

		test("uses first cluster value", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([
				createInfo(1, 5),
				createInfo(2, 6),
				createInfo(3, 7),
			]);
			buffer.mergeClusters(0, 2);

			expect(buffer.infos[1].cluster).toBe(5);
			expect(buffer.infos[2].cluster).toBe(5);
		});

		test("handles invalid ranges", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.mergeClusters(5, 10); // No error
			buffer.mergeClusters(-1, 0); // No error
		});

		test("does nothing for start >= end", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1)]);
			buffer.mergeClusters(1, 0);

			expect(buffer.infos[0].cluster).toBe(0);
			expect(buffer.infos[1].cluster).toBe(1);
		});
	});

	describe("reverse", () => {
		test("reverses both arrays", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1), createInfo(3, 2)]);
			buffer.setAdvance(0, 100);
			buffer.setAdvance(1, 200);
			buffer.setAdvance(2, 300);
			buffer.reverse();

			expect(buffer.infos.map(i => i.glyphId)).toEqual([3, 2, 1]);
			expect(buffer.positions.map(p => p.xAdvance)).toEqual([300, 200, 100]);
		});

		test("handles empty buffer", () => {
			const buffer = new GlyphBuffer();
			buffer.reverse(); // No error
		});

		test("handles single element", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.reverse();

			expect(buffer.infos[0].glyphId).toBe(1);
		});
	});

	describe("reverseRange", () => {
		test("reverses subset of buffer", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([
				createInfo(1, 0),
				createInfo(2, 1),
				createInfo(3, 2),
				createInfo(4, 3),
			]);
			buffer.reverseRange(1, 3);

			expect(buffer.infos.map(i => i.glyphId)).toEqual([1, 3, 2, 4]);
		});

		test("reverses positions too", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1), createInfo(3, 2)]);
			buffer.setAdvance(0, 100);
			buffer.setAdvance(1, 200);
			buffer.setAdvance(2, 300);
			buffer.reverseRange(0, 3);

			expect(buffer.positions.map(p => p.xAdvance)).toEqual([300, 200, 100]);
		});
	});

	describe("getTotalAdvance", () => {
		test("sums advances", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1), createInfo(3, 2)]);
			buffer.setAdvance(0, 100);
			buffer.setAdvance(1, 200);
			buffer.setAdvance(2, 300);

			expect(buffer.getTotalAdvance()).toEqual({ x: 600, y: 0 });
		});

		test("includes y advance", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1)]);
			buffer.setAdvance(0, 100, 50);
			buffer.setAdvance(1, 200, 100);

			expect(buffer.getTotalAdvance()).toEqual({ x: 300, y: 150 });
		});

		test("returns zero for empty buffer", () => {
			const buffer = new GlyphBuffer();
			expect(buffer.getTotalAdvance()).toEqual({ x: 0, y: 0 });
		});
	});

	describe("serialize", () => {
		test("serializes basic glyphs", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1)]);
			buffer.setAdvance(0, 100);
			buffer.setAdvance(1, 200);

			const result = buffer.serialize();
			expect(result).toContain("1=0");
			expect(result).toContain("2=1");
		});

		test("includes offsets when present", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.setAdvance(0, 100);
			buffer.addOffset(0, 10, 20);

			const result = buffer.serialize();
			expect(result).toContain("@10,20");
		});

		test("includes advance when non-zero", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.setAdvance(0, 100);

			const result = buffer.serialize();
			expect(result).toContain("+100");
		});

		test("handles empty buffer", () => {
			const buffer = new GlyphBuffer();
			expect(buffer.serialize()).toBe("[]");
		});
	});

	describe("glyphIds", () => {
		test("returns array of glyph IDs", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1), createInfo(3, 2)]);

			expect(buffer.glyphIds()).toEqual([1, 2, 3]);
		});

		test("returns empty array for empty buffer", () => {
			const buffer = new GlyphBuffer();
			expect(buffer.glyphIds()).toEqual([]);
		});
	});

	describe("clusters", () => {
		test("returns array of cluster values", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 0), createInfo(3, 1)]);

			expect(buffer.clusters()).toEqual([0, 0, 1]);
		});
	});

	describe("iterator", () => {
		test("iterates over info/position pairs", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0), createInfo(2, 1)]);
			buffer.setAdvance(0, 100);
			buffer.setAdvance(1, 200);

			const pairs = [...buffer];
			expect(pairs.length).toBe(2);
			expect(pairs[0].info.glyphId).toBe(1);
			expect(pairs[0].position.xAdvance).toBe(100);
			expect(pairs[1].info.glyphId).toBe(2);
			expect(pairs[1].position.xAdvance).toBe(200);
		});

		test("works with for...of", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([createInfo(1, 0)]);
			buffer.setAdvance(0, 100);

			let count = 0;
			for (const { info, position } of buffer) {
				expect(info.glyphId).toBe(1);
				expect(position.xAdvance).toBe(100);
				count++;
			}
			expect(count).toBe(1);
		});
	});

	describe("properties", () => {
		test("direction can be set", () => {
			const buffer = new GlyphBuffer();
			buffer.direction = Direction.RTL;
			expect(buffer.direction).toBe(Direction.RTL);
		});

		test("script can be set", () => {
			const buffer = new GlyphBuffer();
			buffer.script = "Arab";
			expect(buffer.script).toBe("Arab");
		});

		test("language can be set", () => {
			const buffer = new GlyphBuffer();
			buffer.language = "ar";
			expect(buffer.language).toBe("ar");
		});
	});
});
