/*
 * sharedlib_posix.c -- POSIX function implementations for shared library.
 *
 * Provides the POSIX functions that quickjs-libc.c needs, using
 * AmigaOS dos.library calls via explicit LVO dispatch. No proto/dos.h,
 * no C startup code, no global DOSBase from amiga.lib.
 *
 * DOSBase is stored as a file-scope variable, set during library init
 * via sharedlib_posix_init(). This is the same pattern used by
 * sharedlib_time.c for DateStamp access.
 *
 * All dos.library calls go through the DOS_LVO macro which casts the
 * library base pointer and dispatches through the jump table at the
 * appropriate negative offset.
 */

/* Include our POSIX types FIRST to set guards before AmigaOS headers */
#include <stddef.h>
#include <string.h>
#include <errno.h>
#include "sharedlib_posix.h"

/* ---- AmigaOS includes (amiga-aligned) ---- */
/* sharedlib_posix.h already defined struct timeval with POSIX fields.
 * Prevent devices/timer.h from redefining it by setting its guard. */
#define DEVICES_TIMER_H 1
#pragma amiga-align
#include <exec/types.h>
#include <exec/memory.h>
#include <dos/dos.h>
#include <dos/dosextens.h>
#include <dos/datetime.h>
#pragma default-align

/* ================================================================
 * DOSBase -- set via sharedlib_posix_init() from CustomLibInit.
 * ================================================================ */
/* Non-static so sharedlib_stdio.c can access it */
struct Library *sl_DOSBase;

void sharedlib_posix_init(struct Library *dosBase)
{
    sl_DOSBase = dosBase;
}

void sharedlib_posix_cleanup(void)
{
    sl_DOSBase = NULL;
}

/* ================================================================
 * dos.library LVO dispatch macros
 *
 * Each macro performs a direct call through the library jump table.
 * Register assignments match the AmigaOS calling convention.
 * ================================================================ */
#define DOS_LVO(base, offset, type) \
    ((type)((char *)(base) - (offset)))

/* dos.library wrappers using VBCC inline assembly syntax.
 * `function = "asm";` embeds the jsr directly at the call site,
 * sidestepping the __reg("a6") frame pointer corruption that
 * affects function-pointer dispatch via DOS_LVO macro. */

static BPTR __sl_Open(__reg("a6") struct Library *base,
                      __reg("d1") const char *name,
                      __reg("d2") LONG mode) = "\tjsr\t-30(a6)";
#define sl_Open(n,m) __sl_Open(sl_DOSBase, (n), (m))

static LONG __sl_Close(__reg("a6") struct Library *base,
                       __reg("d1") BPTR file) = "\tjsr\t-36(a6)";
#define sl_Close(f) __sl_Close(sl_DOSBase, (f))

static LONG __sl_DeleteFile(__reg("a6") struct Library *base,
                            __reg("d1") const char *name) = "\tjsr\t-72(a6)";
#define sl_DeleteFile(n) __sl_DeleteFile(sl_DOSBase, (n))

static LONG __sl_Rename(__reg("a6") struct Library *base,
                        __reg("d1") const char *o,
                        __reg("d2") const char *n) = "\tjsr\t-78(a6)";
#define sl_Rename(o,n) __sl_Rename(sl_DOSBase, (o), (n))

static BPTR __sl_Lock(__reg("a6") struct Library *base,
                      __reg("d1") const char *name,
                      __reg("d2") LONG type) = "\tjsr\t-84(a6)";
#define sl_Lock(n,t) __sl_Lock(sl_DOSBase, (n), (t))

static void __sl_UnLock(__reg("a6") struct Library *base,
                        __reg("d1") BPTR lock) = "\tjsr\t-90(a6)";
#define sl_UnLock(l) __sl_UnLock(sl_DOSBase, (l))

static BPTR __sl_DupLock(__reg("a6") struct Library *base,
                         __reg("d1") BPTR lock) = "\tjsr\t-96(a6)";
#define sl_DupLock(l) __sl_DupLock(sl_DOSBase, (l))

static LONG __sl_Examine(__reg("a6") struct Library *base,
                         __reg("d1") BPTR lock,
                         __reg("d2") struct FileInfoBlock *fib)
                         = "\tjsr\t-102(a6)";
#define sl_Examine(l,f) __sl_Examine(sl_DOSBase, (l), (f))

