/* quickjs-master/amiga/ffi/Intuition.js
 *
 * Wrapper for intuition.library — windows, screens, gadgets, BOOPSI
 * imageclass, IDCMP messaging.
 *
 * Pilot scope: ~25 of 127 LVOs (the most-used surface). The
 * remaining are accessible via amiga.intuition.lvo + amiga.call.
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';
import { Window } from './structs/Window.js';
import { Screen } from './structs/Screen.js';
import { Image } from './structs/Image.js';

export class Intuition extends LibraryBase {
  /** @type {string} */
  static libraryName = 'intuition.library';

  /** @type {number} */
  static libraryVersion = 39;

  /** @type {Object<string, number>} */
  static lvo = globalThis.amiga.intuition.lvo;

  /**
   * Window/Screen attribute tags, IDCMP flags, window flags, and
   * imageclass attributes from intuition.h. Cases coerce to their
   * numeric value via Symbol.toPrimitive — usable directly in tag
   * lists.
   */
  static consts = CEnumeration.lazy('IntuitionConsts', {
    /* consts-begin - written by scripts/gen_consts.py from the NDK headers; do not edit */
    /* Window attributes: tags for OpenWindowTags (intuition/intuition.h) */
    WA_Left:              0x80000064,   /* WA_Dummy + 0x01 */
    WA_Top:               0x80000065,   /* WA_Dummy + 0x02 */
    WA_Width:             0x80000066,   /* WA_Dummy + 0x03 */
    WA_Height:            0x80000067,   /* WA_Dummy + 0x04 */
    WA_DetailPen:         0x80000068,   /* WA_Dummy + 0x05 */
    WA_BlockPen:          0x80000069,   /* WA_Dummy + 0x06 */
    WA_IDCMP:             0x8000006A,   /* WA_Dummy + 0x07 */
    WA_Flags:             0x8000006B,   /* WA_Dummy + 0x08 */
    WA_Gadgets:           0x8000006C,   /* WA_Dummy + 0x09 */
    WA_Checkmark:         0x8000006D,   /* WA_Dummy + 0x0A */
    WA_Title:             0x8000006E,   /* WA_Dummy + 0x0B */
    WA_ScreenTitle:       0x8000006F,   /* WA_Dummy + 0x0C */
    WA_CustomScreen:      0x80000070,   /* WA_Dummy + 0x0D */
    WA_SuperBitMap:       0x80000071,   /* WA_Dummy + 0x0E */
    WA_MinWidth:          0x80000072,   /* WA_Dummy + 0x0F */
    WA_MinHeight:         0x80000073,   /* WA_Dummy + 0x10 */
    WA_MaxWidth:          0x80000074,   /* WA_Dummy + 0x11 */
    WA_MaxHeight:         0x80000075,   /* WA_Dummy + 0x12 */
    WA_InnerWidth:        0x80000076,   /* WA_Dummy + 0x13 */
    WA_InnerHeight:       0x80000077,   /* WA_Dummy + 0x14 */
    WA_PubScreenName:     0x80000078,   /* WA_Dummy + 0x15 */
    WA_PubScreen:         0x80000079,   /* WA_Dummy + 0x16 */
    WA_PubScreenFallBack: 0x8000007A,   /* WA_Dummy + 0x17 */
    WA_WindowName:        0x8000007B,   /* WA_Dummy + 0x18 */
    WA_Colors:            0x8000007C,   /* WA_Dummy + 0x19 */
    WA_Zoom:              0x8000007D,   /* WA_Dummy + 0x1A */
    WA_MouseQueue:        0x8000007E,   /* WA_Dummy + 0x1B */
    WA_BackFill:          0x8000007F,   /* WA_Dummy + 0x1C */
    WA_RptQueue:          0x80000080,   /* WA_Dummy + 0x1D */
    WA_SizeGadget:        0x80000081,   /* WA_Dummy + 0x1E */
    WA_DragBar:           0x80000082,   /* WA_Dummy + 0x1F */
    WA_DepthGadget:       0x80000083,   /* WA_Dummy + 0x20 */
    WA_CloseGadget:       0x80000084,   /* WA_Dummy + 0x21 */
    WA_Backdrop:          0x80000085,   /* WA_Dummy + 0x22 */
    WA_ReportMouse:       0x80000086,   /* WA_Dummy + 0x23 */
    WA_NoCareRefresh:     0x80000087,   /* WA_Dummy + 0x24 */
    WA_Borderless:        0x80000088,   /* WA_Dummy + 0x25 */
    WA_Activate:          0x80000089,   /* WA_Dummy + 0x26 */
    WA_RMBTrap:           0x8000008A,   /* WA_Dummy + 0x27 */
    WA_WBenchWindow:      0x8000008B,   /* WA_Dummy + 0x28 */
    WA_SimpleRefresh:     0x8000008C,   /* WA_Dummy + 0x29 */
    WA_SmartRefresh:      0x8000008D,   /* WA_Dummy + 0x2A */
    WA_SizeBRight:        0x8000008E,   /* WA_Dummy + 0x2B */
    WA_SizeBBottom:       0x8000008F,   /* WA_Dummy + 0x2C */
    WA_AutoAdjust:        0x80000090,   /* WA_Dummy + 0x2D */
    WA_GimmeZeroZero:     0x80000091,   /* WA_Dummy + 0x2E */
    WA_MenuHelp:          0x80000092,   /* WA_Dummy + 0x2F */
    WA_NewLookMenus:      0x80000093,   /* WA_Dummy + 0x30 */
    WA_AmigaKey:          0x80000094,   /* WA_Dummy + 0x31 */
    WA_NotifyDepth:       0x80000095,   /* WA_Dummy + 0x32 */
    WA_Pointer:           0x80000097,   /* WA_Dummy + 0x34 */
    WA_BusyPointer:       0x80000098,   /* WA_Dummy + 0x35 */
    WA_PointerDelay:      0x80000099,   /* WA_Dummy + 0x36 */
    WA_TabletMessages:    0x8000009A,   /* WA_Dummy + 0x37 */
    WA_HelpGroup:         0x8000009B,   /* WA_Dummy + 0x38 */
    WA_HelpGroupWindow:   0x8000009C,   /* WA_Dummy + 0x39 */
    WA_Hidden:            0x8000009F,   /* WA_Dummy + 0x3c */
    WA_PointerType:       0x800000B3,   /* WA_Dummy + 0x50 */
    WA_IconifyGadget:     0x800000C3,   /* WA_Dummy + 0x60 */

    /* Window flags: the value of WA_Flags (intuition/intuition.h) */
    WFLG_SIZEGADGET:     0x00000001,
    WFLG_DRAGBAR:        0x00000002,
    WFLG_DEPTHGADGET:    0x00000004,
    WFLG_CLOSEGADGET:    0x00000008,
    WFLG_SIZEBRIGHT:     0x00000010,
    WFLG_SIZEBBOTTOM:    0x00000020,
    WFLG_REFRESHBITS:    0x000000C0,
    WFLG_SMART_REFRESH:  0x00000000,
    WFLG_SIMPLE_REFRESH: 0x00000040,
    WFLG_SUPER_BITMAP:   0x00000080,
    WFLG_OTHER_REFRESH:  0x000000C0,
    WFLG_BACKDROP:       0x00000100,
    WFLG_REPORTMOUSE:    0x00000200,
    WFLG_GIMMEZEROZERO:  0x00000400,
    WFLG_BORDERLESS:     0x00000800,
    WFLG_ACTIVATE:       0x00001000,
    WFLG_RMBTRAP:        0x00010000,
    WFLG_NOCAREREFRESH:  0x00020000,
    WFLG_NW_EXTENDED:    0x00040000,
    WFLG_NEWLOOKMENUS:   0x00200000,
    WFLG_WINDOWACTIVE:   0x00002000,
    WFLG_INREQUEST:      0x00004000,
    WFLG_MENUSTATE:      0x00008000,
    WFLG_WINDOWREFRESH:  0x01000000,
    WFLG_WBENCHWINDOW:   0x02000000,
    WFLG_WINDOWTICKED:   0x04000000,
    WFLG_VISITOR:        0x08000000,
    WFLG_ZOOMED:         0x10000000,
    WFLG_HASZOOM:        0x20000000,
    WFLG_HASICONIFY:     0x40000000,

    /* IDCMP classes: the value of WA_IDCMP, and IntuiMessage.class (intuition/intuition.h) */
    IDCMP_SIZEVERIFY:     0x00000001,
    IDCMP_NEWSIZE:        0x00000002,
    IDCMP_REFRESHWINDOW:  0x00000004,
    IDCMP_MOUSEBUTTONS:   0x00000008,
    IDCMP_MOUSEMOVE:      0x00000010,
    IDCMP_GADGETDOWN:     0x00000020,
    IDCMP_GADGETUP:       0x00000040,
    IDCMP_REQSET:         0x00000080,
    IDCMP_MENUPICK:       0x00000100,
    IDCMP_CLOSEWINDOW:    0x00000200,
    IDCMP_RAWKEY:         0x00000400,
    IDCMP_REQVERIFY:      0x00000800,
    IDCMP_REQCLEAR:       0x00001000,
    IDCMP_MENUVERIFY:     0x00002000,
    IDCMP_NEWPREFS:       0x00004000,
    IDCMP_DISKINSERTED:   0x00008000,
    IDCMP_DISKREMOVED:    0x00010000,
    IDCMP_WBENCHMESSAGE:  0x00020000,
    IDCMP_ACTIVEWINDOW:   0x00040000,
    IDCMP_INACTIVEWINDOW: 0x00080000,
    IDCMP_DELTAMOVE:      0x00100000,
    IDCMP_VANILLAKEY:     0x00200000,
    IDCMP_INTUITICKS:     0x00400000,
    IDCMP_IDCMPUPDATE:    0x00800000,
    IDCMP_MENUHELP:       0x01000000,
    IDCMP_CHANGEWINDOW:   0x02000000,
    IDCMP_GADGETHELP:     0x04000000,
    IDCMP_EXTENDEDMOUSE:  0x08000000,
    IDCMP_LONELYMESSAGE:  0x80000000,

    /* Mouse button codes: IntuiMessage.code for IDCMP_MOUSEBUTTONS (intuition/intuition.h) */
    SELECTDOWN: 0x68,   /* IECODE_LBUTTON */
    SELECTUP:   232,   /* IECODE_LBUTTON | IECODE_UP_PREFIX */
    MENUDOWN:   0x69,   /* IECODE_RBUTTON */
    MENUUP:     233,   /* IECODE_RBUTTON | IECODE_UP_PREFIX */
    MIDDLEDOWN: 0x6A,   /* IECODE_MBUTTON */
    MIDDLEUP:   234,   /* IECODE_MBUTTON | IECODE_UP_PREFIX */

    /* Menu and menu item flags (intuition/intuition.h) */
    MENUENABLED: 0x0001,
    MIDRAWN:     0x0100,
    CHECKIT:     0x0001,
    ITEMTEXT:    0x0002,
    COMMSEQ:     0x0004,
    MENUTOGGLE:  0x0008,
    ITEMENABLED: 0x0010,
    HIGHFLAGS:   0x00C0,
    HIGHIMAGE:   0x0000,
    HIGHCOMP:    0x0040,
    HIGHBOX:     0x0080,
    HIGHNONE:    0x00C0,
    CHECKED:     0x0100,
    ISDRAWN:     0x1000,
    HIGHITEM:    0x2000,
    MENUTOGGLED: 0x4000,

    /* Menu numbers: "nothing chosen" values (intuition/intuition.h) */
    MENUNULL: 0xFFFF,
    NOMENU:   0x001F,
    NOITEM:   0x003F,
    NOSUB:    0x001F,

    /* Gadget flags, activation and types (intuition/intuition.h) */
    GFLG_GADGHIGHBITS: 0x0003,
    GFLG_GADGHCOMP:    0x0000,
    GFLG_GADGHBOX:     0x0001,
    GFLG_GADGHIMAGE:   0x0002,
    GFLG_GADGHNONE:    0x0003,
    GFLG_GADGIMAGE:    0x0004,
    GFLG_RELBOTTOM:    0x0008,
    GFLG_RELRIGHT:     0x0010,
    GFLG_RELWIDTH:     0x0020,
    GFLG_RELHEIGHT:    0x0040,
    GFLG_RELSPECIAL:   0x4000,
    GFLG_SELECTED:     0x0080,
    GFLG_DISABLED:     0x0100,
    GFLG_LABELMASK:    0x3000,
    GFLG_LABELITEXT:   0x0000,
    GFLG_LABELSTRING:  0x1000,
    GFLG_LABELIMAGE:   0x2000,
    GFLG_TABCYCLE:     0x0200,
    GFLG_STRINGEXTEND: 0x0400,
    GFLG_IMAGEDISABLE: 0x0800,
    GFLG_EXTENDED:     0x8000,
    GACT_RELVERIFY:    0x0001,
    GACT_IMMEDIATE:    0x0002,
    GACT_ENDGADGET:    0x0004,
    GACT_FOLLOWMOUSE:  0x0008,
    GACT_RIGHTBORDER:  0x0010,
    GACT_LEFTBORDER:   0x0020,
    GACT_TOPBORDER:    0x0040,
    GACT_BOTTOMBORDER: 0x0080,
    GACT_BORDERSNIFF:  0x8000,
    GACT_TOGGLESELECT: 0x0100,
    GACT_BOOLEXTEND:   0x2000,
    GACT_STRINGLEFT:   0x0000,
    GACT_STRINGCENTER: 0x0200,
    GACT_STRINGRIGHT:  0x0400,
    GACT_LONGINT:      0x0800,
    GACT_ALTKEYMAP:    0x1000,
    GACT_STRINGEXTEND: 0x2000,
    GACT_ACTIVEGADGET: 0x4000,
    GTYP_GADGETTYPE:   0xFC00,
    GTYP_SCRGADGET:    0x4000,
    GTYP_GZZGADGET:    0x2000,
    GTYP_REQGADGET:    0x1000,
    GTYP_SYSGADGET:    0x8000,
    GTYP_SYSTYPEMASK:  0x00F0,
    GTYP_SIZING:       0x0010,
    GTYP_WDRAGGING:    0x0020,
    GTYP_SDRAGGING:    0x0030,
    GTYP_WDEPTH:       0x0040,
    GTYP_SDEPTH:       0x0050,
    GTYP_WZOOM:        0x0060,
    GTYP_SUNUSED:      0x0070,
    GTYP_CLOSE:        0x0080,
    GTYP_ICONIFY:      0x0090,
    GTYP_WUPFRONT:     0x0040,   /* GTYP_WDEPTH */
    GTYP_SUPFRONT:     0x0050,   /* GTYP_SDEPTH */
    GTYP_WDOWNBACK:    0x0060,   /* GTYP_WZOOM */
    GTYP_SDOWNBACK:    0x0070,   /* GTYP_SUNUSED */
    GTYP_GTYPEMASK:    0x0007,
    GTYP_BOOLGADGET:   0x0001,
    GTYP_GADGET0002:   0x0002,
    GTYP_PROPGADGET:   0x0003,
    GTYP_STRGADGET:    0x0004,
    GTYP_CUSTOMGADGET: 0x0005,

    /* Screen types (intuition/screens.h) */
    WBENCHSCREEN: 0x0001,
    PUBLICSCREEN: 0x0002,
    CUSTOMSCREEN: 0x000F,

    /* Screen attributes: tags for OpenScreenTags (intuition/screens.h) */
    SA_Left:              0x80000021,   /* SA_Dummy + 0x0001 */
    SA_Top:               0x80000022,   /* SA_Dummy + 0x0002 */
    SA_Width:             0x80000023,   /* SA_Dummy + 0x0003 */
    SA_Height:            0x80000024,   /* SA_Dummy + 0x0004 */
    SA_Depth:             0x80000025,   /* SA_Dummy + 0x0005 */
    SA_DetailPen:         0x80000026,   /* SA_Dummy + 0x0006 */
    SA_BlockPen:          0x80000027,   /* SA_Dummy + 0x0007 */
    SA_Title:             0x80000028,   /* SA_Dummy + 0x0008 */
    SA_Colors:            0x80000029,   /* SA_Dummy + 0x0009 */
    SA_ErrorCode:         0x8000002A,   /* SA_Dummy + 0x000A */
    SA_Font:              0x8000002B,   /* SA_Dummy + 0x000B */
    SA_SysFont:           0x8000002C,   /* SA_Dummy + 0x000C */
    SA_Type:              0x8000002D,   /* SA_Dummy + 0x000D */
    SA_BitMap:            0x8000002E,   /* SA_Dummy + 0x000E */
    SA_PubName:           0x8000002F,   /* SA_Dummy + 0x000F */
    SA_PubSig:            0x80000030,   /* SA_Dummy + 0x0010 */
    SA_PubTask:           0x80000031,   /* SA_Dummy + 0x0011 */
    SA_DisplayID:         0x80000032,   /* SA_Dummy + 0x0012 */
    SA_DClip:             0x80000033,   /* SA_Dummy + 0x0013 */
    SA_Overscan:          0x80000034,   /* SA_Dummy + 0x0014 */
    SA_Obsolete1:         0x80000035,   /* SA_Dummy + 0x0015 */
    SA_ShowTitle:         0x80000036,   /* SA_Dummy + 0x0016 */
    SA_Behind:            0x80000037,   /* SA_Dummy + 0x0017 */
    SA_Quiet:             0x80000038,   /* SA_Dummy + 0x0018 */
    SA_AutoScroll:        0x80000039,   /* SA_Dummy + 0x0019 */
    SA_Pens:              0x8000003A,   /* SA_Dummy + 0x001A */
    SA_FullPalette:       0x8000003B,   /* SA_Dummy + 0x001B */
    SA_ColorMapEntries:   0x8000003C,   /* SA_Dummy + 0x001C */
    SA_Parent:            0x8000003D,   /* SA_Dummy + 0x001D */
    SA_Draggable:         0x8000003E,   /* SA_Dummy + 0x001E */
    SA_Exclusive:         0x8000003F,   /* SA_Dummy + 0x001F */
    SA_SharePens:         0x80000040,   /* SA_Dummy + 0x0020 */
    SA_BackFill:          0x80000041,   /* SA_Dummy + 0x0021 */
    SA_Interleaved:       0x80000042,   /* SA_Dummy + 0x0022 */
    SA_Colors32:          0x80000043,   /* SA_Dummy + 0x0023 */
    SA_VideoControl:      0x80000044,   /* SA_Dummy + 0x0024 */
    SA_FrontChild:        0x80000045,   /* SA_Dummy + 0x0025 */
    SA_BackChild:         0x80000046,   /* SA_Dummy + 0x0026 */
    SA_LikeWorkbench:     0x80000047,   /* SA_Dummy + 0x0027 */
    SA_Reserved:          0x80000048,   /* SA_Dummy + 0x0028 */
    SA_MinimizeISG:       0x80000049,   /* SA_Dummy + 0x0029 */
    SA_OffScreenDragging: 0x8000004A,   /* SA_Dummy + 0x002a */

    /* Overscan types: the value of SA_Overscan (intuition/screens.h) */
    OSCAN_TEXT:     1,
    OSCAN_STANDARD: 2,
    OSCAN_MAX:      3,
    OSCAN_VIDEO:    4,

    /* DrawInfo pen numbers: indexes into dri_Pens (intuition/screens.h) */
    DETAILPEN:        0x0000,
    BLOCKPEN:         0x0001,
    TEXTPEN:          0x0002,
    SHINEPEN:         0x0003,
    SHADOWPEN:        0x0004,
    FILLPEN:          0x0005,
    FILLTEXTPEN:      0x0006,
    BACKGROUNDPEN:    0x0007,
    HIGHLIGHTTEXTPEN: 0x0008,
    BARDETAILPEN:     0x0009,
    BARBLOCKPEN:      0x000A,
    BARTRIMPEN:       0x000B,
    NUMDRIPENS:       0x000D,

    /* Image attributes (intuition/imageclass.h) */
    IA_Left:            0x80020001,   /* IA_Dummy + 0x01 */
    IA_Top:             0x80020002,   /* IA_Dummy + 0x02 */
    IA_Width:           0x80020003,   /* IA_Dummy + 0x03 */
    IA_Height:          0x80020004,   /* IA_Dummy + 0x04 */
    IA_FGPen:           0x80020005,   /* IA_Dummy + 0x05 */
    IA_BGPen:           0x80020006,   /* IA_Dummy + 0x06 */
    IA_Data:            0x80020007,   /* IA_Dummy + 0x07 */
    IA_LineWidth:       0x80020008,   /* IA_Dummy + 0x08 */
    IA_Pens:            0x8002000E,   /* IA_Dummy + 0x0E */
    IA_Resolution:      0x8002000F,   /* IA_Dummy + 0x0F */
    IA_APattern:        0x80020010,   /* IA_Dummy + 0x10 */
    IA_APatSize:        0x80020011,   /* IA_Dummy + 0x11 */
    IA_Mode:            0x80020012,   /* IA_Dummy + 0x12 */
    IA_Font:            0x80020013,   /* IA_Dummy + 0x13 */
    IA_Outline:         0x80020014,   /* IA_Dummy + 0x14 */
    IA_Recessed:        0x80020015,   /* IA_Dummy + 0x15 */
    IA_DoubleEmboss:    0x80020016,   /* IA_Dummy + 0x16 */
    IA_EdgesOnly:       0x80020017,   /* IA_Dummy + 0x17 */
    IA_ShadowPen:       0x80020009,   /* IA_Dummy + 0x09 */
    IA_HighlightPen:    0x8002000A,   /* IA_Dummy + 0x0A */
    IA_SupportsDisable: 0x8002001A,   /* IA_Dummy + 0x1a */
    IA_FrameType:       0x8002001B,   /* IA_Dummy + 0x1b */
    IA_Underscore:      0x8002001C,   /* IA_Dummy + 0x1c */
    IA_Scalable:        0x8002001D,   /* IA_Dummy + 0x1d */
    IA_ActivateKey:     0x8002001E,   /* IA_Dummy + 0x1e */
    IA_Screen:          0x8002001F,   /* IA_Dummy + 0x1f */
    IA_Precision:       0x80020020,   /* IA_Dummy + 0x20 */
    IA_Orientation:     0x80020023,   /* IA_Dummy + 0x23 */
    IA_Label:           0x80020028,   /* IA_Dummy + 0x28 */
    IA_EraseBackground: 0x8002002D,   /* IA_Dummy + 0x2D */
    IA_LabelPen:        0x80020038,   /* IA_Dummy + 0x38 */

    /* sysiclass: attributes, sizes and which image (intuition/imageclass.h) */
    SYSIA_Size:          0x8002000B,   /* IA_Dummy + 0x0B */
    SYSIA_Depth:         0x8002000C,   /* IA_Dummy + 0x0C */
    SYSIA_Which:         0x8002000D,   /* IA_Dummy + 0x0D */
    SYSIA_DrawInfo:      0x80020018,   /* IA_Dummy + 0x18 */
    SYSIA_Pens:          0x8002000E,   /* IA_Pens */
    SYSIA_ReferenceFont: 0x80020019,   /* IA_Dummy + 0x19 */
    SYSISIZE_MEDRES:     0,
    SYSISIZE_LOWRES:     1,
    SYSISIZE_HIRES:      2,
    DEPTHIMAGE:          0x00,
    ZOOMIMAGE:           0x01,
    SIZEIMAGE:           0x02,
    CLOSEIMAGE:          0x03,
    SDEPTHIMAGE:         0x05,
    LEFTIMAGE:           0x0A,
    UPIMAGE:             0x0B,
    RIGHTIMAGE:          0x0C,
    DOWNIMAGE:           0x0D,
    CHECKIMAGE:          0x0E,
    MXIMAGE:             0x0F,
    ICONIFYIMAGE:        0x16,
    SHIFTKEYIMAGE:       0x2A,
    MENUCHECK:           0x10,
    AMIGAKEY:            0x11,
    MENUMX:              0x1B,
    MENUSUB:             0x1C,

    /* Image drawing states (intuition/imageclass.h) */
    IDS_NORMAL:           0,
    IDS_SELECTED:         1,
    IDS_DISABLED:         2,
    IDS_BUSY:             3,
    IDS_INDETERMINATE:    4,
    IDS_INACTIVENORMAL:   5,
    IDS_INACTIVESELECTED: 6,
    IDS_INACTIVEDISABLED: 7,
    IDS_SELECTEDDISABLED: 8,
    IDS_INDETERMINANT:    4,   /* IDS_INDETERMINATE */

    /* frameiclass frame types (intuition/imageclass.h) */
    FRAME_DEFAULT:     0,
    FRAME_BUTTON:      1,
    FRAME_RIDGE:       2,
    FRAME_ICONDROPBOX: 3,
    FRAME_PROPBORDER:  4,
    FRAME_PROPKNOB:    5,
    FRAME_DISPLAY:     6,
    FRAME_CONTEXT:     7,

    /* Gadget attributes (intuition/gadgetclass.h) */
    GA_Left:                0x80030001,   /* GA_Dummy + 1 */
    GA_RelRight:            0x80030002,   /* GA_Dummy + 2 */
    GA_Top:                 0x80030003,   /* GA_Dummy + 3 */
    GA_RelBottom:           0x80030004,   /* GA_Dummy + 4 */
    GA_Width:               0x80030005,   /* GA_Dummy + 5 */
    GA_RelWidth:            0x80030006,   /* GA_Dummy + 6 */
    GA_Height:              0x80030007,   /* GA_Dummy + 7 */
    GA_RelHeight:           0x80030008,   /* GA_Dummy + 8 */
    GA_Text:                0x80030009,   /* GA_Dummy + 9 */
    GA_Image:               0x8003000A,   /* GA_Dummy + 10 */
    GA_Border:              0x8003000B,   /* GA_Dummy + 11 */
    GA_SelectRender:        0x8003000C,   /* GA_Dummy + 12 */
    GA_Highlight:           0x8003000D,   /* GA_Dummy + 13 */
    GA_Disabled:            0x8003000E,   /* GA_Dummy + 14 */
    GA_GZZGadget:           0x8003000F,   /* GA_Dummy + 15 */
    GA_ID:                  0x80030010,   /* GA_Dummy + 16 */
    GA_UserData:            0x80030011,   /* GA_Dummy + 17 */
    GA_SpecialInfo:         0x80030012,   /* GA_Dummy + 18 */
    GA_Selected:            0x80030013,   /* GA_Dummy + 19 */
    GA_EndGadget:           0x80030014,   /* GA_Dummy + 20 */
    GA_Immediate:           0x80030015,   /* GA_Dummy + 21 */
    GA_RelVerify:           0x80030016,   /* GA_Dummy + 22 */
    GA_FollowMouse:         0x80030017,   /* GA_Dummy + 23 */
    GA_RightBorder:         0x80030018,   /* GA_Dummy + 24 */
    GA_LeftBorder:          0x80030019,   /* GA_Dummy + 25 */
    GA_TopBorder:           0x8003001A,   /* GA_Dummy + 26 */
    GA_BottomBorder:        0x8003001B,   /* GA_Dummy + 27 */
    GA_ToggleSelect:        0x8003001C,   /* GA_Dummy + 28 */
    GA_SysGadget:           0x8003001D,   /* GA_Dummy + 29 */
    GA_SysGType:            0x8003001E,   /* GA_Dummy + 30 */
    GA_Previous:            0x8003001F,   /* GA_Dummy + 31 */
    GA_Next:                0x80030020,   /* GA_Dummy + 32 */
    GA_DrawInfo:            0x80030021,   /* GA_Dummy + 33 */
    GA_IntuiText:           0x80030022,   /* GA_Dummy + 34 */
    GA_LabelImage:          0x80030023,   /* GA_Dummy + 35 */
    GA_TabCycle:            0x80030024,   /* GA_Dummy + 36 */
    GA_GadgetHelp:          0x80030025,   /* GA_Dummy + 37 */
    GA_Bounds:              0x80030026,   /* GA_Dummy + 38 */
    GA_RelSpecial:          0x80030027,   /* GA_Dummy + 39 */
    GA_TextAttr:            0x80030028,   /* GA_Dummy + 40 */
    GA_ReadOnly:            0x80030029,   /* GA_Dummy + 41 */
    GA_Underscore:          0x8003002A,   /* GA_Dummy + 42 */
    GA_ActivateKey:         0x8003002B,   /* GA_Dummy + 43 */
    GA_BackFill:            0x8003002C,   /* GA_Dummy + 44 */
    GA_GadgetHelpText:      0x8003002D,   /* GA_Dummy + 45 */
    GA_UserInput:           0x8003002E,   /* GA_Dummy + 46 */
    GA_Hidden:              0x80030036,   /* GA_Dummy + 54 */
    GA_CustomMousePointer:  0x8003003C,   /* GA_Dummy + 60 */
    GA_PointerType:         0x8003003D,   /* GA_Dummy + 61 */
    GA_ParentHidden:        0x8003003E,   /* GA_Dummy + 62 */
    PGA_Freedom:            0x80031001,   /* PGA_Dummy + 0x0001 */
    PGA_Borderless:         0x80031002,   /* PGA_Dummy + 0x0002 */
    PGA_HorizPot:           0x80031003,   /* PGA_Dummy + 0x0003 */
    PGA_HorizBody:          0x80031004,   /* PGA_Dummy + 0x0004 */
    PGA_VertPot:            0x80031005,   /* PGA_Dummy + 0x0005 */
    PGA_VertBody:           0x80031006,   /* PGA_Dummy + 0x0006 */
    PGA_Total:              0x80031007,   /* PGA_Dummy + 0x0007 */
    PGA_Visible:            0x80031008,   /* PGA_Dummy + 0x0008 */
    PGA_Top:                0x80031009,   /* PGA_Dummy + 0x0009 */
    PGA_NewLook:            0x8003100A,   /* PGA_Dummy + 0x000A */
    PGA_KnobImage:          0x8003100D,   /* PGA_Dummy + 0x000D */
    STRINGA_MaxChars:       0x80032001,   /* STRINGA_Dummy + 0x0001 */
    STRINGA_Buffer:         0x80032002,   /* STRINGA_Dummy + 0x0002 */
    STRINGA_UndoBuffer:     0x80032003,   /* STRINGA_Dummy + 0x0003 */
    STRINGA_WorkBuffer:     0x80032004,   /* STRINGA_Dummy + 0x0004 */
    STRINGA_BufferPos:      0x80032005,   /* STRINGA_Dummy + 0x0005 */
    STRINGA_DispPos:        0x80032006,   /* STRINGA_Dummy + 0x0006 */
    STRINGA_AltKeyMap:      0x80032007,   /* STRINGA_Dummy + 0x0007 */
    STRINGA_Font:           0x80032008,   /* STRINGA_Dummy + 0x0008 */
    STRINGA_Pens:           0x80032009,   /* STRINGA_Dummy + 0x0009 */
    STRINGA_ActivePens:     0x8003200A,   /* STRINGA_Dummy + 0x000A */
    STRINGA_EditHook:       0x8003200B,   /* STRINGA_Dummy + 0x000B */
    STRINGA_EditModes:      0x8003200C,   /* STRINGA_Dummy + 0x000C */
    STRINGA_ReplaceMode:    0x8003200D,   /* STRINGA_Dummy + 0x000D */
    STRINGA_FixedFieldMode: 0x8003200E,   /* STRINGA_Dummy + 0x000E */
    STRINGA_NoFilterMode:   0x8003200F,   /* STRINGA_Dummy + 0x000F */
    STRINGA_Justification:  0x80032010,   /* STRINGA_Dummy + 0x0010 */
    STRINGA_LongVal:        0x80032011,   /* STRINGA_Dummy + 0x0011 */
    STRINGA_TextVal:        0x80032012,   /* STRINGA_Dummy + 0x0012 */
    STRINGA_ExitHelp:       0x80032013,   /* STRINGA_Dummy + 0x0013 */
    LAYOUTA_LayoutObj:      0x80038001,   /* LAYOUTA_Dummy + 0x0001 */
    LAYOUTA_Spacing:        0x80038002,   /* LAYOUTA_Dummy + 0x0002 */
    LAYOUTA_Orientation:    0x80038003,   /* LAYOUTA_Dummy + 0x0003 */
    LAYOUTA_ChildMaxWidth:  0x80038004,   /* LAYOUTA_Dummy + 0x0004 */
    LAYOUTA_ChildMaxHeight: 0x80038005,   /* LAYOUTA_Dummy + 0x0005 */

    /* Interconnection (icclass) attributes (intuition/icclass.h) */
    ICA_TARGET:     0x80040001,   /* ICA_Dummy + 1 */
    ICA_MAP:        0x80040002,   /* ICA_Dummy + 2 */
    ICTARGET_IDCMP: 0xFFFFFFFF,   /* ~0L */
    ICM_SETLOOP:    0x0402,
    ICM_CLEARLOOP:  0x0403,
    ICM_CHECKLOOP:  0x0404,
    ICSPECIAL_CODE: 0x80040003,   /* ICA_Dummy + 3 */

    /* BOOPSI root methods (intuition/classusr.h) */
    OM_NEW:       0x101,
    OM_DISPOSE:   0x102,
    OM_SET:       0x103,
    OM_GET:       0x104,
    OM_ADDTAIL:   0x105,
    OM_REMOVE:    0x106,
    OM_NOTIFY:    0x107,
    OM_UPDATE:    0x108,
    OM_ADDMEMBER: 0x109,
    OM_REMMEMBER: 0x10A,
    /* consts-end */
  });

  /* ============================================================
   * Menu numbers
   *
   * An IDCMP_MENUPICK message's code is a 16-bit menu number: which
   * menu, which item and which sub-item, packed together. These are
   * the macros of the same names in intuition/intuition.h:
   *
   *   #define MENUNUM(n)  ((n) & 0x1F)
   *   #define ITEMNUM(n)  (((n) >> 5) & 0x003F)
   *   #define SUBNUM(n)   (((n) >> 11) & 0x001F)
   *   #define FULLMENUNUM(menu, item, sub) \
   *           (SHIFTSUB(sub) | SHIFTITEM(item) | SHIFTMENU(menu))
   *
   * Compare a whole number with Number(Intuition.consts.MENUNULL) to
   * see whether anything was picked.
   * ============================================================ */

  /**
   * Which menu a menu number names, counted from 0 at the left.
   *
   * @param {number} menuNumber
   * @returns {number} 0..30, or 31 (NOMENU) for none
   */
  static MENUNUM(menuNumber) {
    return menuNumber & 0x1F;
  }

  /**
   * Which item of that menu, counted from 0 at the top.
   *
   * @param {number} menuNumber
   * @returns {number} 0..62, or 63 (NOITEM) for none
   */
  static ITEMNUM(menuNumber) {
    return (menuNumber >> 5) & 0x3F;
  }

  /**
   * Which sub-item of that item, counted from 0 at the top.
   *
   * @param {number} menuNumber
   * @returns {number} 0..30, or 31 (NOSUB) for none
   */
  static SUBNUM(menuNumber) {
    return (menuNumber >> 11) & 0x1F;
  }

  /**
   * Pack a menu, item and sub-item into one menu number.
   *
   * @param {number} menu
   * @param {number} item
   * @param {number} sub - 31 (NOSUB) for an item without sub-items
   * @returns {number}
   */
  static FULLMENUNUM(menu, item, sub) {
    return ((sub & 0x1F) << 11) | ((item & 0x3F) << 5) | (menu & 0x1F);
  }

  /* ============================================================
   * Window lifecycle
   * ============================================================ */

  /**
   * Open a window using the legacy NewWindow struct.
   *
   * @param {NewWindow|number} newWindow
   * @returns {Window|null}
   */
  static OpenWindow(newWindow) {
    let raw = this.call(this.lvo.OpenWindow, { a0: ptrOf(newWindow) });

    return raw ? new Window(raw) : null;
  }

  /**
   * Faithful 1:1 wrapper for OpenWindowTagList.
   *
   * @param {NewWindow|number|null} newWindow
   * @param {number|null} tagList
   * @returns {Window|null}
   */
  static OpenWindowTagList(newWindow, tagList) {
    let raw = this.call(
      this.lvo.OpenWindowTagList,
      { a0: ptrOf(newWindow), a1: ptrOf(tagList) }
    );

    return raw ? new Window(raw) : null;
  }

  /**
   * Convenience over OpenWindowTagList — accepts JS [tag, data] pairs,
   * builds and frees the TagItem array internally.
   *
   * @param {Array<[number, number]>} pairs
   * @returns {Window|null}
   */
  static OpenWindowTags(pairs) {
    return this._openWithTags(pairs,
      (tags) => this.OpenWindowTagList(null, tags));
  }

  /**
   * Shared by OpenWindowTags and OpenScreenTags: build the tag list,
   * open, free the tag list, and look after any strings.
   *
   * A JS string given as tag data (WA_Title, SA_Title, ...) is copied
   * to a C string first. Intuition keeps the POINTER to a title, not a
   * copy, so those strings must stay allocated for as long as the
   * window or screen is open. They are attached to the wrapper that is
   * returned and freed by CloseWindow / CloseScreen (or the wrapper's
   * close()). Until 0.217 a string here became 0, so no title showed.
   *
   * @template T
   * @param {Array<[number, number|string]>} pairs
   * @param {(tags: number) => T|null} open - opens with the tag list
   * @returns {T|null} the wrapper `open` returned, or null
   */
  static _openWithTags(pairs, open) {
    let strings = [];
    let opened  = null;

    try {
      let converted = pairs.map(([tag, data]) => {
        if (typeof data !== 'string') return [tag, data];

        let holder = globalThis.amiga.allocString(data);
        strings.push(holder);
        return [tag, holder.ptr];
      });

      let tags  = globalThis.amiga.makeTags(converted);
      let bytes = (converted.length + 1) * 8;

      try {
        opened = open(tags);
      }

      finally {
        globalThis.amiga.freeMem(tags, bytes);
      }
    }

    finally {
      if (opened) {
        opened._ownedStrings = strings;
      }

      else {
        for (let holder of strings) holder.free();
      }
    }

    return opened;
  }

  /**
   * Free the strings _openWithTags attached to a wrapper. Call only
   * after the window or screen has been closed.
   *
   * @param {*} wrapper - a Window or Screen wrapper, or a raw pointer
   * @returns {undefined}
   */
  static _freeOwnedStrings(wrapper) {
    if (!wrapper || typeof wrapper !== 'object') return;
    if (!wrapper._ownedStrings) return;

    for (let holder of wrapper._ownedStrings) holder.free();
    wrapper._ownedStrings = null;
  }

  /**
   * Close a window. Pair with every Open*.
   *
   * @param {Window|number} window
   * @returns {undefined}
   */
  static CloseWindow(window) {
    let result = this.call(this.lvo.CloseWindow, { a0: ptrOf(window) });

    this._freeOwnedStrings(window);
    return result;
  }

  static MoveWindow(window, dx, dy) {
    return this.call(this.lvo.MoveWindow, {
      a0: ptrOf(window), d0: dx | 0, d1: dy | 0,
    });
  }

  static SizeWindow(window, dw, dh) {
    return this.call(this.lvo.SizeWindow, {
      a0: ptrOf(window), d0: dw | 0, d1: dh | 0,
    });
  }

  static WindowToFront(window) {
    return this.call(this.lvo.WindowToFront, { a0: ptrOf(window) });
  }

  static WindowToBack(window) {
    return this.call(this.lvo.WindowToBack, { a0: ptrOf(window) });
  }

  static ActivateWindow(window) {
    return this.call(this.lvo.ActivateWindow, { a0: ptrOf(window) });
  }

  static BeginRefresh(window) {
    return this.call(this.lvo.BeginRefresh, { a0: ptrOf(window) });
  }

  static EndRefresh(window, complete) {
    return this.call(this.lvo.EndRefresh, {
      a0: ptrOf(window), d0: complete ? 1 : 0,
    });
  }

  /* ============================================================
   * Screen lifecycle
   * ============================================================ */

  static OpenScreenTagList(newScreen, tagList) {
    let raw = this.call(this.lvo.OpenScreenTagList, {
      a0: ptrOf(newScreen), a1: ptrOf(tagList),
    });

    return raw ? new Screen(raw) : null;
  }

  static OpenScreenTags(pairs) {
    return this._openWithTags(pairs,
      (tags) => this.OpenScreenTagList(null, tags));
  }

  static CloseScreen(screen) {
    let result = this.call(this.lvo.CloseScreen, { a0: ptrOf(screen) });

    /* CloseScreen returns FALSE and leaves the screen open if windows
     * are still on it; its title must then stay allocated. */
    if (result) this._freeOwnedStrings(screen);
    return result;
  }

  static ScreenToFront(screen) {
    return this.call(this.lvo.ScreenToFront, { a0: ptrOf(screen) });
  }

  static ScreenToBack(screen) {
    return this.call(this.lvo.ScreenToBack, { a0: ptrOf(screen) });
  }

  /**
   * Lock the named public screen (NULL = default Workbench).
   *
   * @param {string|number|null} name
   * @returns {Screen|null}
   */
  static LockPubScreen(name) {
    let namePtr = ptrOf(name);
    let bytes = 0;

    if (typeof name === 'string') {
      bytes = name.length + 1;
      namePtr = globalThis.amiga.allocMem(bytes);
      globalThis.amiga.pokeString(namePtr, name);
    }

    try {
      let raw = this.call(this.lvo.LockPubScreen, { a0: namePtr });

      return raw ? new Screen(raw) : null;
    }

    finally {
      if (bytes) globalThis.amiga.freeMem(namePtr, bytes);
    }
  }

  static UnlockPubScreen(name, screen) {
    return this.call(this.lvo.UnlockPubScreen, {
      a0: ptrOf(name), a1: ptrOf(screen),
    });
  }

  /**
   * Get a screen's DrawInfo: its pens, its font and the shape of its
   * pixels. Release it with FreeScreenDrawInfo.
   *
   * @param {Screen|number} screen
   * @returns {number} struct DrawInfo pointer (0 on failure); wrap it
   *   with `new DrawInfo(ptr)`
   */
  static GetScreenDrawInfo(screen) {
    return this.call(this.lvo.GetScreenDrawInfo, { a0: ptrOf(screen) });
  }

  /**
   * Release a DrawInfo obtained from GetScreenDrawInfo.
   *
   * @param {Screen|number}   screen
   * @param {DrawInfo|number} drawInfo
   * @returns {undefined}
   */
  static FreeScreenDrawInfo(screen, drawInfo) {
    this.call(this.lvo.FreeScreenDrawInfo, {
      a0: ptrOf(screen), a1: ptrOf(drawInfo),
    });
  }

  /* ============================================================
   * BOOPSI
   * ============================================================ */

  /**
   * NewObjectA(class, classID, tagList) — a0/a1/a2.
   *
   * @param {number} klass class pointer (NULL for public class by name)
   * @param {string|number} classID class ID string or NULL
   * @param {number|null} tagList
   * @returns {Image|number|null} Image wrapper for image classes; raw
   *   pointer otherwise; null on failure
   */
  static NewObjectA(klass, classID, tagList) {
    let idPtr = ptrOf(classID);
    let bytes = 0;

    if (typeof classID === 'string') {
      bytes = classID.length + 1;
      idPtr = globalThis.amiga.allocMem(bytes);
      globalThis.amiga.pokeString(idPtr, classID);
    }

    try {
      let raw = this.call(this.lvo.NewObjectA, {
        a0: ptrOf(klass), a1: idPtr, a2: ptrOf(tagList),
      });

      if (!raw) return null;

      /* Heuristic: image classes typically end in 'image' or contain
       * 'iclass'. Wrap in Image for those. Caller can re-wrap manually
       * if heuristic missed. */
      if (typeof classID === 'string' &&
          (classID.endsWith('image') || classID.includes('iclass'))) {
        return new Image(raw);
      }

      return raw;
    }

    finally {
      if (bytes) globalThis.amiga.freeMem(idPtr, bytes);
    }
  }

  /**
   * NewObjectA convenience taking a JS array of [tag, data] pairs.
   *
   * @param {string|number} classID
   * @param {Array<[number, number]>} pairs
   * @returns {Image|number|null}
   */
  static NewObjectTags(classID, pairs) {
    let tags = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.NewObjectA(0, classID, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  static DisposeObject(obj) {
    return this.call(this.lvo.DisposeObject, { a0: ptrOf(obj) });
  }

  static SetAttrsA(obj, tagList) {
    return this.call(this.lvo.SetAttrsA, {
      a0: ptrOf(obj), a1: ptrOf(tagList),
    });
  }

  static SetAttrsTags(obj, pairs) {
    let tags = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.SetAttrsA(obj, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  /**
   * SetGadgetAttrsA(gadget, window, requester, tagList) — the OM_SET
   * path that also re-renders the gadget. Required any time a gadget
   * attribute is changed while the window is open; per layout_gc.doc
   * "If using OM_SET, you MUST call through SetGadgetAttrs() to
   * protect the window layout properly." Raw SetAttrsA only updates
   * internal state and leaves the visible pixels stale.
   *
   * Register convention: a0=gadget, a1=window, a2=requester,
   * a3=tagList (intuition.library LVO -660).
   *
   * @param {number|object} gadget    — struct Gadget *
   * @param {number|object} window    — struct Window * (or 0)
   * @param {number|object} requester — struct Requester * (or 0)
   * @param {number}        tagList   — TagItem * (or 0)
   * @returns {number}
   */
  static SetGadgetAttrsA(gadget, window, requester, tagList) {
    return this.call(this.lvo.SetGadgetAttrsA, {
      a0: ptrOf(gadget),
      a1: ptrOf(window),
      a2: ptrOf(requester),
      a3: ptrOf(tagList),
    });
  }

  /**
   * RefreshGList(firstGadget, window, requester, numGadgets) — force
   * Intuition to re-render the specified gadgets. Unlike SetAttrs
   * (which only updates internal state) this performs the actual
   * paint, including erasing old content. Required after plain
   * SetAttrsA on an image child or after relayout shifts the pixels
   * around, because WM_RETHINK only drives relayout, not refresh.
   *
   * Register convention: a0=firstGadget, a1=window, a2=requester,
   * d0=numGadgets (intuition.library LVO -432).
   * numGadgets = -1 refreshes all gadgets from firstGadget onwards
   * AND the window frame; numGadgets = 1 refreshes just one gadget
   * (but for a layout that means its whole subtree).
   *
   * @param {number|object} firstGadget — struct Gadget *
   * @param {number|object} window      — struct Window *
   * @param {number|object} requester   — struct Requester * (or 0)
   * @param {number}        numGadgets  — count or -1 for "all + frame"
   * @returns {undefined}
   */
  static RefreshGList(firstGadget, window, requester, numGadgets) {
    return this.call(this.lvo.RefreshGList, {
      a0: ptrOf(firstGadget),
      a1: ptrOf(window),
      a2: ptrOf(requester),
      d0: numGadgets | 0,
    });
  }

  /**
   * DoGadgetMethodA(gadget, window, requester, message) — dispatch a
   * gadget method whose payload struct begins with `MethodID` +
   * `GadgetInfo *GInfo`. The LVO synthesises a GadgetInfo from the
   * window context and writes it into `message->GInfo` before invoking
   * the class's cl_Dispatcher, so the class can access RastPort,
   * DrawInfo, Screen, etc. for rendering.
   *
   * Required for GM_* methods like GM_TEXTEDITOR_ClearText / InsertText
   * — plain DoMethodA leaves GInfo=0 which causes a NULL deref inside
   * the class dispatcher and locks up the gadget. (User reported this
   * exact symptom on notes_demo Clear at 0.176.)
   *
   * Register convention: a0=gad, a1=win, a2=req, a3=message
   * (intuition.library LVO -810).
   *
   * @param {number|object} gadget    — struct Gadget *
   * @param {number|object} window    — struct Window *
   * @param {number|object} requester — struct Requester * (or 0)
   * @param {number}        message   — Msg pointer (struct with
   *                                    {ULONG MethodID; GadgetInfo*; ...})
   * @returns {number} dispatcher result
   */
  static DoGadgetMethodA(gadget, window, requester, message) {
    return this.call(this.lvo.DoGadgetMethodA, {
      a0: ptrOf(gadget),
      a1: ptrOf(window),
      a2: ptrOf(requester),
      a3: ptrOf(message),
    });
  }

  /**
   * GetAttr(attrID, obj, storagePtr) — d0=attrID, a0=obj, a1=storage.
   * Writes the attribute's current value through `storagePtr`
   * (typically a ULONG). Returns 1 on success, 0 if the class
   * doesn't support that attr.
   *
   * @param {number}     attrID
   * @param {number}     obj
   * @param {number}     storagePtr — ptr to a ULONG receiver
   * @returns {number}   1 on success, 0 on failure
   */
  static GetAttr(attrID, obj, storagePtr) {
    return this.call(this.lvo.GetAttr, {
      d0: attrID | 0, a0: ptrOf(obj), a1: ptrOf(storagePtr),
    });
  }

  /**
   * Ergonomic GetAttr — allocates a ULONG receiver, calls GetAttr,
   * returns the receiver's value (or null if GetAttr returned 0).
   *
   * @param {number} attrID
   * @param {number} obj
   * @returns {number|null}
   */
  static getAttr(attrID, obj) {
    let storage = globalThis.amiga.allocMem(4);
    if (!storage) return null;

    try {
      let ok = this.GetAttr(attrID, obj, storage);
      if (!ok) return null;
      return globalThis.amiga.peek32(storage);
    }

    finally {
      globalThis.amiga.freeMem(storage, 4);
    }
  }

  /* ============================================================
   * Misc
   * ============================================================ */

  static DrawImage(rport, image, x, y) {
    return this.call(this.lvo.DrawImage, {
      a0: ptrOf(rport), a1: ptrOf(image),
      d0: x | 0, d1: y | 0,
    });
  }

  static DisplayBeep(screen) {
    return this.call(this.lvo.DisplayBeep, { a0: ptrOf(screen) });
  }
}
