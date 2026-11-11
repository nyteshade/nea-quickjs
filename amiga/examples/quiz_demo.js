/*
 * quiz_demo.js - a five-question multiple-choice quiz about the Amiga.
 *
 *   +- Question ---------------------------------------+
 *   | Q1/5: Which year was the Amiga 1000 released?    |
 *   +--------------------------------------------------+
 *   | [ A) 1983                                      ] |
 *   | [ B) 1985                                      ] |   answers
 *   | [ C) 1987                                      ] |
 *   | [ D) 1990                                      ] |
 *   | Score so far: 0                                  |   status line
 *   | [        Next         ] [         Quit         ] |
 *   +--------------------------------------------------+
 *
 * Click an answer. The status line says whether it was right, the
 * answers are ghosted so you cannot change your mind, and Next moves
 * on. After the last question Next reads Done and shows the final
 * score, which is also printed on the Shell.
 *
 * The file has three parts, read top to bottom:
 *
 *   1. THE QUIZ  - the questions and the score. Plain JavaScript.
 *   2. THE PANEL - the window, written as a tree that looks like it.
 *   3. THE LOOP  - clicks in, quiz told, panel redrawn.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 500 x 320 pixels inside
 *   - window.class, layout.gadget, button.gadget and string.gadget are
 *     installed in SYS:Classes, as they are on AmigaOS 3.2
 *   - the question and the status line are read-only string gadgets:
 *     string.gadget is the usual OS 3.2 Reaction gadget for text that
 *     changes, and updates in place. label.image is for static text;
 *     it does not repaint when its text is changed
 *   - a button's label can be changed while the window is open, and a
 *     ghosted button sends no clicks
 *   - the longest answers fit on a button at the screen's font
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/quiz_demo.js
 */

const { Window, Layout, Button, StringGadget,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;


/* ==================================================================
 * 1. THE QUIZ
 *
 * The questions, which one we are on, and the score. Nothing here
 * knows about gadgets; the panel further down only ever calls these
 * methods and reads these fields.
 * ================================================================== */

/** The questions. `correct` is an index into `answers`. */
const QUESTIONS = [
  {
    text: 'Which year was the Amiga 1000 released?',
    answers: ['1983', '1985', '1987', '1990'],
    correct: 1,
  },
  {
    text: 'Which company manufactured the original Amiga chipset?',
    answers: ['Motorola', 'Commodore', 'Atari',
              'Commodore (formerly Amiga Corp)'],
    correct: 3,
  },
  {
    text: 'Reaction is shorthand for what?',
    answers: ['Reactive Animation', 'ReAction (BOOPSI gadget framework)',
              'Real-time Action', 'React Native, Amiga port'],
    correct: 1,
  },
  {
    text: 'What does BOOPSI stand for?',
    answers: ['Basic Object-Oriented Programming System for Intuition',
              'Binary Object Operations for Performance and Speed ' +
                'Improvements',
              'Buffered Output Operations for Pipelined Stream Input',
              'Big Object-Oriented Programming Subsystem for Intuition'],
    correct: 0,
  },
  {
    text: 'Which CPU did the Amiga 4000 ship with?',
    answers: ['68020', '68030', '68040', '68060'],
    correct: 2,
  },
];

/** The letter each answer goes by, in order. Every question has this
 *  many answers. */
const ANSWER_KEYS = ['A', 'B', 'C', 'D'];

class Quiz {
  /**
   * @param {Array<{text: string, answers: Array<string>,
   *                correct: number}>} questions
   */
  constructor(questions) {
    /** @type {Array<{text: string, answers: Array<string>,
     *                correct: number}>} */
    this.questions = questions;

    /** @type {number} index into this.questions */
    this.index = 0;

    /** @type {number} how many were answered correctly */
    this.score = 0;

    /** @type {boolean} true once the current question has an answer */
    this.answered = false;

    /** @type {boolean} whether that answer was the right one */
    this.wasCorrect = false;

    /** @type {boolean} true once Next was clicked on the last question */
    this.finished = false;
  }

  /* ---- reading the quiz ---- */

  /** @returns {{text: string, answers: Array<string>, correct: number}}
   *    the current question */
  get question() {
    return this.questions[this.index];
  }

  /** @returns {boolean} */
  get onLastQuestion() {
    return this.index === this.questions.length - 1;
  }

  /** @returns {number} the score as a whole percentage */
  get percent() {
    return Math.round((this.score / this.questions.length) * 100);
  }

  /* ---- the buttons ---- */

  /**
   * Answer the current question. Only the first answer counts.
   *
   * @param {number} choice - index into the question's answers
   * @returns {undefined}
   */
  answer(choice) {
    if (this.answered) return;

    this.answered = true;
    this.wasCorrect = (choice === this.question.correct);
    if (this.wasCorrect) this.score++;
  }

  /**
   * Move to the next question, or finish after the last one.
   *
   * @returns {undefined}
   */
  next() {
    if (this.onLastQuestion) {
      this.finished = true;
      return;
    }

    this.index++;
    this.answered = false;
  }
}


/* ==================================================================
 * 2. THE PANEL
 *
 * First the gadgets the loop needs to talk to, each given a name. Then
 * the window, which arranges them. Read the `layout:` tree next to the
 * picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { A: 1, B: 2, C: 3, D: 4, NEXT: 10, QUIT: 11 };

/* Both lines of text change as the quiz goes on, so they are read-only
 * string gadgets rather than Labels. */
let questionLine = new StringGadget({
  text: '', readOnly: true, maxChars: 160,
});
let statusLine = new StringGadget({
  text: '', readOnly: true, maxChars: 80,
});

/** The answer buttons, in the order of ANSWER_KEYS. They start with
 *  just their letter; render() gives them the answers. */
let answerButtons = [
  new Button({ id: ID.A, text: 'A' }),
  new Button({ id: ID.B, text: 'B' }),
  new Button({ id: ID.C, text: 'C' }),
  new Button({ id: ID.D, text: 'D' }),
];

let nextButton = new Button({ id: ID.NEXT, text: '_Next', disabled: true });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
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
        children: [ questionLine ],
      }),

      new Layout({
        orientation: 'vertical', innerSpacing: 4, evenSize: true,
        children: answerButtons,
      }),

      statusLine,

      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ nextButton, quitButton ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Wait for a click, tell the quiz, then make the panel show whatever
 * the quiz now says. The quiz is the only source of truth: the panel
 * never decides anything.
 * ================================================================== */