static LONG __sl_ExNext(__reg("a6") struct Library *base,
                        __reg("d1") BPTR lock,
                        __reg("d2") struct FileInfoBlock *fib)
                        = "\tjsr\t-108(a6)";
#define sl_ExNext(l,f) __sl_ExNext(sl_DOSBase, (l), (f))

static LONG __sl_Info(__reg("a6") struct Library *base,
                      __reg("d1") BPTR lock,
                      __reg("d2") struct InfoData *info)
                      = "\tjsr\t-114(a6)";
#define sl_Info(l,i) __sl_Info(sl_DOSBase, (l), (i))

static BPTR __sl_CreateDir(__reg("a6") struct Library *base,
                           __reg("d1") const char *name) = "\tjsr\t-120(a6)";
#define sl_CreateDir(n) __sl_CreateDir(sl_DOSBase, (n))

static BPTR __sl_CurrentDir(__reg("a6") struct Library *base,
                            __reg("d1") BPTR lock) = "\tjsr\t-126(a6)";
#define sl_CurrentDir(l) __sl_CurrentDir(sl_DOSBase, (l))

static LONG __sl_IoErr(__reg("a6") struct Library *base) = "\tjsr\t-132(a6)";
#define sl_IoErr() __sl_IoErr(sl_DOSBase)

static LONG __sl_SetProtection(__reg("a6") struct Library *base,
                               __reg("d1") const char *name,
                               __reg("d2") LONG protect)
                               = "\tjsr\t-186(a6)";
#define sl_SetProtection(n,p) __sl_SetProtection(sl_DOSBase, (n), (p))

static void __sl_Delay(__reg("a6") struct Library *base,
                       __reg("d1") LONG timeout) = "\tjsr\t-198(a6)";
#define sl_Delay(t) __sl_Delay(sl_DOSBase, (t))

static LONG __sl_WaitForChar(__reg("a6") struct Library *base,
                             __reg("d1") BPTR file,
                             __reg("d2") LONG timeout)
                             = "\tjsr\t-204(a6)";
#define sl_WaitForChar(f,t) __sl_WaitForChar(sl_DOSBase, (f), (t))

static LONG __sl_IsInteractive(__reg("a6") struct Library *base,
                               __reg("d1") BPTR file) = "\tjsr\t-216(a6)";
#define sl_IsInteractive(f) __sl_IsInteractive(sl_DOSBase, (f))

static BPTR __sl_Input(__reg("a6") struct Library *base) = "\tjsr\t-54(a6)";
#define sl_Input() __sl_Input(sl_DOSBase)

static BPTR __sl_Output(__reg("a6") struct Library *base) = "\tjsr\t-60(a6)";
#define sl_Output() __sl_Output(sl_DOSBase)

static LONG __sl_SetFileDate(__reg("a6") struct Library *base,
                             __reg("d1") const char *name,
                             __reg("d2") struct DateStamp *date)
                             = "\tjsr\t-396(a6)";
#define sl_SetFileDate(n,d) __sl_SetFileDate(sl_DOSBase, (n), (d))

static LONG __sl_NameFromLock(__reg("a6") struct Library *base,
                              __reg("d1") BPTR lock,
                              __reg("d2") char *buffer,
                              __reg("d3") LONG len)
                              = "\tjsr\t-402(a6)";
#define sl_NameFromLock(l,b,n) __sl_NameFromLock(sl_DOSBase, (l), (b), (n))

/* ================================================================
 * AmigaOS epoch offset
 *
 * AmigaOS: Jan 1, 1978.  Unix: Jan 1, 1970.
 * 8 years = 2922 days (includes leap years 1972, 1976).
 * 2922 * 86400 = 252,460,800 seconds.
 *
 * Note: The posixlib uses 252,457,200 which accounts for a 1-hour
 * timezone offset. We use the exact value for UTC correctness.
 * ================================================================ */
#define AMIGA_UNIX_EPOCH_DIFF  252460800L
#define TICKS_PER_SECOND       50

/* ================================================================
 * AmigaOS protection bit conversion
 *
 * AmigaOS owner RWED bits are inverted (0 = permission granted).
 * Group/Other bits are normal (1 = permission granted).
 * ================================================================ */

