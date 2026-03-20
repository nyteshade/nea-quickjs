/* Copyright (c) 1993             by SAS Institute Inc., Cary NC     */

#ifndef __FSTREAM_H
#define __FSTREAM_H

#ifndef _STDDEFH
#include <stddef.h>
#endif

#ifndef __IOSTREAM_H
#include <iostream.h>
#endif

/*********
This header file file provides four classes:
filebuf and ifstream, ofstream, and fstream which associate 
a filebuf with an istream, an ostream, and a iostream respectivly.

class filebuf - the current version of filebuf communicates
with the world through FILE*s.  This is not the same as AT&T
derived systems, which use UNIX-I/O.  It is quite posible
that in the future filebufs use a lower lever I/O mechinism
for speed.

*********/

extern "C++" {

class  filebuf : public streambuf {
    public:

             //  Create an unopened file.
      filebuf() : x_file(0) { }
      
            // Close the file, if open
      virtual ~filebuf() _INLINE_FUNC({ if ( is_open() ) close(); })


           // Return non-zero if open, zero otherwise.
      int is_open() _INLINE_FUNC({ return x_file != NULL; })


           // Open file 'file_name', return 0 if error.
      filebuf* open(const char *file_name, int mode,
                    const char* amparms = "", const char* am = "");


           // Close currently open file.
      filebuf* close();

 
           // Set the get AND put pointers to a new position.
      virtual streampos seekoff(streamoff, ios::seek_dir, 
                                           int =ios::in|ios::out);
      virtual streampos seekpos(streampos, int =ios::in|ios::out);

      virtual streambuf* setbuf(char* p, size_t len );

      virtual int sync();
          // Any characters in the put area are written to the file.
          // Any characters in the get area are written back to the file.
          // The get and put area are both set to empty.
          // Returns 0 unless error, in which case it returns EOF.


    protected:

    /*
    Buffer management for filebuf:
      The reserve buffer is used by filebuf, which means that
      base() and ebuf() are set to point to the beginning and
      and of the reserve area, and that the get and put areas
      reside within the reserve area.

      At any particular time only one of the two areas (get
      or put) exists.  Since most files are either used for
      input or output only, this seems most efficient.  For
      those filebufs that must handle both input and output,
      the current area (get or put) is flushed each time
      the other area is needed.  This switching happens
      any time the current operation (read or write) is opposite
      from the last operation.
    */

      virtual int doallocate();

      virtual int overflow( int c=EOF );
          /*
          is called by streambuf::sputc() to send a
          character in to the file.

          If an error occurs in this function, it will return EOF,
          and the filebuf will have an undefined state.

          Possible errors are: the file is not open, the file
          is only open for reading, the reserve area could not
          be allocated by allocate(), or a system error occured
          during a write to the file.

          If no errors occur this function will do the following:
              Call streambuf::allocate().
              Flush the get area, if it exists, back to the file.
              Write any characters in the put area to the file.
              Write the 'c' character to the file.
              Set the size of the put area to be one less than the
                size of the reserve area, and make the put area empty.
              Returns 'c' unless 'c' == EOF in which case it returns 0.
        */

      virtual int underflow();
          /*
          is called by streambuf::sgetn() to read a character from
          the file.

          If an error occurs in this function, it will return EOF,
          and the filebuf will have an undefined state.

          Possible errors are: the file
          is not open for reading, the reserve area could not
          be allocated by allocate(), or a system error occured
          during a read from the file.

          If no errors occur this function will do the following:
              Call streambuf::allocate().
              Flush the put area, if it exists, back to the file.
              Return the character at the get pointer
        */

      virtual int xsputn( const char* s, int n );
          /*
          is called by streambuf::sputn() to send the 'n' characters
          in 's' to the file.

          If an error occurs in this function, it will return
          a number less than 'n' indicating the number of
          characters in 's' that were written to the file before
          the error, and the filebuf will have an undefined state.

          Possible errors are: the file
          is not open for writing, the reserve area could not
          be allocated by allocate(), or a system error occured
          during a write to the file.

          If no errors occur this function will do the following:
              Call streambuf::allocate().
              Flush the get area, if it exists, back to the file.
              Write any characters in the put area to the file.
              Write the 'n' characters pointed at by 's' to the file.
              Set the size of the put area to be one less than the
                size of the reserve area, and make the put area empty.
              Return 'n'
        */

      virtual int xsgetn( char* s, int n );
          /*
          is called by streambuf::sgetn() to read 'n' characters from
          the file into 's'.

          If an error occurs in this function, it will return
          a number less than 'n' indicating the number of
          characters in 's' that were read from the file before
          the error, and the filebuf will have an undefined state.

          Possible errors are: the file
          is not open for reading, the reserve area could not
          be allocated by allocate(), or a system error occured
          during a read from the file.

          If no errors occur this function will do the following:
              Call streambuf::allocate().
              Flush the put area, if it exists, back to the file.
              's' will contain the next 'n' characters from the file.
              The get area will contain any characters read from the
                  file but not returned in 's'.
              Return 'n'.
        */

      virtual int pbackfail( int );
          /*
          is called by streambuf::sputbackc().

          Moves the get pointer back one character.
          If this succeeds this function returns the new character
          at the get pointer, otherwise this function returns EOF
          */


    private:
      FILE* x_file;
          // The attached file.

      fpos_t x_pos;
          // If the get area is not empty, this contains the file
          // position of the first character in the get area.
          // This is used to re-sync the file by overflow() and
          // xsputn() (and indirectly by sync()).

      int mode;
          // The open mode.

      char lahead[1];
    };



class fstream : public iostream {
    public:

          // create an unopened fstream
      fstream() : ios( &buffer ) {}

          // create and open an fstream
      fstream( const char* _name, 
               int _mode,
               const char* _amparms = "", const char* _am = "")
        _INLINE_FUNC(
          : ios( &buffer )
          {
          open( _name, _mode, _amparms, _am );
          }
        )

          // Close the file, if open (it works try it)
      virtual ~fstream() {}


          // Open a file using an unopened fstream, clear state if no error
      void open( const char* _name, 
                 int _mode,
                 const char* _amparms = "", const char* _am = "")
        _INLINE_FUNC(
          {
          clear( 
              buffer.open( _name, _mode, _amparms, _am )
                  ? 0
                  : ( ios::failbit | rdstate() ));
          }
        )

          // Close an opened file and clear the state if no error.
      void close()
        _INLINE_FUNC(
          {
          clear( buffer.close() ? 0 : (ios::failbit | rdstate()) );
          }
        )


      void setbuf(char* _p, size_t _len )  
       _INLINE_FUNC(
          {
          if ( buffer.setbuf( _p, _len ) )
              clear( ios::failbit | rdstate() );
          }
       )


      filebuf*  rdbuf() _INLINE_FUNC({ return &buffer; })


    private:
      filebuf buffer;

    };

class ifstream : public istream {
    public:

          // create an unopened ifstream
      ifstream() : ios( &buffer ) {}

          // create and open an ifstream
      ifstream( const char* _name, 
               int _mode = ios::in,
               const char* _amparms = "", const char* _am = "")
        _INLINE_FUNC(
          : ios( &buffer )
          {
          open( _name, _mode, _amparms, _am );
          }
        )

          // Close the file, if open
      virtual ~ifstream() {}


          // Open a file using an unopened ifstream, clear state if no error
      void open( const char* _name, 
                 int _mode = ios::in,
                 const char* _amparms = "", const char* _am = "")
       _INLINE_FUNC(
          {
          clear( 
              buffer.open( _name, _mode | ios::in, _amparms, _am )
                  ? 0
                  : ( ios::failbit | rdstate() ));
          }
       )


          // Close an opened file and clear the state if no error.
      void close()
        _INLINE_FUNC(
          {
          clear( buffer.close() ? 0 : (ios::failbit | rdstate()) );
          }
        )


      void setbuf(char* _p, size_t _len )  
        _INLINE_FUNC(
          {
          if ( buffer.setbuf( _p, _len ) )
              clear( ios::failbit | rdstate() );
          }
        )


      filebuf*  rdbuf() _INLINE_FUNC({ return &buffer; })


    private:
      filebuf buffer;

    };

class ofstream : public ostream {
    public:

          // create an unopened ofstream
      ofstream() : ios( &buffer ) {}

          // create and open an ofstream
      ofstream( const char* _name, 
               int _mode = ios::out,
               const char* _amparms = "", const char* _am = "")
       _INLINE_FUNC(
          : ios( &buffer )
          {
          open( _name, _mode, _amparms, _am );
          }
       )

          // Close the file, if open (it works try it)
      virtual ~ofstream() {}


          // Open a file using an unopened ofstream, clear state if no error
      void open( const char* _name, 
                 int _mode = ios::out,
                 const char* _amparms = "", const char* _am = "")
       _INLINE_FUNC(
          {
          clear( 
              buffer.open( _name, _mode | ios::out, _amparms, _am )
                  ? 0
                  : ( ios::failbit | rdstate() ));
          }
        )


          // Close an opened file and clear the state if no error.
      void close()
       _INLINE_FUNC(
          {
          clear( buffer.close() ? 0 : (ios::failbit | rdstate()) );
          }
       )


      void setbuf(char* _p, size_t _len )  
       _INLINE_FUNC(
          {
          if ( buffer.setbuf( _p, _len ) )
              clear( ios::failbit | rdstate() );
          }
        )


      filebuf*  rdbuf() _INLINE_FUNC({ return &buffer; })


    private:
      filebuf buffer;

    };
}

#endif /* __FSTREAM_H */
