/* Copyright (c) 1993             by SAS Institute Inc., Cary NC     */

#ifndef __STREAM_H
#define __STREAM_H

#ifndef __IOSTREAM_H
#include <iostream.h>
#endif

#ifndef __IOMANIP_H
#include <iomanip.h>
#endif

#ifndef __STDIOSTREAM_H
#include <stdiostream.h>
#endif

#ifndef __FSTREAM_H
#include <fstream.h>
#endif

#ifndef NULL
#define NULL    0
#endif



char* form( char* format, ... );
    // This function is very similar to printf except that
    // instead of printing to standard output, 'form' returns
    // a string formated as specified in 'format'.

/*
  These functions format the value of 'l' into a string
  which they return.
  
  oct - formats as an octal number using the digits 0-7.
  hex - as a hexidecimal number using the digits 0-9 and
          upper case digits A-F.
  dec - as a decimal number using the digits 0-9.
  chr - format 'i' as a char.
  str - format 'st' as a string.

  If 'size' is zero the returned string will be exactly as
  long as needed to represent the value of 'l'.  Otherwise
  is 'size' is less than the length of the represtation
  the represtation will be truncated on the right, and if 'size'
  is greater than the length of the represtation spaces will be
  added to the left of the representation.
  */

#ifdef _OPTINLINE
inline
#endif
char* oct( long l, int size = 0 ) 
    _INLINE_FUNC({ return form( "%*lo", size, l ); })

#ifdef _OPTINLINE
inline
#endif
char* hex( long l, int size = 0 ) 
    _INLINE_FUNC({ return form( "%*lx", size, l ); })

#ifdef _OPTINLINE
inline
#endif
char* dec( long l, int size = 0 ) 
    _INLINE_FUNC({ return form( "%*ld", size, l ); })

#ifdef _OPTINLINE
inline
#endif
char* chr( int i, int size = 0 )
    _INLINE_FUNC({ return form( "%*c",  size, i ); })

#ifdef _OPTINLINE
inline
#endif
char* str( char* st, int size = 0 ) 
    _INLINE_FUNC({ return form( "%*s", size, st ); })

#ifdef _OPTINLINE
inline
#endif
istream& WS(istream& i )
    _INLINE_FUNC({ return i >> ws; })

#ifdef _OPTINLINE
inline
#endif
void eatwhite( istream& i ) 
    _INLINE_FUNC({ i >> ws; })

static const int input = (ios::in) ;
static const int output = (ios::out) ;
static const int append = (ios::app) ;
static const int atend = (ios::ate) ;
static const int _good = (ios::goodbit) ;
static const int _bad = (ios::badbit) ;
static const int _fail = (ios::failbit) ;
static const int _eof = (ios::eofbit) ;

typedef ios::io_state state_value ;

#endif /* __STREAM_H */


