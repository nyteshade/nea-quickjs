/*****************************************************************
 ** GetWindowPointer                                            **
 ** Read the preferences of a ViNCEd window                     **
 **-------------------------------------------------------------**
 ** This program demonstrates how to read the preferences of    **
 ** a ViNCEd window, just the stream.                           **
 ** It also demonstrates how to use the link libraries.         **
 **                                                             **
 ** It is by no means complete, it doesn't print the flags and  **
 ** the keyboard settings - this is just an example.            **
 **                                                             **
 ** For SAS/C, registerized parameters, long int, base relative **
 ** addressing, you should link this with                       **
 ** lib/vnc_stub.rr.base.lib                                    **
 **                                                             **
 ** You may also use the pragmas, but this means that you've to **
 ** provide the console window pointer for each call, which is  **
 ** rather annoying. Furthermore, it has to be passed in a5     **
 ** which MIGHT cause trouble for some old or broken compilers  **
 **                                                             **
 ** Version 1.01 24 May 2001            © 2001 THOR-Software    **
 ** Thomas Richter                                              **
 *****************************************************************/

#include <exec/types.h>
#include <exec/memory.h>
#include <dos/dos.h>
#include <dos/dosextens.h>
#include <intuition/intuition.h>

#include <vnc/Window.h>
#include <vnc/Prefs.h>
#include <vnc/Macros.h>

/* We do not include proto/vnc.h since this would use the pragmas.
   However, this program should demonstrate how to use the link
   libraries.

   Compile with registerized parameters, near data with base
   register a4, and link with vnc_stub.rr.base.lib.

   SAS/C requires the following options:

PARAMETERS=REGISTERS
ANSI
NOSTACKCHECK
LINK
SMALLCODE
SMALLDATA
STRICT
MULTIPLECHARACTERCONSTANTS
STRINGSECTION=NEAR
LIBRARY=ULIB:vnc_stub.rr.base.lib
IGNORE=51
IGNORE=220

*/

#include <clib/vnc_protos.h>
#include <proto/exec.h>
#include <proto/dos.h>
#include <proto/graphics.h>

/* The library base is already defined in the link libraries */
extern struct VNCBase *VNCBase;

/* Prototypes */
int main(int argc,char **argv);
void PrintPrefs(struct VNCPrefs *vpf);
void PrintColor(struct ViColorEntry *vc);
void PrintTAB(struct ViTabPriors *vt);

int main(int argc,char **argv)
{
struct ViNCWindow *cn;
struct VNCPrefs *vpf;

        if (VNCBase=(struct VNCBase *)OpenLibrary("vnc.library",41L)) {
                /* Identify now the ViNCWindow of our stream */
                if (cn=FindCNWindow(Output())) {
                        /* Set the window pointer to what we've read */
                        SetCNWindow(cn);
                        /* The next one is important: It releases the intuition
                           window. Since we don't need it anyways, we're free
                           to do it now. */
                        UnFindCNWindow(Output());


                        /* Allocate a buffer for the prefs */
                        if (vpf=AllocPrefsBuffer()) {
                                /* Read the preferences from the window */
                                if (GetWindowPrefs_CN(vpf,-1)) {
                                        /* Print them, just to demonstrate they are there */
                                        PrintPrefs(vpf);
                                } else  Printf("Can't read the window prefs.\n");
                                FreePrefsBuffer(vpf);
                        } else  Printf("No memory for the preferences buffer.\n");


                } else Printf("Output stream is not a ViNCEd window.\n");
        } else Printf("Requires at least vnc.library V41 (3.60) or better.\n");

        return 0;
}

/* Print the preferences, or at least the major part of it.
   More could be done here, but this is mainly for demonstration
   and not a complete program. */

