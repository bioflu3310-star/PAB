/**
 * PAB Dashboard Add-on
 * ─────────────────────────────────────────────────
 * Adds:
 * 1. Notification bell icon in topbar with dropdown
 * 2. Assessor form_submissions table on dashboard
 * 3. Stats card for assessor submissions
 *
 * USAGE: Add this line to your index.html right before </body>:
 *   <script src="dashboard-addon.js"></script>
 */

(function() {

// ─── 1. Inject CSS ────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
/* ── NOTIFICATION BELL ── */
.notif-wrap{position:relative;}
.notif-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);cursor:pointer;font-size:16px;position:relative;transition:all 0.13s;}
.notif-btn:hover{border-color:var(--accent);background:var(--accent-bg);}
.notif-count-bell{position:absolute;top:-2px;right:-2px;background:var(--danger);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;min-width:16px;text-align:center;display:none;line-height:1.4;}
.notif-count-bell.show{display:block;}
.notif-dropdown{position:absolute;top:calc(100% + 8px);right:0;width:380px;max-height:440px;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);overflow:hidden;display:none;z-index:200;}
.notif-dropdown.open{display:block;animation:fadeUp 0.15s ease;}
.notif-dd-header{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.notif-dd-title{font-size:13px;font-weight:700;}
.notif-dd-list{max-height:360px;overflow-y:auto;}
.notif-dd-item{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);transition:background 0.1s;cursor:pointer;}
.notif-dd-item:last-child{border-bottom:none;}
.notif-dd-item.unread{background:var(--accent-bg);}
.notif-dd-item:hover{background:var(--surface2);}
.notif-dd-icon{font-size:16px;flex-shrink:0;margin-top:2px;}
.notif-dd-body{flex:1;min-width:0;}
.notif-dd-text{font-size:12.5px;color:var(--text);line-height:1.4;}
.notif-dd-text strong{font-weight:700;}
.notif-dd-time{font-size:10px;color:var(--text3);margin-top:3px;}
.notif-dd-empty{padding:32px 16px;text-align:center;font-size:13px;color:var(--text3);}
.notif-dd-mark{font-size:11px;color:var(--accent);cursor:pointer;font-weight:600;background:none;border:none;font-family:'Inter',sans-serif;padding:4px 8px;border-radius:4px;}
.notif-dd-mark:hover{background:var(--accent-bg);}
`;
document.head.appendChild(style);


// ─── 2. Add Notification Bell to Topbar ───────────────────────────────────────
const topbarRight = document.querySelector('.topbar-right');
if (topbarRight) {
  const bellWrap = document.createElement('div');
  bellWrap.className = 'notif-wrap';
  bellWrap.id = 'notif-wrap';
  bellWrap.innerHTML = `
    <button class="notif-btn" onclick="window._toggleNotifDD()" title="Notifications">
      🔔
      <span class="notif-count-bell" id="notif-count-bell">0</span>
    </button>
    <div class="notif-dropdown" id="notif-dropdown">
      <div class="notif-dd-header">
        <span class="notif-dd-title">🔔 Notifications</span>
        <button class="notif-dd-mark" onclick="window._markAllReadBell()">Mark all read</button>
      </div>
      <div class="notif-dd-list" id="notif-dd-list">
        <div class="notif-dd-empty">Loading…</div>
      </div>
    </div>
  `;
  topbarRight.insertBefore(bellWrap, topbarRight.firstChild);

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!bellWrap.contains(e.target)) {
      const dd = document.getElementById('notif-dropdown');
      if (dd) dd.classList.remove('open');
    }
  });
}


// ─── 3. Add Assessor Submissions Table to Dashboard ───────────────────────────
const dashView = document.getElementById('view-dashboard');
if (dashView) {
  // Add stat card for assessor submissions
  const statsGrid = dashView.querySelector('.stats-grid');
  if (statsGrid) {
    statsGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    const asrStat = document.createElement('div');
    asrStat.className = 'stat-card';
    asrStat.innerHTML = `<div class="stat-label">Assessor Submissions</div><div class="stat-num" id="s-assessor">0</div><div class="stat-hint">From shared forms</div>`;
    // Insert before "Forms Created"
    const lastCard = statsGrid.lastElementChild;
    statsGrid.insertBefore(asrStat, lastCard);
  }

  // Add assessor table
  const asrTableCard = document.createElement('div');
  asrTableCard.className = 'table-card';
  asrTableCard.style.marginTop = '16px';
  asrTableCard.innerHTML = `
    <div class="table-toolbar">
      <div class="table-title">📋 Assessor Form Submissions</div>
      <div class="search-box">
        <span class="search-ico">🔍</span>
        <input type="text" id="asr-search-q" placeholder="Search assessor name, email…" oninput="window._renderAsrTable()">
      </div>
    </div>
    <div id="assessor-table-wrap"></div>
  `;
  dashView.appendChild(asrTableCard);
}


// ─── 4. Data & Functions ──────────────────────────────────────────────────────
let _asrSubmissions = [];
let _notifData = [];

// Load assessor submissions from form_submissions table
async function loadAssessorSubmissions() {
  try {
    const { data, error } = await sb.from('form_submissions')
      .select('*').order('submitted_at', { ascending: false });
    if (!error && data) _asrSubmissions = data;
  } catch(e) { console.error('loadAssessorSubmissions error:', e); }
  _renderAsrTable();
}

// Render the assessor submissions table
function _renderAsrTable() {
  const q = (document.getElementById('asr-search-q')?.value || '').toLowerCase();
  const filtered = _asrSubmissions.filter(s => {
    const txt = `${s.assessor_name||''} ${s.assessor_email||''} ${s.form_title||''}`.toLowerCase();
    return !q || txt.includes(q);
  });

  // Update stat
  const sEl = document.getElementById('s-assessor');
  if (sEl) sEl.textContent = _asrSubmissions.length;

  const wrap = document.getElementById('assessor-table-wrap');
  if (!wrap) return;

  if (!filtered.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${_asrSubmissions.length ? '🔍' : '📭'}</div>
      <div class="empty-title">${_asrSubmissions.length ? 'No matching results' : 'No assessor submissions yet'}</div>
      <div class="empty-sub">${_asrSubmissions.length ? 'Try adjusting your search.' : 'Share a form link with assessors to collect responses.'}</div>
    </div>`;
    return;
  }

  wrap.innerHTML = `<table>
    <thead><tr>
      <th>Assessor</th><th>Email</th><th>Form</th><th>Date Submitted</th><th>Status</th><th style="text-align:right">Actions</th>
    </tr></thead>
    <tbody>${filtered.map(s => `
      <tr style="${!s.is_read ? 'background:var(--accent-bg);' : ''}" onclick="window._viewAsrSub(${s.id})">
        <td class="td-name"><strong>${s.assessor_name || '—'}</strong></td>
        <td style="font-size:12px;color:var(--text2)">${s.assessor_email || '—'}</td>
        <td style="font-size:12px;color:var(--text2)">${s.form_title || '—'}</td>
        <td style="font-size:12px;color:var(--text2)">${s.submitted_at ? new Date(s.submitted_at).toLocaleString('en-PH') : '—'}</td>
        <td><span class="badge ${s.is_read ? 'badge-printed' : 'badge-new'}">${s.is_read ? 'Read' : 'Unread'}</span></td>
        <td onclick="event.stopPropagation()" style="text-align:right">
          <div class="row-acts" style="opacity:1;">
            <button class="btn btn-ghost btn-xs" onclick="window._viewAsrSub(${s.id})">👁 View</button>
            ${!s.is_read ? `<button class="btn btn-primary btn-xs" onclick="window._markAsrRead(${s.id})">✓ Read</button>` : ''}
          </div>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
}

