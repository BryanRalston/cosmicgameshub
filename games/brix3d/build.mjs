import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitModule } from './split-module.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(root, '..', 'brix3d.html');
const livePath = join(root, 'src/three-live.js');

function addonPlugin() {
  return {
    name: 'three-addons',
    setup(build) {
      build.onResolve({ filter: /^three$/ }, () => ({ path: livePath }));
      build.onResolve({ filter: /^three\/addons\// }, (args) => ({
        path: join(root, 'node_modules/three/examples/jsm', args.path.slice('three/addons/'.length))
      }));
    }
  };
}

function hashName(prefix, code) {
  return prefix + createHash('sha256').update(code).digest('hex').slice(0, 8) + '.js';
}

async function minify(code) {
  const result = await esbuild.transform(code, {
    minify: true,
    target: 'es2022',
    loader: 'js',
    format: 'esm',
    legalComments: 'none'
  });
  return result.code;
}

async function emitParts(groups, opts) {
  const files = [];
  const extraFor = (body) => (opts.extra ? opts.extra(body) : '');
  const firstExtra = extraFor(groups[0]);
  let first = (firstExtra ? firstExtra + '\n' : '') + 'export const __brixScope = {};\n' + groups[0];
  if (groups.length === 1 && opts.footer) first += '\n' + opts.footer;
  const firstCode = await minify(first);
  const firstName = hashName(opts.prefix, firstCode);
  files.push({ name: firstName, code: firstCode });
  for (let i = 1; i < groups.length; i++) {
    const extra = extraFor(groups[i]);
    let body = `import { __brixScope } from './${firstName}';\n` + (extra ? extra + '\n' : '') + groups[i];
    if (i === groups.length - 1 && opts.footer) body += '\n' + opts.footer;
    const code = await minify(body);
    files.push({ name: hashName(opts.prefix, code), code });
  }
  return files;
}

const threeSource = readFileSync(join(root, 'node_modules/three/build/three.module.js'), 'utf8');
const threeSplit = splitModule(threeSource, { scopeName: '__brixScope', budget: 16000 });
const threeParts = await emitParts(threeSplit.groups, {
  prefix: 'brix3d-t',
  footer: 'globalThis.__BRIX_THREE = __brixScope;'
});

const liveLines = ['const __brixScope = globalThis.__BRIX_THREE;'];
const seenExport = new Set();
for (const item of threeSplit.exports) {
  if (seenExport.has(item.exported)) continue;
  seenExport.add(item.exported);
  liveLines.push(`export const ${item.exported} = __brixScope.${item.local};`);
}
writeFileSync(livePath, liveLines.join('\n') + '\n');

const outdir = join(root, '.brix-out');
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
let built;
try {
  built = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [
      join(root, 'src/boot.js'),
      livePath,
      join(root, 'src/orbit-entry.js')
    ],
    bundle: true,
    splitting: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    outdir,
    entryNames: 'brix3d.[hash]',
    chunkNames: 'brix3d-[hash]',
    metafile: true,
    legalComments: 'none',
    loader: { '.png': 'dataurl', '.jpg': 'dataurl' },
    plugins: [addonPlugin()]
  });
} finally {
  unlinkSync(livePath);
}

let mainName = '';
let postName = '';
let liveName = '';
let orbitName = '';
const written = [];
for (const [outfile, meta] of Object.entries(built.metafile.outputs)) {
  if (!outfile.endsWith('.js')) continue;
  const name = basename(outfile);
  copyFileSync(join(root, outfile), join(root, name));
  written.push(name);
  const entry = (meta.entryPoint || '').replace(/\\/g, '/');
  if (entry.endsWith('src/boot.js')) mainName = name;
  if (entry.endsWith('src/three-live.js')) liveName = name;
  if (entry.endsWith('src/orbit-entry.js')) orbitName = name;
  const inputs = Object.keys(meta.inputs || {}).map((p) => p.replace(/\\/g, '/'));
  if (inputs.some((p) => p.endsWith('src/post.js'))) postName = name;
}
if (!mainName) throw new Error('boot entry missing from esbuild metafile');
if (!postName) throw new Error('post chunk missing from esbuild metafile');
if (!liveName) throw new Error('three-live chunk missing from esbuild metafile');
if (!orbitName) throw new Error('OrbitControls chunk missing from esbuild metafile');
if (postName === mainName || liveName === mainName) {
  throw new Error('post or three-live was folded into the boot chunk');
}
rmSync(outdir, { recursive: true, force: true });

const mainSource = readFileSync(join(root, 'src/main.js'), 'utf8');
const mainSplit = splitModule(mainSource, {
  scopeName: '__brixScope',
  budget: 3500,
  // Top-level main.js assignments run at import time. Keep those groups
  // under one 50ms task on a 4x CPU throttle. Three's consts stay on the
  // larger budget; they are numbers and parse cheaply.
  eagerBudget: 3200,
  tailTest: (piece) => piece.includes('init().catch')
});
const mainParts = await emitParts(mainSplit.groups, {
  prefix: 'brix3d-m'
});

const partFiles = threeParts.concat(mainParts);
for (const file of partFiles) writeFileSync(join(root, file.name), file.code);

const keep = new Set(written.concat(partFiles.map((file) => file.name)));
for (const file of readdirSync(root)) {
  if (/^brix3d-post\.[0-9a-f]+\.js$/.test(file)) {
    unlinkSync(join(root, file));
    continue;
  }
  if (!/^brix3d[-.][A-Za-z0-9]+\.js$/.test(file)) continue;
  if (!keep.has(file)) unlinkSync(join(root, file));
}

