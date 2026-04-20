/*
 * memory_probe.js — Print available / largest-chunk / total memory
 * for every MEMF_* category the system reports. Prints a live total
 * on an interval (every 500ms via TimerRequest in VBLANK mode) until
 * user hits Ctrl-C.
 *
 * Demonstrates:
 *   - Exec.AvailMem with different MEMF_* flags on Exec.consts:
 *     MEMF_ANY, MEMF_PUBLIC, MEMF_CHIP, MEMF_FAST — plus MEMF_LARGEST
 *     and MEMF_TOTAL ORed in to get the right number for each row
 *   - Short-running example with clean single-task loop (no window —
 *     purely console)
 *   - Number formatting: bytes → KiB / MiB string
 *
 * Run:        qjs examples/memory_probe.js [iterations=1]
 * Requires:   quickjs.library 0.134+
 */

import * as std from 'qjs:std';

if (typeof Exec !== 'function') {
  print('Q2 wrappers unavailable — need quickjs.library 0.134+');
  std.exit(1);
}

const E = Exec.consts;

const iterations = scriptArgs && scriptArgs[1]
                 ? parseInt(scriptArgs[1], 10)
                 : 1;

/**
 * Format a byte count as a KB/MB/GB string aligned on 8-char width.
 *
 * @param   {number} bytes
 * @returns {string}
 */
function fmt(bytes) {
  let units, value;

  if (bytes >= 1024 * 1024) {
    units = 'MB';
    value = (bytes / (1024 * 1024)).toFixed(2);
  }

  else if (bytes >= 1024) {
    units = 'KB';
    value = (bytes / 1024).toFixed(2);
  }

  else {
    units = 'B';
    value = bytes.toString();
  }

  return (value + ' ' + units).padStart(12);
}

/**
 * Print one line per memory class for a single snapshot.
 *
 * @returns {undefined}
 */
function reportSnapshot() {
  const classes = [
    { name: 'PUBLIC', flag: E.MEMF_PUBLIC },
    { name: 'CHIP  ', flag: E.MEMF_CHIP   },
    { name: 'FAST  ', flag: E.MEMF_FAST   },
    { name: 'ANY   ', flag: E.MEMF_ANY    },
  ];

  print('                Available        Largest          Total');

  for (let { name, flag } of classes) {
    let avail   = Exec.AvailMem(flag);
    let largest = Exec.AvailMem(flag | E.MEMF_LARGEST);
    let total   = Exec.AvailMem(flag | E.MEMF_TOTAL);

    print('  ' + name + '  ' + fmt(avail) + '  ' +
          fmt(largest) + '  ' + fmt(total));
  }
}

print('--- Memory report ---');
reportSnapshot();

if (iterations > 1) {
  const TimerRequest = amiga.devices.TimerRequest;
  const UNIT_VBLANK  = 1;
  const TR_ADDREQUEST = 9;

  let port = new MsgPort(Exec.CreateMsgPort());
  let tr   = new TimerRequest();
  tr.replyPort  = port.ptr;
  tr.messageLen = TimerRequest.SIZE;

  let rc = Exec.OpenDevice('timer.device', UNIT_VBLANK, tr, 0);

  if (rc !== 0) {
    print('OpenDevice failed rc=' + rc);
    Exec.DeleteMsgPort(port);
    tr.free();
    std.exit(1);
  }

  try {
    for (let i = 1; i < iterations; i++) {
      tr.command = TR_ADDREQUEST;
      tr.setTimeval(0, 500000);   /* 0.5 sec */
      Exec.DoIO(tr);

      print('');
      print('--- Tick ' + (i + 1) + ' ---');
      reportSnapshot();
    }
  }

  finally {
    Exec.CloseDevice(tr);
    Exec.DeleteMsgPort(port);
    tr.free();
  }
}

print('');
print('Done.');
