import { describe, expect, it } from 'vitest';
import { VOLT_STATUS_TOKENS } from '../libraries/volt/tokens/status';
import {
  buildSemanticTokens,
  isValidHex,
  RADIUS_FACTORS,
} from './brand';
import type { BrandDefinition } from './brand';

const VOLT: BrandDefinition = {
  name: 'Volt',
  accentHex: '#00c16a',
  grayTint: 'sand',
  radius: 'large',
  scaling: 1,
  fontFamily: 'system-ui, sans-serif',
  panelStyle: 'translucent',
};

function tokenMap(brand: BrandDefinition) {
  return new Map(
    buildSemanticTokens(brand, VOLT_STATUS_TOKENS).tokens.map((t) => [
      t.path,
      t,
    ]),
  );
}

describe('buildSemanticTokens', () => {
  const tokens = tokenMap(VOLT);

  it('anchors light accent step 9 to the exact brand hex', () => {
    expect(tokens.get('accent.9')!.modes!.light).toBe('#00c16a');
  });

  it('produces full 12-step accent and gray scales for both modes', () => {
    for (let i = 1; i <= 12; i++) {
      for (const scale of ['accent', 'gray']) {
        const def = tokens.get(`${scale}.${i}`)!;
        expect(String(def.modes!.light)).toMatch(/^#/);
        expect(String(def.modes!.dark)).toMatch(/^#/);
      }
    }
    // Step 9 is anchored to the brand hex in both modes, but the scale ends
    // must diverge between light and dark.
    expect(tokens.get('accent.1')!.modes!.light).not.toBe(
      tokens.get('accent.1')!.modes!.dark,
    );
    expect(tokens.get('gray.12')!.modes!.light).not.toBe(
      tokens.get('gray.12')!.modes!.dark,
    );
  });

  it('produces distinct gray scales for different gray tints', () => {
    const sandTokens = tokenMap({ ...VOLT, grayTint: 'sand' });
    const mauveTokens = tokenMap({ ...VOLT, grayTint: 'mauve' });
    expect(sandTokens.get('gray.1')!.modes!.light).not.toBe(
      mauveTokens.get('gray.1')!.modes!.light,
    );
  });

  it('pins status hues to the fixed global scales, not the accent', () => {
    expect(tokens.get('status.available')!.alias).toEqual({
      layer: 'global',
      path: 'green.9',
    });
    expect(tokens.get('status.faulted')!.alias).toEqual({
      layer: 'global',
      path: 'red.9',
    });
    expect(tokens.get('status.occupied')!.alias).toEqual({
      layer: 'global',
      path: 'amber.9',
    });
  });

  it('maps charging status to the brand accent', () => {
    expect(tokens.get('status.charging')!.alias).toEqual({
      layer: 'semantic',
      path: 'accent.9',
    });
  });

  it('maps radius choice to factor and pill flag', () => {
    expect(tokens.get('radius-factor')!.value).toBe(RADIUS_FACTORS.large);
    expect(tokens.get('radius-full')!.value).toBe('0px');

    const full = tokenMap({ ...VOLT, radius: 'full' });
    expect(full.get('radius-full')!.value).toBe('9999px');
    const none = tokenMap({ ...VOLT, radius: 'none' });
    expect(none.get('radius-factor')!.value).toBe(0);
  });

  it('rejects invalid hex input', () => {
    expect(() =>
      buildSemanticTokens({ ...VOLT, accentHex: '#12' }),
    ).toThrow(/Invalid brand accent hex/);
    expect(() =>
      buildSemanticTokens({ ...VOLT, darkAccentHex: 'nope' }),
    ).toThrow(/Invalid brand dark accent hex/);
  });

  it('darkAccentHex anchors the dark scale independently (monochrome brands)', () => {
    const mono = tokenMap({
      ...VOLT,
      accentHex: '#1d1b1b',
      darkAccentHex: '#f4f4f4',
    });
    expect(mono.get('accent.9')!.modes!.light).toBe('#1d1b1b');
    expect(mono.get('accent.9')!.modes!.dark).toBe('#f4f4f4');
    // Without the override the generator refuses to anchor a near-black
    // accent in dark mode and auto-adjusts it to a muddy mid-gray — the
    // explicit darkAccentHex gives monochrome brands a deliberate paper
    // solid instead.
    const plain = tokenMap({ ...VOLT, accentHex: '#1d1b1b' });
    expect(plain.get('accent.9')!.modes!.dark).not.toBe('#1d1b1b');
    expect(plain.get('accent.9')!.modes!.dark).not.toBe(
      mono.get('accent.9')!.modes!.dark,
    );
  });

  it('keeps the core library-agnostic: no status slots without extraTokens', () => {
    const core = buildSemanticTokens(VOLT);
    expect(core.tokens.some((t) => t.path.startsWith('status.'))).toBe(false);
  });

  // The shared shell CSS (base/playground/themepanel/board) and TokensView
  // consume these roles — every UI library's semantic layer must emit them.
  it('emits the semantic role contract every library depends on', () => {
    const core = new Map(
      buildSemanticTokens(VOLT).tokens.map((t) => [t.path, t]),
    );
    const ROLES = [
      'color.bg',
      'color.surface',
      'color.panel',
      'color.panel-blur',
      'color.overlay',
      'color.text',
      'color.text-secondary',
      'color.border',
      'color.border-strong',
      'color.focus-ring',
      'accent.contrast',
      'accent.surface',
      'font.family',
      'radius.small',
      'radius.interactive',
      'radius.container',
      'radius.overlay',
      'text.caption',
      'text.body',
      'text.label',
      'text.title',
      'text.heading',
      'text.display',
      'motion.interaction.duration',
      'motion.interaction.easing',
      'motion.entrance.duration',
      'motion.entrance.easing',
      'motion.swap.duration',
      'motion.swap.easing',
      'motion.exit.duration',
      'motion.exit.easing',
      'motion.progress.duration',
      'motion.progress.easing',
      'motion.emphasis.duration',
      'motion.emphasis.easing',
      'scaling',
      'radius-factor',
      'radius-full',
    ];
    for (const role of ROLES) {
      expect(core.has(role), `missing semantic role: ${role}`).toBe(true);
    }
  });
});

describe('isValidHex', () => {
  it('accepts 6-digit hex with or without hash', () => {
    expect(isValidHex('#00c16a')).toBe(true);
    expect(isValidHex('00C16A')).toBe(true);
    expect(isValidHex('#00c16')).toBe(false);
    expect(isValidHex('teal')).toBe(false);
  });
});
