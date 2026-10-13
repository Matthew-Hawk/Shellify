import {access} from 'node:fs/promises';
await Promise.all(['index.html','builder.html','styles.css','landing.css','js/appearance.js','js/landing.js','js/app.js','js/commands.js','js/generator.js','js/matcher.js','js/validation.js','js/workspace.js','js/projects.js','js/execution.js','js/library.js','js/runtime.js','js/templates.js','js/results.js','js/parameters.js','js/conditions.js','js/builder-controls.js'].map(f=>access('dist/'+f)));
console.log('Buildless static site ready in dist/');
