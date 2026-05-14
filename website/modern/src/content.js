export const project = {
  name: 'nea-quickjs',
  tagline: 'QuickJS-ng as the primary JavaScript platform for classic AmigaOS.',
  version: '0.173',
  versionDate: '24.4.2026',
  runtime: 'QuickJS-ng 0.12.1',
  targets: ['020 soft', '020 FPU', '040 soft', '040 FPU', '060 soft', '060 FPU'],
};

export const stats = [
  { label: 'Library API', value: 'QJS_*', detail: 'AmigaOS shared-library ABI with LVO entry points' },
  { label: 'CLI size', value: '~75 KB', detail: 'qjs is a thin shell around quickjs.library' },
  { label: 'Engine home', value: 'LIBS:', detail: 'copy a variant as LIBS:quickjs.library' },
  { label: 'Validation', value: '221/221', detail: 'recorded full post-library AmigaOS pass' },
];

export const pillars = [
  {
    title: 'Library-first runtime',
    body: 'The product is quickjs.library. The CLI opens it like any other Amiga application, and native programs can embed the same JavaScript engine through proto/pragmas and QJS_* calls.',
  },
  {
    title: 'Amiga-native integration',
    body: 'dos.library, exec.library, bsdsocket.library, AmiSSL, timer.device, Intuition, Graphics, ASL, Diskfont, GadTools, and Reaction are exposed through practical JavaScript wrappers.',
  },
  {
    title: 'Useful Node compatibility',
    body: 'The port favors scripts people actually run: Buffer, EventEmitter, process, fs, path, util, URL, timers, streams, readline, querystring, crypto, fetch, and child_process subsets.',
  },
  {
    title: 'Retro hardware aware',
    body: 'Soft-float and FPU builds, stack checks, Amiga path handling, S: startup/config files, console CSI translation, and careful SAS/C workarounds keep the platform realistic on old machines.',
  },
];

export const modules = [
  { name: 'Runtime', items: ['REPL', 'ES modules', 'std/os/bjson', 'startup scripts', 'object inspection'] },
  { name: 'Node-style', items: ['Buffer', 'EventEmitter', 'process', 'fs', 'path', 'util', 'stream', 'readline'] },
  { name: 'Web APIs', items: ['fetch', 'Headers', 'AbortController', 'URL', 'URLSearchParams', 'TextEncoder', 'crypto.subtle'] },
  { name: 'Amiga APIs', items: ['Intuition', 'Reaction', 'Exec', 'Dos', 'Graphics', 'ASL', 'Diskfont', 'GadTools'] },
];

export const timeline = [
  ['0.070', 'Worker API and library-side async primitive.'],
  ['0.082', 'Buffer lands as the first major Node compatibility layer.'],
  ['0.091', 'WebCrypto digest and random helpers appear.'],
  ['0.121', 'Readline and readline/promises subset.'],
  ['0.148', 'Comprehensive Reaction gadget and image wrappers.'],
  ['0.173', 'Current tracked source: refined Page, Slider, Scroller, and ClickTab behavior.'],
];

export const examples = {
  cli: `stack 65536
qjs -e "print(100 + 110)"
qjs examples/window_hello.js`,
  node: `console.time('hash');
let bytes = new TextEncoder().encode('Amiga');
let digest = await crypto.subtle.digest('SHA-256', bytes);
console.timeEnd('hash');
console.log(Buffer.from(digest).toString('hex'));`,
  reaction: `import { Window, Layout, Button, Label, EventKind } from amiga.boopsi;

let win = new Window({
  title: 'QuickJS',
  layout: new Layout({
    orientation: 'vertical',
    children: [
      new Label({ text: 'JavaScript on AmigaOS' }),
      new Button({ id: 1, text: 'Run' }),
      new Button({ id: 2, text: 'Quit' }),
    ],
  }),
});

win.open();
for (let evt of win.events()) {
  if (evt.kind === EventKind.CLOSE_WINDOW || evt.sourceId === 2) break;
}
win.dispose();`,
};

