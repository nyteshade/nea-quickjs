#!/usr/bin/env node
/* harness.js - run the REPL's line editor against a model console.
 *
 *   node tools/repl-harness/harness.js [path/to/repl.js] [-v]
 *
 * There is no interactive console under vamos, so the editing code in
 * quickjs-master/repl.js cannot be exercised on the Mac the normal way.
 * This loads repl.js itself (the file, unmodified, minus its three import
 * lines) under node with stand-ins for qjs:std and qjs:os, feeds it key
 * presses, and renders everything it writes with the console model in
 * terminal.js. After every key press the line under edit must be on the
 * screen exactly as the editor holds it, with the cursor where the editor
 * thinks it is; at Enter the text evaluated must be the text displayed.
 *
 * Each scenario runs with colours off (the Amiga default: NO_COLOR is
 * treated as set unless qjs is started with --color) and with colours on,
 * at both right-margin behaviours, and with and without a width report
 * from the console.
 *
 * Prints PASS/FAIL lines and a final count; exit status 1 on any failure.
 * -v also prints the screen and the byte stream of each scenario.
 *
 * What this cannot show: how a real console (ViNCEd, the standard
 * AmigaShell window) treats the same bytes. The model follows the
 * console.device documentation; the last check is by eye on an Amiga.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Terminal } = require('./terminal.js');

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const replPath = args.find((arg) => arg !== '-v') ||
    path.join(__dirname, '..', '..', 'quickjs-master', 'repl.js');

/* Keys as the library hands them to repl.js: os.read on the Amiga turns
 * the console's one-byte CSI (9B) into ESC [ (amiga_read_stdin in
 * quickjs-libc.c). */
const KEY = {
    enter: '\r',
    up: '\x1b[A',
    down: '\x1b[B',
    right: '\x1b[C',
    left: '\x1b[D',
    backspace: '\x08',
    delete: '\x1b[3~',
    home: '\x01',
    end: '\x05',
    killLine: '\x0b',
    shiftLeft: '\x1b[ A',
    shiftRight: '\x1b[ @',
    shiftUp: '\x1b[T',
    shiftDown: '\x1b[S',
    help: '\x1b[?~',
    f1: '\x1b[0~',
    /* sent by the console itself, not by a key (RKRM Devices, console
     * chapter): Right-Amiga-V with ConClip running, and a window bounds
     * report arriving late */
    pasteRequest: '\x1b[0 v',
    boundsReport: '\x1b[1;1;30;77 r',
};

/**
 * Show control characters in a byte stream.
 * @param {string} text raw output
 * @returns {string} the same with ESC and friends spelled out
 */
function visible(text) {
    return text.replace(/[\x00-\x1f\x7f-\x9f]/g, (character) => {
        const code = character.charCodeAt(0);
        if (code === 0x1b) return '<ESC>';
        if (code === 0x0a) return '<LF>';
        if (code === 0x08) return '<BS>';
        return '<' + code.toString(16).padStart(2, '0') + '>';
    });
}

/**
 * Start a REPL on a fresh model console.
 * @param {{columns?: number, rows?: number, wrap?: 'immediate'|'deferred',
 *          colors?: boolean, reportWidth?: boolean}} options
 *     console size, margin behaviour, whether colours are on, and whether
 *     the console answers the window size request
 * @returns {{terminal: Terminal, evaluated: string[],
 *            press: function(string): Promise<void>,
 *            line: function(): string}} the running session
 */
