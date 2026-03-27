run wedge exec 0xfe44 0x8303 0x8300 opt r   "c=OpenDevice(devName,unit,ioRequest,flags)(a0,d0/a1,d1)"
run wedge exec 0xfe3e 0x8200 0x8200 opt r   "c=CloseDevice(ioRequest)(a1)"
run wedge exec 0xfdd8 0x8201 0x8200 opt r   "c=OpenLibrary(libName,version)(a1,d0)"
run wedge exec 0xfe62 0x8200 0x8200 opt r   "c=CloseLibrary(library)(a1)"
