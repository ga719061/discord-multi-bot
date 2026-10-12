import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCUMENTS = ['AGENTS.md', 'README.md', 'ChihuahuaKing_Manual.md'];
const CODE_ROOTS = ['src', 'tests', 'scripts'];
const MODULE_IDS = ['ai', 'music', 'settings-database', 'steam', 'games', 'community', 'ui', 'runtime'];
const slash = (value) => value.split(path.sep).join('/');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isWithin = (root, target) => {
    const relative = path.relative(root, target);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

function walk(root, relative, errors) {
    const directory = path.join(root, relative);
    if (!fs.existsSync(directory)) return [];
    if (fs.lstatSync(directory).isSymbolicLink() || !isWithin(root, fs.realpathSync(directory))) {
        errors.push(`不接受越界或符號連結目錄：${relative}`);
        return [];
    }
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const name = slash(path.join(relative, entry.name));
        if (entry.isSymbolicLink()) {
            errors.push(`不接受符號連結：${name}`);
        } else if (entry.isDirectory()) {
            files.push(...walk(root, name, errors));
        } else if (entry.isFile()) {
            files.push(name);
        }
    }
    return files;
}

function withoutFences(text) {
    return text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '');
}

export function markdownAnchors(text) {
    const counts = new Map();
    const anchors = new Set();
    const source = withoutFences(text);
    for (const match of source.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
        const slug = match[1].replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '')
            .trim().toLowerCase().replace(/\s/g, '-');
        const count = counts.get(slug) ?? 0;
        anchors.add(count ? `${slug}-${count}` : slug);
        counts.set(slug, count + 1);
    }
    for (const match of source.matchAll(/<(?:a|[^\s>]+)\s+[^>]*\bid=["']([^"']+)["']/g)) anchors.add(match[1]);
    return anchors;
}

function closingBracket(source, start) {
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
        if (source[index] === '\\') { index += 1; continue; }
        if (source[index] === '\n') return -1;
        if (source[index] === '[') depth += 1;
        if (source[index] === ']' && --depth === 0) return index;
    }
    return -1;
}

function checkLinks(root, document, text, errors) {
    const source = withoutFences(text);
    const references = new Map([...source.matchAll(/^\s*\[([^\]]+)\]:\s*(<[^>]+>|\S+)/gm)]
        .map((match) => [match[1].toLowerCase(), match[2].replace(/^<|>$/g, '')]));
    const destinations = [...references.values()];
    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\\') { index += 1; continue; }
        if (source[index] !== '[') continue;
        const end = closingBracket(source, index);
        if (end < 0) continue;
        if (source[end + 1] === '(') {
            const destination = source.slice(end + 1).match(/^\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/);
            if (destination) {
                destinations.push(destination[1].replace(/^<|>$/g, ''));
            }
        } else if (source[end + 1] === '[') {
            const referenceEnd = closingBracket(source, end + 1);
            if (referenceEnd < 0) continue;
            const label = (source.slice(end + 2, referenceEnd) || source.slice(index + 1, end)).toLowerCase();
            if (!references.has(label)) errors.push(`${document}：未定義連結參照 ${label}`);
        }
    }
    for (const destination of destinations) {
        if (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('//')) continue;
        let decoded;
        try { decoded = decodeURIComponent(destination); } catch {
            errors.push(`${document}：無法解析本地連結`);
            continue;
        }
        const [filename, fragment] = decoded.split('#');
        const target = filename ? path.resolve(path.dirname(path.join(root, document)), filename.split('?')[0]) : path.join(root, document);
        if (!isWithin(root, target)) {
            errors.push(`${document}：本地連結越出專案範圍`);
            continue;
        }
        if (!fs.existsSync(target)) {
            errors.push(`${document}：連結不存在 ${destination}`);
            continue;
        }
        if (!isWithin(root, fs.realpathSync(target))) {
            errors.push(`${document}：本地連結實際位置越出專案範圍`);
            continue;
        }
        if (fragment) {
            const relative = slash(path.relative(root, target));
            if (fs.realpathSync(target) !== target || (!DOCUMENTS.includes(relative) && !(relative.startsWith('docs/') && relative.endsWith('.md')))) {
                errors.push(`${document}：僅可驗證文件目錄內 Markdown anchor ${destination}`);
            } else if (!markdownAnchors(fs.readFileSync(target, 'utf8')).has(fragment)) {
                errors.push(`${document}：anchor 不存在 ${destination}`);
            }
        }
    }
}

