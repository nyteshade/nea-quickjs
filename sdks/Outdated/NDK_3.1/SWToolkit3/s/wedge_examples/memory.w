run wedge exec 0xff3a 0x8003 0x8000 opt r   "c=AllocMem(byteSize,requirements)(d0/d1)"
run wedge exec 0xff2e 0x8201 0x8200 opt r   "c=FreeMem(memoryBlock,byteSize)(a1,d0)"
run wedge exec 0xfd54 0x8003 0x8000 opt r   "c=AllocVec(byteSize,requirements)(d0/d1)"
run wedge exec 0xfd4e 0x8200 0x8200 opt r   "c=FreeVec(memoryBlock)(a1)"
