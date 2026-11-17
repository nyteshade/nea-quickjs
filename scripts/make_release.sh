#!/bin/bash
# make_release.sh - pack what an Amiga user installs into one LhA archive.
#
# Usage: scripts/make_release.sh [output-directory]
#
# Writes QuickJS-<version>.lha and its SHA-256 into the output directory
# (default: dist/, which git ignores). The version is read from the
# built library, so build first; the script stops if the six libraries,
# the three .qjsb files and the command do not all carry one version.
#
# Only files git tracks are packed, so test output and other leftovers
# in amiga/ stay out. Needs `lha` (LHa for UNIX) on the path.
#
# Publishing is a separate, deliberate step:
#   git tag v<version> && git push origin v<version>
#   gh release create v<version> dist/QuickJS-<version>.lha ...
set -eu
cd "$(dirname "$0")/.."
out=${1:-dist}

# The version every shipped file must carry.
version=$(strings amiga/libs/quickjs.020soft.library |
          sed -n 's/.*\$VER: quickjs\.020soft\.library \([0-9.]*\) .*/\1/p' | head -1)
[ -n "$version" ] || { echo "cannot read the library version" >&2; exit 1; }

for file in amiga/libs/quickjs.0[246]0{soft,fpu}.library \
            amiga/libs/quickjs/{extended,amiga,reaction}.qjsb amiga/c/qjs; do
    strings "$file" | grep -q "\$VER: .* $version (" ||
        { echo "$file is not version $version" >&2; exit 1; }
done

name=QuickJS-$version
stage=$(mktemp -d)
root=$stage/$name
mkdir -p "$root"/{C,Libs/quickjs,Docs,Examples,Tests}

cp amiga/c/qjs amiga/c/timeit "$root/C/"
cp amiga/libs/quickjs.0[246]0{soft,fpu}.library "$root/Libs/"
cp amiga/libs/quickjs/{extended,amiga,reaction}.qjsb "$root/Libs/quickjs/"
cp amiga/docs/quickjs.doc amiga/docs/quickjs-js.doc "$root/Docs/"
cp docs/INSTALL.md docs/STACK.md docs/QJSB-FORMAT.md docs/ADDONS.md \
   docs/NODEJS-DELTA.md docs/REACTION.md docs/WORKER_API.md \
   docs/AMIGA-CHANGES.md "$root/Docs/"
cp quickjs-master/LICENSE "$root/LICENSE"

git ls-files amiga/examples | while read -r file; do
    mkdir -p "$root/Examples/$(dirname "${file#amiga/examples/}")"
    cp "$file" "$root/Examples/${file#amiga/examples/}"
done
git ls-files amiga/tests | while read -r file; do
    mkdir -p "$root/Tests/$(dirname "${file#amiga/tests/}")"
    cp "$file" "$root/Tests/${file#amiga/tests/}"
done

# Plain ASCII: this is read in an Amiga Shell.
cat > "$root/ReadMe" <<EOF
QuickJS for AmigaOS 3.x, version $version

A modern JavaScript engine (QuickJS-ng) as quickjs.library, with the
command qjs. Needs a 68020 or better and AmigaOS 3.x.

Install, from this drawer:

  1. Pick ONE library for your CPU and copy it as quickjs.library:

       Libs/quickjs.020soft.library   68020 or better, no FPU needed
       Libs/quickjs.020fpu.library    68020/68030 with 68881/68882
       Libs/quickjs.040soft.library   68040 without FPU
       Libs/quickjs.040fpu.library    68040 with FPU
       Libs/quickjs.060soft.library   68060 without FPU
       Libs/quickjs.060fpu.library    68060 with FPU

       copy Libs/quickjs.020soft.library LIBS:quickjs.library

  2. Copy the bundled JavaScript (the same for every CPU):

       makedir LIBS:quickjs
       copy Libs/quickjs/#?.qjsb LIBS:quickjs/

  3. Copy the command:

       copy C/qjs C:qjs

  4. Reboot or run "avail flush" if an older library was in use, then

       qjs -v

     Every line should show version $version.

Try:   qjs -e "print(6 * 7)"
       qjs Examples/calculator_demo.js
       execute Tests/RunRegressionTests     (from this drawer)

Docs/INSTALL.md says more; Docs/quickjs-js.doc lists what scripts can
use; Docs/quickjs.doc is the library's autodoc. C/timeit times a
command: "timeit qjs -e 1".
EOF

mkdir -p "$out"
archive=$(cd "$out" && pwd)/$name.lha
rm -f "$archive"
(cd "$stage" && lha aq "$archive" "$name")
(cd "$out" && shasum -a 256 "$name.lha" > "$name.lha.sha256")
rm -rf "$stage"
ls -l "$archive"
cat "$out/$name.lha.sha256"
