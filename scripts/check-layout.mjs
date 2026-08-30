/**
 * Layout regression guard.
 *
 * Track 0C fixed a set of layout bugs that all shared one property: they were
 * invisible. Two of them were Tailwind class names that compile to no CSS at
 * all (`aspect-16:9`, `-translate-1/2`), so nothing failed -- the page just
 * silently rendered wrong. The others were viewport-unit widths that overflow
 * the document by exactly the width of the scrollbar.
 *
 * Nothing in eslint or tsc catches any of this, so this script does. It runs
 * ahead of eslint in `pnpm lint`.
 *
 * Escape hatch: put `layout-check-ignore` in a comment on the offending line.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: the checkout lives under a directory with a
// space in its name, which .pathname hands back percent-encoded.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const EXTENSIONS = [".ts", ".tsx", ".css"];

const RULES = [
  {
    id: "no-w-screen",
    pattern: /\bw-screen\b/,
    message:
      "`w-screen` is `width: 100vw`, which includes the vertical scrollbar and overflows the document. Use `w-full`.",
  },
  {
    id: "no-viewport-width-declaration",
    pattern: /width:\s*100vw/,
    message:
      "`width: 100vw` includes the vertical scrollbar and overflows the document. Use `width: 100%`.",
  },
  {
    id: "no-invalid-aspect-ratio",
    pattern: /\baspect-\d+:\d+/,
    message:
      "`aspect-N:N` is not a Tailwind utility -- the colon parses as a variant separator and it compiles to nothing. Use `aspect-video`, `aspect-16/9`, or the shared `.player-frame`.",
  },
  {
    id: "no-axisless-translate-half",
    pattern: /(?<![xy]-)\btranslate-1\/2\b/,
    message:
      "`translate-1/2` has no axis and compiles to nothing. Use `-translate-x-1/2 -translate-y-1/2`.",
  },
];

/**
 * Blank out comment bodies while preserving line count and column positions, so
 * the prose in globals.css that *describes* these bugs does not trip the rules.
 */
function stripComments(source) {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " ")
  );
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) =>
    lead + " ".repeat(m.length - lead.length)
  );
  return out;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) yield full;
  }
}

const failures = [];

for (const file of walk(SRC)) {
  const raw = readFileSync(file, "utf8");
  const rawLines = raw.split("\n");
  const scanLines = stripComments(raw).split("\n");

  scanLines.forEach((line, i) => {
    if (rawLines[i]?.includes("layout-check-ignore")) return;
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        failures.push({
          file: relative(ROOT, file).replace(/\\/g, "/"),
          line: i + 1,
          rule,
          text: rawLines[i].trim(),
        });
      }
    }
  });
}

if (failures.length === 0) {
  console.log(`layout check: ok (${RULES.length} rules)`);
  process.exit(0);
}

console.error(`\nlayout check: ${failures.length} problem(s)\n`);
for (const f of failures) {
  console.error(`  ${f.file}:${f.line}  [${f.rule.id}]`);
  console.error(`    ${f.text}`);
  console.error(`    ${f.rule.message}\n`);
}
process.exit(1);
