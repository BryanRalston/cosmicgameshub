import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

const postTmp = join(root, '.brix-post.js');
await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'src/post.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: postTmp,
  legalComments: 'none',
  plugins: [addonPlugin()]
});
const postCode = readFileSync(postTmp);
const postName = `brix3d-post.${createHash('sha256').update(postCode).digest('hex').slice(0, 10)}.js`;
writeFileSync(join(root, postName), postCode);
unlinkSync(postTmp);

const mainTmp = join(root, '.brix-main.js');
await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: mainTmp,
  legalComments: 'none',
  loader: { '.png': 'dataurl', '.jpg': 'dataurl' },
  define: { __BRIX_POST__: JSON.stringify(`/games/brix3d/${postName}`) },
  plugins: [addonPlugin()]
});
const mainCode = readFileSync(mainTmp);
const mainName = `brix3d.${createHash('sha256').update(mainCode).digest('hex').slice(0, 10)}.js`;
writeFileSync(join(root, mainName), mainCode);
unlinkSync(mainTmp);

const keep = new Set([postName, mainName]);
for (const file of readdirSync(root)) {
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
console.log('main', mainName, mainCode.length);
console.log('post', postName, postCode.length);
console.log('css', cssName, cssBuf.length);
if (mainCode.includes('SMAAPass')) throw new Error('SMAA still in main bundle');
if (!mainCode.includes(postName)) throw new Error('main bundle missing post url');
