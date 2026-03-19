// solver.js — Shavian crossword interactive solver

// ── Shavian keyboard layouts ──────────────────────────────────────────────────
// Each layout maps a Latin key (lowercase) → Shavian character.
// Shaw Imperial matches the Keyman Shaw keyboard exactly (keyman.com/keyboards/sil_shaw).
// Keys confirmed from the Keyman source: unshifted row top→bottom, left→right.

const LAYOUT_SHAW = {
  name: 'Shaw Imperial',
  rows: [
    [[null,'𐑶'],[null,'𐑬'],[null,'𐑫'],[null,'𐑜'],[null,'𐑖'],[null,'𐑗'],[null,'𐑙'],[null,'𐑘'],[null,'𐑡'],[null,'𐑔']],
    [[null,'𐑭'],[null,'𐑷'],[null,'𐑵'],[null,'𐑱'],[null,'𐑳'],[null,'𐑓'],[null,'𐑞'],[null,'𐑤'],[null,'𐑥'],[null,'𐑣']],
    [[null,'𐑪'],[null,'𐑨'],[null,'𐑦'],[null,'𐑩'],[null,'𐑧'],[null,'𐑐'],[null,'𐑯'],[null,'𐑑'],[null,'𐑮'],[null,'𐑕']],
    [[null,'𐑾'],[null,'𐑲'],[null,'𐑴'],[null,'𐑰'],[null,'𐑚'],[null,'𐑝'],[null,'𐑟'],[null,'𐑒'],[null,'𐑢'],[null,'𐑛']],
    [[null,'𐑸'],[null,'𐑹'],[null,'𐑿'],[null,'𐑺'],[null,'𐑻'],[null,'𐑼'],[null,'𐑽']],
  ]
};

// QWERTY Phonetic: keys mapped by approximate English phonetics
const LAYOUT_QWERTY = {
  name: 'QWERTY Phonetic',
  rows: [
    [['q','𐑔'],['w','𐑞'],['e','𐑢'],['r','𐑮'],['t','𐑑'],['y','𐑘'],['u','𐑳'],['i','𐑦'],['o','𐑴'],['p','𐑐']],
    [['a','𐑨'],['s','𐑕'],['d','𐑛'],['f','𐑓'],['g','𐑜'],['h','𐑗'],['j','𐑡'],['k','𐑒'],['l','𐑤'],[';','𐑣']],
    [['z','𐑟'],['x','𐑖'],['c','𐑠'],['v','𐑝'],['b','𐑚'],['n','𐑯'],['m','𐑥'],[',','𐑙'],["'",'𐑲']],
    [['1','𐑩'],['2','𐑪'],['3','𐑫'],['4','𐑬'],['5','𐑭'],['6','𐑮'],['7','𐑯'],['8','𐑰'],['9','𐑱'],['0','𐑲']],
    [['!','𐑳'],['@','𐑴'],['#','𐑵'],['$','𐑶'],['%','𐑷'],['^','𐑸'],['&','𐑹'],['*','𐑺'],['(','𐑻'],[')','𐑼']],
  ]
};

// Shavian order: all 48 letters in canonical Shavian alphabet order
const SHAVIAN_ALL = [
  '𐑐','𐑚','𐑑','𐑛','𐑒','𐑜','𐑓','𐑝','𐑔','𐑞',
  '𐑕','𐑟','𐑖','𐑠','𐑗','𐑡','𐑘','𐑢','𐑙','𐑣',
  '𐑤','𐑮','𐑥','𐑯','𐑦','𐑰','𐑧','𐑱','𐑨','𐑲',
  '𐑩','𐑳','𐑪','𐑴','𐑫','𐑵','𐑬','𐑶','𐑭','𐑷',
  '𐑸','𐑹','𐑺','𐑻','𐑼','𐑽','𐑾','𐑿',
];
const LAYOUT_SHAVIAN_ORDER = {
  name: 'Shavian Order',
  rows: [
    SHAVIAN_ALL.slice(0,  10).map(c => [null, c]),
    SHAVIAN_ALL.slice(10, 20).map(c => [null, c]),
    SHAVIAN_ALL.slice(20, 30).map(c => [null, c]),
    SHAVIAN_ALL.slice(30, 40).map(c => [null, c]),
    SHAVIAN_ALL.slice(40).map(c => [null, c]),
  ]
};

