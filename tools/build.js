import {access} from 'node:fs/promises';
await Promise.all(['index.html','styles.css','js/app.js','js/commands.js','js/generator.js','js/matcher.js','js/validation.js'].map(f=>access('dist/'+f)));
console.log('Buildless static site ready in dist/');
