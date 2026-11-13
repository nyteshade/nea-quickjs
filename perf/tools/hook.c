/* PC-histogram + call-tree profiler hook for Musashi (amitools vamos).
 * Installed via ctypes with m68k_set_instr_hook_callback. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define RAM_LIMIT (64u*1024u*1024u)
#define NSLOT (RAM_LIMIT/2)
#define MAXDEPTH 65536
#define M68K_REG_SP 18  /* enum index: D0..D7,A0..A7,PC,SR,SP */

static uint32_t *hist;       /* per (pc>>1) execution count (saturating not needed) */
static uint32_t *entryidx;   /* per (pc>>1): function index+1 or 0 */
static uint64_t total;
static unsigned (*get_reg)(void *, int);
static unsigned (*rd32)(unsigned);

typedef struct { uint32_t ret, sp, fn; uint64_t start; } frame_t;
static frame_t stk[MAXDEPTH];
static int depth;
static uint32_t nfn, capfn;
static uint64_t *incl; static uint32_t *active; static uint64_t *calls;
static uint64_t dropped;

static void pop1(void) {
    frame_t *f = &stk[--depth];
    if (--active[f->fn] == 0) incl[f->fn] += total - 1 - f->start;
}

void prof_hook(unsigned pc) {
    total++;
    if (pc < RAM_LIMIT) {
        uint32_t s = pc >> 1;
        hist[s]++;
        if (depth > 0 && stk[depth-1].ret == pc) {
            unsigned sp = get_reg(0, M68K_REG_SP);
            while (depth > 0 && stk[depth-1].ret == pc && stk[depth-1].sp + 4 == sp) pop1();
        }
        uint32_t e = entryidx[s];
        if (e) {
            unsigned sp = get_reg(0, M68K_REG_SP);
            /* discard dead frames (entered at or below this sp) */
            while (depth > 0 && stk[depth-1].sp <= sp) pop1();
            if (depth < MAXDEPTH) {
                frame_t *f = &stk[depth++];
                f->ret = rd32(sp); f->sp = sp; f->fn = e - 1; f->start = total - 1;
                active[f->fn]++; calls[f->fn]++;
            } else dropped++;
        }
    }
}

int prof_init(void *get_reg_fn, void *rd32_fn) {
    hist = calloc(NSLOT, 4); entryidx = calloc(NSLOT, 4);
    get_reg = (unsigned (*)(void*,int))get_reg_fn; rd32 = (unsigned (*)(unsigned))rd32_fn;
    return hist && entryidx;
}
/* register function entries (absolute addresses); returns first index */
int prof_add_entries(const uint32_t *addrs, int n) {
    uint32_t first = nfn;
    if (nfn + n > capfn) {
        capfn = (nfn + n) * 2;
        incl = realloc(incl, capfn * 8); active = realloc(active, capfn * 4); calls = realloc(calls, capfn * 8);
    }
    for (int i = 0; i < n; i++) {
        incl[nfn] = 0; active[nfn] = 0; calls[nfn] = 0;
        if (addrs[i] < RAM_LIMIT) entryidx[addrs[i] >> 1] = nfn + 1;
        nfn++;
    }
    return first;
}
uint64_t prof_total(void) { return total; }
int prof_dump(const char *path) {
    while (depth > 0) { total++; pop1(); total--; }
    FILE *f = fopen(path, "wb"); if (!f) return -1;
    fprintf(f, "total %llu\ndropped %llu\n", (unsigned long long)total, (unsigned long long)dropped);
    for (uint32_t i = 0; i < nfn; i++)
        if (calls[i]) fprintf(f, "F %u %llu %llu\n", i, (unsigned long long)calls[i], (unsigned long long)incl[i]);
    for (uint32_t s = 0; s < NSLOT; s++)
        if (hist[s]) fprintf(f, "P %x %u\n", s << 1, hist[s]);
    fclose(f); return 0;
}
