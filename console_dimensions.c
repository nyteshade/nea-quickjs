#include <exec/types.h>
#include <dos/dos.h>
#include <proto/dos.h>
#include <stdio.h>
#include <string.h>

#define CSI "\233"   /* 0x9B */

/*
  Read current shell window size from console.device via:
  Window Status Request: CSI 0 q
  Window Bounds Report:  CSI 1;1;<rows>;<cols> r
*/
LONG GetShellSize(LONG *rows, LONG *cols)
{
  BPTR in, out;
  char req[] = CSI "0 q";
  char buf[128];
  LONG got;
  LONG r, c;

  in  = Input();
  out = Output();

  if (!IsInteractive(in) || !IsInteractive(out))
    return 0;

  if (Write(out, req, sizeof(req) - 1) != (LONG)(sizeof(req) - 1))
    return 0;

  /*
    Read reply. In practice this usually arrives in one piece, but
    we still allow for partial reads by accumulating until 'r' appears
    or buffer fills.
  */
  got = 0;
  while (got < (LONG)(sizeof(buf) - 1))
  {
    LONG rc;
    char ch;

    rc = Read(in, &ch, 1);
    if (rc <= 0)
      break;

    buf[got++] = ch;
    if (ch == 'r')
      break;
  }

  if (got <= 0)
    return 0;

  buf[got] = '\0';

  /*
    Accept either:
      CSI 1;1;<rows>;<cols> r    (0x9B prefix)
    or
      ESC [ 1;1;<rows>;<cols> r
  */
  if ((UBYTE)buf[0] == 0x9B)
  {
    if (sscanf(buf + 1, "1;1;%ld;%ld r", &r, &c) == 2)
    {
      *rows = r;
      *cols = c;
      return 1;
    }
  }
  else if (got >= 2 && buf[0] == 0x1B && buf[1] == '[')
  {
    if (sscanf(buf + 2, "1;1;%ld;%ld r", &r, &c) == 2)
    {
      *rows = r;
      *cols = c;
      return 1;
    }
  }

  return 0;
}

enum
{
  ARG_WIDTH = 0,
  ARG_COLS,
  ARG_HEIGHT,
  ARG_ROWS,
  ARG_COUNT
};

int main(void)
{
  static const char *template = "WIDTH/S,COLS/S,HEIGHT/S,ROWS/S";
  LONG *opts[ARG_COUNT];
  struct RDArgs *rda;
  LONG rows = 0, cols = 0;
  LONG wantWidth, wantHeight;

  memset(opts, 0, sizeof(opts));

  rda = ReadArgs((STRPTR)template, opts, NULL);
  if (!rda)
  {
    PrintFault(IoErr(), NULL);
    return RETURN_FAIL;
  }

  if (!GetShellSize(&rows, &cols))
  {
    PutStr("Unable to determine shell size\n");
    FreeArgs(rda);
    return RETURN_WARN;
  }

  wantWidth  = (opts[ARG_WIDTH]  != 0) || (opts[ARG_COLS] != 0);
  wantHeight = (opts[ARG_HEIGHT] != 0) || (opts[ARG_ROWS] != 0);

  if (wantWidth && !wantHeight)
  {
    Printf("%ld\n", cols);
  }
  else if (wantHeight && !wantWidth)
  {
    Printf("%ld\n", rows);
  }
  else
  {
    Printf("%ldx%ld\n", cols, rows);
  }

  FreeArgs(rda);
  return RETURN_OK;
}
