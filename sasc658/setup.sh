#!/bin/sh


export SC=`dirname $(readlink -f $0)`

#export SC="/Users/brie/Desktop/sasc658"

#function sc() {
#  vamos -V sc:${SC} -c ${SC}/vamos.cfg ${@}
#}

alias sc='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null sc'
alias Enforcer='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null Enforcer'
alias Enforcer_1.3='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null Enforcer_1.3'
alias IconX='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null IconX'
alias SegTracker='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null SegTracker'
alias WBLoad='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null WBLoad'
alias amigaguide='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null amigaguide'
alias asm='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null asm'
alias cctosc='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null cctosc'
alias cover='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null cover'
alias cpr='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null cpr'
alias cprk='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null cprk'
alias cprx='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null cprx'
alias demangle='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null demangle'
alias dumpobj='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null dumpobj'
alias fd2pragma='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null fd2pragma'
alias gst='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null gst'
alias guiprof='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null guiprof'
alias hypergst='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null hypergst'
alias lctosc='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null lctosc'
alias lntoslink='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null lntoslink'
alias lprof='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null lprof'
alias lstat='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null lstat'
alias mcc='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null mcc'
alias mkmk='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null mkmk'
alias mln='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null mln'
alias mungwall='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null mungwall'
alias omd='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null omd'
alias oml='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null oml'
alias sc='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null sc'
alias sc5='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null sc5'
alias scmsg='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null scmsg'
alias scompact='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null scompact'
alias scompare='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null scompare'
alias scopts='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null scopts'
alias scsetup='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null scsetup'
alias se='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null se'
alias slink='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null slink'
alias smake='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null smake'
alias smfind='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null smfind'
alias spatch='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null spatch'
alias splat='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null splat'
alias sprof='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null sprof'
alias tb='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null tb'

# Aliases likely to collide with other locally installed apps, prepending sc
alias scdiff='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null diff'
alias scgrep='vamos -V sc:${SC} -c ${SC}/vamos.cfg 2>/dev/null grep'
