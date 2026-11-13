#!/usr/bin/env python3
"""Check that every example parses and resolves its names.

Usage:
    python3 scripts/check_examples.py                # every example
    python3 scripts/check_examples.py FILE [FILE...] # just these
    python3 scripts/check_examples.py --verbose      # print each output
    python3 scripts/check_examples.py --library amiga/libs/quickjs.040soft.library
    python3 scripts/check_examples.py --past-open    # run on past the
                                                     # open, to the first
                                                     # wait (see below)

Exit status is 1 if any example fails, else 0.

Why this exists: an example that opens a window can only be run on an
Amiga, so a misspelt constant or a wrapper that was renamed stays
unnoticed until somebody tries it there. Two things can be checked on
the build machine, and this does both:

  1. Syntax. Each file is copied to a .mjs and given to `node --check`.

  2. Names. Each file is run by qjs under vamos with
     scripts/check_examples_prelude.js loaded first. vamos has no
     intuition.library; the prelude pretends the missing libraries and
     classes are there and stops the script, with a marker line, at
     the first call that would open a window, screen or requester.
     Everything before that is real: the constant tables, the
     wrappers, the layout tree. The script's clean-up (its `finally`)
     runs as well.

  3. Constants. Every `Library.consts.NAME`, every `X.NAME` where the
     file says `const X = Library.consts;`, and every `EventKind.NAME`
     is looked up in the real table, in one more run under vamos.
     This reaches the names inside the event loop, which step 2 never
     executes: `EventKind.BUTON_CLICK` is simply undefined, so the
     case would never match and nothing would say why.

An example PASSES when it reached the marker, or ended by itself (the
console examples do), and printed nothing that looks like a JavaScript
error. It FAILS on a ReferenceError, TypeError, SyntaxError, a
"has no constant" message, a crash of the emulator, or a timeout.

What this cannot see: anything after the window opens (the event loop,
drawing, what a gadget does), and whether the values passed to the OS
are right. Those need an Amiga.

--past-open goes one step further. The window "opens" as zeroed
memory, the script carries on (it sets its font, paints for the first
time) and is stopped at its first wait for a message. Every size,
border and font metric reads 0 there, so this proves only that the
code between the open and the loop names things that exist and calls
them in a way the wrappers accept. It is a separate mode because an
example may fairly refuse to go on with a window 0 pixels wide.

Needs the same things as perf/measure.sh: a template directory
(perf/.vm, or the one PERF_VM names) with c/qjs and
libs/mathieeedoubbas.library, amitools' vamos, and node.
"""
import concurrent.futures
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXAMPLES = os.path.join(ROOT, 'amiga', 'examples')
HEADERS = os.path.join(ROOT, 'sdks', 'NDK3.2R4', 'Include_H')
PRELUDE = os.path.join(ROOT, 'scripts', 'check_examples_prelude.js')
RUNNER = os.path.join(ROOT, 'perf', 'tools', 'prof.py')
VM = os.environ.get('PERF_VM', os.path.join(ROOT, 'perf', '.vm'))
DEFAULT_LIBRARY = os.path.join(ROOT, 'amiga', 'libs', 'quickjs.020soft.library')

MARKER = 'CHECK-EXAMPLES-OPEN'
TIMEOUT_SECONDS = 180
PARALLEL = 6

# Method IDs the prelude needs: (name, header).
METHOD_IDS = [('WM_OPEN', 'classes/window.h'),
              ('WM_HANDLEINPUT', 'classes/window.h'),
              ('RM_OPENREQ', 'classes/requester.h')]

# Lines of output that mean the script failed. The marker's own error
# ("Error: CHECK-EXAMPLES-OPEN ...") is removed before these are tried.
FAILURES = re.compile(
    r'^\w*Error: '               # any error nothing caught
    r'|ReferenceError|TypeError|SyntaxError|RangeError|InternalError'
    r'|has no constant|is not defined|is not a function'
    r'|not a constructor|Invalid File Lock|Traceback \(most recent'
    r'|unimplemented|Guru|InvalidMemoryAccess|invalid memory')

# vamos's own log lines start with a time stamp.
VAMOS_LOG = re.compile(r'^\d{2}:\d{2}:\d{2}\.\d+ ')