/* Convert AmigaOS protection bits to POSIX mode bits */
static mode_t prot2mode(unsigned long p)
{
    mode_t m = 0;

    /* Invert owner RWED bits for clarity */
    p ^= (FIBF_READ | FIBF_WRITE | FIBF_EXECUTE | FIBF_DELETE);

    if (p & FIBF_READ)                          m |= S_IRUSR;
    if (p & (FIBF_WRITE | FIBF_DELETE))         m |= S_IWUSR;
    if (p & (FIBF_EXECUTE | FIBF_SCRIPT))       m |= S_IXUSR;
    if (p & FIBF_GRP_READ)                      m |= S_IRGRP;
    if (p & (FIBF_GRP_WRITE | FIBF_GRP_DELETE)) m |= S_IWGRP;
    if (p & FIBF_GRP_EXECUTE)                   m |= S_IXGRP;
    if (p & FIBF_OTR_READ)                      m |= S_IROTH;
    if (p & (FIBF_OTR_WRITE | FIBF_OTR_DELETE)) m |= S_IWOTH;
    if (p & FIBF_OTR_EXECUTE)                   m |= S_IXOTH;

    return m;
}

/* Convert POSIX mode bits to AmigaOS protection bits */
static unsigned long mode2prot(mode_t m)
{
    unsigned long p = 0;

    if (m & S_IRUSR) p |= FIBF_READ;
    if (m & S_IWUSR) p |= FIBF_WRITE | FIBF_DELETE;
    if (m & S_IXUSR) p |= FIBF_EXECUTE;
    if (m & S_IRGRP) p |= FIBF_GRP_READ;
    if (m & S_IWGRP) p |= FIBF_GRP_WRITE | FIBF_GRP_DELETE;
    if (m & S_IXGRP) p |= FIBF_GRP_EXECUTE;
    if (m & S_IROTH) p |= FIBF_OTR_READ;
    if (m & S_IWOTH) p |= FIBF_OTR_WRITE | FIBF_OTR_DELETE;
    if (m & S_IXOTH) p |= FIBF_OTR_EXECUTE;

    /* Invert owner RWED bits back to AmigaOS convention */
    return p ^ (FIBF_READ | FIBF_WRITE | FIBF_EXECUTE | FIBF_DELETE);
}

/* Convert FileInfoBlock to struct stat */
static int fib2stat(struct FileInfoBlock *fib, struct stat *sb)
{
    blksize_t bs;

    /* Fields with no AmigaOS equivalent */
    sb->st_dev = 0;
    sb->st_rdev = 0;

    /* Assume no hard links */
    sb->st_nlink = 1;

    /* DiskKey is similar to a Unix inode */
    sb->st_ino = (ino_t)fib->fib_DiskKey;

    /* Convert protection bits and set file type */
    sb->st_mode = prot2mode((unsigned long)fib->fib_Protection);

    switch (fib->fib_DirEntryType) {
        case ST_PIPEFILE:
            sb->st_mode |= _S_IFIFO;
            break;
        case ST_SOFTLINK:
            sb->st_mode |= _S_IFLNK;
            break;
        case ST_ROOT:
        case ST_USERDIR:
        case ST_LINKDIR:
            sb->st_mode |= _S_IFDIR;
            break;
        default:
            sb->st_mode |= _S_IFREG;
            break;
    }

    /* UID/GID from FIB (multi-user filesystems may fill these) */
    sb->st_uid = (uid_t)fib->fib_OwnerUID;
    sb->st_gid = (gid_t)fib->fib_OwnerGID;

    /* All three times are the same on AmigaOS */
    sb->st_atime = sb->st_mtime = sb->st_ctime =
        (time_t)(AMIGA_UNIX_EPOCH_DIFF
                 + (unsigned long)(fib->fib_Date.ds_Days * 86400L
                                   + fib->fib_Date.ds_Minute * 60L
                                   + fib->fib_Date.ds_Tick / TICKS_PER_SECOND));

    /* Size in bytes and blocks */
    sb->st_size = (off_t)fib->fib_Size;
    sb->st_blocks = (blkcnt_t)fib->fib_NumBlocks;

    /* Estimate block size from blocks and file size */
    for (bs = 512; bs < 0x10000; bs <<= 1) {
        if ((off_t)sb->st_blocks * (off_t)bs >= sb->st_size)
            break;
    }
    sb->st_blksize = bs;

    sb->st_flags = 0;

    return 0;
}

