/* Test anonymous struct/union support in SAS/C */
struct Test1 {
    union {             /* anonymous union */
        int a;
        short b;
    };
    int c;
};

struct Test2 {
    union {
        int header;
        struct {        /* anonymous struct inside union */
            short x;
            short y;
        };
    };
};

int main(void) {
    struct Test1 t1;
    struct Test2 t2;
    t1.a = 1;    /* access anonymous union member directly */
    t1.c = 2;
    t2.x = 3;    /* access anonymous struct member directly */
    return 0;
}
