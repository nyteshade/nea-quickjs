/*
 * quiz_demo.js — five-question multiple-choice quiz.
 *
 * One question at a time, four answer buttons (A/B/C/D), correct/
 * wrong feedback in a status line, score tally, and a final-results
 * screen. Demonstrates a small game-style state machine on top of
 * the OO Reaction layer with no special wrappers needed.
 *
 * Requires quickjs.library 0.156+.
 * Run:  qjs examples/quiz_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Label, Bevel,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { A: 1, B: 2, C: 3, D: 4, NEXT: 10, QUIT: 11 };

const QUESTIONS = [
  {
    q: 'Which year was the Amiga 1000 released?',
    a: ['1983', '1985', '1987', '1990'],
    correct: 1,
  },
  {
    q: 'Which company manufactured the original Amiga chipset?',
    a: ['Motorola', 'Commodore', 'Atari', 'Commodore (formerly Amiga Corp)'],
    correct: 3,
  },
  {
    q: 'Reaction is shorthand for what?',
    a: ['Reactive Animation', 'ReAction (BOOPSI gadget framework)',
        'Real-time Action', 'React Native, Amiga port'],
    correct: 1,
  },
  {
    q: 'What does BOOPSI stand for?',
    a: ['Basic Object-Oriented Programming System for Intuition',
        'Binary Object Operations for Performance and Speed Improvements',
        'Buffered Output Operations for Pipelined Stream Input',
        'Big Object-Oriented Programming Subsystem for Intuition'],
    correct: 0,
  },
  {
    q: 'Which CPU did the Amiga 4000 ship with?',
    a: ['68020', '68030', '68040', '68060'],
    correct: 2,
  },
];

let qLabel  = new Label({ text: '' });
let stLabel = new Label({ text: '' });

let aBtn = new Button({ id: GID.A, text: 'A' });
let bBtn = new Button({ id: GID.B, text: 'B' });
let cBtn = new Button({ id: GID.C, text: 'C' });
let dBtn = new Button({ id: GID.D, text: 'D' });
let nextBtn = new Button({ id: GID.NEXT, text: '_Next', disabled: true });
let quitBtn = new Button({ id: GID.QUIT, text: '_Quit' });

let questionBox = new Bevel({
  style: BevelStyle.GROUP, label: 'Question',
});

let win = new Window({
  title:       'Amiga Quiz',
  innerWidth:  500,
  innerHeight: 320,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [
      new Layout({
        orientation: 'vertical', innerSpacing: 4,
        bevelStyle:  BevelStyle.GROUP, label: 'Question',
        children: [ qLabel ],
      }),
      new Layout({
        orientation: 'vertical', innerSpacing: 4, evenSize: true,
        children: [ aBtn, bBtn, cBtn, dBtn ],
      }),
      stLabel,
      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ nextBtn, quitBtn ],
      }),
    ],
  }),
});

let qIdx  = 0;
let score = 0;
let answered = false;

const ANSWER_BUTTONS = [aBtn, bBtn, cBtn, dBtn];
const ANSWER_KEYS = ['A', 'B', 'C', 'D'];

function loadQuestion() {
  let q = QUESTIONS[qIdx];
  qLabel.text = 'Q' + (qIdx + 1) + '/' + QUESTIONS.length + ': ' + q.q;
  for (let i = 0; i < 4; i++) {
    ANSWER_BUTTONS[i].text = ANSWER_KEYS[i] + ') ' + q.a[i];
    ANSWER_BUTTONS[i].set({ disabled: false });
  }
  stLabel.text = 'Score so far: ' + score;
  nextBtn.set({ disabled: true });
  answered = false;
}

function answer(idx) {
  if (answered) return;
  answered = true;
  for (let b of ANSWER_BUTTONS) b.set({ disabled: true });
  let q = QUESTIONS[qIdx];
  if (idx === q.correct) {
    score++;
    stLabel.text = 'Correct! Score: ' + score;
  } else {
    stLabel.text = 'Wrong. Correct answer was ' + ANSWER_KEYS[q.correct] +
                  ') ' + q.a[q.correct] + '. Score: ' + score;
  }
  if (qIdx < QUESTIONS.length - 1) {
    nextBtn.set({ disabled: false });
  } else {
    nextBtn.text = '_Done';
    nextBtn.set({ disabled: false });
  }
}

function results() {
  let pct = Math.round((score / QUESTIONS.length) * 100);
  qLabel.text = 'Quiz complete!';
  for (let b of ANSWER_BUTTONS) b.set({ disabled: true });
  stLabel.text = 'Final score: ' + score + ' / ' + QUESTIONS.length +
                ' (' + pct + '%)';
  nextBtn.set({ disabled: true });
  print('Final score: ' + score + '/' + QUESTIONS.length + ' (' + pct + '%)');
}

loadQuestion();
win.open();
print('Quiz open. Pick A/B/C/D, click Next to advance.');

let done = false;
try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.A: answer(0); break;
        case GID.B: answer(1); break;
        case GID.C: answer(2); break;
        case GID.D: answer(3); break;
        case GID.NEXT:
          if (qIdx < QUESTIONS.length - 1) {
            qIdx++;
            loadQuestion();
          } else {
            results();
          }
          break;
        case GID.QUIT:
          done = true;
          break;
      }
      if (done) break;
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
