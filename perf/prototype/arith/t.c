#include <stdio.h>
unsigned long long umul64_w(unsigned long a, unsigned long b);
unsigned long long umul64_l(unsigned long a, unsigned long b);
unsigned long long udiv64_16(unsigned long long n, unsigned long d, unsigned long *rem);
unsigned long long udiv64_32l(unsigned long long n, unsigned long d, unsigned long *rem);
/* overflow-checked signed ops using the V flag directly (vbcc inline-asm functions) */
long addv(__reg("d0") long a, __reg("d1") long b, __reg("a0") long *ovf) = "\tadd.l\td1,d0\n\tsvs\t(a0)";
long subv(__reg("d0") long a, __reg("d1") long b, __reg("a0") long *ovf) = "\tsub.l\td1,d0\n\tsvs\t(a0)";
long mulv(__reg("d0") long a, __reg("d1") long b, __reg("a0") long *ovf) = "\tmuls.l\td1,d0\n\tsvs\t(a0)";
static unsigned long seed = 12345;
static unsigned long rnd(void){ seed = seed*1103515245UL + 12345UL; return seed ^ (seed>>13); }
int main(void){
    long i, bad = 0; unsigned long r1, r2;
    static const unsigned long edge[] = {0,1,2,0xffff,0x10000,0x10001,0x7fffffff,0x80000000UL,0x80000001UL,0xfffffffeUL,0xffffffffUL,10,1000000000UL};
    for (i = 0; i < 20000; i++) {
        unsigned long a = i < 169 ? edge[i/13] : rnd(), b = i < 169 ? edge[i%13] : rnd();
        unsigned long long n = ((unsigned long long)rnd() << 32) | b;
        unsigned long d16 = (a & 0xffff) ? (a & 0xffff) : 10;
        volatile unsigned char o1 = 0, o2 = 0, o3 = 0; long s; long long w;
        if (umul64_w(a,b) != umul64_l(a,b)) { bad++; printf("mul %lx %lx\n", a, b); }
        if (udiv64_16(n,d16,&r1) != udiv64_32l(n,d16,&r2) || r1 != r2) { bad++; printf("div %lx%08lx / %lx\n",(unsigned long)(n>>32),(unsigned long)n,d16); }
        s = addv((long)a,(long)b,(long*)&o1); w = (long long)(long)a + (long)b; if ((o1 != 0) != (w != (long)w) || (!o1 && s != (long)w)) { bad++; printf("addv %lx %lx\n",a,b); }
        s = subv((long)a,(long)b,(long*)&o2); w = (long long)(long)a - (long)b; if ((o2 != 0) != (w != (long)w) || (!o2 && s != (long)w)) { bad++; printf("subv %lx %lx\n",a,b); }
        s = mulv((long)a,(long)b,(long*)&o3); w = (long long)(long)a * (long)b; if ((o3 != 0) != (w != (long)w) || (!o3 && s != (long)w)) { bad++; printf("mulv %lx %lx\n",a,b); }
        if (bad > 10) break;
    }
    printf("iterations=%ld mismatches=%ld\n", i, bad);
    return 0;
}
