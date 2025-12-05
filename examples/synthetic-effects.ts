/**
 * Example: Synthetic Font Effects
 *
 * Demonstrates how to apply synthetic bold, italic, condensed, and other
 * transformations to glyphs when a font doesn't have native variants.
 *
 * Usage: bun examples/synthetic-effects.ts
 */

import type { GlyphPath } from "../src/render/path.ts";
import { pathToSVG } from "../src/render/path.ts";
import {
	condensePath,
	emboldenPath,
	obliquePath,
	transformPath,
} from "../src/raster/synth.ts";

/**
 * Create a sample letter "A" path for demonstration
 */
function createLetterA(): GlyphPath {
	return {
		commands: [
			// Left stroke
			{ type: "M", x: 20, y: 100 },
			{ type: "L", x: 80, y: 0 },
			{ type: "L", x: 120, y: 0 },
			{ type: "L", x: 60, y: 100 },
			{ type: "Z" },
			// Right stroke
			{ type: "M", x: 140, y: 100 },
			{ type: "L", x: 200, y: 0 },
			{ type: "L", x: 240, y: 0 },
			{ type: "L", x: 180, y: 100 },
			{ type: "Z" },
			// Crossbar
			{ type: "M", x: 70, y: 60 },
			{ type: "L", x: 170, y: 60 },
			{ type: "L", x: 160, y: 80 },
			{ type: "L", x: 80, y: 80 },
			{ type: "Z" },
		],
		bounds: { xMin: 20, yMin: 0, xMax: 240, yMax: 100 },
	};
}

function main() {
	const originalPath = createLetterA();

	console.log("\n=== Synthetic Font Effects Demo ===\n");

	// 1. Regular
	console.log("1. Regular (Original):");
	console.log("   Bounds:", originalPath.bounds);
	console.log("   Commands:", originalPath.commands.length);

	// 2. Italic (Oblique)
	const italicPath = obliquePath(originalPath, 0.2); // ~12 degrees slant
	console.log("\n2. Italic (Oblique with slant 0.2):");
	console.log("   Bounds:", italicPath.bounds);
	console.log("   Effect: Shifts x coordinates proportional to y");

	// 3. Bold (Emboldened)
	const boldPath = emboldenPath(originalPath, 30); // Offset by 30 font units
	console.log("\n3. Bold (Emboldened with strength 30):");
	console.log("   Bounds:", boldPath.bounds);
	console.log("   Effect: Expands outline outward");

	// 4. Bold Italic (Combined)
	const boldItalicPath = emboldenPath(obliquePath(originalPath, 0.2), 25);
	console.log("\n4. Bold Italic (Combined):");
	console.log("   Bounds:", boldItalicPath.bounds);
	console.log("   Effect: Both oblique and emboldening");

	// 5. Condensed
	const condensedPath = condensePath(originalPath, 0.75); // 75% width
	console.log("\n5. Condensed (75% width):");
	console.log("   Bounds:", condensedPath.bounds);
	console.log("   Effect: Horizontal scaling only");

	// 6. Expanded
	const expandedPath = condensePath(originalPath, 1.3); // 130% width
	console.log("\n6. Expanded (130% width):");
	console.log("   Bounds:", expandedPath.bounds);
	console.log("   Effect: Horizontal scaling only");

	// 7. Custom transform (rotation)
	const angle = Math.PI / 6; // 30 degrees
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const rotatedPath = transformPath(originalPath, [cos, sin, -sin, cos, 0, 0]);
	console.log("\n7. Rotated (30 degrees):");
	console.log("   Bounds:", rotatedPath.bounds);
	console.log("   Effect: Rotation transformation");

	// Generate SVG samples
	console.log("\n=== SVG Samples ===\n");

	const styles = [
		{ name: "Regular", path: originalPath },
		{ name: "Italic", path: italicPath },
		{ name: "Bold", path: boldPath },
		{ name: "Bold Italic", path: boldItalicPath },
		{ name: "Condensed", path: condensedPath },
		{ name: "Expanded", path: expandedPath },
		{ name: "Rotated", path: rotatedPath },
	];

	for (const { name, path } of styles) {
		const svg = pathToSVG(path, { flipY: true, scale: 0.1 });
		console.log(`${name}:`);
		console.log(`  ${svg.substring(0, 80)}...`);
		console.log();
	}

	// Practical use case: Creating a complete font family from a single font
	console.log("\n=== Practical Use Case ===\n");
	console.log("Creating synthetic font family:");
	console.log("- Regular: Use original font");
	console.log("- Italic: obliquePath(path, 0.2)");
	console.log("- Bold: emboldenPath(path, 30)");
	console.log("- Bold Italic: emboldenPath(obliquePath(path, 0.2), 25)");
	console.log("- Condensed: condensePath(path, 0.75)");
	console.log("- Condensed Italic: condensePath(obliquePath(path, 0.2), 0.75)");
	console.log("\nNote: For best results, use fonts with native variants.");
	console.log("Synthetic effects are useful for fallback rendering.");
}

main();
