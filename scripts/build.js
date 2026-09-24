import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
cpSync('index.html', 'dist/index.html');
cpSync('src', 'dist/src', { recursive: true });
cpSync('public', 'dist/public', { recursive: true });
// Prevent GitHub Pages/Jekyll from transforming or excluding static assets.
writeFileSync('dist/.nojekyll', '');
console.log('Built Veilfall into dist/');
