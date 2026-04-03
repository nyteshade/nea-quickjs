/*
 * qjs_debug.c — Debug logging for quickjs.library
 * Separate file to avoid proto/dos.h warning overflow in quickjs.c
 */
#include <exec/types.h>
#include <proto/exec.h>
#include <proto/dos.h>

extern struct Library *DOSBase;

static BPTR _dbg_fh = 0;

void JS_InitDebugLog(void)
{
    if (_dbg_fh || !DOSBase) return;
    _dbg_fh = Open("RAM:qjs_debug.log", MODE_NEWFILE);
}

void JS_CloseDebugLog(void)
{
    if (_dbg_fh) { Close(_dbg_fh); _dbg_fh = 0; }
}

void _qjs_dbg(const char *msg)
{
    long len;
    if (!_dbg_fh) return;
    for (len = 0; msg[len]; len++) ;
    Write(_dbg_fh, msg, len);
}
