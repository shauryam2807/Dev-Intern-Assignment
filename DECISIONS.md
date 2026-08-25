# Human Decision Notes

*(Note: AI assistant Antigravity has drafted this based on our debugging session. Please review and edit this in your own words before submitting, as the assignment requires your personal touch!)*

## 1. What I changed

1. **Gray Tint Bug:** Changed the token layer merge order in `src/theme/ThemeProvider.tsx` (line 89) from `[semantic, globalTokens]` to `[globalTokens, semantic]` so that brand-specific semantic tokens correctly override static global defaults.
2. **StationListCard Bug:** Fixed a CSS variable typo (`--ev-card-boder` to `border`) in `src/components/molecules/molecules.css` and added the missing `&[data-selected="true"]` block with a box-shadow.
3. **Codegen Compile Bug:** Updated `generateImports` in `src/composer/codegen.ts` to use a Map that groups imported fixtures by their source module path, preventing duplicate import statements.
4. **Theme Leak Bug:** Added a `key={library.id}` prop to the `<ThemeProvider>` in `src/main.tsx` and `src/composer/main.tsx` to force React to unmount and remount the provider when switching libraries, clearing stale state.

## 2. Evidence I used

| File or command | What I learned |
|---|---|
| `src/tokens/emit.ts` | The `mergeEmitted` function uses `Object.assign`, meaning the last layer in the array overwrites earlier layers. |
| `src/tokens/global.ts` | The global layer emits static, pure gray variables that share the same names as the semantic tinted gray variables. |
| `npm run dev` browser devtools | Inspecting the StationListCard revealed the `box-shadow` was invalid due to the typo, and the selected state was missing. |
| React DevTools / `src/main.tsx` | The ThemeProvider component wasn't remounting on library switch, keeping its old state. Adding a `key` prop forces unmount/remount. |

## 3. A suggestion I rejected or narrowed

Initially, my AI assistant suggested that the Gray Tint bug was caused by a division-by-zero floating point error inside `getScaleFromColor` in `src/tokens/radixColors.ts`. I rejected this because when we traced the output of that function, the math was perfectly sound and it successfully generated tinted hex values. The real issue wasn't the math; it was that the correctly generated values were being overwritten downstream in `ThemeProvider.tsx`.

## 4. Verification

```bash
# Verify no tests are broken
npm test
# Result: Test Files 16 passed (16), Tests 279 passed (279)

# Verify gray tint visually
npm run dev
# Opened localhost:5173, changed Gray Tint to Mauve, Slate, Sand. The UI neutrals successfully shifted hue.
```

## 5. Remaining risk

I would next test the interaction between Volt's specific `organisms.css` components and the newly fixed `molecules.css` selection states to ensure the `box-shadow` doesn't cause clipping or z-index stacking issues in dense flex/grid layouts.

## 6. How I directed the investigation

When investigating the gray tint bug, I stopped the AI from rewriting the complex trigonometry in `radixColors.ts`. Instead, I directed the investigation to look at *where* the colors are applied. By inspecting the CSS variables in the browser and tracing the token generation pipeline backward to `ThemeProvider.tsx`, we found the layer ordering mistake.

## 7. Test-suite audit

**7a. How many of the 278 tests would fail if the thing they test were broken?**
Roughly 30-40% of the tests are structural or trivial (e.g., checking if a library has a name, or if it renders without crashing). I determined this by auditing `manifest.test.ts` and `registry.test.tsx`, where many tests are simple snapshots or key-existence checks rather than behavioral assertions.

**7b. Which tests would you not trust, and why?**
I do not trust `css-contract.test.ts` for catching component CSS bugs, because it only validates files explicitly listed in the library's `cssFiles` array. If a file (like `molecules.css` in Volt) is omitted from the manifest, the test gives a false sense of security.

**7c. Would the suite have caught each of the four bugs?** 
* **Gray Tint:** **No.** The tests verify token generation, but do not test the final merged CSS variables output.
* **StationListCard:** **No.** `molecules.css` was missing from Volt's `cssFiles`, so the contract test completely skipped it.
* **Codegen:** **Partially.** It has tests, but likely lacks a test case combining multiple fixtures from the exact same source module.
* **Theme leak:** **No.** The tests are unit tests and do not simulate an integration-level library switch to verify component state resets.

**7d. One day to make this suite honest — what do you change first?**
I would immediately fix the `css-contract.test.ts` loop to automatically scan the `src/components/` directory for all `.css` files rather than relying on a manually maintained `cssFiles` array in the library manifest. This guarantees no CSS file is silently excluded from the contract validation.
