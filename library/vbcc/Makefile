# Makefile for quickjs.library — VBCC build
#
# Builds CPU-specific variants of the QuickJS shared library.
# Default CPU is 68020; override with CPU=68040 or CPU=68060.
#
# Variants per CPU:
#   quickjs.<cpu>fpu.library   — uses 68881/68882 FPU instructions
#   quickjs.<cpu>soft.library  — software float (no FPU required)
#
# 040/060 FPU builds use sharedlib_math_fpu_aux.c to provide the
# transcendentals (atan/sin/cos/etc.) that the 68040/68060 FPU lacks
# as native instructions. Those calls go to mathieeedoubtrans.library.
#
# Soft-float variants use mathieeedoubbas.library and
# mathieeedoubtrans.library for all floating point operations.
#
# Usage:
#   make              — build FPU + soft for current CPU + default-library
#   make fpu          — build FPU variant only
#   make soft         — build soft-float variant only
#   make variants     — build all 6 (020/040/060 × fpu/soft) + default-library
#   make 020/040/060  — build both variants for one CPU
#   make clean        — remove object files for current CPU
#   make clean-variants — remove ALL object files and built libraries
#
# Requirements:
#   VBCC installed at $VBCC (default: ~/vbcc)
#   vasmm68k_mot in $VBCC or PATH

VBCC ?= $(HOME)/vbcc
VC   = $(VBCC)/bin/vc
VASM = $(VBCC)/bin/vasmm68k_mot
VLINK = $(VBCC)/bin/vlink

# Directories
ROOT     = ../..
QJS      = $(ROOT)/quickjs-master
INCLUDE  = $(ROOT)/include
TEMPLATE = $(ROOT)/vbcc-librarytemplate
LIBVBCC  = $(ROOT)/library/vbcc
SRC      = $(ROOT)/src
OUTDIR     = $(ROOT)/amiga
LIBSDIR    = $(OUTDIR)/libs
CDIR       = $(OUTDIR)/c

# CPU variant — can be overridden on command line
# Supported: 68020, 68040, 68060
CPU ?= 68020

# Common compiler flags
AMISSL_SDK = $(ROOT)/sdks/AmiSSL-v5.26-SDK/Developer/include
CFLAGS_COMMON = +aos68k -c -cpu=$(CPU) -O1 \
         -DJS_NAN_BOXING=0 \
         -I$(VBCC)/targets/m68k-amigaos/include \
         -I$(VBCC)/posixlib/include \
         -I$(AMISSL_SDK) \
         -I$(INCLUDE) -I$(QJS) \
         -I$(TEMPLATE) -I$(LIBVBCC)
# JS_NAN_BOXING=0: VBCC at -O1 (and lower) miscompiles the int64 ops
# that NAN-boxed JSValue construction/extraction requires. User-tested
# at 0.196: Number.MAX_SAFE_INTEGER showed as 4294967295 = 2^53-1
# truncated to its low 32 bits, proving every JS_NewFloat64 call
# corrupts large doubles. Forcing struct-based JSValue (16 bytes,
# int64_t tag) eliminates the int64 sub+shift NaN-box math from every
# float construction site at once.

# CPU tag (020, 040, 060) used in $VER string and filenames
ifeq ($(CPU),68020)
CPU_TAG_LOCAL = 020
endif
ifeq ($(CPU),68040)
CPU_TAG_LOCAL = 040
endif
ifeq ($(CPU),68060)
CPU_TAG_LOCAL = 060
endif

# FPU variant flags — inject QJS_VARIANT_NAME as an unquoted token;
# libraryconfig.h stringifies it via QJS_STR() so the $VER string
# identifies the specific library instance (e.g. "quickjs.020fpu.library").
CFLAGS_FPU  = $(CFLAGS_COMMON) -fpu=68881 \
              -DQJS_VARIANT_NAME=$(CPU_TAG_LOCAL)fpu
ASMFLAGS_FPU = -Fhunk -nowarn=62 -m$(CPU) -m68881

