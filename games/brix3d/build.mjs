import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(root, '..', 'brix3d.html');

function addonPlugin() {
  return {
    name: 'three-addons',
    setup(build) {
      build.onResolve({ filter: /^three\/addons\// }, (args) => ({
        path: join(root, 'node_modules/three/examples/jsm', args.path.slice('three/addons/'.length))
      }));
    }
  };
}

const outdir = join(root, '.brix-out');
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
const built = await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'src/boot.js')],
  bundle: true,
  splitting: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outdir,
  entryNames: 'brix3d.[hash]',
  chunkNames: 'brix3d-[hash]',
  metafile: true,
  legalComments: 'none',
  loader: { '.png': 'dataurl', '.jpg': 'dataurl' },
  plugins: [addonPlugin()]
});

let mainName = '';
let postName = '';
let threeName = '';
const written = [];
for (const [outfile, meta] of Object.entries(built.metafile.outputs)) {
  if (!outfile.endsWith('.js')) continue;
  const name = basename(outfile);
  copyFileSync(join(root, outfile), join(root, name));
  written.push(name);
  const entry = (meta.entryPoint || '').replace(/\\/g, '/');
  if (entry.endsWith('src/boot.js')) mainName = name;
  const inputs = Object.keys(meta.inputs || {}).map((p) => p.replace(/\\/g, '/'));
  if (inputs.some((p) => p.endsWith('src/post.js'))) postName = name;
  if (inputs.some((p) => /node_modules\/three\/build\/three/.test(p))) threeName = name;
}
if (!mainName) throw new Error('boot entry missing from esbuild metafile');
if (!postName) throw new Error('post chunk missing from esbuild metafile');
if (!threeName) throw new Error('three chunk missing from esbuild metafile');
if (postName === mainName || postName === threeName) {
  throw new Error('post chunk was folded into the boot or three graph');
}
const postMeta = built.metafile.outputs[Object.keys(built.metafile.outputs).find((p) => basename(p) === postName)];
const postImports = (postMeta.imports || []).map((item) => basename(item.path || ''));
if (!postImports.includes(threeName)) {
  throw new Error('post chunk does not import the shared three chunk: ' + postImports.join(','));
}
rmSync(outdir, { recursive: true, force: true });

const keep = new Set(written);
for (const file of readdirSync(root)) {
  if (/^brix3d-post\.[0-9a-f]+\.js$/.test(file)) {
    unlinkSync(join(root, file));
    continue;
  }
  if (!/^brix3d[-.][A-Za-z0-9]+\.js$/.test(file)) continue;
  if (!keep.has(file)) unlinkSync(join(root, file));
}

let html = readFileSync(htmlPath, 'utf8');
html = html.replace(/\/games\/brix3d\/brix3d[-.][A-Za-z0-9]+\.js/g, `/games/brix3d/${mainName}`);
const cssFiles = readdirSync(root).filter((f) => /^brix3d\.[0-9a-f]{10}\.css$/.test(f));
if (cssFiles.length !== 1) throw new Error('expected one hashed css, got ' + cssFiles.join(','));
const cssBuf = readFileSync(join(root, cssFiles[0]));
const cssName = `brix3d.${createHash('sha256').update(cssBuf).digest('hex').slice(0, 10)}.css`;
if (cssName !== cssFiles[0]) {
  writeFileSync(join(root, cssName), cssBuf);
  unlinkSync(join(root, cssFiles[0]));
  html = html.split(`/games/brix3d/${cssFiles[0]}`).join(`/games/brix3d/${cssName}`);
}
writeFileSync(htmlPath, html);
rmSync(join(root, '.brix-out'), { recursive: true, force: true });

const bootCode = readFileSync(join(root, mainName));
const gameNames = written.filter((name) => name !== mainName && name !== postName && name !== threeName);
const earlyCode = Buffer.concat([bootCode, readFileSync(join(root, threeName)), ...gameNames.map((name) => readFileSync(join(root, name)))]);
if (earlyCode.includes('SMAAPass')) throw new Error('SMAA still in the boot, three, or game chunk');
const postCode = readFileSync(join(root, postName));
if (!postCode.includes(threeName.replace('.js', ''))) {
  throw new Error('post chunk text does not reference the shared three file');
}
let warningFiles = 0;
for (const name of written) {
  const code = readFileSync(join(root, name));
  if (code.includes('Multiple instances of Three')) warningFiles++;
}
if (warningFiles !== 1) throw new Error('expected the three warning in one chunk, found ' + warningFiles);

console.log('main', mainName, written.map((name) => name + ' ' + readFileSync(join(root, name)).length).join(', '));
console.log('post', postName, postCode.length, 'imports', threeName);
console.log('css', cssName, cssBuf.length);