void PrintPrefs(struct VNCPrefs *vpf)
{
struct List macrolist,buttonlist;
struct ViNCMacro *vm;
struct ViNCButton *vb;
LONG fine;
int i;

        /* First, convert the preferences into a somewhat more
           useable form */
        NewList(&macrolist);
        NewList(&buttonlist);

        LockWindow_CN();
        fine=Prefs2List_CN(&macrolist,&buttonlist,vpf,
                        VPF_FUNCLENGTH,VPF_SHORTLENGTH,
                        vpf->vpf_Macros,vpf->vpf_Buttons);
        UnLockWindow_CN();

        if (!fine) {
                Printf("Can't build the macros and button list.\n");
                return;
        }


/* Now print the preferences, or at least a part of it. */

        Printf("Prefs version %ld.%ld.\n",vpf->vpf_Version,vpf->vpf_Revision);

        Printf("Size of the history     : %ld\n",vpf->vpf_HistorySize);
        Printf("Number of strings       : %ld\n",vpf->vpf_Macros);
        Printf("Maximal size of macros  : %ld\n",vpf->vpf_MacroSize);
        Printf("Number of buttons       : %ld\n",vpf->vpf_Buttons);
        Printf("Max. size of but. title : %ld\n",vpf->vpf_ButtonSize);
        Printf("Size of the upper buffer: %ld\n",vpf->vpf_UpperLines);
        Printf("Size of the lower buffer: %ld\n",vpf->vpf_LowerLines);
        Printf("Size of the cache       : %ld\n",vpf->vpf_CacheLines);
        Printf("Rebuild delay           : %ld ms\n",vpf->vpf_RebuildMicros/1000);
        Printf("Scroll threshold        : %ld ms\n",vpf->vpf_SlowMicros/1000);
        Printf("Blink speed             : %ld ms\n",vpf->vpf_BlinkMicros/1000);
        Printf("Double TAB speed        : %ld ms\n",vpf->vpf_TABMicros/1000);

        Printf("Default mode id         : 0x%08lx\n",vpf->vpf_DefModeID);
        Printf("Path only qualifier     : 0x%04lx\n",vpf->vpf_PathOnlyQ);
        Printf("Name only qualifier     : 0x%04lx\n",vpf->vpf_NameOnlyQ);

        /* Print the cursor color */
        Printf("Cursor color            : ");
        PrintColor(&(vpf->vpf_CursorColor));

        /* and the other color registers */
        for (i=0;i<16;i++) {
                Printf("Color register %2ld       : ",i);
                PrintColor(&(vpf->vpf_Colors[i]));
        }

        /* Print TAB expansion details */

        Printf("TAB expansion           :\n");
        PrintTAB(&(vpf->vpf_TABPriors));

        Printf("Short expansion         :\n");
        PrintTAB(&(vpf->vpf_SrtPriors));

        Printf("Devs expansion          :\n");
        PrintTAB(&(vpf->vpf_DevPriors));

        Printf("Dir expansion           :\n");
        PrintTAB(&(vpf->vpf_DirPriors));

        Printf("Icon expansion          :\n");
        PrintTAB(&(vpf->vpf_InfPriors));

        Printf("Alternate expansion     :\n");
        PrintTAB(&(vpf->vpf_AltPriors));

        Printf("TAB expansion           :\n");
        PrintTAB(&(vpf->vpf_TABPriors));

        Printf("Requester Left Edge     :%ld\n",vpf->vpf_ReqLeft);
        Printf("Requester Top Edge      :%ld\n",vpf->vpf_ReqTop);
        Printf("Requester Width         :%ld\n",vpf->vpf_ReqWidth);
        Printf("Requester Height        :%ld\n",vpf->vpf_ReqHeight);

        /* Print now the list of macros */
        Printf("The macros              :\n");
        for(vm=(struct ViNCMacro *)(macrolist.lh_Head);vm->vmac_succ;vm=vm->vmac_succ)
                Printf("%s\n",vm->vmac_text);

        /* And the list of buttons */
        Printf("The buttons             :\n");
        for(vb=(struct ViNCButton *)(buttonlist.lh_Head);vb->vbut_succ;vb=vb->vbut_succ)
                Printf("%s (%s)\n",vb->vbut_text,vb->vbut_title);


        /* Now release both lists */
        LockWindow_CN();
        FreeMacroList_CN(&macrolist);
        FreeMacroList_CN(&buttonlist);
        UnLockWindow_CN();
}

/* Print a color register. We just print the RGB values, not
   the flags. Extensions are left to the reader. */

void PrintColor(struct ViColorEntry *vc)
{
        Printf("Red 0x%04lx Green 0x%04lx Blue 0x%04lx\n",
                vc->vce_Red,vc->vce_Green,vc->vce_Blue);
}

/* Print the priorities of the TAB expansion settings. Again,
   the flags are not printed. */

void PrintTAB(struct ViTabPriors *vt)
{
        Printf("\tPath priority         : %ld\n",vt->vtp_PathPri);
        Printf("\tCommand priority      : %ld\n",vt->vtp_CommandPri);
        Printf("\tResident priority     : %ld\n",vt->vtp_ResidentPri);
        Printf("\tIcon priority         : %ld\n",vt->vtp_InfoPri);

        Printf("\tDevice priority       : %ld\n",vt->vtp_DevicePri);
        Printf("\tAssign priority       : %ld\n",vt->vtp_AssignPri);
        Printf("\tVolume priority       : %ld\n",vt->vtp_VolumePri);
        Printf("\tDirectory priority    : %ld\n",vt->vtp_DirPri);

        Printf("\tFile priority         : %ld\n",vt->vtp_FilePri);
        Printf("\tExecutables priority  : %ld\n",vt->vtp_ExecPri);
        Printf("\tScript priority       : %ld\n",vt->vtp_ScriptPri);

}

