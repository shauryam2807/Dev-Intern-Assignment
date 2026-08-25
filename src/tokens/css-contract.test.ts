import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIBRARIES } from '../libraries/index';
import { VOLT_STATUS_TOKENS } from '../libraries/volt/tokens/status';
import { buildSemanticTokens } from './brand';
import type { BrandDefinition } from './brand';
import { COMPONENT_TOKENS } from './component';
import { emitLayer, mergeEmitted, resolveTokenValue } from './emit';
import { GLOBAL_TOKENS } from './global';

/**
 * Architecture contract for the three-tier token system:
 *  1. every CSS variable the component stylesheets consume must exist in the
 *     emitted token set (no dangling references)
 *  2. component CSS never consumes raw color scales — colors come only from
 *     component tokens or semantic roles
 *  3. component color tokens back-reference the brand (semantic) layer, and
 *     geometry chains component → brand → primitive
 */

const BRAND: BrandDefinition = {
  name: 'Volt',
  accentHex: '#00c16a',
  grayTint: 'sand',
  radius: 'large',
  scaling: 1,
  fontFamily: 'system-ui, sans-serif',
  panelStyle: 'translucent',
};

const layers = [GLOBAL_TOKENS, buildSemanticTokens(BRAND, VOLT_STATUS_TOKENS), COMPONENT_TOKENS];

function varsUsed(css: string): string[] {
  return [...css.matchAll(/var\((--ev-[a-z0-9-]+)/g)].map((m) => m[1]);
}

// Raw scale steps from EVERY library's global layer — component CSS may only
// consume component tokens or semantic roles, never these.
const RAW_SCALE =
  /var\(--ev-(?:(?:gray|accent|green|blue|amber|red|brand|cyan|neutral|yellow)-a?\d+|calm-)/g;

// The contract runs per UI library, over each pack's own CSS + token layers.
describe('CSS ↔ token contract (per UI library)', () => {
  for (const meta of LIBRARIES) {
    describe(meta.id, () => {
      it('every --ev-* variable used in component CSS is emitted by the token model', { timeout: 15000 }, async () => {
        const lib = await meta.load();
        const libLayers = [
          lib.globalTokens,
          lib.buildSemantic(lib.defaultPreset),
          lib.componentTokens,
        ];
        const libEmitted = mergeEmitted(...libLayers.map(emitLayer));
        const names = new Set([
          ...Object.keys(libEmitted.base),
          ...Object.keys(libEmitted.light),
          ...Object.keys(libEmitted.dark),
        ]);
        for (const file of lib.cssFiles) {
          const css = readFileSync(join(process.cwd(), file), 'utf8');
          const missing = [...new Set(varsUsed(css))].filter(
            (name) => !names.has(name),
          );
          expect(missing, `${file} references unknown vars`).toEqual([]);
        }
      });

      it('component CSS never consumes raw color scales', async () => {
        const lib = await meta.load();
        for (const file of lib.cssFiles) {
          const css = readFileSync(join(process.cwd(), file), 'utf8');
          const hits = css.match(RAW_SCALE) ?? [];
          expect(hits, `${file} bypasses the component/semantic tiers`).toEqual(
            [],
          );
        }
      });
    });
  }
});

describe('layer back-referencing', () => {
  const semantic = layers[1];

  it('every component color token aliases the semantic layer (or is a documented literal)', () => {
    const offenders = COMPONENT_TOKENS.tokens
      .filter((t) => t.type === 'color')
      .filter((t) => !(t.alias?.layer === 'semantic'))
      .filter((t) => !t.description) // documented literals opt out
      .map((t) => t.path);
    expect(offenders).toEqual([]);
  });

  it('component geometry chains component → brand → primitive', () => {
    const buttonRadius = COMPONENT_TOKENS.tokens.find(
      (t) => t.path === 'button.radius',
    )!;
    expect(buttonRadius.alias).toEqual({
      layer: 'semantic',
      path: 'radius.interactive',
    });
    const role = semantic.tokens.find((t) => t.path === 'radius.interactive')!;
    expect(role.alias).toEqual({ layer: 'global', path: 'radius.3' });
    // Full chain resolves to the primitive base value.
    expect(resolveTokenValue(buttonRadius, layers, 'light')).toBe(6);
  });

  it('component color slots resolve through the brand accent to the brand hex', () => {
    const solidBg = COMPONENT_TOKENS.tokens.find(
      (t) => t.path === 'button.solid.bg',
    )!;
    expect(solidBg.alias).toEqual({ layer: 'semantic', path: 'accent.9' });
    expect(resolveTokenValue(solidBg, layers, 'light')).toBe('#00c16a');
  });

  it('status-driven component slots stay pinned through semantic → global', () => {
    const fill = COMPONENT_TOKENS.tokens.find(
      (t) => t.path === 'battery-bar.fill',
    )!;
    expect(fill.alias).toEqual({ layer: 'semantic', path: 'status.available' });
    const statusDef = semantic.tokens.find(
      (t) => t.path === 'status.available',
    )!;
    expect(statusDef.alias).toEqual({ layer: 'global', path: 'green.9' });
  });
});

describe('motion tier back-referencing', () => {
  it('component motion chains component → brand → primitive', () => {
    const t = COMPONENT_TOKENS.tokens.find(
      (x) => x.path === 'button.transition-duration',
    )!;
    expect(t.alias).toEqual({
      layer: 'semantic',
      path: 'motion.interaction.duration',
    });
    expect(resolveTokenValue(t, layers, 'light')).toBe('120ms');
    const easing = COMPONENT_TOKENS.tokens.find(
      (x) => x.path === 'pin.transition-easing',
    )!;
    expect(String(resolveTokenValue(easing, layers, 'light'))).toContain(
      'cubic-bezier(0.34, 1.56',
    );
  });
});
