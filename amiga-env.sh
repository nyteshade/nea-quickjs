#!/usr/bin/env bash
# amiga-env.sh — source this file to get helper functions for the QuickJS/AmigaOS build.
#
# Usage (from the project root):
#   source ./amiga-env.sh
#
# Functions provided:
#   amiga_clear           — wipe the vamos RAM volume (run before every vamos call)
#   amiga_compile  FILE [EXTRA_FLAGS...]  — compile FILE for FPU build (with MATH=68881)
#   amiga_compile_soft FILE [EXTRA_FLAGS...] — compile FILE for no-FPU build
#   amiga_link            — link FPU build → quickjs-master/qjs
#   amiga_link_soft       — link no-FPU build → quickjs-master/qjs_soft
#   amiga_run  [QJS_ARGS...]    — run FPU qjs via vamos
#   amiga_run_soft [QJS_ARGS...] — run no-FPU qjs_soft via vamos
#   amiga_build_fpu       — compile all sources + link for FPU build (full rebuild)
#
# FILE is always relative to quickjs-master/, e.g.:
#   amiga_compile quickjs.c CODE=FAR
#   amiga_compile amiga/amiga_compat.c
#   amiga_run -e 'print(1+1)'

# ---------------------------------------------------------------------------
# Environment setup
# ---------------------------------------------------------------------------

# Resolve $SC if not already in the environment.
# Priority: in-repo sasc658/ → $HOME/sasc658/ → warn
if [ -z "$SC" ]; then
    _amiga_self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$_amiga_self/sasc658/setup.sh" ]; then
        # shellcheck source=/dev/null
        source "$_amiga_self/sasc658/setup.sh"
    elif [ -f "$HOME/sasc658/setup.sh" ]; then
        # shellcheck source=/dev/null
        source "$HOME/sasc658/setup.sh"
    else
        echo "amiga-env: WARNING: \$SC not set and no sasc658/setup.sh found." >&2
        echo "amiga-env: Expected: $(pwd)/sasc658/setup.sh or \$HOME/sasc658/setup.sh" >&2
    fi
    unset _amiga_self
fi

# Absolute path to the project root (works whether sourced as ./amiga-env.sh
# or as /full/path/to/amiga-env.sh).  Supports both bash and zsh.
if [ -n "${BASH_SOURCE[0]+x}" ] && [ -n "${BASH_SOURCE[0]}" ]; then
    _AMIGA_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "${ZSH_VERSION}" ]; then
    _AMIGA_PROJECT_ROOT="${0:A:h}"
else
    _AMIGA_PROJECT_ROOT="$(pwd)"
fi
_AMIGA_QJS_ROOT="$_AMIGA_PROJECT_ROOT/quickjs-master"
_AMIGA_VAMOS_CFG="$_AMIGA_QJS_ROOT/amiga/vamos_build.cfg"

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_amiga_check_env() {
    if [ -z "$SC" ]; then
        echo "amiga-env: ERROR: \$SC is not set. Run: source \$HOME/sasc658/setup.sh" >&2
        return 1
    fi
    if [ ! -d "$_AMIGA_QJS_ROOT" ]; then
        echo "amiga-env: ERROR: quickjs-master not found at $_AMIGA_QJS_ROOT" >&2
        return 1
    fi
    return 0
}

# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

# amiga_clear
# Wipe the vamos RAM volume. Call before every vamos invocation to avoid
# stale state from previous runs.
amiga_clear() {
    rm -rf "$HOME/.vamos/volumes/ram"
}

# amiga_compile FILE [EXTRA_FLAGS...]
# Compile FILE (path relative to quickjs-master/) for the FPU build.
# Includes MATH=68881. Pass CODE=FAR for large files (quickjs.c, quickjs-libc.c).
#
# Examples:
#   amiga_compile dtoa.c
#   amiga_compile quickjs.c CODE=FAR
#   amiga_compile amiga/amiga_compat.c
amiga_compile() {
    _amiga_check_env || return 1
    local file="$1"; shift
    amiga_clear
    vamos \
        -c "$_AMIGA_VAMOS_CFG" \
        -V sc:"$SC" \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        sc:c/sc "qjs:$file" \
        MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP \
        IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include \
        IDIR=sc:sdks/AmiSSL/Developer/include NOICONS \
        "$@"
}

# amiga_compile_soft FILE [EXTRA_FLAGS...]
# Same as amiga_compile but without MATH=68881 — for the no-FPU (qjs_soft) build.
# NOTE: .o files land next to the .c file and will overwrite FPU .o files.
# Compile and link qjs_soft immediately after, then recompile FPU build if needed.
#
# Examples:
#   amiga_compile_soft dtoa.c
#   amiga_compile_soft quickjs.c CODE=FAR
amiga_compile_soft() {
    _amiga_check_env || return 1
    local file="$1"; shift
    amiga_clear
    vamos \
        -c "$_AMIGA_VAMOS_CFG" \
        -V sc:"$SC" \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        sc:c/sc "qjs:$file" \
        DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP \
        IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include \
        IDIR=sc:sdks/AmiSSL/Developer/include NOICONS \
        "$@"
}

