// Explore mode: after the scroll, walk the house yourself. Each room has a
// standing spot or two, joined through the doorways. Drag to look around,
// click a marker or the floor to walk there, or pick a room on the plan.
import * as THREE from 'three';
import * as P from './plan.js';
import { wallPieces } from './build.js';

const { wx, wy, wz } = P;
const EYE = 5.3;

// Standing spots, in plan feet: where you stand and what you face on arrival.
const NODES = {
  FP: { name: 'Front porch', room: 'frontPorch', at: [63.7, 10.0], look: [63.7, -20] },
  E: { name: 'Entry', room: 'entry', at: [63.7, 17.6], look: [63.7, 30] },
  L1: { name: 'Living', room: 'living', at: [56.0, 23.2], look: [71.5, 34] },
  L2: { name: 'Living', room: 'living', at: [61.8, 38.8], look: [72, 28] },
  RP1: { name: 'Rear porch', room: 'rearPorch', at: [62.5, 50.0], look: [74, 58] },
  RP2: { name: 'Rear porch', room: 'rearPorch', at: [70.5, 50.5], look: [52, 52] },
  K1: { name: 'Kitchen', room: 'kitchen', at: [50.0, 19.8], look: [45, 42.3] },
  K2: { name: 'Kitchen', room: 'kitchen', at: [41.95, 29.0], look: [44, 42] },
  K3: { name: 'Kitchen', room: 'kitchen', at: [50.3, 36.8], look: [40, 26] },
  N: { name: "Butler's pantry", room: 'pantry', at: [34.4, 25.4], look: [30.5, 13] },
  D1: { name: 'Dining', room: 'dining', at: [49.6, 13.0], look: [44, 1.0] },
  D2: { name: 'Dining', room: 'dining', at: [40.1, 9.0], look: [50, 8] },
  M: { name: 'Mudbench', room: 'hall', at: [30.0, 36.0], look: [35, 41.5] },
  PW: { name: 'Powder', room: 'powder', at: [35.7, 32.4], look: [35.7, 29] },
  LA: { name: 'Laundry', room: 'laundry', at: [18.0, 34.0], look: [18, 29] },
  G: { name: 'Garage', room: 'garage', at: [14.0, 18.0], look: [14, 5] },
  MB1: { name: 'Master bedroom', room: 'mbed', at: [24.2, 45.6], look: [16, 60] },
  MB2: { name: 'Master bedroom', room: 'mbed', at: [17.4, 56.4], look: [27, 50] },
  MBA: { name: 'Master bath', room: 'mbath', at: [9.6, 53.9], look: [1.5, 56.0] },
  MBA2: { name: 'Master bath', room: 'mbath', at: [9.0, 48.2], look: [3, 60] },
  MC: { name: 'Master closet', room: 'mcloset', at: [7.1, 43.3], look: [7.1, 36] },
  BH: { name: 'Hall', room: 'bhall', at: [77.4, 21.8], look: [77.4, 15] },
  B3: { name: 'Bedroom 3', room: 'bed3', at: [79.0, 9.0], look: [86, 6] },
  B2: { name: 'Bedroom 2', room: 'bed2', at: [79.0, 35.0], look: [86, 36] },
  BA2: { name: 'Bath 2', room: 'bath2', at: [85.4, 21.8], look: [88, 21.8] },
};

