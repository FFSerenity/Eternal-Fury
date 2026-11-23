// after a build: point index.html at game.js?v=<content hash>, so browsers fetch a new build instead of a cached one
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
const h = createHash('md5').update(readFileSync('game.js')).digest('hex').slice(0, 10);
const html = readFileSync('index.html', 'utf8'), out = html.replace(/<script src="game\.js(\?v=[0-9a-f]+)?"><\/script>/, `<script src="game.js?v=${h}"></script>`);
if (out === html && !html.includes(`game.js?v=${h}`)) throw new Error('script tag for game.js not found in index.html');
writeFileSync('index.html', out);
