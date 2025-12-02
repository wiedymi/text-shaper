/**
 * Parses an string that holds encoded codepoint mappings, e.g. for bracket pairs or
 * mirroring characters. Returns an object holding the `map`, and optionally a `reverseMap`.
 */
export function parseCharacterMap(
	encodedString: string,
	includeReverse: boolean,
): { map: Map<string, string>; reverseMap: Map<string, string> | null } {
	const radix = 36;
	let lastCode = 0;
	const map = new Map<string, string>();
	const reverseMap = includeReverse ? new Map<string, string>() : null;
	let prevPair = "";

	function visit(entry: string): void {
		if (entry.indexOf("+") !== -1) {
			for (let i = +entry; i--; ) {
				visit(prevPair);
			}
		} else {
			prevPair = entry;
			const parts = entry.split(">");
			const aStr = parts[0] ?? "";
			const bStr = parts[1] ?? "";
			lastCode += parseInt(aStr, radix);
			const a = String.fromCodePoint(lastCode);
			lastCode += parseInt(bStr, radix);
			const b = String.fromCodePoint(lastCode);
			map.set(a, b);
			if (reverseMap) {
				reverseMap.set(b, a);
			}
		}
	}

	encodedString.split(",").forEach(visit);
	return { map, reverseMap };
}