const KB_LAYOUTS = [LAYOUT_SHAW, LAYOUT_QWERTY, LAYOUT_SHAVIAN_ORDER];
let kbLayoutIndex = 0;  // which layout is active

// Build latin→shavian map from active layout
function getKeyMap() {
  // Latin fallback always uses QWERTY Phonetic — only a-z keys map to Shavian.
  // Shaw Imperial maps Keyman's physical layout (digits, punctuation) so using
  // it as a fallback causes digits to type Shavian when Keyman is off.
  const map = {};
  LAYOUT_QWERTY.rows.forEach(row => row.forEach(([latin, shavian]) => {
    if (latin) map[latin.toLowerCase()] = shavian;
  }));
  return map;
}

// ── State ─────────────────────────────────────────────────────────────────────
let puzzle      = null;   // full puzzle data from API
let cellMap     = {};     // "(x,y)" → cell data
let wordMap     = {};     // word id → word data (with .cells, .direction, .number, etc.)
let cellWords   = {};     // "(x,y)" → { across: wordId, down: wordId }
let userGrid    = {};     // "(x,y)" → letter entered by user (pen)
let pencilGrid  = {};     // "(x,y)" → letter entered in pencil mode
let cellState   = {};     // "(x,y)" → '' | 'correct' | 'wrong' | 'revealed'
let activeCell  = null;   // {x, y}
let activeDir   = 'across';
let pencilMode  = false;  // pencil entries shown in blue, not checked
let CELL_SIZE   = 44;     // px — recalculated on load
const SOLVED_KEY = 'shavian_solved';

// ── Timer ─────────────────────────────────────────────────────────────────────
let timerSeconds  = 0;
let timerInterval = null;
let timerRunning  = false;

function timerStart() {
  if (timerRunning) return;
  timerRunning = true;
  timerInterval = setInterval(() => {
    timerSeconds++;
    renderTimer();
  }, 1000);
  const btn = document.getElementById('btn-timer-toggle');
  if (btn) btn.textContent = '⏸';
}

function timerStop() {
  clearInterval(timerInterval);
  timerRunning = false;
}

function timerReset() {
  timerStop();
  timerSeconds = 0;
  renderTimer();
}

function renderTimer() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const s = String(timerSeconds % 60).padStart(2, '0');
  el.textContent = m + ':' + s;
}

function timerToggle() {
  if (timerRunning) timerStop(); else timerStart();
  const btn = document.getElementById('btn-timer-toggle');
  if (btn) btn.textContent = timerRunning ? '⏸' : '▶';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const key  = (x, y)     => `${x},${y}`;
const ckey = ({x, y})   => key(x, y);

function getSolvedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SOLVED_KEY) || '[]')); }
  catch { return new Set(); }
}
function markSolved(id) {
  const s = getSolvedSet();
  s.add(String(id));
  localStorage.setItem(SOLVED_KEY, JSON.stringify([...s]));
}