export function documentedCommandNames(text) {
    const start = '<!-- command-manifest:start -->';
    const end = '<!-- command-manifest:end -->';
    const first = text.indexOf(start);
    const last = text.indexOf(end);
    if (first < 0 || last < first || text.indexOf(start, first + start.length) >= 0 || text.indexOf(end, last + end.length) >= 0) {
        throw new Error('操作手冊必須包含一組 command-manifest:start/end 標記');
    }
    const table = text.slice(first + start.length, last);
    return [...table.matchAll(/^\s*\|\s*`\/([^`\s]+)`\s*\|/gm)].map((match) => match[1]);
}

// Import commands in isolation: the normal logger mutates logs at import time.
export function readCommandNames(root = PROJECT_ROOT) {
    const manifestUrl = pathToFileURL(path.join(PROJECT_ROOT, 'scripts/command-manifest.js')).href;
    const loggerUrl = pathToFileURL(path.join(root, 'src/utils/logger.js')).href;
    const source = `
        import { registerHooks, syncBuiltinESMExports } from 'node:module';
        import net from 'node:net';
        import http from 'node:http';
        import https from 'node:https';
        import tls from 'node:tls';
        import dns from 'node:dns';
        import dnsPromises from 'node:dns/promises';
        import dgram from 'node:dgram';
        const denied = () => { throw new Error('文件驗證禁止網路操作'); };
        globalThis.fetch = denied;
        net.connect = net.createConnection = net.Socket.prototype.connect = denied;
        net.Server.prototype.listen = denied;
        http.get = http.request = https.get = https.request = tls.connect = denied;
        dgram.createSocket = denied;
        for (const api of [dns, dnsPromises]) {
            for (const name of Object.keys(api)) if (typeof api[name] === 'function') api[name] = denied;
        }
        syncBuiltinESMExports();
        registerHooks({ load(url, context, nextLoad) {
            if (url === ${JSON.stringify(loggerUrl)}) return {
                format: 'module', shortCircuit: true,
                source: 'export const logger = { info() {}, warn() {}, error() {}, debug() {} };'
            };
            return nextLoad(url, context);
        }});
        const { buildCommandManifest, validateCommandManifest } = await import(${JSON.stringify(manifestUrl)});
        const names = validateCommandManifest(await buildCommandManifest(${JSON.stringify(path.join(root, 'src/commands'))}));
        process.stdout.write(JSON.stringify(names));
    `;
    const readable = [path.join(root, 'src'), path.join(root, 'package.json'), path.join(PROJECT_ROOT, 'scripts'),
        path.join(PROJECT_ROOT, 'node_modules'), path.join(PROJECT_ROOT, 'package.json')];
    const result = spawnSync(process.execPath, ['--permission', '--allow-addons',
        ...readable.map((entry) => `--allow-fs-read=${entry}`), '--input-type=module', '-e', source], {
        cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
        env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, NODE_NO_WARNINGS: '1' },
    });
    if (result.error || result.status !== 0) throw new Error('指令 manifest 無法在唯讀隔離環境載入；請執行 verify:commands 檢查模組');
    try { return JSON.parse(result.stdout); } catch { throw new Error('指令 manifest 輸出格式錯誤'); }
}

export function verifyDocumentation(root = PROJECT_ROOT, { commandNames } = {}) {
    root = path.resolve(root);
    const errors = [];
    const read = (relative) => {
        const target = path.join(root, relative);
        if (!fs.existsSync(target)) { errors.push(`必要檔案不存在：${relative}`); return null; }
        if (!isWithin(root, fs.realpathSync(target)) || fs.lstatSync(target).isSymbolicLink()) {
            errors.push(`不接受越界或符號連結檔案：${relative}`); return null;
        }
        return fs.readFileSync(target, 'utf8');
    };
    const packageText = read('package.json');
    const mapText = read('docs/module-map.json');
    const parseObject = (text, filename) => {
        if (text === null) return undefined;
        let value;
        try { value = JSON.parse(text); } catch { errors.push(`${filename} 不是有效 JSON`); return undefined; }
        if (!isObject(value)) { errors.push(`${filename} 必須是非 null JSON object`); return undefined; }
        return value;
    };
    const packageJson = parseObject(packageText, 'package.json');
    const moduleMap = parseObject(mapText, 'docs/module-map.json');
    if (packageJson && !isObject(packageJson.scripts)) errors.push('package.json scripts 必須是非 null JSON object');
    if (moduleMap) {
        for (const field of ['modules', 'files']) {
            if (!isObject(moduleMap[field])) errors.push(`docs/module-map.json ${field} 必須是非 null JSON object`);
        }
    }
    const documents = [...DOCUMENTS, ...walk(root, 'docs', errors).filter((file) => file.endsWith('.md'))];
    const codeFiles = CODE_ROOTS.flatMap((directory) => walk(root, directory, errors)).filter((file) => /\.(?:js|mjs)$/.test(file));
    let manual;
    for (const document of documents) {
        const text = read(document);
        if (text === null) continue;
        if (document === 'AGENTS.md' && Buffer.byteLength(text, 'utf8') > 8192) errors.push('AGENTS.md 超過 8 KiB 上限');
        if (document === 'ChihuahuaKing_Manual.md') manual = text;
        checkLinks(root, document, text, errors);
        for (const match of text.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)) {
            if (!Object.hasOwn(packageJson?.scripts ?? {}, match[1])) errors.push(`${document}：npm script 不存在 ${match[1]}`);
        }
        for (const match of text.matchAll(/\bnpm\s+(start|test)\b/g)) {
            if (!Object.hasOwn(packageJson?.scripts ?? {}, match[1])) errors.push(`${document}：npm script 不存在 ${match[1]}`);
        }
        for (const match of text.matchAll(/`((?:src|tests|scripts|assets|docs)\/[A-Za-z\d_./-]+\.(?:js|mjs|json|md|png|jpg|webp|sh|yml))`/g)) {
            if (!isWithin(root, path.resolve(root, match[1])) || !fs.existsSync(path.join(root, match[1]))) {
                errors.push(`${document}：文件程式或素材路徑不存在 ${match[1]}`);
            }
        }
    }
    if (packageJson && isObject(packageJson.scripts)) {
        const actualTests = codeFiles.filter((file) => /^(?:src|tests)\//.test(file) && file.endsWith('.test.js'));
        const testScript = packageJson.scripts.test;
        if (typeof testScript !== 'string') errors.push('package.json scripts.test 必須是字串');
        const listedTests = typeof testScript === 'string' ? testScript.match(/(?:src|tests)\/[^\s"']+\.test\.js/g) ?? [] : [];
        for (const file of actualTests) if (!listedTests.includes(file)) errors.push(`測試未登錄 npm test：${file}`);
        for (const file of listedTests) if (!actualTests.includes(file)) errors.push(`npm test 登錄不存在的測試：${file}`);
        if (new Set(listedTests).size !== listedTests.length) errors.push('npm test 有重複測試路徑');
    }
    if (moduleMap && isObject(moduleMap.modules) && isObject(moduleMap.files)) {
        const modules = moduleMap.modules;
        const files = moduleMap.files;
        for (const id of MODULE_IDS) if (!Object.hasOwn(modules, id)) errors.push(`缺少模組定義：${id}`);
        for (const [id, module] of Object.entries(modules)) {
            if (!MODULE_IDS.includes(id)) errors.push(`未知模組：${id}`);
            const document = module?.document;
            if (typeof document !== 'string' || !documents.includes(document)) errors.push(`模組文件不存在或不在安全文件範圍：${id}`);
        }
        for (const file of codeFiles) if (!Object.hasOwn(files, file)) errors.push(`檔案未指定模組歸屬：${file}`);
        for (const [file, entry] of Object.entries(files)) {
            if (!codeFiles.includes(file)) errors.push(`模組地圖列出不存在或不受管理的檔案：${file}`);
            if (!Object.hasOwn(modules, entry?.owner) || !MODULE_IDS.includes(entry?.owner)) errors.push(`無效的 owner：${file}`);
            if (!Array.isArray(entry?.sharedWith) || entry.sharedWith.some((id) => !Object.hasOwn(modules, id) || !MODULE_IDS.includes(id) || id === entry.owner)
                || new Set(entry.sharedWith).size !== entry.sharedWith.length) errors.push(`無效的 sharedWith：${file}`);
        }
    }
    if (manual !== undefined) {
        try {
            const documented = documentedCommandNames(manual);
            const names = commandNames ?? readCommandNames(root);
            if (new Set(documented).size !== documented.length) errors.push('操作手冊正式指令表有重複入口');
            for (const name of names) if (!documented.includes(name)) errors.push(`操作手冊缺少正式指令：/${name}`);
            for (const name of documented) if (!names.includes(name)) errors.push(`操作手冊包含非正式指令：/${name}`);
        } catch (error) { errors.push(error.message); }
    }
    return { errors, documentCount: documents.length, codeFileCount: codeFiles.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = verifyDocumentation();
    if (result.errors.length) {
        for (const error of result.errors) console.error(`文件驗證失敗：${error}`);
        process.exitCode = 1;
    } else {
        console.log(`文件驗證完成：${result.documentCount} 份文件、${result.codeFileCount} 個程式／測試檔案。`);
    }
}
