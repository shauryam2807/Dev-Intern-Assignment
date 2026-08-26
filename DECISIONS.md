# Human Decision Notes

## 1. What I changed

1. **Gray Tint Bug:**
   I changed the token merge order in `src/theme/ThemeProvider.tsx` (line 89) from `[semantic, globalTokens]` to `[globalTokens, semantic]`. This makes sure the semantic tokens with the brand tint override the default global gray tokens.

2. **StationListCard Bug:**
   I fixed a CSS variable typo in `src/components/molecules/molecules.css`, where `--ev-card-boder` was written wrong. I also added the missing `&[data-selected="true"]` block with a box-shadow for the selected card.

3. **Codegen Compile Bug:**
   I updated `generateImports` in `src/composer/codegen.ts`. I used a Map to group fixtures which are coming from the same source module. This prevents the same module from being imported multiple times.

4. **Theme Leak Bug:**
   I added `key={library.id}` to the `ThemeProvider` in `src/main.tsx` and `src/composer/main.tsx`. This makes React unmount and mount the provider again when the library is changed, so the old state doesn't stay there.

## 2. Evidence I used

| File / command                   | What I found                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/tokens/emit.ts`             | `mergeEmitted` uses `Object.assign`, so the last layer overwrites the previous values.                                                     |
| `src/tokens/global.ts`           | The global layer creates the normal gray variables, which have the same names as the semantic tinted gray variables.                       |
| `npm run dev` + browser DevTools | I checked the StationListCard and found that the box-shadow was invalid because of the CSS typo. Also, the selected state was not present. |
| React DevTools / `src/main.tsx`  | The ThemeProvider was not remounting when switching libraries, so some old state was being kept. The `key` prop fixes this.                |

## 3. A suggestion I rejected

At first, the AI assistant suggested that the Gray Tint bug was because of a division-by-zero floating point issue inside `getScaleFromColor` in `src/tokens/radixColors.ts`.

I didn't agree with this after checking the function. The calculation was working correctly and it was generating the tinted hex values properly. So the problem was not in the calculation. The actual problem was later in the pipeline, where the correct values were getting overwritten in `ThemeProvider.tsx`.

## 4. Verification

I ran the test suite using:

```bash
npm test
```

The result was:

```text
Test Files 16 passed (16)
Tests 279 passed (279)
```

I also ran:

```bash
npm run dev
```

Then I opened the app on localhost:5173 and changed the Gray Tint to Mauve, Slate and Sand. The neutral colors in the UI changed their hue correctly.

## 5. Remaining risk

I would next test the interaction between Volt's `organisms.css` components and the fixed selection states in `molecules.css`.

Mainly, I want to make sure the new box-shadow does not get clipped or create any z-index problems when the components are used inside dense flex or grid layouts.

## 6. How I directed the investigation

While checking the gray tint issue, I didn't want to start changing the complicated trigonometry inside `radixColors.ts`.

Instead, I focused on where the generated colors were actually being applied. I checked the CSS variables in the browser and then traced the token generation flow back to `ThemeProvider.tsx`.

That is how I found that the main problem was the order in which the token layers were being merged.

## 7. Test-suite audit

### 7a. How many of the 278 tests would fail if the thing they test was broken?

I think roughly 30–40% of the tests are structural or fairly basic. For example, some tests only check if a library has a name or if something renders without crashing.

I got this idea from checking `manifest.test.ts` and `registry.test.tsx`, where quite a few tests are based on snapshots or checking that certain keys exist instead of checking actual behavior.

### 7b. Which tests would I not trust, and why?

I would not fully trust `css-contract.test.ts` for finding component CSS issues.

The reason is that it only checks the CSS files which are included in the library's `cssFiles` array. So if a CSS file is accidentally missing from the manifest, the test will not check that file at all.

For example, this was a problem with `molecules.css` in Volt.

### 7c. Would the suite have caught all four bugs?

* **Gray Tint:** **No.** The tests check token generation, but they don't check the final merged CSS variable values.
* **StationListCard:** **No.** `molecules.css` was missing from Volt's `cssFiles`, so the CSS contract test didn't check it.
* **Codegen:** **Partially.** There are tests for it, but I don't think there was a case where multiple fixtures came from the exact same source module.
* **Theme Leak:** **No.** The current tests are mostly unit tests and don't test switching between libraries and checking whether the component state is reset.

### 7d. If I had one day to make the test suite more reliable, what would I change first?

First, I would fix `css-contract.test.ts` so it automatically scans the `src/components/` directory for all `.css` files instead of depending only on the manually maintained `cssFiles` array.

This would make the test more reliable because a CSS file couldn't be silently skipped just because someone forgot to add it to the manifest.