// ── Puzzle ID from URL ────────────────────────────────────────────────────────
function getPuzzleId() {
  const m = location.pathname.match(/\/crossword\/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

// ── Build lookup maps ─────────────────────────────────────────────────────────
function buildMaps() {
  cellMap   = {};
  wordMap   = {};
  cellWords = {};

  puzzle.cells.forEach(c => {
    cellMap[key(c.x, c.y)] = c;
  });

  puzzle.words.forEach(w => {
    wordMap[w.id] = w;
    w.cells.forEach(([x, y]) => {
      const k = key(x, y);
      if (!cellWords[k]) cellWords[k] = {};
      cellWords[k][w.direction] = w.id;
    });
  });
}

// ── Grid rendering ────────────────────────────────────────────────────────────
function calcCellSize() {
  const panel = document.querySelector('.grid-panel');
  const maxW  = (panel.clientWidth  - 32);
  const maxH  = (panel.clientHeight - 32);
  const byW   = Math.floor(maxW  / puzzle.width);
  const byH   = Math.floor(maxH  / puzzle.height);
  CELL_SIZE   = Math.max(24, Math.min(52, byW, byH));
}

function buildGrid() {
  calcCellSize();
  const container = document.getElementById('grid-container');
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'xw-grid';
  grid.style.gridTemplateColumns = `repeat(${puzzle.width}, ${CELL_SIZE}px)`;
  grid.style.width  = `${puzzle.width  * CELL_SIZE}px`;
  grid.style.height = `${puzzle.height * CELL_SIZE}px`;

  // outer border

  for (let y = 1; y <= puzzle.height; y++) {
    for (let x = 1; x <= puzzle.width; x++) {
      const cell = cellMap[key(x, y)];
      const div  = document.createElement('div');
      div.className = 'xw-cell';
      div.dataset.x = x;
      div.dataset.y = y;
      div.style.width  = `${CELL_SIZE}px`;
      div.style.height = `${CELL_SIZE}px`;
      div.style.fontSize = `${CELL_SIZE}px`;  // used as em base

      if (cell.type === 'block') {
        div.classList.add('block');
      } else {
        // Bar grid classes
        if (cell.top_bar)    div.classList.add('bar-top');
        if (cell.right_bar)  div.classList.add('bar-right');
        if (cell.bottom_bar) div.classList.add('bar-bottom');
        if (cell.left_bar)   div.classList.add('bar-left');

        // Number
        if (cell.number) {
          const num = document.createElement('span');
          num.className = 'cell-num';
          num.style.fontSize = `${Math.max(8, CELL_SIZE * 0.28)}px`;
          num.textContent = cell.number;
          div.appendChild(num);
        }

        // Letter container
        const letter = document.createElement('span');
        letter.className = 'cell-letter';
        letter.style.fontSize = `${CELL_SIZE * 0.62}px`;
        div.appendChild(letter);

        div.addEventListener('click', () => onCellClick(x, y));
        div.addEventListener('touchend', e => { e.preventDefault(); onCellClick(x, y); });
      }

      grid.appendChild(div);
    }
  }

  container.appendChild(grid);
}

function getCellEl(x, y) {
  return document.querySelector(`.xw-cell[data-x="${x}"][data-y="${y}"]`);
}

function renderGridState() {
  for (let y = 1; y <= puzzle.height; y++) {
    for (let x = 1; x <= puzzle.width; x++) {
      const cell = cellMap[key(x, y)];
      if (!cell || cell.type === 'block') continue;
      const el     = getCellEl(x, y);
      const letter = el.querySelector('.cell-letter');
      const k = key(x, y);
      if (letter) {
        letter.textContent = userGrid[k] || pencilGrid[k] || '';
        letter.classList.toggle('pencil', !userGrid[k] && !!pencilGrid[k]);
      }
    }
  }
  applyHighlights();
}

function applyHighlights() {
  // Reset all non-block cells
  document.querySelectorAll('.xw-cell:not(.block)').forEach(el => {
    el.classList.remove('active', 'in-word', 'wrong', 'correct', 'revealed', 'pencilled');
    const k = key(parseInt(el.dataset.x), parseInt(el.dataset.y));
    if (pencilGrid[k] && !userGrid[k]) el.classList.add('pencilled');
    const st = cellState[k];
    if (st) el.classList.add(st);
  });

  if (!activeCell) return;

  // Highlight word
  const wordId = getActiveWordId();
  if (wordId) {
    wordMap[wordId].cells.forEach(([x, y]) => {
      const el = getCellEl(x, y);
      if (el && !el.classList.contains('wrong') && !el.classList.contains('correct') && !el.classList.contains('revealed')) {
        el.classList.add('in-word');
      }
    });
  }

  // Active cell on top
  const activeEl = getCellEl(activeCell.x, activeCell.y);
  if (activeEl) {
    activeEl.classList.remove('in-word');
    activeEl.classList.add('active');
  }
}

// ── Clue list ─────────────────────────────────────────────────────────────────
function buildClues() {
  const acrossEl = document.getElementById('clues-across');
  const downEl   = document.getElementById('clues-down');
  acrossEl.innerHTML = '';
  downEl.innerHTML   = '';

  puzzle.words
    .sort((a, b) => parseInt(a.number) - parseInt(b.number))
    .forEach(w => {
      if (!w.number) return;
      const li = document.createElement('li');
      li.className  = 'clue-item';
      li.dataset.wid = w.id;

      const numSpan  = document.createElement('span');
      numSpan.className = 'clue-item-num';
      numSpan.textContent = w.number;

      const textSpan = document.createElement('span');
      textSpan.className = 'clue-item-text';
      textSpan.textContent = w.clue || '—';

      const fmtSpan  = document.createElement('span');
      fmtSpan.className = 'clue-item-fmt';
      if (w.format) fmtSpan.textContent = `(${w.format})`;

      li.appendChild(numSpan);
      li.appendChild(textSpan);
      li.appendChild(fmtSpan);

      li.addEventListener('click', () => onClueClick(w.id));

      (w.direction === 'across' ? acrossEl : downEl).appendChild(li);
    });
}

function updateClueHighlight() {
  document.querySelectorAll('.clue-item').forEach(el => el.classList.remove('active-clue'));
  const wordId = getActiveWordId();
  if (!wordId) return;
  const li = document.querySelector(`.clue-item[data-wid="${wordId}"]`);
  if (li) {
    li.classList.add('active-clue');
    if (window.innerWidth > 1024) {
      li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

function updateBanner() {
  const wordId = getActiveWordId();
  const bannerNum  = document.getElementById('banner-num');
  const bannerDir  = document.getElementById('banner-dir');
  const bannerText = document.getElementById('banner-text');

  if (!wordId) {
    bannerNum.textContent  = '';
    bannerDir.textContent  = '';
    bannerText.textContent = 'Select a cell to begin';
    return;
  }
  const w = wordMap[wordId];
  bannerNum.textContent  = w.number || '';
  bannerDir.textContent  = w.direction;
  bannerText.textContent = w.clue || '—';
}

// ── Cell interaction ───────────────────────────────────────────────────────────
function getActiveWordId() {
  if (!activeCell) return null;
  const cw = cellWords[ckey(activeCell)];
  if (!cw) return null;
  // Prefer current direction; fall back
  return cw[activeDir] || cw['across'] || cw['down'] || null;
}


function onCellClick(x, y) {
  const cell = cellMap[key(x, y)];
  if (!cell || cell.type === 'block') return;

  if (activeCell && activeCell.x === x && activeCell.y === y) {
    // Same cell — toggle direction if both directions exist
    const cw = cellWords[key(x, y)] || {};
    if (cw.across && cw.down) {
      activeDir = activeDir === 'across' ? 'down' : 'across';
    }
  } else {
    activeCell = { x, y };
    // Choose a default direction for this cell
    const cw = cellWords[key(x, y)] || {};
    if (!cw[activeDir]) {
      activeDir = cw.across ? 'across' : 'down';
    }
  }

  applyHighlights();
  updateClueHighlight();
  updateBanner();
  timerStart();
  focusHiddenInput();
}

function onClueClick(wordId) {
  const w = wordMap[wordId];
  if (!w) return;
  activeDir  = w.direction;
  // Jump to first empty cell, else first cell
  const firstEmpty = w.cells.find(([x, y]) => !userGrid[key(x, y)]);
  const [x, y] = firstEmpty || w.cells[0];
  activeCell = { x, y };
  applyHighlights();
  updateClueHighlight();
  updateBanner();
  focusHiddenInput();
}

// ── Cursor movement ────────────────────────────────────────────────────────────
function advanceCursor() {
  if (!activeCell) return;
  const wordId = getActiveWordId();
  if (!wordId) return;
  const cells = wordMap[wordId].cells;
  const idx   = cells.findIndex(([x, y]) => x === activeCell.x && y === activeCell.y);
  if (idx < cells.length - 1) {
    const [nx, ny] = cells[idx + 1];
    activeCell = { x: nx, y: ny };
  }
  // Stop at end — do not wrap
}

function retreatCursor() {
  if (!activeCell) return;
  const wordId = getActiveWordId();
  if (!wordId) return;
  const cells = wordMap[wordId].cells;
  const idx   = cells.findIndex(([x, y]) => x === activeCell.x && y === activeCell.y);
  if (idx > 0) {
    const [nx, ny] = cells[idx - 1];
    activeCell = { x: nx, y: ny };
  }
}

function moveToNextWord(reverse = false) {
  // Stay within the current direction (across→across, down→down)
  const ordered = puzzle.words
    .filter(w => w.number && w.direction === activeDir)
    .sort((a, b) => parseInt(a.number) - parseInt(b.number));
  const wordId = getActiveWordId();
  const idx    = ordered.findIndex(w => w.id === wordId);
  const next   = ordered[(idx + (reverse ? -1 : 1) + ordered.length) % ordered.length];
  if (next) {
    const firstEmpty = next.cells.find(([x, y]) => !userGrid[key(x, y)]);
    const [x, y] = firstEmpty || next.cells[0];
    activeCell = { x, y };
  }
}

function moveArrow(dx, dy) {
  if (!activeCell) return;
  const nx = activeCell.x + dx;
  const ny = activeCell.y + dy;
  if (nx < 1 || nx > puzzle.width || ny < 1 || ny > puzzle.height) return;
  const cell = cellMap[key(nx, ny)];
  if (!cell || cell.type === 'block') return;
  activeCell = { x: nx, y: ny };
  // Update direction based on arrow
  if (dx !== 0) activeDir = 'across';
  if (dy !== 0) activeDir = 'down';
  const cw = cellWords[key(nx, ny)] || {};
  if (!cw[activeDir]) activeDir = cw.across ? 'across' : 'down';
}

// ── Typing ─────────────────────────────────────────────────────────────────────
function typeLetter(ch) {
  if (!activeCell) return;
  const k = ckey(activeCell);
  const cell = cellMap[k];
  if (!cell || cell.type === 'block') return;
  if (pencilMode) {
    pencilGrid[k] = ch;
    // pencil entries don't clear check state or affect solved detection
  } else {
    userGrid[k] = ch;
    delete pencilGrid[k]; // pen overwrites pencil
    delete cellState[k]; // clear any check state on re-entry
  }
  renderGridState();
  advanceCursor();
  applyHighlights();
  updateClueHighlight();
  updateBanner();
  checkSolved();
}

function backspace() {
  if (!activeCell) return;
  const k = ckey(activeCell);
  if (userGrid[k] || pencilGrid[k]) {
    delete userGrid[k];
    delete pencilGrid[k];
    delete cellState[k];
    renderGridState();
    applyHighlights();
  } else {
    retreatCursor();
    const k2 = ckey(activeCell);
    delete userGrid[k2];
    delete pencilGrid[k2];
    delete cellState[k2];
    renderGridState();
    applyHighlights();
  }
  updateClueHighlight();
  updateBanner();
}

// ── Keyboard handler ──────────────────────────────────────────────────────────
// Simple: collect surrogate pairs from consecutive input events, assemble the
// full codepoint, and display it. No layout mapping. No fallback. Just display
// whatever the user types. The on-screen keyboard and Latin fallback are
// separate opt-in features; physical keyboard input is passed through as-is.

const _sink = document.createElement('input');
_sink.type = 'text';
_sink.setAttribute('autocomplete', 'off');
_sink.setAttribute('autocorrect', 'off');
_sink.setAttribute('autocapitalize', 'off');
_sink.setAttribute('spellcheck', 'false');
_sink.style.cssText = 'position:absolute;top:0;left:0;width:2px;height:2px;opacity:0.01;border:none;padding:0;margin:0;font-size:16px;z-index:-1;';
document.body.appendChild(_sink);

function focusHiddenInput() {
  const scrollY = window.scrollY;
  _sink.style.top = scrollY + 'px';
  _sink.focus({ preventScroll: true });
  setTimeout(() => window.scrollTo(0, scrollY), 50);
  _sink.value = '';
}

let _highSurrogate = null;

_sink.addEventListener('input', e => {
  if (!activeCell) return;
  const data = e.data || '';
  _sink.value = '';

  for (const ch of data) {
    const cp = ch.codePointAt(0);

    if (cp >= 0xD800 && cp <= 0xDBFF) {
      _highSurrogate = cp;
      return;
    }

    if (cp >= 0xDC00 && cp <= 0xDFFF) {
      if (_highSurrogate !== null) {
        const fullCp = 0x10000 + ((_highSurrogate - 0xD800) << 10) + (cp - 0xDC00);
        _highSurrogate = null;
        if (fullCp >= 0x10450 && fullCp <= 0x1047F) {
          typeLetter(String.fromCodePoint(fullCp));
        }
      }
      _highSurrogate = null;
      return;
    }

    _highSurrogate = null;

    // Direct Shavian (unlikely but handle it)
    if (cp >= 0x10450 && cp <= 0x1047F) {
      typeLetter(ch);
      return;
    }

    // Plain Latin letter — display as-is so users aren't confused
    if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A)) {
      typeLetter(ch.toUpperCase());
      return;
    }

    // Everything else (digits, punctuation) — ignore
  }
});

_sink.addEventListener('keydown', e => {
  if (!activeCell) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); moveArrow(1, 0);  refresh(); return; }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); moveArrow(-1, 0); refresh(); return; }
  if (e.key === 'ArrowDown')  { e.preventDefault(); moveArrow(0, 1);  refresh(); return; }
  if (e.key === 'ArrowUp')    { e.preventDefault(); moveArrow(0, -1); refresh(); return; }
  if (e.key === 'Tab')        { e.preventDefault(); moveToNextWord(e.shiftKey); refresh(); return; }
  if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); backspace(); return; }
});