export const docsPages = {
  overview: {
    title: 'Overview',
    kicker: 'Project shape',
    intro: 'nea-quickjs is a QuickJS-ng port that treats AmigaOS as the host platform, not merely as a compilation target.',
    sections: [
      {
        title: 'What ships',
        body: 'The central artifact is quickjs.library. It contains the engine, core modules, Amiga shims, extended JavaScript APIs, FFI, networking, worker primitives, and GUI bindings. The qjs executable is intentionally small and opens the library like any other Amiga client.',
      },
      {
        title: 'Who it is for',
        body: 'Retro developers who want a serious scripting platform on classic AmigaOS: automation, tools, GUI utilities, file processing, network clients, and native applications that embed JavaScript.',
      },
    ],
  },
  install: {
    title: 'Install',
    kicker: 'Runtime setup',
    intro: 'Pick the library variant for the machine, install it as LIBS:quickjs.library, and run qjs with a real stack.',
    sections: [
      {
        title: 'Deployment',
        body: 'Copy one of quickjs.020soft.library, quickjs.020fpu.library, quickjs.040soft.library, quickjs.040fpu.library, quickjs.060soft.library, or quickjs.060fpu.library to LIBS:quickjs.library. Copy c/qjs to C: or another command path drawer.',
        code: `copy libs/quickjs.020soft.library LIBS:quickjs.library
copy c/qjs C:qjs
stack 65536
qjs -e "print(100 + 110)"`,
      },
      {
        title: 'Configuration',
        body: 'S:QJS-Config.txt supplies default CLI flags, one per line. S:QJS-Startup.js is evaluated before REPL or script mode when present.',
      },
      {
        title: 'Source build',
        body: 'The source tree supports building library variants and the CLI from the repo. Current development records packed-decimal library versions in library/vbcc/libraryconfig.h.',
        code: `make lib
make cli
stack 65536
execute tests/run-tests.script`,
      },
    ],
  },
  architecture: {
    title: 'Architecture',
    kicker: 'Library-first design',
    intro: 'The port is organized around AmigaOS shared-library boundaries and the constraints of 68k calling conventions.',
    sections: [
      {
        title: 'Library contents',
        body: 'quickjs.library owns the QuickJS-ng runtime, std/os/bjson modules, file and memory shims, fetch and networking support, worker primitives, FFI bridge, and bundled compatibility layer.',
      },
      {
        title: 'CLI boundary',
        body: 'qjs handles argument parsing, startup/config files, and REPL/script dispatch. It does not become the home for platform features because native applications need the same functionality through OpenLibrary.',
      },
      {
        title: 'ABI rules',
        body: 'The public native API uses QJS_* names. JSValue returns cross as output pointers, JSValueConst parameters usually become pointers, and double values are passed by pointer because the pragma mechanism cannot assign FPU registers portably.',
      },
      {
        title: 'Amiga substitutions',
        body: 'POSIX assumptions are replaced with AmigaOS mechanisms: dos.library for files and process launching, exec.library for tasks/signals/memory, bsdsocket.library for TCP, AmiSSL for TLS and selected crypto, timer.device for timing, and Intuition/Reaction for GUI.',
      },
    ],
  },
  jsapi: {
    title: 'JavaScript APIs',
    kicker: 'Developer surface',
    intro: 'The JavaScript surface combines QuickJS modules, Node-inspired compatibility, web APIs, and Amiga-specific bridges.',
    sections: [
      {
        title: 'Core imports',
        body: 'Use qjs:std and qjs:os for QuickJS-native modules. qjs:net exposes network capability probing.',
        code: `import * as std from 'qjs:std';
import * as os from 'qjs:os';

std.puts('hello\\n');
print(os.platform);`,
      },
      {
        title: 'Node-style APIs',
        body: 'The useful subset includes Buffer, EventEmitter, process, fs, path, util, stream, timers, readline, querystring, assert, console extensions, crypto, URL helpers, and child_process. It is deliberately not a full Node clone.',
      },
      {
        title: 'Web APIs',
        body: 'fetch, Headers, AbortController, AbortSignal, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, queueMicrotask, and crypto.subtle.digest cover many modern scripts without pretending the Amiga is a browser.',
      },
      {
        title: 'Amiga globals',
        body: 'The FFI layer exposes library wrappers, struct wrappers, CEnumeration helpers, tag-list helpers, pointer helpers, and raw call escape hatches for functions that are not wrapped yet.',
      },
    ],
  },
  native: {
    title: 'Native Embedding',
    kicker: 'C API',
    intro: 'Amiga applications can embed JavaScript by opening quickjs.library and calling the QJS_* API.',
    sections: [
      {
        title: 'Minimal pattern',
        body: 'Include the proto header, declare QuickJSBase, open the library, create a runtime and context, evaluate code, then free values and close the library.',
        code: `#include <proto/quickjs.h>

struct Library *QuickJSBase;
QuickJSBase = OpenLibrary("quickjs.library", 0);

JSRuntime *rt = QJS_NewRuntime();
JSContext *ctx = QJS_NewContext(rt);

JSValue result;
QJS_Eval(&result, ctx, "2 + 2", 5, "<input>", 0);`,
      },
      {
        title: 'Why QJS_* differs',
        body: 'The upstream QuickJS C API assumes normal C calls. The Amiga shared-library ABI needs stable register assignments and cannot return 12-byte JSValue structs through the jump table.',
      },
      {
        title: 'Version gates',
        body: 'Callers can request a minimum packed-decimal library version through OpenLibrary. A feature added at 0.070 can be gated by opening version 70.',
      },
    ],
  },
  reaction: {
    title: 'Reaction / BOOPSI',
    kicker: 'Native GUI',
    intro: 'amiga.boopsi wraps Reaction classes as JavaScript objects while preserving the underlying tag-list and event model.',
    sections: [
      {
        title: 'Class coverage',
        body: 'Window, Layout, Page, Button, Label, CheckBox, RadioButton, Slider, Scroller, Integer, StringGadget, Chooser, ClickTab, ListBrowser, Palette, FuelGauge, SpeedBar, requesters, images, TextEditor, and other classes are wrapped.',
      },
      {
        title: 'Events',
        body: 'Window.events() decodes window-class input handling, maps gadget IDs back to JavaScript objects, and upgrades events into semantic kinds such as BUTTON_CLICK, SLIDER_CHANGE, LIST_SELECT, FILE_SELECTED, and CLOSE_WINDOW.',
        code: `for (let evt of win.events()) {
  if (evt.kind === EventKind.CLOSE_WINDOW) break;
  if (evt.kind === EventKind.BUTTON_CLICK) print(evt.sourceId);
}`,
      },
      {
        title: 'Escape hatch',
        body: 'Advanced scripts can drop to amiga.makeTags, amiga.withTags, amiga.openLibrary, amiga.call, peek/poke helpers, and raw LVO constants when a wrapper is not yet available.',
      },
    ],
  },
  examples: {
    title: 'Examples',
    kicker: 'Executable documentation',
    intro: 'The amiga/examples directory demonstrates the platform from console scripts to native GUI applications.',
    sections: [
      {
        title: 'GUI scripts',
        body: 'window_hello.js, drawing_demo.js, reaction_clock_demo.js, settings_panel_demo.js, wizard_demo.js, clicktab_demo.js, listbrowser_demo.js, and calculator_demo.js cover Intuition and Reaction workflows.',
      },
      {
        title: 'System scripts',
        body: 'dir_listing.js, memory_probe.js, timer_demo.js, font_loader.js, keyboard_echo.js, mouse_tracker.js, and screen_info.js cover DOS, Exec, timer.device, Diskfont, keyboard, mouse, and screen inspection.',
      },
      {
        title: 'Run pattern',
        body: 'Run examples with a 64K stack from the amiga directory.',
        code: `stack 65536
qjs examples/settings_panel_demo.js
qjs examples/dir_listing.js DEVS:`,
      },
    ],
  },
  roadmap: {
    title: 'Roadmap',
    kicker: 'Depth before polish',
    intro: 'The project is already useful, but the API surface is still being hardened through emulator and real-hardware feedback.',
    sections: [
      {
        title: 'Strong areas',
        body: 'Library architecture, CLI, REPL, module loading, std/os/bjson, file I/O, Node-style common APIs, and Reaction wrappers have substantial implementation and examples.',
      },
      {
        title: 'Partial areas',
        body: 'Full Node parity, full stream backpressure, raw socket APIs, SHA-384/SHA-512 without AmiSSL, and server-style daemon APIs remain intentionally limited or future work.',
      },
      {
        title: 'Next work',
        body: 'Continue child_process and worker-backed async work, broaden native plugin/module discovery, harden fetch across real stacks, and validate Reaction classes across OS and hardware variants.',
      },
    ],
  },
};

export const navPages = [
  ['overview', 'Overview'],
  ['install', 'Install'],
  ['architecture', 'Architecture'],
  ['jsapi', 'JS APIs'],
  ['native', 'Native API'],
  ['reaction', 'Reaction'],
  ['examples', 'Examples'],
  ['roadmap', 'Roadmap'],
];
