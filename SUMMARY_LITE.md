PROJECT: GAS + Svelte 5 Build Template

STRUCTURE:
src/backend/     # JS files → Code.js
src/frontend/    # HTML + Svelte components

BACKEND (CRITICAL!):
❌ Do NOT use import/export between backend files.
✅ All .js files are concatenated into Code.js automatically.
✅ All functions become global.
✅ priorityOrder controls the sequence.
✅ NPM packages CAN be imported.

Example:
```js
// main.js
function doGet(e) {
  const date = formatDate(new Date()); // from utils.js
  return HtmlService.createHtmlOutputFromFile('index');
}

// utils.js
function formatDate(date) {
  return Utilities.formatDate(date, 'dd.MM.yyyy');
}
```

FRONTEND:
✅ Svelte 5: $state, $derived, $effect, $props.
✅ onclick={} instead of on:click={}.
✅ {@render children()} for slots.

HTML:
```html
<div id="app"></div>
<script type="module">
  import { mount } from 'svelte';
  import App from './components/App.svelte';
  mount(App, { target: document.getElementById('app') })
</script>
```

API CALLS:
```js
google.script.run
  .withSuccessHandler(result => {})
  .withFailureHandler(error => {})
  .serverFunction(args)
```

CONFIG:
```js
backendSettings: {
  outFile: 'Code.js',
  priorityOrder: ['main.js', 'utils.js'] // Others alphabetically
}
```

COMMANDS:
- npm run build: Build to dist/
- npm run push: Build + Push to GAS
- npm run deploy: Full release