document.addEventListener('keydown', e => {
  if (!activeCell) return;
  if (document.activeElement !== _sink) focusHiddenInput();
});
document.addEventListener('click', e => {
  if (activeCell && !e.target.closest('button, a')) focusHiddenInput();
});

function refresh() {
  applyHighlights();
  updateClueHighlight();
  updateBanner();
}

// ── Check & Reveal ────────────────────────────────────────────────────────────
function checkWord() {
  const wordId = getActiveWordId();
  if (!wordId) return;
  wordMap[wordId].cells.forEach(([x, y]) => {
    const k    = key(x, y);
    const cell = cellMap[k];
    if (!cell || !userGrid[k]) return;
    cellState[k] = userGrid[k] === cell.solution ? 'correct' : 'wrong';
  });
  applyHighlights();
}

function checkAll() {
  Object.entries(cellMap).forEach(([k, cell]) => {
    if (cell.type === 'block' || !userGrid[k]) return;
    cellState[k] = userGrid[k] === cell.solution ? 'correct' : 'wrong';
  });
  applyHighlights();
}

function revealCell() {
  if (!activeCell) return;
  const k = ckey(activeCell);
  const cell = cellMap[k];
  if (!cell || cell.type === 'block') return;
  userGrid[k]  = cell.solution;
  cellState[k] = 'revealed';
  renderGridState();
  advanceCursor();
  refresh();
}