// Mark a single submission as read
async function _markAsrRead(id) {
  await sb.from('form_submissions').update({ is_read: true }).eq('id', id);
  const s = _asrSubmissions.find(x => x.id === id);
  if (s) s.is_read = true;
  const n = _notifData.find(x => x.id === id);
  if (n) n.is_read = true;
  _renderAsrTable();
  _renderNotifBell();
  updateNotifBadge();
}

// View an assessor submission in print view
function _viewAsrSub(id) {
  const s = _asrSubmissions.find(x => x.id === id);
  if (!s) return;
  if (!s.is_read) _markAsrRead(id);

  const answers = s.answers || {};
  let fieldsHtml = '';
  Object.entries(answers).forEach(([key, val]) => {
    const displayVal = val || '<span class="empty">N/A</span>';
    fieldsHtml += `<div class="pf"><label>${key}</label><div class="val">${displayVal}</div></div>`;
  });

  document.getElementById('pt-ref').textContent = 'ASR-' + String(s.id).padStart(4, '0');
  document.getElementById('pt-sub').textContent =
    'Submitted ' + (s.submitted_at ? new Date(s.submitted_at).toLocaleString('en-PH') : '—') +
    ' · Assessor: ' + (s.assessor_name || '—');

  document.getElementById('print-doc').innerHTML = `
    <div class="print-banner">
      <div><h1>${s.form_title || 'Form Submission'}</h1><div class="sub">Assessor Submission · PAB Information System</div></div>
      <div class="print-meta">
        <div>Assessor</div>
        <div class="val">${s.assessor_name || '—'}</div>
        <div style="margin-top:4px;font-size:11px">${s.assessor_email || ''}</div>
      </div>
    </div>
    <div class="print-body">
      <div class="print-sec">
        <div class="print-sec-title">Submission Details</div>
        <div class="print-fields g1">${fieldsHtml}</div>
      </div>
    </div>
    <div class="print-footer">
      <div style="font-size:11px;color:var(--text3)">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">PAB Assessor Form Submission</div>
        <div>Reference: ASR-${String(s.id).padStart(4,'0')} · Generated: ${new Date().toLocaleString('en-PH')}</div>
      </div>
    </div>`;

  goto('print', document.getElementById('nav-dash'));
}


