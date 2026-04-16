/*
 * cli_math_globals.c — CLI-only definitions of the math-library base
 * globals referenced by VBCC softfloat codegen.
 *
 * The LIBRARY (quickjs.library) owns OpenLibrary/CloseLibrary for these.
 * The CLI just mirrors the pointers via the QJS_GetMathBase LVO — see
 * quickjs_bridge.c:qjs_cli_math_bind. Keeping the bare-pointer globals
 * in their own tiny TU avoids pulling sharedlib_math_soft.c (and its
 * OpenLibrary calls + sin/cos implementations) into the CLI.
 */

struct Library;

struct Library *MathIeeeDoubBasBase;
struct Library *MathIeeeDoubTransBase;
struct Library *MathIeeeSingBasBase;
