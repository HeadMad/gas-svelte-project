import fs from 'fs';
import path from 'path';
import { build as esbuild } from 'esbuild';
import { execSync } from 'child_process';

// ==========================================
// 1. КОНФИГУРАЦИЯ
// ==========================================
const CONFIG = {
  srcManifest: 'src/appsscript.json',
  srcBackend: 'src/backend',
  outDir: 'dist',
  packageJsonPath: './package.json',

  modules: {
    frontend: true,
    backend: true
  },

  backendSettings: {
    concatenate: true,
    outFile: 'Code.js',
    minify: true, // Финальное сжатие
    priorityOrder: [
      'config.js',
      'utils/logger.js'
    ]
  }
};

// ==========================================
// 2. УТИЛИТЫ
// ==========================================
const logger = {
  info: (msg) => console.log(`🔹 ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
};

function cleanDist() {
  if (fs.existsSync(CONFIG.outDir)) fs.rmSync(CONFIG.outDir, { recursive: true, force: true });
  fs.mkdirSync(CONFIG.outDir, { recursive: true });
}

function getBanner() {
  try {
    if (!fs.existsSync(CONFIG.packageJsonPath)) return '';
    const pkg = JSON.parse(fs.readFileSync(CONFIG.packageJsonPath, 'utf-8'));
    let banner = `/**\n * ${pkg.name || 'App'} v${pkg.version || '0.0.0'}\n`;
    if (pkg.description) banner += ` * ${pkg.description}\n`;
    banner += ` */\n`;
    return banner;
  } catch { return ''; }
}

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

// ==========================================
// 3. ЛОГИКА ИМПОРТОВ
// ==========================================

async function bundleImport(importPath, exportNames, isDefault, workingDir) {
  let entryContent = '';
  if (isDefault) {
    entryContent = `export { default as default } from '${importPath}';`;
  } else {
    entryContent = `export { ${exportNames} } from '${importPath}';`;
  }

  try {
    const result = await esbuild({
      stdin: {
        contents: entryContent,
        resolveDir: path.resolve(workingDir),
        loader: 'js',
        sourcefile: 'virtual-entry.js'
      },
      bundle: true,
      minify: true,
      
      // ЧИСТОТА КОДА:
      keepNames: false,        // Убираем лишние defineProperty для имен функций
      treeShaking: true,       // Выкидываем неиспользуемое
      legalComments: 'none',   // Убираем лицензии
      
      charset: 'utf8',
      format: 'esm',
      target: 'esnext',        // Используем современный JS (стрелочные функции и т.д.)
      write: false,
    });

    let code = result.outputFiles[0].text.trim();

    while (code.endsWith(';') || code.endsWith('\n')) {
      code = code.slice(0, -1);
    }

    const lastExportIndex = code.lastIndexOf('export');
    
    if (lastExportIndex === -1) {
      return `(() => { ${code}; return {}; })()`;
    }

    const body = code.slice(0, lastExportIndex);
    let exportStatement = code.slice(lastExportIndex);

    let returnObj = '';

    if (exportStatement.includes('default') && !exportStatement.includes('{')) {
      const val = exportStatement.replace(/export\s+default\s+/, '').trim();
      returnObj = `{ default: ${val} }`;
    } else {
      const content = exportStatement
        .replace(/^export\s*\{/, '')
        .replace(/\}\s*$/, '')
        .trim();
      
      const parts = content.split(',');
      const props = [];

      parts.forEach(part => {
        part = part.trim();
        if (!part) return;
        if (part.includes(' as ')) {
          const [localName, exportName] = part.split(' as ');
          props.push(`${exportName.trim()}: ${localName.trim()}`);
        } else {
          props.push(`${part}: ${part}`);
        }
      });
      
      returnObj = `{ ${props.join(', ')} }`;
    }

    let separator = ';';
    if (body.trim().endsWith(';') || body.trim() === '') separator = '';
    
    // Если body пустой (например, библиотека просто экспортирует константу), не добавляем его
    const bodyPart = body.trim() ? `${body}${separator}` : '';

    return `(() => { ${bodyPart} return ${returnObj}; })()`;

  } catch (e) {
    logger.error(`Ошибка при сборке импорта: ${importPath}`);
    if (e.errors) e.errors.forEach(err => console.error(` > ${err.text}`));
    throw e;
  }
}


async function processFileImports(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  const fileDir = path.dirname(filePath);
  const importRegex = /import\s+(?:(\w+)|(?:\{([^}]+)\}))\s+from\s+['"]([^'"]+)['"];?/g;

  const matches = [...code.matchAll(importRegex)];
  for (const match of matches.reverse()) {
    const fullStatement = match[0];
    const defaultImport = match[1];
    const namedImports = match[2];
    const importPath = match[3];
    const index = match.index;

    logger.info(`  -> Inlining: ${importPath}`);

    let replacement = '';
    let bundledCode = '';

    if (defaultImport) {
      bundledCode = await bundleImport(importPath, null, true, fileDir);
      replacement = `const ${defaultImport} = (function(r){ return r.default || r; })(${bundledCode});`;
    } else if (namedImports) {
      bundledCode = await bundleImport(importPath, namedImports, false, fileDir);
      replacement = `const { ${namedImports} } = ${bundledCode};`;
    }

    code = code.substring(0, index) + replacement + code.substring(index + fullStatement.length);
  }
  return code;
}

// ==========================================
// 4. СБОРКА
// ==========================================

function buildFrontend() {
  logger.info('Сборка Frontend...');
  try {
    execSync('npx vite build', { stdio: 'inherit' });
  } catch (e) {
    process.exit(1);
  }
}

async function buildBackend() {
  logger.info('Сборка Backend...');
  const { srcBackend, outDir, backendSettings, srcManifest } = CONFIG;

  const allFiles = getAllJsFiles(srcBackend);
  if (!allFiles.length) return;

  const sortedFiles = sortFiles(allFiles, srcBackend, backendSettings.priorityOrder);
  
  const processedFiles = [];
  for (const file of sortedFiles) {
    try {
      const processedCode = await processFileImports(file);
      const cleanCode = processedCode.replace(/^export\s+(function|const|let|var|class)/gm, '$1');
      
      processedFiles.push({
        path: file,
        relPath: path.relative(srcBackend, file),
        code: cleanCode
      });
    } catch (e) {
      logger.error(`Ошибка в файле ${file}`);
      console.error(e);
      process.exit(1);
    }
  }

  if (backendSettings.concatenate) {
    logger.info('Склейка файлов...');
    let finalContent = '';
    
    for (const pFile of processedFiles) {
      finalContent += `\n// --- ${pFile.relPath} ---\n${pFile.code}\n`;
    }

    if (backendSettings.minify) {
       logger.info('Финальная минификация...');
       const result = await esbuild({
         stdin: { contents: finalContent, loader: 'js' },
         minifyWhitespace: true,
         minifySyntax: true,
         minifyIdentifiers: false,
         legalComments: 'none', // И здесь тоже убираем комментарии для чистоты
         charset: 'utf8',
         target: 'es2020',
         write: false,
       });
       finalContent = result.outputFiles[0].text;
    }
    
    const banner = getBanner();
    fs.writeFileSync(path.join(outDir, backendSettings.outFile), banner + finalContent);
    logger.success(`Собрано в ${backendSettings.outFile}`);

  } else {
    for (const pFile of processedFiles) {
      let content = pFile.code;
      
      if (backendSettings.minify) {
         const result = await esbuild({
           stdin: { contents: content, loader: 'js' },
           minifyWhitespace: true,
           minifySyntax: true,
           minifyIdentifiers: false,
           legalComments: 'none',
           charset: 'utf8',
           target: 'es2020',
           write: false,
         });
         content = result.outputFiles[0].text;
      }

      const destPath = path.join(outDir, pFile.relPath);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      fs.writeFileSync(destPath, content);
      logger.info(`-> ${pFile.relPath}`);
    }
  }

  if (fs.existsSync(srcManifest)) {
    fs.copyFileSync(srcManifest, path.join(outDir, 'appsscript.json'));
    logger.success('Manifest copied.');
  } else {
    logger.warn(`Manifest not found: ${srcManifest}`);
  }
}

async function run() {
  const start = Date.now();
  cleanDist();

  if (CONFIG.modules.frontend) buildFrontend();
  if (CONFIG.modules.backend) await buildBackend();
  
  logger.success(`Готово за ${(Date.now() - start)}ms`);
}

run();
