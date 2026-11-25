// Flow.js - Campaign Node Editor Flow Chart SVG
// Implements the complete visual flow chart editor:
//   * Node display: dark card, marker-colored border, a marker label
//     ("Main Quest" / "Side Quest" / "Narrative Event" / "City Event") +
//     node name + optional subtitle, with a connection "handle" dot on
//     the right edge.
//   * Bezier connection lines between nodes, driven by afterNodes
//   * Auto layout (used once, for brand-new nodes only): "main"-marked
//     nodes (raw.marker === 'main', or no marker at all) form one straight
//     left->right backbone; "narrative"/"side"/"city"-marked nodes are
//     offshoots, stacked one row below and one column FORWARD of whatever
//     node their own afterNodes[0] points to — i.e. in that attach node's
//     next column along the main backbone, so their incoming arrow runs
//     down-and-right instead of straight down (each attach point keeps
//     its own stack, so one busy node's offshoots don't push another's
//     downward).
//   * Click a node's body (center) to select it AND load it into the
//     permanently-docked "Node Edit" panel on the right, which lists its
//     prerequisites by name with a "×" next to each to detach just that
//     connection. The panel is a fixed-width docked pane that owns its own
//     strip of screen space — the flow chart canvas is sized to sit beside
//     it, never underneath it.
//   * Click a node's handle dot (right edge) to open the edit panel; drag
//     it onto another node to ADD a connection (that node's afterNodes
//     gets this node's id appended).
//   * Click a thin strip along a node's LEFT edge to pop up a small list
//     of every arrow pointing INTO that node (its own afterNodes), each
//     with its own × to detach just that one connection. Click outside
//     the popup to dismiss it.
//   * Left-click + drag a node's body to move it. This ONLY repositions
//     the node — it never touches afterNodes/arrows. Positions are free-
//     form and persist across re-renders.
//   * Click+drag empty space to pan background. The view is only
//     auto-centered once, on first load — panning/dragging/selecting
//     never snaps the camera back.
//   * "Reset View" (top-right) just re-fits the camera to show the whole
//     chart — never touches node positions or data. "Update" (just below
//     it) re-runs the auto-layout from the current afterNodes/marker data,
//     snapping every node back into its computed grid position.
//   * Mouse wheel to zoom
(function() {
  'use strict';

  console.log('[Flow.js] Script loaded');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
  } else {
    onDOMReady();
  }

  // ---------- Constants ----------
  const NODE_W = 220;
  const NODE_H = 76;
  // Wider spacing between nodes so the bezier arrows between them have
  // room to read clearly instead of bunching up edge-to-edge.
  const COL_SPACING = 110;
  const ROW_SPACING = 80;
  const PAD = 60;
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 3;
  const DRAG_THRESHOLD = 4;  // px in content-space before a click becomes a drag
  const HANDLE_R = 7;        // connection-dot radius
  const HANDLE_HIT_R = 12;   // generous click target around the dot
  const LEFT_EDGE_W = 14;    // width of the clickable strip along a node's left edge
                             // (click it to pop up that node's incoming arrows, each
                             // removable with its own ×)

  const MARKER_LABEL = {
    main: 'Main Quest',
    side: 'Side Quest',
    narrative: 'Narrative Event',
    city: 'City Event'
  };
  const MARKER_COLOR = {
    main: '#8bc34a',      // green
    side: '#f0a830',      // orange
    narrative: '#9c27b0', // purple
    city: '#d4af37'       // gold
  };
  const DEFAULT_COLOR = '#f0a830'; // fallback, shouldn't normally be hit — getMarker() always returns a known key
  const CARD_BG = '#1b2130';
  const LINK_COLOR = '#93a0b4';     // neutral gray, matches reference art
  const SUBTITLE_COLOR = '#9aa5b8';
  const SELECTED_COLOR = '#ffffff';
  const INSERT_LINE_COLOR = '#f4c542';

  function colorForMarker(marker) {
    return MARKER_COLOR[marker] || DEFAULT_COLOR;
  }

  function labelForMarker(marker) {
    return MARKER_LABEL[marker] || 'Main Quest';
  }

  function onDOMReady() {
    console.log('[Flow.js] DOM ready');

    const overlay = document.getElementById('flowOverlay');
    if (!overlay) {
      console.error('[Flow.js] ERROR: flowOverlay not found');
      return;
    }
    // The edit panel is docked absolutely inside this element, so it needs
    // to actually be a positioning context.
    if (getComputedStyle(overlay).position === 'static') {
      overlay.style.position = 'relative';
    }

    let state = {
      nodes: [],      // {id, name, kind, subtitle, x, y, raw}
      links: [],      // {from, to}
      selectedId: null,
      zoom: 1,
      panX: 0,
      panY: 0,
      hasCentered: false, // only auto-center once; never fight the user's pan

      // node body drag (repositioning only — never touches afterNodes)
      isNodeDragging: false,
      dragNode: null,
      dragMoved: false,
      dragStartMouseX: 0,
      dragStartMouseY: 0,
      dragOrigX: 0,
      dragOrigY: 0,

      // handle-dot drag (creates a new afterNodes connection on drop)
      isLinkDragging: false,
      linkFromNode: null,
      linkDragMoved: false,
      linkStartMouseX: 0,
      linkStartMouseY: 0,
      linkCurX: 0,
      linkCurY: 0,

      // background pan
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      dragStartPanX: 0,
      dragStartPanY: 0,

      pos: {}            // {id: {x,y}} persisted layout positions
    };

    let svg, content;
    let flowEl = null;   // element the chart renders into (#flowOverlay or #flowStage)

    // ---------- Data ----------
    // Reads a node's prerequisite list regardless of whether your data
    // nests it under `spawn.afterNodes` or keeps it top-level as
    // `afterNodes`. If arrows aren't showing up, check your console: a
    // warning is logged for any afterNodes id that doesn't match a node.
    function getAfterNodes(raw) {
      if (!raw) return [];
      if (raw.spawn && Array.isArray(raw.spawn.afterNodes)) return raw.spawn.afterNodes;
      if (Array.isArray(raw.afterNodes)) return raw.afterNodes;
      return [];
    }

    function setAfterNodes(raw, ids) {
      if (!raw) return;
      if (raw.spawn && Array.isArray(raw.spawn.afterNodes)) { raw.spawn.afterNodes = ids; return; }
      if (Array.isArray(raw.afterNodes)) { raw.afterNodes = ids; return; }
      if (!raw.spawn) raw.spawn = {};
      raw.spawn.afterNodes = ids;
    }

    function getSubtitle(raw) {
      if (!raw) return '';
      return raw.subtitle || raw.description || raw.summary || '';
    }

    // "main" nodes form the straight backbone sequence. "narrative" and
    // "side" nodes are offshoots: they still point at a prerequisite via
    // afterNodes, but that prerequisite is just the node they hang off of —
    // it does NOT make them part of the main chain, and moving them never
    // touches anyone else's afterNodes. A node with no marker (or an
    // unrecognized one) is treated as "main", so old data without this
    // field still lays out exactly as before.
    function getMarker(raw) {
      if (!raw) return 'main';
      const m = (raw.marker || (raw.spawn && raw.spawn.marker) || '').toString().toLowerCase();
      return (m === 'narrative' || m === 'side' || m === 'city') ? m : 'main';
    }

    function getRawNodes() {
      let src = (typeof camp !== 'undefined' && Array.isArray(camp.nodes)) ? camp.nodes : [];
      if (!src.length && window.forge && window.forge.camp && Array.isArray(window.forge.camp.nodes)) {
        console.log('[Flow.js] Using forge.camp.nodes');
        src = window.forge.camp.nodes;
      }
      return src.map(n => ({
        id: n.id || 'node',
        name: n.name || 'Unnamed node',
        kind: n.kind || 'other',
        marker: getMarker(n),
        subtitle: getSubtitle(n),
        raw: n // reference, not a copy: mutations persist back to the source data
      }));
    }

    // Build (or refresh) the in-memory node layout.
    // Runs only when there are no nodes yet, or when the campaign node count changed.
    function buildData() {
      const raw = getRawNodes();
      if (!state.nodes.length || raw.length !== state.nodes.length) {
        state.nodes = raw.map(n => {
          const p = state.pos[n.id] || { x: 0, y: 0 };
          return { id: n.id, name: n.name, kind: n.kind, marker: n.marker, subtitle: n.subtitle, x: p.x, y: p.y, raw: n.raw };
        });
        state.links = computeLinks(state.nodes);
        layoutNodes(state.nodes);
        avoidNodeOverlap();
        // Persist computed layout so drag positions survive re-renders.
        state.nodes.forEach(n => { state.pos[n.id] = { x: n.x, y: n.y }; });
      } else {
        // Same count: keep positions, just refresh names/kinds/markers/links.
        state.nodes.forEach((n, i) => {
          n.name = raw[i].name;
          n.kind = raw[i].kind;
          n.marker = raw[i].marker;
          n.subtitle = raw[i].subtitle;
          n.raw = raw[i].raw;
        });
        state.links = computeLinks(state.nodes);
      }
    }

    function computeLinks(nodes) {
      const byId = new Map(nodes.map(n => [n.id, n]));
      const links = [];
      // afterNodes lists the prerequisites of a node, so the arrow flows
      // from each prerequisite to the node that depends on it.
      nodes.forEach(n => {
        const after = getAfterNodes(n.raw);
        after.forEach(id => {
          if (!byId.has(id)) {
            console.warn('[Flow.js] afterNodes reference "' + id + '" on node "' + n.id + '" does not match any known node — no arrow will be drawn for it.');
            return;
          }
          links.push({ from: id, to: n.id });
        });
      });
      if (nodes.length > 1 && links.length === 0) {
        console.warn('[Flow.js] No links computed from afterNodes across ' + nodes.length + ' nodes — check that your node data actually sets spawn.afterNodes (or afterNodes) to the ids of prerequisite nodes.');
      }
      return links;
    }

    // One-time auto layout for brand-new nodes (buildData's rebuild path
    // only — never re-run on drag, drop, or Reset View, so it never fights
    // a position you've set by hand).
    //
    // "main" nodes (raw.marker === 'main', or no marker at all) form one
    // straight left->right backbone, topologically ordered by their *own*
    // afterNodes links to each other (a link to/from a non-main node is
    // ignored for this ordering, so an offshoot can never push the main
    // line onto a new row).
    //
    // "narrative"/"side"/"city" nodes are offshoots: each one hangs below
    // and ONE COLUMN FORWARD of whatever node its own afterNodes[0] points
    // at — i.e. in the same column as that attach node's own next node in
    // the main backbone, one row below it — so its incoming arrow draws
    // diagonally down-and-right instead of straight down. Offshoots that
    // share the same afterNodes[0] value stack beneath that same forward
    // column, one below the next.
    function layoutNodes(nodes) {
      const mainNodes = nodes.filter(n => getMarker(n.raw) === 'main');
      const offshoots = nodes.filter(n => getMarker(n.raw) !== 'main');
      const mainIds = new Set(mainNodes.map(n => n.id));

      const pred = new Map(); // id -> prerequisite ids (main-to-main only)
      const succ = new Map(); // id -> successor ids (main-to-main only)
      mainNodes.forEach(n => { pred.set(n.id, []); succ.set(n.id, []); });
      mainNodes.forEach(n => {
        getAfterNodes(n.raw).forEach(id => {
          if (mainIds.has(id)) {
            pred.get(n.id).push(id);
            succ.get(id).push(n.id);
          }
        });
      });

      // Topological order (roots / no-prerequisite nodes first).
      const order = [];
      const remaining = new Map();
      const queue = [];
      mainNodes.forEach(n => remaining.set(n.id, pred.get(n.id).length));
      mainNodes.forEach(n => { if (pred.get(n.id).length === 0) queue.push(n.id); });
      let qi = 0;
      while (qi < queue.length) {
        const id = queue[qi++];
        order.push(id);
        for (const s of succ.get(id)) {
          remaining.set(s, (remaining.get(s) || 0) - 1);
          if ((remaining.get(s) || 0) === 0) queue.push(s);
        }
      }
      mainNodes.forEach(n => { if (!order.includes(n.id)) order.push(n.id); });

      // Row assignment for the main nodes: stays on one straight row unless
      // a main node genuinely forks into more than one main successor, in
      // which case the extra branch(es) drop onto new rows.
      const rowOf = new Map();
      const rowClaimed = new Set();
      let nextFreeRow = 0;
      order.forEach(id => {
        const preds = pred.get(id);
        if (!preds.length) { rowOf.set(id, nextFreeRow++); return; }
        let primary = preds[0];
        preds.forEach(pid => {
          if ((rowOf.get(pid) ?? Infinity) < (rowOf.get(primary) ?? Infinity)) primary = pid;
        });
        const primaryRow = rowOf.get(primary) ?? 0;
        if (!rowClaimed.has(primary)) { rowOf.set(id, primaryRow); rowClaimed.add(primary); }
        else { rowOf.set(id, nextFreeRow++); }
      });

      const mainColOf = new Map(); // main node id -> its column index in `order`
      order.forEach((id, idx) => {
        const node = nodes.find(n => n.id === id);
        node.x = PAD + idx * (NODE_W + COL_SPACING);
        node.y = PAD + (rowOf.get(id) || 0) * (NODE_H + ROW_SPACING);
        mainColOf.set(id, idx);
      });

      // Offshoots: each sits one row below, and one COLUMN FORWARD of,
      // whatever node it attaches to (its own afterNodes[0]) — so if Side
      // is "after completing Q09" and the main backbone's next node after
      // Q09 is Q10, the Side node lands in Q10's column, letting its arrow
      // run down-and-right from Q09 instead of straight down. When the
      // attach node is itself a main node, "forward" means the next
      // column in the main sequence (idx+1), regardless of whether a node
      // actually occupies it. When the attach node is some other offshoot
      // (not in the main backbone), "forward" falls back to one column
      // past that offshoot's own x. Multiple offshoots that share the same
      // attach point stack beneath that same forward column, in their own
      // count, so one busy node's stack never pushes a different node's
      // offshoots down too (each attach point starts back at row 1).
      // Orphan offshoots (no recorded attach point) get their own column,
      // one full column to the LEFT of the main backbone's starting
      // column. Using PAD directly here was a bug: that's the exact same
      // x as order[0] (the first main node), so orphans would land in the
      // same column as the start of the main chain and only differ by y —
      // leaving them to rely entirely on avoidNodeOverlap() to separate
      // them from main nodes, which isn't guaranteed to converge for
      // every node before it hits its iteration cap.
      const ORPHAN_X = PAD - (NODE_W + COL_SPACING);

      const attachStackCount = new Map();
      let noneAttachCount = 0;
      offshoots.forEach(n => {
        const attachId = getAfterNodes(n.raw)[0];
        const attachNode = attachId ? nodes.find(nn => nn.id === attachId) : null;
        if (attachNode) {
          const count = (attachStackCount.get(attachId) || 0) + 1;
          attachStackCount.set(attachId, count);
          n.x = mainColOf.has(attachId)
            ? PAD + (mainColOf.get(attachId) + 1) * (NODE_W + COL_SPACING)
            : attachNode.x + (NODE_W + COL_SPACING);
          n.y = attachNode.y + count * (NODE_H + ROW_SPACING);
        } else {
          // No recorded attachment: place it in its own column clear of
          // the main backbone, stacked from the top.
          n.x = ORPHAN_X;
          n.y = PAD + noneAttachCount * (NODE_H + ROW_SPACING);
          noneAttachCount++;
        }
      });
    }

    // Dropping a dragged node just finalizes its free position. Moving a
    // node is NEVER allowed to rewrite anyone's afterNodes — that's done
    // explicitly, by dragging a handle dot onto a node (adds a link) or
    // clicking a selected node's "×" badges (removes one).
    

    // Avoid node overlap: if nodes are too close, shift the later one down
    function avoidNodeOverlap(){
      const MIN_DIST = NODE_W + 40; // minimum horizontal distance before considering overlap
      const VERTICAL_THRESHOLD = NODE_H + 20; // vertical distance threshold
      const nodes = state.nodes;
      let changed = true;
      // Iteratively resolve overlaps until no more changes are needed
      // Maximum iterations to prevent infinite loops in edge cases
      let maxIterations = nodes.length * 2;
      let iterations = 0;
      while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = Math.abs(nodes[i].x - nodes[j].x);
            const dy = Math.abs(nodes[i].y - nodes[j].y);
            // If nodes overlap or are very close horizontally AND vertically
            if (dx < MIN_DIST && dy < VERTICAL_THRESHOLD) {
              // Shift node j down below node i to resolve overlap
              nodes[j].y = nodes[i].y + VERTICAL_THRESHOLD;
              changed = true;
            }
          }
        }
      }
      if (iterations >= maxIterations) {
        console.log('[Flow.js] avoidNodeOverlap reached max iterations', maxIterations);
      }
      // Re-persist positions
      state.nodes.forEach(n => { state.pos[n.id] = { x: n.x, y: n.y }; });
    }