let html = readFileSync(htmlPath, 'utf8');
const mountPath = join(root, 'brix-mount.js');
let mount = readFileSync(mountPath, 'utf8');
if (!mount.includes("s.src = '/games/brix3d/")) throw new Error('boot src missing');
mount = mount.replace(/s\.src = '\/games\/brix3d\/[^']+'/, `s.src = '/games/brix3d/${mainName}'`);
writeFileSync(mountPath, mount);
writeFileSync(join(root, 'brix-parts.json'), JSON.stringify({
  three: threeParts.map((file) => `/games/brix3d/${file.name}`),
  main: mainParts.map((file) => `/games/brix3d/${file.name}`),
  warm: [orbitName, liveName].map((name) => `/games/brix3d/${name}`)
}));
html = html.replace(/<!-- brix-preloads -->[\s\S]*?<!-- \/brix-preloads -->/, '<!-- brix-preloads -->\n  <!-- /brix-preloads -->');
const cssFiles = readdirSync(root).filter((f) => /^brix3d\.[0-9a-f]{10}\.css$/.test(f));
if (cssFiles.length !== 1) throw new Error('expected one hashed css, got ' + cssFiles.join(','));
const cssBuf = readFileSync(join(root, cssFiles[0]));
const cssName = `brix3d.${createHash('sha256').update(cssBuf).digest('hex').slice(0, 10)}.css`;
if (cssName !== cssFiles[0]) {
  writeFileSync(join(root, cssName), cssBuf);
  unlinkSync(join(root, cssFiles[0]));
}
const cssText = cssBuf.toString('utf8');
// Cut only after a top-level rule. A cut inside @media (max-width: 430px)
// copied the phone tray onto the desktop and pushed the name field off screen.
// Each part stays near 4.5KB. A 10KB sheet still simulated past 50ms on the
// cold first paint, and that task is the whole TBT miss.
function splitStylesheet(text, budget) {
  const parts = [];
  let depth = 0;
  let partStart = 0;
  let ruleStart = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth < 0) throw new Error('css brace underflow');
      if (depth === 0) {
        const end = i + 1;
        if (end - partStart > budget && ruleStart > partStart) {
          parts.push(text.slice(partStart, ruleStart));
          partStart = ruleStart;
        }
        ruleStart = end;
      }
    }
  }
  if (depth !== 0) throw new Error('css brace still open');
  const tail = text.slice(partStart);
  if (tail.trim()) parts.push(tail);
  return parts;
}
const cssParts = splitStylesheet(cssText, 4500);
const cssPartNames = cssParts.map((part, i) => {
  const name = `brix3d-s${String(i).padStart(2, '0')}.${createHash('sha256').update(part).digest('hex').slice(0, 10)}.css`;
  writeFileSync(join(root, name), part);
  return name;
});
for (const stale of readdirSync(root)) {
  if (/^brix3d-[a-h]\.[0-9a-f]{10}\.css$/.test(stale)) unlinkSync(join(root, stale));
  if (/^brix3d-s\d{2}\.[0-9a-f]{10}\.css$/.test(stale) && !cssPartNames.includes(stale)) unlinkSync(join(root, stale));
}
if (!/<!-- brix-sheets -->[\s\S]*?<!-- \/brix-sheets -->/.test(html)) throw new Error('sheet list missing');
const nl = html.includes('\r\n') ? '\r\n' : '\n';
const sheetTags = cssPartNames.map((name) => `  <link rel="preload" href="/games/brix3d/${name}" as="style" data-brix>`).join(nl);
html = html.replace(
  /<!-- brix-sheets -->[\s\S]*?<!-- \/brix-sheets -->/,
  '<!-- brix-sheets -->' + nl + sheetTags + nl + '  <!-- /brix-sheets -->'
);
writeFileSync(htmlPath, html);
console.log('css parts', cssPartNames.join(' '), cssParts.map((p) => p.length).join(' '));

const bootCode = readFileSync(join(root, mainName));
const postCode = readFileSync(join(root, postName));
const postMeta = built.metafile.outputs[Object.keys(built.metafile.outputs).find((p) => basename(p) === postName)];
const postImports = (postMeta.imports || []).map((item) => basename(item.path || ''));
const sharedThree = postCode.includes('__BRIX_THREE') || postImports.some((name) => {
  try {
    return readFileSync(join(root, name), 'utf8').includes('__BRIX_THREE');
  } catch {
    return false;
  }
});
if (!sharedThree) {
  throw new Error('post chunk does not use the shared three instance: ' + postImports.join(','));
}
if (postCode.includes('Multiple instances of Three')) {
  throw new Error('post chunk contains a second three.js copy');
}
const earlyNames = [mainName, liveName, orbitName].concat(partFiles.map((file) => file.name));
for (const name of earlyNames) {
  if (readFileSync(join(root, name)).includes('SMAAPass')) {
    throw new Error('SMAA still in ' + name);
  }
}
let warningFiles = 0;
for (const name of keep) {
  if (readFileSync(join(root, name)).includes('Multiple instances of Three')) warningFiles++;
}
if (warningFiles !== 1) throw new Error('expected the three warning in one chunk, found ' + warningFiles);

const biggest = partFiles.map((file) => file.code.length).sort((a, b) => b - a)[0];
console.log('boot', mainName, bootCode.length);
console.log('post', postName, postCode.length, 'live', liveName, 'orbit', orbitName);
console.log('parts', partFiles.length, 'biggest', biggest, 'css', cssName, cssBuf.length);