// ─── 5. Notification Bell Functions ───────────────────────────────────────────

async function loadNotifBell() {
  try {
    const { data, error } = await sb.from('form_submissions')
      .select('*').order('submitted_at', { ascending: false }).limit(25);
    if (!error && data) _notifData = data;
  } catch(e) {}
  _renderNotifBell();
}

function _renderNotifBell() {
  const unreadCount = _notifData.filter(n => !n.is_read).length;

  const badge = document.getElementById('notif-count-bell');
  if (badge) {
    badge.textContent = unreadCount;
    badge.classList.toggle('show', unreadCount > 0);
  }

  const list = document.getElementById('notif-dd-list');
  if (!list) return;

  if (!_notifData.length) {
    list.innerHTML = '<div class="notif-dd-empty">No notifications yet</div>';
    return;
  }

  list.innerHTML = _notifData.map(n => {
    const timeAgo = _timeAgo(n.submitted_at);
    return `<div class="notif-dd-item ${n.is_read ? '' : 'unread'}" onclick="window._viewAsrSub(${n.id}); window._toggleNotifDD();">
      <span class="notif-dd-icon">${n.is_read ? '📬' : '🔔'}</span>
      <div class="notif-dd-body">
        <div class="notif-dd-text"><strong>${n.assessor_name || 'Assessor'}</strong> submitted <strong>${n.form_title || 'a form'}</strong></div>
        <div class="notif-dd-time">${timeAgo}</div>
      </div>
    </div>`;
  }).join('');
}

function _timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
  if (diff < 604800) return Math.floor(diff / 86400) + ' day(s) ago';
  return new Date(dateStr).toLocaleDateString('en-PH');
}

function _toggleNotifDD() {
  const dd = document.getElementById('notif-dropdown');
  if (dd) dd.classList.toggle('open');
}

async function _markAllReadBell() {
  await sb.from('form_submissions').update({ is_read: true }).eq('is_read', false);
  _notifData.forEach(n => n.is_read = true);
  _asrSubmissions.forEach(s => s.is_read = true);
  _renderNotifBell();
  _renderAsrTable();
  if (typeof updateNotifBadge === 'function') updateNotifBadge();
  if (typeof toast === 'function') toast('✅', 'Done', 'All notifications marked as read.');
}


// ─── 6. Expose to global scope (for onclick handlers) ─────────────────────────
window._toggleNotifDD = _toggleNotifDD;
window._markAllReadBell = _markAllReadBell;
window._renderAsrTable = _renderAsrTable;
window._viewAsrSub = _viewAsrSub;
window._markAsrRead = _markAsrRead;


// ─── 7. Hook into existing app lifecycle ──────────────────────────────────────

// Override the original goto function to also refresh assessor data on dashboard
const _origGoto = window.goto;
if (_origGoto) {
  window.goto = function(view, navEl) {
    _origGoto(view, navEl);
    if (view === 'dashboard') {
      loadAssessorSubmissions();
      loadNotifBell();
    }
  };
}

// Override refreshStats to include assessor count
const _origRefreshStats = window.refreshStats;
if (_origRefreshStats) {
  window.refreshStats = function() {
    _origRefreshStats();
    const sEl = document.getElementById('s-assessor');
    if (sEl) sEl.textContent = _asrSubmissions.length;
  };
}

// Initial load — wait for the main app to initialize first
setTimeout(async () => {
  await loadAssessorSubmissions();
  await loadNotifBell();
}, 1500);

// Also listen for real-time updates
if (typeof sb !== 'undefined') {
  sb.channel('addon_form_submissions')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'form_submissions' }, payload => {
      // Reload data when new submission arrives
      loadAssessorSubmissions();
      loadNotifBell();
    })
    .subscribe();
}

})();
