/* exit-reload.c -- smallest function found that shows the "constant
 * reloaded at the exit label" bug of vbccm68k (see README.md here).
 * Reduced from JS_GetScriptOrModuleName in quickjs.c.
 *
 * Compile with the options "vc +aos68k -cpu=68020 -O1" passes:
 *
 *     vbccm68k -quiet exit-reload.c -o=exit-reload.s -O=991 -cpu=68020
 *
 * A bad compiler keeps the constant 0 of "return 0" in d0 for the
 * whole function and loads it again at the exit label, after the call:
 *
 *         jsr     _g
 *         addq.w  #4,a7
 *     l1
 *         moveq   #0,d0       <-- f() returns 0 instead of g()'s result
 *         rts
 *
 * A good compiler has nothing between the exit label and the rts.
 * check-compiler.sh runs this test.
 */
struct node { struct node *prev; };
extern int g(struct node *);

int f(struct node *sf, int n)
{
    if (!sf)
        return 0;
    while (n-- > 0) {
        sf = sf->prev;
        if (!sf)
            return 0;
    }
    return g(sf);
}
