#include <stdio.h>
long d2i_bits(const unsigned long *p);
int dbl_is_i32(const unsigned long *p, long *out);
static unsigned long seed = 99;
static unsigned long rnd(void){ seed = seed*1103515245UL + 12345UL; return seed ^ (seed>>11); }
int main(void){
    long i, bad = 0, nint = 0;
    for (i = 0; i < 40000; i++) {
        union { double d; unsigned long w[2]; } u; volatile double vd; long ref, got, o = 0; int isint, refint;
        int mode = i & 3;
        if (mode == 0) { u.d = (double)(long)rnd(); }                       /* exact ints */
        else if (mode == 1) { u.d = (double)(long)rnd() / 1024.0; }         /* fractions */
        else if (mode == 2) { u.d = (double)((long)rnd() >> (rnd() & 31)) * 0.5; }
        else { u.w[0] = rnd(); u.w[1] = rnd(); }                             /* random bit patterns */
        vd = u.d;
        if (((u.w[0] >> 20) & 0x7ff) <= 1023 + 30) {
            ref = (long)vd; got = d2i_bits(u.w);
            if (ref != got) { bad++; printf("d2i %08lx:%08lx ref=%ld got=%ld\n", u.w[0], u.w[1], ref, got); }
            refint = (vd == (double)ref) && !(ref == 0 && (u.w[0] >> 31));
        } else {
            refint = (u.w[0] == 0xc1e00000UL && u.w[1] == 0); ref = (long)0x80000000UL;
        }
        isint = dbl_is_i32(u.w, &o);
        if (isint != refint || (isint && o != ref)) { bad++; printf("isint %08lx:%08lx ref=%d got=%d\n", u.w[0], u.w[1], refint, isint); }
        nint += isint;
        if (bad > 10) break;
    }
    printf("iterations=%ld int32-valued=%ld mismatches=%ld\n", i, nint, bad);
    return 0;
}
