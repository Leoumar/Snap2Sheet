/* ── SNAP2SHEET app.js ──────────────────────────────────────────────── */

/* ── LOGIN ──────────────────────────────────────────────────────────── */
(function initLogin() {
  const overlay = document.getElementById('loginOverlay');
  const saved   = sessionStorage.getItem('s2s_user');
  if (saved) overlay.classList.add('hidden');

  document.getElementById('loginEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
})();

function doLogin() {
  const input = document.getElementById('loginEmail');
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');
  const email = input.value.trim();

  // Simple email validation
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) {
    input.classList.add('err');
    errEl.textContent = 'Please enter a valid email address.';
    input.focus();
    return;
  }

  input.classList.remove('err');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  // Simulate a brief async check, then grant access
  setTimeout(() => {
    sessionStorage.setItem('s2s_user', email);
    const overlay = document.getElementById('loginOverlay');
    overlay.classList.add('hidden');
    btn.disabled = false;
    btn.textContent = 'Continue →';
  }, 600);
}

const API = 'http://localhost:8000';

let mode    = 'auto';
let file    = null;
let fields  = [];

/* ── DROP ZONE ──────────────────────────────────────────────────────── */
const dz   = document.getElementById('dropzone');
const fin  = document.getElementById('fileInput');

dz.addEventListener('click', () => fin.click());
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('over');
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});
fin.addEventListener('change', () => { if (fin.files[0]) loadFile(fin.files[0]); });

function loadFile(f) {
  const ok = ['image/jpeg','image/png','image/webp'];
  if (!ok.includes(f.type)) { toast('Use JPG, PNG or WEBP', 'err'); return; }
  file = f;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('previewWrap').style.display = 'block';
    document.getElementById('extractBtn').disabled = false;
    setBadge('File Ready');
  };
  r.readAsDataURL(f);
}

function clearAll() {
  file = null; fields = [];
  fin.value = '';
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('previewImg').src = '';
  document.getElementById('extractBtn').disabled = true;
  document.getElementById('addBtn').style.display  = 'none';
  document.getElementById('dlBtn').style.display   = 'none';
  document.getElementById('results').style.display   = 'none';
  document.getElementById('loading').style.display   = 'none';
  document.getElementById('placeholder').style.display = 'block';
  setBadge('Ready');
}

/* ── MODE ───────────────────────────────────────────────────────────── */
function setMode(m) {
  mode = m;
  ['mAuto','mHand','mPrint'].forEach(id => document.getElementById(id).classList.remove('active'));
  const map = { auto:'mAuto', handwritten:'mHand', print:'mPrint' };
  document.getElementById(map[m]).classList.add('active');
}

/* ── EXTRACT ────────────────────────────────────────────────────────── */
async function extract() {
  if (!file) return;

  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('results').style.display     = 'none';
  document.getElementById('loading').style.display     = 'block';
  document.getElementById('addBtn').style.display      = 'none';
  document.getElementById('dlBtn').style.display       = 'none';
  document.getElementById('extractBtn').disabled       = true;
  document.getElementById('extractLabel').textContent  = '⏳ Extracting…';

  // Animate loading steps
  const steps = ['ls1','ls2','ls3','ls4'];
  steps.forEach(s => { const el = document.getElementById(s); el.classList.remove('active','done'); });
  let si = 0;
  const stepTimer = setInterval(() => {
    if (si > 0) { document.getElementById(steps[si-1]).classList.replace('active','done'); }
    if (si < steps.length) { document.getElementById(steps[si]).classList.add('active'); si++; }
    else clearInterval(stepTimer);
  }, 800);

  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', mode);

    const res = await fetch(`${API}/extract`, { method:'POST', body:fd });
    clearInterval(stepTimer);
    steps.forEach(s => document.getElementById(s).classList.replace('active','done'));

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Server error' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    fields = data.fields || [];

    renderFields(fields, data.stats || {});
    setBadge(`${fields.length} fields`, 'ok');
    toast(`✅ ${fields.length} fields extracted`, 'ok');

  } catch (e) {
    clearInterval(stepTimer);
    document.getElementById('loading').style.display    = 'none';
    document.getElementById('placeholder').style.display = 'block';
    setBadge('Error', 'err');
    toast('Error: ' + e.message, 'err');
  } finally {
    document.getElementById('extractBtn').disabled      = false;
    document.getElementById('extractLabel').textContent = '🔍 Extract Fields';
  }
}

/* ── RENDER FIELDS ──────────────────────────────────────────────────── */
function renderFields(flds, stats) {
  document.getElementById('loading').style.display    = 'none';
  document.getElementById('results').style.display    = 'flex';
  document.getElementById('addBtn').style.display     = 'inline-block';
  document.getElementById('dlBtn').style.display      = 'inline-block';

  const meta = document.getElementById('resMeta');
  meta.innerHTML = `
    <span>Total: ${flds.length}</span>
    ${stats.handwritten ? `<span class="t-hw">✍️ Handwritten: ${stats.handwritten}</span>` : ''}
    ${stats.printed     ? `<span class="t-pr">🖨️ Printed: ${stats.printed}</span>`         : ''}
    ${stats.engine      ? `<span>🔧 ${stats.engine}</span>`                                 : ''}
  `;

  const grid = document.getElementById('fieldsGrid');
  grid.innerHTML = '';
  flds.forEach((f, i) => grid.appendChild(makeCard(f, i)));
}

function makeCard(f, i) {
  const hw  = f.type === 'handwritten';
  const div = document.createElement('div');
  div.className = `field-card ${hw ? 'hw' : 'pr'}`;
  div.dataset.i = i;
  div.innerHTML = `
    <div class="fc-top">
      <input class="fc-key" value="${esc(f.key)}" onchange="fields[${i}].key=this.value" title="Edit field name"/>
      <span class="fc-tag">${hw ? '✍️ HW' : '🖨️ PR'}</span>
    </div>
    <textarea class="fc-val" rows="2" onchange="fields[${i}].value=this.value">${esc(f.value)}</textarea>
    <button class="fc-del" onclick="delField(${i})" title="Remove">✕</button>
  `;
  return div;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function delField(i) {
  fields.splice(i, 1);
  renderFields(fields, {});
}

function addField() {
  fields.push({ key:`field_${fields.length+1}`, value:'', type:'printed' });
  renderFields(fields, {});
  document.getElementById('fieldsGrid').lastChild?.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

/* ── DOWNLOAD EXCEL ─────────────────────────────────────────────────── */
async function downloadExcel() {
  if (!fields.length) { toast('No fields to export', 'err'); return; }
  const btn = document.getElementById('dlBtn');
  btn.textContent = '⏳ Building…';
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/export`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ fields })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `snap2sheet_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('✅ Excel downloaded!', 'ok');
  } catch(e) {
    toast('Export failed: ' + e.message, 'err');
  } finally {
    btn.textContent = '📥 Download Excel';
    btn.disabled = false;
  }
}

/* ── HELPERS ────────────────────────────────────────────────────────── */
function setBadge(txt, type) {
  const b = document.getElementById('badge');
  b.textContent = txt;
  b.style.borderColor = type==='ok'  ? 'rgba(123,255,176,.4)'
                      : type==='err' ? 'rgba(255,107,53,.4)'
                      : '';
  b.style.color       = type==='ok'  ? '#7bffb0'
                      : type==='err' ? '#ff6b35'
                      : '';
}

let _tt;
function toast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type||''}`;
  clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove('show'), 3500);
}