# Soft-float variant flags (no -fpu, uses -amiga-softfloat from aos68k config)
CFLAGS_SOFT = $(CFLAGS_COMMON) \
              -DQJS_VARIANT_NAME=$(CPU_TAG_LOCAL)soft
ASMFLAGS_SOFT = -Fhunk -nowarn=62 -m$(CPU)

# libregexp.c must be compiled at -O0. At -O1 and above, VBCC emits
# "warning 175: this code is weird" for lre_compile, lre_exec_backtrack,
# and re_parse_char_class — and the generated code hangs at runtime on
# any regex literal (including trivial ones like /\+/g). Root cause is
# upstream-QuickJS-ng regex code that VBCC's optimizer miscompiles;
# dropping opt to -O0 sidesteps it. Size cost is ~50KB per variant;
# perf cost is not measurable for regex-heavy tests (regex was hung
# before, so "slow" is infinitely better than "broken").
CFLAGS_FPU_REGEXP  = $(subst -O1,-O0,$(CFLAGS_FPU))
CFLAGS_SOFT_REGEXP = $(subst -O1,-O0,$(CFLAGS_SOFT))

# Interpreter loop options, for quickjs.c only (0.226). Measured as
# executed instructions under vamos; see perf/README.md.
#   QJS_INTERP_ONE_TABLE=1  "#pragma opt 1" around JS_CallInternal. At
#       plain -O1 vbcc splits the 246-case opcode switch into five range
#       tables and the commonest opcodes pay about 56 instructions of
#       dispatch; with the pragma there is one table (about 11). The
#       pragma is restored with "#pragma opt 991", which is what
#       "vc -O1" passes to vbccm68k: if -O1 below ever changes, change
#       that number in quickjs.c too.
#   QJS_INTERP_FAST=2       inside JS_CallInternal the small helpers
#       (js_dup, JS_FreeValue, set_value, get_u16...) are macros, since
#       vbcc does not inline at -O1, and the hot opcodes have int32 fast
#       paths in front of their original bodies.
#   QJS_INTERP_INT_DIV      "/" and "%" on two int32 stay integer.
QJS_INTERP_FLAGS = -DQJS_INTERP_ONE_TABLE=1 -DQJS_INTERP_FAST=2 \
                   -DQJS_INTERP_INT_DIV

# Until 0.225 the soft variants built quickjs.c at -O0, a workaround for
# a vbccm68k crash that was fixed in the local compiler on 10.6.2026.
# With QJS_INTERP_ONE_TABLE the -O1 build is the faster one, so soft and
# FPU now use the same flags.
CFLAGS_SOFT_QUICKJS = $(CFLAGS_SOFT) $(QJS_INTERP_FLAGS)
CFLAGS_FPU_QUICKJS  = $(CFLAGS_FPU) $(QJS_INTERP_FLAGS)

# Linker flags
LDFLAGS = -bamigahunk -Bstatic -nostdlib -mrel
# No .lib files — shared library is fully self-contained.
# All POSIX/stdio functions implemented via dos.library in sharedlib_*.c
LINK_LIBS =

# Object file directories — CPU-specific to avoid collisions
OBJDIR_FPU  = /tmp/qjslib_$(CPU)
OBJDIR_SOFT = /tmp/qjslib_$(CPU)_soft

# Engine source files
ENGINE_SRC = $(QJS)/quickjs.c $(QJS)/dtoa.c \
             $(QJS)/libregexp.c $(QJS)/libunicode.c

# Shared source files (same for both variants)
SHARED_SRC = $(LIBVBCC)/sharedlib_mem.c \
             $(LIBVBCC)/sharedlib_string.c \
             $(LIBVBCC)/sharedlib_time.c \
             $(LIBVBCC)/sharedlib_strtod.c \
             $(LIBVBCC)/sharedlib_printf.c \
             $(LIBVBCC)/sharedlib_vbcc.c

# --- FPU variant objects ---
FPU_ENGINE  = $(OBJDIR_FPU)/quickjs.o $(OBJDIR_FPU)/dtoa.o \
              $(OBJDIR_FPU)/libregexp.o $(OBJDIR_FPU)/libunicode.o

