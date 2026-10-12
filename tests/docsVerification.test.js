import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { documentedCommandNames, markdownAnchors, readCommandNames, verifyDocumentation } from '../scripts/verify-docs.js';

const moduleIds = ['ai', 'music', 'settings-database', 'steam', 'games', 'community', 'ui', 'runtime'];

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gigi-docs-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const write = (name, content) => {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        fs.writeFileSync(path.join(root, name), content, 'utf8');
    };
    const map = {
        modules: Object.fromEntries(moduleIds.map((id) => [id, { document: `docs/modules/${id}.md` }])),
        files: {
            'src/entry.js': { owner: 'runtime', sharedWith: [] },
            'tests/entry.test.js': { owner: 'runtime', sharedWith: [] },
        },
    };
    write('package.json', JSON.stringify({ type: 'module', scripts: {
        start: 'node src/entry.js', test: 'node --test tests/entry.test.js', 'verify:docs': 'node scripts/verify-docs.js',
    } }));
    write('AGENTS.md', '# 維護\n\n[導航](docs/modules/runtime.md#入口與資料流)\n');
    write('README.md', '# 專案\n\n`npm run verify:docs`；`npm test`；`src/entry.js`\n');
    write('ChihuahuaKing_Manual.md', '# 手冊\n<!-- command-manifest:start -->\n| 指令 | 說明 |\n| --- | --- |\n| `/幫助` | 入口 |\n| `/help` | 別名 |\n<!-- command-manifest:end -->\n');
    for (const id of moduleIds) write(`docs/modules/${id}.md`, '# 模組\n\n## 入口與資料流\n');
    write('docs/module-map.json', JSON.stringify(map));
    write('src/entry.js', 'export const entry = true;\n');
    write('tests/entry.test.js', '// synthetic test\n');
    const verify = () => verifyDocumentation(root, { commandNames: ['幫助', 'help'] });
    return { root, write, map, verify };
}

test('documentation fixture passes with local paths, anchors, scripts, tests and module owners', (t) => {
    const { verify } = fixture(t);
    assert.deepEqual(verify().errors, []);
});

test('broken links, missing anchors and undefined references fail', (t) => {
    const { write, verify } = fixture(t);
    write('README.md', '[missing](docs/missing.md)\n[anchor](docs/modules/runtime.md#missing)\n[label][unknown]\n');
    const errors = verify().errors.join('\n');
    assert.match(errors, /連結不存在/);
    assert.match(errors, /anchor 不存在/);
    assert.match(errors, /未定義連結參照/);
});

test('nested and escaped link labels preserve inline, image, reference and angle destinations', (t) => {
    const { write, verify } = fixture(t);
    write('README.md', '[route [NAS]](docs/missing.md)\n![cover [NAS]](<docs/cover-missing.md> "cover")\n[![cover](docs/nested-image-missing.md)](docs/modules/runtime.md)\n[nested [NAS]][module]\n[module]: docs/modules/runtime.md#入口與資料流\n[valid [NAS]](<docs/modules/runtime.md#入口與資料流>)\n[escaped \\] label](docs/escaped-missing.md)\n\\[literal](docs/ignored.md)\n```md\n[route [NAS]](docs/fenced.md)\n```\n');
    const errors = verify().errors.join('\n');
    assert.match(errors, /連結不存在 docs\/missing.md/);
    assert.match(errors, /連結不存在 docs\/cover-missing.md/);
    assert.match(errors, /連結不存在 docs\/escaped-missing.md/);
    assert.match(errors, /連結不存在 docs\/nested-image-missing.md/);
    assert.doesNotMatch(errors, /未定義連結參照|anchor 不存在|ignored.md|fenced.md/);
});

