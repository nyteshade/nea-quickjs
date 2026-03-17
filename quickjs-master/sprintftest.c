/* sprintftest.c -- test sprintf %g with MATH=68881 on SAS/C */
#include <stdio.h>
#include <string.h>

int main(void)
{
    double d1 = 1.4142135623730951;
    double d2 = 3.14159265358979;
    double d3 = 0.0;
    double d4 = -1.5;
    char buf[64];

    sprintf(buf, "%.17g", d1);
    printf("sqrt2:  [%s]\n", buf);

    sprintf(buf, "%.17g", d2);
    printf("pi:     [%s]\n", buf);

    sprintf(buf, "%.17g", d3);
    printf("zero:   [%s]\n", buf);

    sprintf(buf, "%.17g", d4);
    printf("neg:    [%s]\n", buf);

    /* also test %e and %f */
    sprintf(buf, "%e", d1);
    printf("%%e:     [%s]\n", buf);

    sprintf(buf, "%f", d1);
    printf("%%f:     [%s]\n", buf);

    /* test printf directly */
    printf("direct: %.17g\n", d1);

    return 0;
}
