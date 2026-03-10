// admin.js

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}

// ── File upload ───────────────────────────────────────────────────────────────
let selectedFile = null;

const fileInput     = document.getElementById('file-input');
const uploadZone    = document.getElementById('upload-zone');
const uploadPrompt  = document.getElementById('upload-prompt');
const uploadPreview = document.getElementById('upload-preview');
const fileNameEl    = document.getElementById('file-name');
const clearFileBtn  = document.getElementById('clear-file-btn');
const browseBtn     = document.getElementById('browse-btn');
const uploadBtn     = document.getElementById('upload-btn');
const uploadStatus  = document.getElementById('upload-status');

browseBtn.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('click', e => {
  if (e.target !== clearFileBtn && e.target !== browseBtn) fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

// Drag-and-drop
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) setFile(f);
});

clearFileBtn.addEventListener('click', e => {
  e.stopPropagation();
  clearFile();
});

function setFile(f) {
  selectedFile = f;
  fileNameEl.textContent = f.name;
  uploadPrompt.hidden  = true;
  uploadPreview.hidden = false;
  uploadBtn.disabled   = false;
  uploadStatus.textContent = '';
  uploadStatus.className = 'upload-status';
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  uploadPrompt.hidden  = false;
  uploadPreview.hidden = true;
  uploadBtn.disabled   = true;
  uploadStatus.textContent = '';
  uploadStatus.className = 'upload-status';
}

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  uploadBtn.disabled = true;
  uploadStatus.textContent = 'Uploading…';
  uploadStatus.className   = 'upload-status';

  const fd = new FormData();
  fd.append('file', selectedFile);

  try {
    const res = await fetch('/api/crosswords', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(getCredentials()) },
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || res.statusText);
    }
    const data = await res.json();
    uploadStatus.textContent = `✓ "${data.title}" uploaded successfully.`;
    uploadStatus.className   = 'upload-status success';
    clearFile();
    loadTable();
  } catch (e) {
    uploadStatus.textContent = `✗ ${e.message}`;
    uploadStatus.className   = 'upload-status error';
    uploadBtn.disabled = false;
  }
});

// ── Credentials (basic auth prompt) ──────────────────────────────────────────
let _creds = null;
function getCredentials() {
  if (_creds) return _creds;
  const user = prompt('Admin username:') || 'admin';
  const pass = prompt('Admin password:') || '';
  _creds = `${user}:${pass}`;
  return _creds;
}

// ── Table ─────────────────────────────────────────────────────────────────────
async function loadTable() {
  const tbody = document.getElementById('crossword-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading…</td></tr>';

  try {
    const res = await fetch('/api/crosswords');
    const puzzles = await res.json();

    if (puzzles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No crosswords yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    puzzles.forEach(p => {
      const tr = document.createElement('tr');

      // Fetch grid type from full data lazily — for now, guess from stored width/height
      // (We'll fetch full data for type badge)
      tr.innerHTML = `
        <td><a href="/crossword/${p.id}">${escHtml(p.title)}</a></td>
        <td>${escHtml(p.author || '—')}</td>
        <td>${formatDate(p.published)}</td>
        <td>${p.width}×${p.height}</td>
        <td><span class="type-badge" id="type-${p.id}">…</span></td>
        <td><button class="btn-delete" data-id="${p.id}">Delete</button></td>
      `;
      tbody.appendChild(tr);

      // Load grid type
      fetch(`/api/crosswords/${p.id}`)
        .then(r => r.json())
        .then(full => {
          const badge = document.getElementById(`type-${p.id}`);
          if (badge) {
            const t = full.data.grid_type || 'block';
            badge.textContent = t;
            badge.className   = `type-badge ${t}`;
          }
        });
    });

    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteRow(parseInt(btn.dataset.id)));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">Error: ${e.message}</td></tr>`;
  }
}

async function deleteRow(id) {
  if (!confirm('Delete this crossword? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/crosswords/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Basic ' + btoa(getCredentials()) },
    });
    if (!res.ok) throw new Error(res.statusText);
    loadTable();
  } catch (e) {
    alert(`Failed to delete: ${e.message}`);
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

loadTable();
