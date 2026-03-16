/* Force a compile error to reveal which macros are defined */
#if defined(__SASC__)
#error "__SASC__ is defined"
#elif defined(__SASC)
#error "__SASC is defined"
#elif defined(SASC)
#error "SASC is defined"
#elif defined(_AMIGA)
#error "_AMIGA is defined"
#else
#error "none of these macros are defined"
#endif