function startRepl(options) {
    const columns = options.columns || 80;
    const terminal = new Terminal(columns, options.rows || 24, { wrap: options.wrap });
    /** @type {string[]} */
    const evaluated = [];
    /** @type {number[]} */
    const input = [];
    /** @type {?function(): void} */
    let readHandler = null;

    const std = {
        puts: (text) => terminal.write(String(text)),
        out: { flush: () => {} },
        in: { fileno: () => 0 },
        getenv: (name) => (name === 'NO_COLOR' ? (options.colors ? '0' : '1') : undefined),
        loadFile: () => null,
        open: () => null,
        gc: () => {},
        exit: () => {},
        loadScript: () => {},
        __printObject: (value) => terminal.write(String(value)),
        evalScript: (expression) => {
            evaluated.push(expression);
            try {
                return { value: (0, eval)(expression) };
            } catch (error) {
                /* QuickJS stacks end with a newline; node's do not, and
                 * the prompt must start on a fresh row */
                const failure = new Error(error.message);
                failure.stack = '    at <eval> (<evalScript>:1:1)\n';
                throw failure;
            }
        },
    };
    const os = {
        SIGINT: 2,
        platform: 'amiga',
        isatty: () => true,
        /* null is what the library returns when the console does not
         * answer the window status request within 250 ms */
        ttyGetWinSize: () => (options.reportWidth === false ? null : [columns, options.rows || 24]),
        ttySetRaw: () => {},
        signal: () => {},
        now: () => Date.now(),
        stat: () => [null, 2],
        setReadHandler: (fd, handler) => { readHandler = handler; },
        read: (fd, buffer, offset, length) => {
            const bytes = new Uint8Array(buffer, offset, length);
            let count = 0;
            while (count < length && input.length)
                bytes[count++] = input.shift();
            return count;
        },
    };

    const source = fs.readFileSync(replPath, 'utf8')
        .replace(/^import \* as (std|os|bjson) from "qjs:\1";$/gm, '');
    if (/^import /m.test(source))
        throw new Error('repl.js has an import this harness does not provide');
    const globals = Object.create(globalThis);
    new Function('std', 'os', 'bjson', 'globalThis', source)(std, os, {}, globals);

    return {
        terminal,
        evaluated,
        /**
         * Press one key: its bytes arrive in one read, as from a real
         * console, and the REPL finishes any evaluation it starts.
         * @param {string} key the bytes the key sends
         * @returns {Promise<void>}
         */
        async press(key) {
            for (const byte of Buffer.from(key, 'latin1'))
                input.push(byte);
            while (input.length)
                readHandler();
            await new Promise((resolve) => setImmediate(resolve));
        },
        /**
         * The line being edited as the screen shows it: everything from
         * the last prompt to the end of the display, rows joined (a long
         * line continues on the next row).
         * @returns {string} prompt and text
         */
        line() {
            const rows = terminal.grid.map((row) => row.join(''));
            let first = rows.length - 1;
            while (first > 0 && !rows[first].startsWith('qjs > '))
                first--;
            return rows.slice(first).join('').replace(/ +$/, '');
        },
    };
}

let passed = 0;
let failed = 0;

/**
 * Record one check.
 * @param {string} label what was checked
 * @param {boolean} ok whether it held
 * @param {string} [detail] shown after a failure
 * @returns {void}
 */
function check(label, ok, detail) {
    if (ok) {
        passed++;
        console.log('PASS ' + label);
    } else {
        failed++;
        console.log('FAIL ' + label + (detail ? '\n     ' + detail : ''));
    }
}

/**
 * What a line editor must hold after some keys: the oracle the REPL is
 * compared with. It knows nothing about the screen.
 */
class ReferenceEditor {
    constructor() {
        /** @type {string} the line under edit */
        this.text = '';
        /** @type {number} cursor position within it */
        this.cursor = 0;
        /** @type {string[]} lines entered so far */
        this.history = [];
        /** @type {number} which history entry is shown; history.length = none */
        this.index = 0;
        /** @type {string} the unfinished line, kept while browsing history */
        this.draft = '';
        /** @type {?string} the line most recently entered */
        this.entered = null;
    }

    /**
     * @param {string} character one character
     * @returns {boolean} whether it is part of a word
     */
    static isWord(character) {
        return /^[A-Za-z0-9_$]$/.test(character);
    }

