# Shaper.ts Coverage Summary

## Current Coverage: 53.76%

### Major Uncovered Code Blocks

1. **Lines 375-376, 381, 383**: GSUB lookup type break statements
   - These are break statements in switch cases
   - Coverage issue: not actual logic, just control flow

2. **Lines 402-413**: applySingleSubstLookup full implementation
   - Need font with GSUB Type 1 where shouldSkipGlyph triggers
   - Need text that matches coverage and triggers replacement

3. **Lines 426-467**: applyMultipleSubstLookup details
   - Need font with GSUB Type 2 (Multiple substitution)
   - Need text that expands 1 glyph to multiple

4. **Lines 474-497**: applyAlternateSubstLookup details
   - Need font with GSUB Type 3 (Alternate substitution)
   - Need text with coverage and alternate sets

5. **Lines 510-511**: Ligature substitution continue
   - Need ligature that fails shouldSkipGlyph check

6. **Lines 587-665**: Context substitution formats 1-3
   - Need fonts with context rules that match

7. **Lines 687-741**: Reverse chaining substitution
   - Need font with GSUB Type 8 and matching text

8. **Lines 761-980**: Context and chaining context matching helpers
   - These are called by the above functions
   - Need actual matching rules in fonts

9. **Lines 1039-1073**: applyNestedLookups
   - Need context lookups with nested lookup records

10. **Lines 1133-1158**: applySinglePosLookup
    - Need GPOS Type 1 with actual adjustments

11. **Lines 1196-1243**: applyCursivePosLookup
    - Need GPOS Type 3 with exit/entry anchors

12. **Lines 1273-1388**: Mark positioning edge cases
    - Need specific mark attachment scenarios

13. **Lines 1467-1875**: Context positioning and matching
    - Need GPOS context lookups

14. **Lines 1882-1970**: Sequence matching helpers
    - Called by context functions

15. **Lines 2021-2070**: AAT morx subtable types
    - Need font without GSUB but with morx

## Test Strategy

The issue is that many of these lines are:
1. Internal implementation details (break, continue, assignments)
2. Require specific font features that may not exist in test fonts
3. Require text that exactly matches coverage tables

To improve coverage significantly, we would need to:
1. Inspect actual font tables to find what features exist
2. Create minimal test fonts with specific lookup types
3. Know exact glyph IDs and coverage mappings

## Actual Impact

While line coverage is 53.76%, the functional coverage may be higher because:
- Many uncovered lines are defensive checks or control flow
- Core shaping logic IS covered
- Missing coverage is in edge cases and format-specific paths

To reach 70%+ coverage would require either:
- Creating custom test fonts with known lookup tables
- Using font introspection to find matching text
- Extensive manual testing with different font/text combinations
