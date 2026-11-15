#!/usr/bin/env python3
"""Check the .qjsb files and how the library uses them, under vamos.

Usage:
    python3 scripts/check_qjsb.py [--library amiga/libs/quickjs.040soft.library]

What amiga/tests/test_qjsb.js cannot arrange from inside a script is
checked here, with AmigaDOS calls logged by the emulator:

  files      the three files beside the library are well formed, match
             this tree's engine, and carry the library's version and
             date in their "$VER:" string
  quiet      a script that uses none of the bundled JavaScript makes no
             DOS call on any .qjsb file
  counts     how many Open / Read / Seek calls first use of a name
             costs (printed, and compared with LIMITS below, so that a
             change that adds disk access is noticed)
  absent     with no LIBS:quickjs directory at all, a plain script
             still runs, and a script that needs a file gets an error
             it can catch, naming the file, and can go on
  uncaught   the same error, not caught, ends qjs with the message and
             not with a crash
  mismatch   a file from another library version is refused with a
             message naming the file and both versions
  version    `qjs -v` lists the files with their version strings
             (skipped if the qjs in the vamos template is older than
             this feature)

Exit status is 1 if any check fails. Needs what scripts/check_examples.py
needs: perf/.vm (or PERF_VM) and amitools' vamos.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_examples                                    # noqa: E402
import qjsb_format as fmt                                # noqa: E402

ROOT = check_examples.ROOT
CORE = ('extended', 'amiga', 'reaction')

# First use of a name: the most DOS calls on .qjsb files it may make,
# as (Open, Read, Seek). Opening a file costs one Open and one Read
# (header and index), each entry one Seek and one Read.
CASES = [
    ('empty',              '1;',                    (0, 0, 0)),
    ('typeof URL',         'typeof URL;',           (1, 3, 2)),
    ('typeof Intuition',   'typeof Intuition;',     (2, 4, 2)),
    ('typeof amiga.boopsi', 'typeof amiga.boopsi;', (3, 6, 3)),
]

CATCHING = r'''
let message = 'nothing thrown';
try { void URL; } catch (error) { message = 'CAUGHT ' + error.message; }
print(message);
print('STILL RUNNING ' + (1 + 1));
'''

failures = 0


def report(ok, label, detail=''):
    """Print one PASS/FAIL line and count failures."""
    global failures
    if not ok:
        failures += 1
    print('%s %s%s' % ('PASS' if ok else 'FAIL', label,
                       (' (%s)' % detail) if detail and not ok else ''))


def run(library, script, bytecode, arguments=None, log='main:info'):
    """Run qjs under vamos; returns its combined output.

    bytecode is the directory to install as LIBS:quickjs, or None for
    no such directory. script is the text of t.js, which is run unless
    arguments are given.
    """
    with tempfile.TemporaryDirectory() as work:
        machine = os.path.join(work, 'vm')
        volumes = os.path.join(work, 'vols')
        os.mkdir(volumes)
        shutil.copytree(check_examples.VM, machine)
        shutil.rmtree(os.path.join(machine, 'libs', 'quickjs'),
                      ignore_errors=True)
        shutil.copy(library, os.path.join(machine, 'libs', 'quickjs.library'))
        if bytecode:
            shutil.copytree(bytecode, os.path.join(machine, 'libs', 'quickjs'))
        with open(os.path.join(machine, 't.js'), 'w') as handle:
            handle.write(script)
        command = [check_examples.RUNNER, '-S', '--vols-base-dir', volumes,
                   '-l', log, '-C', os.environ.get('PERF_CPU', '68020'),
                   '-m', '65536', '-H', 'disable', '-s', '2048',
                   '--cwd', 'sys:', '-V', 'sys:' + machine,
                   '-a', 'libs:sys:libs', '-a', 's:sys:s', '-a', 'c:sys:c',
                   '-a', 't:sys:s',
                   '-O', 'mathieeedoubbas.library=mode:amiga', '--',
                   'c/qjs'] + (arguments or ['t.js'])
        environment = dict(os.environ)
        environment.pop('PROF_OUT', None)
        done = subprocess.run(command, cwd=machine, env=environment,
                              stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, timeout=300)
        return done.stdout.decode('latin-1')


def said(output):
    """What the script itself printed: vamos's log lines removed."""
    return '\n'.join(line for line in output.split('\n')
                     if line.strip() and not line.startswith('PROF ')
                     and not check_examples.VAMOS_LOG.match(line))