/* Map AmigaOS IoErr() to errno */
static void ioerr2errno(void)
{
    LONG err = sl_IoErr();
    switch (err) {
        case ERROR_OBJECT_NOT_FOUND:
        case ERROR_DIR_NOT_FOUND:
            errno = ENOENT; break;
        case ERROR_OBJECT_IN_USE:
        case ERROR_READ_PROTECTED:
        case ERROR_WRITE_PROTECTED:
        case ERROR_DELETE_PROTECTED:
            errno = EACCES; break;
        case ERROR_OBJECT_EXISTS:
            errno = EEXIST; break;
        case ERROR_DISK_FULL:
            errno = ENOSPC; break;
        case ERROR_DIRECTORY_NOT_EMPTY:
            errno = ENOTEMPTY; break;
        case ERROR_OBJECT_WRONG_TYPE:
            errno = ENOTDIR; break;
        case ERROR_DISK_WRITE_PROTECTED:
            errno = EROFS; break;
        case ERROR_RENAME_ACROSS_DEVICES:
            errno = EXDEV; break;
        case ERROR_NO_FREE_STORE:
            errno = ENOMEM; break;
        case ERROR_INVALID_LOCK:
        case ERROR_BAD_NUMBER:
            errno = EINVAL; break;
        default:
            errno = EIO; break;
    }
}

/* ================================================================
 * 1. stat / lstat
 * ================================================================ */

int stat(const char *path, struct stat *sb)
{
    struct FileInfoBlock fib; /* Must be longword-aligned (stack is) */
    BPTR lock;

    if (!sl_DOSBase || !path || !sb) {
        errno = EINVAL;
        return -1;
    }

    lock = sl_Lock(path, ACCESS_READ);
    if (lock) {
        if (sl_Examine(lock, &fib)) {
            sl_UnLock(lock);
            errno = 0;
            return fib2stat(&fib, sb);
        }
        errno = EIO;
        sl_UnLock(lock);
    } else {
        ioerr2errno();
    }
    return -1;
}

/* lstat: AmigaOS has no real distinction; Lock follows softlinks.
 * We use the same implementation as stat. */
int lstat(const char *path, struct stat *sb)
{
    return stat(path, sb);
}

/* ================================================================
 * 2. getcwd
 * ================================================================ */

char *getcwd(char *buf, size_t size)
{
    BPTR lock;

    if (!sl_DOSBase) {
        errno = ENOSYS;
        return NULL;
    }

    if (!buf || size == 0) {
        errno = EINVAL;
        return NULL;
    }

    /* Lock the current directory ("" = current dir with SHARED_LOCK) */
    lock = sl_Lock("", SHARED_LOCK);
    if (!lock) {
        errno = ENOENT;
        return NULL;
    }

    if (sl_NameFromLock(lock, buf, (LONG)size)) {
        sl_UnLock(lock);
        errno = 0;
        return buf;
    }

    sl_UnLock(lock);
    errno = ERANGE;
    return NULL;
}

/* ================================================================
 * 3. chdir
 * ================================================================ */

int chdir(const char *path)
{
    struct FileInfoBlock fib;
    BPTR newlock;
    BPTR oldlock;

    if (!sl_DOSBase || !path) {
        errno = EINVAL;
        return -1;
    }

    newlock = sl_Lock(path, SHARED_LOCK);
    if (!newlock) {
        ioerr2errno();
        return -1;
    }

    /* Verify it's a directory */
    if (!sl_Examine(newlock, &fib) || fib.fib_DirEntryType < 0) {
        sl_UnLock(newlock);
        errno = ENOTDIR;
        return -1;
    }

    /* CurrentDir returns the old lock; we must unlock it */
    oldlock = sl_CurrentDir(newlock);
    if (oldlock)
        sl_UnLock(oldlock);

    errno = 0;
    return 0;
}

/* ================================================================
 * 4. mkdir
 * ================================================================ */

int mkdir(const char *path, mode_t mode)
{
    BPTR lock;

    if (!sl_DOSBase || !path) {
        errno = EINVAL;
        return -1;
    }

    lock = sl_CreateDir(path);
    if (lock) {
        sl_UnLock(lock);

        /* Optionally set protection bits */
        if (mode != 0)
            sl_SetProtection(path, (LONG)mode2prot(mode));

        errno = 0;
        return 0;
    }

    ioerr2errno();
    return -1;
}

/* ================================================================
 * 5. rmdir
 * ================================================================ */