let quiz = new Quiz(QUESTIONS);

/**
 * One answer as it is written on its button and in the status line.
 *
 * @param {number} choice - index into the current question's answers
 * @returns {string} for example "B) 1985"
 */
function answerText(choice) {
  return ANSWER_KEYS[choice] + ') ' + quiz.question.answers[choice];
}

/**
 * What the line above the answers should say.
 *
 * @returns {string}
 */
function questionText() {
  if (quiz.finished) return 'Quiz complete!';

  return 'Q' + (quiz.index + 1) + '/' + quiz.questions.length +
         ': ' + quiz.question.text;
}

/**
 * What the status line should say.
 *
 * @returns {string}
 */
function statusText() {
  if (quiz.finished) {
    return 'Final score: ' + quiz.score + ' / ' + quiz.questions.length +
           ' (' + quiz.percent + '%)';
  }

  if (!quiz.answered) return 'Score so far: ' + quiz.score;

  if (quiz.wasCorrect) return 'Correct! Score: ' + quiz.score;

  return 'Wrong. Correct answer was ' + answerText(quiz.question.correct) +
         '. Score: ' + quiz.score;
}

/** What the panel currently shows, so that show() only touches a
 *  gadget whose content has really changed. */
let shown = {};

/**
 * Set one gadget attribute, but only if it differs from what is
 * already on screen.
 *
 * @param {string} key - any unique name for this gadget + attribute
 * @param {object} gadget
 * @param {string} attribute - e.g. 'text', 'disabled'
 * @param {*} value
 * @returns {undefined}
 */
function show(key, gadget, attribute, value) {
  if (shown[key] === value) return;

  gadget.set({ [attribute]: value });
  shown[key] = value;
}

/**
 * Make the whole panel match the quiz.
 *
 * @returns {undefined}
 */
function render() {
  show('question', questionLine, 'text', questionText());

  /* The answers can be clicked until one of them has been, and not at
   * all once the quiz is over. */
  let answersGhosted = quiz.answered || quiz.finished;

  answerButtons.forEach((button, choice) => {
    show('answer' + choice,  button, 'text',     answerText(choice));
    show('ghosted' + choice, button, 'disabled', answersGhosted);
  });

  show('status', statusLine, 'text', statusText());

  /* Next waits for an answer. On the last question it reads Done, and
   * once the final score is up there is nowhere further to go. */
  let lastAnswered = quiz.answered && quiz.onLastQuestion;

  show('nextLabel', nextButton, 'text', lastAnswered ? '_Done' : '_Next');
  show('nextGhosted', nextButton, 'disabled',
       !quiz.answered || quiz.finished);
}

/** What each button does. A handler may return a line to print on the
 *  Shell once the panel has been redrawn. */
const onClick = {
  [ID.A]: () => quiz.answer(0),
  [ID.B]: () => quiz.answer(1),
  [ID.C]: () => quiz.answer(2),
  [ID.D]: () => quiz.answer(3),

  [ID.NEXT]: () => {
    quiz.next();
    if (!quiz.finished) return '';

    return 'Final score: ' + quiz.score + '/' + quiz.questions.length +
           ' (' + quiz.percent + '%)';
  },
};

/* The first question goes onto the gadgets before the window opens, so
 * it never appears empty. */
render();
window.open();
print('Quiz open. Pick A/B/C/D, click Next to advance.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind !== EventKind.BUTTON_CLICK) continue;
    if (event.sourceId === ID.QUIT) break;

    let news = onClick[event.sourceId] && onClick[event.sourceId]();

    render();
    if (news) print(news);
  }
}
finally {
  window.dispose();
}

print('Bye.');