# For 040/060 FPU builds, add sharedlib_math_fpu_aux.o which provides
# transcendentals (atan, sin, cos, etc.) via mathieeedoubtrans.library.
# These are inlined as FPU instructions on 020 but emitted as external
# calls by VBCC on 040/060 because those FPUs lack the instructions.
ifeq ($(CPU),68020)
FPU_AUX_OBJ =
else
FPU_AUX_OBJ = $(OBJDIR_FPU)/sharedlib_math_fpu_aux.o
endif

FPU_SUPPORT = $(OBJDIR_FPU)/sharedlib_mem.o \
              $(OBJDIR_FPU)/sharedlib_string.o \
              $(OBJDIR_FPU)/sharedlib_math.o \
              $(OBJDIR_FPU)/sharedlib_math_round.o \
              $(OBJDIR_FPU)/sharedlib_math_pow.o \
              $(OBJDIR_FPU)/sharedlib_fpu_mode.o \
              $(FPU_AUX_OBJ) \
              $(OBJDIR_FPU)/sharedlib_time.o \
              $(OBJDIR_FPU)/sharedlib_strtod.o \
              $(OBJDIR_FPU)/sharedlib_printf.o \
              $(OBJDIR_FPU)/sharedlib_vbcc.o \
              $(OBJDIR_FPU)/sharedlib_int64.o \
              $(OBJDIR_FPU)/sharedlib_int64_fpu.o \
              $(OBJDIR_FPU)/sharedlib_int64_conv.o \
              $(OBJDIR_FPU)/sharedlib_dbl_helpers.o \
              $(OBJDIR_FPU)/sharedlib_posix.o \
              $(OBJDIR_FPU)/sharedlib_stdio.o \
              $(OBJDIR_FPU)/sharedlib_clib.o \
              $(OBJDIR_FPU)/sharedlib_fetch.o

FPU_LIB     = $(OBJDIR_FPU)/library.o $(OBJDIR_FPU)/qjsfuncs.o \
              $(OBJDIR_FPU)/qjsfuncs_asm_all.o \
              $(OBJDIR_FPU)/execinline.o $(OBJDIR_FPU)/qjs_dbg_stub.o \
              $(OBJDIR_FPU)/quickjs_libc_lib.o \
              $(OBJDIR_FPU)/amiga_ssl_lib.o \
              $(OBJDIR_FPU)/extended.o \
              $(OBJDIR_FPU)/ffi.o \
              $(OBJDIR_FPU)/sharedlib_worker.o \
              $(OBJDIR_FPU)/amiga_ffi.o \
              $(OBJDIR_FPU)/amiga_ffi_call.o \
              $(OBJDIR_FPU)/amiga_boopsi_call.o

FPU_ALL     = $(FPU_LIB) $(FPU_SUPPORT) $(FPU_ENGINE)

# --- Soft-float variant objects ---
SOFT_ENGINE = $(OBJDIR_SOFT)/quickjs.o $(OBJDIR_SOFT)/dtoa.o \
              $(OBJDIR_SOFT)/libregexp.o $(OBJDIR_SOFT)/libunicode.o

SOFT_SUPPORT = $(OBJDIR_SOFT)/sharedlib_mem.o \
               $(OBJDIR_SOFT)/sharedlib_string.o \
               $(OBJDIR_SOFT)/sharedlib_math_soft.o \
               $(OBJDIR_SOFT)/sharedlib_math_prim.o \
               $(OBJDIR_SOFT)/sharedlib_math.o \
               $(OBJDIR_SOFT)/sharedlib_math_fpu_aux.o \
               $(OBJDIR_SOFT)/sharedlib_math_round.o \
               $(OBJDIR_SOFT)/sharedlib_math_pow.o \
               $(OBJDIR_SOFT)/sharedlib_time.o \
               $(OBJDIR_SOFT)/sharedlib_strtod.o \
               $(OBJDIR_SOFT)/sharedlib_printf.o \
               $(OBJDIR_SOFT)/sharedlib_vbcc.o \
               $(OBJDIR_SOFT)/sharedlib_int64.o \
               $(OBJDIR_SOFT)/sharedlib_int64_soft.o \
               $(OBJDIR_SOFT)/sharedlib_softfp.o \
               $(OBJDIR_SOFT)/sharedlib_int64_conv.o \
               $(OBJDIR_SOFT)/sharedlib_dbl_helpers.o \
               $(OBJDIR_SOFT)/sharedlib_posix.o \
               $(OBJDIR_SOFT)/sharedlib_stdio.o \
               $(OBJDIR_SOFT)/sharedlib_clib.o \
               $(OBJDIR_SOFT)/sharedlib_fetch.o

