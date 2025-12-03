import { describe, expect, test } from "bun:test";
import { UnicodeBuffer } from "../../src/buffer/unicode-buffer.ts";
import { BufferFlags, ClusterLevel, Direction } from "../../src/types.ts";

describe("UnicodeBuffer", () => {
	describe("construction", () => {
		test("creates empty buffer", () => {
			const buffer = new UnicodeBuffer();
			expect(buffer.length).toBe(0);
			expect(buffer.codepoints).toEqual([]);
			expect(buffer.clusters).toEqual([]);
		});

		test("has default values", () => {
			const buffer = new UnicodeBuffer();
			expect(buffer.direction).toBe(Direction.LTR);
			expect(buffer.script).toBe("Zyyy");
			expect(buffer.language).toBeNull();
			expect(buffer.clusterLevel).toBe(ClusterLevel.MonotoneGraphemes);
			expect(buffer.flags).toBe(BufferFlags.Default);
		});
	});

	describe("addStr", () => {
		test("adds ASCII string", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("hello");
			expect(buffer.length).toBe(5);
			expect(buffer.codepoints).toEqual([0x68, 0x65, 0x6c, 0x6c, 0x6f]);
		});

		test("tracks clusters sequentially", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("abc");
			expect(buffer.clusters).toEqual([0, 1, 2]);
		});

		test("uses custom start cluster", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("abc", 10);
			expect(buffer.clusters).toEqual([10, 11, 12]);
		});

		test("handles Unicode characters", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("日本語");
			expect(buffer.length).toBe(3);
			expect(buffer.codepoints).toEqual([0x65e5, 0x672c, 0x8a9e]);
		});

		test("handles surrogate pairs (emoji)", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("😀");
			expect(buffer.length).toBe(1);
			expect(buffer.codepoints).toEqual([0x1f600]);
		});

		test("handles mixed content", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("A日😀");
			expect(buffer.length).toBe(3);
			expect(buffer.codepoints).toEqual([0x41, 0x65e5, 0x1f600]);
		});

		test("chains multiple calls", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("ab").addStr("cd", 2);
			expect(buffer.codepoints).toEqual([0x61, 0x62, 0x63, 0x64]);
			expect(buffer.clusters).toEqual([0, 1, 2, 3]);
		});
	});

	describe("addCodepoints", () => {
		test("adds array of codepoints", () => {
			const buffer = new UnicodeBuffer();
			buffer.addCodepoints([0x41, 0x42, 0x43]);
			expect(buffer.codepoints).toEqual([0x41, 0x42, 0x43]);
		});

		test("tracks clusters", () => {
			const buffer = new UnicodeBuffer();
			buffer.addCodepoints([0x41, 0x42], 5);
			expect(buffer.clusters).toEqual([5, 6]);
		});

		test("chains with addStr", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("A").addCodepoints([0x42, 0x43], 1);
			expect(buffer.codepoints).toEqual([0x41, 0x42, 0x43]);
		});
	});

	describe("addCodepoint", () => {
		test("adds single codepoint", () => {
			const buffer = new UnicodeBuffer();
			buffer.addCodepoint(0x41);
			expect(buffer.codepoints).toEqual([0x41]);
		});

		test("auto-assigns cluster", () => {
			const buffer = new UnicodeBuffer();
			buffer.addCodepoint(0x41);
			buffer.addCodepoint(0x42);
			expect(buffer.clusters).toEqual([0, 1]);
		});

		test("uses custom cluster", () => {
			const buffer = new UnicodeBuffer();
			buffer.addCodepoint(0x41, 10);
			expect(buffer.clusters).toEqual([10]);
		});
	});

	describe("direction", () => {
		test("setDirection changes direction", () => {
			const buffer = new UnicodeBuffer();
			buffer.setDirection(Direction.RTL);
			expect(buffer.direction).toBe(Direction.RTL);
		});

		test("setDirection is chainable", () => {
			const buffer = new UnicodeBuffer()
				.setDirection(Direction.RTL)
				.addStr("test");
			expect(buffer.direction).toBe(Direction.RTL);
			expect(buffer.length).toBe(4);
		});

		test("supports all directions", () => {
			const buffer = new UnicodeBuffer();

			buffer.setDirection(Direction.LTR);
			expect(buffer.direction).toBe(Direction.LTR);

			buffer.setDirection(Direction.RTL);
			expect(buffer.direction).toBe(Direction.RTL);

			buffer.setDirection(Direction.TTB);
			expect(buffer.direction).toBe(Direction.TTB);

			buffer.setDirection(Direction.BTT);
			expect(buffer.direction).toBe(Direction.BTT);
		});
	});

	describe("script", () => {
		test("setScript changes script", () => {
			const buffer = new UnicodeBuffer();
			buffer.setScript("Latn");
			expect(buffer.script).toBe("Latn");
		});

		test("supports various scripts", () => {
			const buffer = new UnicodeBuffer();

			buffer.setScript("Arab");
			expect(buffer.script).toBe("Arab");

			buffer.setScript("Deva");
			expect(buffer.script).toBe("Deva");

			buffer.setScript("Hani");
			expect(buffer.script).toBe("Hani");
		});
	});

	describe("language", () => {
		test("setLanguage changes language", () => {
			const buffer = new UnicodeBuffer();
			buffer.setLanguage("en");
			expect(buffer.language).toBe("en");
		});

		test("can set to null", () => {
			const buffer = new UnicodeBuffer();
			buffer.setLanguage("en");
			buffer.setLanguage(null);
			expect(buffer.language).toBeNull();
		});

		test("supports BCP 47 tags", () => {
			const buffer = new UnicodeBuffer();

			buffer.setLanguage("en-US");
			expect(buffer.language).toBe("en-US");

			buffer.setLanguage("zh-Hans");
			expect(buffer.language).toBe("zh-Hans");
		});
	});

	describe("clusterLevel", () => {
		test("setClusterLevel changes level", () => {
			const buffer = new UnicodeBuffer();
			buffer.setClusterLevel(ClusterLevel.MonotoneCharacters);
			expect(buffer.clusterLevel).toBe(ClusterLevel.MonotoneCharacters);
		});

		test("supports all levels", () => {
			const buffer = new UnicodeBuffer();

			buffer.setClusterLevel(ClusterLevel.MonotoneGraphemes);
			expect(buffer.clusterLevel).toBe(ClusterLevel.MonotoneGraphemes);

			buffer.setClusterLevel(ClusterLevel.MonotoneCharacters);
			expect(buffer.clusterLevel).toBe(ClusterLevel.MonotoneCharacters);

			buffer.setClusterLevel(ClusterLevel.Characters);
			expect(buffer.clusterLevel).toBe(ClusterLevel.Characters);
		});
	});

	describe("flags", () => {
		test("setFlags changes flags", () => {
			const buffer = new UnicodeBuffer();
			buffer.setFlags(BufferFlags.BeginningOfText);
			expect(buffer.flags).toBe(BufferFlags.BeginningOfText);
		});

		test("supports combined flags", () => {
			const buffer = new UnicodeBuffer();
			const combined = BufferFlags.BeginningOfText | BufferFlags.EndOfText;
			buffer.setFlags(combined);
			expect(buffer.flags).toBe(combined);
		});
	});

	describe("context", () => {
		test("setPreContext sets pre-context", () => {
			const buffer = new UnicodeBuffer();
			buffer.setPreContext("abc");
			expect(buffer.preContext).toEqual([0x61, 0x62, 0x63]);
		});

		test("setPostContext sets post-context", () => {
			const buffer = new UnicodeBuffer();
			buffer.setPostContext("xyz");
			expect(buffer.postContext).toEqual([0x78, 0x79, 0x7a]);
		});

		test("context handles Unicode", () => {
			const buffer = new UnicodeBuffer();
			buffer.setPreContext("日本");
			expect(buffer.preContext).toEqual([0x65e5, 0x672c]);
		});

		test("setting context replaces previous", () => {
			const buffer = new UnicodeBuffer();
			buffer.setPreContext("abc");
			buffer.setPreContext("xy");
			expect(buffer.preContext).toEqual([0x78, 0x79]);
		});
	});

	describe("clear", () => {
		test("clears all data", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("hello");
			buffer.setPreContext("pre");
			buffer.setPostContext("post");
			buffer.clear();

			expect(buffer.length).toBe(0);
			expect(buffer.codepoints).toEqual([]);
			expect(buffer.clusters).toEqual([]);
			expect(buffer.preContext).toEqual([]);
			expect(buffer.postContext).toEqual([]);
		});

		test("preserves settings", () => {
			const buffer = new UnicodeBuffer();
			buffer.setDirection(Direction.RTL);
			buffer.setScript("Arab");
			buffer.addStr("test");
			buffer.clear();

			expect(buffer.direction).toBe(Direction.RTL);
			expect(buffer.script).toBe("Arab");
		});

		test("is chainable", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("old").clear().addStr("new");
			expect(buffer.codepoints).toEqual([0x6e, 0x65, 0x77]);
		});
	});

	describe("toGlyphInfos", () => {
		test("converts to GlyphInfo array", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("AB");
			const infos = buffer.toGlyphInfos();

			expect(infos.length).toBe(2);
			expect(infos[0]).toEqual({
				glyphId: 0,
				cluster: 0,
				mask: 0,
				codepoint: 0x41,
			});
			expect(infos[1]).toEqual({
				glyphId: 0,
				cluster: 1,
				mask: 0,
				codepoint: 0x42,
			});
		});

		test("preserves cluster values", () => {
			const buffer = new UnicodeBuffer();
			buffer.addStr("AB", 10);
			const infos = buffer.toGlyphInfos();

			expect(infos[0].cluster).toBe(10);
			expect(infos[1].cluster).toBe(11);
		});

		test("handles empty buffer", () => {
			const buffer = new UnicodeBuffer();
			const infos = buffer.toGlyphInfos();
			expect(infos).toEqual([]);
		});
	});

	describe("method chaining", () => {
		test("all setters are chainable", () => {
			const buffer = new UnicodeBuffer()
				.setDirection(Direction.RTL)
				.setScript("Arab")
				.setLanguage("ar")
				.setClusterLevel(ClusterLevel.Characters)
				.setFlags(BufferFlags.BeginningOfText)
				.setPreContext("pre")
				.setPostContext("post")
				.addStr("مرحبا");

			expect(buffer.direction).toBe(Direction.RTL);
			expect(buffer.script).toBe("Arab");
			expect(buffer.language).toBe("ar");
			expect(buffer.length).toBe(5);
		});
	});
});