function revealWord() {
  const wordId = getActiveWordId();
  if (!wordId) return;
  wordMap[wordId].cells.forEach(([x, y]) => {
    const k = key(x, y);
    const cell = cellMap[k];
    if (!cell || cell.type === 'block') return;
    userGrid[k]  = cell.solution;
    cellState[k] = 'revealed';
  });
  renderGridState();
  refresh();
}

function revealAll() {
  Object.entries(cellMap).forEach(([k, cell]) => {
    if (cell.type === 'block') return;
    userGrid[k]  = cell.solution;
    cellState[k] = 'revealed';
  });
  renderGridState();
  refresh();
  // Revealing the puzzle does not count as solving it — no checkSolved call
}

function clearAll() {
  userGrid   = {};
  pencilGrid = {};
  cellState  = {};
  renderGridState();
  refresh();
}

// ── Solved detection ──────────────────────────────────────────────────────────
function checkSolved() {
  const letterCells = Object.values(cellMap).filter(c => c.type !== 'block');
  if (letterCells.length === 0) return;
  // Every letter cell must be filled by the user (not revealed, not empty)
  const allUserFilled = letterCells.every(c => {
    const k = key(c.x, c.y);
    return userGrid[k] && cellState[k] !== 'revealed';
  });
  if (!allUserFilled) return;
  // Every cell must match the solution
  const allCorrect = letterCells.every(c => userGrid[key(c.x, c.y)] === c.solution);
  if (!allCorrect) return;
  timerStop();
  markSolved(puzzle._id);
  setTimeout(() => {
    document.getElementById('solved-overlay').hidden = false;
  }, 600);
}

