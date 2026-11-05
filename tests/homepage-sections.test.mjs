import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/HomeSections.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const modules = {
  './HomeHero': { HomeHero: 'HomeHero' },
  './ContentRail': { ContentRail: 'ContentRail' },
  './ProgramCard': { ProgramCard: 'ProgramCard' },
  './SponsoredPlacement': { SponsoredPlacement: 'SponsoredPlacement' },
  '@/lib/auth-return': { playbackDestination: () => '/programs/1' },
};
const runtime = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
const context = { exports: {}, require: name => name === 'react/jsx-runtime' ? runtime : modules[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); })() };
vm.runInNewContext(code, context);

test('homepage omits the old featured channel carousel while preserving editorial and paid sections', () => {
  const sections = [
    { id: 'featured_channels', enabled: true, items: [{ id: 1 }] },
    { id: 'featured_hero', enabled: true, items: [{ id: 2 }] },
    { id: 'homepage_top_banner', enabled: true, source: 'advertising', items: [] },
    { id: 'movies', enabled: true, label: 'Movies', items: [] },
  ];
  const tree = context.exports.HomeSections({ homepage: { sections }, authenticated: false });
  const visible = tree.props.children.filter(Boolean);
  assert.deepEqual(visible.map(node => node.type), ['HomeHero', 'SponsoredPlacement', 'ContentRail']);
  assert.equal(visible[1].props.context, 'homepage');
});