int rmdir(const char *path)
{
    struct FileInfoBlock fib;
    BPTR lock;

    if (!sl_DOSBase || !path) {
        errno = EINVAL;
        return -1;
    }

    /* Verify it's a directory before deleting */
    lock = sl_Lock(path, ACCESS_READ);
    if (!lock) {
        ioerr2errno();
        return -1;
    }

    if (!sl_Examine(lock, &fib)) {
        sl_UnLock(lock);
        errno = EIO;
        return -1;
    }

    sl_UnLock(lock);

    if (fib.fib_DirEntryType < 0) {
        errno = ENOTDIR;
        return -1;
    }

    if (sl_DeleteFile(path)) {
        errno = 0;
        return 0;
    }

    ioerr2errno();
    return -1;
}

/* ================================================================
 * 6. unlink / remove
 * ================================================================ */

int unlink(const char *path)
{
    if (!sl_DOSBase || !path) {
        errno = EINVAL;
        return -1;
    }

    if (sl_DeleteFile(path)) {
        errno = 0;
        return 0;
    }

    ioerr2errno();
    return -1;
}

int remove(const char *path)
{
    return unlink(path);
}

/* ================================================================
 * 7. rename
 * ================================================================ */

int rename(const char *oldpath, const char *newpath)
{
    if (!sl_DOSBase || !oldpath || !newpath) {
        errno = EINVAL;
        return -1;
    }

    /* POSIX semantics: delete target first if it exists.
     * AmigaOS Rename() does not auto-replace. */
    sl_DeleteFile(newpath);

    if (sl_Rename(oldpath, newpath)) {
        errno = 0;
        return 0;
    }

    ioerr2errno();
    return -1;
}

/* ================================================================
 * 8. opendir / readdir / closedir
 * ================================================================ */

/* Internal DIR structure -- matches the opaque typedef in the header */
struct _AmigaDIR {
    struct FileInfoBlock fib;
    struct dirent ent;
    BPTR lock;
    int  done;
};

/* Static pool of DIR slots. In the shared library we have no malloc.
 * quickjs-libc.c typically opens 1-2 directories at a time.
 * 4 simultaneous slots is more than sufficient. */
#define DIR_POOL_SIZE 4
static struct _AmigaDIR dir_pool[DIR_POOL_SIZE];
static int dir_pool_used[DIR_POOL_SIZE];

static DIR *dir_slot_alloc(void)
{
    int i;
    for (i = 0; i < DIR_POOL_SIZE; i++) {
        if (!dir_pool_used[i]) {
            dir_pool_used[i] = 1;
            return &dir_pool[i];
        }
    }
    return NULL;
}

static void dir_slot_free(DIR *d)
{
    int i;
    for (i = 0; i < DIR_POOL_SIZE; i++) {
        if (&dir_pool[i] == d) {
            dir_pool_used[i] = 0;
            return;
        }
    }
}

DIR *opendir(const char *path)
{
    DIR *d;

    if (!sl_DOSBase || !path) {
        errno = EINVAL;
        return NULL;
    }

    d = dir_slot_alloc();
    if (!d) {
        errno = ENOMEM;
        return NULL;
    }

    memset(d, 0, sizeof(*d));

    d->lock = sl_Lock(path, ACCESS_READ);
    if (!d->lock) {
        ioerr2errno();
        goto fail;
    }

    if (!sl_Examine(d->lock, &d->fib)) {
        errno = EIO;
        goto fail_unlock;
    }

    /* Must be a directory */
    if (d->fib.fib_DirEntryType < 0 &&
        d->fib.fib_DirEntryType != ST_SOFTLINK) {
        errno = ENOTDIR;
        goto fail_unlock;
    }

    d->done = 0;
    errno = 0;
    return d;

fail_unlock:
    sl_UnLock(d->lock);
    d->lock = 0;
fail:
    dir_slot_free(d);
    return NULL;
}

struct dirent *readdir(DIR *d)
{
    int namlen;

    if (!d || d->done) return NULL;

    if (sl_ExNext(d->lock, &d->fib)) {
        namlen = strlen(d->fib.fib_FileName);

        /* Map AmigaOS entry type to d_type */
        switch (d->fib.fib_DirEntryType) {
            case ST_PIPEFILE:
                d->ent.d_type = DT_FIFO; break;
            case ST_SOFTLINK:
                d->ent.d_type = DT_LNK; break;
            case ST_ROOT:
            case ST_USERDIR:
            case ST_LINKDIR:
                d->ent.d_type = DT_DIR; break;
            default:
                d->ent.d_type = DT_REG; break;
        }

        /* Copy filename -- ensure null termination */
        if (namlen > NAME_MAX) namlen = NAME_MAX;
        memcpy(d->ent.d_name, d->fib.fib_FileName, namlen);
        d->ent.d_name[namlen] = '\0';

        errno = 0;
        return &d->ent;
    }

