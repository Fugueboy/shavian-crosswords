// home.js

const SOLVED_KEY = 'shavian_solved'; // localStorage key → Set of solved puzzle IDs

function getSolvedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SOLVED_KEY) || '[]')); }
  catch { return new Set(); }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function puzzleURL(id) { return `/crossword/${id}`; }

function renderFeatured(puzzle, solved) {
  const el = document.getElementById('featured-puzzle');
  el.classList.remove('skeleton');
  el.innerHTML = '';
  el.href = puzzleURL(puzzle.id);
  el.setAttribute('role', 'link');

  const name = document.createElement('div');
  name.className = 'puzzle-name';
  name.textContent = puzzle.title;

  const info = document.createElement('div');
  info.className = 'puzzle-info';

  const parts = [];
  if (puzzle.author) parts.push(`By ${puzzle.author}`);
  parts.push(formatDate(puzzle.published));
  parts.push(`${puzzle.width}×${puzzle.height}`);
  info.textContent = parts.join(' · ');

  if (solved.has(String(puzzle.id))) {
    const badge = document.createElement('span');
    badge.className = 'solved-badge';
    badge.textContent = 'Solved';
    info.appendChild(document.createTextNode(' '));
    info.appendChild(badge);
  }

  el.appendChild(name);
  el.appendChild(info);

  el.addEventListener('click', () => { window.location.href = puzzleURL(puzzle.id); });
}

function renderArchive(puzzles, solved) {
  const list = document.getElementById('puzzle-list');
  list.innerHTML = '';

  if (puzzles.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-muted);font-size:0.9rem;padding:1rem 0">No puzzles yet.</p>';
    return;
  }

  puzzles.forEach(puzzle => {
    const row = document.createElement('a');
    row.className = 'puzzle-row';
    row.href = puzzleURL(puzzle.id);

    const title = document.createElement('span');
    title.className = 'row-title';
    title.textContent = puzzle.title;

    const meta = document.createElement('span');
    meta.className = 'row-meta';

    const parts = [];
    if (puzzle.author) parts.push(puzzle.author);
    parts.push(formatDate(puzzle.published));
    parts.push(`${puzzle.width}×${puzzle.height}`);
    meta.textContent = parts.join(' · ');

    row.appendChild(title);
    row.appendChild(meta);

    if (solved.has(String(puzzle.id))) {
      const badge = document.createElement('span');
      badge.className = 'solved-badge';
      badge.textContent = '✓';
      row.appendChild(badge);
    }

    list.appendChild(row);
  });
}

async function init() {
  const solved = getSolvedSet();
  try {
    const res = await fetch('/api/crosswords');
    const puzzles = await res.json();

    if (puzzles.length === 0) {
      document.getElementById('featured-puzzle').innerHTML =
        '<p style="color:var(--ink-muted)">No puzzles published yet. Check back soon!</p>';
      document.getElementById('puzzle-list').innerHTML = '';
      return;
    }

    renderFeatured(puzzles[0], solved);

    const archivePuzzles = puzzles.slice(1);
    if (archivePuzzles.length > 0) {
      renderArchive(archivePuzzles, solved);
    } else {
      document.getElementById('archive').style.display = 'none';
    }
  } catch (e) {
    document.getElementById('featured-puzzle').innerHTML =
      '<p style="color:var(--ink-muted)">Failed to load puzzles.</p>';
    console.error(e);
  }
}

init();
