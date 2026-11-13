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
 * After the scenarios come the cases a list of keys cannot describe:
 * a paste of several lines, input over several lines, completion, Enter
 * with the cursor in the middle of a long line, and leaving the REPL
 * (see CASES).
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
    /* the Amiga's Del key sends 7F (its backspace key sends 08); the
     * VT220 sequence is what other terminals send for it */
    delete: '\x7f',
    vtDelete: '\x1b[3~',
    home: '\x01',
    end: '\x05',
    /* Home and End of a 101-key keyboard (RKRM Devices, console
     * chapter, special key reports) */
    homeKey: '\x1b[44~',
    endKey: '\x1b[45~',
    killLine: '\x0b',
    killWordBack: '\x17',
    killWord: '\x1bd',
    yank: '\x19',
    tab: '\t',
    controlC: '\x03',
    controlD: '\x04',
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
    /** @type {number[]} */
    const input = [];
    const terminal = new Terminal(columns, options.rows || 24, {
        wrap: options.wrap,
        /* what the console says arrives like key presses */
        reply: (text) => {
            for (const byte of Buffer.from(text, 'latin1'))
                input.push(byte);
        },
    });
    /** @type {string[]} */
    const evaluated = [];
    /** @type {?function(): void} */
    let readHandler = null;
    /** @type {?number} the status std.exit was called with */
    let exitStatus = null;

    const std = {
        puts: (text) => terminal.write(String(text)),
        out: { flush: () => {} },
        in: { fileno: () => 0 },
        getenv: (name) => (name === 'NO_COLOR' ? (options.colors ? '0' : '1') : undefined),
        loadFile: () => null,
        open: () => null,
        gc: () => {},
        exit: (status) => { exitStatus = status; },
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
        ttyGetWinSize: () => (options.reportWidth === false ? null
                              : [terminal.columns, terminal.rows]),
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

    /**
     * Let the REPL read everything that is waiting, and finish any
     * evaluation it starts. An evaluation ends in a later turn of the
     * event loop, and may leave more to read (a paste of several
     * lines), so this goes round until nothing is left.
     * @returns {Promise<void>}
     */
    async function settle() {
        do {
            while (input.length && readHandler)
                readHandler();
            await new Promise((resolve) => setImmediate(resolve));
        } while (input.length && readHandler);
    }

    return {
        terminal,
        evaluated,
        /** @returns {?number} the status the REPL exited with, or null */
        exitStatus: () => exitStatus,
        /** @returns {boolean} whether the REPL still reads the console */
        reading: () => readHandler !== null,
        /**
         * Press one key: its bytes arrive in one read, as from a real
         * console, and the REPL finishes any evaluation it starts.
         * @param {string} key the bytes the key sends
         * @returns {Promise<void>}
         */
        async press(key) {
            for (const byte of Buffer.from(key, 'latin1'))
                input.push(byte);
            await settle();
        },
        /**
         * Change the width of the console window.
         * @param {number} newColumns the new width in characters
         * @returns {Promise<void>}
         */
        async resize(newColumns) {
            terminal.resize(newColumns);
            await settle();
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
        /** @type {string} what the last kill removed, for yank */
        this.killed = '';
        /** @type {number} direction of the last key if it was a kill, else 0 */
        this.lastKill = 0;
    }

    /**
     * Remove part of the line into the kill buffer. Kills that follow
     * one another add up, as in every readline.
     * @param {number} start first character removed
     * @param {number} end one past the last
     * @param {number} direction 1 forwards, -1 backwards
     * @returns {void}
     */
    kill(start, end, direction) {
        const piece = this.text.slice(start, end);
        if (!this.lastKill)
            this.killed = piece;
        else if (direction < 0)
            this.killed = piece + this.killed;
        else
            this.killed += piece;
        this.text = this.text.slice(0, start) + this.text.slice(end);
        this.cursor = start;
        this.nextKill = direction;
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
        this.nextKill = 0;
        this.apply(key, text, cursor);
        this.lastKill = this.nextKill;
    }

    /**
     * @param {string} key the key
     * @param {string} text the line before it
     * @param {number} cursor the cursor before it
     * @returns {void}
     */
    apply(key, text, cursor) {
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
        case KEY.homeKey:
            this.cursor = 0;
            break;
        case KEY.end:
        case KEY.endKey:
            this.cursor = text.length;
            break;
        case KEY.backspace:
            if (cursor > 0) {
                this.text = text.slice(0, cursor - 1) + text.slice(cursor);
                this.cursor = cursor - 1;
            }
            break;
        case KEY.delete:
        case KEY.vtDelete:
            this.text = text.slice(0, cursor) + text.slice(cursor + 1);
            break;
        case KEY.killLine:
            this.kill(cursor, text.length, 1);
            break;
        case KEY.killWordBack:
            this.kill(this.wordStart(cursor), cursor, -1);
            break;
        case KEY.killWord:
            this.kill(cursor, this.wordEnd(cursor), 1);
            break;
        case KEY.yank:
            this.text = text.slice(0, cursor) + this.killed + text.slice(cursor);
            this.cursor = cursor + this.killed.length;
            break;
        case KEY.shiftLeft:
            this.cursor = this.wordStart(cursor);
            break;
        case KEY.shiftRight:
            this.cursor = this.wordEnd(cursor);
            break;
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

    /**
     * @param {number} from a position in the line
     * @returns {number} the start of the word at or before it
     */
    wordStart(from) {
        let at = from;
        while (at > 0 && !ReferenceEditor.isWord(this.text[at - 1])) at--;
        while (at > 0 && ReferenceEditor.isWord(this.text[at - 1])) at--;
        return at;
    }

    /**
     * @param {number} from a position in the line
     * @returns {number} the end of the word at or after it
     */
    wordEnd(from) {
        let at = from;
        while (at < this.text.length && !ReferenceEditor.isWord(this.text[at])) at++;
        while (at < this.text.length && ReferenceEditor.isWord(this.text[at])) at++;
        return at;
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
        name: 'Del deletes under the cursor, backspace before it (Amiga keys 7F and 08)',
        keys: [
            ...type('abcdef'), ...repeat(KEY.left, 3), KEY.delete,
            KEY.backspace, KEY.delete, KEY.vtDelete, KEY.delete, KEY.delete,
            ...type('XY'), KEY.home, KEY.backspace, KEY.delete, KEY.enter,
        ],
    },
    {
        name: 'Home and End keys of a 101-key keyboard',
        keys: [
            ...type('middle'), KEY.homeKey, ...type('start '), KEY.endKey,
            ...type(' end'), KEY.homeKey, KEY.homeKey, KEY.right, KEY.endKey,
            KEY.endKey, '!', KEY.enter,
        ],
    },
    {
        name: 'word movement, kill word, kill line and yank',
        keys: [
            ...type('alpha beta gamma delta'), KEY.shiftLeft, KEY.shiftLeft,
            KEY.killWordBack, KEY.end, KEY.yank, KEY.home, KEY.killWord,
            KEY.killWord, KEY.end, KEY.yank, KEY.shiftLeft, KEY.shiftLeft,
            KEY.shiftRight, KEY.killLine, KEY.home, KEY.yank, KEY.yank,
            KEY.enter,
        ],
    },
    {
        name: 'recall a long line and edit in the middle of it',
        columns: 40,
        keys: [
            ...type(LONG_LINE), KEY.enter,
            KEY.up, ...repeat(KEY.left, 40), ...type('abc'), KEY.delete,
            KEY.backspace, KEY.shiftLeft, KEY.killWord, KEY.end, KEY.yank,
            KEY.home, ...repeat(KEY.right, 36), ...type('1234567'),
            KEY.endKey, KEY.homeKey, KEY.enter,
        ],
    },
    {
        name: 'the window is made narrower, then wider, while a long line is edited',
        columns: 60,
        keys: [
            ...type(LONG_LINE), ...repeat(KEY.left, 20), { resize: 40 },
            'X', KEY.backspace, ...repeat(KEY.left, 30), 'Y', KEY.end,
            { resize: 75 }, 'Z', KEY.home, KEY.delete, { resize: 30 },
            KEY.end, KEY.backspace, KEY.enter,
            ...type('1 + 1'), { resize: 50 }, ...type(' + 1'), KEY.enter,
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
    let columns = scenario.columns || 80;
    const label = scenario.name + ' [' + (config.colors ? 'colours' : 'plain') + ', ' +
        config.wrap + ' wrap' + (config.reportWidth ? '' : ', no width report') + ']';
    /** @type {string[]} */
    const problems = [];
    const reference = new ReferenceEditor();
    let pressed = '';

    for (const key of scenario.keys) {
        if (typeof key === 'object') {
            /* the user resizes the window; the line under edit must
             * then be shown whole at the new width */
            columns = key.resize;
            await session.resize(columns);
            pressed += '<resize ' + columns + '>';
        } else {
            await session.press(key);
            reference.press(key);
            pressed += key;
        }
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


/**
 * The rows of the screen as text, trailing blanks removed.
 * @param {Terminal} terminal the console
 * @returns {string[]} one string per row, top to bottom
 */
function rowsOf(terminal) {
    return terminal.grid.map((row) => row.join('').replace(/ +$/, ''));
}

/**
 * Whether some rows of the screen, joined end to end as a wrapped line
 * is, read exactly `text`.
 * @param {Terminal} terminal the console
 * @param {string} text what should be there, starting at a row's start
 * @returns {boolean}
 */
function showsWrapped(terminal, text) {
    const rows = terminal.grid.map((row) => row.join(''));
    const needed = Math.ceil(text.length / terminal.columns) || 1;
    for (let first = 0; first + needed <= rows.length; first++)
        if (rows.slice(first, first + needed).join('').replace(/ +$/, '') === text)
            return true;
    return false;
}

/* Cases a list of keys and a reference editor cannot describe. Each
 * gets a fresh console of the given kind and returns the problems it
 * found, as text; none means it passed. */
const CASES = [
    {
        name: 'a paste of several lines: each is evaluated, in order, and the last stays on the prompt',
        /**
         * @param {function(object=): object} start starts a session
         * @returns {Promise<string[]>} problems
         */
        async run(start) {
            const session = start();
            const problems = [];
            /* one read, as a paste arrives: three lines, the last unfinished */
            await session.press('var a = 6\rvar b = 7\ra * b\ra +');
            const wanted = ['var a = 6', 'var b = 7', 'a * b'];
            if (session.evaluated.join('|') !== wanted.join('|'))
                problems.push('evaluated ' + JSON.stringify(session.evaluated) +
                              ', expected ' + JSON.stringify(wanted));
            if (session.line() !== 'qjs > a +')
                problems.push('the prompt shows "' + session.line() + '", expected "qjs > a +"');
            const rows = rowsOf(session.terminal);
            const at = (text) => rows.indexOf(text);
            if (!(at('qjs > var a = 6') >= 0 && at('qjs > var b = 7') > at('qjs > var a = 6') &&
                  at('qjs > a * b') > at('qjs > var b = 7') && at('42') === at('qjs > a * b') + 1))
                problems.push('the screen is not each line followed by its result:\n       ' +
                              rows.filter((row) => row).join('\n       '));
            await session.press(' 1\r');
            if (session.evaluated[3] !== 'a + 1')
                problems.push('the unfinished line was evaluated as "' + session.evaluated[3] + '"');
            return problems;
        },
    },
    {
        name: 'input over several lines: continuation prompt, one evaluation, editing on the second line',
        async run(start) {
            const session = start();
            const problems = [];
            await session.press('function twice(n) {\r');
            if (session.evaluated.length)
                problems.push('an unfinished function was evaluated');
            const prompt = rowsOf(session.terminal).filter((row) => row).pop();
            if (!/\.\.\. *$/.test(prompt))
                problems.push('no continuation prompt: the last row is "' + prompt + '"');
            /* type the body wrong, then repair it with the editing keys */
            for (const key of [...type('return n * 3'), KEY.backspace, '2',
                               KEY.home, ...repeat(KEY.right, 4), KEY.end])
                await session.press(key);
            const body = rowsOf(session.terminal).filter((row) => row).pop();
            if (!body.endsWith('return n * 2'))
                problems.push('the second line shows "' + body + '"');
            await session.press('\r}\r');
            /* the REPL indents a continuation line by the nesting depth
             * at its start, which for the last line is still 1 */
            if (session.evaluated.join('|') !== 'function twice(n) {\n    return n * 2\n    }')
                problems.push('evaluated ' + JSON.stringify(session.evaluated));
            await session.press('twice(21)\r');
            if (!rowsOf(session.terminal).includes('42'))
                problems.push('twice(21) did not print 42');
            return problems;
        },
    },
    {
        name: 'Enter with the cursor in the first row of a long line: the result goes below all of it',
        async run(start) {
            const session = start({ columns: 40 });
            const problems = [];
            const text = '"abcdefghij".length + "0123456789012345678901234567890123456789".length';
            for (const key of [...type(text), KEY.home, KEY.right, KEY.enter])
                await session.press(key);
            if (!showsWrapped(session.terminal, 'qjs > ' + text))
                problems.push('the line is no longer whole on the screen:\n       ' +
                              rowsOf(session.terminal).filter((row) => row).join('\n       '));
            if (!rowsOf(session.terminal).includes('50'))
                problems.push('the result 50 is not on a row of its own');
            return problems;
        },
    },
    {
        name: 'Tab completes a name; a second Tab lists the candidates and shows the line again',
        async run(start) {
            const session = start();
            const problems = [];
            for (const key of [...type('Math.ab'), KEY.tab])
                await session.press(key);
            if (session.line() !== 'qjs > Math.abs')
                problems.push('one Tab gave "' + session.line() + '"');
            await session.press(KEY.tab);
            if (session.line() !== 'qjs > Math.abs(')
                problems.push('a second Tab on a function gave "' + session.line() + '"');
            for (const key of [...repeat(KEY.backspace, 3), KEY.tab, KEY.tab])
                await session.press(key);
            const rows = rowsOf(session.terminal).filter((row) => row);
            if (session.line() !== 'qjs > Math.a')
                problems.push('after the list the prompt shows "' + session.line() + '"');
            const list = rows.slice(rows.indexOf('qjs > Math.a') + 1, rows.lastIndexOf('qjs > Math.a'));
            const names = list.join(' ').split(/ +/).filter((name) => name);
            for (const name of ['abs', 'acos', 'atan2'])
                if (!names.includes(name))
                    problems.push('the list does not show ' + name + ': ' + JSON.stringify(list));
            if (session.terminal.x !== 'qjs > Math.a'.length)
                problems.push('the cursor is at column ' + session.terminal.x);
            return problems;
        },
    },
    {
        name: 'Tab twice with the cursor in the first row of a long line: the list goes below all of it',
        async run(start) {
            const session = start({ columns: 40 });
            const problems = [];
            const tail = ' + "012345678901234567890123456789012345678901234567890123"';
            for (const key of [...type('Math.a' + tail), KEY.home, ...repeat(KEY.right, 6),
                               KEY.tab, KEY.tab])
                await session.press(key);
            const line = 'qjs > Math.a' + tail;
            if (session.line() !== line)
                problems.push('after the list the prompt shows "' + session.line() + '"');
            /* the line as it was, whole, above the list */
            const rows = session.terminal.grid.map((row) => row.join(''));
            const first = rows.findIndex((row) => row.startsWith('qjs > '));
            const needed = Math.ceil(line.length / 40);
            if (rows.slice(first, first + needed).join('').replace(/ +$/, '') !== line)
                problems.push('the list was written over the line:\n       ' +
                              rowsOf(session.terminal).filter((row) => row).join('\n       '));
            const at = 6 + 'Math.a'.length;
            const last = rows.findLastIndex((row) => row.startsWith('qjs > '));
            if (session.terminal.y !== last || session.terminal.x !== at)
                problems.push('the cursor is at row+' + (session.terminal.y - last) +
                              ' column ' + session.terminal.x + ', expected row+0 column ' + at);
            return problems;
        },
    },
    {
        name: 'the console is asked for its width only when the window is resized',
        async run(start) {
            const session = start();
            const problems = [];
            for (const key of type('a line of ordinary typing, no resize'))
                await session.press(key);
            if (session.terminal.statusRequests !== 0)
                problems.push(session.terminal.statusRequests +
                              ' window status requests were sent while typing');
            if (!session.terminal.rawEvents.has(12))
                problems.push('the console was not asked to report resizes (CSI 12 {)');
            await session.resize(50);
            if (session.terminal.statusRequests !== 1)
                problems.push(session.terminal.statusRequests +
                              ' window status requests after one resize, expected 1');
            return problems;
        },
    },
    {
        name: 'leaving the REPL (Ctrl-D, or Ctrl-C twice) stops the resize reports',
        async run(start) {
            const problems = [];
            let session = start();
            await session.press(KEY.controlD);
            if (session.terminal.rawEvents.has(12))
                problems.push('after Ctrl-D the console still reports resizes');
            if (session.reading())
                problems.push('after Ctrl-D the REPL still reads the console');
            session = start();
            await session.press(KEY.controlC);
            await session.press(KEY.controlC);
            if (session.terminal.rawEvents.has(12))
                problems.push('after Ctrl-C twice the console still reports resizes');
            if (session.exitStatus() !== 0)
                problems.push('Ctrl-C twice did not exit');
            return problems;
        },
    },
    {
        name: 'a bounds report that arrives late sets the width (no answer at start-up)',
        async run(start) {
            /* the console did not answer in time, so the REPL assumed 80
             * columns on a window of 50; then the answer turns up */
            const session = start({ columns: 50, reportWidth: false });
            const problems = [];
            await session.press('\x1b[1;1;24;50 r');
            for (const key of [...type(LONG_LINE), ...repeat(KEY.left, 30), 'X'])
                await session.press(key);
            const text = LONG_LINE.slice(0, -30) + 'X' + LONG_LINE.slice(-30);
            if (session.line() !== 'qjs > ' + text)
                problems.push('the screen shows "' + session.line() + '"');
            return problems;
        },
    },
];

/**
 * Run one case on one console configuration.
 * @param {object} item an entry of CASES
 * @param {{wrap: 'immediate'|'deferred', colors: boolean}} config
 * @returns {Promise<void>}
 */
async function runCase(item, config) {
    /** @type {object[]} */
    const sessions = [];
    const start = (options) => {
        const session = startRepl(Object.assign({ wrap: config.wrap, colors: config.colors },
                                                options));
        sessions.push(session);
        return session;
    };
    let problems;
    try {
        problems = await item.run(start);
    } catch (error) {
        problems = ['threw: ' + (error && error.stack || error)];
    }
    for (const session of sessions)
        if (session.terminal.unknown.length)
            problems.push('sequences the console model does not know: ' +
                          session.terminal.unknown.join(', '));
    check(item.name + ' [' + (config.colors ? 'colours' : 'plain') + ', ' + config.wrap + ' wrap]',
          problems.length === 0, problems.join('\n     '));
    if (verbose)
        for (const session of sessions) {
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
    for (const item of CASES.filter((c) => !only || c.name.includes(only)))
        for (const colors of [false, true])
            for (const wrap of ['immediate', 'deferred'])
                await runCase(item, { wrap, colors });
    console.log(passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