SOFT_LIB    = $(OBJDIR_SOFT)/library.o $(OBJDIR_SOFT)/qjsfuncs.o \
              $(OBJDIR_SOFT)/qjsfuncs_asm_all.o \
              $(OBJDIR_SOFT)/execinline.o $(OBJDIR_SOFT)/qjs_dbg_stub.o \
              $(OBJDIR_SOFT)/quickjs_libc_lib.o \
              $(OBJDIR_SOFT)/amiga_ssl_lib.o \
              $(OBJDIR_SOFT)/extended.o \
              $(OBJDIR_SOFT)/ffi.o \
              $(OBJDIR_SOFT)/sharedlib_worker.o \
              $(OBJDIR_SOFT)/amiga_ffi.o \
              $(OBJDIR_SOFT)/amiga_ffi_call.o \
              $(OBJDIR_SOFT)/amiga_boopsi_call.o

SOFT_ALL    = $(SOFT_LIB) $(SOFT_SUPPORT) $(SOFT_ENGINE)

# Targets — all variants go to amiga/libs/ with consistent naming:
#   quickjs.020fpu.library   (020 + 68881 FPU, transcendentals inlined)
#   quickjs.020soft.library  (020 + soft-float)
#   quickjs.040fpu.library   (040 + FPU, transcendentals via mathieeedoubtrans)
#   quickjs.040soft.library  (040 + soft-float)
#   quickjs.060fpu.library   (060 + FPU, transcendentals via mathieeedoubtrans)
#   quickjs.060soft.library  (060 + soft-float)
# Plus a copy of the 020 soft variant as quickjs.library (default for shipping)
ifeq ($(CPU),68020)
CPU_TAG = 020
endif
ifeq ($(CPU),68040)
CPU_TAG = 040
endif
ifeq ($(CPU),68060)
CPU_TAG = 060
endif
TARGET_FPU  = $(LIBSDIR)/quickjs.$(CPU_TAG)fpu.library
TARGET_SOFT = $(LIBSDIR)/quickjs.$(CPU_TAG)soft.library

.PHONY: all fpu soft clean variants 020 040 060 default-library check-dcmp

# Every C file that goes into a soft-float library. check-dcmp compiles
# each to assembly with the soft flags and fails if the compiler emitted
# a double comparison of its own, which is wrong for NaN: see
# quickjs-master/dcmp.h and scripts/check_dcmp.py. Run it after touching
# floating-point code. (-g only adds line markers to the assembly.)
DCMP_SRC = $(QJS)/quickjs.c $(QJS)/dtoa.c $(QJS)/libregexp.c \
           $(QJS)/libunicode.c $(TEMPLATE)/library.c \
           $(LIBVBCC)/qjsfuncs.c $(LIBVBCC)/execinline.c \
           $(LIBVBCC)/qjs_dbg_stub.c $(LIBVBCC)/quickjs_libc_lib.c \
           $(LIBVBCC)/amiga_ssl_lib.c $(LIBVBCC)/sharedlib_worker.c \
           $(LIBVBCC)/amiga_ffi.c $(LIBVBCC)/sharedlib_mem.c \
           $(LIBVBCC)/sharedlib_string.c $(LIBVBCC)/sharedlib_math_soft.c \
           $(LIBVBCC)/sharedlib_math_prim.c \
           $(LIBVBCC)/sharedlib_math.c $(LIBVBCC)/sharedlib_math_fpu_aux.c \
           $(LIBVBCC)/sharedlib_math_round.c $(LIBVBCC)/sharedlib_math_pow.c \
           $(LIBVBCC)/sharedlib_time.c $(LIBVBCC)/sharedlib_strtod.c \
           $(LIBVBCC)/sharedlib_printf.c $(LIBVBCC)/sharedlib_vbcc.c \
           $(LIBVBCC)/sharedlib_int64_conv.c \
           $(LIBVBCC)/sharedlib_dbl_helpers.c $(LIBVBCC)/sharedlib_posix.c \
           $(LIBVBCC)/sharedlib_stdio.c $(LIBVBCC)/sharedlib_clib.c \
           $(LIBVBCC)/sharedlib_fetch.c