// ── On-screen keyboard ────────────────────────────────────────────────────────
function buildKeyboard() {
  const layout = KB_LAYOUTS[kbLayoutIndex];
  const showHints = layout !== LAYOUT_SHAVIAN_ORDER;

  // Update layout selector label
  const lbl = document.getElementById('kb-layout-label');
  if (lbl) lbl.textContent = layout.name;

  const rows = document.getElementById('kb-rows');
  rows.innerHTML = '';
  layout.rows.forEach(rowPairs => {
    const row = document.createElement('div');
    row.className = 'kb-row';
    rowPairs.forEach(([latin, shavian]) => {
      const btn = document.createElement('button');
      btn.className = 'kb-key';
      if (showHints && latin) {
        const hint = document.createElement('span');
        hint.className = 'kb-hint';
        hint.textContent = latin.toUpperCase();
        btn.appendChild(hint);
      }
      const ch = document.createElement('span');
      ch.className = 'kb-char';
      ch.textContent = shavian;
      btn.appendChild(ch);
      btn.addEventListener('click', () => typeLetter(shavian));
      row.appendChild(btn);
    });
    rows.appendChild(row);
  });
}

function cycleKbLayout(dir) {
  kbLayoutIndex = (kbLayoutIndex + dir + KB_LAYOUTS.length) % KB_LAYOUTS.length;
  buildKeyboard();
}