    /* Check if we've reached the end or hit an error */
    if (sl_IoErr() != ERROR_NO_MORE_ENTRIES)
        errno = EIO;
    else
        errno = 0;

    d->done = 1;
    return NULL;
}

int closedir(DIR *d)
{
    if (d) {
        if (d->lock) {
            sl_UnLock(d->lock);
            d->lock = 0;
        }
        d->done = -1;
        dir_slot_free(d);
    }
    errno = 0;
    return 0;
}

/* ================================================================
 * 9. realpath
 * ================================================================ */

char *realpath(const char *path, char *resolved)
{
    BPTR lock;
    static char static_buf[256];

    if (!sl_DOSBase || !path) {
        errno = EINVAL;
        return NULL;
    }

    if (!resolved)
        resolved = static_buf;

    lock = sl_Lock(path, SHARED_LOCK);
    if (!lock) {
        ioerr2errno();
        return NULL;
    }

    if (sl_NameFromLock(lock, resolved, 256)) {
        sl_UnLock(lock);
        errno = 0;
        return resolved;
    }

    sl_UnLock(lock);
    errno = ERANGE;
    return NULL;
}

/* ================================================================
 * 10. sleep / usleep / nanosleep
 * ================================================================ */

unsigned int sleep(unsigned int seconds)
{
    if (!sl_DOSBase) return seconds;
    sl_Delay((LONG)seconds * TICKS_PER_SECOND);
    return 0;
}

int usleep(unsigned long usec)
{
    LONG ticks;

    if (!sl_DOSBase) {
        errno = ENOSYS;
        return -1;
    }

    /* Convert microseconds to AmigaOS ticks (1 tick = 20ms = 20000us) */
    ticks = (LONG)(usec / 20000L);
    if (ticks < 1 && usec > 0) ticks = 1;

    sl_Delay(ticks);
    errno = 0;
    return 0;
}

int nanosleep(const struct timespec *req, struct timespec *rem)
{
    LONG ticks;

    if (!sl_DOSBase || !req) {
        errno = EINVAL;
        return -1;
    }

    /* Convert to ticks: seconds * 50 + nanoseconds / 20000000 */
    ticks = (LONG)(req->tv_sec * TICKS_PER_SECOND)
          + (LONG)(req->tv_nsec / 20000000L);
    if (ticks < 1 && (req->tv_sec > 0 || req->tv_nsec > 0))
        ticks = 1;

    sl_Delay(ticks);

    if (rem) {
        rem->tv_sec = 0;
        rem->tv_nsec = 0;
    }

    errno = 0;
    return 0;
}

/* ================================================================
 * 11. isatty
 * ================================================================ */

int isatty(int fd)
{
    BPTR fh;

    if (!sl_DOSBase) return 0;

    /* Map standard fds to AmigaOS file handles */
    switch (fd) {
        case 0:  fh = sl_Input();  break;
        case 1:  fh = sl_Output(); break;
        case 2:  fh = sl_Output(); break; /* stderr = stdout on AmigaOS */
        default: return 0;
    }

    if (!fh) return 0;
    return sl_IsInteractive(fh) ? 1 : 0;
}

/* ================================================================
 * 12. access
 * ================================================================ */

int access(const char *path, int mode)
{
    struct FileInfoBlock fib;
    struct InfoData info;
    BPTR lock;

    if (!sl_DOSBase || !path) {
        errno = EINVAL;
        return -1;
    }

    lock = sl_Lock(path, ACCESS_READ);
    if (!lock) {
        ioerr2errno();
        return -1;
    }

    if (mode == F_OK) {
        /* Just checking existence */
        sl_UnLock(lock);
        errno = 0;
        return 0;
    }

    if (!sl_Examine(lock, &fib)) {
        sl_UnLock(lock);
        errno = EIO;
        return -1;
    }

    /* Check read permission -- AmigaOS FIBF_READ is inverted */
    if ((mode & R_OK) && (fib.fib_Protection & FIBF_READ)) {
        sl_UnLock(lock);
        errno = EACCES;
        return -1;
    }

    /* Check execute permission */
    if ((mode & X_OK) && (fib.fib_Protection & FIBF_EXECUTE)) {
        sl_UnLock(lock);
        errno = EACCES;
        return -1;
    }

    /* Check write permission -- also need disk state */
    if (mode & W_OK) {
        if (fib.fib_Protection & FIBF_WRITE) {
            sl_UnLock(lock);
            errno = EACCES;
            return -1;
        }
        if (sl_Info(lock, &info)) {
            if (info.id_DiskState != ID_VALIDATED) {
                sl_UnLock(lock);
                errno = EROFS;
                return -1;
            }
        }
    }

    sl_UnLock(lock);
    errno = 0;
    return 0;
}

