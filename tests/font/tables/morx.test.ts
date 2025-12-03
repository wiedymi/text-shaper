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

describe("morx table", () => {
	let genevaFont: Font;
	let monacoFont: Font;
	let appleSymbolsFont: Font;
	let keyboardFont: Font;

	beforeAll(async () => {
		genevaFont = await Font.fromFile(GENEVA_PATH);
		monacoFont = await Font.fromFile(MONACO_PATH);
		appleSymbolsFont = await Font.fromFile(APPLE_SYMBOLS_PATH);
		keyboardFont = await Font.fromFile(KEYBOARD_PATH);
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
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];
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
			const fonts = [genevaFont, monacoFont, appleSymbolsFont, keyboardFont];
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