test('JSON null, arrays and primitives cannot skip package or module-map verification', (t) => {
    const { write, verify, root } = fixture(t);
    for (const filename of ['package.json', 'docs/module-map.json']) {
        const original = fs.readFileSync(path.join(root, filename), 'utf8');
        for (const value of [null, [], false, 42, 'invalid']) {
            write(filename, JSON.stringify(value));
            const result = verify();
            assert.ok(result.errors.some((error) => error.includes(`${filename} 必須是非 null JSON object`)), `${filename}: ${JSON.stringify(value)}`);
        }
        write(filename, '');
        assert.ok(verify().errors.some((error) => error.includes(`${filename} 不是有效 JSON`)));
        write(filename, original);
    }
    assert.deepEqual(verify().errors, []);
});

test('module-map sections and package scripts require objects and malformed values report errors', (t) => {
    const { write, verify, map, root } = fixture(t);
    for (const field of ['modules', 'files']) {
        for (const value of [null, [], false, 'invalid']) {
            write('docs/module-map.json', JSON.stringify({ ...map, [field]: value }));
            assert.ok(verify().errors.some((error) => error.includes(`module-map.json ${field} 必須是非 null JSON object`)));
        }
    }
    write('docs/module-map.json', JSON.stringify(map));
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    for (const scripts of [null, [], false, 'invalid']) {
        write('package.json', JSON.stringify({ ...packageJson, scripts }));
        assert.ok(verify().errors.some((error) => error.includes('package.json scripts 必須是非 null JSON object')));
    }
    write('package.json', JSON.stringify({ ...packageJson, scripts: { ...packageJson.scripts, test: [] } }));
    assert.ok(verify().errors.some((error) => error.includes('scripts.test 必須是字串')));
});

test('reference links, same-document anchors and duplicate heading anchors are checked', (t) => {
    const { write, verify } = fixture(t);
    write('README.md', '# 標題\n## 標題\n[one](#標題)\n[two](#標題-1)\n[route][module]\n[module]: docs/modules/runtime.md#入口與資料流\n');
    assert.deepEqual(verify().errors, []);
    assert.deepEqual([...markdownAnchors('# A `code`\n# A `code`\n```md\n# hidden\n```\n')], ['a-code', 'a-code-1']);
});

test('missing npm scripts and source paths fail', (t) => {
    const { write, verify } = fixture(t);
    write('README.md', '`npm run nonexistent`\n`src/missing.js`\n');
    const errors = verify().errors.join('\n');
    assert.match(errors, /npm script 不存在 nonexistent/);
    assert.match(errors, /路徑不存在 src\/missing.js/);
});

test('undocumented tests and stale test registrations fail without discovering fixtures as tests', (t) => {
    const { write, verify, map } = fixture(t);
    write('src/new.test.js', '// new test');
    write('tests/fixtures/example.js', '// non-test fixture');
    map.files['src/new.test.js'] = { owner: 'runtime', sharedWith: [] };
    map.files['tests/fixtures/example.js'] = { owner: 'runtime', sharedWith: [] };
    write('docs/module-map.json', JSON.stringify(map));
    write('package.json', JSON.stringify({ scripts: { test: 'node --test tests/entry.test.js tests/stale.test.js', 'verify:docs': 'node scripts/verify-docs.js' } }));
    const errors = verify().errors.join('\n');
    assert.match(errors, /測試未登錄 npm test：src\/new.test.js/);
    assert.match(errors, /登錄不存在的測試：tests\/stale.test.js/);
    assert.doesNotMatch(errors, /測試未登錄.*fixtures/);
});

test('module map requires every source, helper and script plus valid owner/sharedWith', (t) => {
    const { write, verify, map } = fixture(t);
    write('scripts/tool.mjs', '// tool');
    map.files['src/entry.js'] = { owner: 'missing', sharedWith: ['unknown'] };
    map.files['tests/entry.test.js'].sharedWith = ['runtime'];
    write('docs/module-map.json', JSON.stringify(map));
    const errors = verify().errors.join('\n');
    assert.match(errors, /檔案未指定模組歸屬：scripts\/tool.mjs/);
    assert.match(errors, /無效的 owner：src\/entry.js/);
    assert.match(errors, /無效的 sharedWith：src\/entry.js/);
    assert.match(errors, /無效的 sharedWith：tests\/entry.test.js/);
});

