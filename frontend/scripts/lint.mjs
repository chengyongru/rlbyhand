import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const frontendDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(frontendDir, '..');
const srcDir = path.join(frontendDir, 'src');
const chaptersDir = path.join(srcDir, 'blog', 'chapters');

const errors = [];

function fail(file, rule, detail) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  errors.push(`[${rule}] ${rel}: ${detail}`);
}

function walk(dir, filterFn) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, filterFn));
    } else if (filterFn(full)) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function stripFencedCode(mdx) {
  return mdx.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '));
}

function stripNonProseForPunct(prose) {
  return prose
    .replace(/^import\s+[^\n]+$/gm, (m) => ' '.repeat(m.length))
    .replace(/export\s+const\s+meta\s*=\s*\{[\s\S]*?\};?/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\$[^$\n]+\$/g, (m) => ' '.repeat(m.length))
    .replace(/`[^`\n]+`/g, (m) => ' '.repeat(m.length))
    .replace(/<[^>]+>/g, (m) => ' '.repeat(m.length))
    .replace(/https?:\/\/[^\s)]+/g, (m) => ' '.repeat(m.length));
}

function visualCols(line) {
  let cols = 0;
  for (const ch of line) {
    cols += ch.codePointAt(0) > 0x7f ? 2 : 1;
  }
  return cols;
}

const tsFiles = walk(srcDir, (f) => /\.(ts|tsx)$/.test(f));
for (const file of tsFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, text);
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const snippet = scanner.getTokenText();
      if (!snippet.startsWith('/// <reference')) {
        const pos = scanner.getTokenPos();
        fail(file, 'no-ts-comments', `line ${lineOf(text, pos)} contains a comment`);
        break;
      }
    }
    token = scanner.scan();
  }

  const isWidget =
    file.includes(path.join('blog', 'components')) ||
    file.includes(path.join('src', 'components'));
  if (isWidget) {
    const arrowMatch = text.match(/[→▶←◀⇒➔➜]/);
    if (arrowMatch) {
      fail(
        file,
        'no-unicode-arrows-in-widgets',
        `line ${lineOf(text, arrowMatch.index)} uses printed arrow "${arrowMatch[0]}" instead of roughjs ChalkArrow`
      );
    }
    const btnMatch = text.match(/<button\b/);
    if (btnMatch) {
      fail(file, 'no-extra-buttons', `line ${lineOf(text, btnMatch.index)} contains <button>`);
    }
    const nonHandFont = text.match(/--chalk-font-(body|mono)/);
    if (nonHandFont) {
      fail(
        file,
        'figure-handwriting-only',
        `line ${lineOf(text, nonHandFont.index)} uses "${nonHandFont[0]}" inside a sketch widget; use className="chalk-title" (handwriting font) instead`
      );
    }
    for (const m of text.matchAll(/<text\b[^>]*>/g)) {
      if (!/className\s*=\s*["'][^"']*\bchalk-title\b/.test(m[0])) {
        fail(
          file,
          'figure-handwriting-only',
          `line ${lineOf(text, m.index)} SVG <text> is missing className="chalk-title"`
        );
      }
    }
  }
}

const readerFile = path.join(srcDir, 'blog', 'BlogReader.tsx');
if (fs.existsSync(readerFile)) {
  const readerText = fs.readFileSync(readerFile, 'utf8');
  const btnMatch = readerText.match(/<button\b/);
  if (btnMatch) {
    fail(readerFile, 'no-extra-buttons', `line ${lineOf(readerText, btnMatch.index)} contains <button>`);
  }
}

const indexFile = path.join(srcDir, 'blog', 'index.ts');
const indexText = fs.readFileSync(indexFile, 'utf8');
if (indexText.includes('·')) {
  fail(indexFile, 'no-middle-dot', 'contains middle dot "·"');
}
if (/from\s+['"]\.\/chapters\/.+\.mdx['"]/.test(indexText)) {
  fail(indexFile, 'dynamic-chapter-discovery', 'index.ts must not hardcode static chapter imports; use import.meta.glob');
}
for (const m of indexText.matchAll(/\b(?:name|title)\s*:\s*['"]([^'"]+)['"]/g)) {
  if (/[()（）]/.test(m[1])) {
    fail(indexFile, 'no-parens-in-title', `line ${lineOf(indexText, m.index)} title "${m[1]}" contains parentheses`);
  }
}

const mdxFiles = walk(chaptersDir, (f) => f.endsWith('.mdx'));
const publishedIds = new Set();
for (const file of mdxFiles) {
  const raw = fs.readFileSync(file, 'utf8');
  const metaMatch = raw.match(/export\s+const\s+meta\s*=\s*\{([\s\S]*?)\}/);
  if (metaMatch && /\bpublished\s*:\s*true\b/.test(metaMatch[1])) {
    publishedIds.add(path.basename(file, '.mdx'));
  }
}

for (const file of mdxFiles) {
  const raw = fs.readFileSync(file, 'utf8');
  const metaMatch = raw.match(/export\s+const\s+meta\s*=\s*\{([\s\S]*?)\}/);
  if (!metaMatch || !/\bname\s*:\s*['"][^'"]+['"]/.test(metaMatch[1])) {
    fail(file, 'chapter-meta-required', 'missing `export const meta = { name: "...", published: true|false }`');
  } else {
    if (!/\bpublished\s*:\s*(true|false)\b/.test(metaMatch[1])) {
      fail(file, 'chapter-meta-required', 'meta is missing `published: true|false`');
    }
    for (const field of metaMatch[1].matchAll(/\b(?:name|title)\s*:\s*['"]([^'"]+)['"]/g)) {
      if (/[()（）]/.test(field[1])) {
        fail(file, 'no-parens-in-title', `meta title "${field[1]}" contains parentheses`);
      }
    }
  }
  const prose = stripFencedCode(raw);

  const checks = [
    ['no-middle-dot', /·/g, 'contains middle dot "·" (use spaces instead)'],
    ['no-em-dash', /——/g, 'contains em-dash "——"'],
    ['no-live-tense', /今天/g, 'contains live-broadcast word "今天"'],
    ['no-fourth-wall', /黑板|粉笔/g, 'breaks fourth wall by mentioning "黑板/粉笔"'],
    ['no-unfilled-marker', /\[!empty\]/g, 'contains unfilled [!empty] placeholder'],
    ['no-mdx-headings', /^#{1,6}\s+.+/gm, 'uses Markdown heading (# to ######), which is disallowed in chapter prose'],
    ['no-mdx-headings', /<h[1-6]\b/gi, 'uses HTML heading tag (h1 to h6), which is disallowed in chapter prose'],
  ];

  for (const [rule, regex, msg] of checks) {
    for (const m of prose.matchAll(regex)) {
      fail(file, rule, `line ${lineOf(prose, m.index)} ${msg}`);
    }
  }

  const cleanProse = stripNonProseForPunct(prose);
  for (const m of cleanProse.matchAll(/[：:]/g)) {
    fail(file, 'no-colon', `line ${lineOf(cleanProse, m.index)} contains colon "${m[0]}"`);
  }
  for (const m of cleanProse.matchAll(/[；;]/g)) {
    fail(file, 'no-semicolon', `line ${lineOf(cleanProse, m.index)} contains semicolon "${m[0]}"`);
  }
  for (const m of cleanProse.matchAll(/[\u4e00-\u9fff]\s*[（(][A-Za-z][A-Za-z0-9\s\-/]*[）)]/g)) {
    fail(file, 'no-cn-en-parens', `line ${lineOf(cleanProse, m.index)} uses Chinese-with-English-parens "${m[0]}"`);
  }

  for (const m of prose.matchAll(/\]\(#\/([^)\s#]+)\)/g)) {
    const targetId = m[1];
    if (!publishedIds.has(targetId)) {
      fail(file, 'valid-internal-chapter-link', `line ${lineOf(prose, m.index)} links to unpublished chapter "#/${targetId}"`);
    }
  }

  for (const m of prose.matchAll(/https:\/\/github\.com\/chengyongru\/rlbyhand\/blob\/main\/([^)\s"']+)/g)) {
    const relTarget = m[1].split('#')[0];
    const absTarget = path.join(repoRoot, relTarget);
    if (!fs.existsSync(absTarget)) {
      fail(file, 'valid-repo-file-link', `line ${lineOf(prose, m.index)} links to non-existent repo file "${relTarget}"`);
    }
  }

  for (const block of raw.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
    const startLine = lineOf(raw, block.index) + 1;
    const lines = block[1].split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const cols = visualCols(lines[i]);
      if (cols > 68) {
        fail(
          file,
          'code-block-line-length',
          `line ${startLine + i} in code block is ${cols} cols (> 68); wrap it cleanly to avoid horizontal scroll`
        );
      }
    }
  }
}

const cssFile = path.join(srcDir, 'index.css');
const cssText = fs.readFileSync(cssFile, 'utf8');
if (!cssText.includes('color-scheme: dark')) {
  fail(cssFile, 'dark-mode-only', 'missing "color-scheme: dark"');
}
if (/prefers-color-scheme:\s*light/.test(cssText)) {
  fail(cssFile, 'dark-mode-only', 'contains light color-scheme media query');
}

const viteConfigFile = path.join(frontendDir, 'vite.config.ts');
const viteConfigText = fs.readFileSync(viteConfigFile, 'utf8');
if (!/output:\s*['"]html['"]/.test(viteConfigText)) {
  fail(viteConfigFile, 'katex-single-output', 'rehypeKatex must set { output: "html" } to prevent duplicate copy-paste');
}

const htmlFile = path.join(frontendDir, 'index.html');
const htmlText = fs.readFileSync(htmlFile, 'utf8');
for (const [needle, label] of [
  ['name="description"', 'meta description'],
  ['property="og:title"', 'Open Graph og:title'],
  ['name="twitter:card"', 'Twitter card'],
  ['rel="icon"', 'favicon'],
]) {
  if (!htmlText.includes(needle)) {
    fail(htmlFile, 'seo-and-favicon', `missing ${label}`);
  }
}
if (htmlText.includes('·')) {
  fail(htmlFile, 'no-middle-dot', 'contains middle dot "·"');
}

if (errors.length > 0) {
  console.error(`\nrlbyhand lint failed (${errors.length} issue${errors.length > 1 ? 's' : ''}):\n`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`rlbyhand lint passed (${tsFiles.length} TS/TSX files, ${mdxFiles.length} MDX chapters checked).`);