/* ================================================================
 * 13. symlink / readlink (stubs -- ENOSYS)
 * ================================================================ */

int symlink(const char *target, const char *linkpath)
{
    (void)target;
    (void)linkpath;
    errno = ENOSYS;
    return -1;
}

ssize_t readlink(const char *path, char *buf, size_t bufsiz)
{
    (void)path;
    (void)buf;
    (void)bufsiz;
    errno = ENOSYS;
    return -1;
}

/* ================================================================
 * 14. mkstemp
 * ================================================================ */

int mkstemp(char *tmpl)
{
    static unsigned long mkstemp_counter = 0;
    size_t len;
    int i;
    char *suffix;
    BPTR fh;

    if (!sl_DOSBase || !tmpl) {
        errno = EINVAL;
        return -1;
    }

    len = strlen(tmpl);
    if (len < 6) {
        errno = EINVAL;
        return -1;
    }

    /* Find the trailing XXXXXX */
    suffix = tmpl + len - 6;
    for (i = 0; i < 6; i++) {
        if (suffix[i] != 'X') {
            errno = EINVAL;
            return -1;
        }
    }

    /* Generate a unique name using counter */
    {
        unsigned long val = mkstemp_counter++;
        static const char hex[] = "0123456789abcdef";
        for (i = 5; i >= 0; i--) {
            suffix[i] = hex[val & 0xf];
            val >>= 4;
        }
    }

    /* Open the file for read/write.
     * AmigaOS doesn't have O_EXCL semantics easily, but for temp files
     * with a counter this is acceptable. */
    fh = sl_Open(tmpl, MODE_NEWFILE);
    if (!fh) {
        ioerr2errno();
        return -1;
    }

    /* Close immediately -- caller will open by name.
     * Return a fake fd. In the shared library we don't have real POSIX
     * file descriptors; quickjs-libc.c typically only needs the modified
     * template name from mkstemp. */
    sl_Close(fh);
    errno = 0;
    return 3; /* Return a fake fd > 2 */
}

/* ================================================================
 * 15. utimes
 * ================================================================ */

int utimes(const char *path, const struct timeval times[2])
{
    struct DateStamp ds;
    long unix_sec;

    if (!sl_DOSBase || !path) {
        errno = EINVAL;
        return -1;
    }

    if (times) {
        /* Use modification time (times[1]) */
        unix_sec = times[1].tv_sec;
    } else {
        /* Use current time -- get via DateStamp */
        /* Actually just set to "now" by using current DateStamp */
        DOS_LVO(sl_DOSBase, 192,
            struct DateStamp *(*)(__reg("a6") struct Library *,
                                 __reg("d1") struct DateStamp *))(
            sl_DOSBase, &ds);
        goto set_date;
    }

    /* Convert Unix time to AmigaOS DateStamp */
    {
        long amiga_sec = unix_sec - AMIGA_UNIX_EPOCH_DIFF;
        if (amiga_sec < 0) amiga_sec = 0;
        ds.ds_Days   = amiga_sec / 86400L;
        ds.ds_Minute = (amiga_sec % 86400L) / 60L;
        ds.ds_Tick   = (amiga_sec % 60L) * TICKS_PER_SECOND;
    }

set_date:
    if (sl_SetFileDate(path, &ds)) {
        errno = 0;
        return 0;
    }

    ioerr2errno();
    return -1;
}

/* ================================================================
 * Process stubs (return -1, errno=ENOSYS)
 * ================================================================ */

pid_t fork(void)
{
    errno = ENOSYS;
    return (pid_t)-1;
}

int execve(const char *path, char *const argv[], char *const envp[])
{
    (void)path; (void)argv; (void)envp;
    errno = ENOSYS;
    return -1;
}

pid_t waitpid(pid_t pid, int *status, int options)
{
    (void)pid; (void)status; (void)options;
    errno = ENOSYS;
    return (pid_t)-1;
}

