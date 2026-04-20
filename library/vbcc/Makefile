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
         -I$(VBCC)/targets/m68k-amigaos/include \
         -I$(VBCC)/posixlib/include \
         -I$(AMISSL_SDK) \
         -I$(INCLUDE) -I$(QJS) \
         -I$(TEMPLATE) -I$(LIBVBCC)

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
              $(FPU_AUX_OBJ) \
              $(OBJDIR_FPU)/sharedlib_time.o \
              $(OBJDIR_FPU)/sharedlib_strtod.o \
              $(OBJDIR_FPU)/sharedlib_printf.o \
              $(OBJDIR_FPU)/sharedlib_vbcc.o \
              $(OBJDIR_FPU)/sharedlib_int64.o \
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
               $(OBJDIR_SOFT)/sharedlib_time.o \
               $(OBJDIR_SOFT)/sharedlib_strtod.o \
               $(OBJDIR_SOFT)/sharedlib_printf.o \
               $(OBJDIR_SOFT)/sharedlib_vbcc.o \
               $(OBJDIR_SOFT)/sharedlib_int64_soft.o \
               $(OBJDIR_SOFT)/sharedlib_int64_conv.o \
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

.PHONY: all fpu soft clean variants 020 040 060 default-library

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

$(TARGET_FPU): $(FPU_ALL) | $(LIBSDIR)
	$(VLINK) $(LDFLAGS) $(FPU_ALL) $(LINK_LIBS) -o $@
	@ls -la $@

$(OBJDIR_FPU)/quickjs.o: $(QJS)/quickjs.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/dtoa.o: $(QJS)/dtoa.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/libregexp.o: $(QJS)/libregexp.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU_REGEXP) $< -o $@

$(OBJDIR_FPU)/libunicode.o: $(QJS)/libunicode.c | $(OBJDIR_FPU)
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

$(OBJDIR_FPU)/sharedlib_math.o: $(LIBVBCC)/sharedlib_math.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

# 040/060 FPU only: provides atan/sin/cos/etc. via mathieeedoubtrans.library
$(OBJDIR_FPU)/sharedlib_math_fpu_aux.o: $(LIBVBCC)/sharedlib_math_fpu_aux.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

# For 040/060 FPU builds: use soft math impl (calls mathieeedoubtrans
# for transcendentals; basic ops still inline as FPU instructions)
$(OBJDIR_FPU)/sharedlib_math_soft.o: $(LIBVBCC)/sharedlib_math_soft.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_int64_conv.o: $(LIBVBCC)/sharedlib_int64_conv.c | $(OBJDIR_FPU)
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

$(OBJDIR_FPU)/sharedlib_int64.o: $(LIBVBCC)/sharedlib_int64.s | $(OBJDIR_FPU)
	$(VASM) $(ASMFLAGS_FPU) $< -o $@

$(OBJDIR_FPU):
	@mkdir -p $@

# --- Soft-float variant build rules ---

$(TARGET_SOFT): $(SOFT_ALL) | $(LIBSDIR)
	$(VLINK) $(LDFLAGS) $(SOFT_ALL) $(LINK_LIBS) -o $@
	@ls -la $@

$(OBJDIR_SOFT)/quickjs.o: $(QJS)/quickjs.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

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

$(OBJDIR_SOFT)/sharedlib_time.o: $(LIBVBCC)/sharedlib_time.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_strtod.o: $(LIBVBCC)/sharedlib_strtod.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_printf.o: $(LIBVBCC)/sharedlib_printf.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/sharedlib_vbcc.o: $(LIBVBCC)/sharedlib_vbcc.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

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

$(OBJDIR_SOFT):
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
