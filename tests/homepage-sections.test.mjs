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
  './SafeImage': { SafeImage: 'SafeImage' },
  'react': { useRef: () => ({ current: null }) },
  'lucide-react': { ChevronLeft: 'ChevronLeft', ChevronRight: 'ChevronRight' },
  'next/link': { default: 'Link' },
  '@/hooks/useHeroSettings': { useHeroSettings: () => ({ data: { image_duration_seconds: 5, display_mode: 'thumbnail_trailer', trailer_preview_seconds: 20 } }) },
  '@/lib/auth-return': { playbackDestination: () => '/programs/1' },
};
const runtime = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
const context = { exports: {}, require: name => name === 'react/jsx-runtime' ? runtime : modules[name] ?? (() => { throw new Error(`Unexpected dependency: ${name}`); })() };
vm.runInNewContext(code, context);

test('homepage restores the channel rail without moving editorial or paid sections', () => {
  const sections = [
    { id: 'featured_hero', enabled: true, items: [{ id: 2 }] },
    { id: 'featured_channels', enabled: true, items: [{ id: 1, name: 'Channel One', cover_image_url: '/channel.png' }] },
    { id: 'homepage_top_banner', enabled: true, source: 'advertising', items: [] },
    { id: 'movies', enabled: true, label: 'Movies', items: [] },
  ];
  const tree = context.exports.HomeSections({ homepage: { sections }, authenticated: false });
  const visible = tree.props.children.filter(Boolean);
  assert.deepEqual(visible.map(node => typeof node.type === 'function' ? node.type.name : node.type), ['HomeHero', 'Channels', 'SponsoredPlacement', 'ContentRail']);
  assert.equal(visible[0].props.settings.image_duration_seconds, 5);
  assert.equal(visible[2].props.context, 'homepage');
  const rail = visible[1].type(visible[1].props);
  assert.equal(rail.props['aria-label'], 'Channels');
  assert.equal(rail.props.children[1].props['aria-label'], 'Channel carousel');
  assert.equal(rail.props.children[1].props.children[0].props.href, '/channels/1');
});