check-dcmp:
	python3 $(ROOT)/scripts/check_dcmp.py $(OBJDIR_SOFT)/dcmp \
	    $(VC) $(filter-out -c,$(CFLAGS_SOFT)) $(QJS_INTERP_FLAGS) -g \
	    -- $(DCMP_SRC)

all: fpu soft default-library

fpu: $(TARGET_FPU)

soft: $(TARGET_SOFT)

# Create LIBSDIR (and CDIR) if they don't exist
$(LIBSDIR):
	@mkdir -p $(LIBSDIR)

$(CDIR):
	@mkdir -p $(CDIR)

# After building, copy 020 soft as the default quickjs.library.
# This is the universally-compatible variant — runs on any 68020+
# without needing an FPU. The user can replace it with a CPU-specific
# variant if they want better performance.
default-library: $(LIBSDIR)/quickjs.020soft.library | $(LIBSDIR)
	@cp $(LIBSDIR)/quickjs.020soft.library $(LIBSDIR)/quickjs.library
	@echo "Default library: quickjs.library = quickjs.020soft.library"

# Build all CPU/FPU variants (only soft for 040/060 — see below)
variants: 020 040 060 default-library

# Per-CPU targets — build both FPU and soft variants for each
# 040/060 FPU builds use sharedlib_math_fpu_aux.c which provides
# the missing transcendentals (atan/sin/cos/etc.) via
# mathieeedoubtrans.library, since the 040/060 FPU doesn't have
# them as native instructions.
020:
	$(MAKE) CPU=68020 fpu soft

040:
	$(MAKE) CPU=68040 fpu soft

060:
	$(MAKE) CPU=68060 fpu soft

# --- FPU variant build rules ---

# Maths of the FPU variants. Every source that includes <math.h> also
# gets sharedlib_math_fpu.h (the engine through cutils.h), which
# replaces vbcc's inline floor/ceil/trunc/round/fmod/hypot/ldexp by
# the functions in sharedlib_math_round.c and sharedlib_math.c.
FPU_MATH_HDRS = $(LIBVBCC)/sharedlib_math_fpu.h $(LIBVBCC)/sharedlib_dblbits.h

$(TARGET_FPU): $(FPU_ALL) | $(LIBSDIR)
	$(VLINK) $(LDFLAGS) $(FPU_ALL) $(LINK_LIBS) -o $@
	@ls -la $@

$(OBJDIR_FPU)/quickjs.o: $(QJS)/quickjs.c $(FPU_MATH_HDRS) | $(OBJDIR_FPU)
	ulimit -s 65520 && $(VC) $(CFLAGS_FPU_QUICKJS) $< -o $@

$(OBJDIR_FPU)/dtoa.o: $(QJS)/dtoa.c $(FPU_MATH_HDRS) | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/libregexp.o: $(QJS)/libregexp.c $(FPU_MATH_HDRS) | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU_REGEXP) $< -o $@

