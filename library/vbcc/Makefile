# Makefile for quickjs.library — VBCC build
#
# Builds two variants:
#   quickjs.library      — requires 68020 + 68881/68882 FPU
#   quickjs_soft.library — requires 68020 only (software float)
#
# The soft-float variant uses AmigaOS mathieeedoubbas.library and
# mathieeedoubtrans.library for all floating point operations.
#
# Usage:
#   make              — build both variants
#   make fpu          — build FPU variant only
#   make soft         — build soft-float variant only
#   make clean        — remove all object files
#
# Requirements:
#   VBCC installed at $VBCC (default: ~/vbcc)
#   vasmm68k_mot in $VBCC or PATH

VBCC ?= $(HOME)/vbcc
VC   = $(VBCC)/bin/vc
VASM = $(VBCC)/vasmm68k_mot
VLINK = $(VBCC)/bin/vlink

# Directories
ROOT     = ../..
QJS      = $(ROOT)/quickjs-master
INCLUDE  = $(ROOT)/include
TEMPLATE = $(ROOT)/vbcc-librarytemplate
LIBVBCC  = $(ROOT)/library/vbcc
SRC      = $(ROOT)/src
OUTDIR   = $(ROOT)/amiga

# Common compiler flags (no FPU setting — added per target)
AMISSL_SDK = $(ROOT)/sdks/AmiSSL-v5.26-SDK/Developer/include
CFLAGS_COMMON = +aos68k -c -cpu=68020 -O1 \
         -I$(VBCC)/targets/m68k-amigaos/include \
         -I$(VBCC)/posixlib/include \
         -I$(AMISSL_SDK) \
         -I$(INCLUDE) -I$(QJS) \
         -I$(TEMPLATE) -I$(LIBVBCC)

# FPU variant flags
CFLAGS_FPU  = $(CFLAGS_COMMON) -fpu=68881
ASMFLAGS_FPU = -Fhunk -nowarn=62 -m68020 -m68881

# Soft-float variant flags (no -fpu, uses -amiga-softfloat from aos68k config)
CFLAGS_SOFT = $(CFLAGS_COMMON)
ASMFLAGS_SOFT = -Fhunk -nowarn=62 -m68020

# Linker flags
LDFLAGS = -bamigahunk -Bstatic -nostdlib -mrel
# No .lib files — shared library is fully self-contained.
# All POSIX/stdio functions implemented via dos.library in sharedlib_*.c
LINK_LIBS =

# Object file directories
OBJDIR_FPU  = /tmp/qjslib
OBJDIR_SOFT = /tmp/qjslib_soft

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

FPU_SUPPORT = $(OBJDIR_FPU)/sharedlib_mem.o \
              $(OBJDIR_FPU)/sharedlib_string.o \
              $(OBJDIR_FPU)/sharedlib_math.o \
              $(OBJDIR_FPU)/sharedlib_time.o \
              $(OBJDIR_FPU)/sharedlib_strtod.o \
              $(OBJDIR_FPU)/sharedlib_printf.o \
              $(OBJDIR_FPU)/sharedlib_vbcc.o \
              $(OBJDIR_FPU)/sharedlib_int64.o \
              $(OBJDIR_FPU)/sharedlib_posix.o \
              $(OBJDIR_FPU)/sharedlib_stdio.o \
              $(OBJDIR_FPU)/sharedlib_clib.o

FPU_LIB     = $(OBJDIR_FPU)/library.o $(OBJDIR_FPU)/qjsfuncs.o \
              $(OBJDIR_FPU)/qjsfuncs_asm_all.o \
              $(OBJDIR_FPU)/execinline.o $(OBJDIR_FPU)/qjs_dbg_stub.o \
              $(OBJDIR_FPU)/quickjs_libc_lib.o

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
               $(OBJDIR_SOFT)/sharedlib_clib.o

SOFT_LIB    = $(OBJDIR_SOFT)/library.o $(OBJDIR_SOFT)/qjsfuncs.o \
              $(OBJDIR_SOFT)/qjsfuncs_asm_all.o \
              $(OBJDIR_SOFT)/execinline.o $(OBJDIR_SOFT)/qjs_dbg_stub.o \
              $(OBJDIR_SOFT)/quickjs_libc_lib.o

SOFT_ALL    = $(SOFT_LIB) $(SOFT_SUPPORT) $(SOFT_ENGINE)

# Targets
TARGET_FPU  = $(OUTDIR)/quickjs.library
TARGET_SOFT = $(OUTDIR)/quickjs_soft.library

.PHONY: all fpu soft clean

all: fpu soft

fpu: $(TARGET_FPU)

soft: $(TARGET_SOFT)

# --- FPU variant build rules ---

$(TARGET_FPU): $(FPU_ALL)
	$(VLINK) $(LDFLAGS) $(FPU_ALL) $(LINK_LIBS) -o $@
	@ls -la $@

$(OBJDIR_FPU)/quickjs.o: $(QJS)/quickjs.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/dtoa.o: $(QJS)/dtoa.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/libregexp.o: $(QJS)/libregexp.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/libunicode.o: $(QJS)/libunicode.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/library.o: $(TEMPLATE)/library.c | $(OBJDIR_FPU)
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

$(OBJDIR_FPU)/sharedlib_mem.o: $(LIBVBCC)/sharedlib_mem.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_string.o: $(LIBVBCC)/sharedlib_string.c | $(OBJDIR_FPU)
	$(VC) $(CFLAGS_FPU) $< -o $@

$(OBJDIR_FPU)/sharedlib_math.o: $(LIBVBCC)/sharedlib_math.c | $(OBJDIR_FPU)
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

$(OBJDIR_FPU)/sharedlib_int64.o: $(LIBVBCC)/sharedlib_int64.s | $(OBJDIR_FPU)
	$(VASM) $(ASMFLAGS_FPU) $< -o $@

$(OBJDIR_FPU):
	@mkdir -p $@

# --- Soft-float variant build rules ---

$(TARGET_SOFT): $(SOFT_ALL)
	$(VLINK) $(LDFLAGS) $(SOFT_ALL) $(LINK_LIBS) -o $@
	@ls -la $@

$(OBJDIR_SOFT)/quickjs.o: $(QJS)/quickjs.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/dtoa.o: $(QJS)/dtoa.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/libregexp.o: $(QJS)/libregexp.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/libunicode.o: $(QJS)/libunicode.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT)/library.o: $(TEMPLATE)/library.c | $(OBJDIR_SOFT)
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

$(OBJDIR_SOFT)/sharedlib_int64_conv.o: $(LIBVBCC)/sharedlib_int64_conv.c | $(OBJDIR_SOFT)
	$(VC) $(CFLAGS_SOFT) $< -o $@

$(OBJDIR_SOFT):
	@mkdir -p $@

clean:
	rm -rf $(OBJDIR_FPU) $(OBJDIR_SOFT)
	rm -f $(TARGET_FPU) $(TARGET_SOFT)
