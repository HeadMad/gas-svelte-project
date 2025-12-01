import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { build as esbuild } from 'esbuild';
import { minify } from 'terser';
import { build as viteBuild, createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { minify as minifyHtml } from 'html-minifier-terser';

const args = process.argv.slice(2);
const configArg = args.find(arg => arg.startsWith('--config='));
const CONFIG_PATH = configArg ? configArg.split('=')[1] : './build.config.json';
const configDir = path.dirname(path.resolve(CONFIG_PATH));

const IS_DEV = args.includes('--dev');
const IS_PUSH = args.includes('--push') || args.includes('--deploy');
const IS_DEPLOY = args.includes('--deploy');

let CONFIG; // Will be loaded in run()
const SVELTE_CONFIG = {
  compilerOptions: { experimental: { async: true } }
}

// ==========================================
// 1. CONFIG & UTILS
// ==========================================

async function fileExists(filePath) {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig() {
  if (!await fileExists(CONFIG_PATH)) {
    logger.error(`Config file not found at ${CONFIG_PATH}`);
    process.exit(1);
  }
  const content = await fsPromises.readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(content);
}

async function saveConfig(newConfig) {
  await fsPromises.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  CONFIG = newConfig;
}

async function updateDeploymentId(key, value) {
  const cfg = await loadConfig();
  if (!cfg.deployment) cfg.deployment = {};
  cfg.deployment[key] = value;
  await saveConfig(cfg);
}

const logger = {
  info: (msg) => console.log(`🔹 ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  link: (label, url) => console.log(`🔗 \x1b[36m${label}:\x1b[0m \x1b[4m${url}\x1b[0m`),
};

// ==========================================
// 2. CLASP COMMANDS
// ==========================================

async function createClaspJson() {
  if (CONFIG.clasp && Object.keys(CONFIG.clasp).length > 0) {
    const outDir = path.resolve(configDir, CONFIG.outDir);
    const claspJsonPath = path.join(outDir, '.clasp.json');
    // Ensure the output directory exists
    if (!fs.existsSync(outDir)) {
      await fsPromises.mkdir(outDir, { recursive: true });
    }
    await fsPromises.writeFile(claspJsonPath, JSON.stringify(CONFIG.clasp, null, 2));
    logger.success(`Generated .clasp.json in ${outDir}`);
  }
}

/**
 * Determines the working directory for `clasp` commands.
 * @returns {string} The CWD for clasp commands.
 */
async function getClaspCwd() {
  if (CONFIG.clasp && Object.keys(CONFIG.clasp).length > 0) {
    const outDir = path.resolve(configDir, CONFIG.outDir);
    if (CONFIG.clasp.scriptId) {
      logger.info(`Using scriptId: ${CONFIG.clasp.scriptId}. Running clasp in ${outDir}`);
    }
    return outDir;
  }
  return process.cwd();
}

function runCommand(command, cwd) {
  try {
    return execSync(command, { stdio: 'pipe', encoding: 'utf-8', cwd: cwd || process.cwd() });
  } catch (e) {
    logger.error(`Command failed: ${command} in ${cwd}`);
    logger.error(e.stderr || e.message);
    process.exit(1);
  }
}

async function getDevDeploymentId() {
  if (CONFIG.deployment?.devDeploymentId) return CONFIG.deployment.devDeploymentId;
  const claspCwd = await getClaspCwd();

  logger.info('Fetching Dev Deployment ID (@HEAD)...');
  try {
    const output = runCommand('npx clasp deployments', claspCwd);
    const match = output.match(/- ([a-zA-Z0-9_-]+)\s+@HEAD/);
    if (match && match[1]) {
      await updateDeploymentId('devDeploymentId', match[1]);
      return match[1];
    }
    return null;
  } catch (e) { return null; }
}

async function claspPush() {
  const claspCwd = await getClaspCwd();
  logger.info('Clasp Push...');
  runCommand('npx clasp push --force', claspCwd);
  logger.success('Pushed.');
}

async function claspDeploy() {
  const claspCwd = await getClaspCwd();
  logger.info('Clasp Deploy...');
  const output = runCommand('npx clasp deploy', claspCwd);
  logger.success('Deployed.');

  const idMatch = output.match(/Deployed\s+([a-zA-Z0-9_-]+)\s+@\d+/);
  if (idMatch && idMatch[1]) {
    await updateDeploymentId('prodDeploymentId', idMatch[1]);
    return idMatch[1];
  }
  return null;
}

// ==========================================
// 3. FILE SYSTEM HELPERS
// ==========================================

async function cleanDist() {
  const outDir = path.resolve(configDir, CONFIG.outDir);
  if (await fileExists(outDir)) {
    await fsPromises.rm(outDir, { recursive: true, force: true });
  }
  await fsPromises.mkdir(outDir, { recursive: true });
}

async function copyManifest() {
  const manifestPath = path.resolve(configDir, CONFIG.manifest);
  if (await fileExists(manifestPath)) {
    await fsPromises.copyFile(manifestPath, path.join(path.resolve(configDir, CONFIG.outDir), 'appsscript.json'));
    logger.success('Manifest copied.');
  } else {
    logger.warn(`Manifest not found at ${manifestPath}`);
  }
}

async function getBanner() {
  try {
    const pkgPath = path.resolve(configDir, CONFIG.package);
    if (!await fileExists(pkgPath)) return '';
    const pkg = JSON.parse(await fsPromises.readFile(pkgPath, 'utf-8'));
    return `/**\n * ${pkg.name || 'App'} v${pkg.version || '0.0.0'}\n */\n`;
  } catch (error) { return ''; }
}

/**
 * Recursively finds all HTML files in a directory.
 * @param {string} dir The directory to scan.
 * @returns {string[]} An array of full file paths.
 */
function getAllHtmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      results = results.concat(getAllHtmlFiles(filePath));
    } else if (file.endsWith('.html')) {
      results.push(filePath);
    }
  });
  return results;
}

/**
 * Recursively finds all .js and .gs files in a directory.
 * @param {string} dir The directory to scan.
 * @returns {string[]} An array of full file paths.
 */
function getAllJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.gs')) {
      results.push(fullPath);
    }
  });
  return results;
}


/**
 * Collects files from a source directory and include paths.
 * @param {string} srcDir - The base source directory.
 * @param {string[]} includePaths - An array of additional files/directories to include.
 * @param {(dir: string) => string[]} fileScanner - A function that returns file paths from a directory.
 * @returns {Map<string, {type: 'internal' | 'external_dir' | 'external_file', rawPath?: string}>} A map of full file paths to their metadata.
 */
function collectFiles(srcDir, includePaths = [], fileScanner) {
  const filesToProcess = new Map();

  const addFile = (fullPath, data) => {
    // Use fs.existsSync because this function is synchronous
    if (fs.existsSync(fullPath)) {
      filesToProcess.set(path.resolve(fullPath), data);
    } else {
      logger.warn(`File not found: ${fullPath}`);
    }
  };

  // 1. Scan base src directory
  logger.info(`Scanning for files in ${srcDir}...`);
  fileScanner(srcDir).forEach(p => addFile(p, { type: 'internal' }));

  // 2. Process 'include' array
  (includePaths || []).forEach(item => {
    const fullPath = path.resolve(srcDir, item);
    if (!fs.existsSync(fullPath)) {
      logger.warn(`Path not found in include: ${item}`);
      return;
    }
    if (fs.statSync(fullPath).isDirectory()) {
      logger.info(`-> Scanning included directory: ${item}`);
      fileScanner(fullPath).forEach(p => addFile(p, { type: 'external_dir', rawPath: item }));
    } else {
      logger.info(`-> Including file: ${item}`);
      addFile(fullPath, { type: 'external_file', rawPath: item });
    }
  });

  return filesToProcess;
}

// ==========================================
// 4. JS PROCESSING (IMPORTS & MINIFY)
// ==========================================

async function bundleImport(importPath, exportNames, isDefault, workingDir) {
  let entryContent = isDefault ? `export { default as default } from '${importPath}';` : `export { ${exportNames} } from '${importPath}';`;
  try {
    const result = await esbuild({ stdin: { contents: entryContent, resolveDir: path.resolve(workingDir), loader: 'js', sourcefile: 'virtual-entry.js' }, bundle: true, minify: true, format: 'esm', target: 'es2020', write: false });
    let code = result.outputFiles[0].text.trim();
    while (code.endsWith(';') || code.endsWith('\n')) code = code.slice(0, -1);
    const lastExportIndex = code.lastIndexOf('export');
    if (lastExportIndex === -1) return `(() => { ${code}; return {}; })()`;
    const body = code.slice(0, lastExportIndex);
    let exportStatement = code.slice(lastExportIndex);
    let returnObj = '';
    if (exportStatement.includes('default') && !exportStatement.includes('{')) {
      returnObj = `{ default: ${exportStatement.replace(/export\s+default\s+/, '').trim()} }`;
    } else {
      const content = exportStatement.replace(/^export\s*\{/, '').replace(/\}\s*$/, '').trim();
      const parts = content.split(',');
      const props = parts.map(p => p.includes(' as ') ? `${p.split(' as ')[1].trim()}: ${p.split(' as ')[0].trim()}` : `${p.trim()}: ${p.trim()}`);
      returnObj = `{ ${props.join(', ')} }`;
    }
    return `(() => { ${body}${body.trim().endsWith(';') ? '' : ';'} return ${returnObj}; })()`;
  } catch (e) { throw e; }
}

async function processFileImports(filePath) {
  let code = await fsPromises.readFile(filePath, 'utf-8');
  const fileDir = path.dirname(filePath);
  const matches = [...code.matchAll(/import\s+(?:(\w+)|(?:\{([^}]+)\}))\s+from\s+['"]([^'"]+)['"];?/g)];
  for (const match of matches.reverse()) {
    const [full, def, named, pathUrl] = match;
    let replacement = '';
    if (def) replacement = `const ${def} = (function(r){ return r.default || r; })(${await bundleImport(pathUrl, null, true, fileDir)});`;
    else if (named) replacement = `const { ${named} } = ${await bundleImport(pathUrl, named, false, fileDir)};`;
    code = code.substring(0, match.index) + replacement + code.substring(match.index + full.length);
  }
  return code;
}

function extractGlobalNames(code) {
  const fns = [...code.matchAll(/^function\s+([a-zA-Z0-9_$]+)/gm)].map(m => m[1]);
  const vars = [...code.matchAll(/^var\s+([a-zA-Z0-9_$]+)/gm)].map(m => m[1]);
  return [...new Set([...fns, ...vars])];
}

async function minifyCode(content) {
  try {
    const globalNames = extractGlobalNames(content);
    const result = await minify(content, {
      ecma: 2020, parse: { html5_comments: false },
      mangle: { reserved: globalNames, toplevel: true },
      compress: { dead_code: true, drop_console: false, passes: 2 },
      format: { comments: false, ascii_only: false, ecma: 2020 },
    });
    return result.code || content;
  } catch (e) {
    logger.error('JS Minify Error');
    console.error(e);
    return content;
  }
}


/**
 * Calculates the final output paths for a list of files, handling name collisions.
 * @param {Map<string, {type: string, rawPath?: string}>} filesToProcess - The map from `collectFiles`.
 * @param {string} srcDir - The base source directory.
 * @returns {Array<{fullPath: string, relPath: string}>} A list of file objects with their final relative paths.
 */
function generateOutputPaths(filesToProcess, srcDir) {
  const outputFiles = [];
  const usedRelPaths = new Set();
  const allFiles = [...filesToProcess.keys()].sort(); // Sort for consistent processing order

  for (const fullPath of allFiles) {
    const data = filesToProcess.get(fullPath);
    let relPath;

    if (data.type === 'internal') {
      relPath = path.relative(srcDir, fullPath);
    } else if (data.type === 'external_dir') {
      const includeDir = path.resolve(srcDir, data.rawPath);
      relPath = path.relative(includeDir, fullPath);
    } else { // external_file or priority file
      relPath = path.basename(fullPath);
    }

    // Handle name conflicts
    let finalRelPath = relPath;
    let counter = 1;
    const ext = path.extname(finalRelPath);
    const base = finalRelPath.substring(0, finalRelPath.length - ext.length);
    while (usedRelPaths.has(finalRelPath)) {
      finalRelPath = `${base}_${counter}${ext}`;
      counter++;
    }
    usedRelPaths.add(finalRelPath);
    
    outputFiles.push({ fullPath, relPath: finalRelPath });
  }
  return outputFiles;
}

// ==========================================
// 5. FRONTEND BUILD
// ==========================================

function htmlMinifierPlugin(enabled) {
  if (!enabled) return null;
  return {
    name: 'html-minifier',
    enforce: 'post',
    async generateBundle(options, bundle) {
      for (const fileName in bundle) {
        const file = bundle[fileName];
        if (fileName.endsWith('.html') && file.type === 'asset') {
          try {
            file.source = await minifyHtml(file.source.toString(), {
              collapseWhitespace: true, removeComments: true, removeRedundantAttributes: true,
              removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true, useShortDoctype: true,
              minifyCSS: true, minifyJS: true, keepClosingSlash: false, removeAttributeQuotes: false
            });
          } catch (e) { logger.warn(`HTML Minify Error: ${fileName}`); }
        }
      }
    }
  };
}

async function buildFrontend() {
  if (!CONFIG.frontend.build) return;

  logger.info('Building Frontend...');
  const srcDir = path.resolve(configDir, CONFIG.frontend.src);
  const outDir = path.resolve(configDir, CONFIG.outDir);
  
  const filesToProcess = collectFiles(srcDir, CONFIG.frontend.include, getAllHtmlFiles);
  if (filesToProcess.size === 0) {
    logger.warn('No HTML files found to build.');
    return;
  }
  const allFilesForBuild = generateOutputPaths(filesToProcess, srcDir);

  const shouldMinify = CONFIG.frontend.minify;
  const plugins = [
    svelte(SVELTE_CONFIG),
    viteSingleFile({ removeViteModuleLoader: true })
  ];
  if (shouldMinify) plugins.push(htmlMinifierPlugin(true));

  const viteBaseConfig = {
    configFile: false,
    plugins: plugins,
    build: {
      // outDir will be set per-file
      emptyOutDir: false,
      minify: shouldMinify ? 'terser' : false,
      modulePreload: false,
      terserOptions: shouldMinify ? { ecma: 2020, compress: { drop_console: false, passes: 2 }, format: { comments: false } } : undefined,
    }
  };

  for (const pFile of allFilesForBuild) {
    const root = filesToProcess.get(pFile.fullPath).type === 'internal' ? srcDir : path.dirname(pFile.fullPath);
    const entryName = path.basename(pFile.fullPath, '.html');
    let tempDir = '';

    try {
      // 1. Create a unique temporary directory for this build
      tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'gas-build-'));

      logger.info(`-> Building: ${pFile.relPath}`);
      
      // 2. Build the file into the temporary directory
      await viteBuild({
        ...viteBaseConfig,
        root: root,
        build: {
          ...viteBaseConfig.build,
          outDir: tempDir,
          rollupOptions: {
            input: {
              [entryName]: pFile.fullPath,
            },
            output: {
              entryFileNames: `[name].js`,
              assetFileNames: `[name].[ext]`
            }
          }
        }
      });
      
      // 3. Move the built file from temp to its correct final destination
      const viteOutputFile = path.join(tempDir, `${entryName}.html`);
      const finalDestPath = path.join(outDir, pFile.relPath);

      if (fs.existsSync(viteOutputFile)) {
        await fsPromises.mkdir(path.dirname(finalDestPath), { recursive: true });
        // Use copyFile instead of rename to handle cross-device moves
        await fsPromises.copyFile(viteOutputFile, finalDestPath);
      } else {
        logger.warn(`Could not find built file for ${pFile.relPath}`);
      }

    } catch (e) {
      logger.error(`Error building file: ${pFile.relPath}`);
      console.error(e);
      process.exit(1);
    } finally {
      // 4. Clean up the temporary directory
      if (tempDir && fs.existsSync(tempDir)) {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      }
    }
  }

  logger.success(`Frontend built (${allFilesForBuild.length} files)`);
}

async function startDevServer() {
  logger.info('🚀 Starting Vite Dev Server...');
  const server = await createServer({
    root: path.resolve(process.cwd(), CONFIG.frontend.src),
    configFile: false,
    plugins: [svelte(SVELTE_CONFIG)],
    server: { port: 3000, open: true, cors: true }
  });
  await server.listen();
  server.printUrls();
}

// ==========================================
// 6. BACKEND BUILD
// ==========================================

function sortFiles(files, srcDir, priorityList) {
  const normalizedPriority = priorityList.map(p => path.normalize(p));
  return [...files].sort((a, b) => {
    const relA = path.relative(srcDir, a);
    const relB = path.relative(srcDir, b);
    const indexA = normalizedPriority.indexOf(relA);
    const indexB = normalizedPriority.indexOf(relB);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return relA.localeCompare(relB);
  });
}

async function getSortedBackendFiles() {
  const srcDir = path.resolve(configDir, CONFIG.backend.src);
  const includePaths = CONFIG.backend.include || [];
  const priorityOrder = CONFIG.backend.priorityOrder || [];

  // 1. Collect all files and categorize them
  const filesToProcess = collectFiles(srcDir, includePaths, getAllJsFiles);
  const priorityFullPathSet = new Set(priorityOrder.map(p => path.resolve(srcDir, p)));

  const priorityFiles = priorityOrder.map(p => path.resolve(srcDir, p)).filter(p => filesToProcess.has(p));
  const srcOnlyFiles = [];
  const includeOnlyFiles = [];

  for (const [fullPath, data] of filesToProcess.entries()) {
    if (priorityFullPathSet.has(fullPath)) continue; // Skip priority files, they are handled separately

    if (data.type === 'internal') {
      srcOnlyFiles.push(fullPath);
    } else {
      includeOnlyFiles.push(fullPath);
    }
  }

  // 2. Sort files alphabetically within their categories
  srcOnlyFiles.sort((a, b) => a.localeCompare(b));
  includeOnlyFiles.sort((a, b) => a.localeCompare(b));

  // 3. Combine lists in the correct order
  const sortedPaths = [...priorityFiles, ...srcOnlyFiles, ...includeOnlyFiles];

  // 4. Generate final output paths with collision handling
  const outputFiles = [];
  const usedRelPaths = new Set();

  for (const fullPath of sortedPaths) {
    const data = filesToProcess.get(fullPath);
    if (!data) {
      logger.warn(`File from priorityOrder not found in collected files: ${fullPath}`);
      continue;
    }
    let relPath;

    if (data.type === 'internal') {
      relPath = path.relative(srcDir, fullPath);
    } else if (data.type === 'external_dir') {
      const includeDir = path.resolve(srcDir, data.rawPath);
      relPath = path.relative(includeDir, fullPath);
    } else { // external_file or a file from priorityOrder that might be external
      relPath = path.basename(fullPath);
    }

    // Handle name conflicts
    let finalRelPath = relPath;
    let counter = 1;
    const ext = path.extname(finalRelPath);
    const base = finalRelPath.substring(0, finalRelPath.length - ext.length);
    while (usedRelPaths.has(finalRelPath)) {
      finalRelPath = `${base}_${counter}${ext}`;
      counter++;
    }
    usedRelPaths.add(finalRelPath);
    
    outputFiles.push({ fullPath, relPath: finalRelPath, type: data.type });
  }
  
  // Also include files from priority order that might not have been collected
  const priorityFilesData = priorityOrder.map(p => path.resolve(srcDir, p))
    .filter(fullPath => !filesToProcess.has(fullPath) && fs.existsSync(fullPath));

  if (priorityFilesData.length > 0) {
    logger.info('Including priority files that were not part of the initial scan.');
    // This part is tricky, for now we assume priorityOrder files are within src or include.
    // A more robust implementation might be needed if they can be anywhere.
  }
  
  return outputFiles;
}

async function buildBackend() {
  if (!CONFIG.backend.build) return;

  logger.info('Building Backend...');
  const outDir = path.resolve(configDir, CONFIG.outDir);

  const sortedFiles = await getSortedBackendFiles();

  if (sortedFiles.length === 0) {
    logger.warn('No backend files found to build.');
    return;
  }
  
  logger.info('Processing backend file imports...');
  // Process imports for each file
  for (const pFile of sortedFiles) {
    const processedCode = await processFileImports(pFile.fullPath);
    // Strip 'export' statements to avoid issues in the Apps Script environment
    pFile.code = processedCode.replace(/^export\s+(function|const|let|var|class)/gm, '$1');
  }

  const shouldMinify = CONFIG.backend.minify;

  // Write output
  if (CONFIG.backend.concatenate) {
    const banner = await getBanner();
    const contentChunks = [];
    logger.info('Concatenating backend files...');
    for (const pFile of sortedFiles) {
      contentChunks.push(`\n// --- ${pFile.relPath} ---\n${pFile.code}\n`);
    }
    let finalContent = contentChunks.join('');
    if (shouldMinify) {
      logger.info('Minifying concatenated backend code...');
      finalContent = await minifyCode(finalContent);
    }
    await fsPromises.writeFile(path.join(outDir, CONFIG.backend.outFile), banner + finalContent);
    logger.success(`Backend concatenated to ${CONFIG.backend.outFile}`);
  } else {
    logger.info('Processing backend as separate files...');
    for (const pFile of sortedFiles) {
      let content = pFile.code;
      if (shouldMinify) content = await minifyCode(content);
      const destPath = path.join(outDir, pFile.relPath);
      const destDir = path.dirname(destPath);
      await fsPromises.mkdir(destDir, { recursive: true });
      await fsPromises.writeFile(destPath, content);
      logger.info(`-> Wrote ${pFile.relPath}`);
    }
    logger.success(`Backend files processed (${sortedFiles.length})`);
  }
}

// ==========================================
// 7. MAIN EXECUTION
// ==========================================

async function run() {
  CONFIG = await loadConfig();

  // DEV MODE
  if (IS_DEV) {
    await startDevServer();
    return;
  }

  const start = Date.now();
  await cleanDist();

  // 1. ALWAYS COPY MANIFEST & CLASP
  await createClaspJson();
  await copyManifest();

  // 2. BUILD
  await buildFrontend();
  await buildBackend();

  logger.success(`Build complete in ${(Date.now() - start)}ms`);

  // 3. PUSH & DEPLOY
  if (IS_PUSH) {
    console.log('');
    await claspPush();
  }
  if (IS_DEPLOY) {
    console.log('');
    await claspDeploy(); // This internally saves the prodDeploymentId
  }

  // 4. FINAL MESSAGE
  if (IS_PUSH) { // This flag is true for both --push and --deploy
    const devId = await getDevDeploymentId(); // Fetches and saves dev ID if needed
    const latestConfig = await loadConfig(); // Reload to get potentially new prod ID
    const prodId = latestConfig.deployment?.prodDeploymentId;

    if (latestConfig.message) {
      let message = latestConfig.message
        .replace(/{dev_id}/g, devId || 'N/A')
        .replace(/{prod_id}/g, prodId || 'N/A');
      console.log('');
      logger.info(message);
    } else {
      // Fallback to old behavior
      if (devId) {
        logger.link('DEV Web App', `https://script.google.com/macros/s/${devId}/dev`);
      }
      if (IS_DEPLOY) {
        if (prodId) {
          logger.link('PROD Web App', `https://script.google.com/macros/s/${prodId}/exec`);
        } else {
          logger.warn('Could not determine new production deployment ID.');
        }
      }
    }
  }
}

run().catch(e => {
  logger.error('An unexpected error occurred:');
  console.error(e);
  process.exit(1);
});
