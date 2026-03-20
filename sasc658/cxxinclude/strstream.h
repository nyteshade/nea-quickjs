/* Copyright (c) 1993             by SAS Institute Inc., Cary NC     */

#ifndef __STRSTREAM_H
#define __STRSTREAM_H

#ifndef __IOSTREAM_H
#include <iostream.h>
#endif

// class strstreambuf
//     is created to allow reading and writing to and from
//    strings in memory.


class strstreambuf : public streambuf {
    public:
      strstreambuf() { _dynamic_init(); }

      strstreambuf( int _i )
        _INLINE_FUNC(
          {
          _dynamic_init(); 
          setbuf( 0, _i );
          }
        )

      strstreambuf( void* (*_a)(long), void (*_f)(void*) )
        _INLINE_FUNC(
          {
          _dynamic_init();
          _alloc_func = _a;
          _free_func = _f;
          }
        )

      strstreambuf( char* _b, int _s, char* _pstart = 0 )
        _INLINE_FUNC(
          {
          _fixed_init( _b, _s, _pstart );
          }
        )
     
     ~strstreambuf();

      void  freeze( int _n = 1 ) _INLINE_FUNC( { _frozen = (char)_n; })
      char* str()
         _INLINE_FUNC(
           { 
	     this->sputc('\0');
             freeze(); 
             return base();
            }
          )

      int pcount() _INLINE_FUNC(
        { return (base() == NULL ? 0 : pptr() - base()); })

      virtual int  sync() _INLINE_FUNC({ return 0; })
      virtual streampos seekoff(streamoff, ios::seek_dir,
                                int =ios::in|ios::out);
      virtual streampos seekpos(streampos, int =ios::in|ios::out);

      streambuf* setbuf( char* , size_t _i )
       _INLINE_FUNC(
          {
            _upsize = ( _i <= 0) ? 512 : _i;
            return this;
          }
        )

    private:
      virtual int        underflow();
      virtual int        overflow(int c=EOF);

    private:
      unsigned int _upsize;
      char _unlimited;
      char _frozen;
      char _dynamic;

      void _dynamic_init();
      void _fixed_init( char*, int size, char* );
      void* (*_alloc_func)(long);
      void (*_free_func)(void*);
    };


class istrstream : public istream {
    public:
      istrstream( char* _p ) : ios( &buffer ), buffer( _p, 0, 0 ) {}
      istrstream( char* _p, int _l ) 
          : ios( &buffer ), buffer( _p, _l, 0 ) {}

     ~istrstream() {}
      strstreambuf* rdbuf() _INLINE_FUNC({ return &buffer; })

    private:
      strstreambuf buffer;
    };

class ostrstream : public ostream {
    public:
      ostrstream( char* _p, int _l, int _mode = ios::out )
          : ios( &buffer ), 
            buffer( _p, _l,
                    ( _mode & (ios::ate|ios::app) )
                        ? _p + strlen( _p ) : _p )
                {}
  
      ostrstream() : ios( &buffer ) {}
     ~ostrstream() {}

      strstreambuf* rdbuf() _INLINE_FUNC({ return &buffer; })

      char* str() _INLINE_FUNC({ return buffer.str(); })
      int   pcount() _INLINE_FUNC({ return buffer.pcount(); })

    private:
      strstreambuf buffer;
    };

class strstream : public iostream {
    public:
      strstream( char* _p, int _l, int _mode )
          : ios( &buffer ), 
            buffer( _p, _l,
                    ( _mode & (ios::ate|ios::app) )
                        ? _p + strlen( _p ) : _p )
                {}
  
      strstream() : ios( &buffer ) {}
     ~strstream() {}

      strstreambuf* rdbuf() _INLINE_FUNC({ return &buffer; })

      char* str() _INLINE_FUNC({ return buffer.str(); })
      int   pcount() _INLINE_FUNC({ return buffer.pcount(); })

    private:
      strstreambuf buffer;
    };

#endif /* __STRSTREAM_H */

