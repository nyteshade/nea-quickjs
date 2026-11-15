/*
 * frame-arena.h - memory for the frames of running functions, where
 * the compiler has no alloca() (vbcc on AmigaOS).
 *
 * Not a header in the usual sense: quickjs.c includes it once, after
 * the memory functions it uses. It is a file of its own so that
 * quickjs.c does not grow by it.
 *
 * WHAT IT REPLACES. The interpreter takes the arguments, variables and
 * operand stack of every function it enters with alloca(), and so do
 * the wrappers that pad a native function's arguments. vbcc has no
 * alloca (it addresses locals from the stack pointer, which therefore
 * may not move inside a function), so include/amiga_compat_vbcc.h
 * defined alloca(n) as AllocVec(n) - and nothing ever freed it. Every
 * call of a JavaScript function took 30 to a few hundred bytes from
 * the system for good: a loop of 200,000 calls left 6.4 MB missing
 * that did not come back when qjs ended, because AllocVec memory is
 * not tied to the program. (Measured under vamos on 0.239; see
 * amiga/tests/test_stack_chain.js, "the memory comes back".) It was
 * also slow: one exec.library call per JavaScript call.
 *
 * WHAT IT IS. Frames are taken and given back strictly last-in,
 * first-out: a function gives its frame back when it returns, and the
 * engine has no other way out of a function than returning (errors are
 * return values; there is no longjmp). So a stack suffices: a pointer
 * that moves up on entry and back on exit, in chunks taken from the
 * runtime's allocator when the current one is full. Taking a frame is
 * a compare and an add; giving it back is a compare and a move.
 *
 * This is a second stack beside the C stack, for data only. It has
 * nothing to do with the chained C stack of stack-chain.h except that
 * both exist because of what AmigaOS and vbcc do not provide.
 *
 * Generator and async functions are not concerned: their frames have
 * always been heap objects of their own (async_func_init).
 */
#ifndef QJS_FRAME_ARENA_H
#define QJS_FRAME_ARENA_H

/* Data bytes of an ordinary chunk. A plain call takes 30 to 100 bytes,
 * so one chunk holds the frames of a hundred or two nested calls, which
 * is deeper than most scripts ever go; a frame larger than this gets a
 * chunk of its own size. The first chunk is taken at the first call
 * and kept for the life of the runtime. */
#define JS_FRAME_CHUNK_SIZE 8192

static void *js_frame_alloc_slow(JSRuntime *rt, size_t size);
static void js_frame_free_slow(JSRuntime *rt, void *ptr);

/* Take `size` bytes (a multiple of 4: frames are made of JSValues and
 * pointers). NULL when memory is exhausted. `size` is evaluated more
 * than once. Macros, not functions: vbcc does not inline at -O1 and
 * this is on the path of every call. */
#define js_frame_alloc(rt, size)                                        \
    ((size_t)((rt)->frame_arena.end - (rt)->frame_arena.top) >=         \
         (size_t)(size) ?                                               \
     ((rt)->frame_arena.top += (size),                                  \
      (void *)((rt)->frame_arena.top - (size))) :                       \
     js_frame_alloc_slow(rt, size))

/* Give back the frame at `ptr` and everything taken after it. */
#define js_frame_free(rt, ptr)                                          \
    do {                                                                \
        if ((size_t)((uint8_t *)(ptr) - (rt)->frame_arena.base) <       \
            (size_t)((rt)->frame_arena.end - (rt)->frame_arena.base))   \
            (rt)->frame_arena.top = (uint8_t *)(ptr);                   \
        else                                                            \
            js_frame_free_slow(rt, ptr);                                \
    } while (0)

/* Frames are not on the C stack: the stack checks need not allow for
 * them. */
#define js_frame_stack_need(size) 0

/* The current chunk is full: continue on the spare one or a new one. */
static void *js_frame_alloc_slow(JSRuntime *rt, size_t size)
{
    JSFrameArena *a = &rt->frame_arena;
    JSFrameChunk *chunk;
    size_t data_size;

    chunk = a->spare;
    if (chunk && chunk->size >= size) {
        a->spare = NULL;
    } else {
        data_size = size > JS_FRAME_CHUNK_SIZE ? size : JS_FRAME_CHUNK_SIZE;
        chunk = js_malloc_rt(rt, sizeof(*chunk) + data_size);
        if (!chunk)
            return NULL;
        chunk->size = data_size;
    }
    chunk->prev = a->chunk;
    chunk->prev_top = a->top;
    a->chunk = chunk;
    a->base = (uint8_t *)(chunk + 1);
    a->end = a->base + chunk->size;
    a->top = a->base + size;
    return a->base;
}

/* `ptr` is not inside the current chunk: the chunks above the one it
 * is in are empty now. One is kept so that a loop whose calls cross
 * the end of a chunk does not allocate on every turn; an emptied chunk
 * also stays current until a frame below it is given back, so such a
 * loop does not even come here. */
static void js_frame_free_slow(JSRuntime *rt, void *ptr)
{
    JSFrameArena *a = &rt->frame_arena;
    JSFrameChunk *chunk;

    /* <= end: a frame of no bytes taken from a full chunk lies at its end */
    while (a->chunk &&
           !((uint8_t *)ptr >= a->base && (uint8_t *)ptr <= a->end)) {
        chunk = a->chunk;
        a->chunk = chunk->prev;
        a->top = chunk->prev_top;
        if (a->chunk) {
            a->base = (uint8_t *)(a->chunk + 1);
            a->end = a->base + a->chunk->size;
        } else {
            a->base = a->end = a->top = NULL;
        }
        if (!a->spare && chunk->size == JS_FRAME_CHUNK_SIZE)
            a->spare = chunk;
        else
            js_free_rt(rt, chunk);
    }
    if (a->chunk)
        a->top = (uint8_t *)ptr;
}

/* JS_RunGC: memory is wanted, and the spare chunk is held for speed
 * only. */
static void js_frame_release_spare(JSRuntime *rt)
{
    JSFrameArena *a = &rt->frame_arena;

    if (a->spare) {
        js_free_rt(rt, a->spare);
        a->spare = NULL;
    }
}

/* JS_FreeRuntime: nothing is running any more. */
static void js_frame_arena_free(JSRuntime *rt)
{
    JSFrameArena *a = &rt->frame_arena;
    JSFrameChunk *chunk;

    while ((chunk = a->chunk) != NULL) {
        a->chunk = chunk->prev;
        js_free_rt(rt, chunk);
    }
    if (a->spare)
        js_free_rt(rt, a->spare);
    memset(a, 0, sizeof(*a));
}

#endif /* QJS_FRAME_ARENA_H */
