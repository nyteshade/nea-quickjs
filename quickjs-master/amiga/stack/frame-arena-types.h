/*
 * frame-arena-types.h - where the interpreter keeps the arguments,
 * variables and operand stack of running functions when the compiler
 * has no alloca() (vbcc). Included by quickjs.c just before struct
 * JSRuntime, which embeds one JSFrameArena. The code and the reasons
 * are in frame-arena.h.
 */
#ifndef QJS_FRAME_ARENA_TYPES_H
#define QJS_FRAME_ARENA_TYPES_H

typedef struct JSFrameChunk {
    struct JSFrameChunk *prev;  /* the chunk in use before this one */
    uint8_t *prev_top;          /* its top when this one was started */
    size_t size;                /* bytes of data after this header */
} JSFrameChunk;

typedef struct JSFrameArena {
    uint8_t *top;               /* first free byte of the current chunk */
    uint8_t *end;               /* end of the current chunk */
    uint8_t *base;              /* start of its data */
    JSFrameChunk *chunk;        /* the current chunk, NULL before the first */
    JSFrameChunk *spare;        /* one emptied chunk kept for reuse */
} JSFrameArena;

#endif /* QJS_FRAME_ARENA_TYPES_H */