    /**
     * Apply one key.
     * @param {string} key an entry of KEY, or one typed character
     * @returns {void}
     */
    press(key) {
        const { text, cursor } = this;
        switch (key) {
        case KEY.enter:
            this.entered = text;
            if (text.trimEnd())
                this.history.push(text.trimEnd());
            this.index = this.history.length;
            this.text = '';
            this.cursor = 0;
            break;
        case KEY.up:
            if (this.index > 0) {
                if (this.index === this.history.length)
                    this.draft = text;
                this.index--;
                this.text = this.history[this.index];
                this.cursor = this.text.length;
            }
            break;
        case KEY.down:
            if (this.index < this.history.length) {
                this.index++;
                this.text = this.index === this.history.length ? this.draft : this.history[this.index];
                this.cursor = this.text.length;
            }
            break;
        case KEY.left:
            this.cursor = Math.max(0, cursor - 1);
            break;
        case KEY.right:
            this.cursor = Math.min(text.length, cursor + 1);
            break;
        case KEY.home:
            this.cursor = 0;
            break;
        case KEY.end:
            this.cursor = text.length;
            break;
        case KEY.backspace:
            if (cursor > 0) {
                this.text = text.slice(0, cursor - 1) + text.slice(cursor);
                this.cursor = cursor - 1;
            }
            break;
        case KEY.delete:
            this.text = text.slice(0, cursor) + text.slice(cursor + 1);
            break;
        case KEY.killLine:
            this.text = text.slice(0, cursor);
            break;
        case KEY.shiftLeft: {
            let at = cursor;
            while (at > 0 && !ReferenceEditor.isWord(text[at - 1])) at--;
            while (at > 0 && ReferenceEditor.isWord(text[at - 1])) at--;
            this.cursor = at;
            break;
        }
        case KEY.shiftRight: {
            let at = cursor;
            while (at < text.length && !ReferenceEditor.isWord(text[at])) at++;
            while (at < text.length && ReferenceEditor.isWord(text[at])) at++;
            this.cursor = at;
            break;
        }
        case KEY.shiftUp:
        case KEY.shiftDown:
        case KEY.help:
        case KEY.f1:
        case KEY.pasteRequest:
        case KEY.boundsReport:
            break;      /* keys with no editing function change nothing */
        default:
            this.text = text.slice(0, cursor) + key + text.slice(cursor);
            this.cursor = cursor + key.length;
        }
    }
}

/**
 * Split typed text into single-character keys.
 * @param {string} text what to type
 * @returns {string[]} one entry per character
 */
function type(text) {
    return text.split('');
}

/**
 * @param {string} key one key
 * @param {number} count how many times
 * @returns {string[]} the key repeated
 */
function repeat(key, count) {
    return new Array(count).fill(key);
}

const LONG_LINE = 'var s = "0123456789012345678901234567890123456789012345678901234567890"';

/* A scenario is a list of keys. After every key the screen is compared
 * with the reference editor; at every Enter, the evaluated text too. */
const SCENARIOS = [
    {
        name: 'recall a line, move left, insert (the reported case)',
        keys: [
            ...type("new URL('www.amiga.org')"), KEY.enter,
            KEY.up, ...repeat(KEY.left, 15), ...type('https://'), KEY.enter,
        ],
    },
    {
        name: 'type, backspace, retype',
        keys: [
            ...type('var answer = 41'), KEY.backspace, '2',
            ...repeat(KEY.backspace, 4), ...type('= 6 * 7'), KEY.enter,
        ],
    },
    {
        name: 'delete in the middle, home, end, kill to end of line',
        keys: [
            ...type('print("hello world")'), ...repeat(KEY.left, 8),
            ...repeat(KEY.delete, 6), KEY.home, ...type('1, '), KEY.end,
            ...type(', 2'), ...repeat(KEY.left, 3), KEY.killLine,
            ...repeat(KEY.right, 4), KEY.enter,
        ],
    },
    {
        name: 'history up and down between lines of different length',
        keys: [
            ...type('1 + 1'), KEY.enter,
            ...type('"a much longer line than the first one".length'), KEY.enter,
            KEY.up, KEY.up, KEY.down, KEY.up, KEY.left, KEY.left, '2', KEY.enter,
            ...type('unfinished'), KEY.up, KEY.down, ...repeat(KEY.backspace, 3), KEY.enter,
        ],
    },
    {
        name: 'a line longer than the window: edit across the right margin',
        columns: 40,
        keys: [
            ...type(LONG_LINE), ...repeat(KEY.left, 50), 'X', 'Y',
            ...repeat(KEY.right, 30), KEY.backspace, KEY.home, KEY.delete,
            KEY.end, ...repeat(KEY.left, 33), ...repeat(KEY.backspace, 10),
            KEY.end, KEY.enter,
            KEY.up, ...repeat(KEY.left, 45), KEY.killLine, '"', KEY.enter,
        ],
    },
    {
        name: 'a line that ends exactly at the right margin',
        columns: 40,
        keys: [
            /* the prompt is 6 wide: 34 characters fill the row */
            ...type('"123456789012345678901234567890" +'), ' ', '1',
            KEY.backspace, KEY.backspace, KEY.left, KEY.left, 'x',
            KEY.end, ...type(' 7'), KEY.home, KEY.end, KEY.enter,
        ],
    },
    {
        name: 'Amiga shifted cursor keys, Help, F1 and console reports do not insert letters',
        keys: [
            ...type('alpha beta'), KEY.shiftLeft, KEY.shiftRight, KEY.help,
            KEY.f1, KEY.shiftUp, KEY.shiftDown, KEY.pasteRequest,
            KEY.boundsReport, KEY.shiftLeft, KEY.shiftLeft,
            '_', KEY.enter,
        ],
    },
];

