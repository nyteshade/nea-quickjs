/*
 * sftest.c - Amiga program: checks sharedlib_softfp.s against the
 * vectors written by gen.c. Built and run by run.sh under vamos.
 *
 *   sftest vectors.bin
 *
 * Every routine is called the way compiled code calls it: through the
 * jump table, "jsr -N(a6)", operands in d0:d1 and d2:d3. qjs_dcmp is
 * called as the C function it is. Prints each mismatch (up to 40) and
 * a count per operation; the last line is "PASS" or "FAIL".
 *
 * No double arithmetic happens in this file, only moves of bit
 * patterns, so it does not depend on the code under test to judge it.
 */
#include <stdio.h>
#include <string.h>

typedef unsigned long u32;

extern long qjs_softfp_bas;     /* labels: only their addresses are used */
extern long qjs_softfp_trans;
int qjs_dcmp(double a, double b);

/* the compiler's own soft-float calls in the C library go here too */
void *MathIeeeDoubBasBase = &qjs_softfp_bas;
void *MathIeeeDoubTransBase = &qjs_softfp_trans;
void *MathIeeeSingBasBase = 0;

typedef union { double d; u32 w[2]; } DU;

#define BIN(name, off) \
    static double name(__reg("a6") void *base, __reg("d0/d1") double a, \
                       __reg("d2/d3") double b) = "\tjsr\t" #off "(a6)";
#define UNA(name, off) \
    static double name(__reg("a6") void *base, __reg("d0/d1") double a) = \
        "\tjsr\t" #off "(a6)";
#define UNI(name, off) \
    static long name(__reg("a6") void *base, __reg("d0/d1") double a) = \
        "\tjsr\t" #off "(a6)";

BIN(v_add, -66) BIN(v_sub, -72) BIN(v_mul, -78) BIN(v_div, -84)
UNA(v_floor, -90) UNA(v_ceil, -96) UNA(v_neg, -60) UNA(v_abs, -54)
UNI(v_fix, -30) UNI(v_tst, -48) UNI(v_tieee, -102)
static long v_cmp(__reg("a6") void *base, __reg("d0/d1") double a,
                  __reg("d2/d3") double b) = "\tjsr\t-42(a6)";
static double v_flt(__reg("a6") void *base, __reg("d0") long a) = "\tjsr\t-36(a6)";
static double v_fieee(__reg("a6") void *base, __reg("d0") long a) = "\tjsr\t-108(a6)";

static const char *names[] = { "add", "sub", "mul", "div", "dcmp", "cmp",
    "tst", "fix", "flt", "floor", "ceil", "tieee", "fieee", "neg", "abs" };
#define NOPS 15

static int is_nan(u32 hi, u32 lo)
{
    return (hi & 0x7ff00000UL) == 0x7ff00000UL && ((hi & 0xfffffUL) | lo) != 0;
}

int main(int argc, char **argv)
{
    static u32 rec[7 * 512];
    static u32 total[NOPS], bad[NOPS];
    FILE *f;
    size_t got;
    int i, shown = 0, fail = 0;
    void *bas = &qjs_softfp_bas, *trans = &qjs_softfp_trans;

    if (argc < 2 || !(f = fopen(argv[1], "rb"))) {
        printf("cannot open vectors\nFAIL\n");
        return 20;
    }
    while ((got = fread(rec, 28, 512, f)) > 0) {
        size_t k;
        for (k = 0; k < got; k++) {
            u32 *r = rec + 7 * k;
            u32 op = r[0];
            DU a, b, res;
            int is_double = 1, ok;
            a.w[0] = r[1]; a.w[1] = r[2]; b.w[0] = r[3]; b.w[1] = r[4];
            res.w[0] = 0; res.w[1] = 0;
            switch (op) {
            case 0: res.d = v_add(bas, a.d, b.d); break;
            case 1: res.d = v_sub(bas, a.d, b.d); break;
            case 2: res.d = v_mul(bas, a.d, b.d); break;
            case 3: res.d = v_div(bas, a.d, b.d); break;
            case 4: res.w[1] = (u32)qjs_dcmp(a.d, b.d); is_double = 0; break;
            case 5: res.w[1] = (u32)v_cmp(bas, a.d, b.d); is_double = 0; break;
            case 6: res.w[1] = (u32)v_tst(bas, a.d); is_double = 0; break;
            case 7: res.w[1] = (u32)v_fix(bas, a.d); is_double = 0; break;
            case 8: res.d = v_flt(bas, (long)a.w[0]); break;
            case 9: res.d = v_floor(bas, a.d); break;
            case 10: res.d = v_ceil(bas, a.d); break;
            case 11: res.w[1] = (u32)v_tieee(trans, a.d); is_double = 0; break;
            case 12: res.d = v_fieee(trans, (long)a.w[0]); break;
            case 13: res.d = v_neg(bas, a.d); break;
            case 14: res.d = v_abs(bas, a.d); break;
            default: printf("bad op %lu\nFAIL\n", op); return 20;
            }
            total[op]++;
            ok = res.w[0] == r[5] && res.w[1] == r[6];
            /* any NaN is as good as another, except where the operation
               is defined on the bits (neg, abs) */
            if (!ok && is_double && op != 13 && op != 14 &&
                is_nan(res.w[0], res.w[1]) && is_nan(r[5], r[6]))
                ok = 1;
            if (!ok) {
                bad[op]++;
                fail = 1;
                if (shown < 40) {
                    shown++;
                    printf("%s %08lx%08lx %08lx%08lx: got %08lx%08lx want %08lx%08lx\n",
                           names[op], r[1], r[2], r[3], r[4],
                           res.w[0], res.w[1], r[5], r[6]);
                }
            }
        }
    }
    fclose(f);
    for (i = 0; i < NOPS; i++)
        printf("%-6s %7lu checked %7lu wrong\n", names[i], total[i], bad[i]);
    printf(fail ? "FAIL\n" : "PASS\n");
    return fail ? 20 : 0;
}