// Links between spots, with the points the walk passes through (doorways).
const LINKS = [
  ['FP', 'E', [[63.7, 14.6]]],
  ['E', 'L1', []],
  ['E', 'L2', [[62.0, 24.0]]],
  ['E', 'K1', [[52.0, 17.0]]],
  ['E', 'BH', [[75.4, 17.0], [77.4, 19.0]]],
  ['L1', 'L2', [[62.0, 26.5], [62.0, 36.5]]],
  ['L1', 'K1', [[52.4, 27.4], [50.6, 24.6]]],
  ['L2', 'K3', []],
  ['L2', 'RP1', [[62.9, 41.8], [63.0, 43.8]]],
  ['RP1', 'RP2', []],
  ['K1', 'K2', [[42.0, 20.8]]],
  ['K1', 'K3', []],
  ['K1', 'D1', []],
  ['K1', 'N', [[40.6, 17.0], [37.8, 17.0], [35.2, 17.6]]],
  ['K2', 'K3', [[42.2, 36.4]]],
  ['K2', 'M', [[42.0, 36.8], [39.6, 38.4], [37.8, 38.4], [35.0, 38.4]]],
  ['D1', 'D2', [[46.0, 15.6], [40.6, 14.0]]],
  ['M', 'N', [[31.5, 30.6], [31.5, 28.85], [31.8, 26.0]]],
  ['M', 'PW', [[32.3, 32.3], [33.7, 32.3]]],
  ['M', 'LA', [[23.6, 37.0], [22.4, 37.0], [20.5, 35.5]]],
  ['M', 'G', [[24.9, 31.0], [24.9, 28.85], [22.0, 25.5]]],
  ['M', 'MB1', [[28.4, 40.6], [27.8, 43.15], [27.6, 44.6]]],
  ['MB1', 'MB2', [[20.0, 47.5]]],
  ['MB1', 'MBA', [[17.0, 50.0], [15.5, 53.9], [13.6, 53.9]]],
  ['MB2', 'MBA', [[15.5, 53.9], [13.6, 53.9]]],
  ['MBA', 'MBA2', []],
  ['MBA', 'MC', [[6.85, 47.5], [6.85, 45.5]]],
  ['MBA2', 'MC', [[6.85, 46.2], [6.85, 45.4]]],
  ['MC', 'LA', [[10.4, 42.6], [10.4, 37.6], [11.6, 35.9], [13.6, 35.9], [15.5, 35.5]]],
  ['BH', 'B3', [[77.4, 15.0], [78.5, 11.5]]],
  ['BH', 'B2', [[77.4, 28.6], [78.5, 31.5]]],
  ['B3', 'BA2', [[85.7, 12.8], [85.7, 15.0]]],
  ['B2', 'BA2', [[81.5, 31.0], [85.7, 30.6], [85.7, 28.6]]],
];

// Which spot a room on the plan takes you to.
const ROOM_NODE = {
  entry: 'E', living: 'L1', kitchen: 'K1', dining: 'D1', pantry: 'N', hall: 'M', powder: 'PW',
  laundry: 'LA', garage: 'G', mcloset: 'MC', mbath: 'MBA', mbed: 'MB1', bed2: 'B2', bed3: 'B3',
  bhall: 'BH', bath2: 'BA2', frontPorch: 'FP', rearPorch: 'RP1',
};
// Rooms with their finishes in; the rest are still the drawing.
const FITTED = new Set(['entry', 'living', 'kitchen', 'dining', 'pantry', 'frontPorch', 'rearPorch', 'mbed', 'mbath', 'mcloset']);

// ---------------------------------------------------------------- graph

const adj = {};
for (const id in NODES) adj[id] = [];
const plen = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
for (const [a, b, via] of LINKS) {
  const pts = [NODES[a].at, ...via, NODES[b].at];
  adj[a].push({ to: b, pts, len: plen(pts) });
  adj[b].push({ to: a, pts: [...pts].reverse(), len: plen(pts) });
}

function route(from, to) {
  const dist = {}, prev = {}, done = new Set();
  for (const id in NODES) dist[id] = Infinity;
  dist[from] = 0;
  while (true) {
    let u = null;
    for (const id in dist) if (!done.has(id) && dist[id] < Infinity && (u === null || dist[id] < dist[u])) u = id;
    if (u === null || u === to) break;
    done.add(u);
    for (const e of adj[u]) if (dist[u] + e.len < dist[e.to]) { dist[e.to] = dist[u] + e.len; prev[e.to] = { from: u, e }; }
  }
  if (!prev[to] && from !== to) return null;
  const legs = [];
  for (let v = to; v !== from; v = prev[v].from) legs.unshift(prev[v].e);
  const pts = [NODES[from].at];
  for (const l of legs) pts.push(...l.pts.slice(1));
  return pts;
}

// ---------------------------------------------------------------- sight lines

