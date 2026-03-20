/* Copyright (c) 1993             by SAS Institute Inc., Cary NC     */

#ifndef __STDIOSTREAM_H
#define __STDIOSTREAM_H

#ifndef _STDDEFH
#include <stddef.h>
#endif

#ifndef __IOSTREAM_H
#include <iostream.h>
#endif

/********

class stdiobuf
    stdiobufs are a simple interface to FILE*.
    stdiobufs will probably not be part of ANSI C++.

    Calls to a stdiobuf are mapped directly to calls to 
    ANSI C stdio functions.

********/

class stdiobuf : public streambuf {
    public:

           // Attach to a FILE*.
      stdiobuf( FILE* _file ) : x_file( _file ) {}

           // disconnect
      virtual ~stdiobuf() {}

          // Return the attached FILE*.
      FILE* stdiofile() _INLINE_FUNC({ return x_file; })

           // Override or replace from streambuf.
      virtual int        overflow(int=EOF);
      virtual int        underflow();
      virtual int        sync();
      virtual int xsputn(const char* s,int n);
      virtual int xsgetn(char*  s,int n);
      virtual streampos seekoff(streamoff offset, ios::seek_dir dir,
                        int mode);
      virtual streampos seekpos(streampos, int =ios::in|ios::out);
      virtual int pbackfail(int c);
      virtual streambuf* setbuf(char* p, size_t len);

    private:
        FILE* x_file;
        char  _buf[2];      // buffer for i/o
    };



class stdiostream : public iostream {

    public:

           // Attach to a FILE*.
      stdiostream( FILE* _file ) 
          : ios( &buffer ), buffer( _file )
          {}

      stdiobuf* rdbuf() _INLINE_FUNC({ return &buffer; })

    private:
      stdiobuf buffer;
    };


#endif  /* __STDIOSTREAM_H */