def method_ids():
    """{name: value} for METHOD_IDS, read from the NDK headers."""
    values = {}
    for name, header in METHOD_IDS:
        with open(os.path.join(HEADERS, header), encoding='latin-1') as handle:
            text = handle.read()
        match = re.search(r'^#define\s+%s\s+\(?\s*(0x[0-9A-Fa-f]+|\d+)L?\s*\)?'
                          % re.escape(name), text, re.M)
        if not match:
            sys.exit('check_examples: %s not found in %s' % (name, header))
        values[name] = int(match.group(1), 0)
    return values


def check_syntax(path, work):
    """'' if node accepts the file as a module, else node's message."""
    copy = os.path.join(work, os.path.basename(path)[:-3] + '.mjs')
    shutil.copy(path, copy)
    run = subprocess.run(['node', '--check', copy],
                         capture_output=True, text=True)
    if run.returncode == 0:
        return ''
    return (run.stderr or run.stdout).strip()


def vamos(library, copies, texts, arguments):
    """Run qjs under vamos in a fresh copy of the template directory.

    copies is {name: path of a file to copy in}, texts is {name: text
    of a file to write there}; arguments are qjs's.
    Returns the combined output, or None after TIMEOUT_SECONDS.
    """
    with tempfile.TemporaryDirectory() as work:
        machine = os.path.join(work, 'vm')
        volumes = os.path.join(work, 'vols')
        os.mkdir(volumes)
        shutil.copytree(VM, machine)
        shutil.copy(library, os.path.join(machine, 'libs', 'quickjs.library'))
        for name, source in copies.items():
            shutil.copy(source, os.path.join(machine, name))
        for name, text in texts.items():
            with open(os.path.join(machine, name), 'w') as handle:
                handle.write(text)

        # RAM: is given a directory, because the examples that write a
        # file write it there.
        command = [RUNNER, '-S', '--vols-base-dir', volumes,
                   '-C', os.environ.get('PERF_CPU', '68020'),
                   '-m', '65536', '-H', 'disable', '-s', '2048',
                   '--cwd', 'sys:', '-V', 'sys:' + machine,
                   '-a', 'libs:sys:libs', '-a', 's:sys:s', '-a', 'c:sys:c',
                   '-a', 't:sys:s', '-a', 'ram:sys:s',
                   '-O', 'mathieeedoubbas.library=mode:amiga', '--',
                   'c/qjs'] + arguments
        environment = dict(os.environ)
        environment.pop('PROF_OUT', None)       # no instruction counting
        try:
            run = subprocess.run(command, cwd=machine, env=environment,
                                 stdin=subprocess.DEVNULL,
                                 stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT,
                                 timeout=TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            return None
        return run.stdout.decode('latin-1')


def run_under_vamos(path, library, prelude_text):
    """(status, output) of one example run under vamos.

    status is 'opened' (reached the marker), 'ended' (finished without
    opening anything), or a failure description.
    """
    name = os.path.basename(path)
    output = vamos(library, {name: path}, {'prelude.js': prelude_text},
                   ['-I', 'prelude.js', name])
    if output is None:
        return 'timeout after %d s' % TIMEOUT_SECONDS, ''

    lines = [line for line in output.split('\n')
             if not line.startswith('PROF ')]
    opened = any(line.startswith(MARKER) for line in lines)

    for line in lines:
        if MARKER in line:
            continue
        if VAMOS_LOG.match(line):
            # vamos reports a crash of the emulated program in its log
            # ("libmgr: ERROR: close: unknown lib" is vamos's own, at
            # exit, on every run)
            if 'libmgr:' not in line and re.search(
                    r'ERROR|InvalidMemoryAccess|Traceback', line):
                return 'emulator error: ' + line.strip()[:160], output
            continue
        if FAILURES.search(line):
            return line.strip()[:200], output

    return ('opened' if opened else 'ended'), output


COMMENTS = re.compile(r'/\*.*?\*/|//[^\n]*', re.S)
ALIAS = re.compile(r'\b(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\.consts\s*;')
DIRECT = re.compile(r'\b(\w+)\.consts\.([A-Za-z_]\w*)')
DESTRUCTURED = re.compile(r'\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(\w+)\.consts\s*;')
EVENT_KIND = re.compile(r'\bEventKind\.([A-Z][A-Z0-9_]*)\b')

# Members of a constant table that are not constants.
TABLE_METHODS = {'cases', 'fromPrefix', 'from', 'has', 'name', 'prototype'}


def constant_uses(path):
    """[(table expression, constant name)] for one example."""
    with open(path, encoding='utf-8', errors='replace') as handle:
        text = COMMENTS.sub(' ', handle.read())
    uses = set()
    for owner, name in DIRECT.findall(text):
        uses.add((owner + '.consts', name))
    for names, owner in DESTRUCTURED.findall(text):
        for name in names.split(','):
            name = name.split(':')[0].strip()
            if name:
                uses.add((owner + '.consts', name))
    for alias, owner in ALIAS.findall(text):
        for name in re.findall(r'\b%s\.([A-Za-z_]\w*)' % re.escape(alias), text):
            uses.add((owner + '.consts', name))
    for name in EVENT_KIND.findall(text):
        uses.add(('EventKind', name))
    return sorted(use for use in uses if use[1] not in TABLE_METHODS)


def check_constants_exist(files, library):
    """{path: [message]} for constants an example names that its table
    does not have. One run under vamos looks all of them up."""
    wanted = []
    for path in files:
        for table, name in constant_uses(path):
            wanted.append([os.path.basename(path), table, name])
    script = (
        'const wanted = %s;\n'
        'for (const [file, table, name] of wanted) {\n'
        '  const owner = table === "EventKind" ? EventKind\n'
        '              : globalThis[table.split(".")[0]].consts;\n'
        '  let found;\n'
        '  try { found = owner[name] !== undefined; }\n'
        '  catch (error) { found = false; }\n'
        '  if (!found) print("MISSING " + file + " " + table + "." + name);\n'
        '}\n'
        'print("LOOKED-UP " + wanted.length);\n' % json.dumps(wanted))
    output = vamos(library, {}, {'constants.js': script}, ['constants.js'])
    if output is None or ('LOOKED-UP %d' % len(wanted)) not in output:
        sys.exit('check_examples: the constants run failed:\n%s' % output)
    missing = {}
    for line in output.split('\n'):
        if line.startswith('MISSING '):
            _, name, constant = line.split(' ', 2)
            missing.setdefault(name, []).append(constant.strip()
                                                + ' does not exist')
    return missing, len(wanted)


def main(argv):
    verbose = '--verbose' in argv
    past_open = '--past-open' in argv
    library = DEFAULT_LIBRARY
    if '--library' in argv:
        library = os.path.abspath(argv[argv.index('--library') + 1])
        argv = [a for a in argv if a != argv[argv.index('--library') + 1]]
    files = [os.path.abspath(a) for a in argv if not a.startswith('--')]
    if not files:
        files = sorted(glob.glob(os.path.join(EXAMPLES, '*.js')))

    for needed in (os.path.join(VM, 'c', 'qjs'), library, RUNNER):
        if not os.path.exists(needed):
            sys.exit('check_examples: %s is missing (see perf/measure.sh)'
                     % needed)

    with open(PRELUDE) as handle:
        prelude_text = handle.read().replace('const VALUES = __CHECK_EXAMPLES_VALUES__;',
                                             'const VALUES = %s;' %
                                             json.dumps(dict(
                                                 method_ids(),
                                                 PAST_OPEN=past_open)))


    bad = 0
    with tempfile.TemporaryDirectory() as work:
        syntax = {path: check_syntax(path, work) for path in files}

    with concurrent.futures.ThreadPoolExecutor(PARALLEL) as pool:
        results = list(pool.map(
            lambda path: run_under_vamos(path, library, prelude_text), files))

    missing, looked_up = check_constants_exist(files, library)

    for path, (status, output) in zip(files, results):
        name = os.path.basename(path)
        problems = list(missing.get(name, []))
        if syntax[path]:
            problems.append('syntax: ' + syntax[path].split('\n')[-1][:200])
        if status not in ('opened', 'ended'):
            problems.append(status)
        if problems:
            bad += 1
            print('FAIL  %-28s %s' % (name, '; '.join(problems)))
        else:
            print('ok    %-28s %s' % (name, status))
        if verbose or problems:
            for line in output.split('\n'):
                if line.strip() and (verbose or not VAMOS_LOG.match(line)):
                    print('        | ' + line[:200])

    print()
    print('%d examples, %d constant names looked up, %d failed'
          % (len(files), looked_up, bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
