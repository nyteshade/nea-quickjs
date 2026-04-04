# Makefile for quickjs.library — VBCC build
#
# Compiles the QuickJS engine entirely with VBCC and links into
# an AmigaOS shared library using the vbcc-librarytemplate.
#
# Usage:
#   make              — build quickjs.library
#   make clean        — remove object files
#
# Requirements:
#   VBCC installed at $VBCC (default: ~/vbcc)
#   vasmm68k_mot in $VBCC or PATH

VBCC ?= $(HOME)/vbcc
VC   = $(VBCC)/bin/vc
VASM = $(VBCC)/vasmm68k_mot
VLINK = $(VBCC)/bin/vlink

# Directories (relative to project root — run make from there)
ROOT     = ../..
QJS      = $(ROOT)/quickjs-master
INCLUDE  = $(ROOT)/include
TEMPLATE = $(ROOT)/vbcc-librarytemplate
LIBVBCC  = $(ROOT)/library/vbcc
OUTDIR   = $(ROOT)/amiga

# Compiler flags
CFLAGS = +aos68k -c -cpu=68020 -fpu=68881 -O1 \
         -I$(VBCC)/targets/m68k-amigaos/include \
         -I$(VBCC)/posixlib/include \
         -I$(INCLUDE) -I$(QJS) \
         -I$(TEMPLATE) -I$(LIBVBCC)

# Assembler flags
ASMFLAGS = -Fhunk -nowarn=62 -m68020 -m68881

# Linker flags — no .lib files linked, all symbols self-contained
LDFLAGS = -bamigahunk -Bstatic -nostdlib -mrel

# Object file directory
OBJDIR = /tmp/qjslib

# Engine objects (compiled from QuickJS-ng source)
ENGINE_OBJS = $(OBJDIR)/quickjs.o $(OBJDIR)/dtoa.o \
              $(OBJDIR)/libregexp.o $(OBJDIR)/libunicode.o

# Shared library support objects (pure C, no .lib dependencies)
SUPPORT_OBJS = $(OBJDIR)/sharedlib_mem.o \
               $(OBJDIR)/sharedlib_string.o \
               $(OBJDIR)/sharedlib_math.o \
               $(OBJDIR)/sharedlib_time.o \
               $(OBJDIR)/sharedlib_strtod.o \
               $(OBJDIR)/sharedlib_printf.o \
               $(OBJDIR)/sharedlib_vbcc.o \
               $(OBJDIR)/sharedlib_int64.o

# Library template + wrapper objects
LIB_OBJS = $(OBJDIR)/library.o $(OBJDIR)/qjsfuncs.o \
           $(OBJDIR)/execinline.o $(OBJDIR)/qjs_dbg_stub.o

ALL_OBJS = $(LIB_OBJS) $(SUPPORT_OBJS) $(ENGINE_OBJS)

TARGET = $(OUTDIR)/quickjs.library

.PHONY: all clean objdir

all: objdir $(TARGET)

objdir:
	@mkdir -p $(OBJDIR)

$(TARGET): $(ALL_OBJS)
	$(VLINK) $(LDFLAGS) $(ALL_OBJS) -o $@
	@ls -la $@

# Engine files
$(OBJDIR)/quickjs.o: $(QJS)/quickjs.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/dtoa.o: $(QJS)/dtoa.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/libregexp.o: $(QJS)/libregexp.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/libunicode.o: $(QJS)/libunicode.c
	$(VC) $(CFLAGS) $< -o $@

# Library template
$(OBJDIR)/library.o: $(TEMPLATE)/library.c
	$(VC) $(CFLAGS) $< -o $@

# Library wrapper + support
$(OBJDIR)/qjsfuncs.o: $(LIBVBCC)/qjsfuncs.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/execinline.o: $(LIBVBCC)/execinline.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/qjs_dbg_stub.o: $(LIBVBCC)/qjs_dbg_stub.c
	$(VC) $(CFLAGS) $< -o $@

# Shared library support files
$(OBJDIR)/sharedlib_mem.o: $(LIBVBCC)/sharedlib_mem.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/sharedlib_string.o: $(LIBVBCC)/sharedlib_string.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/sharedlib_math.o: $(LIBVBCC)/sharedlib_math.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/sharedlib_time.o: $(LIBVBCC)/sharedlib_time.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/sharedlib_strtod.o: $(LIBVBCC)/sharedlib_strtod.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/sharedlib_printf.o: $(LIBVBCC)/sharedlib_printf.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/sharedlib_vbcc.o: $(LIBVBCC)/sharedlib_vbcc.c
	$(VC) $(CFLAGS) $< -o $@

$(OBJDIR)/sharedlib_int64.o: $(LIBVBCC)/sharedlib_int64.s
	$(VASM) $(ASMFLAGS) $< -o $@

clean:
	rm -rf $(OBJDIR)
	rm -f $(TARGET)