# amiga_link
# Link all .o files into the FPU binary.
# Output: quickjs-master/amiga/bin/qjs
# All .o files must have been compiled with MATH=68881.
amiga_link() {
    _amiga_check_env || return 1
    amiga_clear
    vamos \
        -c "$_AMIGA_VAMOS_CFG" \
        -V sc:"$SC" \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        sc:c/slink \
        sc:lib/c.o \
        qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
        qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
        qjs:amiga/amiga_compat.o qjs:amiga/amiga_ssl.o \
        qjs:gen/repl.o qjs:gen/standalone.o \
        TO qjs:amiga/bin/qjs \
        LIB sc:lib/scnb.lib sc:lib/scm881nb.lib sc:lib/amiga.lib NOICONS
}

# amiga_link_soft
# Link all .o files into the no-FPU binary.
# Output: quickjs-master/amiga/bin/qjs_soft
# All .o files must have been compiled WITHOUT MATH=68881 first.
amiga_link_soft() {
    _amiga_check_env || return 1
    amiga_clear
    vamos \
        -c "$_AMIGA_VAMOS_CFG" \
        -V sc:"$SC" \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        sc:c/slink \
        sc:lib/c.o \
        qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
        qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
        qjs:amiga/amiga_compat.o qjs:amiga/amiga_ssl.o \
        qjs:gen/repl.o qjs:gen/standalone.o \
        TO qjs:amiga/bin/qjs_soft \
        LIB sc:lib/scnb.lib sc:lib/scmnb.lib sc:lib/amiga.lib NOICONS
}

# amiga_run [QJS_ARGS...]
# Run the FPU qjs binary under vamos.
#
# Examples:
#   amiga_run -e 'print(1+1)'
#   amiga_run hexdump.js
#   amiga_run                    (starts REPL)
amiga_run() {
    _amiga_check_env || return 1
    vamos -S -C 68040 -m 65536 -H disable -s 2048 \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        -- qjs:amiga/bin/qjs "$@"
}

# amiga_run_stack STACK_KIB [QJS_ARGS...]
# Like amiga_run but with a custom vamos stack size (in KiB, vamos -s).
#
# Example:
#   amiga_run_stack 64 -e 'print("hello")'  # 64 KiB stack
amiga_run_stack() {
    _amiga_check_env || return 1
    local stack="$1"; shift
    vamos -S -C 68040 -m 65536 -H disable -s "$stack" \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        -- qjs:amiga/bin/qjs "$@"
}

# amiga_run_soft [QJS_ARGS...]
# Same as amiga_run but uses the no-FPU binary (qjs_soft).
amiga_run_soft() {
    _amiga_check_env || return 1
    vamos -S -C 68040 -m 65536 -H disable -s 2048 \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        -- qjs:amiga/bin/qjs_soft "$@"
}

# amiga_build_fpu
# Full FPU rebuild: compile all source files then link qjs.
# Equivalent to running amiga_compile on every file individually.
amiga_build_fpu() {
    _amiga_check_env || return 1
    echo "==> FPU build: compiling all sources..." &&
    amiga_compile qjs.c &&
    amiga_compile dtoa.c &&
    amiga_compile libregexp.c &&
    amiga_compile libunicode.c &&
    amiga_compile amiga/amiga_compat.c &&
    amiga_compile gen/repl.c &&
    amiga_compile gen/standalone.c &&
    amiga_compile quickjs-libc.c CODE=FAR &&
    amiga_compile quickjs.c CODE=FAR &&
    amiga_compile amiga/amiga_ssl.c MEMSIZE=HUGE IDLEN=80 &&
    echo "==> FPU build: linking..." &&
    amiga_link &&
    echo "==> FPU build complete: $_AMIGA_QJS_ROOT/amiga/bin/qjs"
}

# amiga_build_soft
# Full no-FPU rebuild: compile all source files without MATH=68881, then link qjs_soft.
# WARNING: overwrites .o files — run amiga_build_fpu afterwards to restore FPU build.
amiga_build_soft() {
    _amiga_check_env || return 1
    echo "==> No-FPU build: compiling all sources..." &&
    amiga_compile_soft qjs.c &&
    amiga_compile_soft dtoa.c &&
    amiga_compile_soft libregexp.c &&
    amiga_compile_soft libunicode.c &&
    amiga_compile_soft amiga/amiga_compat.c &&
    amiga_compile_soft gen/repl.c &&
    amiga_compile_soft gen/standalone.c &&
    amiga_compile_soft quickjs-libc.c CODE=FAR &&
    amiga_compile_soft quickjs.c CODE=FAR &&
    amiga_compile_soft amiga/amiga_ssl.c MEMSIZE=HUGE IDLEN=80 &&
    echo "==> No-FPU build: linking..." &&
    amiga_link_soft &&
    echo "==> No-FPU build complete: $_AMIGA_QJS_ROOT/amiga/bin/qjs_soft"
}

