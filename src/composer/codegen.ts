import type { Data } from '@puckeditor/core';

/**
 * Puck Data → copy-pasteable JSX: the generic engine. Each UI library
 * supplies a CodegenPack whose emitters mirror its registry render mappings
 * (label→children, fixture indices→fixture imports, 0→omitted optionals),
 * so generated code renders identically to the canvas.
 */

export interface JsxNode {
  name: string;
  attrs: string[];
  children: Array<JsxNode | string>;
}

export type ComponentEntry = { type: string; props: Record<string, any> };

export interface EmitCtx {
  fixtures: Set<string>;
}

export type JsxEmitter = (
  props: Record<string, any>,
  ctx: EmitCtx,
  kids: Array<JsxNode | string>,
) => JsxNode;

export interface CodegenPack {
  emitters: Record<string, JsxEmitter>;
  /** Module specifier → exported names, for the generated import block. */
  importSources: Record<string, string[]>;
  /** Fixture name → module specifier. */
  fixtures: Record<string, string>;
}

// Attribute helpers — shared vocabulary for every library's emitters.
export const str = (k: string, v: unknown) =>
  `${k}=${JSON.stringify(String(v))}`;
export const num = (k: string, v: unknown) => `${k}={${Number(v)}}`;
export const flag = (k: string, v: unknown) => (v ? [k] : []);
export const expr = (k: string, code: string) => `${k}={${code}}`;

/** Emitters for the library-agnostic layout primitives — every pack spreads
 *  these into its emitter map. */
export const LAYOUT_EMITTERS: Record<string, JsxEmitter> = {
  Group: (p, _ctx, kids) => ({
    name: 'Group',
    attrs: [
      ...(p.direction && p.direction !== 'vertical'
        ? [str('direction', p.direction)]
        : []),
      ...flag('wrap', p.wrap),
      ...(p.gapV ? [num('gapV', p.gapV)] : []),
      ...(p.gapH ? [num('gapH', p.gapH)] : []),
      ...(p.padding ? [num('padding', p.padding)] : []),
      ...(p.align && p.align !== 'stretch' ? [str('align', p.align)] : []),
      ...(p.justify && p.justify !== 'start'
        ? [str('justify', p.justify)]
        : []),
    ],
    children: kids,
  }),
  Stack: (p, _ctx, kids) => ({
    name: 'Stack',
    attrs: [num('gap', p.gap), num('padding', p.padding)],
    children: kids,
  }),
  Row: (p, _ctx, kids) => ({
    name: 'Row',
    attrs: [num('gap', p.gap), str('align', p.align), ...flag('wrap', p.wrap)],
    children: kids,
  }),
  Spacer: (p) => ({
    name: 'Spacer',
    attrs: [num('height', p.height)],
    children: [],
  }),
};

/** Names the layout primitives contribute to a pack's './primitives' import
 *  source (libraries append their own primitives, e.g. volt's ScreenHeader). */
export const LAYOUT_PRIMITIVE_NAMES = [
  'Group',
  'LayoutBox',
  'Page',
  'Row',
  'Spacer',
  'Stack',
];

/** Shared `box` layout prop → LayoutBox attrs; defaults emit nothing. */
function boxAttrs(box: Record<string, any> | undefined): string[] {
  if (!box) return [];
  return [
    ...(box.align && box.align !== 'stretch' ? [str('align', box.align)] : []),
    ...(box.sticky && box.sticky !== 'none' ? [str('sticky', box.sticky)] : []),
    ...flag('bleed', box.bleed),
  ];
}

function emit(entry: ComponentEntry, ctx: EmitCtx, pack: CodegenPack): JsxNode {
  const emitter = pack.emitters[entry.type];
  if (!emitter) throw new Error(`No JSX emitter for component type "${entry.type}"`);
  const slotKids: (JsxNode | string)[] = [];
  for (const value of Object.values(entry.props ?? {})) {
    if (Array.isArray(value) && value.every((v) => v && typeof v === 'object' && 'type' in v)) {
      for (const child of value as ComponentEntry[]) slotKids.push(emit(child, ctx, pack));
    }
  }
  const node = emitter(entry.props ?? {}, ctx, slotKids);
  // The `box` prop is handled centrally (withLayout wraps every component),
  // so individual emitters never need to know about it.
  const attrs = boxAttrs((entry.props ?? {}).box);
  return attrs.length ? { name: 'LayoutBox', attrs, children: [node] } : node;
}

function print(node: JsxNode | string, indent: number): string {
  const pad = '  '.repeat(indent);
  if (typeof node === 'string') return `${pad}${node}`;
  const attrs = node.attrs.length ? ' ' + node.attrs.join(' ') : '';
  if (node.children.length === 0) return `${pad}<${node.name}${attrs} />`;
  const kids = node.children.map((c) => print(c, indent + 1)).join('\n');
  return `${pad}<${node.name}${attrs}>\n${kids}\n${pad}</${node.name}>`;
}

export function pascalCase(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/);
  const joined = parts.map((p) => p[0]?.toUpperCase() + p.slice(1)).join('');
  return /^[A-Za-z]/.test(joined) ? joined : `Screen${joined}`;
}

export function puckDataToJsx(
  data: Data,
  screenName: string,
  pack: CodegenPack,
): string {
  const ctx: EmitCtx = { fixtures: new Set() };
  let nodes = (data.content as ComponentEntry[]).map((entry) =>
    emit(entry, ctx, pack),
  );

  // Root layout (Page panel): wrap the screen when side padding / block gap set.
  const rootProps = (data.root?.props ?? {}) as Record<string, any>;
  if (rootProps.sidePadding || rootProps.blockGap) {
    nodes = [
      {
        name: 'Page',
        attrs: [
          ...(rootProps.sidePadding ? [num('sidePadding', rootProps.sidePadding)] : []),
          ...(rootProps.blockGap ? [num('blockGap', rootProps.blockGap)] : []),
        ],
        children: nodes,
      },
    ];
  }

  const used = new Set<string>();
  const collect = (n: JsxNode | string) => {
    if (typeof n === 'string') return;
    used.add(n.name);
    n.children.forEach(collect);
  };
  nodes.forEach(collect);

  const imports: string[] = [];
  for (const [source, names] of Object.entries(pack.importSources)) {
    const hit = names.filter((n) => used.has(n)).sort();
    if (hit.length) imports.push(`import { ${hit.join(', ')} } from '${source}';`);
  }
  const fixtureNames = [...ctx.fixtures].sort();
  if (fixtureNames.length) {
    const bySource: Record<string, string[]> = {};
    for (const name of fixtureNames) {
      const source = pack.fixtures[name];
      if (!bySource[source]) bySource[source] = [];
      bySource[source].push(name);
    }
    for (const [source, names] of Object.entries(bySource)) {
      imports.push(`import { ${names.join(', ')} } from '${source}';`);
    }
  }

  const body =
    nodes.length === 0
      ? '    <></>'
      : nodes.length === 1
        ? print(nodes[0], 2)
        : `    <>\n${nodes.map((n) => print(n, 3)).join('\n')}\n    </>`;

  return `${imports.join('\n')}\n\nexport function ${pascalCase(screenName)}Screen() {\n  return (\n${body}\n  );\n}\n`;
}
