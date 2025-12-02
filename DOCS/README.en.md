# Template for Google Apps Script + Svelte 5 Projects

This is a template repository for creating modern web applications and libraries on the **Google Apps Script (GAS)** platform using **Svelte 5**.

It includes a powerful build system that allows you to use modern JavaScript (including NPM packages) on the backend and Svelte 5 on the frontend, automatically resolving all dependencies and preparing the code for upload to the GAS environment.

## 🌟 Key Features

-   **Advanced Build System:** The `build.js` script automates the entire process, from Svelte compilation to backend assembly.
-   **NPM Support in GAS:** Use `import` to include NPM packages directly in your `.js` file for the backend. The builder will automatically embed them into the code.
-   **Structure Preservation and Conflict Resolution:** The builder correctly handles nested folders and automatically renames files with the same name from different sources.
-   **Modern Frontend:** Full support for **Svelte 5** (runes `$state`, `$effect`, etc.) and fast builds with **Vite**.
-   **Flexible Configuration:** Manage the entire process through a single `build.config.json` file.
-   **Ready-made Documentation Templates:** The `DOCS/` folder contains ready-to-use `README.md` files for your future project.

## 🚀 How to Use This Template

1.  **Create a repository:** Click the **"Use this template"** button at the top of this page to create a new repository from this template.
2.  **Clone the repository:**
    ```bash
    git clone https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Configure the GAS project:**
    -   Create a new project in [Google Apps Script](https://script.google.com).
    -   Copy its **Script ID** from the project settings (`Project Settings -> IDs -> Script ID`).
    -   Paste this ID into the `build.config.json` file in the `clasp.scriptId` field.

## 🛠️ Development and Build Process

### Configuration (`build.config.json`)

This is the main file for managing the build. In it, you specify the paths to the sources, enable or disable the frontend/backend build, and configure concatenation and minification.

> A full description of all options can be found in the file **`DOCS/CONFIG.en.md`**.

### Project Structure

-   `src/frontend/`: Source files for the frontend (HTML, Svelte components).
-   `src/backend/`: Source files for the backend (server-side `.js` code).
-   `src/appsscript.json`: The GAS project manifest.
-   `dist/`: The folder where the build result is placed. **Contents are generated automatically.**
-   `build.js`: The build script.
-   `build.config.json`: The build configuration.

### Main Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts a local server for frontend development with auto-refresh. |
| `npm run build` | Performs a full project build into the `dist` folder. |
| `npm run push` | Builds the project and uploads it to Google Apps Script (in development mode). |
| `npm run deploy` | Full release cycle: build, upload, and create a new deployment version. |

## ✍️ Documentation for Your Project

This `README.md` that you are currently reading is the documentation for the **template** itself. For your project, it is recommended to use one of the ready-made templates located in the `DOCS/` folder.

-   **Web application?** Use `DOCS/README_WEB_APP.en.md`.
-   **Library?** Use `DOCS/README_LIBRARY.en.md`.

Just copy the contents of the appropriate file into the root `README.md` of your project and fill it out according to your needs.

## 🧠 For Neural Networks (LLMs)

The `LLM/` folder contains the files `SUMMARY.xml` and `Svelte.md`. They contain detailed context about the project's architecture, coding rules, and Svelte 5 features. These files can be provided to large language models (like Gemini, GPT) so they can understand the code faster and more accurately and assist in development.