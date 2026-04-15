#!/bin/bash
# Resync vendored @nejs libraries from their local source-of-truth
# checkouts.  Run after upstream releases a new version.

set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC_ROOT="${1:-/Volumes/Code/JavaScript}"

if [ ! -d "$SRC_ROOT" ]; then
    echo "Source root '$SRC_ROOT' not found"
    echo "Usage: $0 [/path/to/JavaScript]"
    exit 1
fi

sync_lib() {
    local name="$1"
    local globs="$2"
    local src="$SRC_ROOT/$name"
    local dst="$HERE/$name"
    if [ ! -d "$src" ]; then
        echo "skip $name (source missing)"
        return
    fi
    echo "refreshing $name from $src"
    mkdir -p "$dst"
    # shellcheck disable=SC2086
    rsync -a --delete $globs "$src"/ "$dst/" 2>/dev/null || {
        # Fall back to file-by-file cp
        for pat in src LICENSE README.md; do
            [ -e "$src/$pat" ] && cp -R "$src/$pat" "$dst/"
        done
    }
    [ -f "$src/package.json" ] && cp "$src/package.json" "$dst/UPSTREAM-package.json"
}

sync_lib ne-enumeration
sync_lib ne-extension

echo "done.  run amiga/tests/host/run-all.sh to verify nothing regressed."
