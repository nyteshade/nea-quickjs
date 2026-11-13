/* terminal.js - a minimal model of an Amiga console window.
 *
 * It keeps a grid of characters and a cursor and understands the control
 * codes the REPL's line editor writes, with the meaning console.device
 * gives them (sdks/NDK3.2R4/Autodocs/console.doc, "ANSI CODES SUPPORTED"):
 *
 *   BS (08)      cursor left one column, stopping at the left edge
 *   LF (0A)      start of the next line (LNM, linefeed-is-newline, is the
 *                console's default), scrolling at the bottom
 *   CR (0D)      start of the current line
 *   CSI n A/B    cursor up / down, stopping at the edges
 *   CSI n C/D    cursor forward / backward, stopping at the edges
 *   CSI H        cursor to the top left (row;column parameters honoured)
 *   CSI J        erase from the cursor to the end of the display
 *   CSI K        erase from the cursor to the end of the line
 *   CSI n @      insert n blanks at the cursor
 *   CSI n P      delete n characters at the cursor
 *   CSI ... m    colours and styles: accepted and ignored
 *
 * CSI is ESC [ or the single byte 9B. Anything else is recorded in
 * `unknown` so that a test can fail on it.
 *
 * Printable characters overwrite (there is no insert mode). The one place
 * consoles differ is the right margin, so it is an option:
 *
 *   wrap: 'immediate'  after a character lands in the last column the
 *                      cursor is at the start of the next line (the
 *                      Amiga console with auto-wrap on)
 *   wrap: 'deferred'   the cursor stays on the last column until the next
 *                      character arrives (xterm and other VT100s)
 *
 * The line editor has to produce the same screen under both.
 */
'use strict';

class Terminal {
    /**
     * @param {number} columns width of the window in characters
     * @param {number} rows height of the window in characters
     * @param {{wrap?: 'immediate'|'deferred'}} [options] right-margin behaviour
     */
    constructor(columns, rows, options) {
        /** @type {number} */
        this.columns = columns;
        /** @type {number} */
        this.rows = rows;
        /** @type {'immediate'|'deferred'} */
        this.wrap = (options && options.wrap) || 'immediate';
        /** @type {string[][]} one array of single characters per row */
        this.grid = [];
        for (let row = 0; row < rows; row++)
            this.grid.push(this.blankRow());
        /** @type {number} cursor column, 0-based */
        this.x = 0;
        /** @type {number} cursor row, 0-based */
        this.y = 0;
        /** @type {boolean} deferred mode only: a wrap is waiting */
        this.pendingWrap = false;
        /** @type {string[]} control sequences the model does not know */
        this.unknown = [];
        /** @type {string} everything written, for inspection */
        this.log = '';
    }

    /**
     * @returns {string[]} a row of spaces
     */
    blankRow() {
        return new Array(this.columns).fill(' ');
    }

    /**
     * Move to the start of the next line, scrolling at the bottom.
     * @returns {void}
     */
    newLine() {
        this.x = 0;
        this.pendingWrap = false;
        if (this.y === this.rows - 1) {
            this.grid.shift();
            this.grid.push(this.blankRow());
        } else {
            this.y++;
        }
    }

    /**
     * Put one printable character at the cursor and advance.
     * @param {string} character a single character
     * @returns {void}
     */
    put(character) {
        if (this.pendingWrap)
            this.newLine();
        this.grid[this.y][this.x] = character;
        if (this.x < this.columns - 1) {
            this.x++;
        } else if (this.wrap === 'immediate') {
            this.newLine();
        } else {
            this.pendingWrap = true;
        }
    }

    /**
     * Carry out one control sequence.
     * @param {string} parameters the bytes between CSI and the final letter
     * @param {string} final the final letter
     * @returns {void}
     */
    control(parameters, final) {
        const numbers = parameters.split(';').map((text) => parseInt(text, 10));
        const count = Number.isNaN(numbers[0]) || numbers[0] === 0 ? 1 : numbers[0];
        const row = this.grid[this.y];

        /* moving the cursor cancels a waiting wrap; colours do not */
        if ('ABCDH@P'.includes(final))
            this.pendingWrap = false;
        switch (final) {
        case 'A':
            this.y = Math.max(0, this.y - count);
            break;
        case 'B':
            this.y = Math.min(this.rows - 1, this.y + count);
            break;
        case 'C':
            this.x = Math.min(this.columns - 1, this.x + count);
            break;
        case 'D':
            this.x = Math.max(0, this.x - count);
            break;
        case 'H':
            this.y = Math.min(this.rows - 1, count - 1);
            this.x = Math.min(this.columns - 1,
                              (Number.isNaN(numbers[1]) || !numbers[1] ? 1 : numbers[1]) - 1);
            break;
        case 'J':
            for (let x = this.x; x < this.columns; x++)
                row[x] = ' ';
            for (let y = this.y + 1; y < this.rows; y++)
                this.grid[y] = this.blankRow();
            break;
        case 'K':
            for (let x = this.x; x < this.columns; x++)
                row[x] = ' ';
            break;
        case '@':
            row.splice(this.x, 0, ...new Array(count).fill(' '));
            row.length = this.columns;
            break;
        case 'P':
            row.splice(this.x, count);
            while (row.length < this.columns)
                row.push(' ');
            break;
        case 'm':
            break;
        default:
            this.unknown.push('CSI ' + parameters + final);
        }
    }

    /**
     * Write text to the console, as std.puts does.
     * @param {string} text characters and control codes
     * @returns {void}
     */
    write(text) {
        this.log += text;
        for (let i = 0; i < text.length; i++) {
            const character = text[i];
            const code = text.charCodeAt(i);
            const isCsi = code === 0x9b || (code === 0x1b && text[i + 1] === '[');

            if (isCsi) {
                let end = i + (code === 0x9b ? 1 : 2);
                const start = end;
                /* parameter and intermediate bytes, then one final byte */
                while (end < text.length && text.charCodeAt(end) < 0x40)
                    end++;
                this.control(text.substring(start, end), text[end] || '');
                i = end;
            } else if (code === 0x08) {
                this.pendingWrap = false;
                this.x = Math.max(0, this.x - 1);
            } else if (code === 0x0a) {
                this.newLine();
            } else if (code === 0x0d) {
                this.pendingWrap = false;
                this.x = 0;
            } else if (code >= 0x20) {
                this.put(character);
            } else {
                this.unknown.push('control 0x' + code.toString(16));
            }
        }
    }

    /**
     * @returns {string[]} the rows as text, trailing spaces removed, empty
     *     rows at the bottom dropped
     */
    screen() {
        const lines = this.grid.map((row) => row.join('').replace(/ +$/, ''));
        while (lines.length && lines[lines.length - 1] === '')
            lines.pop();
        return lines;
    }
}

module.exports = { Terminal };
