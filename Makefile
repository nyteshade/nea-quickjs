#
# Top-level Makefile for nea-quickjs
#
# Common builds:
#   make           build all variants + CLI (default for shipping)
#   make all       same as 'make'
#   make ship      same as 'make' — produces a complete amiga/ tree
#   make cli       just rebuild qjs binary
#   make clean     remove all build artifacts
#
# Variant-specific builds:
#   make lib       build 020 FPU + 020 soft (current CPU)
#   make 020       build 68020 FPU + soft variants
#   make 040       build 68040 soft variant
#   make 060       build 68060 soft variant
#   make variants  build all 4 variants (020 fpu/soft, 040 soft, 060 soft)
#
# Output layout:
#   amiga/c/qjs                       — CLI binary (thin shell)
#   amiga/c/flushlibs                 — utility
#   amiga/libs/quickjs.library        — default (= 020 soft, runs anywhere)
#   amiga/libs/quickjs.020fpu.library — 68020 + 68881 FPU
#   amiga/libs/quickjs.020soft.library — 68020 software float
#   amiga/libs/quickjs.040soft.library — 68040 software float
#   amiga/libs/quickjs.060soft.library — 68060 software float
#   amiga/tests/                       — test scripts
#

LIBVBCC = library/vbcc

.PHONY: all ship lib lib-fpu lib-soft cli clean variants 020 040 060

all: ship

ship: variants cli

lib: lib-fpu lib-soft

lib-fpu:
	$(MAKE) -C $(LIBVBCC) fpu

lib-soft:
	$(MAKE) -C $(LIBVBCC) soft

variants:
	$(MAKE) -C $(LIBVBCC) variants

020:
	$(MAKE) -C $(LIBVBCC) 020

040:
	$(MAKE) -C $(LIBVBCC) 040

060:
	$(MAKE) -C $(LIBVBCC) 060

cli:
	$(MAKE) -C $(LIBVBCC) -f Makefile.cli

clean:
	$(MAKE) -C $(LIBVBCC) clean-variants
	$(MAKE) -C $(LIBVBCC) -f Makefile.cli clean
