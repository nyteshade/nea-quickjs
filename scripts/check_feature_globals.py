#!/usr/bin/env python3
"""Check that each extended.js feature creates exactly the globals it lists.

Usage:
    python3 scripts/check_feature_globals.py              # every feature
    python3 scripts/check_feature_globals.py url buffer   # just these
    python3 scripts/check_feature_globals.py --library amiga/libs/quickjs.040soft.library

Exit status is 1 if any feature is wrong, else 0.

Why this exists: since 0.230 no feature is installed when qjs starts.
The library registers each name in a feature's `globals` list as a lazy
property, and the first use of one of those names installs the feature.
The list is therefore the only way a script can reach the feature:

  - a global that install() creates but the list leaves out does not
    exist until some OTHER name of the feature has been used, so a
    script that uses it first gets a ReferenceError;
  - a name in the list that install() does not create is `undefined`
    after its first use instead of a ReferenceError.

How it works: each feature is applied alone, in its own qjs under
vamos, with qjs.modules.apply(name), and the property names of
globalThis are compared before and after.

  absent     a listed name that does not exist, or is undefined, after
             the feature was applied
  unlisted   a global that appeared and is in no feature's list
  removed    a global that was there before and is gone

Anything else the run prints (install() reports a failure on the
console) fails the feature too.

Applying a feature also applies the features it requires and those
that extend it, so a name is "unlisted" only if no feature lists it.

Needs what scripts/check_examples.py needs (its vamos runner is used).
"""
import concurrent.futures
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_examples                                    # noqa: E402

ROOT = check_examples.ROOT
SOURCE = os.path.join(ROOT, 'quickjs-master', 'amiga', 'extended',
                      'extended.js')
PARALLEL = 6

PROBE = r'''
const FEATURE = %s;
/* Using `qjs` evaluates the extended.js module, which takes the
 * library's private __qjs_ natives off globalThis; that is not the
 * feature's doing, so the "before" list is taken after it. */
const every = qjs.modules.list();
const before = Object.getOwnPropertyNames(globalThis);
/** The library's private natives come and go; they are not globals. */
const isPrivate = (name) => name.startsWith('__qjs_');
const listed = new Set(['qjs']);
for (const feature of every) {
  for (const name of feature.globals) listed.add(name.split('.')[0]);
}
if (!qjs.modules.apply(FEATURE)) print('RESULT ' + JSON.stringify({ unknown: true }));
const after = Object.getOwnPropertyNames(globalThis);
const mine = every.find((feature) => feature.name === FEATURE);
const absent = [];
for (const name of mine ? mine.globals : []) {
  const dot = name.indexOf('.');
  const owner = dot < 0 ? globalThis : globalThis[name.substring(0, dot)];
  const key = dot < 0 ? name : name.substring(dot + 1);
  const descriptor = owner && Object.getOwnPropertyDescriptor(owner, key);
  if (!descriptor || (!descriptor.get && descriptor.value === undefined)) {
    absent.push(name);
  }
}
print('RESULT ' + JSON.stringify({
  listed: mine ? mine.globals.length : 0,
  absent,
  unlisted: after.filter((name) => !before.includes(name) &&
                                    !listed.has(name) && !isPrivate(name)),
  removed: before.filter((name) => !after.includes(name) && !isPrivate(name)),
}));
'''


def feature_names():
    """The features' names, in source order."""
    with open(SOURCE, encoding='utf-8') as handle:
        return re.findall(r"^    name:\s+'([^']+)',", handle.read(), re.M)


def probe(name, library):
    """The RESULT object for one feature, or {'error': text}."""
    output = check_examples.vamos(library, {},
                                  {'probe.js': PROBE % json.dumps(name)},
                                  ['probe.js'])
    if output is None:
        return {'error': 'timeout'}
    result = None
    said = []           # anything else the run printed: a failed install
    for line in output.split('\n'):
        if line.startswith('RESULT '):
            result = json.loads(line[len('RESULT '):])
        elif (line.strip() and not check_examples.VAMOS_LOG.match(line)
              and not line.startswith('PROF ')):
            said.append(line.strip())
    if result is None or said:
        return {'error': ' / '.join(said)[:300] or 'no output'}
    return result


def main(argv):
    library = check_examples.DEFAULT_LIBRARY
    if '--library' in argv:
        value = argv[argv.index('--library') + 1]
        library = os.path.abspath(value)
        argv = [a for a in argv if a != value]
    names = [a for a in argv if not a.startswith('--')] or feature_names()

    with concurrent.futures.ThreadPoolExecutor(PARALLEL) as pool:
        results = list(pool.map(lambda name: probe(name, library), names))

    bad = 0
    for name, result in zip(names, results):
        problems = []
        if 'error' in result:
            problems.append(result['error'])
        elif result.get('unknown'):
            problems.append('no such feature')
        else:
            for kind in ('absent', 'unlisted', 'removed'):
                if result[kind]:
                    problems.append('%s: %s' % (kind, ' '.join(result[kind])))
        if problems:
            bad += 1
            print('FAIL  %-20s %s' % (name, '; '.join(problems)))
        else:
            print('ok    %-20s %d listed' % (name, result['listed']))

    print()
    print('%d features, %d wrong' % (len(names), bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