test('AGENTS size limit counts UTF-8 bytes', (t) => {
    const { write, verify } = fixture(t);
    write('AGENTS.md', '字'.repeat(2731));
    assert.match(verify().errors.join('\n'), /AGENTS.md 超過 8 KiB/);
    write('AGENTS.md', 'a'.repeat(8192));
    assert.deepEqual(verify().errors, []);
});

test('command table rejects missing, stale, duplicate and invalid marker entries', (t) => {
    const { write, verify } = fixture(t);
    write('ChihuahuaKing_Manual.md', '<!-- command-manifest:start -->\n| `/help` | alias |\n| `/help` | duplicate |\n| `/投票` | helpOnly |\n<!-- command-manifest:end -->');
    const errors = verify().errors.join('\n');
    assert.match(errors, /缺少正式指令：\/幫助/);
    assert.match(errors, /包含非正式指令：\/投票/);
    assert.match(errors, /有重複入口/);
    assert.throws(() => documentedCommandNames('# no markers'), /必須包含一組/);
});

test('actual builder includes aliases and skips helpOnly without logger import mutations', (t) => {
    const { root, write } = fixture(t);
    write('src/utils/logger.js', "throw new Error('logger must not run');");
    write('src/commands/general/help.js', "import { logger } from '../../utils/logger.js';\nexport const data = { toJSON: () => ({ name: '幫助' }) };\nexport const aliases = [{ toJSON: () => ({ name: 'help' }) }];\nexport const execute = () => logger.info('fixture');");
    write('src/commands/general/hidden.js', "export const helpOnly = true;\nexport const data = { toJSON: () => ({ name: '投票' }) };\nexport const execute = () => {};\n");
    assert.deepEqual(readCommandNames(root).sort(), ['help', '幫助'].sort());
    assert.equal(fs.existsSync(path.join(root, 'logs')), false);
    write('src/commands/general/stale.js', "export const data = { toJSON: () => ({ name: 'volume' }) }; export const execute = () => {};\n");
    assert.throws(() => readCommandNames(root), /唯讀隔離環境/);
});

test('manifest subprocess blocks filesystem writes, secret reads and network calls', (t) => {
    const { root, write } = fixture(t);
    write('src/commands/general/unsafe.js', "import fs from 'node:fs'; fs.writeFileSync('unexpected.txt', 'x'); export const data = { toJSON: () => ({name: '幫助'}) };\n");
    assert.throws(() => readCommandNames(root), /唯讀隔離環境/);
    assert.equal(fs.existsSync(path.join(root, 'unexpected.txt')), false);
    write('private.txt', 'synthetic secret');
    write('src/commands/general/unsafe.js', "import fs from 'node:fs'; fs.readFileSync('private.txt'); export const data = { toJSON: () => ({name: '幫助'}) };\n");
    assert.throws(() => readCommandNames(root), /唯讀隔離環境/);
    write('src/commands/general/unsafe.js', "await fetch('https://example.invalid'); export const data = { toJSON: () => ({name: '幫助'}) };\n");
    assert.throws(() => readCommandNames(root), /唯讀隔離環境/);
    write('src/commands/general/unsafe.js', "import dns from 'node:dns'; dns.lookup('example.invalid', () => {}); export const data = { toJSON: () => ({name: '幫助'}) };\n");
    assert.throws(() => readCommandNames(root), /唯讀隔離環境/);
    write('src/commands/general/unsafe.js', "import dgram from 'node:dgram'; dgram.createSocket('udp4'); export const data = { toJSON: () => ({name: '幫助'}) };\n");
    assert.throws(() => readCommandNames(root), /唯讀隔離環境/);
});

test('local links cannot escape the project and sensitive files cannot supply anchors', (t) => {
    const { write, verify } = fixture(t);
    write('data/private.md', '# Private');
    write('README.md', '[escape](../../outside.md)\n[private](data/private.md#private)\n');
    const errors = verify().errors.join('\n');
    assert.match(errors, /越出專案範圍/);
    assert.match(errors, /僅可驗證文件目錄內 Markdown anchor/);
});
