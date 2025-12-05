/**
 * Visual demonstration of synthetic font effects
 *
 * This test creates SVG visualizations of the different synthetic effects
 * to help verify they're working correctly.
 */

import { expect, test } from "bun:test";
import type { GlyphPath } from "../../src/render/path.ts";
import { pathToSVG } from "../../src/render/path.ts";
import {
	condensePath,
	emboldenPath,
	obliquePath,
	transformPath,
} from "../../src/raster/synth.ts";

/**
 * Create a simple letter "H" path for visual testing
 */
function createLetterH(): GlyphPath {
	return {
		commands: [
			// Left vertical stroke
			{ type: "M", x: 10, y: 0 },
			{ type: "L", x: 30, y: 0 },
			{ type: "L", x: 30, y: 100 },
			{ type: "L", x: 10, y: 100 },
			{ type: "Z" },
			// Right vertical stroke
			{ type: "M", x: 70, y: 0 },
			{ type: "L", x: 90, y: 0 },
			{ type: "L", x: 90, y: 100 },
			{ type: "L", x: 70, y: 100 },
			{ type: "Z" },
			// Horizontal crossbar
			{ type: "M", x: 30, y: 40 },
			{ type: "L", x: 70, y: 40 },
			{ type: "L", x: 70, y: 60 },
			{ type: "L", x: 30, y: 60 },
			{ type: "Z" },
		],
		bounds: { xMin: 10, yMin: 0, xMax: 90, yMax: 100 },
	};
}

test("visual comparison of effects", () => {
	const original = createLetterH();

	// Apply different effects
	const oblique = obliquePath(original, 0.2);
	const emboldened = emboldenPath(original, 8);
	const condensed = condensePath(original, 0.7);
	const expanded = condensePath(original, 1.3);

	// Combined: oblique + emboldened
	const obliqueEmboldened = emboldenPath(obliquePath(original, 0.2), 5);

	// Create SVG paths
	const originalSVG = pathToSVG(original, { flipY: true });
	const obliqueSVG = pathToSVG(oblique, { flipY: true });
	const emboldenedSVG = pathToSVG(emboldened, { flipY: true });
	const condensedSVG = pathToSVG(condensed, { flipY: true });
	const expandedSVG = pathToSVG(expanded, { flipY: true });
	const combinedSVG = pathToSVG(obliqueEmboldened, { flipY: true });

	// Verify all paths are non-empty
	expect(originalSVG.length).toBeGreaterThan(0);
	expect(obliqueSVG.length).toBeGreaterThan(0);
	expect(emboldenedSVG.length).toBeGreaterThan(0);
	expect(condensedSVG.length).toBeGreaterThan(0);
	expect(expandedSVG.length).toBeGreaterThan(0);
	expect(combinedSVG.length).toBeGreaterThan(0);

	// Log SVG for manual inspection if needed
	console.log("\nOriginal H:", originalSVG);
	console.log("\nOblique H (italic):", obliqueSVG);
	console.log("\nEmboldened H (bold):", emboldenedSVG);
	console.log("\nCondensed H:", condensedSVG);
	console.log("\nExpanded H:", expandedSVG);
	console.log("\nOblique + Bold H:", combinedSVG);
});

test("rotation examples", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 50, y: 0 },
			{ type: "L", x: 100, y: 50 },
			{ type: "L", x: 50, y: 100 },
			{ type: "L", x: 0, y: 50 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};

	// Rotate 45 degrees
	const cos45 = Math.cos(Math.PI / 4);
	const sin45 = Math.sin(Math.PI / 4);
	const rotated45 = transformPath(path, [cos45, sin45, -sin45, cos45, 0, 0]);

	// Rotate 90 degrees
	const rotated90 = transformPath(path, [0, 1, -1, 0, 0, 0]);

	expect(rotated45.commands.length).toBeGreaterThan(0);
	expect(rotated90.commands.length).toBeGreaterThan(0);

	console.log("\nOriginal diamond:", pathToSVG(path, { flipY: true }));
	console.log("\n45° rotated:", pathToSVG(rotated45, { flipY: true }));
	console.log("\n90° rotated:", pathToSVG(rotated90, { flipY: true }));
});

test("mirror and flip transformations", () => {
	const path = createLetterH();

	// Horizontal flip (mirror)
	const mirrorH = transformPath(path, [-1, 0, 0, 1, 100, 0]);

	// Vertical flip
	const flipV = transformPath(path, [1, 0, 0, -1, 0, 100]);

	// Both flips (180 degree rotation)
	const flip180 = transformPath(path, [-1, 0, 0, -1, 100, 100]);

	expect(mirrorH.commands.length).toBeGreaterThan(0);
	expect(flipV.commands.length).toBeGreaterThan(0);
	expect(flip180.commands.length).toBeGreaterThan(0);

	console.log("\nHorizontal mirror:", pathToSVG(mirrorH, { flipY: true }));
	console.log("\nVertical flip:", pathToSVG(flipV, { flipY: true }));
	console.log("\n180° flip:", pathToSVG(flip180, { flipY: true }));
});
