
#MYLIBS= LIB:debug.lib

CC = sc
ASM = asm

CFLAGS  = data=near nominc streq nostkchk
AFLAGS  = -iINCLUDE:
LINKER  = slink
LFLAGS  = SMALLCODE BATCH NODEBUG
STARTUP = LIB:c.o
LIBS    = LIB:sc.lib, LIB:amiga.lib

M      = modules/
A      = apps/


# Our iffparse support object modules to link with
IFFO      = $(M)parse.o $(M)iffpstrings.o $(M)Hook.o
ILBMRO    = $(M)ilbmr.o $(M)unpacker.o
ILBMSO    = $(M)getdisplay.o $(M)screen.o
ILBMLO    = $(M)loadilbm.o $(M)getbitmap.o
ILBMRSO   = $(IFFO) $(ILBMRO) $(ILBMSO)
ILBMWO    = $(M)saveilbm.o $(M)ilbmw.o $(M)packer.o
ILBMO     = $(IFFO) $(ILBMRO) $(ILBMLO) $(ILBMSO) $(ILBMWO)
EXTRAO    = $(M)copychunks.o $(M)screendump.o $(M)bmprintc.o


# Our iffparse applications
APP1   = $(A)ILBMDemo/ILBMDemo
APP2   = $(A)ILBMLoad/ILBMLoad
APP3   = $(A)Play8SVX/Play8SVX
APP4   = $(A)ILBMtoC/ILBMtoC
APP5   = $(A)ILBMtoRaw/ILBMtoRaw
APP6   = $(A)ScreenSave/ScreenSave
APP7   = $(A)RawtoILBM/RawtoILBM
APP8   = $(A)24bitDemo/24bitDemo
APP9   = $(A)Save8/Save8
APP10  = $(A)PlaySMUS/PlaySMUS

# The object modules and special includes needed by each application example
APP1O  = $(APP1).o $(ILBMO) $(M)screendump.o $(M)copychunks.o
APP2O  = $(APP2).o $(IFFO) $(ILBMRO) $(ILBMLO) $(ILBMSO)
APP3O  = $(APP3).o $(IFFO)
APP4O  = $(APP4).o $(IFFO) $(ILBMRO) $(ILBMLO) $(M)bmprintc.o
APP5O  = $(APP5).o $(IFFO) $(ILBMRO) $(ILBMLO)
APP6O  = $(APP6).o $(IFFO) $(ILBMWO)
APP7O  = $(APP7).o $(IFFO) $(ILBMWO)
APP8O  = $(APP8).o $(IFFO) $(ILBMRO) $(ILBMLO) $(ILBMSO) $(ILBMWO)
APP9O  = $(APP9).o $(IFFO) $(ILBMRO) $(ILBMLO) $(ILBMSO) $(ILBMWO)
APP10O = $(APP10).o $(IFFO)

.SUFFIXES:
.SUFFIXES:	.o .c .h .asm .i

# Make all of the applications
all: $(APP1) $(APP2) $(APP3) $(APP4) $(APP5) $(APP6) $(APP7) $(APP8) $(APP9) $(APP10)

# Linkage for each application

$(APP1): $(APP1O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP1O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP1) $(LFLAGS)
<

$(APP2): $(APP2O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP2O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP2) $(LFLAGS)
<

$(APP3): $(APP3O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP3O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP3) $(LFLAGS)
<

$(APP4): $(APP4O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP4O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP4) $(LFLAGS)
<

$(APP5): $(APP5O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP5O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP5) $(LFLAGS)
<

$(APP6): $(APP6O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP6O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP6) $(LFLAGS)
<

$(APP7): $(APP7O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP7O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP7) $(LFLAGS)
<

$(APP8): $(APP8O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP8O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP8) $(LFLAGS)
<

$(APP9): $(APP9O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP9O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP9) $(LFLAGS)
<

$(APP10): $(APP10O)
  $(LINKER) <WITH <
FROM $(STARTUP) $(APP10O)
LIBRARY $(LIBS) $(MYLIBS)
TO $(APP10) $(LFLAGS)
<

.c.o:
	$(CC) $(CFLAGS) $*.c

.asm.o:
	$(ASM) $(AFLAGS) $*.asm