// Wall pieces that stand from the floor past eye height block the view.
const BLOCK = [];
for (const w of [...P.extWalls, ...P.intWalls]) {
  for (const piece of wallPieces(w.r, w.open, P.PLATE)) if (piece.h0 === 0 && piece.h1 > EYE) BLOCK.push(piece.r);
}
function segHitsRect([ax, ay], [bx, by], [x0, y0, x1, y1]) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 < t1 - 1e-6;
}
export function sightClear(a, b, shrink = 0.03) {
  return !BLOCK.some(([x0, y0, x1, y1]) => segHitsRect(a, b, [x0 + shrink, y0 + shrink, x1 - shrink, y1 - shrink]));
}

// ---------------------------------------------------------------- the plan

const SVGNS = 'http://www.w3.org/2000/svg';
const Y = (y) => P.SIZE.d - y;
function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function roomRects() {
  const list = P.rooms.filter((r) => ROOM_NODE[r.id]).map((r) => ({ id: r.id, r: r.r }));
  list.push({ id: 'frontPorch', r: P.porches.front.r }, { id: 'rearPorch', r: P.porches.rear.r });
  return list;
}

function buildPlan(svg, go) {
  svg.setAttribute('viewBox', `-3 -2 ${P.SIZE.w + 6} ${P.SIZE.d + 4}`);
  const rooms = el('g', { class: 'pl-rooms' }, svg);
  const byRoom = {};
  for (const { id, r } of roomRects()) {
    const [x0, y0, x1, y1] = r;
    const rect = el('rect', { x: x0, y: Y(y1), width: x1 - x0, height: y1 - y0, class: 'pl-room' + (FITTED.has(id) ? ' is-fitted' : ''),
      tabindex: 0, role: 'button', 'aria-label': `Go to ${NODES[ROOM_NODE[id]].name}` }, rooms);
    rect.addEventListener('click', () => go(ROOM_NODE[id], true));
    rect.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(ROOM_NODE[id], true); } });
    (byRoom[id] ||= []).push(rect);
  }
  const walls = el('g', { class: 'pl-walls' }, svg);
  for (const [x0, y0, x1, y1] of BLOCK) el('rect', { x: x0, y: Y(y1), width: x1 - x0, height: y1 - y0 }, walls);
  for (const w of [...P.extWalls, ...P.intWalls]) {
    for (const piece of wallPieces(w.r, w.open, P.PLATE)) {
      if (piece.h0 !== 0 || piece.h1 > EYE) continue;            // under a window: thinner line
      const [x0, y0, x1, y1] = piece.r;
      el('rect', { x: x0, y: Y(y1), width: x1 - x0, height: y1 - y0, class: 'pl-sill' }, walls);
    }
  }
  const labels = el('g', { class: 'pl-labels' }, svg);
  const seen = new Set();
  for (const { id, r } of roomRects()) {
    if (seen.has(id) || ['bhall', 'powder'].includes(id)) continue;
    seen.add(id);
    const room = P.rooms.find((q) => q.id === id && q.label);
    const at = room ? room.label : [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
    const t = el('text', { x: at[0], y: Y(at[1]) + 0.6, class: 'pl-label' }, labels);
    t.textContent = NODES[ROOM_NODE[id]].name.replace('Master ', 'Mstr ').replace("Butler's pantry", 'Pantry').toUpperCase();
  }
  const me = el('g', { class: 'pl-me' }, svg);
  el('path', { d: 'M0 0 L7 -3.8 A8 8 0 0 1 7 3.8 Z', class: 'pl-cone' }, me);
  el('circle', { r: 1.1, class: 'pl-dot' }, me);
  return { me, byRoom };
}

// ---------------------------------------------------------------- explore

