/* strtodtest.c -- test strtod and float arithmetic, no %g printf */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* Extract high 32 bits of double (big-endian) */
static unsigned long dbl_hi(double d)
{
    unsigned char *p = (unsigned char *)&d;
    return ((unsigned long)p[0] << 24) | ((unsigned long)p[1] << 16) |
           ((unsigned long)p[2] <<  8) |  (unsigned long)p[3];
}
/* Extract low 32 bits of double (big-endian) */
static unsigned long dbl_lo(double d)
{
    unsigned char *p = (unsigned char *)&d;
    return ((unsigned long)p[4] << 24) | ((unsigned long)p[5] << 16) |
           ((unsigned long)p[6] <<  8) |  (unsigned long)p[7];
}

int main(void)
{
    double d;
    double sqrt2 = sqrt(2.0);
    char *end;
    unsigned long hi, lo;

    /* Test 1: print raw bits of sqrt(2) */
    hi = dbl_hi(sqrt2);
    lo = dbl_lo(sqrt2);
    printf("sqrt(2) hi=%08lx lo=%08lx\n", hi, lo);
    /* Expected: hi=3FF6A09E lo=667F3BCD */

    /* Test 2: strtod */
    d = strtod("3.14", &end);
    hi = dbl_hi(d);
    lo = dbl_lo(d);
    printf("strtod(3.14) hi=%08lx lo=%08lx\n", hi, lo);
    /* Expected: hi=400051EB lo=851EB852 */

    /* Test 3: basic float arithmetic */
    d = sqrt2 * sqrt2;
    hi = dbl_hi(d);
    lo = dbl_lo(d);
    printf("sqrt2*sqrt2 hi=%08lx lo=%08lx\n", hi, lo);
    /* Expected: close to 1.0 = 3FF00000 00000000 */

    /* Test 4: floor and multiply for digit extraction */
    d = sqrt2;
    printf("floor test: ");
    {
        int i;
        double tmp = d;
        int dig;
        /* tmp is in [1.0, 10.0), extract first digit */
        dig = (int)tmp;
        printf("%d.", dig);
        tmp = (tmp - (double)dig) * 10.0;
        for (i = 0; i < 16; i++) {
            dig = (int)tmp;
            printf("%d", dig);
            tmp = (tmp - (double)dig) * 10.0;
        }
        printf("\n");
    }

    return 0;
}
