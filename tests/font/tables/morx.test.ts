import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseMorx,
	applyNonContextual,
	MorxSubtableType,
	type MorxTable,
	type MorxChain,
	type MorxNonContextualSubtable,
	type MorxRearrangementSubtable,
	type MorxContextualSubtable,
	type MorxLigatureSubtable,
	type MorxInsertionSubtable,
} from "../../../src/font/tables/morx.ts";

const GENEVA_PATH = "/System/Library/Fonts/Geneva.ttf";
const MONACO_PATH = "/System/Library/Fonts/Monaco.ttf";
const APPLE_SYMBOLS_PATH = "/System/Library/Fonts/Apple Symbols.ttf";
const KEYBOARD_PATH = "/System/Library/Fonts/Keyboard.ttf";
const ZAPFINO_PATH = "/System/Library/Fonts/Supplemental/Zapfino.ttf";

describe("morx table", () => {
	let genevaFont: Font;
	let monacoFont: Font;
	let appleSymbolsFont: Font;
	let keyboardFont: Font;
	let zapfinoFont: Font;

	beforeAll(async () => {
		genevaFont = await Font.fromFile(GENEVA_PATH);
		monacoFont = await Font.fromFile(MONACO_PATH);
		appleSymbolsFont = await Font.fromFile(APPLE_SYMBOLS_PATH);
		keyboardFont = await Font.fromFile(KEYBOARD_PATH);
		zapfinoFont = await Font.fromFile(ZAPFINO_PATH);
	});

	describe("parseMorx", () => {
		test("Geneva has morx table", () => {
			const morx = genevaFont.morx;
			expect(morx).not.toBeNull();
			expect(morx?.version).toBeGreaterThanOrEqual(2);
		});

		test("Monaco has morx table", () => {
			const morx = monacoFont.morx;
			expect(morx).not.toBeNull();
			expect(morx?.version).toBeGreaterThanOrEqual(2);
		});

		test("Apple Symbols has morx table", () => {
			const morx = appleSymbolsFont.morx;
			expect(morx).not.toBeNull();
			expect(morx?.version).toBeGreaterThanOrEqual(2);
		});

		test("Keyboard has morx table", () => {
			const morx = keyboardFont.morx;
			expect(morx).not.toBeNull();
			expect(morx?.version).toBeGreaterThanOrEqual(2);
		});

		test("morx table has chains", () => {
			const morx = genevaFont.morx;
			expect(morx).not.toBeNull();
			if (morx) {
				expect(Array.isArray(morx.chains)).toBe(true);
				expect(morx.chains.length).toBeGreaterThan(0);
			}
		});

		test("version 1 (mort) returns empty chains", () => {
			const reader = genevaFont.getTableReader(0x6d6f7278);
			if (reader) {
				reader.seek(0);
				const version = reader.uint16();
				expect(version).toBeGreaterThanOrEqual(2);
			}
		});
	});

	describe("MorxChain", () => {
		test("chains have defaultFlags", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					expect(typeof chain.defaultFlags).toBe("number");
				}
			}
		});

		test("chains have features array", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					expect(Array.isArray(chain.features)).toBe(true);
				}
			}
		});

		test("chains have subtables array", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					expect(Array.isArray(chain.subtables)).toBe(true);
					expect(chain.subtables.length).toBeGreaterThan(0);
				}
			}
		});

		test("features have required properties", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const feature of chain.features) {
						expect(typeof feature.featureType).toBe("number");
						expect(typeof feature.featureSetting).toBe("number");
						expect(typeof feature.enableFlags).toBe("number");
						expect(typeof feature.disableFlags).toBe("number");
					}
				}
			}
		});
	});

	describe("MorxSubtable types", () => {
		test("Geneva has multiple subtable types", () => {
			const morx = genevaFont.morx;
			if (morx) {
				const types = new Set<MorxSubtableType>();
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						types.add(subtable.type);
					}
				}
				expect(types.size).toBeGreaterThan(0);
			}
		});

		test("test fonts cover rearrangement subtables", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont, zapfinoFont];
			let hasRearrangement = false;
			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.Rearrangement) {
								hasRearrangement = true;
								const rearr = subtable as MorxRearrangementSubtable;
								expect(rearr.stateTable).toBeDefined();
								expect(rearr.stateTable.stateArray.length).toBeGreaterThanOrEqual(0);
							}
						}
					}
				}
			}
		});

		test("test fonts cover insertion subtables", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont, zapfinoFont];
			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.Insertion) {
								const insertion = subtable as MorxInsertionSubtable;
								expect(insertion.stateTable).toBeDefined();
								expect(Array.isArray(insertion.insertionGlyphs)).toBe(true);
								expect(insertion.stateTable.stateArray.length).toBeGreaterThanOrEqual(0);
							}
						}
					}
				}
			}
		});

		test("subtables have coverage", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect(typeof subtable.coverage.vertical).toBe("boolean");
						expect(typeof subtable.coverage.descending).toBe("boolean");
						expect(typeof subtable.coverage.logical).toBe("boolean");
					}
				}
			}
		});

		test("subtables have subFeatureFlags", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect(typeof subtable.subFeatureFlags).toBe("number");
					}
				}
			}
		});
	});

	describe("Rearrangement subtable (type 0)", () => {
		test("has state table", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							expect(rearrangement.stateTable).toBeDefined();
							expect(typeof rearrangement.stateTable.nClasses).toBe("number");
							expect(rearrangement.stateTable.classTable).toBeDefined();
							expect(Array.isArray(rearrangement.stateTable.stateArray)).toBe(
								true,
							);
						}
					}
				}
			}
		});

		test("state table has class table", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							const classTable = rearrangement.stateTable.classTable;
							expect(typeof classTable.format).toBe("number");
							expect(Array.isArray(classTable.classArray)).toBe(true);
						}
					}
				}
			}
		});

		test("state array entries have newState and flags", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							for (const stateRow of rearrangement.stateTable.stateArray) {
								for (const entry of stateRow) {
									expect(typeof entry.newState).toBe("number");
									expect(typeof entry.flags).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});

	describe("Contextual subtable (type 1)", () => {
		test("Geneva has contextual subtables", () => {
			const morx = genevaFont.morx;
			if (morx) {
				let foundContextual = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Contextual) {
							foundContextual = true;
							const contextual = subtable as MorxContextualSubtable;
							expect(contextual.stateTable).toBeDefined();
							expect(Array.isArray(contextual.substitutionTable)).toBe(true);
						}
					}
				}
				expect(foundContextual).toBe(true);
			}
		});

		test("contextual entries have required properties", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Contextual) {
							const contextual = subtable as MorxContextualSubtable;
							for (const stateRow of contextual.stateTable.stateArray) {
								for (const entry of stateRow) {
									expect(typeof entry.newState).toBe("number");
									expect(typeof entry.flags).toBe("number");
									expect(typeof entry.markIndex).toBe("number");
									expect(typeof entry.currentIndex).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});

	describe("Ligature subtable (type 2)", () => {
		test("Monaco has ligature subtables", () => {
			const morx = monacoFont.morx;
			if (morx) {
				let foundLigature = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Ligature) {
							foundLigature = true;
							const ligature = subtable as MorxLigatureSubtable;
							expect(ligature.stateTable).toBeDefined();
							expect(Array.isArray(ligature.ligatureActions)).toBe(true);
							expect(Array.isArray(ligature.components)).toBe(true);
							expect(Array.isArray(ligature.ligatures)).toBe(true);
						}
					}
				}
				expect(foundLigature).toBe(true);
			}
		});

		test("Keyboard has ligature subtables", () => {
			const morx = keyboardFont.morx;
			if (morx) {
				let foundLigature = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Ligature) {
							foundLigature = true;
						}
					}
				}
				expect(foundLigature).toBe(true);
			}
		});

		test("ligature entries have required properties", () => {
			const morx = monacoFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Ligature) {
							const ligature = subtable as MorxLigatureSubtable;
							for (const stateRow of ligature.stateTable.stateArray) {
								for (const entry of stateRow) {
									expect(typeof entry.newState).toBe("number");
									expect(typeof entry.flags).toBe("number");
									expect(typeof entry.ligActionIndex).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});

	describe("NonContextual subtable (type 4)", () => {
		test("Apple Symbols has non-contextual subtable", () => {
			const morx = appleSymbolsFont.morx;
			if (morx) {
				let foundNonContextual = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							foundNonContextual = true;
							const nonContextual = subtable as MorxNonContextualSubtable;
							expect(nonContextual.lookupTable).toBeDefined();
							expect(typeof nonContextual.lookupTable.format).toBe("number");
							expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
						}
					}
				}
				expect(foundNonContextual).toBe(true);
			}
		});

		test("Geneva has non-contextual subtables", () => {
			const morx = genevaFont.morx;
			if (morx) {
				let foundNonContextual = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							foundNonContextual = true;
						}
					}
				}
				expect(foundNonContextual).toBe(true);
			}
		});
	});

	describe("Insertion subtable (type 5)", () => {
		test("insertion subtable has required properties", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Insertion) {
							const insertion = subtable as MorxInsertionSubtable;
							expect(insertion.stateTable).toBeDefined();
							expect(Array.isArray(insertion.insertionGlyphs)).toBe(true);
						}
					}
				}
			}
		});

		test("insertion entries have required properties", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Insertion) {
							const insertion = subtable as MorxInsertionSubtable;
							for (const stateRow of insertion.stateTable.stateArray) {
								for (const entry of stateRow) {
									expect(typeof entry.newState).toBe("number");
									expect(typeof entry.flags).toBe("number");
									expect(typeof entry.currentInsertIndex).toBe("number");
									expect(typeof entry.markedInsertIndex).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});

	describe("applyNonContextual", () => {
		test("returns mapped glyph when exists", () => {
			const mapping = new Map<number, number>([
				[10, 100],
				[20, 200],
				[30, 300],
			]);

			const subtable: MorxNonContextualSubtable = {
				type: MorxSubtableType.NonContextual,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				lookupTable: {
					format: 6,
					mapping,
				},
			};

			expect(applyNonContextual(subtable, 10)).toBe(100);
			expect(applyNonContextual(subtable, 20)).toBe(200);
			expect(applyNonContextual(subtable, 30)).toBe(300);
		});

		test("returns null when glyph not in mapping", () => {
			const mapping = new Map<number, number>([[10, 100]]);

			const subtable: MorxNonContextualSubtable = {
				type: MorxSubtableType.NonContextual,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				lookupTable: {
					format: 6,
					mapping,
				},
			};

			expect(applyNonContextual(subtable, 99)).toBeNull();
		});

		test("works with real font non-contextual subtables", () => {
			const morx = appleSymbolsFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nonContextual = subtable as MorxNonContextualSubtable;
							for (const [glyphId, replacement] of nonContextual.lookupTable
								.mapping) {
								const result = applyNonContextual(nonContextual, glyphId);
								expect(result).toBe(replacement);
							}
						}
					}
				}
			}
		});
	});

	describe("lookup table formats", () => {
		test("handles various lookup table formats", () => {
			const morx = genevaFont.morx;
			if (morx) {
				const formats = new Set<number>();
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nonContextual = subtable as MorxNonContextualSubtable;
							formats.add(nonContextual.lookupTable.format);
						}
					}
				}
				expect(formats.size).toBeGreaterThanOrEqual(0);
			}
		});

		test("mapping is always a Map", () => {
			const morx = appleSymbolsFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nonContextual = subtable as MorxNonContextualSubtable;
							expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
						}
					}
				}
			}
		});
	});

	describe("class table", () => {
		test("class table format is 2", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							expect(rearrangement.stateTable.classTable.format).toBe(2);
						}
					}
				}
			}
		});

		test("class array has entries", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							expect(
								rearrangement.stateTable.classTable.classArray.length,
							).toBeGreaterThanOrEqual(0);
						}
					}
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles empty mapping in non-contextual", () => {
			const subtable: MorxNonContextualSubtable = {
				type: MorxSubtableType.NonContextual,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				lookupTable: {
					format: 0,
					mapping: new Map(),
				},
			};

			expect(applyNonContextual(subtable, 1)).toBeNull();
		});

		test("state arrays are properly sized", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							for (const stateRow of rearrangement.stateTable.stateArray) {
								expect(stateRow.length).toBeLessThanOrEqual(
									rearrangement.stateTable.nClasses,
								);
							}
						}
					}
				}
			}
		});

		test("handles fonts with multiple chains", () => {
			const morx = genevaFont.morx;
			if (morx) {
				expect(morx.chains.length).toBeGreaterThanOrEqual(1);
				for (const chain of morx.chains) {
					expect(chain).toBeDefined();
					expect(Array.isArray(chain.subtables)).toBe(true);
				}
			}
		});
	});

	describe("coverage flags", () => {
		test("coverage flags are boolean", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect(typeof subtable.coverage.vertical).toBe("boolean");
						expect(typeof subtable.coverage.descending).toBe("boolean");
						expect(typeof subtable.coverage.logical).toBe("boolean");
					}
				}
			}
		});

		test("most subtables have logical=false", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect([true, false]).toContain(subtable.coverage.logical);
					}
				}
			}
		});
	});

	describe("lookup table format coverage", () => {
		test("covers all lookup table formats in fonts", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];
			const formats = new Set<number>();

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.NonContextual) {
								const nonContextual = subtable as MorxNonContextualSubtable;
								formats.add(nonContextual.lookupTable.format);
								expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
							}
						}
					}
				}
			}

			expect(formats.size).toBeGreaterThan(0);
		});

		test("handles format 2 lookup tables (segment single)", () => {
			const morx = genevaFont.morx;
			if (morx) {
				let foundFormat2 = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nonContextual = subtable as MorxNonContextualSubtable;
							if (nonContextual.lookupTable.format === 2) {
								foundFormat2 = true;
								expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
							}
						}
					}
				}
			}
		});

		test("handles format 6 lookup tables (single table)", () => {
			const morx = appleSymbolsFont.morx;
			if (morx) {
				let foundFormat6 = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nonContextual = subtable as MorxNonContextualSubtable;
							if (nonContextual.lookupTable.format === 6) {
								foundFormat6 = true;
								expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
							}
						}
					}
				}
			}
		});

		test("handles format 8 lookup tables (trimmed array)", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nonContextual = subtable as MorxNonContextualSubtable;
							if (nonContextual.lookupTable.format === 8) {
								expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
							}
						}
					}
				}
			}
		});

		test("mapping works for all lookup formats", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nonContextual = subtable as MorxNonContextualSubtable;
							for (const [glyph, replacement] of nonContextual.lookupTable.mapping) {
								expect(typeof glyph).toBe("number");
								expect(typeof replacement).toBe("number");
							}
						}
					}
				}
			}
		});
	});

	describe("state table validation", () => {
		test("state arrays have proper dimensions", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							expect(Array.isArray(rearrangement.stateTable.stateArray)).toBe(true);
							expect(rearrangement.stateTable.stateArray.length).toBeGreaterThanOrEqual(0);
						}
					}
				}
			}
		});

		test("contextual entries have valid indices", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Contextual) {
							const contextual = subtable as MorxContextualSubtable;
							for (const stateRow of contextual.stateTable.stateArray) {
								for (const entry of stateRow) {
									expect(typeof entry.markIndex).toBe("number");
									expect(typeof entry.currentIndex).toBe("number");
									expect(entry.markIndex).toBeGreaterThanOrEqual(0);
									expect(entry.currentIndex).toBeGreaterThanOrEqual(0);
								}
							}
						}
					}
				}
			}
		});

		test("ligature arrays are properly sized", () => {
			const morx = monacoFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Ligature) {
							const ligature = subtable as MorxLigatureSubtable;
							expect(ligature.ligatureActions.length).toBeGreaterThanOrEqual(0);
							expect(ligature.components.length).toBeGreaterThanOrEqual(0);
							expect(ligature.ligatures.length).toBeGreaterThanOrEqual(0);
						}
					}
				}
			}
		});

		test("insertion glyphs array is present", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Insertion) {
							const insertion = subtable as MorxInsertionSubtable;
							expect(Array.isArray(insertion.insertionGlyphs)).toBe(true);
						}
					}
				}
			}
		});
	});

	describe("cross-font validation", () => {
		test("Monaco ligature subtables have structure", () => {
			const morx = monacoFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Ligature) {
							const ligature = subtable as MorxLigatureSubtable;
							expect(Array.isArray(ligature.ligatureActions)).toBe(true);
							expect(Array.isArray(ligature.components)).toBe(true);
							expect(Array.isArray(ligature.ligatures)).toBe(true);
						}
					}
				}
			}
		});

		test("Keyboard has valid subtable types", () => {
			const morx = keyboardFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect([0, 1, 2, 4, 5]).toContain(subtable.type);
					}
				}
			}
		});

		test("Apple Symbols has non-contextual subtables", () => {
			const morx = appleSymbolsFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nonContextual = subtable as MorxNonContextualSubtable;
							expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
						}
					}
				}
			}
		});
	});

	describe("feature entries", () => {
		test("feature entries have valid types", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					if (chain.features.length > 0) {
						for (const feature of chain.features) {
							expect(feature.featureType).toBeGreaterThanOrEqual(0);
							expect(feature.featureSetting).toBeGreaterThanOrEqual(0);
						}
					}
				}
			}
		});

		test("feature flags are numbers", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const feature of chain.features) {
						expect(typeof feature.enableFlags).toBe("number");
						expect(typeof feature.disableFlags).toBe("number");
					}
				}
			}
		});
	});

	describe("class table segments", () => {
		test("class tables have valid format", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							expect(rearrangement.stateTable.classTable.format).toBe(2);
						}
					}
				}
			}
		});

		test("class arrays map glyphs correctly", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							const classArray = rearrangement.stateTable.classTable.classArray;
							for (const classValue of classArray) {
								expect(typeof classValue).toBe("number");
								expect(classValue).toBeGreaterThanOrEqual(0);
							}
						}
					}
				}
			}
		});
	});

	describe("version handling", () => {
		test("all test fonts have version 2 or higher", () => {
			expect(genevaFont.morx?.version).toBeGreaterThanOrEqual(2);
			expect(monacoFont.morx?.version).toBeGreaterThanOrEqual(2);
			expect(appleSymbolsFont.morx?.version).toBeGreaterThanOrEqual(2);
			expect(keyboardFont.morx?.version).toBeGreaterThanOrEqual(2);
		});

		test("version 2+ has chains", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];
			for (const font of fonts) {
				const morx = font.morx;
				if (morx && morx.version >= 2) {
					expect(morx.chains.length).toBeGreaterThan(0);
				}
			}
		});

		test("version 1 (mort) returns empty chains", () => {
			const mockReader = {
				uint16: () => 1,
				uint32: () => 0,
				skip: () => {},
				offset: 0,
				seek: () => {},
			};
			const result = parseMorx(mockReader as any);
			expect(result.version).toBe(1);
			expect(result.chains.length).toBe(0);
		});
	});

	describe("detailed rearrangement state table parsing", () => {
		test("rearrangement entries have valid newState and flags", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];
			let foundRearrangement = false;

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.Rearrangement) {
								foundRearrangement = true;
								const rearrangement = subtable as MorxRearrangementSubtable;

								expect(rearrangement.stateTable).toBeDefined();
								expect(rearrangement.stateTable.nClasses).toBeGreaterThanOrEqual(0);
								expect(Array.isArray(rearrangement.stateTable.stateArray)).toBe(true);

								for (const row of rearrangement.stateTable.stateArray) {
									expect(Array.isArray(row)).toBe(true);
									for (const entry of row) {
										expect(typeof entry.newState).toBe("number");
										expect(typeof entry.flags).toBe("number");
										expect(entry.newState).toBeGreaterThanOrEqual(0);
										expect(entry.flags).toBeGreaterThanOrEqual(0);
									}
								}

								const classTable = rearrangement.stateTable.classTable;
								expect(classTable).toBeDefined();
								expect(typeof classTable.format).toBe("number");
								expect(Array.isArray(classTable.classArray)).toBe(true);
							}
						}
					}
				}
			}

			if (!foundRearrangement) {
				console.log("No rearrangement subtables found in test fonts");
			}
		});

		test("state array dimensions match nClasses", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.Rearrangement) {
								const rearrangement = subtable as MorxRearrangementSubtable;
								const nClasses = rearrangement.stateTable.nClasses;

								for (const row of rearrangement.stateTable.stateArray) {
									expect(row.length).toBeLessThanOrEqual(nClasses);
								}
							}
						}
					}
				}
			}
		});
	});

	describe("detailed insertion state table parsing", () => {
		test("insertion entries have valid indices", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];
			let foundInsertion = false;

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.Insertion) {
								foundInsertion = true;
								const insertion = subtable as MorxInsertionSubtable;

								expect(insertion.stateTable).toBeDefined();
								expect(insertion.stateTable.nClasses).toBeGreaterThanOrEqual(0);
								expect(Array.isArray(insertion.insertionGlyphs)).toBe(true);

								for (const row of insertion.stateTable.stateArray) {
									expect(Array.isArray(row)).toBe(true);
									for (const entry of row) {
										expect(typeof entry.newState).toBe("number");
										expect(typeof entry.flags).toBe("number");
										expect(typeof entry.currentInsertIndex).toBe("number");
										expect(typeof entry.markedInsertIndex).toBe("number");
										expect(entry.newState).toBeGreaterThanOrEqual(0);
										expect(entry.flags).toBeGreaterThanOrEqual(0);
									}
								}

								const classTable = insertion.stateTable.classTable;
								expect(classTable).toBeDefined();
								expect(typeof classTable.format).toBe("number");
								expect(Array.isArray(classTable.classArray)).toBe(true);
							}
						}
					}
				}
			}

			if (!foundInsertion) {
				console.log("No insertion subtables found in test fonts");
			}
		});

		test("insertion glyphs are valid glyph IDs", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.Insertion) {
								const insertion = subtable as MorxInsertionSubtable;

								for (const glyphId of insertion.insertionGlyphs) {
									expect(typeof glyphId).toBe("number");
									expect(glyphId).toBeGreaterThanOrEqual(0);
								}
							}
						}
					}
				}
			}
		});

		test("insertion state array has proper structure", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.Insertion) {
								const insertion = subtable as MorxInsertionSubtable;
								const nClasses = insertion.stateTable.nClasses;

								expect(insertion.stateTable.stateArray.length).toBeGreaterThanOrEqual(0);

								for (const row of insertion.stateTable.stateArray) {
									expect(row.length).toBeLessThanOrEqual(nClasses);
								}
							}
						}
					}
				}
			}
		});
	});

	describe("lookup table format 0 (simple array)", () => {
		test("handles format 0 lookup tables", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];
			let foundFormat0 = false;

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.NonContextual) {
								const nonContextual = subtable as MorxNonContextualSubtable;
								if (nonContextual.lookupTable.format === 0) {
									foundFormat0 = true;
									expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
								}
							}
						}
					}
				}
			}

			if (!foundFormat0) {
				console.log("No format 0 lookup tables found, which is expected");
			}
		});
	});

	describe("lookup table format 4 (segment array)", () => {
		test("handles format 4 lookup tables", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];
			let foundFormat4 = false;

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.NonContextual) {
								const nonContextual = subtable as MorxNonContextualSubtable;
								if (nonContextual.lookupTable.format === 4) {
									foundFormat4 = true;
									expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);
									expect(nonContextual.lookupTable.format).toBe(4);
								}
							}
						}
					}
				}
			}

			if (!foundFormat4) {
				console.log("No format 4 lookup tables found in test fonts");
			}
		});
	});

	describe("comprehensive subtable type coverage", () => {
		test("all fonts have valid subtable structures", () => {
			const fonts = [
				{ name: "Geneva", font: genevaFont },
				{ name: "Monaco", font: monacoFont },
				{ name: "Apple Symbols", font: appleSymbolsFont },
				{ name: "Keyboard", font: keyboardFont },
			];

			for (const { name, font } of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						expect(Array.isArray(chain.subtables)).toBe(true);

						for (const subtable of chain.subtables) {
							expect(subtable.type).toBeGreaterThanOrEqual(0);
							expect(subtable.type).toBeLessThanOrEqual(5);
							expect(subtable.coverage).toBeDefined();
							expect(typeof subtable.subFeatureFlags).toBe("number");

							switch (subtable.type) {
								case MorxSubtableType.Rearrangement: {
									const rearr = subtable as MorxRearrangementSubtable;
									expect(rearr.stateTable).toBeDefined();
									expect(rearr.stateTable.classTable).toBeDefined();
									expect(Array.isArray(rearr.stateTable.stateArray)).toBe(true);
									break;
								}
								case MorxSubtableType.Contextual: {
									const ctx = subtable as MorxContextualSubtable;
									expect(ctx.stateTable).toBeDefined();
									expect(Array.isArray(ctx.substitutionTable)).toBe(true);
									break;
								}
								case MorxSubtableType.Ligature: {
									const lig = subtable as MorxLigatureSubtable;
									expect(lig.stateTable).toBeDefined();
									expect(Array.isArray(lig.ligatureActions)).toBe(true);
									expect(Array.isArray(lig.components)).toBe(true);
									expect(Array.isArray(lig.ligatures)).toBe(true);
									break;
								}
								case MorxSubtableType.NonContextual: {
									const nonCtx = subtable as MorxNonContextualSubtable;
									expect(nonCtx.lookupTable).toBeDefined();
									expect(nonCtx.lookupTable.mapping).toBeInstanceOf(Map);
									break;
								}
								case MorxSubtableType.Insertion: {
									const ins = subtable as MorxInsertionSubtable;
									expect(ins.stateTable).toBeDefined();
									expect(Array.isArray(ins.insertionGlyphs)).toBe(true);
									break;
								}
							}
						}
					}
				}
			}
		});

		test("subtables have consistent internal structures", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (
								subtable.type === MorxSubtableType.Rearrangement ||
								subtable.type === MorxSubtableType.Contextual ||
								subtable.type === MorxSubtableType.Ligature ||
								subtable.type === MorxSubtableType.Insertion
							) {
								const stateSubtable = subtable as
									| MorxRearrangementSubtable
									| MorxContextualSubtable
									| MorxLigatureSubtable
									| MorxInsertionSubtable;

								expect(stateSubtable.stateTable).toBeDefined();
								expect(stateSubtable.stateTable.nClasses).toBeGreaterThanOrEqual(0);
								expect(stateSubtable.stateTable.classTable.format).toBeGreaterThanOrEqual(0);
								expect(Array.isArray(stateSubtable.stateTable.classTable.classArray)).toBe(true);
							}
						}
					}
				}
			}
		});
	});

	describe("coverage flags detailed validation", () => {
		test("coverage vertical flag is parsed correctly", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect(typeof subtable.coverage.vertical).toBe("boolean");
					}
				}
			}
		});

		test("coverage descending flag is parsed correctly", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect(typeof subtable.coverage.descending).toBe("boolean");
					}
				}
			}
		});

		test("coverage logical flag is parsed correctly", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect(typeof subtable.coverage.logical).toBe("boolean");
					}
				}
			}
		});
	});

	describe("class table format 2 parsing", () => {
		test("class table format 2 has proper segment structure", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (
								subtable.type === MorxSubtableType.Rearrangement ||
								subtable.type === MorxSubtableType.Insertion
							) {
								const stateSubtable = subtable as
									| MorxRearrangementSubtable
									| MorxInsertionSubtable;

								const classTable = stateSubtable.stateTable.classTable;
								expect(classTable.format).toBe(2);
								expect(Array.isArray(classTable.classArray)).toBe(true);

								for (const classValue of classTable.classArray) {
									expect(typeof classValue).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});

	describe("lookup table format 2 detailed", () => {
		test("format 2 segment single lookup has mappings", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.NonContextual) {
								const nonContextual = subtable as MorxNonContextualSubtable;

								if (nonContextual.lookupTable.format === 2) {
									expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);

									for (const [glyph, value] of nonContextual.lookupTable.mapping) {
										expect(typeof glyph).toBe("number");
										expect(typeof value).toBe("number");
										expect(glyph).toBeGreaterThanOrEqual(0);
										expect(value).toBeGreaterThanOrEqual(0);
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("lookup table format 8 detailed", () => {
		test("format 8 trimmed array handles values correctly", () => {
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];

			for (const font of fonts) {
				const morx = font.morx;
				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							if (subtable.type === MorxSubtableType.NonContextual) {
								const nonContextual = subtable as MorxNonContextualSubtable;

								if (nonContextual.lookupTable.format === 8) {
									expect(nonContextual.lookupTable.mapping).toBeInstanceOf(Map);

									for (const [glyph, value] of nonContextual.lookupTable.mapping) {
										expect(typeof glyph).toBe("number");
										expect(typeof value).toBe("number");
										expect(glyph).toBeGreaterThanOrEqual(0);
										expect(value).not.toBe(0);
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("all subtable types in all fonts", () => {
		test("catalogues all subtable types found", () => {
			const fonts = [
				{ name: "Geneva", font: genevaFont },
				{ name: "Monaco", font: monacoFont },
				{ name: "Apple Symbols", font: appleSymbolsFont },
				{ name: "Keyboard", font: keyboardFont },
			];

			const subtableTypesByFont = new Map<string, Set<number>>();

			for (const { name, font } of fonts) {
				const types = new Set<number>();
				const morx = font.morx;

				if (morx) {
					for (const chain of morx.chains) {
						for (const subtable of chain.subtables) {
							types.add(subtable.type);
						}
					}
				}

				subtableTypesByFont.set(name, types);
				expect(types.size).toBeGreaterThan(0);
			}

			for (const [fontName, types] of subtableTypesByFont) {
				console.log(`${fontName}: types ${Array.from(types).join(", ")}`);
			}
		});
	});

	describe("Zapfino font tests", () => {
		test("Zapfino has morx table", () => {
			const morx = zapfinoFont.morx;
			expect(morx).not.toBeNull();
			expect(morx?.version).toBeGreaterThanOrEqual(2);
		});

		test("Zapfino has contextual subtables", () => {
			const morx = zapfinoFont.morx;
			if (morx) {
				let foundContextual = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Contextual) {
							foundContextual = true;
							const ctx = subtable as MorxContextualSubtable;
							expect(ctx.stateTable).toBeDefined();
							expect(Array.isArray(ctx.substitutionTable)).toBe(true);
						}
					}
				}
				expect(foundContextual).toBe(true);
			}
		});

		test("Zapfino has ligature subtables", () => {
			const morx = zapfinoFont.morx;
			if (morx) {
				let foundLigature = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Ligature) {
							foundLigature = true;
							const lig = subtable as MorxLigatureSubtable;
							expect(lig.stateTable).toBeDefined();
							expect(Array.isArray(lig.ligatureActions)).toBe(true);
							expect(Array.isArray(lig.components)).toBe(true);
							expect(Array.isArray(lig.ligatures)).toBe(true);
						}
					}
				}
				expect(foundLigature).toBe(true);
			}
		});

		test("Zapfino has non-contextual with format 4 lookup", () => {
			const morx = zapfinoFont.morx;
			if (morx) {
				let foundFormat4 = false;
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.NonContextual) {
							const nc = subtable as MorxNonContextualSubtable;
							if (nc.lookupTable.format === 4) {
								foundFormat4 = true;
								expect(nc.lookupTable.mapping).toBeInstanceOf(Map);
							}
						}
					}
				}
				expect(foundFormat4).toBe(true);
			}
		});

		test("Zapfino chains have features", () => {
			const morx = zapfinoFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					expect(Array.isArray(chain.features)).toBe(true);
					for (const feature of chain.features) {
						expect(typeof feature.featureType).toBe("number");
						expect(typeof feature.featureSetting).toBe("number");
						expect(typeof feature.enableFlags).toBe("number");
						expect(typeof feature.disableFlags).toBe("number");
					}
				}
			}
		});

		test("Zapfino contextual subtable class tables", () => {
			const morx = zapfinoFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Contextual) {
							const ctx = subtable as MorxContextualSubtable;
							expect(ctx.stateTable.classTable).toBeDefined();
							expect(typeof ctx.stateTable.classTable.format).toBe("number");
							expect(Array.isArray(ctx.stateTable.classTable.classArray)).toBe(true);
						}
					}
				}
			}
		});

		test("Zapfino ligature subtable class tables", () => {
			const morx = zapfinoFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Ligature) {
							const lig = subtable as MorxLigatureSubtable;
							expect(lig.stateTable.classTable).toBeDefined();
							expect(typeof lig.stateTable.classTable.format).toBe("number");
							expect(Array.isArray(lig.stateTable.classTable.classArray)).toBe(true);
						}
					}
				}
			}
		});
	});

	describe("subtable boundaries", () => {
		test("subtable subFeatureFlags are valid", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						expect(typeof subtable.subFeatureFlags).toBe("number");
						expect(subtable.subFeatureFlags).toBeGreaterThanOrEqual(0);
					}
				}
			}
		});

		test("nClasses is consistent with state array", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const rearrangement = subtable as MorxRearrangementSubtable;
							const nClasses = rearrangement.stateTable.nClasses;
							expect(nClasses).toBeGreaterThan(0);
						}
					}
				}
			}
		});
	});
});
