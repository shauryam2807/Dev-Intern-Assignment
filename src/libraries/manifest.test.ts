import { describe, expect, it } from 'vitest';
import { DEFAULT_LIBRARY_ID, LIBRARIES, libraryMeta } from './index';

describe('library manifest', () => {
  it('has unique ids and a valid default', () => {
    const ids = LIBRARIES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_LIBRARY_ID);
  });

  it('resolves unknown ids to the default library', () => {
    expect(libraryMeta('nope').id).toBe(LIBRARIES[0].id);
    expect(libraryMeta(null).id).toBe(LIBRARIES[0].id);
  });

  for (const meta of LIBRARIES) {
    describe(`pack: ${meta.id}`, () => {
      it('loads and satisfies the UiLibrary contract', { timeout: 15000 }, async () => {
        const lib = await meta.load();
        expect(lib.id).toBe(meta.id);
        expect(lib.name).toBe(meta.name);
        expect(lib.presets.length).toBeGreaterThan(0);
        expect(lib.presets).toContain(lib.defaultPreset);
        expect(lib.cssFiles.length).toBeGreaterThan(0);
        expect(lib.tiers.map((t) => t.id)).toEqual([
          'atoms',
          'molecules',
          'organisms',
        ]);
        expect(Object.keys(lib.composerConfig.components).length)
          .toBeGreaterThan(0);
      });

      it('codegen emitters cover exactly the registered components', async () => {
        const lib = await meta.load();
        const registered = Object.keys(lib.composerConfig.components).sort();
        const emitted = Object.keys(lib.codegen.emitters).sort();
        expect(emitted).toEqual(registered);
      });

      it('categories reference only registered components', async () => {
        const lib = await meta.load();
        const registered = new Set(Object.keys(lib.composerConfig.components));
        const categorized = Object.values(
          lib.composerConfig.categories ?? {},
        ).flatMap((c) => c.components ?? []);
        for (const name of categorized) {
          expect(registered.has(name), `unregistered: ${name}`).toBe(true);
        }
      });

      it('seed screens use only registered component types', async () => {
        const lib = await meta.load();
        const registered = new Set(Object.keys(lib.composerConfig.components));
        const walk = (entries: Array<{ type: string; props: any }>) => {
          for (const entry of entries) {
            expect(registered.has(entry.type), `unknown: ${entry.type}`).toBe(
              true,
            );
            for (const value of Object.values(entry.props ?? {})) {
              if (
                Array.isArray(value) &&
                value.every((v) => v && typeof v === 'object' && 'type' in v)
              ) {
                walk(value as never);
              }
            }
          }
        };
        for (const screen of lib.seed().screens) {
          walk(screen.puckData.content as never);
        }
      });
    });
  }
});
