import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { build as esbuild } from 'esbuild';
import { minify } from 'terser';
import { build as viteBuild, createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { minify as minifyHtml } from 'html-minifier-terser';

const CONFIG_PATH = './build.config.json';
let CONFIG = loadConfig();

// ==========================================
// 1. CONFIG & UTILS
// ==========================================

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(newConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  CONFIG = newConfig;
}

function updateDeploymentId(key, value) {
  const cfg = loadConfig();
  if (!cfg.deployment) cfg.deployment = {};
  cfg.deployment[key] = value;
  saveConfig(cfg);
}

const logger = {
  info: (msg) => console.log(`🔹 ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  link: (label, url) => console.log(`🔗 \x1b[36m${label}:\x1b[0m \x1b[4m${url}\x1b[0m`),
};

const args = process.argv.slice(2);
const IS_DEV = args.includes('--dev');
const IS_PUSH = args.includes('--push') || args.includes('--deploy');
const IS_DEPLOY = args.includes('--deploy');

// ==========================================
// 2. CLASP COMMANDS
// ==========================================

function runCommand(command) {
  try {
    return execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
  } catch (e) {
    logger.error(`Command failed: ${command}`);
    logger.error(e.stderr || e.message);
    process.exit(1);
  }
}

function getDevDeploymentId() {
  if (CONFIG.deployment?.devDeploymentId) return CONFIG.deployment.devDeploymentId;

  logger.info('Fetching Dev Deployment ID (@HEAD)...');
  try {
    const output = runCommand('npx clasp deployments');
    const match = output.match(/- ([a-zA-Z0-9_-]+)\s+@HEAD/);
    if (match && match[1]) {
      updateDeploymentId('devDeploymentId', match[1]);
      return match[1];
    }
    return null;
  } catch (e) { return null; }
}

function claspPush() {
  logger.info('Clasp Push...');
  runCommand('npx clasp push --force');
  logger.success('Pushed.');
}

function claspDeploy() {
  logger.info('Clasp Deploy...');
  const output = runCommand('npx clasp deploy');
  logger.success('Deployed.');

  const idMatch = output.match(/Deployed\s+([a-zA-Z0-9_-]+)\s+@\d+/);
  if (idMatch && idMatch[1]) {
    updateDeploymentId('prodDeploymentId', idMatch[1]);
    return idMatch[1];
  }
  return null;
}

// ==========================================
// 3. FILE SYSTEM HELPERS
// ==========================================

function cleanDist() {
  if (fs.existsSync(CONFIG.outDir)) fs.rmSync(CONFIG.outDir, { recursive: true, force: true });
  fs.mkdirSync(CONFIG.outDir, { recursive: true });
}

function copyManifest() {
  if (fs.existsSync(CONFIG.manifest)) {
    fs.copyFileSync(CONFIG.manifest, path.join(CONFIG.outDir, 'appsscript.json'));
    logger.success('Manifest copied.');
  } else {
    logger.warn(`Manifest not found at ${CONFIG.manifest}`);
  }
}

function getBanner() {
  try {
    if (!fs.existsSync(CONFIG.package)) return '';
    const pkg = JSON.parse(fs.readFileSync(CONFIG.package, 'utf-8'));
    return `/**\n * ${pkg.name || 'App'} v${pkg.version || '0.0.0'}\n */\n`;
  } catch (error) { return ''; }
}

// Рекурсивный поиск HTML
function getAllHtmlFiles(dir, fileList = [], rootDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllHtmlFiles(filePath, fileList, rootDir);
    } else if (file.endsWith('.html')) {
      fileList.push({
        fullPath: filePath,
        relPath: path.relative(rootDir, filePath) // e.g. "sub/index.html"
      });
    }
  });
  return fileList;
}

// Рекурсивный поиск JS
function getAllJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
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
  let code = fs.readFileSync(filePath, 'utf-8');
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
  const srcDir = path.resolve(process.cwd(), CONFIG.frontend.src);
  const outDir = path.resolve(process.cwd(), CONFIG.outDir);
  
  const htmlFiles = getAllHtmlFiles(CONFIG.frontend.src);
  if (htmlFiles.length === 0) return;

  const shouldMinify = CONFIG.frontend.minify;

  const plugins = [
    svelte(),
    viteSingleFile({ removeViteModuleLoader: true })
  ];
  if (shouldMinify) plugins.push(htmlMinifierPlugin(true));

  // Собираем каждый файл, чтобы сохранить структуру
  for (let i = 0; i < htmlFiles.length; i++) {
    const { fullPath, relPath } = htmlFiles[i];
    logger.info(`-> ${relPath}`);

    // Имя файла без расширения для ключа input.
    // Пример: relPath = "sub/index.html" -> name = "sub/index"
    // Vite создаст dist/sub/index.html
    const entryName = relPath.replace(/\.html$/, '');

    try {
      await viteBuild({
        root: srcDir,
        configFile: false,
        plugins: plugins,
        build: {
          outDir: outDir,
          emptyOutDir: false, // Важно! Не чистим, т.к. пишем по файлу
          minify: shouldMinify ? 'terser' : false,
          modulePreload: false,
          rollupOptions: {
            input: {
              [entryName]: fullPath
            },
            output: {
              entryFileNames: `[name].js`,
              assetFileNames: `[name].[ext]`
            }
          },
          terserOptions: shouldMinify ? { ecma: 2020, compress: { drop_console: false, passes: 2 }, format: { comments: false } } : undefined
        }
      });
    } catch (e) {
      logger.error(`Error building ${relPath}`);
      process.exit(1);
    }
  }
  logger.success(`Frontend built (${htmlFiles.length} files)`);
}

async function startDevServer() {
  logger.info('🚀 Starting Vite Dev Server...');
  const server = await createServer({
    root: path.resolve(process.cwd(), CONFIG.frontend.src),
    configFile: false,
    plugins: [svelte()],
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

async function buildBackend() {
  if (!CONFIG.backend.build) return;
  
  logger.info('Building Backend...');
  const srcDir = CONFIG.backend.src;
  const outDir = CONFIG.outDir;
  
  const allFiles = getAllJsFiles(srcDir);
  if (!allFiles.length) return;

  const sortedFiles = sortFiles(allFiles, srcDir, CONFIG.backend.priorityOrder);
  const processedFiles = [];

  // 1. Обработка импортов
  for (const file of sortedFiles) {
    const processedCode = await processFileImports(file);
    const cleanCode = processedCode.replace(/^export\s+(function|const|let|var|class)/gm, '$1');
    processedFiles.push({ 
      path: file, 
      relPath: path.relative(srcDir, file), 
      code: cleanCode 
    });
  }

  const shouldMinify = CONFIG.backend.minify;

  if (CONFIG.backend.concatenate) {
    // --- Concatenation Mode ---
    let finalContent = '';
    for (const pFile of processedFiles) finalContent += `\n// --- ${pFile.relPath} ---\n${pFile.code}\n`;
    
    if (shouldMinify) {
       finalContent = await minifyCode(finalContent);
    }
    
    const outFile = path.join(outDir, CONFIG.backend.outFile);
    fs.writeFileSync(outFile, getBanner() + finalContent);
    logger.success(`Backend concatenated to ${CONFIG.backend.outFile}`);

  } else {
    // --- Separate Files Mode ---
    logger.info('Processing backend as separate files...');
    
    for (const pFile of processedFiles) {
      let content = pFile.code;
      if (shouldMinify) content = await minifyCode(content);

      const destPath = path.join(outDir, pFile.relPath);
      const destDir = path.dirname(destPath);
      
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      
      fs.writeFileSync(destPath, content);
      logger.info(`-> ${pFile.relPath}`);
    }
    logger.success(`Backend files processed (${processedFiles.length})`);
  }
}

// ==========================================
// 7. MAIN EXECUTION
// ==========================================

async function run() {
  // DEV MODE
  if (IS_DEV) {
    await startDevServer();
    return;
  }

  const start = Date.now();
  cleanDist();

  // 1. ALWAYS COPY MANIFEST
  copyManifest();

  // 2. BUILD
  await buildFrontend();
  await buildBackend();

  logger.success(`Build complete in ${(Date.now() - start)}ms`);

  // 3. PUSH
  if (IS_PUSH) {
    console.log('');
    claspPush();
    
    const devId = getDevDeploymentId();
    if (devId) {
      logger.link('DEV Web App', `https://script.google.com/macros/s/${devId}/dev`);
    } else {
      // Если не нашли сразу (первый запуск), пробуем еще раз
      try {
         const output = runCommand('npx clasp deployments');
         const match = output.match(/- ([a-zA-Z0-9_-]+)\s+@HEAD/);
         if (match && match[1]) {
           updateDeploymentId('devDeploymentId', match[1]);
           logger.link('DEV Web App', `https://script.google.com/macros/s/${match[1]}/dev`);
         }
      } catch(e) {}
    }
  }

  // 4. DEPLOY
  if (IS_DEPLOY) {
    console.log('');
    const newExecId = claspDeploy();
    if (newExecId) {
      logger.link('PROD Web App', `https://script.google.com/macros/s/${newExecId}/exec`);
    } else {
      logger.warn('Could not parse new deployment ID.');
    }
  }
}

run();