/**
 * Run one scenario on one console configuration.
 * @param {object} scenario an entry of SCENARIOS
 * @param {{wrap: 'immediate'|'deferred', colors: boolean, reportWidth: boolean}} config
 * @returns {Promise<void>}
 */
async function runScenario(scenario, config) {
    const session = startRepl({
        columns: scenario.columns || 80,
        wrap: config.wrap,
        colors: config.colors,
        /* without a width report the REPL assumes 80 columns, so that
         * case is only meaningful on an 80 column console */
        reportWidth: scenario.columns ? true : config.reportWidth,
    });
    const columns = scenario.columns || 80;
    const label = scenario.name + ' [' + (config.colors ? 'colours' : 'plain') + ', ' +
        config.wrap + ' wrap' + (config.reportWidth ? '' : ', no width report') + ']';
    /** @type {string[]} */
    const problems = [];
    const reference = new ReferenceEditor();
    let pressed = '';

    for (const key of scenario.keys) {
        await session.press(key);
        reference.press(key);
        pressed += key;
        if (problems.length >= 3)
            continue;       /* the first few differences say enough */

        if (key === KEY.enter) {
            const last = session.evaluated[session.evaluated.length - 1];
            if (last !== reference.entered)
                problems.push('evaluated "' + last + '", expected "' + reference.entered + '"');
            continue;
        }
        /* trailing blanks cannot be seen; the cursor check covers them */
        const expected = ('qjs > ' + reference.text).replace(/ +$/, '');
        const at = 6 + reference.cursor;
        const row = session.terminal.grid.map((r) => r.join(''))
            .findLastIndex((text) => text.startsWith('qjs > '));
        if (session.line() !== expected)
            problems.push('after ' + visible(pressed.slice(-24)) + ': screen shows "' +
                          session.line() + '", expected "' + expected + '"');
        else if (session.terminal.y !== row + Math.floor(at / columns) ||
                 session.terminal.x !== at % columns)
            problems.push('after ' + visible(pressed.slice(-24)) + ': cursor at row+' +
                          (session.terminal.y - row) + ' column ' + session.terminal.x +
                          ', expected row+' + Math.floor(at / columns) + ' column ' + (at % columns));
    }
    if (session.terminal.unknown.length)
        problems.push('sequences the console model does not know: ' +
                      session.terminal.unknown.join(', '));

    check(label, problems.length === 0, problems.join('\n     '));
    if (verbose) {
        console.log('     screen:');
        for (const line of session.terminal.screen())
            console.log('     | ' + line);
        console.log('     bytes: ' + visible(session.terminal.log));
    }
}

const only = process.env.SCENARIO;

(async () => {
    for (const scenario of SCENARIOS.filter((s) => !only || s.name.includes(only)))
        for (const colors of [false, true])
            for (const wrap of ['immediate', 'deferred'])
                for (const reportWidth of [true, false]) {
                    if (!reportWidth && scenario.columns)
                        continue;
                    await runScenario(scenario, { wrap, colors, reportWidth });
                }
    console.log(passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
