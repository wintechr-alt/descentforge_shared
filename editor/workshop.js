// ---------- Workshop Mode ----------
// TODO: Replace this placeholder with the full workshop editor.
window.DescentForgeWorkshop = {
  init: function() {
    const overlay = document.getElementById('workshopOverlay');
    if (!overlay) {
      console.error('[DescentForgeWorkshop] ERROR: workshopOverlay not found');
      return;
    }
    overlay.innerHTML =
      '<div style="padding:10px 18px;background:var(--panel2);border-bottom:1px solid var(--edge);display:flex;align-items:center;justify-content:flex-start;position:relative;">' +
        '<h1 style="margin:0;font-size:18px;">Coming Soon!</h1>' +
        '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:6px;">' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;padding:8px 18px;background:var(--panel2);border-bottom:1px solid var(--edge);justify-content:center;">' +
        '<button style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Weapons</button>' +
        '<button style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Armor</button>' +
        '<button style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Trinkets</button>' +
      '</div>' +
      '<div style="margin:10px 18px;color:var(--dim);font-size:14px;">Workshop mode is under development.</div>';
    console.log('[DescentForgeWorkshop] Workshop mode initialized - Coming Soon!');
  }
};

// ---------- End Workshop Mode ----------