function toggleKeyboard() {
  const kb = document.getElementById('shavian-keyboard');
  kb.hidden = !kb.hidden;
}

document.getElementById('btn-kb-toggle').addEventListener('click', toggleKeyboard);
document.getElementById('kb-close').addEventListener('click', () => {
  document.getElementById('shavian-keyboard').hidden = true;
});
document.getElementById('kb-layout-prev').addEventListener('click', () => cycleKbLayout(-1));
document.getElementById('kb-layout-next').addEventListener('click', () => cycleKbLayout(1));
document.getElementById('kb-rows').addEventListener('click', e => {
  const btn = e.target.closest('.kb-key');
  if (btn && btn.dataset.action === 'backspace') backspace();
});

// ── Toolbar wiring ─────────────────────────────────────────────────────────────
document.getElementById('btn-check-word').addEventListener('click', checkWord);
document.getElementById('btn-check-all').addEventListener('click', checkAll);
document.getElementById('btn-clear').addEventListener('click', clearAll);

// Reveal dropdown
const revealBtn  = document.getElementById('btn-reveal-toggle');
const revealMenu = document.getElementById('reveal-menu');
revealBtn.addEventListener('click', e => {
  e.stopPropagation();
  revealMenu.hidden = !revealMenu.hidden;
});
document.addEventListener('click', () => { revealMenu.hidden = true; });
document.getElementById('btn-reveal-cell').addEventListener('click', revealCell);
document.getElementById('btn-reveal-word').addEventListener('click', revealWord);
document.getElementById('btn-reveal-all').addEventListener('click',  revealAll);

// ── Metadata display ──────────────────────────────────────────────────────────
function renderMeta() {
  document.title = `${puzzle.title} · Shavian Crosswords`;
  document.getElementById('puzzle-title').textContent = puzzle.title;
  document.getElementById('puzzle-byline').textContent =
    puzzle.author ? `by ${puzzle.author}` : '';
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const id = getPuzzleId();
  if (!id) { location.href = '/'; return; }

  try {
    const res = await fetch(`/api/crosswords/${id}`);
    if (!res.ok) throw new Error('Not found');
    const envelope = await res.json();
    puzzle = envelope.data;
    // Attach id for markSolved
    puzzle._id = id;
  } catch {
    document.querySelector('.solver-main').innerHTML =
      '<p style="padding:2rem;color:var(--ink-muted)">Puzzle not found.</p>';
    return;
  }

  buildMaps();
  renderMeta();
  buildGrid();

  buildClues();
  buildKeyboard();
  renderGridState();
  updateBanner();

  // Resize handler
  window.addEventListener('resize', () => {
    buildGrid();
    renderGridState();
  });
}

init();

// ── Pencil mode toggle ────────────────────────────────────────────────────────
const btnPencil = document.getElementById('btn-pencil');
if (btnPencil) {
  btnPencil.addEventListener('click', () => {
    pencilMode = !pencilMode;
    btnPencil.classList.toggle('active', pencilMode);
    btnPencil.title = pencilMode ? 'Pencil mode on (click to switch to pen)' : 'Switch to pencil mode';
    focusHiddenInput();
  });
}

// ── Timer controls ────────────────────────────────────────────────────────────
const btnTimerToggle = document.getElementById('btn-timer-toggle');
if (btnTimerToggle) {
  btnTimerToggle.addEventListener('click', () => {
    timerToggle();
    focusHiddenInput();
  });
}
const btnTimerReset = document.getElementById('btn-timer-reset');
if (btnTimerReset) {
  btnTimerReset.addEventListener('click', () => {
    timerReset();
    const btn = document.getElementById('btn-timer-toggle');
    if (btn) btn.textContent = '▶';
    focusHiddenInput();
  });
}

// ── Mobile banner tap to show/hide clue panel ─────────────────────────────────
const banner = document.getElementById('active-clue-banner');
if (banner && window.matchMedia('(max-width: 750px)').matches) {
  banner.addEventListener('click', () => {
    banner.classList.toggle('expanded');
    document.getElementById('clue-panel').classList.toggle('mobile-visible');
  });
}
