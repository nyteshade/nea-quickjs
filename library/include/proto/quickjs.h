#ifndef PROTO_QUICKJS_H
#define PROTO_QUICKJS_H

/*
**  $VER: quickjs.h 0.49 (27.3.2026)
**
**  Lattice 'C' style prototype/pragma header file combo
**  for quickjs.library
*/

/****************************************************************************/

#ifdef _NO_INLINE

#include <clib/quickjs_protos.h>

#else

/****************************************************************************/

#ifndef __NOLIBBASE__

extern struct Library *QuickJSBase;

#endif /* __NOLIBBASE__ */

/****************************************************************************/

#if defined(LATTICE) || defined(__SASC) || defined(_DCC)

#ifndef PRAGMAS_QUICKJS_PRAGMAS_H
#include <pragmas/quickjs_pragmas.h>
#endif /* PRAGMAS_QUICKJS_PRAGMAS_H */

/****************************************************************************/

#elif defined(__VBCC__)

#include <clib/quickjs_protos.h>

/****************************************************************************/

#elif defined(__GNUC__)

#if defined(mc68000)
#include <clib/quickjs_protos.h>
#else
#include <clib/quickjs_protos.h>
#endif /* mc68000 */

/****************************************************************************/

/* Any other compiler */
#else

#include <clib/quickjs_protos.h>

/****************************************************************************/

#endif

/****************************************************************************/

#endif /* _NO_INLINE */

/****************************************************************************/

#endif /* PROTO_QUICKJS_H */
