# Build Configuration (`build.config.json`)

This file configures the build process managed by `build.js`. The build script can be run with a custom config file using the `--config` flag: `node build.js --config=my.build.json`.

---

## Top-Level Options

### `outDir`
-   **Type:** `String`
-   **Description:** The path to the output directory for all built files. This is typically `"dist"`.
-   **Example:** `"outDir": "dist"`

### `manifest`
-   **Type:** `String`
-   **Description:** The path to the Google Apps Script manifest file (`appsscript.json`). This file will be copied to the root of the `outDir`.
-   **Example:** `"manifest": "src/appsscript.json"`

### `package`
-   **Type:** `String`
-   **Description:** The path to the `package.json` file. Used to generate a version banner in concatenated backend files.
-   **Example:** `"package": "package.json"`

### `message`
-   **Type:** `String` (optional)
-   **Description:** A template for the message to be displayed after a successful `push` or `deploy`. If omitted, default links to the web app deployments will be shown.
-   **Variables:**
    -   `{dev_id}`: Will be replaced with the `@HEAD` deployment ID.
    -   `{prod_id}`: Will be replaced with the latest versioned (`@version`) deployment ID.
-   **Example:** `"message": "New version pushed.
DEV: https://script.google.com/macros/s/{dev_id}/dev
PROD: https://script.google.com/macros/s/{prod_id}/exec"`

---

## `clasp`
-   **Type:** `Object` (optional)
-   **Description:** If this object is present, a `.clasp.json` file will be generated in the `outDir`, and all `clasp` commands (`push`, `deploy`, etc.) will run from there. This allows for project-specific `clasp` configurations without having a `.clasp.json` file in your project's root directory. The contents of this object are written directly to the generated `.clasp.json` file.
-   **Example:**
    ```json
    "clasp": {
      "scriptId": "YOUR_SCRIPT_ID_HERE",
      "rootDir": "."
    }
    ```

---

## `frontend`
-   **Type:** `Object`
-   **Description:** Configuration for the frontend (HTML, Svelte, CSS, etc.) build process.

### `frontend.build`
-   **Type:** `Boolean`
-   **Description:** Set to `true` to enable the frontend build.
-   **Example:** `"build": true`

### `frontend.src`
-   **Type:** `String`
-   **Description:** The path to the source directory for frontend files. All other paths within the `frontend` configuration are relative to this directory. The `src` path itself is relative to the location of the `build.config.json` file.
-   **Example:** `"src": "src/frontend"`

### `frontend.minify`
-   **Type:** `Boolean`
-   **Description:** Set to `true` to minify the final HTML, JS, and CSS output.
-   **Example:** `"minify": true`

### `frontend.include`
-   **Type:** `Array<String>` (optional)
-   **Description:** An array of additional files or directories to include in the frontend build. This is additive; all `.html` files within `frontend.src` are already included by default. Paths are relative to `frontend.src`.
-   **Order of Processing:**
    1.  All `.html` files found by recursively scanning `frontend.src` are collected first.
    2.  Then, files (or files found within included directories) specified in `frontend.include` are added.
    3.  If a name conflict occurs for output files, later added files receive a numeric suffix (e.g., `file_1.html`).
-   **Path Rules:**
    -   **Internal paths:** Files or folders inside `frontend.src` (e.g., `"components/Login.html"`).
    -   **External paths:** Files or folders outside `frontend.src` using `../` (e.g., `"../common/header.html"`).
-   **Output Rules:**
    -   **Internal files:** Files originating from `frontend.src` maintain their structure relative to `frontend.src` (e.g., `src/frontend/pages/About.html` becomes `dist/pages/About.html`).
    -   **External single files:** Files specified directly (e.g., `"../common/header.html"`) are placed in the root of `outDir` (resulting in `dist/header.html`). The entire path up to the filename is stripped.
    -   **External directories:** For directories (e.g., `"../libs/ui-components/"`), their *internal* structure is preserved relative to the `outDir`. For a file like `../libs/ui-components/button.html`, the output would be `dist/button.html`. The path corresponding to the included directory itself (`../libs/ui-components/`) is removed from the output path.
-   **Example:**
    ```json
    "include": [
      "dialogs/About.html",
      "../libs/ui-components/"
    ]
    ```

---

## `backend`
-   **Type:** `Object`
-   **Description:** Configuration for the backend (`.js`, `.gs`) build process.

### `backend.build`
-   **Type:** `Boolean`
-   **Description:** Set to `true` to enable the backend build.
-   **Example:** `"build": true`

### `backend.src`
-   **Type:** `String`
-   **Description:** The path to the source directory for backend files. All other paths within the `backend` configuration are relative to this directory. The `src` path itself is relative to the location of the `build.config.json` file.
-   **Example:** `"src": "src/backend"`

### `backend.minify`
-   **Type:** `Boolean`
-   **Description:** Set to `true` to minify the backend code.
-   **Example:** `"minify": true`

### `backend.concatenate`
-   **Type:** `Boolean`
-   -**Description:** If `true`, all backend files will be combined into a single file specified by `outFile`. If `false`, files will be processed individually and maintain their calculated output path structure in `outDir`.
-   **Example:** `"concatenate": true`

### `backend.outFile`
-   **Type:** `String`
-   **Description:** The name of the output file when `concatenate` is `true`.
-   **Example:** `"outFile": "Code.js"`

### `backend.include`
-   **Type:** `Array<String>` (optional)
-   **Description:** An array of additional files or directories to include in the backend build. It works identically to `frontend.include`, but for `.js` and `.gs` files. Paths are relative to `backend.src`. If `concatenate` is `false` and a name conflict occurs for an output file, a numeric suffix will be added to the conflicting file's name (e.g., `utils_1.js`).
-   **Example:**
    ```json
    "include": [
      "utils/api.js",
      "../shared-libs/"
    ]
    ```

### `backend.priorityOrder`
-   **Type:** `Array<String>` (optional)
-   **Description:** **This option is only active when `concatenate` is `true`.** It defines the exact order for files at the beginning of the concatenated output file. All files listed here will automatically be included in the build. Paths are relative to `backend.src`.
-   **Order of Concatenation (when `concatenate: true`):**
    1.  Files specified in `backend.priorityOrder` are placed first, in the exact order they appear in the array.
    2.  Then, all other `.js` and `.gs` files found by recursively scanning `backend.src` (that were not already included by `priorityOrder`) are added, sorted alphabetically by their path relative to `backend.src`.
    3.  Finally, any remaining `.js` and `.gs` files (or files found within included directories) specified in `backend.include` (that were not already included by `priorityOrder` or `backend.src`) are added, sorted alphabetically by their path relative to `backend.src`.
-   **Example:**
    ```json
    "priorityOrder": [
      "../libs/Polyfill.js",
      "main.js"
    ]
    ```
