/*
 * libversion.c — Library version/name symbols for libent.o
 *
 * Compiled WITHOUT DATA=FARONLY so these land in near data
 * where libent.o can reach them with 16-bit references.
 * All other modules use DATA=FARONLY.
 */
/* Only name and ID — version/revision come from slink LIBVERSION/LIBREVISION */
char _LibName[] = "qjs_medium.library";
char _LibID[] = "qjs_medium.library 3.2 (02.4.2026)\r\n";