def dos_calls(output):
    """(Open, Read, Seek) calls on .qjsb files in a dos:info log."""
    counts = []
    for call in ('Open: ', r'Read\(', r'Seek\('):
        counts.append(len(re.findall(r'dos:\s+INFO:\s+%s[^\n]*\.qjsb' % call,
                                     output)))
    return tuple(counts)


def main(argv):
    library = check_examples.DEFAULT_LIBRARY
    if '--library' in argv:
        library = os.path.abspath(argv[argv.index('--library') + 1])
    bytecode = os.path.join(os.path.dirname(library), 'quickjs')

    # files
    version, date = fmt.library_release()
    for name in CORE:
        path = os.path.join(bytecode, name + '.qjsb')
        try:
            with open(path, 'rb') as handle:
                header, entries = fmt.unpack(handle.read())
            wanted = fmt.ver_string(name + '.qjsb', version, date)
            good = (header['ver'] == wanted
                    and header['flags'] & fmt.FLAG_EXACT
                    and header['built_for'] == fmt.library_version()
                    and header['bc_version'] == fmt.bytecode_version()
                    and header['stamp'] == fmt.engine_stamp())
            report(good, 'files: %s.qjsb is "%s", %d entries'
                   % (name, header['ver'], len(entries)),
                   'expected "%s" for this tree' % wanted)
        except (OSError, fmt.QJSBError) as error:
            report(False, 'files: %s.qjsb' % name, str(error))

    # quiet, counts
    for label, script, limit in CASES:
        counts = dos_calls(run(library, script, bytecode, log='dos:info'))
        ok = all(got <= most for got, most in zip(counts, limit))
        report(ok, 'counts: %-20s Open %d  Read %d  Seek %d'
               % ((label,) + counts), 'at most %d/%d/%d' % limit)

    # absent
    plain = said(run(library, 'print("PLAIN " + (20 + 22));', None))
    report('PLAIN 42' in plain, 'absent: a plain script runs without '
           'LIBS:quickjs', plain[:200])
    caught = said(run(library, CATCHING, None))
    report('CAUGHT' in caught and 'extended.qjsb' in caught
           and 'STILL RUNNING 2' in caught,
           'absent: a script that needs a file gets a catchable error '
           'naming it', caught[:300])
    for line in caught.split('\n'):
        if line.startswith('CAUGHT'):
            print('       the message: ' + line[len('CAUGHT '):])

    # uncaught
    uncaught = said(run(library, 'typeof Intuition;\nprint("NOT REACHED");',
                        None))
    report('amiga.qjsb' in uncaught and 'NOT REACHED' not in uncaught
           and not re.search(r'Guru|InvalidMemoryAccess|Traceback', uncaught),
           'uncaught: the error ends the script with its message',
           uncaught[:300])

    # mismatch
    with tempfile.TemporaryDirectory() as work:
        other = os.path.join(work, 'quickjs')
        shutil.copytree(bytecode, other)
        with open(os.path.join(other, 'extended.qjsb'), 'rb') as handle:
            header, entries = fmt.unpack(handle.read())
        mine = fmt.library_version()
        with open(os.path.join(other, 'extended.qjsb'), 'wb') as handle:
            handle.write(fmt.pack(
                [(e['name'], e['kind'], e['blob']) for e in entries],
                fmt.ver_string('extended.qjsb', fmt.version_text(mine - 1),
                               '1.1.2026'),
                flags=fmt.FLAG_EXACT, built_for=mine - 1))
        refused = said(run(library, CATCHING, other))
        report('CAUGHT' in refused and 'extended.qjsb' in refused
               and fmt.version_text(mine - 1) in refused
               and fmt.version_text(mine) in refused
               and 'STILL RUNNING 2' in refused,
               'mismatch: a file of another library version is refused, '
               'naming both versions', refused[:400])
        for line in refused.split('\n'):
            if line.startswith('CAUGHT'):
                print('       the message: ' + line[len('CAUGHT '):])

        # version (with the mismatched file in place, so the remark shows)
        listing = said(run(library, '', other, arguments=['-v']))
        if '.qjsb' not in listing:
            print('SKIP version: the qjs in %s does not list .qjsb files; '
                  'rebuild it from this tree' % check_examples.VM)
        else:
            report(all(('%s.qjsb: %s.qjsb ' % (name, name)) in listing
                       for name in CORE)
                   and 'NOT for this library' in listing,
                   'version: qjs -v lists the files and marks the wrong one',
                   listing[:400])
            for line in listing.split('\n'):
                print('       ' + line)

    print()
    print('%d failed' % failures)
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
