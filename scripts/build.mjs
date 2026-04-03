import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = resolve(rootDir, 'dist');
const srcDir = resolve(rootDir, 'src');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
mkdirSync(resolve(distDir, 'background'), { recursive: true });
mkdirSync(resolve(distDir, 'content'), { recursive: true });
mkdirSync(resolve(distDir, 'popup'), { recursive: true });
mkdirSync(resolve(distDir, 'options'), { recursive: true });

await build({
  entryPoints: [
    resolve(srcDir, 'background/index.ts'),
    resolve(srcDir, 'content/watch-video.ts'),
    resolve(srcDir, 'content/claim-vip.ts'),
    resolve(srcDir, 'popup/popup.ts'),
    resolve(srcDir, 'options/options.ts')
  ],
  outdir: distDir,
  outbase: srcDir,
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  sourcemap: false,
  logLevel: 'info'
});

cpSync(resolve(srcDir, 'manifest.json'), resolve(distDir, 'manifest.json'));
cpSync(resolve(srcDir, 'popup/popup.html'), resolve(distDir, 'popup/popup.html'));
cpSync(resolve(srcDir, 'popup/popup.css'), resolve(distDir, 'popup/popup.css'));
cpSync(resolve(srcDir, 'options/options.html'), resolve(distDir, 'options/options.html'));
cpSync(resolve(srcDir, 'options/options.css'), resolve(distDir, 'options/options.css'));
