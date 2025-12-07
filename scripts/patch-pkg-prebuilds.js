#!/usr/bin/env node
// Patch pkg-prebuilds for Bun test compatibility
// Bun's test runner defines `jest` global but doesn't implement `jest.requireActual`

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const filePath = join(import.meta.dirname, "../node_modules/pkg-prebuilds/bindings.js")

if (!existsSync(filePath)) {
	console.log("pkg-prebuilds not found, skipping patch")
	process.exit(0)
}

const content = readFileSync(filePath, "utf8")

// Check if already patched
if (content.includes("jest.requireActual ?")) {
	console.log("pkg-prebuilds already patched")
	process.exit(0)
}

// Patch the jest.requireActual check
const patched = content.replace(
	"jest.requireActual('fs')",
	"jest.requireActual ? jest.requireActual('fs') : require('fs')",
)

if (patched === content) {
	console.log("pkg-prebuilds patch pattern not found")
	process.exit(0)
}

writeFileSync(filePath, patched)
console.log("Patched pkg-prebuilds for Bun test compatibility")