export function createExplore({ camera, canvas, ui, onChange, onRoom }) {
  const state = { active: false, at: [49.4, 17.2], yaw: 0, pitch: 0, fov: 60, cur: null, move: null, turn: null };
  const plan = buildPlan(ui.plan, (id, fromPlan) => go(id, fromPlan));
  const markers = {};
  for (const id in NODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ex-mark';
    b.innerHTML = '<i></i><span></span>';
    b.setAttribute('aria-label', `Walk to ${NODES[id].name}`);
    b.addEventListener('click', (e) => { e.stopPropagation(); go(id, false); });
    ui.markers.appendChild(b);
    markers[id] = b;
  }

  const heading = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const roomAt = ([x, y]) => {
    for (const id in NODES) if (NODES[id].room && roomRectsOf(NODES[id].room).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return NODES[id].room;
    return null;
  };
  const rects = {};
  for (const { id, r } of roomRects()) (rects[id] ||= []).push(r);
  function roomRectsOf(id) { return rects[id] || []; }

  function place() {
    const [x, y] = state.at;
    camera.position.set(wx(x), wy(EYE), wz(y));
    const cp = Math.cos(state.pitch);
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.x + Math.cos(state.yaw) * cp, camera.position.y + Math.sin(state.pitch), camera.position.z - Math.sin(state.yaw) * cp);
    camera.fov = state.fov;
    camera.near = 0.12;
    camera.far = 1400;
    camera.updateProjectionMatrix();
  }

  // walk along a polyline of plan points, then face `face` (a heading) if given
  function walk(pts, face, to) {
    const len = plen(pts);
    if (len < 0.05) { state.cur = to; turnTo(face); return; }
    const dur = Math.min(4.2, Math.max(0.9, len / 9));
    state.move = { pts, len, t: 0, dur, face, to };
    state.turn = null;
  }
  function turnTo(face) {
    if (face == null) return;
    let d = face - state.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    state.turn = { from: state.yaw, d, t: 0, dur: Math.min(1, 0.35 + Math.abs(d) * 0.3), pitch0: state.pitch };
  }
  function pointAt(pts, s) {
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (s <= l || i === pts.length - 1) {
        const k = l ? Math.min(1, s / l) : 1;
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      }
      s -= l;
    }
    return pts[pts.length - 1];
  }

  function go(id, fromPlan) {
    if (!state.active || !NODES[id]) return;
    const n = NODES[id];
    const face = fromPlan || id === state.cur ? heading(n.at, n.look) : null;
    if (id === state.cur) { turnTo(face); onChange(); return; }
    const pts = state.cur ? route(state.cur, id) : [state.at, n.at];
    if (!pts) return;
    pts[0] = state.at;
    walk(pts, face, id);
    onChange();
  }

  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
  function update(dt) {
    if (!state.active) return false;
    let moving = false;
    const m = state.move;
    if (m) {
      m.t = Math.min(m.dur, m.t + dt);
      const s = ease(m.t / m.dur) * m.len;
      state.at = pointAt(m.pts, s);
      const ahead = pointAt(m.pts, Math.min(m.len, s + 2.5));
      if (Math.hypot(ahead[0] - state.at[0], ahead[1] - state.at[1]) > 0.2) {
        let d = heading(state.at, ahead) - state.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        state.yaw += d * (1 - Math.exp(-dt * 5));
      }
      state.pitch += (-0.06 - state.pitch) * (1 - Math.exp(-dt * 4));
      moving = true;
      if (m.t >= m.dur) { state.move = null; state.cur = m.to; turnTo(m.face); }
    }
    const t = state.turn;
    if (t) {
      t.t = Math.min(t.dur, t.t + dt);
      const u = ease(t.t / t.dur);
      state.yaw = t.from + t.d * u;
      state.pitch = t.pitch0 + (-0.04 - t.pitch0) * u;
      moving = true;
      if (t.t >= t.dur) state.turn = null;
    }
    if (moving) { place(); onChange(); }
    return moving;
  }

  // markers and the plan, after each render
  const v = new THREE.Vector3();
  let lastRoom = null;
  function overlay() {
    if (!state.active) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const here = roomAt(state.at);
    const busy = !!state.move;
    for (const id in NODES) {
      const n = NODES[id], b = markers[id];
      const dist = Math.hypot(n.at[0] - state.at[0], n.at[1] - state.at[1]);
      let show = !busy && id !== state.cur && dist > 2 && dist < 45 && sightClear(state.at, n.at);
      if (show) {
        v.set(wx(n.at[0]), 0.03, wz(n.at[1])).project(camera);
        show = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        if (show) {
          const s = Math.max(0.45, Math.min(1.25, 14 / dist));
          b.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) scale(${s.toFixed(3)})`;
          b.querySelector('span').textContent = n.room === here ? '' : n.name;
        }
      }
      b.hidden = !show;
    }
    // the plan: where you are and which way you look
    const deg = (-state.yaw * 180) / Math.PI;
    plan.me.setAttribute('transform', `translate(${state.at[0].toFixed(2)} ${Y(state.at[1]).toFixed(2)}) rotate(${deg.toFixed(1)})`);
    if (here !== lastRoom) {
      lastRoom = here;
      for (const id in plan.byRoom) plan.byRoom[id].forEach((r) => r.classList.toggle('is-here', id === here));
      const node = here && NODES[ROOM_NODE[here]];
      const room = P.rooms.find((r) => r.id === here && r.sf);
      const sf = room ? room.sf : { frontPorch: 171, rearPorch: 412 }[here];
      onRoom(node ? node.name : 'Outside', sf ? `${sf} sq ft` : '', here && !FITTED.has(here), here);
    }
  }

  // ---------------------------------------------------------------- input

  const pointers = new Map();
  let drag = null, pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.active) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, moved: 0 };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), fov: state.fov };
      drag = null;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.active || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      zoom(pinch.fov * (pinch.d / Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1]))) - state.fov);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const k = (state.fov / 60) * (2.2 / Math.max(400, canvas.clientHeight));
    state.yaw += dx * k;
    state.pitch = Math.max(-1.1, Math.min(0.9, state.pitch + dy * k));
    state.turn = null;
    place(); onChange();
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && drag.moved < 6 && e.type === 'pointerup') floorClick(e.clientX, e.clientY);
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    if (!state.active) return;
    e.preventDefault();
    zoom(e.deltaY * 0.03);
  }, { passive: false });
  addEventListener('keydown', (e) => {
    if (!state.active || e.target.closest?.('input, textarea')) return;
    const k = { ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] }[e.key];
    if (!k) return;
    e.preventDefault();
    state.yaw += k[0];
    state.pitch = Math.max(-1.1, Math.min(0.9, state.pitch + k[1]));
    place(); onChange();
  });
  function zoom(d) {
    state.fov = Math.max(32, Math.min(78, state.fov + d));
    place(); onChange();
  }

  // a click on the floor walks to the spot nearest to it that you can see
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function floorClick(cx, cy) {
    if (state.move) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    if (!ray.ray.intersectPlane(floor, hit)) return;
    const q = [hit.x / P.FT + P.SIZE.w / 2, P.SIZE.d / 2 - hit.z / P.FT];
    if (!sightClear(state.at, q)) return;
    let best = null, bd = 9;
    for (const id in NODES) {
      if (id === state.cur) continue;
      const d = Math.hypot(NODES[id].at[0] - q[0], NODES[id].at[1] - q[1]);
      if (d < bd && sightClear(state.at, NODES[id].at)) { bd = d; best = id; }
    }
    if (best) go(best, false);
  }

  return {
    get active() { return state.active; },
    // start from wherever the camera is now and walk to the nearest spot
    enter(fromPos, fromYaw, fov) {
      state.active = true;
      state.at = fromPos;
      state.yaw = fromYaw;
      state.pitch = -0.04;
      state.fov = fov;
      state.cur = null;
      state.move = state.turn = null;
      lastRoom = undefined;
      go('D1', false);
      place();
    },
    leave() {
      state.active = false;
      state.move = state.turn = null;
      for (const id in markers) markers[id].hidden = true;
    },
    update, overlay, go, place,
    // for checks: every link's path against the walls
    check() {
      const bad = [];
      for (const [a, b, via] of LINKS) {
        const pts = [NODES[a].at, ...via, NODES[b].at];
        for (let i = 1; i < pts.length; i++) if (!sightClear(pts[i - 1], pts[i], -0.6)) bad.push(`${a}-${b} leg ${i}`);
      }
      return bad;
    },
    state,
  };
}
