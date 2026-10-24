import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const tmp = join(root, '.brix3d.build.js');

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: tmp,
  legalComments: 'none',
  loader: { '.png': 'dataurl', '.jpg': 'dataurl' },
  plugins: [{
    name: 'three-addons',
    setup(build) {
      build.onResolve({ filter: /^three\/addons\// }, (args) => ({
        path: join(root, 'node_modules/three/examples/jsm', args.path.slice('three/addons/'.length))
      }));
    }
  }]
});

const code = readFileSync(tmp);
const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
const name = `brix3d.${hash}.js`;
writeFileSync(join(root, name), code);
unlinkSync(tmp);

for (const file of readdirSync(root)) {
  if (/^brix3d\.[0-9a-f]{10}\.js$/.test(file) && file !== name) unlinkSync(join(root, file));
}

const htmlPath = join(root, '..', 'brix3d.html');
let html = readFileSync(htmlPath, 'utf8');
const src = `/games/brix3d/${name}`;
if (html.includes('/games/brix3d/brix3d.')) {
  html = html.replace(/\/games\/brix3d\/brix3d\.[0-9a-f]{10}\.js/g, src);
  writeFileSync(htmlPath, html);
  console.log('html src', src);
} else {
  console.log('bundle only', src);
}
console.log('bytes', code.length);