function finishNodeDrag(dragNode) {
      state.pos[dragNode.id] = { x: dragNode.x, y: dragNode.y };
      render(flowEl);
    }

    // ---------- Node edit panel ----------
    // Built once and appended to #flowOverlay itself — docked inside the
    // flow chart view, not the page. render() wipes and rebuilds
    // everything else in the overlay on every call, but explicitly skips
    // this element so it survives (otherwise it'd flicker/reset on every
    // drag). It is a permanent, full-height docked pane: there is no
    // open/close animation and nothing slides away — the "×" only clears
    // the current selection back to the placeholder text, it never hides
    // or collapses the pane itself. The flow chart canvas (the <svg>) is
    // explicitly sized to stop short of this pane (see render()), so the
    // pane sits beside the chart rather than floating on top of it.
    // Content is a placeholder for now — wire up real fields later by
    // editing openPanelFor() below.
    let panelEl = null;
    const PANEL_TOP = 12;  // top of the flow chart view itself, not down near the page nav
    const PANEL_WIDTH = 320;
    const PANEL_BG = '#cbbda5';     // tan, matching the nav
    const PANEL_BORDER = '#a89672'; // darker tan
    const PANEL_TEXT = '#2a241c';   // dark, same as a node's own name text
    const PANEL_MUTED = '#5c5240';  // muted brown-tan for secondary text

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
      ));
    }

    // Permanently docked — no open/close animation, no slide-away. Always
    // visible on the right, full height of the flow chart view, showing a
    // placeholder until a node is clicked.
    function ensurePanel() {
      if (panelEl) return panelEl;
      panelEl = document.createElement('div');
      panelEl.id = 'flowNodeEditPanel';
      panelEl.style.cssText =
        'position:absolute;top:' + PANEL_TOP + 'px;right:0;bottom:0;width:' + PANEL_WIDTH + 'px;box-sizing:border-box;' +
        'background:' + PANEL_BG + ';color:' + PANEL_TEXT + ';border-left:1px solid ' + PANEL_BORDER + ';' +
        'box-shadow:-6px 0 18px rgba(0,0,0,0.35);' +
        'font:13px/1.5 sans-serif;padding:18px;overflow-y:auto;z-index:2000;';
      panelEl.innerHTML =
        '<div style="margin-bottom:14px;">' +
          '<strong style="font-size:15px;color:' + PANEL_TEXT + ';">Node Edit</strong>' +
        '</div>' +
        '<div id="flowNodeEditBody" style="color:' + PANEL_MUTED + ';">No node selected.</div>';
      overlay.appendChild(panelEl);
      return panelEl;
    }

    // Build a two-column grid of checkboxes for afterNodes / hideAfterNodes,
    // listing every other node as a checkbox option — mirrors Campaign
    // mode's "After completing…" / "Disappears after completing…" grids
    // (two columns, checkbox snug against its label text).
    function buildSpawnCheckboxList(checkedIds, excludeId, kind) {
      let items = '';
      state.nodes.forEach(n => {
        if (n.id === excludeId) return;
        const isChecked = checkedIds.indexOf(n.id) >= 0;
        // The label text sits in a `display:block` span so text-overflow:
        // ellipsis actually renders (it's a no-op on a plain inline span in
        // most browsers — the text would just get hard-clipped with no "…"
        // and, combined with flex-shrink, could collapse to nothing). The
        // span is also an explicit flex item (flex:1 1 0%; min-width:0) so
        // it's the one that shrinks for a long name — never the checkbox.
        items += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;width:100%;min-width:0;box-sizing:border-box;">' +
          '<input type="checkbox" data-ref-' + kind + '="' + escapeHtml(n.id) + '" ' +
          (isChecked ? 'checked' : '') + ' style="flex:0 0 auto;margin:0;flex-shrink:1;">' +
          escapeHtml(n.name || n.id) +
          '</label>';
      });
      if (!items) return '<p style="opacity:.7;margin:4px 0;">No other nodes.</p>';
      // minmax(0,1fr) (not plain 1fr) lets each column actually shrink to
      // fit the panel instead of overflowing it or starving the ellipsis.
      return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">' + items + '</div>';
    }

    function openPanelFor(node) {
      const panel = ensurePanel();
      const body = panel.querySelector('#flowNodeEditBody');

      body.innerHTML =
        '<div style="color:' + colorForMarker(node.marker) + ';font-weight:700;letter-spacing:.5px;margin-bottom:8px;">' +
          escapeHtml(labelForMarker(node.marker)) +
        '</div>' +
        '<div style="font-size:16px;font-weight:700;color:' + PANEL_TEXT + ';margin-bottom:4px;">' +
          escapeHtml(node.name) +
        '</div>' +
        '<div style="color:' + PANEL_MUTED + ';margin-bottom:16px;">id: ' + escapeHtml(node.id) + '</div>' +
        '<div style="border-top:1px solid ' + PANEL_BORDER + ';padding-top:10px;margin-bottom:6px;font-weight:600;">Editable properties</div>' +
        // Name
        '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:11px;color:' + PANEL_MUTED + ';margin-bottom:4px;">Name</label>' +
        '<input type="text" id="flowEditName" value="' + escapeHtml(node.name) + '" ' +
        'style="width:100%;box-sizing:border-box;padding:4px 6px;background:#fff;color:' + PANEL_TEXT + ';border:1px solid ' + PANEL_BORDER + ';border-radius:4px;font:13px sans-serif;">' +
        '</div>' +
        // Identifier
        '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:11px;color:' + PANEL_MUTED + ';margin-bottom:4px;">Identifier</label>' +
        '<input type="text" id="flowEditId" value="' + escapeHtml(node.id) + '" ' +
        'style="width:100%;box-sizing:border-box;padding:4px 6px;background:#fff;color:' + PANEL_TEXT + ';border:1px solid ' + PANEL_BORDER + ';border-radius:4px;font:13px sans-serif;">' +
        '</div>' +
        // Description
        '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:11px;color:' + PANEL_MUTED + ';margin-bottom:4px;">Description</label>' +
        '<textarea id="flowEditDesc" rows="3" ' +
        'style="width:100%;box-sizing:border-box;padding:4px 6px;background:#fff;color:' + PANEL_TEXT + ';border:1px solid ' + PANEL_BORDER + ';border-radius:4px;font:13px sans-serif;">' +
        escapeHtml(node.raw.description || '') + '</textarea>' +
        '</div>' +
        // Marker
        '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:11px;color:' + PANEL_MUTED + ';margin-bottom:4px;">Marker</label>' +
        '<select id="flowEditMarker" ' +
        'style="width:100%;box-sizing:border-box;padding:4px 6px;background:#fff;color:' + PANEL_TEXT + ';border:1px solid ' + PANEL_BORDER + ';border-radius:4px;font:13px sans-serif;">' +
        '<option value="main"' + (node.marker === 'main' ? ' selected' : '') + '>Main Quest</option>' +
        '<option value="side"' + (node.marker === 'side' ? ' selected' : '') + '>Side Quest</option>' +
        '<option value="narrative"' + (node.marker === 'narrative' ? ' selected' : '') + '>Narrative Event</option>' +
        '<option value="city"' + (node.marker === 'city' ? ' selected' : '') + '>City Event</option>' +
        '</select>' +
        '</div>' +
        // Node type
        '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:11px;color:' + PANEL_MUTED + ';margin-bottom:4px;">Node type</label>' +
        '<select id="flowEditKind" ' +
        'style="width:100%;box-sizing:border-box;padding:4px 6px;background:#fff;color:' + PANEL_TEXT + ';border:1px solid ' + PANEL_BORDER + ';border-radius:4px;font:13px sans-serif;">' +
        '<option value="scenario"' + (node.kind === 'scenario' ? ' selected' : '') + '>Scenario</option>' +
        '<option value="dialogue"' + (node.kind === 'dialogue' ? ' selected' : '') + '>Dialogue</option>' +
        '</select>' +
        '</div>' +
        // When it appears (3 parts, matching Campaign mode)
        '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:11px;color:' + PANEL_MUTED + ';margin-bottom:8px;">When it appears</label>' +
        // 1) Appears on its own checkbox
        '<label style="display:block;margin-bottom:10px;cursor:pointer;"><input type="checkbox" id="flowEditAuto" ' +
        (node.raw.spawn && node.raw.spawn.auto !== false ? 'checked' : '') + ' ' +
        'style="margin-right:6px;">Appears on its own</label>' +
        // 2) After completing… checkboxes
        '<div style="margin-bottom:10px;">' +
        '<label style="display:block;font-size:10px;color:' + PANEL_MUTED + ';margin-bottom:4px;">After completing…</label>' +
        buildSpawnCheckboxList(getAfterNodes(node.raw), node.id, 'after') +
        '</div>' +
        // 3) Disappears after completing… checkboxes
        '<div>' +
        '<label style="display:block;font-size:10px;color:' + PANEL_MUTED + ';margin-bottom:4px;">Disappears after completing…</label>' +
        buildSpawnCheckboxList((node.raw.spawn && node.raw.spawn.hideAfterNodes) || [], node.id, 'hide') +
        '</div>' +
        '</div>';

      // Wire up editable property fields (mirrors Campaign mode's node editor)
      const nameInput = body.querySelector('#flowEditName');
      const idInput = body.querySelector('#flowEditId');
      const descInput = body.querySelector('#flowEditDesc');
      const markerSelect = body.querySelector('#flowEditMarker');
      const kindSelect = body.querySelector('#flowEditKind');
      const autoInput = body.querySelector('#flowEditAuto');

      // NOTE: uses onchange (fires on blur/Enter), not oninput — oninput
      // would call render()+openPanelFor() on every keystroke, which
      // rebuilds this very <input> and knocks the cursor/focus out of it.
      if (nameInput) nameInput.onchange = () => {
        node.raw.name = nameInput.value;
        node.name = nameInput.value;
        render(flowEl);
        openPanelFor(node);
      };
      if (idInput) idInput.onchange = () => {
        const oldId = node.id;
        const newId = idInput.value.trim();

        if (!newId || newId === oldId) {
          idInput.value = oldId; // ignore a blank id or a no-op edit
          return;
        }
        if (state.nodes.some(n => n !== node && n.id === newId)) {
          alert('A node with id "' + newId + '" already exists. Choose a different id.');
          idInput.value = oldId;
          return;
        }

        // Propagate the rename so no other node's afterNodes/hideAfterNodes
        // is left pointing at an id that no longer exists.
        state.nodes.forEach(n => {
          if (n === node) return;
          const after = getAfterNodes(n.raw);
          if (after.includes(oldId)) {
            setAfterNodes(n.raw, after.map(id => id === oldId ? newId : id));
          }
          if (n.raw.spawn && Array.isArray(n.raw.spawn.hideAfterNodes) && n.raw.spawn.hideAfterNodes.includes(oldId)) {
            n.raw.spawn.hideAfterNodes = n.raw.spawn.hideAfterNodes.map(id => id === oldId ? newId : id);
          }
        });
        if (state.pos[oldId]) {
          state.pos[newId] = state.pos[oldId];
          delete state.pos[oldId];
        }

        node.raw.id = newId;
        node.id = newId;
        state.links = computeLinks(state.nodes);
        console.log('[Flow.js] Renamed node', oldId, '->', newId, '(references updated)');
        render(flowEl);
        openPanelFor(node);
      };
      if (descInput) descInput.onchange = () => {
        node.raw.description = descInput.value;
        render(flowEl);
      };
      if (markerSelect) markerSelect.onchange = () => {
        node.raw.marker = markerSelect.value;
        node.marker = markerSelect.value;
        state.links = computeLinks(state.nodes);
        render(flowEl);
        openPanelFor(node);
      };
      if (kindSelect) kindSelect.onchange = () => {
        node.raw.kind = kindSelect.value;
        node.kind = kindSelect.value;
        render(flowEl);
        openPanelFor(node);
      };
      if (autoInput) autoInput.onchange = () => {
        if (!node.raw.spawn) node.raw.spawn = {};
        node.raw.spawn.auto = autoInput.checked;
        render(flowEl);
      };

      // After completing… checkboxes (spawn.afterNodes)
      body.querySelectorAll('[data-ref-after]').forEach(cb => {
        cb.onchange = () => {
          const id = cb.getAttribute('data-ref-after');
          const a = getAfterNodes(node.raw);
          const k = a.indexOf(id);
          if (cb.checked) { if (k < 0) a.push(id); }
          else { if (k >= 0) a.splice(k, 1); }
          setAfterNodes(node.raw, a);
          state.links = computeLinks(state.nodes);
          render(flowEl);
          openPanelFor(node);
        };
      });

      // Disappears after completing… checkboxes (spawn.hideAfterNodes)
      body.querySelectorAll('[data-ref-hide]').forEach(cb => {
        cb.onchange = () => {
          const id = cb.getAttribute('data-ref-hide');
          if (!node.raw.spawn) node.raw.spawn = {};
          const a = node.raw.spawn.hideAfterNodes || (node.raw.spawn.hideAfterNodes = []);
          const k = a.indexOf(id);
          if (cb.checked) { if (k < 0) a.push(id); }
          else { if (k >= 0) a.splice(k, 1); }
          if (!a.length) delete node.raw.spawn.hideAfterNodes;
          render(flowEl);
          openPanelFor(node);
        };
      });
    }

    // Clears the selection and the panel back to its placeholder — the
    // dock itself is permanent and never hides/collapses.
    function closeNodeEditPanel() {
      state.selectedId = null;
      if (panelEl) {
        const body = panelEl.querySelector('#flowNodeEditBody');
        if (body) body.innerHTML = 'No node selected.';
      }
      render(flowEl);
    }

    // ---------- Incoming-arrows popup ----------
    // A small popup, opened by clicking a node's left-edge strip, listing
    // every arrow that points INTO that node (i.e. the node's own
    // afterNodes) with an × next to each to detach just that one. It's a
    // separate, lightweight alternative to editing the "After completing…"
    // checkboxes in the full Node Edit panel — handy when all you want is
    // to snip one incoming arrow without opening the whole node.
    let popupEl = null;

    function closeArrowPopup() {
      if (popupEl && popupEl.parentNode) popupEl.parentNode.removeChild(popupEl);
      popupEl = null;
      document.removeEventListener('mousedown', onDocMouseDownForPopup, true);
    }

    // Closes the popup on any click outside it. Added on a deferred timer
    // (see openIncomingArrowsPopup) so it doesn't also catch the very
    // mousedown that opened the popup.
    function onDocMouseDownForPopup(ev) {
      if (popupEl && !popupEl.contains(ev.target)) {
        closeArrowPopup();
      }
    }

    function openIncomingArrowsPopup(node, clientX, clientY) {
      closeArrowPopup(); // only one open at a time

      const rect = flowEl.getBoundingClientRect();
      popupEl = document.createElement('div');
      popupEl.id = 'flowArrowPopup';
      popupEl.style.cssText =
        'position:absolute;left:' + (clientX - rect.left + 10) + 'px;top:' + (clientY - rect.top + 10) + 'px;' +
        'min-width:200px;max-width:260px;box-sizing:border-box;' +
        'background:var(--panel);color:var(--text);border:1px solid var(--edge);' +
        'border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.5);' +
        'font:12px/1.5 sans-serif;padding:10px;z-index:3000;';

      const renderPopupBody = () => {
        const afterIds = getAfterNodes(node.raw);
        const rows = afterIds.length
          ? afterIds.map(pid => {
              const pNode = state.nodes.find(n => n.id === pid);
              return '<div style="display:flex;align-items:center;justify-content:space-between;' +
                'padding:4px 6px;margin-bottom:3px;background:rgba(0,0,0,0.08);border-radius:5px;">' +
                '<span>' + escapeHtml(pNode ? pNode.name : pid) + '</span>' +
                '<button type="button" class="flowPopupRemove" data-remove-after="' + escapeHtml(pid) + '" ' +
                  'aria-label="Remove this arrow" ' +
                  'style="background:none;border:none;color:#8a2f2f;font-size:14px;line-height:1;cursor:pointer;padding:2px 4px;">&times;</button>' +
                '</div>';
            }).join('')
          : '<div style="opacity:.7;">None</div>';

        popupEl.innerHTML =
          '<div style="font-weight:700;margin-bottom:6px;">Arrows into "' + escapeHtml(node.name) + '"</div>' +
          rows;

        popupEl.querySelectorAll('.flowPopupRemove').forEach(btn => {
          btn.addEventListener('mousedown', e => e.stopPropagation()); // don't let the outside-click closer eat this
          btn.addEventListener('click', () => {
            const pid = btn.getAttribute('data-remove-after');
            const remaining = getAfterNodes(node.raw).filter(id => id !== pid);
            setAfterNodes(node.raw, remaining);
            state.links = computeLinks(state.nodes);
            console.log('[Flow.js] Detached', pid, '->', node.id);
            render(flowEl);
            // panel removed: the right Properties box edits the selected node
            if (getAfterNodes(node.raw).length) {
              renderPopupBody(); // still arrows left: keep the popup open, just refresh its list
            } else {
              closeArrowPopup();
            }
          });
        });
      };

      renderPopupBody();
      flowEl.appendChild(popupEl);

      // Defer so this same mousedown event doesn't immediately close it.
      setTimeout(() => {
        document.addEventListener('mousedown', onDocMouseDownForPopup, true);
      }, 0);
    }

    function triggerEditNode(node) {
      state.selectedId = node.id;
      console.log('[Flow.js] Edit requested for', node.id);
      if (typeof window.DescentForgeFlow.onNodeSelect === 'function') {
        try {
          window.DescentForgeFlow.onNodeSelect(node.raw, node);
        } catch (e) {
          console.error('[Flow.js] onNodeSelect handler threw:', e);
        }
      }
      flowEl.dispatchEvent(new CustomEvent('flow:node-select', {
        detail: { id: node.id, name: node.name, kind: node.kind, marker: node.marker, raw: node.raw }
      }));
    }

    // ---------- Render ----------
    function render(container) {
      if (!container) container = document.getElementById('flowOverlay');
      flowEl = container;
      closeArrowPopup();
      Array.from(flowEl.childNodes).forEach(child => {
        if (child !== popupEl) flowEl.removeChild(child);
      });

      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      // The chart canvas is explicitly sized to stop at the edge of the
      // docked panel (not 100% of the overlay) so the panel sits beside
      // the chart, never on top of it.
      svg.style.cssText =
        'position:absolute;left:0;top:0;width:100%;height:100%;' +
        'display:block;background:var(--board)';
      svg.setAttribute('tabindex', '0');

      content = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // ---- defs: arrowhead marker + shadow filters ----
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'flowArrow');
      marker.setAttribute('markerWidth', '9');
      marker.setAttribute('markerHeight', '9');
      marker.setAttribute('refX', '7.5');
      marker.setAttribute('refY', '4');
      marker.setAttribute('orient', 'auto-start-reverse');
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrow.setAttribute('d', 'M0,0 L0,8 L8,4 Z');
      arrow.setAttribute('fill', LINK_COLOR);
      marker.appendChild(arrow);
      defs.appendChild(marker);

      const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      shadow.setAttribute('id', 'nodeShadow');
      shadow.setAttribute('x', '-60%');
      shadow.setAttribute('y', '-60%');
      shadow.setAttribute('width', '220%');
      shadow.setAttribute('height', '220%');
      const dropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
      dropShadow.setAttribute('dx', '0');
      dropShadow.setAttribute('dy', '3');
      dropShadow.setAttribute('stdDeviation', '4');
      dropShadow.setAttribute('flood-color', '#000');
      dropShadow.setAttribute('flood-opacity', '0.45');
      shadow.appendChild(dropShadow);
      defs.appendChild(shadow);

      const dragShadow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      dragShadow.setAttribute('id', 'nodeDragShadow');
      dragShadow.setAttribute('x', '-80%');
      dragShadow.setAttribute('y', '-80%');
      dragShadow.setAttribute('width', '260%');
      dragShadow.setAttribute('height', '260%');
      const dropShadow2 = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
      dropShadow2.setAttribute('dx', '0');
      dropShadow2.setAttribute('dy', '10');
      dropShadow2.setAttribute('stdDeviation', '10');
      dropShadow2.setAttribute('flood-color', '#000');
      dropShadow2.setAttribute('flood-opacity', '0.6');
      dragShadow.appendChild(dropShadow2);
      defs.appendChild(dragShadow);

      content.appendChild(defs);

      // ---- source data (built once; layout preserved across re-renders) ----
      buildData();

      // ---- reset view / update buttons ----
      // Both sit at the flow chart view's own top (70px — clear of the
      // page's outer nav above it) and are offset left of where the edit
      // panel docks, so the panel opening never covers them.
      const btnBaseCss =
        'position:absolute;right:10px;z-index:1000;' +
        'padding:6px 12px;border-radius:6px;' +
        'background:#3d3a34;color:#f4efe5;border:1px solid #cbbda5;' +
        'font:12px/1.4 sans-serif;cursor:pointer;' +
        'box-shadow:0 2px 4px rgba(0,0,0,0.4);';

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.textContent = 'Reset View';
      resetBtn.style.cssText = btnBaseCss + 'top:10px;';
      resetBtn.onclick = resetView;
      flowEl.appendChild(resetBtn);

      const updateBtn = document.createElement('button');
      updateBtn.type = 'button';
      updateBtn.textContent = 'Update';
      updateBtn.title = 'Re-run the auto-layout from the current afterNodes/marker data';
      updateBtn.style.cssText = btnBaseCss + 'top:48px;';
      updateBtn.onclick = updateLayout;
      flowEl.appendChild(updateBtn);

      // ---- links (behind nodes) ----
      drawLinks();

      // ---- live preview while dragging a connection from a handle dot ----
      drawLinkDragPreview();

      // ---- nodes ----
      drawNodes();

      svg.appendChild(content);
      flowEl.appendChild(svg);

      // Center content in the viewport ONCE, the first time there's
      // something to show. After that, panning/dragging/selecting never
      // touches panX/panY again — only the Reset View button does.
      if (state.nodes.length && !state.hasCentered) {
        centerView();
        state.hasCentered = true;
      }

      updateTransform();

      // ---- interactions ----
      // mousedown only matters while the cursor is actually over the chart,
      // so it stays on the svg element (recreated fresh each render). The
      // continuation of a drag/pan (mousemove/mouseup) is bound once, on
      // window, via setupGlobalDragListeners() below — see the comment
      // there for why.
      svg.addEventListener('mousedown', onLeftMouseDown, { passive: false });
      svg.addEventListener('wheel', onWheel, { passive: false });

      console.log('[Flow.js] Rendered', state.nodes.length, 'nodes,', state.links.length, 'links');
    }

    function contentBounds() {
      if (!state.nodes.length) return { x: 0, y: 0, w: 500, h: 400 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      state.nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + NODE_W);
        maxY = Math.max(maxY, n.y + NODE_H);
      });
      return { x: minX - PAD, y: minY - PAD, w: maxX - minX + 2 * PAD, h: maxY - minY + 2 * PAD };
    }

    function clampPan() {
      if (!state.nodes.length || !svg) return;
      const b = contentBounds();
      const svgW = svg.clientWidth || window.innerWidth || 800;
      const svgH = svg.clientHeight || window.innerHeight || 600;
      const z = state.zoom;

      const maxPanX = svgW - b.x * z;
      const minPanX = -(b.x + b.w) * z;
      const maxPanY = svgH - b.y * z;
      const minPanY = -(b.y + b.h) * z;

      state.panX = Math.max(minPanX, Math.min(maxPanX, state.panX));
      state.panY = Math.max(minPanY, Math.min(maxPanY, state.panY));
    }

    // Point the camera at the middle of all nodes, at the current zoom.
    // Only called on first load and from the Reset View button — never
    // as a side effect of an ordinary render().
    function centerView() {
      if (!state.nodes.length || !svg) return;
      const b = contentBounds();
      const svgW = svg.clientWidth || window.innerWidth || 800;
      const svgH = svg.clientHeight || window.innerHeight || 600;
      state.panX = (svgW / 2 / state.zoom) - (b.x + b.w / 2);
      state.panY = (svgH / 2 / state.zoom) - (b.y + b.h / 2);
    }

    // Purely a camera action: fit the zoom so the whole chart is visible,
    // then center it. Never touches node positions or afterNodes — it's
    // "show me everything", not "re-lay-out everything".
    function resetView() {
      if (state.nodes.length && svg) {
        const b = contentBounds();
        const svgW = svg.clientWidth || window.innerWidth || 800;
        const svgH = svg.clientHeight || window.innerHeight || 600;
        const fitZoom = Math.min(svgW / b.w, svgH / b.h) || 1;
        state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));
      } else {
        state.zoom = 1;
      }
      centerView();
      clampPan();
      // Re-render so the svg is recreated with the corrected camera transform
      // applied. Just calling updateTransform() on the old svg can leave the
      // chart detached or off-screen after a re-render elsewhere.
      render(flowEl);
    }

    // "Update": re-runs the auto-layout from the current afterNodes/marker
    // data and snaps every node back into its computed grid position —
    // unlike Reset View (camera only), this one DOES move nodes.
    function updateLayout() {
      layoutNodes(state.nodes);
      avoidNodeOverlap();
      state.links = computeLinks(state.nodes);
      state.nodes.forEach(n => { state.pos[n.id] = { x: n.x, y: n.y }; });
      render(flowEl);
    }

    // Links run from the source node's handle (right-mid edge) into the
    // target node's left edge, matching the reference art.
    function linkEndpoints(from, to) {
      return {
        c1: { x: from.x + NODE_W, y: from.y + NODE_H / 2 },
        c2: { x: to.x, y: to.y + NODE_H / 2 }
      };
    }

    function drawLinks() {
      state.links.forEach(link => {
        const from = state.nodes.find(n => n.id === link.from);
        const to = state.nodes.find(n => n.id === link.to);
        if (!from || !to) return;
        const { c1, c2 } = linkEndpoints(from, to);
        const dx = c2.x - c1.x;
        const cp1x = c1.x + Math.max(dx * 0.5, 40);
        const cp1y = c1.y;
        const cp2x = c2.x - Math.max(dx * 0.5, 40);
        const cp2y = c2.y;
        const d = `M ${c1.x} ${c1.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${c2.x} ${c2.y}`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', LINK_COLOR);
        path.setAttribute('stroke-width', '2.25');
        path.setAttribute('marker-end', 'url(#flowArrow)');
        path.setAttribute('pointer-events', 'none');
        content.appendChild(path);
      });
    }

    // While dragging FROM a handle dot, show a dashed preview line to the
    // cursor so it's clear you're drawing a new connection.
    function drawLinkDragPreview() {
      if (!state.isLinkDragging || !state.linkFromNode || !state.linkDragMoved) return;
      const from = state.linkFromNode;
      const c1 = { x: from.x + NODE_W, y: from.y + NODE_H / 2 };
      const c2 = { x: state.linkCurX, y: state.linkCurY };
      const dx = c2.x - c1.x;
      const cp1x = c1.x + Math.max(dx * 0.5, 40);
      const cp2x = c2.x - Math.max(dx * 0.5, 40);
      const d = `M ${c1.x} ${c1.y} C ${cp1x} ${c1.y} ${cp2x} ${c2.y} ${c2.x} ${c2.y}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', LINK_COLOR);
      path.setAttribute('stroke-width', '2.25');
      path.setAttribute('stroke-dasharray', '6,5');
      path.setAttribute('pointer-events', 'none');
      content.appendChild(path);
    }

    function drawNodes() {
      state.nodes.forEach((node, nodeIdx) => {
        const isDragging = state.isNodeDragging && state.dragNode && node.id === state.dragNode.id;
        const isSelected = node.id === state.selectedId;
        const markerColor = colorForMarker(node.marker);
        const borderColor = isSelected ? SELECTED_COLOR : markerColor;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'flow-node');
        g.setAttribute('data-id', node.id);
        g.setAttribute('transform', `translate(${node.x},${node.y})`);
        g.style.cursor = isDragging ? 'grabbing' : 'grab';

        // dragging: dashed lift ring behind the card so it reads as "picked up"
        if (isDragging) {
          const lift = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          lift.setAttribute('x', '-6');
          lift.setAttribute('y', '-6');
          lift.setAttribute('width', NODE_W + 12);
          lift.setAttribute('height', NODE_H + 12);
          lift.setAttribute('rx', '16');
          lift.setAttribute('ry', '16');
          lift.setAttribute('fill', 'none');
          lift.setAttribute('stroke', INSERT_LINE_COLOR);
          lift.setAttribute('stroke-width', '2');
          lift.setAttribute('stroke-dasharray', '5,4');
          lift.setAttribute('pointer-events', 'none');
          g.appendChild(lift);
        }

        // card body: dark fill, kind-colored (or white, if selected) border
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');
        rect.setAttribute('width', NODE_W);
        rect.setAttribute('height', NODE_H);
        rect.setAttribute('rx', '12');
        rect.setAttribute('ry', '12');
        rect.setAttribute('fill', CARD_BG);
        rect.setAttribute('stroke', borderColor);
        rect.setAttribute('stroke-width', isSelected ? '2.5' : '2');
        rect.setAttribute('filter', isDragging ? 'url(#nodeDragShadow)' : 'url(#nodeShadow)');
        rect.setAttribute('pointer-events', 'none');
        g.appendChild(rect);

        // Thick left-edge strip, matching LEFT_EDGE_W exactly, as a visual
        // cue for "click here to pop up/detach this node's incoming
        // arrows". Clipped to the card's own rounded-corner shape (via a
        // per-node clipPath) so it hugs the card's top-left/bottom-left
        // curve instead of showing square corners poking out past it.
        const clipId = 'flowNodeClip' + nodeIdx;
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clip.setAttribute('id', clipId);
        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', '0');
        clipRect.setAttribute('y', '0');
        clipRect.setAttribute('width', NODE_W);
        clipRect.setAttribute('height', NODE_H);
        clipRect.setAttribute('rx', '12');
        clipRect.setAttribute('ry', '12');
        clip.appendChild(clipRect);
        g.appendChild(clip);

        const leftEdge = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        leftEdge.setAttribute('x', '0');
        leftEdge.setAttribute('y', '0');
        leftEdge.setAttribute('width', LEFT_EDGE_W);
        leftEdge.setAttribute('height', NODE_H);
        leftEdge.setAttribute('clip-path', 'url(#' + clipId + ')');
        leftEdge.setAttribute('fill', markerColor);
        leftEdge.setAttribute('opacity', '0.6');
        leftEdge.setAttribute('pointer-events', 'none');
        g.appendChild(leftEdge);

        // marker label (Main Quest / Side Quest / Narrative Event / City Event)
        const tKind = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tKind.setAttribute('x', 16);
        tKind.setAttribute('y', 26);
        tKind.setAttribute('fill', markerColor);
        tKind.setAttribute('font-family', 'sans-serif');
        tKind.setAttribute('font-size', '11');
        tKind.setAttribute('font-weight', '700');
        tKind.setAttribute('letter-spacing', '0.5');
        tKind.setAttribute('pointer-events', 'none');
        tKind.textContent = labelForMarker(node.marker);
        g.appendChild(tKind);

        // node name
        const tName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tName.setAttribute('x', 16);
        tName.setAttribute('y', 48);
        tName.setAttribute('fill', '#f4f6fa');
        tName.setAttribute('font-family', 'sans-serif');
        tName.setAttribute('font-size', '15');
        tName.setAttribute('font-weight', '700');
        tName.setAttribute('pointer-events', 'none');
        tName.textContent = truncate(node.name, 26);
        g.appendChild(tName);

        // optional subtitle (raw.subtitle / description / summary)
        if (node.subtitle) {
          const tSub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          tSub.setAttribute('x', 16);
          tSub.setAttribute('y', 66);
          tSub.setAttribute('fill', SUBTITLE_COLOR);
          tSub.setAttribute('font-family', 'sans-serif');
          tSub.setAttribute('font-size', '11.5');
          tSub.setAttribute('pointer-events', 'none');
          tSub.textContent = '\u25B8 ' + truncate(node.subtitle, 30);
          g.appendChild(tSub);
        }

        // connection handle (right-mid edge): click to edit, drag onto
        // another node to add a connection to it.
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handle.setAttribute('cx', NODE_W);
        handle.setAttribute('cy', NODE_H / 2);
        handle.setAttribute('r', HANDLE_R);
        handle.setAttribute('fill', markerColor);
        handle.setAttribute('stroke', CARD_BG);
        handle.setAttribute('stroke-width', '3');
        handle.setAttribute('pointer-events', 'none');
        g.appendChild(handle);

        content.appendChild(g);
      });
    }

    function truncate(str, len) {
      return str.length > len ? str.slice(0, len - 1) + '…' : str;
    }

    // ---------- Interaction helpers ----------
    // Raw pixel position in the svg's own coordinate space — i.e. BEFORE
    // the content group's translate(panX,panY) scale(zoom) is applied.
    // panX/panY are themselves screen-pixel offsets, so panning math needs
    // this, not screenToContent's zoom-divided result (mixing the two was
    // the cause of panning "jumping": at any zoom other than 1x, dividing
    // a pan delta by zoom and then adding it to a screen-space value is a
    // unit mismatch — it was amplifying or shrinking every pan move by
    // 1/zoom).
    function screenToRaw(clientX, clientY) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
      return { x: svgP.x, y: svgP.y };
    }

    // Content-space position (accounts for current pan + zoom) — used for
    // hit-testing nodes and for moving a dragged node, where the thing being
    // positioned (node.x/y) genuinely does live in content space.
    function screenToContent(clientX, clientY) {
      const raw = screenToRaw(clientX, clientY);
      return {
        x: (raw.x - state.panX) / state.zoom,
        y: (raw.y - state.panY) / state.zoom
      };
    }

    function findNodeAt(x, y) {
      for (let i = state.nodes.length - 1; i >= 0; i--) {
        const n = state.nodes[i];
        if (x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H) return n;
      }
      return null;
    }

    // Is (x,y) within the clickable radius of this node's connection dot?
    function findHandleAt(x, y) {
      for (let i = state.nodes.length - 1; i >= 0; i--) {
        const n = state.nodes[i];
        const cx = n.x + NODE_W;
        const cy = n.y + NODE_H / 2;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= HANDLE_HIT_R * HANDLE_HIT_R) return n;
      }
      return null;
    }

    // Is (x,y) within the clickable strip running down this node's left
    // edge? Clicking there pops up the list of arrows coming INTO this
    // node (i.e. its own afterNodes), each removable with an ×.
    function findLeftEdgeAt(x, y) {
      for (let i = state.nodes.length - 1; i >= 0; i--) {
        const n = state.nodes[i];
        if (x >= n.x && x <= n.x + LEFT_EDGE_W && y >= n.y && y <= n.y + NODE_H) return n;
      }
      return null;
    }

    function updateTransform() {
      content.setAttribute('transform', `translate(${state.panX},${state.panY}) scale(${state.zoom})`);
    }

    // ---------- Interaction ----------
    function onLeftMouseDown(ev) {
      if (ev.button !== 0) return;
      
      // Mode-based blocking: when in campaign flow mode, prevent clicks
      // from registering in the SME beneath the flow chart. This mirrors
      // the blocking in index.html for pointerdown events, ensuring
      // consistent behavior across both mousedown and pointerdown handlers.
      // We check BOTH the flow-mode class on body AND the flow overlay visibility
      // for robust detection that works across different mode-switching scenarios.
      const inFlowMode = document.body.classList.contains('flow-mode');
      const flowOverlay = document.getElementById('flowOverlay');
      const flowOverlayVisible = flowOverlay && flowOverlay.style.display !== 'none';
      
      console.log('[onLeftMouseDown] flow-mode class:', inFlowMode);
      console.log('[onLeftMouseDown] flowOverlay visible:', flowOverlayVisible);
      
      if (inFlowMode && flowOverlayVisible) {
        // In Flow mode: return early to prevent any click action that
        // would register in the SME tile placement area. The index.html
        // pointerdown blocking handles the stage element, and this handles
        // the flow chart SVG mousedown.
        console.log('[onLeftMouseDown] Early return - Flow mode active');
        return;
      }

      const p = screenToContent(ev.clientX, ev.clientY);

      // handle dot: click opens the edit panel, drag starts a new connection
      const handleNode = findHandleAt(p.x, p.y);
      if (handleNode) {
        ev.preventDefault();
        state.isLinkDragging = true;
        state.linkFromNode = handleNode;
        state.linkDragMoved = false;
        state.linkStartMouseX = p.x;
        state.linkStartMouseY = p.y;
        state.linkCurX = p.x;
        state.linkCurY = p.y;
        return;
      }

      // left-edge strip: click pops up this node's incoming arrows (its own
      // afterNodes), each with an × to detach it — doesn't start a drag.
      const leftEdgeNode = findLeftEdgeAt(p.x, p.y);
      if (leftEdgeNode) {
        ev.preventDefault();
        openIncomingArrowsPopup(leftEdgeNode, ev.clientX, ev.clientY);
        return;
      }

      const node = findNodeAt(p.x, p.y);
      if (node) {
        ev.preventDefault();
        state.isNodeDragging = true;
        state.dragNode = node;
        state.dragMoved = false;
        state.dragStartMouseX = p.x;
        state.dragStartMouseY = p.y;
        state.dragOrigX = node.x;
        state.dragOrigY = node.y;
      } else {
        // Mode-based approach: when in Flow mode, prevent clicks from
        // registering in the SME beneath the flow chart. The flow chart
        // SVG has pointer-events: none on most elements, allowing clicks
        // to pass through to the SME area below. When in flow mode,
        // stop event propagation to keep clicks within the flow chart.
        // Check BOTH the flow-mode class on body AND campaign mode with campView='flow'
        // for robust detection across different mode-switching scenarios.
        const isFlowMode = document.body.classList.contains('flow-mode');
        // Note: mode and campView are index.html variables; if inaccessible, fall back to flow-mode check only
        let inCampaignFlowMode = false;
        try {
          inCampaignFlowMode = (typeof mode !== 'undefined' && mode === 'campaign' && typeof campView !== 'undefined' && campView === 'flow');
        } catch(e) {
          // Variables not accessible, fall through
        }
        
        if (isFlowMode || inCampaignFlowMode) {
          // In Flow mode: stop event propagation so clicks stay within the flow chart
          // and don't register in the SME tile placement area beneath.
          // Return early to prevent panning/other actions that would register in SME.
          ev.stopPropagation();
          return;
        }

        state.isPanning = true;
        // Pan start/delta tracking uses raw screen pixels, not content
        // coordinates — panX/panY are screen-space, so the delta we add to
        // them has to be too (see screenToRaw's comment).
        const raw = screenToRaw(ev.clientX, ev.clientY);
        state.panStartX = raw.x;
        state.panStartY = raw.y;
        state.dragStartPanX = state.panX;
        state.dragStartPanY = state.panY;
      }
    }

    function onMouseMove(ev) {
      if (!svg) return;
      const p = screenToContent(ev.clientX, ev.clientY);

      if (state.isLinkDragging && state.linkFromNode) {
        const dx = p.x - state.linkStartMouseX;
        const dy = p.y - state.linkStartMouseY;
        if (!state.linkDragMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          state.linkDragMoved = true;
        }
        state.linkCurX = p.x;
        state.linkCurY = p.y;
        if (state.linkDragMoved) render(flowEl);
        return;
      }

      if (state.isNodeDragging && state.dragNode) {
        const dx = p.x - state.dragStartMouseX;
        const dy = p.y - state.dragStartMouseY;
        if (!state.dragMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          state.dragMoved = true;
        }
        if (state.dragMoved) {
          state.dragNode.x = state.dragOrigX + dx;
          state.dragNode.y = state.dragOrigY + dy;
          render(flowEl);
        }
        return;
      }

      if (state.isPanning) {
        const raw = screenToRaw(ev.clientX, ev.clientY);
        const dx = raw.x - state.panStartX;
        const dy = raw.y - state.panStartY;
        state.panX = state.dragStartPanX + dx;
        state.panY = state.dragStartPanY + dy;
        clampPan();
        updateTransform();
        return;
      }

      if (findHandleAt(p.x, p.y) || findLeftEdgeAt(p.x, p.y)) {
        svg.style.cursor = 'pointer';
      } else {
        svg.style.cursor = findNodeAt(p.x, p.y) ? 'grab' : 'default';
      }
    }

    function onMouseUp() {
      if (state.isLinkDragging) {
        const fromNode = state.linkFromNode;
        const moved = state.linkDragMoved;
        const curX = state.linkCurX, curY = state.linkCurY;
        state.isLinkDragging = false;
        state.linkFromNode = null;
        state.linkDragMoved = false;

        if (moved && fromNode) {
          const target = findNodeAt(curX, curY);
          if (target && target.id !== fromNode.id) {
            const current = getAfterNodes(target.raw).slice();
            if (!current.includes(fromNode.id)) {
              current.push(fromNode.id);
              setAfterNodes(target.raw, current);
              state.links = computeLinks(state.nodes);
              console.log('[Flow.js] Linked', fromNode.id, '->', target.id);
            }
          }
        } else if (fromNode) {
          // a plain click on the handle (no drag) opens the edit panel
          state.selectedId = fromNode.id;
          triggerEditNode(fromNode);
        }
        render(flowEl);
        return;
      }

      if (state.isNodeDragging) {
        const node = state.dragNode;
        const moved = state.dragMoved;
        state.isNodeDragging = false;
        state.dragNode = null;
        state.dragMoved = false;

        if (moved && node) {
          finishNodeDrag(node);
        } else if (node) {
          // a plain click on the node's center: select it AND load it into
          // the edit panel
          state.selectedId = node.id;
          triggerEditNode(node);
          render(flowEl);
        }
        return;
      }
      state.isPanning = false;
    }

    function onWheel(ev) {
      ev.preventDefault();
      const delta = Math.sign(ev.deltaY);
      const step = 0.1;
      let newZoom = state.zoom - delta * step;
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      if (newZoom === state.zoom) return;
      const p = screenToContent(ev.clientX, ev.clientY);
      // zoom toward mouse cursor: keep p fixed in content space
      state.panX = p.x * state.zoom - p.x * newZoom + state.panX;
      state.panY = p.y * state.zoom - p.y * newZoom + state.panY;
      state.zoom = newZoom;
      clampPan();
      updateTransform();
    }

    // Bind the continuation/end of a drag or pan to the window, not the
    // svg element: if the cursor moves fast enough to momentarily leave the
    // chart's bounds mid-drag (very easy to do while panning), an
    // element-scoped mousemove/mouseup stops receiving events and the drag
    // looks like it "sticks" or glitches. Binding here, once, also avoids
    // piling up duplicate handlers — render() recreates the <svg> (and its
    // own listeners) on every call, but this runs only a single time.
    function setupGlobalDragListeners() {
      window.addEventListener('mousemove', onMouseMove, { passive: false });
      window.addEventListener('mouseup', onMouseUp, { passive: false });
      window.addEventListener('blur', onMouseUp);
    }
    setupGlobalDragListeners();

    // ---------- Public API ----------
    window.DescentForgeFlow = {
      init: function(container){ render(container || document.getElementById('flowOverlay')); },
      render: render,
      resetView: resetView,
      updateLayout: updateLayout,
      selectNode: function(id){ state.selectedId = id; render(flowEl); },
      getSelectedNode: function(){ return state.selectedId ? state.nodes.find(n=>n.id===state.selectedId) : null; },
      closeSelection: function(){ state.selectedId = null; render(flowEl); },
      // Fired when a node is clicked in the chart. Receives (raw, node).
      // The host page (e.g. Campaign mode's right Properties box) owns editing.
      onNodeSelect: null
    };
  }
})();
