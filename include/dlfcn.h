/*
 * dlfcn.h -- dynamic linking stub for SAS/C 6.58 / AmigaOS
 * AmigaOS uses libraries opened via OpenLibrary(), not dlopen().
 * All functions return NULL/error.
 */
#ifndef _AMIGA_DLFCN_H
#define _AMIGA_DLFCN_H

#define RTLD_LAZY    1
#define RTLD_NOW     2
#define RTLD_GLOBAL  4
#define RTLD_LOCAL   0
#define RTLD_DEFAULT ((void *)0)

void  *dlopen(const char *filename, int flag);
void  *dlsym(void *handle, const char *symbol);
int    dlclose(void *handle);
char  *dlerror(void);

#endif /* _AMIGA_DLFCN_H */