$(OBJDIR_FPU)/libunicode.o: $(QJS)/libunicode.c $(FPU_MATH_HDRS) | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/library.o: $(TEMPLATE)/library.c $(LIBVBCC)/libraryconfig.h | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/qjsfuncs.o: $(LIBVBCC)/qjsfuncs.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/qjsfuncs_asm_all.o: $(LIBVBCC)/qjsfuncs_asm_all.s | $(OBJDIR_FPU)
	$(VASM) $(ASMFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/execinline.o: $(LIBVBCC)/execinline.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/qjs_dbg_stub.o: $(LIBVBCC)/qjs_dbg_stub.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/quickjs_libc_lib.o: $(LIBVBCC)/quickjs_libc_lib.c $(QJS)/quickjs-libc.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/amiga_ssl_lib.o: $(LIBVBCC)/amiga_ssl_lib.c $(SRC)/amiga_ssl.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/extended.o: $(QJS)/gen/extended.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/ffi.o: $(QJS)/gen/ffi.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_worker.o: $(LIBVBCC)/sharedlib_worker.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/amiga_ffi.o: $(LIBVBCC)/amiga_ffi.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/amiga_ffi_call.o: $(LIBVBCC)/amiga_ffi_call.s | $(OBJDIR_FPU)
	$(VASM) $(ASMFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/amiga_boopsi_call.o: $(LIBVBCC)/amiga_boopsi_call.s | $(OBJDIR_FPU)
	$(VASM) $(ASMFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_mem.o: $(LIBVBCC)/sharedlib_mem.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_string.o: $(LIBVBCC)/sharedlib_string.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_math.o: $(LIBVBCC)/sharedlib_math.c $(FPU_MATH_HDRS) | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_math_round.o: $(LIBVBCC)/sharedlib_math_round.c $(FPU_MATH_HDRS) | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_math_pow.o: $(LIBVBCC)/sharedlib_math_pow.c $(FPU_MATH_HDRS) | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

# FPU mode while inside the library: round to nearest; double precision
# on the 68040/68060, extended on the 68020 (a 6888x is much slower in
# double precision). The reasons are at the top of the file.
ifeq ($(CPU),68020)
QJS_FPCR_MODE = 0
else
QJS_FPCR_MODE = 128
endif
$(OBJDIR_FPU)/sharedlib_fpu_mode.o: $(LIBVBCC)/sharedlib_fpu_mode.s | $(OBJDIR_FPU)
	$(VASM) $(ASMFLAGS_FPU) -I$(ROOT)/sdks/NDK3.2R4/Include_I \
	    -DQJS_FPCR_MODE=$(QJS_FPCR_MODE) $< -o $@

# 040/060 FPU only: provides atan/sin/cos/etc. via mathieeedoubtrans.library
$(OBJDIR_FPU)/sharedlib_math_fpu_aux.o: $(LIBVBCC)/sharedlib_math_fpu_aux.c $(FPU_MATH_HDRS) | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

# For 040/060 FPU builds: use soft math impl (calls mathieeedoubtrans
# for transcendentals; basic ops still inline as FPU instructions)
$(OBJDIR_FPU)/sharedlib_math_soft.o: $(LIBVBCC)/sharedlib_math_soft.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_int64_conv.o: $(LIBVBCC)/sharedlib_int64_conv.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_dbl_helpers.o: $(LIBVBCC)/sharedlib_dbl_helpers.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_time.o: $(LIBVBCC)/sharedlib_time.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_strtod.o: $(LIBVBCC)/sharedlib_strtod.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_printf.o: $(LIBVBCC)/sharedlib_printf.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_vbcc.o: $(LIBVBCC)/sharedlib_vbcc.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_posix.o: $(LIBVBCC)/sharedlib_posix.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_stdio.o: $(LIBVBCC)/sharedlib_stdio.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_clib.o: $(LIBVBCC)/sharedlib_clib.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_fetch.o: $(LIBVBCC)/sharedlib_fetch.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

# 64-bit integer helpers vbcc calls for "long long". sharedlib_int64.s
# (multiply, divide, shifts) and sharedlib_int64_conv.c (double -> int64)
# are integer code shared with the soft variants; sharedlib_int64_fpu.s
# is int64 -> double with the FPU. Check them with perf/int64cmp/run.sh.
$(OBJDIR_FPU)/sharedlib_int64.o: $(LIBVBCC)/sharedlib_int64.s | $(OBJDIR_FPU)
	$(VASM) $(ASMFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_int64_fpu.o: $(LIBVBCC)/sharedlib_int64_fpu.s | $(OBJDIR_FPU)
	$(VASM) $(ASMFLAGS_FPU) $< -o $@

# Refuse to compile with a vbccm68k that has the "constant reloaded at
# the exit label" bug: it built the libraries up to 0.232 with a
# JS_GetScriptOrModuleName that always returned 0, and nothing in the
# build showed it. The check compiles one small function with the
# vbccm68k that vc is about to run (the first on PATH) and takes 20 ms;
# tools/vbcc-patches/README.md has the story and the fixed compiler.
# ALLOW_BAD_VBCC=1 builds anyway.
.PHONY: compiler-check
compiler-check:
	@$(ROOT)/tools/vbcc-patches/check-compiler.sh || [ -n "$(ALLOW_BAD_VBCC)" ] || { \
	  echo "*** This vbccm68k miscompiles the library. Use the fixed one, e.g."; \
	  echo "***   PATH=\$$HOME/vbcc-fixed/bin:\$$PATH make ..."; \
	  echo "*** See tools/vbcc-patches/README.md. (ALLOW_BAD_VBCC=1 overrides.)"; \
	  exit 1; }

# Every object needs its directory first, so the check runs before any
# compilation, also under make -j.
$(OBJDIR_FPU): | compiler-check
	@mkdir -p $@

# --- Soft-float variant build rules ---

$(TARGET_SOFT): $(SOFT_ALL) | $(LIBSDIR)
	$(VLINK) $(LDFLAGS) $(SOFT_ALL) $(LINK_LIBS) -o $@
	@ls -la $@

# ulimit: precautionary headroom for vbccm68k's recursive descent over the
# 2 MB quickjs.c. HISTORY (9-10.6.2026): vbccm68k used to SIGSEGV here ~50%
# of runs — an IC use-after-free in add_IC()'s peepholes vs the statement
# handlers' saved cursors. Fixed in /Users/brie/vbcc/src/vbcc (deferred-free
# graveyard in supp.c/ic.c/main.c + move_freereg assertion fix in
# machines/m68k/machine.c) and installed 10.6.2026; see Fina
# T-vbccm68k-soft-quickjs-segv. If this ever flakes again, check that
# ~/vbcc/bin/vbccm68k is still the fixed binary (sha 475e0818...).
$(OBJDIR_SOFT)/quickjs.o: $(QJS)/quickjs.c | $(OBJDIR_SOFT)
	ulimit -s 65520 && $(VC) $(CFLAGS_SOFT_QUICKJS) $< -o $@

$(OBJDIR_SOFT)/dtoa.o: $(QJS)/dtoa.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/libregexp.o: $(QJS)/libregexp.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT_REGEXP) $< -o $@

$(OBJDIR_SOFT)/libunicode.o: $(QJS)/libunicode.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/library.o: $(TEMPLATE)/library.c $(LIBVBCC)/libraryconfig.h | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/qjsfuncs.o: $(LIBVBCC)/qjsfuncs.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/qjsfuncs_asm_all.o: $(LIBVBCC)/qjsfuncs_asm_all.s | $(OBJDIR_SOFT)
	$(VASM) $(ASMFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/execinline.o: $(LIBVBCC)/execinline.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/qjs_dbg_stub.o: $(LIBVBCC)/qjs_dbg_stub.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/quickjs_libc_lib.o: $(LIBVBCC)/quickjs_libc_lib.c $(QJS)/quickjs-libc.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/amiga_ssl_lib.o: $(LIBVBCC)/amiga_ssl_lib.c $(SRC)/amiga_ssl.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/extended.o: $(QJS)/gen/extended.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/ffi.o: $(QJS)/gen/ffi.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_worker.o: $(LIBVBCC)/sharedlib_worker.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/amiga_ffi.o: $(LIBVBCC)/amiga_ffi.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/amiga_ffi_call.o: $(LIBVBCC)/amiga_ffi_call.s | $(OBJDIR_SOFT)
	$(VASM) $(ASMFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/amiga_boopsi_call.o: $(LIBVBCC)/amiga_boopsi_call.s | $(OBJDIR_SOFT)
	$(VASM) $(ASMFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_mem.o: $(LIBVBCC)/sharedlib_mem.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_string.o: $(LIBVBCC)/sharedlib_string.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_math_soft.o: $(LIBVBCC)/sharedlib_math_soft.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

# The maths functions built on the primitives are the FPU variants'
# sources (0.232): with the library's own IEEE arithmetic underneath
# (sharedlib_softfp.s) the same C gives the same results. The
# primitives themselves are in sharedlib_math_prim.c.
SOFT_MATH_HDRS = $(LIBVBCC)/sharedlib_dblbits.h $(QJS)/dcmp.h

$(OBJDIR_SOFT)/sharedlib_math_prim.o: $(LIBVBCC)/sharedlib_math_prim.c $(SOFT_MATH_HDRS) | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_math.o: $(LIBVBCC)/sharedlib_math.c $(SOFT_MATH_HDRS) | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_math_fpu_aux.o: $(LIBVBCC)/sharedlib_math_fpu_aux.c $(SOFT_MATH_HDRS) | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_math_round.o: $(LIBVBCC)/sharedlib_math_round.c $(SOFT_MATH_HDRS) | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_math_pow.o: $(LIBVBCC)/sharedlib_math_pow.c $(SOFT_MATH_HDRS) | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_time.o: $(LIBVBCC)/sharedlib_time.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_strtod.o: $(LIBVBCC)/sharedlib_strtod.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_printf.o: $(LIBVBCC)/sharedlib_printf.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_vbcc.o: $(LIBVBCC)/sharedlib_vbcc.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

# Double comparison and the soft-float arithmetic (0.232) for the soft
# variants only; the FPU variants use the FPU's own instructions.
$(OBJDIR_SOFT)/sharedlib_softfp.o: $(LIBVBCC)/sharedlib_softfp.s | $(OBJDIR_SOFT)
	$(VASM) $(ASMFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_int64.o: $(LIBVBCC)/sharedlib_int64.s | $(OBJDIR_SOFT)
	$(VASM) $(ASMFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_int64_soft.o: $(LIBVBCC)/sharedlib_int64_soft.s | $(OBJDIR_SOFT)
	$(VASM) $(ASMFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_posix.o: $(LIBVBCC)/sharedlib_posix.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_stdio.o: $(LIBVBCC)/sharedlib_stdio.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_clib.o: $(LIBVBCC)/sharedlib_clib.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_fetch.o: $(LIBVBCC)/sharedlib_fetch.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_int64_conv.o: $(LIBVBCC)/sharedlib_int64_conv.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_dbl_helpers.o: $(LIBVBCC)/sharedlib_dbl_helpers.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT): | compiler-check
	@mkdir -p $@

clean:
	rm -rf $(OBJDIR_FPU) $(OBJDIR_SOFT)
	rm -f $(TARGET_FPU) $(TARGET_SOFT)

# Clean ALL CPU/FPU variant artifacts (object dirs and built libraries)
clean-variants:
	rm -rf /tmp/qjslib_68020 /tmp/qjslib_68020_soft
	rm -rf /tmp/qjslib_68040 /tmp/qjslib_68040_soft
	rm -rf /tmp/qjslib_68060 /tmp/qjslib_68060_soft
	rm -f $(LIBSDIR)/quickjs.library
	rm -f $(LIBSDIR)/quickjs.020fpu.library $(LIBSDIR)/quickjs.020soft.library
	rm -f $(LIBSDIR)/quickjs.040fpu.library $(LIBSDIR)/quickjs.040soft.library
	rm -f $(LIBSDIR)/quickjs.060fpu.library $(LIBSDIR)/quickjs.060soft.library