int kill(pid_t pid, int sig)
{
    (void)pid; (void)sig;
    errno = ENOSYS;
    return -1;
}

int pipe(int pipefd[2])
{
    (void)pipefd;
    errno = ENOSYS;
    return -1;
}

/* ================================================================
 * Signal stubs
 * ================================================================ */

static void (*sig_handlers[16])(int);

void (*signal(int sig, void (*handler)(int)))(int)
{
    void (*old)(int);

    if (sig < 0 || sig >= 16) {
        errno = EINVAL;
        return SIG_ERR;
    }

    old = sig_handlers[sig];
    sig_handlers[sig] = handler;
    return old ? old : SIG_DFL;
}

int setitimer(int which, const struct itimerval *nval,
              struct itimerval *oval)
{
    (void)which;
    (void)nval;

    if (oval) {
        memset(oval, 0, sizeof(*oval));
    }

    /* Silently succeed -- quickjs-libc.c uses this for profiling
     * which we don't support in the library. */
    return 0;
}

/* ================================================================
 * Dynamic loading stubs
 * ================================================================ */

void *dlopen(const char *filename, int flag)
{
    (void)filename; (void)flag;
    return NULL;
}

void *dlsym(void *handle, const char *symbol)
{
    (void)handle; (void)symbol;
    return NULL;
}

int dlclose(void *handle)
{
    (void)handle;
    return -1;
}

static const char dl_err_msg[] = "dlopen not supported on AmigaOS";

char *dlerror(void)
{
    return (char *)dl_err_msg;
}

/* ================================================================
 * Resource stubs
 * ================================================================ */

int getrusage(int who, struct rusage *usage)
{
    (void)who;

    if (usage) {
        memset(usage, 0, sizeof(*usage));
    }

    /* Return success with zeroed data -- quickjs-libc.c uses this
     * for performance timing which is best-effort. */
    return 0;
}

/* ================================================================
 * Terminal stubs
 *
 * quickjs-libc.c has its own AmigaOS terminal handling
 * (raw mode via ACTION_SCREEN_MODE). These stubs exist so the
 * symbols resolve.
 * ================================================================ */

int tcgetattr(int fd, struct termios *t)
{
    (void)fd;

    if (t) {
        memset(t, 0, sizeof(*t));
        /* Report a sane default: canonical mode, echo on */
        t->c_lflag = ECHO | ICANON | ISIG;
    }
    return 0;
}

int tcsetattr(int fd, int action, const struct termios *t)
{
    (void)fd; (void)action; (void)t;
    return 0;
}

/* ================================================================
 * poll
 *
 * Simple implementation: for stdin (fd 0), use WaitForChar.
 * For all other fds, report them as ready immediately.
 * ================================================================ */

int poll(struct pollfd *fds, nfds_t nfds, int timeout)
{
    unsigned int i;
    int ready = 0;
    BPTR fh;

    if (!fds || nfds == 0) return 0;
    if (!sl_DOSBase) return 0;

    for (i = 0; i < nfds; i++) {
        fds[i].revents = 0;

        if (fds[i].fd == 0 && (fds[i].events & POLLIN)) {
            /* Check stdin with WaitForChar */
            fh = sl_Input();
            if (fh) {
                /* timeout: -1 = block, 0 = poll, >0 = ms wait.
                 * WaitForChar takes microseconds. */
                LONG us_timeout;
                if (timeout < 0)
                    us_timeout = 100000; /* 100ms max block per iteration */
                else if (timeout == 0)
                    us_timeout = 0;
                else
                    us_timeout = (LONG)timeout * 1000L;

                if (sl_WaitForChar(fh, us_timeout)) {
                    fds[i].revents |= POLLIN;
                    ready++;
                }
            }
        } else if (fds[i].events & POLLOUT) {
            /* Output is always ready */
            fds[i].revents |= POLLOUT;
            ready++;
        }
    }

    return ready;
}

/* ================================================================
 * dup / dup2 stubs
 *
 * AmigaOS doesn't have POSIX file descriptors in the shared library
 * context. Return -1 for now.
 * ================================================================ */

int dup(int fd)
{
    (void)fd;
    errno = ENOSYS;
    return -1;
}

int dup2(int oldfd, int newfd)
{
    (void)oldfd; (void)newfd;
    errno = ENOSYS;
    return -1;
}
