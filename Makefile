#
# Top-level Makefile for nea-quickjs
#
# Build everything (library + CLI):
#   make
#
# Build just the library (FPU variant):
#   make lib
#
# Build just the CLI:
#   make cli
#
# Build soft-float library:
#   make lib-soft
#
# Clean everything:
#   make clean
#

LIBVBCC = library/vbcc

.PHONY: all lib lib-fpu lib-soft cli clean

all: lib cli

lib: lib-fpu lib-soft

lib-fpu:
	$(MAKE) -C $(LIBVBCC) fpu

lib-soft:
	$(MAKE) -C $(LIBVBCC) soft

cli:
	$(MAKE) -C $(LIBVBCC) -f Makefile.cli

clean:
	$(MAKE) -C $(LIBVBCC) clean
	$(MAKE) -C $(LIBVBCC) -f Makefile.cli clean