# amiga_compile_cpu FILE CPU [EXTRA_FLAGS...]
# Compile FILE for a specific CPU with FPU. CPU is e.g. 68040 or 68060.
amiga_compile_cpu() {
    _amiga_check_env || return 1
    local file="$1"; local cpu="$2"; shift 2
    amiga_clear
    vamos \
        -c "$_AMIGA_VAMOS_CFG" \
        -V sc:"$SC" \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        sc:c/sc "qjs:$file" \
        CPU=$cpu MATH=68881 DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP \
        IDIR=qjs: IDIR=qjs:amiga IDIR=sc:include \
        IDIR=sc:sdks/AmiSSL/Developer/include NOICONS \
        "$@"
}

# amiga_link_cpu CPU SUFFIX
# Link all .o files into a CPU-specific FPU binary.
# Output: quickjs-master/amiga/bin/qjs.SUFFIX (e.g. qjs.040, qjs.060)
amiga_link_cpu() {
    _amiga_check_env || return 1
    local cpu="$1" suffix="$2"
    amiga_clear
    vamos \
        -c "$_AMIGA_VAMOS_CFG" \
        -V sc:"$SC" \
        -V qjs:"$_AMIGA_QJS_ROOT" \
        sc:c/slink \
        sc:lib/c.o \
        qjs:qjs.o qjs:quickjs.o qjs:quickjs-libc.o \
        qjs:libregexp.o qjs:libunicode.o qjs:dtoa.o \
        qjs:amiga/amiga_compat.o qjs:amiga/amiga_ssl.o \
        qjs:gen/repl.o qjs:gen/standalone.o \
        TO "qjs:amiga/bin/qjs.$suffix" \
        LIB sc:lib/scnb.lib sc:lib/scm881nb.lib sc:lib/amiga.lib NOICONS
}

# amiga_build_040
# Full 68040-optimized FPU build → qjs.040
amiga_build_040() {
    _amiga_check_env || return 1
    echo "==> 68040 build: compiling all sources..." &&
    amiga_compile_cpu qjs.c 68040 &&
    amiga_compile_cpu dtoa.c 68040 &&
    amiga_compile_cpu libregexp.c 68040 &&
    amiga_compile_cpu libunicode.c 68040 &&
    amiga_compile_cpu amiga/amiga_compat.c 68040 &&
    amiga_compile_cpu gen/repl.c 68040 &&
    amiga_compile_cpu gen/standalone.c 68040 &&
    amiga_compile_cpu quickjs-libc.c 68040 CODE=FAR &&
    amiga_compile_cpu quickjs.c 68040 CODE=FAR &&
    amiga_compile_cpu amiga/amiga_ssl.c 68040 MEMSIZE=HUGE IDLEN=80 &&
    echo "==> 68040 build: linking..." &&
    amiga_link_cpu 68040 040 &&
    echo "==> 68040 build complete: $_AMIGA_QJS_ROOT/amiga/bin/qjs.040"
}

# amiga_build_060
# Full 68060-optimized FPU build → qjs.060
amiga_build_060() {
    _amiga_check_env || return 1
    echo "==> 68060 build: compiling all sources..." &&
    amiga_compile_cpu qjs.c 68060 &&
    amiga_compile_cpu dtoa.c 68060 &&
    amiga_compile_cpu libregexp.c 68060 &&
    amiga_compile_cpu libunicode.c 68060 &&
    amiga_compile_cpu amiga/amiga_compat.c 68060 &&
    amiga_compile_cpu gen/repl.c 68060 &&
    amiga_compile_cpu gen/standalone.c 68060 &&
    amiga_compile_cpu quickjs-libc.c 68060 CODE=FAR &&
    amiga_compile_cpu quickjs.c 68060 CODE=FAR &&
    amiga_compile_cpu amiga/amiga_ssl.c 68060 MEMSIZE=HUGE IDLEN=80 &&
    echo "==> 68060 build: linking..." &&
    amiga_link_cpu 68060 060 &&
    echo "==> 68060 build complete: $_AMIGA_QJS_ROOT/amiga/bin/qjs.060"
}

# amiga_build_all
# Build all variants: qjs (020/FPU), qjs_soft (020/no-FPU), qjs.040, qjs.060
amiga_build_all() {
    amiga_build_soft &&
    amiga_build_fpu &&
    amiga_build_040 &&
    amiga_build_060
}

# ---------------------------------------------------------------------------

echo "amiga-env loaded  USER=$USER  SC=${SC:-(not set)}"
echo "  amiga_build_fpu / amiga_build_soft / amiga_build_040 / amiga_build_060 / amiga_build_all"
