// The fitted rooms: the living room, the kitchen, the butler's pantry, the
// dining room and the rear porch (checkpoint 2), the master suite
// (checkpoint 4), bedrooms 2 and 3, bath 2, the powder room, the laundry
// and the mudbench hall (checkpoint 5), and the garage and the storage room
// (checkpoint 6). Cabinet runs follow the codes on sheet A-2 (B27, SB36,
// W3642 ...); the rest is sized like the real thing. All in plan feet, like
// plan.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as P from './plan.js';

const { FT, wx, wy, wz } = P;
const D2R = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------------------------------------------------------------- frames

// A run against a wall. s runs along the wall, d out from the wall face into
// the room, h up from the floor. `face` is the way the fronts look.
function wallFrame(face, wall) {
  const sign = face[0] === '+' ? 1 : -1;
  const alongX = face[1] === 'y';
  const pt = (s, d) => (alongX ? [s, wall + sign * d] : [wall + sign * d, s]);
  return {
    pt,
    box(b, s0, s1, d0, d1, h0, h1, m, opts) {
      const a = pt(s0, d0), c = pt(s1, d1);
      b.pbox([Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])], h0, h1, m, opts);
    },
    // a local frame (see place) standing at (s, d), facing out of the wall
    at(s, d) {
      const [x, y] = pt(s, d);
      const dir = alongX ? (sign > 0 ? 90 : -90) : (sign > 0 ? 0 : 180);
      return place(x, y, dir);
    },
  };
}

// A free-standing piece: origin on the floor at plan (cx, cy), facing `dir`
// in plan degrees (0 = +x, 90 = +y). Local units are feet: x across, y up,
// z forward.
function place(cx, cy, dir) {
  const theta = Math.atan2(Math.cos(dir * D2R), -Math.sin(dir * D2R));
  const M = new THREE.Matrix4().compose(new THREE.Vector3(wx(cx), 0, wz(cy)),
    new THREE.Quaternion().setFromAxisAngle(UP, theta), new THREE.Vector3(FT, FT, FT));
  return new Local(M);
}

// A round bowl with a wall, rim at y = 0: a closed solid, so its inside
// never shows as a back face.
function bowlGeo(r, seg, t = 0.04) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([r * Math.sin(a), -r * Math.cos(a)]); }
  for (let i = 8; i >= 0; i--) { const a = (i / 8) * Math.PI / 2; pts.push([(r - t) * Math.sin(a), -(r - t) * Math.cos(a)]); }
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

class Local {
  constructor(M) { this.M = M; }
  // child frame: offset (x, y, z) and a turn about the vertical (degrees)
  sub(x, y, z, turn = 0, tilt = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * D2R, turn * D2R, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    return new Local(this.M.clone().multiply(m));
  }
  geo(b, g, m, opts = {}, local = null) {
    b.geo(g, local ? this.M.clone().multiply(local) : this.M, m, opts);
    g.dispose();
  }
  box(b, x0, x1, y0, y1, z0, z1, m, { r = 0, rot = null, edges = true } = {}) {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    const g = r > 0 ? new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(r, sx / 2.05, sy / 2.05, sz / 2.05)) : new THREE.BoxGeometry(sx, sy, sz);
    const m4 = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]).map((a) => a * D2R))), new THREE.Vector3(1, 1, 1));
    this.geo(b, g, m, { edges: r > 0 || !edges ? 0 : 1 }, m4);
  }
  cyl(b, x, z, y0, y1, r, m, { seg = 16, r1 = r, edges = false } = {}) {
    const g = new THREE.CylinderGeometry(r, r1, y1 - y0, seg).translate(x, (y0 + y1) / 2, z);
    this.geo(b, g, m, { edges: edges ? 40 : 0 });
  }
}

// ---------------------------------------------------------------- casework

const BASE_TOP = 2.9, TOP = 3.0, TOE = 0.33, DEPTH = 2.0, UP0 = 4.6, UP1 = 8.1, STACK = 9.5;

// A shaker door or drawer front on a run: slab with a raised frame.
function face(b, fr, s0, s1, h0, h1, d, paint) {
  fr.box(b, s0, s1, d, d + 0.05, h0, h1, paint);
  const rw = Math.min(0.22, (s1 - s0) * 0.18, (h1 - h0) * 0.24);
  fr.box(b, s0, s0 + rw, d + 0.05, d + 0.075, h0, h1, paint, { edges: false });
  fr.box(b, s1 - rw, s1, d + 0.05, d + 0.075, h0, h1, paint, { edges: false });
  fr.box(b, s0 + rw, s1 - rw, d + 0.05, d + 0.075, h0, h0 + rw, paint, { edges: false });
  fr.box(b, s0 + rw, s1 - rw, d + 0.05, d + 0.075, h1 - rw, h1, paint, { edges: false });
}
function bar(b, fr, sm, h, d, len, hw) {          // horizontal pull
  fr.box(b, sm - len / 2, sm + len / 2, d + 0.12, d + 0.16, h - 0.025, h + 0.025, hw, { edges: false });
  for (const s of [sm - len / 2 + 0.03, sm + len / 2 - 0.03]) fr.box(b, s - 0.02, s + 0.02, d + 0.07, d + 0.13, h - 0.02, h + 0.02, hw, { edges: false });
}
function vbar(b, fr, s, hm, d, len, hw) {         // vertical pull
  fr.box(b, s - 0.025, s + 0.025, d + 0.12, d + 0.16, hm - len / 2, hm + len / 2, hw, { edges: false });
  for (const h of [hm - len / 2 + 0.03, hm + len / 2 - 0.03]) fr.box(b, s - 0.02, s + 0.02, d + 0.07, d + 0.13, h - 0.02, h + 0.02, hw, { edges: false });
}

// Base cabinets. mods: [width, type], types: door, drawers, sink, usink,
// dw, bev, blank. Returns nothing; counters are laid by `counter`.
function baseRun(b, fr, s0, mods, k) {
  const df = DEPTH - 0.08;   // face plane
  let s = s0;
  for (const [w, type] of mods) {
    const a = s, e = s + w, g = 0.012;
    s = e;
    fr.box(b, a, e, 0, DEPTH - 0.33, 0, TOE, k.toe || k.paint, { edges: false });
    fr.box(b, a, e, 0, df, TOE, BASE_TOP, k.paint);
    if (type === 'blank') { face(b, fr, a + g, e - g, TOE + 0.04, BASE_TOP - 0.04, df, k.paint); continue; }
    if (type === 'dw') {
      fr.box(b, a + g, e - g, df, df + 0.1, TOE + 0.02, BASE_TOP - 0.03, 'steel');
      bar(b, fr, (a + e) / 2, BASE_TOP - 0.25, df + 0.02, w - 0.4, 'steel');
      continue;
    }
    if (type === 'bev') {
      fr.box(b, a + g, e - g, df, df + 0.08, TOE + 0.02, BASE_TOP - 0.03, 'steel');
      fr.box(b, a + 0.15, e - 0.15, df + 0.08, df + 0.09, TOE + 0.2, BASE_TOP - 0.2, 'darkGlass', { edges: false });
      for (let h = TOE + 0.6; h < BASE_TOP - 0.3; h += 0.5) fr.box(b, a + 0.2, e - 0.2, 0.3, df, h, h + 0.04, 'steel', { edges: false });
      vbar(b, fr, e - 0.12, 1.6, df + 0.02, 1.4, k.hw);
      continue;
    }
    if (type === 'drawers') {
      const hs = [BASE_TOP - 0.04, BASE_TOP - 0.62, BASE_TOP - 1.52, TOE + 0.04];
      for (let i = 0; i < 3; i++) {
        face(b, fr, a + g, e - g, hs[i + 1] + g, hs[i] - g, df, k.paint);
        bar(b, fr, (a + e) / 2, hs[i] - (i === 0 ? 0.28 : 0.3), df, Math.min(0.8, w * 0.4), k.hw);
      }
      continue;
    }
    if (type === 'sink' || type === 'usink') {
      // false front where the sink sits, a pair of doors under it
      const top = type === 'sink' ? BASE_TOP - 0.82 : BASE_TOP - 0.04;
      if (type === 'usink') face(b, fr, a + g, e - g, BASE_TOP - 0.6, BASE_TOP - 0.04, df, k.paint);
      const dTop = type === 'sink' ? top - 0.03 : BASE_TOP - 0.64;
      face(b, fr, a + g, (a + e) / 2 - g, TOE + 0.04, dTop, df, k.paint);
      face(b, fr, (a + e) / 2 + g, e - g, TOE + 0.04, dTop, df, k.paint);
      for (const sx of [(a + e) / 2 - 0.12, (a + e) / 2 + 0.12]) vbar(b, fr, sx, dTop - 0.45, df, 0.5, k.hw);
      if (type === 'sink') farmSink(b, fr, a, e, k);
      continue;
    }
    // door: a drawer over one or two doors
    face(b, fr, a + g, e - g, BASE_TOP - 0.58, BASE_TOP - 0.04, df, k.paint);
    bar(b, fr, (a + e) / 2, BASE_TOP - 0.31, df, Math.min(0.8, w * 0.4), k.hw);
    const two = w > 2.1;
    const leaves = two ? [[a, (a + e) / 2], [(a + e) / 2, e]] : [[a, e]];
    leaves.forEach(([la, le], i) => {
      face(b, fr, la + g, le - g, TOE + 0.04, BASE_TOP - 0.62, df, k.paint);
      const sx = two ? (i === 0 ? le - 0.14 : la + 0.14) : le - 0.14;
      vbar(b, fr, sx, BASE_TOP - 1.05, df, 0.5, k.hw);
    });
  }
}

// An apron-front fireclay sink, 33" in a 36" base, with a gooseneck faucet.
function farmSink(b, fr, a, e, k) {
  const s0 = a + 0.12, s1 = e - 0.12, d0 = 0.28, d1 = DEPTH + 0.02, h0 = BASE_TOP - 0.8, h1 = TOP;
  const t = 0.09;
  fr.box(b, s0, s1, d1 - t, d1, h0, h1, 'porcelain');          // apron
  fr.box(b, s0, s1, d0, d0 + t, h0, h1, 'porcelain', { edges: false });
  fr.box(b, s0, s0 + t, d0, d1, h0, h1, 'porcelain', { edges: false });
  fr.box(b, s1 - t, s1, d0, d1, h0, h1, 'porcelain', { edges: false });
  fr.box(b, s0, s1, d0, d1, h0, h0 + t, 'porcelain', { edges: false });
  fr.box(b, (s0 + s1) / 2 - 0.08, (s0 + s1) / 2 + 0.08, (d0 + d1) / 2 - 0.08, (d0 + d1) / 2 + 0.08, h0 + t, h0 + t + 0.005, 'steel', { edges: false });
  faucet(b, fr.at((a + e) / 2, 0.15), k.tap || 'hw', 0.9);
}

// A gooseneck on a deck at height h0; `rise` is the height of the arc.
function faucet(b, L, m, reach, h0 = TOP, rise = 1.25) {
  L.cyl(b, 0, 0, h0, h0 + 0.08, 0.09, m);
  L.cyl(b, 0, 0, h0 + 0.08, h0 + rise, 0.05, m);
  const arc = new THREE.TorusGeometry(reach / 2, 0.045, 8, 20, Math.PI).rotateY(Math.PI / 2);
  L.geo(b, arc, m, {}, new THREE.Matrix4().makeTranslation(0, h0 + rise, reach / 2));
  L.cyl(b, 0, reach, h0 + rise - 0.3, h0 + rise, 0.055, m);
  L.box(b, 0.12, 0.42, h0 + rise * 0.48, h0 + rise * 0.48 + 0.06, -0.03, 0.03, m, { edges: false });
}

// Countertop over a stretch of base, with an inch of overhang.
function counter(b, fr, s0, s1, k, { d1 = DEPTH + 0.08, hole = null } = {}) {
  const m = k.top || 'granite';
  if (!hole) return fr.box(b, s0, s1, 0, d1, BASE_TOP, TOP, m);
  const [ha, he, hd0, hd1] = hole;
  fr.box(b, s0, ha, 0, d1, BASE_TOP, TOP, m);
  fr.box(b, he, s1, 0, d1, BASE_TOP, TOP, m);
  fr.box(b, ha, he, 0, hd0, BASE_TOP, TOP, m, { edges: false });
  if (hd1 < d1) fr.box(b, ha, he, hd1, d1, BASE_TOP, TOP, m, { edges: false });
}

// Wall cabinets, 12" deep, from 4'-7" to 8'-1", then a stacked row of glass
// boxes and crown to the ceiling. mods: [width, door|glass].
function upperRun(b, fr, s0, mods, k, { stack = true, h0 = UP0, h1 = UP1 } = {}) {
  let s = s0;
  const df = 1.0, g = 0.012;
  for (const [w, type] of mods) {
    const a = s, e = s + w;
    s = e;
    fr.box(b, a, e, 0, df, h0, h1, k.paint);
    const two = w > 2.1;
    const leaves = two ? [[a, (a + e) / 2], [(a + e) / 2, e]] : [[a, e]];
    leaves.forEach(([la, le], i) => {
      if (type === 'glass') glassDoor(b, fr, la + g, le - g, h0 + g, h1 - g, df, k);
      else face(b, fr, la + g, le - g, h0 + g, h1 - g, df, k.paint);
      const sx = two ? (i === 0 ? le - 0.14 : la + 0.14) : la + 0.14;
      vbar(b, fr, sx, h0 + 0.5, df, 0.42, k.hw);
    });
    if (type === 'glass') dishes(b, fr, a, e, h0, h1, df, k.paint);
    if (stack) {
      fr.box(b, a, e, 0, df, h1 + 0.06, STACK, k.paint);
      for (const [la, le] of leaves) glassDoor(b, fr, la + g, le - g, h1 + 0.08, STACK - g, df, k);
    }
  }
  const top = stack ? STACK : h1;
  fr.box(b, s0, s, 0, df + 0.18, top, top + 0.42, k.paint);          // crown
  fr.box(b, s0, s, 0, df + 0.06, h0 - 0.08, h0, k.paint, { edges: false });   // light rail
}

function glassDoor(b, fr, s0, s1, h0, h1, d, k) {
  const rw = 0.2;
  fr.box(b, s0, s0 + rw, d, d + 0.07, h0, h1, k.paint);
  fr.box(b, s1 - rw, s1, d, d + 0.07, h0, h1, k.paint, { edges: false });
  fr.box(b, s0 + rw, s1 - rw, d, d + 0.07, h0, h0 + rw, k.paint, { edges: false });
  fr.box(b, s0 + rw, s1 - rw, d, d + 0.07, h1 - rw, h1, k.paint, { edges: false });
  fr.box(b, s0 + rw, s1 - rw, d + 0.03, d + 0.04, h0 + rw, h1 - rw, 'glass', { edges: false });
  if (h1 - h0 > 2) {                                   // a mullion grid, 2 x 3
    const sm = (s0 + s1) / 2;
    fr.box(b, sm - 0.025, sm + 0.025, d + 0.02, d + 0.06, h0 + rw, h1 - rw, k.paint, { edges: false });
    for (const t of [1 / 3, 2 / 3]) {
      const h = h0 + rw + (h1 - h0 - 2 * rw) * t;
      fr.box(b, s0 + rw, s1 - rw, d + 0.02, d + 0.06, h - 0.025, h + 0.025, k.paint, { edges: false });
    }
  }
}

// White dishes on two shelves behind glass.
function dishes(b, fr, a, e, h0, h1, df, paint) {
  const shelf = (h) => fr.box(b, a + 0.06, e - 0.06, 0.04, df - 0.05, h, h + 0.05, paint, { edges: false });
  const h1s = h0 + (h1 - h0) / 3, h2s = h0 + (2 * (h1 - h0)) / 3;
  shelf(h1s); shelf(h2s);
  for (let s = a + 0.45; s < e - 0.3; s += 0.62) {
    const L = fr.at(s, 0.5);
    L.cyl(b, 0, 0, h0 + 0.05, h0 + 0.42, 0.42, 'porcelain', { seg: 20 });
    L.cyl(b, 0, 0, h1s + 0.05, h1s + 0.5, 0.16, 'porcelain', { seg: 14, r1: 0.13 });
    L.cyl(b, 0, 0.0, h2s + 0.05, h2s + 0.3, 0.3, 'porcelain', { seg: 18, r1: 0.22 });
  }
}

// Subway tile between the counter and the wall cabinets.
function splash(b, fr, s0, s1, h1) {
  fr.box(b, s0, s1, 0, 0.03, TOP, h1, 'subway', { edges: false });
}

// ---------------------------------------------------------------- kitchen

const KIT = { paint: 'cab', hw: 'hw' };
const ISLAND = { paint: 'islandWood', hw: 'hw', toe: 'islandWood' };

function kitchen(b) {
  // the range wall, backing onto the pantry (x = 37.98), facing +x
  const L = wallFrame('+x', 37.98);
  baseRun(b, L, 19.8, [[2.3, 'door'], [2.3, 'drawers']], KIT);
  counter(b, L, 19.8, 24.4, KIT);
  range(b, L, 24.4, 27.4);
  baseRun(b, L, 27.4, [[2.3, 'drawers'], [2.2, 'door']], KIT);
  counter(b, L, 27.4, 31.9, KIT);
  splash(b, L, 19.8, 31.9, UP0 - 0.08);
  splash(b, L, 24.0, 27.8, 5.6);
  upperRun(b, L, 19.8, [[2.1, 'glass'], [2.1, 'door']], KIT);
  upperRun(b, L, 27.8, [[2.1, 'door'], [2.0, 'glass']], KIT);
  hood(b, L, 24.0, 27.8);
  fridge(b, L, 31.9, 35.5);

  // the sink wall, under the 3034 window (rear wall, y = 42.34), facing -y
  const R = wallFrame('-y', 42.34);
  baseRun(b, R, 38.0, [[3.0, 'drawers'], [2.4, 'door'], [3.0, 'sink'], [2.0, 'dw'], [3.4, 'door']], KIT);
  counter(b, R, 38.0, 43.4, KIT);
  counter(b, R, 43.4, 46.4, KIT, { hole: [43.52, 46.28, 0.28, DEPTH + 0.1] });
  counter(b, R, 46.4, 51.8, KIT);
  splash(b, R, 38.0, 43.1, UP0 - 0.08);
  splash(b, R, 46.7, 51.8, UP0 - 0.08);
  splash(b, R, 43.1, 46.7, 4.55);
  upperRun(b, R, 38.0, [[3.0, 'door'], [2.1, 'glass']], KIT);
  upperRun(b, R, 46.7, [[2.1, 'glass'], [3.0, 'door']], KIT);
  R.box(b, 43.1, 46.7, 0, 1.0, UP1 + 0.3, STACK + 0.42, 'cab');       // valance over the window

  // the island: cabinets face the range, stools on the living side
  const I = wallFrame('-x', 46.0);
  baseRun(b, I, 22.6, [[1.75, 'door'], [1.8, 'dw'], [3.0, 'usink'], [1.5, 'drawers'], [2.15, 'door']], ISLAND);
  I.box(b, 22.6, 32.8, -0.08, 0, TOE, BASE_TOP, 'islandWood');               // back panel
  for (let s = 22.6; s < 32.7; s += 10.2 / 4) face(b, wallFrame('+x', 46.0), s + 0.04, s + 10.2 / 4 - 0.04, TOE + 0.1, BASE_TOP - 0.1, 0.08, 'islandWood');
  for (const y of [22.4, 32.8]) b.pbox([43.9, y, 47.95, y + 0.2], 0, BASE_TOP, 'islandWood');
  const sinkC = 26.15 + 1.5;
  // the island top, 1 3/4" thick, with a hole for the prep sink
  const it = (x0, y0, x1, y1, e) => b.pbox([x0, y0, x1, y1], BASE_TOP, TOP + 0.05, 'granite', { edges: e });
  it(43.8, 22.3, 48.05, sinkC - 0.75); it(43.8, sinkC + 0.75, 48.05, 33.1);
  it(43.8, sinkC - 0.75, 44.35, sinkC + 0.75, false); it(45.65, sinkC - 0.75, 48.05, sinkC + 0.75, false);
  // undermount prep sink: a steel basin under a hole in the top
  b.pbox([44.35, sinkC - 0.75, 45.65, sinkC + 0.75], BASE_TOP - 0.7, BASE_TOP - 0.65, 'steel', { edges: false });
  for (const [x0, y0, x1, y1] of [[44.35, sinkC - 0.75, 45.65, sinkC - 0.7], [44.35, sinkC + 0.7, 45.65, sinkC + 0.75],
    [44.35, sinkC - 0.75, 44.4, sinkC + 0.75], [45.6, sinkC - 0.75, 45.65, sinkC + 0.75]]) b.pbox([x0, y0, x1, y1], BASE_TOP - 0.7, BASE_TOP, 'steel', { edges: false });
  faucet(b, place(45.85, sinkC, 180), 'hw', 0.7);
  // a bowl of lemons and a cutting board
  const bowl = place(46.6, 30.6, 0);
  bowl.geo(b, bowlGeo(0.45, 20), 'ceramic', {}, new THREE.Matrix4().makeTranslation(0, TOP + 0.48, 0));
  const lr = rng(5);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1, rr = i === 5 ? 0 : 0.2;
    bowl.geo(b, new THREE.SphereGeometry(0.11, 10, 8).scale(1, 0.85, 0.85), 'lemon', {},
      new THREE.Matrix4().makeTranslation(Math.cos(a) * rr, TOP + 0.24 + (i === 5 ? 0.1 : 0) + lr() * 0.02, Math.sin(a) * rr));
  }
  b.pbox([44.2, 23.4, 45.6, 25.2], TOP + 0.03, TOP + 0.11, 'walnut');

  // four counter stools facing the island
  for (const y of [23.85, 26.45, 29.05, 31.65]) stool(b, place(48.95, y, 180));

  // recessed cans
}

// A 36" pro range: stainless, oven window, knobs, cast iron grates.
function range(b, fr, s0, s1) {
  const d = DEPTH + 0.05;
  fr.box(b, s0, s1, 0, d, 0, TOP, 'steel');
  fr.box(b, s0 + 0.08, s1 - 0.08, d, d + 0.06, 0.62, 2.3, 'steel');
  fr.box(b, s0 + 0.5, s1 - 0.5, d + 0.06, d + 0.065, 1.0, 1.95, 'darkGlass', { edges: false });
  bar(b, fr, (s0 + s1) / 2, 2.15, d, s1 - s0 - 0.5, 'steel');
  fr.box(b, s0 + 0.08, s1 - 0.08, d, d + 0.05, 0.12, 0.55, 'steel', { edges: false });
  for (let i = 0; i < 6; i++) {
    const L = fr.at(s0 + 0.35 + i * (s1 - s0 - 0.7) / 5, d);
    L.geo(b, new THREE.CylinderGeometry(0.08, 0.08, 0.1, 14).rotateX(Math.PI / 2), 'hw', {},
      new THREE.Matrix4().makeTranslation(0, 2.6, 0.05));
  }
  fr.box(b, s0, s1, 0, 0.3, TOP, TOP + 0.35, 'steel');
  for (const sa of [s0 + 0.08, (s0 + s1) / 2 + 0.02]) {
    for (const da of [0.4, 1.2]) {
      fr.box(b, sa, sa + (s1 - s0) / 2 - 0.1, da, da + 0.75, TOP, TOP + 0.06, 'hw', { edges: false });
      const L = fr.at(sa + (s1 - s0) / 4 - 0.05, da + 0.37);
      L.cyl(b, 0, 0, TOP + 0.06, TOP + 0.1, 0.16, 'castIron', { seg: 12 });
    }
  }
}

// A plaster hood with a cedar band, tapering into a chimney to the ceiling.
function hood(b, fr, s0, s1) {
  const h0 = 5.6, band = 0.42, h1 = 7.5, d0 = 2.0, sc0 = s0 + 0.55, sc1 = s1 - 0.55, dc = 1.25;
  fr.box(b, s0, s1, 0, d0, h0, h0 + band, 'beam');
  // taper: front face leans back, sides narrow
  const p = (s, d, h) => { const [x, y] = fr.pt(s, d); return [x, y, h]; };
  const hb = h0 + band;
  const c = p((s0 + s1) / 2, d0 / 2, (hb + h1) / 2);
  b.ppoly([p(s0, d0, hb), p(s1, d0, hb), p(sc1, dc, h1), p(sc0, dc, h1)], 'drywall', c);
  b.ppoly([p(s0, 0, hb), p(s0, d0, hb), p(sc0, dc, h1), p(sc0, 0, h1)], 'drywall', c);
  b.ppoly([p(s1, d0, hb), p(s1, 0, hb), p(sc1, 0, h1), p(sc1, dc, h1)], 'drywall', c);
  fr.box(b, sc0, sc1, 0, dc, h1, P.PLATE, 'drywall');
  fr.box(b, s0, s1, 0, d0, h0 - 0.01, h0, 'darkGlass', { edges: false });
}

// A 36" French door refrigerator between full-height panels, a cabinet over.
function fridge(b, fr, s0, s1) {
  const k = KIT;
  fr.box(b, s0, s0 + 0.2, 0, DEPTH + 0.1, 0, STACK, 'cab');
  fr.box(b, s1 - 0.2, s1, 0, DEPTH + 0.1, 0, STACK, 'cab');
  const a = s0 + 0.22, e = s1 - 0.22, m = (a + e) / 2, d = DEPTH - 0.1;
  fr.box(b, a, e, 0, d, 0, 6.95, 'steel');
  fr.box(b, a, m - 0.01, d, d + 0.14, 2.6, 6.9, 'steel');
  fr.box(b, m + 0.01, e, d, d + 0.14, 2.6, 6.9, 'steel');
  fr.box(b, a, e, d, d + 0.14, 0.25, 2.56, 'steel');
  for (const s of [m - 0.14, m + 0.14]) vbar(b, fr, s, 4.6, d + 0.06, 2.6, 'steel');
  bar(b, fr, m, 2.3, d + 0.06, e - a - 0.6, 'steel');
  fr.box(b, a, e, 0, DEPTH + 0.02, 7.0, STACK, k.paint);
  face(b, fr, a + 0.01, m - 0.01, 7.02, STACK - 0.02, DEPTH - 0.06, k.paint);
  face(b, fr, m + 0.01, e - 0.01, 7.02, STACK - 0.02, DEPTH - 0.06, k.paint);
  for (const s of [m - 0.14, m + 0.14]) vbar(b, fr, s, 7.4, DEPTH - 0.06, 0.42, k.hw);
  fr.box(b, s0, s1, 0, DEPTH + 0.25, STACK, STACK + 0.42, k.paint);
}

// A counter stool: wood seat with a low back on black steel legs.
function stool(b, L) {
  const h = 2.15;
  for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    L.box(b, x - 0.04, x + 0.04, 0, h - 0.05, z - 0.04, z + 0.04, 'hw', { edges: false });
  }
  for (const z of [-0.55, 0.55]) L.box(b, -0.55, 0.55, 0.75, 0.8, z - 0.03, z + 0.03, 'hw', { edges: false });
  for (const x of [-0.55, 0.55]) L.box(b, x - 0.03, x + 0.03, 0.75, 0.8, -0.55, 0.55, 'hw', { edges: false });
  L.box(b, -0.66, 0.66, h - 0.1, h + 0.05, -0.66, 0.62, 'walnut', { r: 0.05 });
  for (const x of [-0.58, 0.58]) L.box(b, x - 0.04, x + 0.04, h, h + 1.05, -0.62, -0.54, 'hw', { edges: false });
  L.box(b, -0.66, 0.66, h + 0.72, h + 1.1, -0.66, -0.56, 'walnut', { r: 0.04, rot: [-8, 0, 0] });
}

// ---------------------------------------------------------------- living

function living(b) {
  const F = wallFrame('-x', 75.2);
  // fireplace mass, 8' wide, 2'-4" deep, floor to ceiling
  const f0 = 27.6, f1 = 35.5, fd = 2.33, o0 = 29.9, o1 = 33.2, oh0 = 0.55, oh1 = 3.05, ceil = 11;
  F.box(b, f0, o0, 0, fd, 0, ceil, 'fireBrick');
  F.box(b, o1, f1, 0, fd, 0, ceil, 'fireBrick');
  F.box(b, o0, o1, 0, fd, oh1, ceil, 'fireBrick');
  F.box(b, o0, o1, 0, fd, 0, oh0, 'fireBrick');
  // the firebox, sooty, set back a foot and a half
  F.box(b, o0, o1, 0.5, 0.9, oh0, oh1, 'soot', { edges: false });
  F.box(b, o0, o0 + 0.06, 0.9, fd, oh0, oh1, 'soot', { edges: false });
  F.box(b, o1 - 0.06, o1, 0.9, fd, oh0, oh1, 'soot', { edges: false });
  F.box(b, o0, o1, 0.9, fd, oh1 - 0.06, oh1, 'soot', { edges: false });
  F.box(b, o0, o1, 0.9, fd, oh0, oh0 + 0.02, 'soot', { edges: false });
  // raised hearth and a cedar beam mantel
  F.box(b, f0 - 0.3, f1 + 0.3, fd, fd + 1.6, 0, oh0, 'hearth');
  F.box(b, f0 - 0.35, f1 + 0.35, fd, fd + 0.85, 5.0, 5.6, 'beam');
  // logs on a grate; the flames are built separately (fire)
  const G = F.at((o0 + o1) / 2, 1.5);
  for (const x of [-0.9, 0.9]) G.box(b, x - 0.04, x + 0.04, oh0 + 0.02, oh0 + 0.35, -0.5, 0.45, 'castIron', { edges: false });
  const log = (x, y, z, len, r, rz, ry) => {
    G.geo(b, new THREE.CylinderGeometry(r, r * 1.08, len, 10).rotateZ(Math.PI / 2 + rz).rotateY(ry), 'logs', {},
      new THREE.Matrix4().makeTranslation(x, y, z));
  };
  log(0, oh0 + 0.42, -0.15, 2.4, 0.2, 0.05, 0.1);
  log(0.1, oh0 + 0.42, 0.25, 2.2, 0.18, -0.04, -0.08);
  log(-0.1, oh0 + 0.72, 0.05, 2.0, 0.16, 0.12, 0.3);
  // a painting over the mantel
  const art = F.at((f0 + f1) / 2, fd);
  art.box(b, -2.05, 2.05, 6.0, 8.95, 0, 0.12, 'hw');
  art.geo(b, new THREE.PlaneGeometry(3.85, 2.7), 'art', { keepUV: true }, new THREE.Matrix4().makeTranslation(0, 7.475, 0.125));
  // lanterns on the mantel
  for (const s of [f0 + 0.6, f1 - 0.6]) {
    const Lm = F.at(s, fd + 0.42);
    Lm.box(b, -0.2, 0.2, 5.6, 5.64, -0.2, 0.2, 'hw', { edges: false });
    Lm.cyl(b, 0, 0, 5.64, 6.3, 0.17, 'glass', { seg: 4 });
    Lm.cyl(b, 0, 0, 5.64, 5.95, 0.06, 'bulb', { seg: 10 });
    Lm.box(b, -0.22, 0.22, 6.3, 6.38, -0.22, 0.22, 'hw', { edges: false });
  }

  // built-ins either side: painted bases with an oak top, floating shelves
  const books = rng(17);
  for (const [s0, s1] of [[20.8, 27.6], [35.5, 42.34]]) {
    const w = (s1 - s0) / 2;
    baseRun(b, F, s0, [[w, 'door'], [w, 'door']], { paint: 'cab', hw: 'hw' });
    F.box(b, s0, s1, 0, DEPTH + 0.06, BASE_TOP, BASE_TOP + 0.16, 'oak');
    for (const h of [4.4, 5.75, 7.1, 8.45]) {
      F.box(b, s0 + 0.15, s1 - 0.15, 0, 1.15, h, h + 0.17, 'oak');
      // books, a vase or a basket on each shelf
      let s = s0 + 0.3 + books() * 0.6;
      while (s < s1 - 0.9) {
        const kind = books();
        if (kind < 0.55) {
          const len = 0.8 + books() * 1.2, hh = 0.75 + books() * 0.25;
          F.box(b, s, Math.min(s1 - 0.3, s + len), 0.15, 0.85, h + 0.17, h + 0.17 + hh, 'books', { edges: false });
          s += len + 0.35 + books() * 0.5;
        } else if (kind < 0.8) {
          const V = F.at(s + 0.3, 0.6);
          const tall = 0.6 + books() * 0.5;
          V.geo(b, new THREE.LatheGeometry([[0, 0], [0.22, 0.02], [0.3, tall * 0.4], [0.16, tall * 0.85], [0.12, tall], [0, tall]]
            .map(([x, y]) => new THREE.Vector2(x, y)), 16), books() > 0.5 ? 'ceramic' : 'pottery', {},
          new THREE.Matrix4().makeTranslation(0, h + 0.17, 0));
          s += 0.9 + books() * 0.4;
        } else {
          F.box(b, s, s + 0.95, 0.15, 1.0, h + 0.17, h + 0.75, 'basket', { r: 0.06 });
          s += 1.3 + books() * 0.3;
        }
      }
    }
  }

  // the rug, a herringbone wool with a darker border
  b.pbox([57.0, 24.4, 70.6, 38.8], 0, 0.035, 'rugBorder', { edges: false });
  b.pbox([57.5, 24.9, 70.1, 38.3], 0, 0.04, 'rug');

  // sofa facing the fireplace
  sofa(b, place(59.4, 31.55, 0), 8.6);
  // two leather club chairs facing each other by the hearth
  clubChair(b, place(69.2, 24.9, 90));
  clubChair(b, place(69.2, 38.2, -90));
  // coffee table: oak slab on a walnut base, a tray and a few books
  const T = place(64.3, 31.55, 0);
  T.box(b, -2.3, 2.3, 1.2, 1.42, -1.35, 1.35, 'oak', { r: 0.04 });
  for (const z of [-1.05, 1.05]) T.box(b, -1.95, 1.95, 0, 1.2, z - 0.2, z + 0.2, 'walnut');
  T.box(b, -1.95, 1.95, 0.3, 0.42, -0.85, 0.85, 'walnut');
  T.box(b, -1.2, -0.2, 1.42, 1.62, -0.6, 0.4, 'books', { edges: false });
  T.box(b, 0.3, 1.5, 1.42, 1.47, -0.55, 0.55, 'hw', { edges: false });
  T.geo(b, new THREE.LatheGeometry([[0, 0], [0.18, 0.01], [0.2, 0.3], [0.1, 0.62], [0.08, 0.7], [0, 0.7]].map(([x, y]) => new THREE.Vector2(x, y)), 16),
    'ceramic', {}, new THREE.Matrix4().makeTranslation(0.9, 1.47, 0));
  foliage(b, T.sub(0.9, 2.1, 0), 7, 0.35, 21);
  // a side table and lamp at the sofa's far end
  for (const y of [37.0]) {
    const S = place(59.4, y, 0);
    S.cyl(b, 0, 0, 0, 2.0, 0.85, 'walnut', { seg: 24, edges: true });
    S.cyl(b, 0, 0, 2.0, 2.06, 0.9, 'walnut', { seg: 24 });
    tableLamp(b, S.sub(0, 2.06, 0));
  }
  // a fiddle-leaf fig by the slider
  plant(b, place(54.6, 40.4, 0), 6.5, 31);
}

function sofa(b, L, len) {
  const hl = len / 2, d0 = -1.6, d1 = 1.6, arm = 0.75;
  for (const x of [-hl + 0.3, hl - 0.3]) for (const z of [d0 + 0.3, d1 - 0.3]) L.box(b, x - 0.12, x + 0.12, 0, 0.35, z - 0.12, z + 0.12, 'walnut', { edges: false });
  L.box(b, -hl, hl, 0.35, 1.25, d0, d1, 'sofa', { r: 0.12 });
  for (const s of [-1, 1]) L.box(b, s > 0 ? hl - arm : -hl, s > 0 ? hl : -hl + arm, 0.35, 2.2, d0, d1, 'sofa', { r: 0.28 });
  L.box(b, -hl + arm, hl - arm, 1.2, 2.7, d0, d0 + 0.85, 'sofa', { r: 0.2 });
  const n = 3, cw = (len - 2 * arm) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -hl + arm + i * cw;
    L.box(b, x0 + 0.03, x0 + cw - 0.03, 1.22, 1.85, d0 + 0.8, d1 + 0.05, 'sofa', { r: 0.2 });
    const back = L.sub(x0 + cw / 2, 1.85, d0 + 0.95, 0, -12);
    back.box(b, -cw / 2 + 0.04, cw / 2 - 0.04, -0.15, 1.35, -0.42, 0.42, 'sofa', { r: 0.25 });
  }
  // throw pillows
  const pil = [[-hl + arm + 0.8, 'pillowA', 14, 10], [-hl + arm + 1.9, 'pillowB', -8, 8], [hl - arm - 0.85, 'pillowA', -14, 10]];
  for (const [x, m, turn, tilt] of pil) {
    L.sub(x, 2.45, d0 + 1.35, turn, -tilt).box(b, -0.75, 0.75, -0.7, 0.7, -0.22, 0.22, m, { r: 0.2 });
  }
  // a knit throw over the arm
  L.box(b, hl - arm - 0.1, hl + 0.05, 1.7, 2.28, -0.6, 0.9, 'throw', { r: 0.1 });
}

function clubChair(b, L, m = 'leather') {
  for (const x of [-1.05, 1.05]) for (const z of [-1.05, 1.05]) L.box(b, x - 0.1, x + 0.1, 0, 0.3, z - 0.1, z + 0.1, 'walnut', { edges: false });
  L.box(b, -1.3, 1.3, 0.3, 1.15, -1.3, 1.3, m, { r: 0.12 });
  for (const s of [-1, 1]) L.box(b, s * 1.3 - (s > 0 ? 0.55 : 0), s * 1.3 + (s > 0 ? 0 : 0.55), 0.3, 2.05, -1.3, 1.3, m, { r: 0.24 });
  L.box(b, -0.78, 0.78, 1.0, 2.75, -1.3, -0.6, m, { r: 0.22 });
  L.box(b, -0.76, 0.76, 1.12, 1.6, -0.62, 1.32, m, { r: 0.18 });
}

function tableLamp(b, L) {
  L.geo(b, new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.34, 0.25], [0.3, 0.8], [0.12, 1.05], [0.05, 1.1], [0, 1.1]].map(([x, y]) => new THREE.Vector2(x, y)), 18), 'pottery');
  L.cyl(b, 0, 0, 1.1, 1.6, 0.025, 'brass', { seg: 8 });
  L.cyl(b, 0, 0, 1.35, 2.15, 0.48, 'lampShade', { seg: 24, r1: 0.6 });
}

// Leaves as a cluster of flattened lumps.
function foliage(b, L, n, size, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rr = r() * size * 1.4, y = (r() - 0.3) * size * 1.6;
    const g = new THREE.IcosahedronGeometry(size * (0.6 + r() * 0.5), 0).scale(1, 0.45, 1.3);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 1.2 - 0.6, r() * 6.3, r() * 1.2 - 0.6)), new THREE.Vector3(1, 1, 1));
    L.geo(b, g, 'greenery', {}, m);
  }
}

function plant(b, L, height, seed) {
  L.geo(b, new THREE.LatheGeometry([[0, 0], [0.7, 0], [0.85, 1.5], [0.9, 1.6], [0.0, 1.6]].map(([x, y]) => new THREE.Vector2(x, y)), 20), 'pottery');
  L.cyl(b, 0, 0, 1.3, height - 1.0, 0.05, 'logs', { seg: 6 });
  foliage(b, L.sub(0, height - 1.4, 0), 14, 0.55, seed);
  foliage(b, L.sub(0.15, height - 2.6, 0.1), 7, 0.5, seed + 1);
}

// ---------------------------------------------------------------- dining

function dining(b) {
  b.pbox([40.0, 2.3, 50.0, 14.0], 0, 0.035, 'rug2Border', { edges: false });
  b.pbox([40.45, 2.75, 49.55, 13.55], 0, 0.04, 'rug2');
  // a plank-top trestle table, 4' x 9'
  const T = place(45.2, 8.65, 90);
  T.box(b, -2.0, 2.0, 2.38, 2.55, -4.45, 4.45, 'tableOak');
  for (const z of [-3.25, 3.25]) {
    T.box(b, -1.55, 1.55, 0, 0.28, z - 0.25, z + 0.25, 'tableOak');
    T.box(b, -0.5, 0.5, 0.28, 2.2, z - 0.16, z + 0.16, 'tableOak');
    T.box(b, -1.75, 1.75, 2.2, 2.38, z - 0.2, z + 0.2, 'tableOak');
  }
  T.box(b, -0.14, 0.14, 1.0, 1.35, -3.1, 3.1, 'tableOak');
  // ten chairs: linen side chairs, leather at the ends
  for (const z of [-3.225, -1.075, 1.075, 3.225]) {
    diningChair(b, place(42.35, 8.65 + z, 0), 'chairLinen');
    diningChair(b, place(48.05, 8.65 + z, 180), 'chairLinen');
  }
  diningChair(b, place(45.2, 3.25, 90), 'leather');
  diningChair(b, place(45.2, 14.05, -90), 'leather');
  // a runner, candlesticks and a low bowl of greens on the table
  T.box(b, -0.6, 0.6, 2.55, 2.56, -3.8, 3.8, 'throw', { edges: false });
  T.geo(b, bowlGeo(0.6, 20), 'ceramic', {}, new THREE.Matrix4().makeTranslation(0, 3.15, 0));
  foliage(b, T.sub(0, 3.2, 0), 9, 0.32, 41);
  for (const z of [-1.6, 1.6]) {
    T.cyl(b, 0, z, 2.56, 3.3, 0.06, 'brass', { seg: 10, r1: 0.12 });
    T.cyl(b, 0, z, 3.3, 3.95, 0.05, 'candle', { seg: 10 });
  }
  // linen drapery either side of the front windows
  drapery(b, wallFrame('+y', 0.83), 40.0, 49.8, [[40.3, 41.95], [47.85, 49.5]]);
}

// Linen drapery on an iron rod: panels of soft folds either side of a
// window. fr is a wall frame; the rod runs from s0 to s1 along it.
function drapery(b, fr, s0, s1, panels, top = 9.4) {
  const d = 0.28;
  fr.box(b, s0, s1, d - 0.03, d + 0.04, top - 0.08, top, 'hw', { edges: false });
  for (const s of [s0, s1]) fr.at(s, d).geo(b, new THREE.SphereGeometry(0.1, 10, 8), 'hw', {}, new THREE.Matrix4().makeTranslation(0, top - 0.04, 0));
  for (const [p0, p1] of panels) {
    const n = 6, w = (p1 - p0) / n, len = top - 0.2;
    for (let i = 0; i < n; i++) {
      const L = fr.at(p0 + (i + 0.5) * w, d + 0.14);
      L.geo(b, new THREE.CylinderGeometry(w * 0.62, w * 0.62, len, 10, 1, false, 0, Math.PI).scale(1, 1, 0.6), 'drape', {},
        new THREE.Matrix4().makeTranslation(0, len / 2 + 0.05, i % 2 ? -0.05 : 0.05).multiply(new THREE.Matrix4().makeRotationY(i % 2 ? Math.PI : 0)));
    }
  }
}

function diningChair(b, L, fabric) {
  for (const [x, z] of [[-0.62, -0.6], [0.62, -0.6], [-0.62, 0.62], [0.62, 0.62]]) {
    L.box(b, x - 0.07, x + 0.07, 0, 1.3, z - 0.07, z + 0.07, 'walnut', { edges: false });
  }
  L.box(b, -0.78, 0.78, 1.28, 1.62, -0.78, 0.8, fabric, { r: 0.1 });
  L.sub(0, 1.55, -0.68, 0, -6).box(b, -0.76, 0.76, 0, 2.0, -0.12, 0.12, fabric, { r: 0.1 });
}

// ---------------------------------------------------------------- pantry

const PAN = { paint: 'pantryPaint', hw: 'brass', tap: 'brass' };

function pantry(b) {
  // the long wall (x = 27.6), facing the door
  const L = wallFrame('+x', 27.6);
  baseRun(b, L, 12.13, [[2.0, 'blank'], [3.0, 'drawers'], [3.0, 'door'], [2.0, 'bev'], [2.47, 'door'], [3.0, 'drawers']], PAN);
  counter(b, L, 12.13, 27.6, PAN);
  splash(b, L, 14.2, 27.6, UP0 - 0.08);
  upperRun(b, L, 14.2, [[2.6, 'glass'], [2.7, 'glass'], [2.7, 'glass'], [2.7, 'glass'], [2.7, 'glass']], PAN);
  // under the window (front, y = 12.13)
  const Fw = wallFrame('+y', 12.13);
  baseRun(b, Fw, 29.6, [[1.5, 'door'], [3.0, 'sink'], [3.5, 'door']], PAN);
  counter(b, Fw, 29.6, 31.1, PAN);
  counter(b, Fw, 31.1, 34.1, PAN, { hole: [31.22, 33.98, 0.28, DEPTH + 0.1] });
  counter(b, Fw, 34.1, 37.6, PAN);
  splash(b, Fw, 29.6, 37.6, 3.95);
  // tall pantry cabinets and a coffee station on the kitchen wall
  const K = wallFrame('-x', 37.6);
  for (const [s0, s1] of [[19.2, 21.7], [21.7, 24.2]]) {
    K.box(b, s0, s1, 0, DEPTH - 0.08, 0, STACK, PAN.paint);
    face(b, K, s0 + 0.012, s1 - 0.012, 0.05, 4.6, DEPTH - 0.08, PAN.paint);
    face(b, K, s0 + 0.012, s1 - 0.012, 4.64, STACK - 0.02, DEPTH - 0.08, PAN.paint);
    vbar(b, K, s1 - 0.15, 4.0, DEPTH - 0.08, 1.0, 'brass');
  }
  K.box(b, 19.2, 24.2, 0, DEPTH + 0.1, STACK, STACK + 0.42, PAN.paint);
  baseRun(b, K, 24.2, [[3.4, 'door']], PAN);
  counter(b, K, 24.2, 27.6, PAN);
  for (const h of [4.6, 5.9]) K.box(b, 24.4, 27.4, 0, 1.0, h, h + 0.15, 'oak');
  const cm = K.at(25.4, 1.0);
  cm.box(b, -0.45, 0.45, TOP, TOP + 1.25, -0.6, 0.4, 'steel', { r: 0.06 });
  cm.box(b, -0.36, 0.36, TOP + 0.3, TOP + 0.9, 0.38, 0.42, 'darkGlass', { edges: false });
  // a runner down the middle
  b.pbox([31.4, 15.2, 34.0, 26.6], 0, 0.035, 'rug2');
}

// The pantry door, 2'-10" two-panel shaker, painted, standing open.
export function pantryDoor(materials, ink, BatchCls) {
  const w = P.intWalls.find((q) => q.open.some((o) => o.kind === 'door' && o.at === 17.0 && q.r[0] === 37.6));
  const o = w.open.find((q) => q.at === 17.0);
  const b = new BatchCls();
  const lw = o.w - 0.12, t = 0.146, H = 6.6;
  // leaf in local metres: hinge at the origin, the leaf runs along -z
  const L = new Local(new THREE.Matrix4().makeScale(FT, FT, FT));
  const st = 0.38;
  L.box(b, 0, t, 0, H, -lw, -lw + st, 'trim');
  L.box(b, 0, t, 0, H, -st, 0, 'trim');
  for (const [h0, h1] of [[0, 0.8], [3.0, 3.55], [H - 0.4, H]]) L.box(b, 0, t, h0, h1, -lw + st, -st, 'trim');
  for (const [h0, h1] of [[0.8, 3.0], [3.55, H - 0.4]]) L.box(b, 0.03, t - 0.03, h0, h1, -lw + st, -st, 'trim', { edges: false });
  for (const x of [-0.12, t + 0.12]) L.geo(b, new THREE.SphereGeometry(0.11, 12, 8), 'brass', {}, new THREE.Matrix4().makeTranslation(x, 3.0, -lw + 0.25));
  const leaf = b.toObject(materials, ink);
  const pivot = new THREE.Group();
  pivot.position.set(wx(w.r[0] + 0.02), 0, wz(o.at - o.w / 2 + 0.06));
  pivot.add(leaf);
  pivot.rotation.y = 100 * D2R;
  return pivot;
}

// ---------------------------------------------------------------- rear porch

function porch(b) {
  // a tongue-and-groove cedar ceiling under the white soffit
  const [rx0, ry0, rx1, ry1] = P.porches.rear.r;
  // a closed board: seen from above before the roof lands, an open one
  // would show its back face
  b.pbox([rx0, ry0, rx1, ry1 - 0.5], 9.8, 9.83, 'porchCeiling', { edges: false });
  // an outdoor sofa against the house and a pair of lounge chairs
  const S = place(49.9, 50.6, 0);
  outdoorSofa(b, S, 7.2);
  for (const [y, dir] of [[47.4, 160], [53.8, -160]]) {
    const C = place(57.0, y, dir);
    C.box(b, -1.35, 1.35, 0.3, 0.95, -1.3, 1.3, 'teak');
    for (const s of [-1, 1]) C.box(b, s * 1.2 - 0.15, s * 1.2 + 0.15, 0, 2.0, -1.3, 1.3, 'teak');
    C.box(b, -1.05, 1.05, 0.95, 1.5, -1.25, 1.3, 'cushion', { r: 0.15 });
    C.sub(0, 1.45, -1.0, 0, -14).box(b, -1.0, 1.0, 0, 1.55, -0.25, 0.25, 'cushion', { r: 0.18 });
  }
  const T = place(53.6, 50.6, 0);
  T.box(b, -1.2, 1.2, 1.3, 1.45, -2.0, 2.0, 'teak');
  for (const x of [-1.0, 1.0]) for (const z of [-1.8, 1.8]) T.box(b, x - 0.1, x + 0.1, 0, 1.3, z - 0.1, z + 0.1, 'teak', { edges: false });
  T.geo(b, new THREE.LatheGeometry([[0, 0], [0.35, 0], [0.45, 0.6], [0.4, 0.75], [0, 0.75]].map(([x, y]) => new THREE.Vector2(x, y)), 16), 'pottery', {},
    new THREE.Matrix4().makeTranslation(0, 1.45, 0));
  foliage(b, T.sub(0, 2.4, 0), 8, 0.35, 61);

  // two rockers facing the yard, with a little table between
  for (const x of [67.4, 71.6]) rocker(b, place(x, 54.6, 90));
  const st = place(69.5, 55.0, 90);
  st.cyl(b, 0, 0, 0, 1.6, 0.8, 'teak', { seg: 20, edges: true });
  st.cyl(b, 0, 0, 1.6, 1.7, 0.85, 'teak', { seg: 20 });

  // ferns in black planters either side of the slider
  for (const x of [54.4, 71.6]) {
    const Pl = place(x, 44.6, 90);
    Pl.geo(b, new THREE.LatheGeometry([[0, 0], [0.75, 0], [0.95, 1.8], [1.0, 1.9], [0, 1.9]].map(([u, v]) => new THREE.Vector2(u, v)), 20), 'planter');
    foliage(b, Pl.sub(0, 2.2, 0), 16, 0.5, x);
  }
  // lanterns on the wall, like the front porch
  const R = wallFrame('+y', 43.17);
  for (const s of [56.0, 70.0]) {
    R.box(b, s - 0.08, s + 0.08, 0.02, 0.12, 5.7, 6.6, 'lamp', { edges: false });
    R.box(b, s - 0.26, s + 0.26, 0.1, 0.62, 5.55, 5.62, 'lamp', { edges: false });
    R.box(b, s - 0.26, s + 0.26, 0.1, 0.62, 6.55, 6.85, 'lamp');
    R.box(b, s - 0.22, s + 0.22, 0.14, 0.58, 5.62, 6.55, 'lampGlass', { edges: false });
  }
}

function outdoorSofa(b, L, len) {
  const hl = len / 2;
  L.box(b, -hl, hl, 0.25, 0.95, -1.5, 1.5, 'teak');
  for (const s of [-1, 1]) L.box(b, s * hl - (s > 0 ? 0.4 : 0), s * hl + (s > 0 ? 0 : 0.4), 0, 2.1, -1.5, 1.5, 'teak');
  L.box(b, -hl + 0.4, hl - 0.4, 0.25, 2.6, -1.5, -1.15, 'teak');
  for (let i = 0; i < 3; i++) {
    const cw = (len - 0.8) / 3, x0 = -hl + 0.4 + i * cw;
    L.box(b, x0 + 0.02, x0 + cw - 0.02, 0.95, 1.5, -1.15, 1.5, 'cushion', { r: 0.15 });
    L.sub(x0 + cw / 2, 1.45, -0.95, 0, -12).box(b, -cw / 2 + 0.04, cw / 2 - 0.04, 0, 1.45, -0.25, 0.25, 'cushion', { r: 0.2 });
  }
  L.sub(-hl + 1.2, 2.0, -0.55, 18, -12).box(b, -0.7, 0.7, -0.65, 0.65, -0.2, 0.2, 'pillowB', { r: 0.18 });
  L.sub(hl - 1.2, 2.0, -0.55, -18, -12).box(b, -0.7, 0.7, -0.65, 0.65, -0.2, 0.2, 'pillowA', { r: 0.18 });
}

function rocker(b, L) {
  // curved runners: arcs of a big circle
  for (const x of [-0.9, 0.9]) {
    const g = new THREE.TorusGeometry(5.5, 0.07, 6, 24, 0.62).rotateZ(-Math.PI / 2 - 0.31).rotateY(Math.PI / 2);
    L.geo(b, g, 'rockerPaint', {}, new THREE.Matrix4().makeTranslation(x, 5.6, 0.0));
  }
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    L.box(b, x - 0.07, x + 0.07, 0.15, z < 0 ? 3.9 : 2.1, z - 0.07, z + 0.07, 'rockerPaint', { edges: false });
  }
  L.box(b, -1.0, 1.0, 1.35, 1.5, -1.0, 1.0, 'rockerPaint');
  for (const x of [-0.95, 0.95]) L.box(b, x - 0.12, x + 0.12, 2.1, 2.2, -1.0, 1.15, 'rockerPaint');
  for (let i = 0; i < 5; i++) {
    const x = -0.7 + i * 0.35;
    L.sub(x, 1.5, -0.95, 0, -10).box(b, -0.09, 0.09, 0, 2.3, -0.03, 0.03, 'rockerPaint', { edges: false });
  }
  L.sub(0, 3.75, -1.25, 0, -10).box(b, -0.95, 0.95, 0, 0.3, -0.05, 0.05, 'rockerPaint');
  L.box(b, -0.85, 0.85, 1.5, 1.7, -0.9, 0.9, 'cushion', { r: 0.08 });
}

// ---------------------------------------------------------------- doors

// An interior leaf standing open: two-panel shaker, painted, hinged at plan
// (hx, hy) on the face of the wall it swings to, the open leaf pointing
// `dir` (plan degrees).
function doorLeaf(b, hx, hy, dir, w, { h = 6.6, m = 'trim' } = {}) {
  const L = place(hx, hy, dir - 90);        // local +x runs along the leaf
  const t = 0.073, st = 0.38;
  L.box(b, 0, st, 0, h, -t, t, m);
  L.box(b, w - st, w, 0, h, -t, t, m);
  for (const [h0, h1] of [[0, 0.8], [3.0, 3.55], [h - 0.4, h]]) L.box(b, st, w - st, h0, h1, -t, t, m);
  for (const [h0, h1] of [[0.8, 3.0], [3.55, h - 0.4]]) L.box(b, st, w - st, h0, h1, -t + 0.03, t - 0.03, m, { edges: false });
  for (const z of [-t - 0.1, t + 0.1]) L.geo(b, new THREE.SphereGeometry(0.1, 12, 8), 'hw', {}, new THREE.Matrix4().makeTranslation(w - 0.25, 3.0, z));
}

// A frameless glass shower door, closed, with a black pull and hinges.
function showerDoor(b, hx, hy, dir, w, h = 6.6) {
  const L = place(hx, hy, dir - 90);
  L.box(b, 0, w, 0.1, h, -0.02, 0.02, 'glass', { edges: false });
  for (const [x0, x1, h0, h1] of [[0, w, 0.1, 0.16], [0, w, h - 0.06, h], [0, 0.06, 0.1, h], [w - 0.06, w, 0.1, h]]) L.box(b, x0, x1, h0, h1, -0.025, 0.025, 'hw', { edges: false });
  for (const hh of [1.2, h - 1.2]) L.box(b, -0.05, 0.18, hh - 0.2, hh + 0.2, -0.05, 0.05, 'hw', { edges: false });
  L.box(b, w - 0.32, w - 0.27, 2.6, 4.4, 0.06, 0.1, 'hw', { edges: false });
  for (const hh of [2.7, 4.3]) L.box(b, w - 0.32, w - 0.27, hh - 0.025, hh + 0.025, 0.02, 0.06, 'hw', { edges: false });
}

// ---------------------------------------------------------------- master bedroom

function masterBedroom(b) {
  // a wool rug under the bed, then the bed against the wall that backs onto
  // the yard, a nightstand either side
  b.pbox([18.4, 47.0, 27.6, 58.4], 0, 0.035, 'rug3Border', { edges: false });
  b.pbox([18.8, 47.4, 27.2, 58.0], 0, 0.04, 'rug3');
  bed(b, place(29.07, 52.7, 180));
  const books = rng(53);
  for (const [y, k] of [[48.0, 0], [57.4, 1]]) {
    const N = place(29.07, y, 180);
    nightstand(b, N);
    tableLamp(b, N.sub(k ? -0.35 : 0.35, 2.2, 0.7));
    if (k === 0) {
      for (let i = 0; i < 3; i++) N.sub(-0.5, 2.2 + i * 0.12, 0.85, books() * 30 - 15).box(b, -0.33, 0.33, 0, 0.11, -0.45, 0.45, 'books', { edges: false });
    } else {
      N.geo(b, new THREE.LatheGeometry([[0, 0], [0.14, 0], [0.16, 0.3], [0, 0.3]].map(([x, yy]) => new THREE.Vector2(x, yy)), 14), 'ceramic', {},
        new THREE.Matrix4().makeTranslation(0.5, 2.2, 1.0));
    }
  }
  // an upholstered bench at the foot of the bed
  const Bn = place(20.9, 52.7, 180);
  for (const x of [-2.2, 2.2]) for (const z of [-0.5, 0.5]) Bn.box(b, x - 0.07, x + 0.07, 0, 1.05, z - 0.07, z + 0.07, 'walnut', { edges: false });
  Bn.box(b, -2.4, 2.4, 1.0, 1.55, -0.7, 0.7, 'leather', { r: 0.1 });

  // the dresser on the bath wall, with the marsh painting over it
  const W = wallFrame('+x', 13.78);
  dresser(b, W, 44.6, 50.6);
  const art = W.at(47.6, 0.02);
  art.box(b, -2.45, 2.45, 4.1, 7.3, 0, 0.12, 'hw');
  art.geo(b, new THREE.PlaneGeometry(4.7, 3.0), 'art2', { keepUV: true }, new THREE.Matrix4().makeTranslation(0, 5.7, 0.125));
  const vase = W.at(49.6, 0.85);
  vase.geo(b, new THREE.LatheGeometry([[0, 0], [0.2, 0.02], [0.28, 0.4], [0.14, 0.95], [0.12, 1.1], [0, 1.1]].map(([x, y]) => new THREE.Vector2(x, y)), 16),
    'pottery', {}, new THREE.Matrix4().makeTranslation(0, 2.85, 0));
  foliage(b, vase.sub(0, 4.4, 0), 9, 0.4, 71);
  W.box(b, 45.2, 46.3, 0.4, 1.3, 2.85, 3.05, 'books', { edges: false });
  W.box(b, 45.35, 46.2, 0.5, 1.2, 3.05, 3.18, 'books', { edges: false });

  // a pair of linen chairs between the rear windows, a lamp table between
  clubChair(b, place(19.8, 59.9, -55), 'chairLinen');
  clubChair(b, place(23.9, 59.9, -125), 'chairLinen');
  const T = place(21.85, 60.95, 0);
  T.cyl(b, 0, 0, 0, 1.9, 0.12, 'hw', { seg: 10 });
  T.cyl(b, 0, 0, 0, 0.06, 0.6, 'hw', { seg: 18 });
  T.cyl(b, 0, 0, 1.9, 1.98, 0.8, 'walnut', { seg: 24, edges: true });
  tableLamp(b, T.sub(0, 1.98, 0));
  // drapes at both rear windows
  const R = wallFrame('-y', 62.3);
  drapery(b, R, 14.1, 18.7, [[14.15, 15.35], [17.45, 18.65]]);
  drapery(b, R, 24.6, 28.95, [[24.65, 25.85], [27.75, 28.9]]);
  // the door in from the hall, open against the end wall
  doorLeaf(b, 28.95, 43.41, 90, 2.55);
}

// A bed: a tall upholstered headboard (or an oak one), a white duvet over a
// deep mattress, shams and pillows, a throw across the foot. L stands at the
// middle of the head wall, z toward the foot. The default is a king.
function bed(b, L, { hw = 3.4, len = 7.1, head = 'headboard', wood = false, duvet = 'bedding', cover = 'bedThrow', lumbar = 'pillowB', shams = 3 } = {}) {
  if (wood) {
    // an oak panel headboard between square posts, oak side rails
    for (const x of [-hw - 0.05, hw + 0.05]) L.box(b, x - 0.18, x + 0.18, 0, 4.6, 0.04, 0.4, head);
    L.box(b, -hw + 0.13, hw - 0.13, 1.2, 4.2, 0.12, 0.3, head);
    L.box(b, -hw - 0.2, hw + 0.2, 4.6, 4.75, 0.0, 0.45, head);
    for (const x of [-hw - 0.05, hw + 0.05]) L.box(b, x - 0.12, x + 0.12, 0, 1.4, len - 0.24, len + 0.06, head);
    L.box(b, -hw, hw, 0.6, 1.2, len - 0.18, len, head);
    for (const x of [-hw + 0.02, hw - 0.02]) L.box(b, x - 0.08, x + 0.08, 0.6, 1.2, 0.4, len - 0.18, head);
  } else {
    L.box(b, -hw - 0.15, hw + 0.15, 0, 5.4, 0.02, 0.5, head, { r: 0.14 });
    L.box(b, -hw, hw, 0.35, 1.2, 0.5, len, head, { r: 0.08 });
    for (const x of [-hw + 0.25, hw - 0.25]) L.box(b, x - 0.1, x + 0.1, 0, 0.35, len - 0.35, len - 0.15, 'walnut', { edges: false });
  }
  L.box(b, -hw + 0.1, hw - 0.1, 1.2, 2.0, 0.55, len - 0.08, 'bedding', { r: 0.14 });
  // the duvet falls over the sides and the foot; its top is folded back
  L.box(b, -hw - 0.06, hw + 0.06, 1.0, 2.14, 2.2, len + 0.04, duvet, { r: 0.2 });
  L.box(b, -hw - 0.02, hw + 0.02, 2.04, 2.3, 2.2, 3.1, 'bedding', { r: 0.12 });
  L.box(b, -hw - 0.1, hw + 0.1, 1.3, 2.22, len - 2.1, len + 0.1, cover, { r: 0.1 });
  // euro shams against the headboard, two pillows, a lumbar
  const sw = (2 * hw - 0.4) / shams;
  for (let i = 0; i < shams; i++) L.sub(-hw + 0.2 + sw * (i + 0.5), 2.0, 0.85, 0, -10).box(b, -sw / 2 + 0.02, sw / 2 - 0.02, 0, 2.1, -0.24, 0.24, 'bedding', { r: 0.22 });
  for (const x of [-hw * 0.46, hw * 0.46]) L.sub(x, 2.0, 1.5, 0, -38).box(b, -hw * 0.43, hw * 0.43, 0, 1.5, -0.22, 0.22, 'bedding', { r: 0.22 });
  L.sub(0, 2.05, 2.05, 0, -22).box(b, -1.1, 1.1, 0, 0.95, -0.17, 0.17, lumbar, { r: 0.15 });
}

function nightstand(b, L) {
  for (const x of [-0.95, 0.95]) for (const z of [0.1, 1.45]) L.box(b, x - 0.06, x + 0.06, 0, 0.35, z - 0.06, z + 0.06, 'walnut', { edges: false });
  L.box(b, -1.1, 1.1, 0.35, 2.2, 0, 1.55, 'islandWood');
  for (const [h0, h1] of [[0.45, 1.2], [1.28, 2.08]]) {
    L.box(b, -1.0, 1.0, h0, h1, 1.55, 1.6, 'islandWood', { edges: false });
    L.box(b, -0.3, 0.3, (h0 + h1) / 2 - 0.025, (h0 + h1) / 2 + 0.025, 1.64, 1.69, 'brass', { edges: false });
    for (const x of [-0.27, 0.27]) L.box(b, x - 0.02, x + 0.02, (h0 + h1) / 2 - 0.02, (h0 + h1) / 2 + 0.02, 1.6, 1.65, 'brass', { edges: false });
  }
}

// A six-foot walnut dresser: three columns of three slab drawers.
function dresser(b, fr, s0, s1) {
  const d = 1.75, top = 2.85;
  fr.box(b, s0, s1, 0, d, 0.3, top, 'islandWood');
  fr.box(b, s0 + 0.15, s1 - 0.15, 0, d - 0.15, 0, 0.3, 'islandWood', { edges: false });
  const cw = (s1 - s0) / 3;
  for (let i = 0; i < 3; i++) {
    for (const [h0, h1] of [[0.38, 1.18], [1.2, 2.0], [2.02, 2.78]]) {
      const a = s0 + i * cw + 0.012, e = s0 + (i + 1) * cw - 0.012;
      fr.box(b, a, e, d, d + 0.04, h0, h1, 'islandWood', { edges: false });
      bar(b, fr, (a + e) / 2, (h0 + h1) / 2 + 0.15, d - 0.04, 0.7, 'brass');
    }
  }
}

// ---------------------------------------------------------------- master bath

const VAN = { paint: 'vanityOak', hw: 'hw', top: 'marbleTop' };

function masterBath(b) {
  // two vanities on the bedroom wall, either side of the double doors
  const V = wallFrame('-x', 13.4);
  for (const [s0, s1] of [[45.68, 50.6], [57.3, 62.3]]) {
    const side = (s1 - s0 - 2.2) / 2, c = (s0 + s1) / 2;
    baseRun(b, V, s0, [[side, 'drawers'], [2.2, 'usink'], [side, 'drawers']], VAN);
    counter(b, V, s0, s1, VAN);
    V.box(b, s0, s1, 0, 0.05, TOP, TOP + 0.4, 'marbleTop', { edges: false });
    // a white vessel basin and a black gooseneck
    V.at(c, 1.1).geo(b, new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.62, 0.16], [0.72, 0.4], [0.74, 0.5], [0.68, 0.5], [0.65, 0.42],
      [0.55, 0.2], [0.38, 0.08], [0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y)), 32), 'porcelain', {}, new THREE.Matrix4().makeTranslation(0, TOP, 0));
    faucet(b, V.at(c, 0.25), 'hw', 0.8, TOP, 1.05);
    // a mirror in a black frame, a sconce either side
    V.box(b, c - 1.3, c + 1.3, 0, 0.1, 4.1, 7.5, 'hw');
    V.box(b, c - 1.2, c + 1.2, 0.1, 0.11, 4.2, 7.4, 'mirror', { edges: false });
    for (const s of [c - 1.85, c + 1.85]) sconce(b, V.at(s, 0), 6.1);
  }
  // bath mats in front of the vanities
  for (const [y0, y1] of [[46.4, 49.9], [58.0, 61.5]]) b.pbox([9.0, y0, 11.0, y1], 0, 0.04, 'bathMat', { edges: false });

  // a freestanding oval tub under the 4040 window, a floor-mounted filler
  const tub = new THREE.LatheGeometry([[0, 0], [0.95, 0], [1.12, 0.12], [1.22, 0.6], [1.29, 1.6], [1.3, 1.9], [1.2, 1.9], [1.17, 1.6],
    [1.06, 0.62], [0.9, 0.42], [0, 0.4]].map(([x, y]) => new THREE.Vector2(x, y)), 40).scale(1.12, 1, 2.0);
  place(2.4, 54.04, 90).geo(b, tub, 'porcelain', { edges: 40 });
  faucet(b, place(4.45, 55.2, 180), 'hw', 0.95, 0, 3.1);
  // the tub alcove is tiled to the ceiling like the shower, round the window
  const tileTo = P.PLATE - 0.02;
  const A = (r, h0, h1) => b.pbox(r, h0, h1, 'showerTile', { edges: false });
  A([0.83, 51.18, 0.86, 51.8], 0, tileTo); A([0.83, 55.8, 0.86, 56.9], 0, tileTo);
  A([0.83, 51.8, 0.86, 55.8], 0, 4.0); A([0.83, 51.8, 0.86, 55.8], 8.0, tileTo);
  A([0.86, 51.18, 4.58, 51.21], 0, tileTo); A([0.86, 56.87, 4.58, 56.9], 0, tileTo);
  // a teak stool with folded towels, a towel on a hook by the shower
  const St = place(4.55, 52.3, 0);
  St.cyl(b, 0, 0, 0, 1.45, 0.55, 'teak', { seg: 20, edges: true });
  St.box(b, -0.45, 0.45, 1.45, 1.6, -0.35, 0.35, 'towel', { r: 0.05 });
  St.box(b, -0.42, 0.42, 1.6, 1.75, -0.33, 0.33, 'towel', { r: 0.05 });
  const H = wallFrame('+x', 4.58);
  H.box(b, 57.9, 58.0, 0, 0.25, 5.5, 5.6, 'hw', { edges: false });
  H.box(b, 57.35, 58.55, 0.05, 0.2, 3.0, 5.55, 'towel', { r: 0.05 });

  // the shower: hex mosaic floor, stacked tile to the ceiling, a marble
  // bench, rain head and hand shower, and a glass door
  const [x0, y0, x1, y1] = [0.83, 57.28, 4.2, 62.3], tk = 0.03, top = tileTo;
  b.pbox([x0, y0, x1, y1], 0, 0.02, 'mosaic', { edges: false });
  b.pbox([x0, y0, x0 + tk, y1], 0, top, 'showerTile', { edges: false });
  b.pbox([x0, y1 - tk, x1, y1], 0, top, 'showerTile', { edges: false });
  b.pbox([x0, y0, x1, y0 + tk], 0, top, 'showerTile', { edges: false });
  b.pbox([x1 - tk, y0, x1, 58.65], 0, top, 'showerTile', { edges: false });
  b.pbox([x1 - tk, 61.15, x1, y1], 0, top, 'showerTile', { edges: false });
  b.pbox([x1 - tk, 58.65, x1, 61.15], 6.67, top, 'showerTile', { edges: false });
  b.pbox([4.2, 58.65, 4.58, 61.15], 0, 0.3, 'marbleTop');
  b.pbox([x0 + tk, y0 + tk, x1 - tk, 58.5], 0, 1.5, 'showerTile');
  b.pbox([x0 + tk, y0 + tk, x1 - tk, 58.6], 1.5, 1.62, 'marbleTop');
  const S = wallFrame('-y', y1 - tk);
  S.box(b, 2.45, 2.55, 0, 1.3, 7.2, 7.3, 'hw', { edges: false });
  S.at(2.5, 1.3).cyl(b, 0, 0, 7.05, 7.12, 0.45, 'hw', { seg: 24 });
  S.at(2.5, 0).geo(b, new THREE.CylinderGeometry(0.28, 0.28, 0.05, 20).rotateX(Math.PI / 2), 'hw', {}, new THREE.Matrix4().makeTranslation(0, 4.0, 0.03));
  S.box(b, 2.47, 2.53, 0.04, 0.42, 3.97, 4.03, 'hw', { edges: false });
  S.box(b, 3.3, 3.36, 0.03, 0.12, 3.6, 6.4, 'hw', { edges: false });
  S.at(3.33, 0.18).cyl(b, 0, 0, 5.0, 5.9, 0.07, 'hw', { seg: 10 });
  showerDoor(b, 4.39, 58.72, 90, 2.36);

  // the toilet room
  toilet(b, place(2.5, 45.68, 90));
  const Tp = wallFrame('+x', 0.83);
  Tp.box(b, 47.85, 47.95, 0, 0.35, 2.25, 2.33, 'hw', { edges: false });
  Tp.at(47.6, 0.3).geo(b, new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16).rotateX(Math.PI / 2).rotateY(Math.PI / 2), 'porcelain', {},
    new THREE.Matrix4().makeTranslation(0, 2.05, 0));
  const Sh = wallFrame('+y', 45.68);
  Sh.box(b, 1.4, 3.6, 0, 0.75, 4.9, 5.0, 'oak');
  foliage(b, Sh.at(2.0, 0.35).sub(0, 5.35, 0), 5, 0.22, 83);
  Sh.at(2.0, 0.35).cyl(b, 0, 0, 5.0, 5.35, 0.18, 'pottery', { seg: 12 });

  // doors: the pair from the bedroom, the toilet room, the closet
  doorLeaf(b, 13.4, 51.98, 180, 1.94);
  doorLeaf(b, 13.4, 55.82, 180, 1.94);
  doorLeaf(b, 4.58, 49.7, -15, 2.2);
  doorLeaf(b, 5.43, 45.68, 90, 2.86);
}

function sconce(b, L, h) {
  L.cyl(b, 0, 0.03, h - 0.35, h + 0.15, 0.16, 'brass', { seg: 14 });
  L.box(b, -0.03, 0.03, h - 0.03, h + 0.03, 0.05, 0.42, 'brass', { edges: false });
  L.cyl(b, 0, 0.45, h - 0.05, h + 0.45, 0.17, 'shadeIn', { seg: 16, r1: 0.22 });
}

// A one-piece elongated toilet, L at the wall, facing out.
function toilet(b, L) {
  L.box(b, -0.85, 0.85, 1.35, 2.55, 0.05, 0.72, 'porcelain', { r: 0.08 });
  L.box(b, -0.88, 0.88, 2.55, 2.64, 0.02, 0.76, 'porcelain', { r: 0.03 });
  L.box(b, 0.45, 0.65, 2.42, 2.47, 0.72, 0.76, 'hw', { edges: false });
  L.geo(b, new THREE.CylinderGeometry(0.42, 0.52, 1.0, 20).scale(1, 1, 1.5), 'porcelain', {}, new THREE.Matrix4().makeTranslation(0, 0.5, 1.35));
  L.geo(b, bowlGeo(0.72, 24, 0.06).scale(0.95, 0.55, 1.3), 'porcelain', {}, new THREE.Matrix4().makeTranslation(0, 1.38, 1.5));
  L.geo(b, new THREE.CylinderGeometry(0.72, 0.72, 0.07, 24).scale(0.97, 1, 1.33), 'porcelain', {}, new THREE.Matrix4().makeTranslation(0, 1.42, 1.52));
}

// ---------------------------------------------------------------- master closet

const GARMENTS = ['garmentA', 'garmentB', 'garmentC', 'garmentD', 'garmentE', 'garmentF'];

// Closet fittings on a wall frame: a rod of hanging clothes (long = dresses
// and coats), shelves, folded stacks and baskets, side panels.
function closetKit(b, seed) {
  const r = rng(seed);
  const pick = () => GARMENTS[Math.floor(r() * GARMENTS.length)];
  const rod = (fr, s0, s1, h, long) => {
    fr.box(b, s0, s1, 0.97, 1.03, h - 0.03, h + 0.03, 'brass', { edges: false });
    let s = s0 + 0.15;
    while (s < s1 - 0.15) {
      const t = 0.045 + r() * 0.06, len = long ? 3.4 + r() * 1.2 : 2.3 + r() * 0.7;
      const L = fr.at(s, 1.0);
      L.box(b, -t, t, h - len, h - 0.15, -0.72, 0.72, pick(), { r: 0.04 });
      fr.box(b, s - 0.015, s + 0.015, 0.95, 1.05, h - 0.15, h + 0.05, 'hw', { edges: false });
      s += 2 * t + 0.04 + r() * 0.08;
    }
  };
  const shelf = (fr, s0, s1, h, d = 1.7) => fr.box(b, s0, s1, 0, d, h, h + 0.08, 'cab');
  const stacks = (fr, s0, s1, h, d = 1.3) => {
    let s = s0 + 0.2;
    while (s < s1 - 1.1) {
      if (r() < 0.3) {
        fr.box(b, s, s + 1.1, 0.15, d, h + 0.08, h + 0.75, 'basket', { r: 0.05 });
      } else {
        const n = 3 + Math.floor(r() * 4);
        for (let i = 0; i < n; i++) fr.box(b, s + (r() - 0.5) * 0.06, s + 1.0 + (r() - 0.5) * 0.06, 0.2, d - 0.05, h + 0.08 + i * 0.14, h + 0.21 + i * 0.14, pick(), { edges: false });
      }
      s += 1.3 + r() * 0.25;
    }
  };
  const side = (fr, s, h0, h1) => fr.box(b, s, s + 0.08, 0, 1.75, h0, h1, 'cab');
  // pairs of shoes along a shelf
  const shoes = (fr, s0, s1, h) => {
    for (let s = s0 + 0.15; s < s1 - 0.6; s += 0.72) {
      const m = ['leather', 'hw', 'porcelain', 'leather'][Math.floor(r() * 4)];
      for (const o of [0, 0.27]) fr.box(b, s + o, s + o + 0.24, 0.15, 1.0, h + 0.08, h + 0.08 + 0.28 + r() * 0.1, m, { r: 0.06 });
    }
  };
  return { r, rod, shelf, stacks, side, shoes };
}

function masterCloset(b) {
  const { rod, shelf, stacks, side, shoes } = closetKit(b, 97);
  // the outside wall: long hang, then double hang to the corner
  const W = wallFrame('+x', 0.83);
  rod(W, 34.88, 38.5, 5.9, true);
  shelf(W, 34.88, 38.5, 6.2); stacks(W, 34.88, 38.5, 6.2);
  shelf(W, 34.88, 38.5, 7.8); stacks(W, 34.88, 38.5, 7.8);
  side(W, 38.5, 0, 9.0);
  rod(W, 38.58, 43.9, 3.4, false);
  rod(W, 38.58, 43.9, 7.1, false);
  shelf(W, 38.58, 43.9, 7.4); stacks(W, 38.58, 43.9, 7.4);
  shelf(W, 34.88, 43.9, 9.0);
  side(W, 43.9, 0, 9.0);
  // the storage wall: double hang
  const S = wallFrame('+y', 34.88);
  side(S, 2.82, 0, 9.0);
  rod(S, 2.9, 10.4, 3.4, false);
  rod(S, 2.9, 10.4, 7.1, false);
  shelf(S, 2.9, 10.4, 7.4); stacks(S, 2.9, 10.4, 7.4);
  shelf(S, 2.9, 10.4, 9.0);
  side(S, 10.4, 0, 9.0);

  // the bedroom wall: drawers under an oak top, open shelves of sweaters
  const E = wallFrame('-x', 13.4);
  baseRun(b, E, 37.4, [[2.63, 'drawers'], [2.63, 'drawers'], [2.64, 'drawers']], { paint: 'cab', hw: 'brass' });
  E.box(b, 37.4, 45.3, 0, DEPTH + 0.06, BASE_TOP, BASE_TOP + 0.15, 'oak');
  for (const h of [4.4, 5.7, 7.0, 8.3]) { shelf(E, 37.4, 45.3, h, 1.4); stacks(E, 37.4, 45.3, h, 1.1); }
  side(E, 37.4, BASE_TOP + 0.15, 9.0);
  E.box(b, 37.4, 45.3, 0, 1.4, 9.0, 9.08, 'cab');

  // shoes either side of the door from the bath
  const N = wallFrame('-y', 45.3);
  for (const [s0, s1] of [[2.95, 5.2], [8.5, 11.25]]) {
    for (let h = 0.4; h < 8.6; h += 1.05) {
      shelf(N, s0, s1, h, 1.2);
      shoes(N, s0, s1, h);
    }
    side(N, s0 - 0.08, 0, 9.0);
    side(N, s1, 0, 9.0);
  }

  // an island of drawers in the middle, an oak top
  const [ix0, iy0, ix1, iy1] = [4.85, 39.25, 9.35, 41.75];
  b.pbox([ix0 + 0.15, iy0 + 0.15, ix1 - 0.15, iy1 - 0.15], 0, TOE, 'cab', { edges: false });
  b.pbox([ix0, iy0, ix1, iy1], TOE, 2.85, 'cab');
  b.pbox([ix0 - 0.15, iy0 - 0.15, ix1 + 0.15, iy1 + 0.15], 2.85, 3.0, 'oak');
  for (const fr of [wallFrame('-y', iy1), wallFrame('+y', iy0)]) {
    const cw = (ix1 - ix0) / 3;
    for (let i = 0; i < 3; i++) {
      for (const [h0, h1] of [[TOE + 0.04, 1.2], [1.24, 2.02], [2.06, 2.8]]) {
        const a = ix0 + i * cw + 0.012, e = ix0 + (i + 1) * cw - 0.012;
        face(b, fr, a, e, h0, h1, iy1 - iy0, 'cab');
        bar(b, fr, (a + e) / 2, h1 - 0.25, iy1 - iy0, 0.6, 'brass');
      }
    }
  }
  const Ti = place(7.1, 40.5, -90);       // local x runs along the island
  Ti.box(b, -1.7, -0.5, 3.0, 3.08, -0.4, 0.4, 'leather', { r: 0.02 });
  Ti.geo(b, new THREE.LatheGeometry([[0, 0], [0.16, 0.02], [0.22, 0.35], [0.1, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)), 14),
    'ceramic', {}, new THREE.Matrix4().makeTranslation(1.6, 3.0, 0));
  foliage(b, Ti.sub(1.6, 4.1, 0), 7, 0.3, 89);
  // the door from the hall, open against the storage wall
  doorLeaf(b, 13.4, 34.96, 180, 2.55);
}

// ---------------------------------------------------------------- bedroom wing

// A round rod between two plan points [x, y, h], in feet.
function planRod(b, [x0, y0, h0], [x1, y1, h1], r, m) {
  const a = new THREE.Vector3(wx(x0), wy(h0), wz(y0)), d = new THREE.Vector3(wx(x1), wy(h1), wz(y1)).sub(a);
  const M = new THREE.Matrix4().compose(a.addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), new THREE.Vector3(1, 1, 1));
  const g = new THREE.CylinderGeometry(r * FT, r * FT, d.length(), 8);
  b.geo(g, M, m);
  g.dispose();
}

// Books standing along a shelf at height h, now and then a pot.
function shelfBooks(b, fr, s0, s1, h, d, r) {
  let s = s0 + 0.1 + r() * 0.3;
  while (s < s1 - 0.5) {
    if (r() < 0.8) {
      const len = Math.min(s1 - 0.1 - s, 0.5 + r() * 0.8), hh = 0.7 + r() * 0.3;
      fr.box(b, s, s + len, 0.1, d - 0.1, h, h + hh, 'books', { edges: false });
      s += len + 0.2 + r() * 0.4;
    } else {
      fr.at(s + 0.25, d / 2).geo(b, new THREE.LatheGeometry([[0, 0], [0.2, 0.02], [0.25, 0.3], [0.12, 0.55], [0, 0.55]]
        .map(([x, y]) => new THREE.Vector2(x, y)), 14), r() > 0.5 ? 'ceramic' : 'pottery', {}, new THREE.Matrix4().makeTranslation(0, h, 0));
      s += 0.75;
    }
  }
}

function floorLamp(b, L) {
  L.cyl(b, 0, 0, 0, 0.06, 0.45, 'hw', { seg: 18 });
  L.cyl(b, 0, 0, 0.06, 4.6, 0.03, 'brass', { seg: 8 });
  L.cyl(b, 0, 0, 4.25, 5.2, 0.6, 'lampShade', { seg: 24, r1: 0.72 });
}

// A framed print: L on the wall face, the picture centred at height h.
function framed(b, L, w, h, ht, art, m = 'hw') {
  L.box(b, -w / 2, w / 2, h - ht / 2, h + ht / 2, 0, 0.1, m);
  L.geo(b, new THREE.PlaneGeometry(w - 0.3, ht - 0.3), art, { keepUV: true }, new THREE.Matrix4().makeTranslation(0, h, 0.105));
}

// The three doors on each side of the wing: from the hall, the closet and
// bath 2. They stand open into the bedroom, hinged on the side away from
// the bed. hy is just off the wall face, dir the way the leaves point.
function wingDoors(b, hy, dir) {
  doorLeaf(b, 76.25, hy, dir, 2.55);
  doorLeaf(b, 80.76, hy, dir, 2.21);
  doorLeaf(b, 84.55, hy, dir, 2.55);
}

// Bedroom 2, at the back: a queen bed with a slate linen headboard against
// the end wall, a walnut dresser and a mirror on the living room wall, a
// sage chair and a floor lamp between the windows.
function bedroom2(b) {
  b.pbox([79.2, 30.9, 87.6, 40.1], 0, 0.035, 'rug4Border', { edges: false });
  b.pbox([79.6, 31.3, 87.2, 39.7], 0, 0.04, 'rug4');
  bed(b, place(88.92, 35.45, 180), { hw: 2.65, len: 6.9, head: 'headboard2', cover: 'bedThrow2', lumbar: 'pillowA', shams: 2 });
  for (const [y, k] of [[31.45, 0], [39.45, 1]]) {
    const N = place(88.92, y, 180);
    nightstand(b, N);
    tableLamp(b, N.sub(k ? -0.35 : 0.35, 2.2, 0.7));
    if (!k) N.sub(-0.5, 2.2, 0.85, 12).box(b, -0.33, 0.33, 0, 0.22, -0.45, 0.45, 'books', { edges: false });
  }
  const W = wallFrame('+x', 75.58);
  dresser(b, W, 33.4, 39.4);
  W.box(b, 35.2, 38.0, 0, 0.1, 3.9, 7.0, 'tableOak');
  W.box(b, 35.4, 37.8, 0.1, 0.11, 4.1, 6.8, 'mirror', { edges: false });
  tableLamp(b, W.at(34.2, 0.85).sub(0, 2.85, 0));
  W.box(b, 38.0, 39.0, 0.4, 1.3, 2.85, 2.9, 'hw', { edges: false });
  W.at(38.5, 0.85).geo(b, new THREE.LatheGeometry([[0, 0], [0.18, 0.02], [0.24, 0.35], [0.1, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)), 14),
    'ceramic', {}, new THREE.Matrix4().makeTranslation(0, 2.9, 0));
  foliage(b, W.at(38.5, 0.85).sub(0, 3.95, 0), 7, 0.3, 211);
  // the reading corner, and drapes at both windows
  clubChair(b, place(81.4, 40.15, -110), 'chairSage');
  floorLamp(b, place(83.7, 41.4, 0));
  const R = wallFrame('-y', 42.34);
  drapery(b, R, 75.95, 80.45, [[76.0, 77.2], [79.2, 80.4]]);
  drapery(b, R, 84.65, 88.75, [[84.7, 85.9], [87.6, 88.7]]);
  wingDoors(b, 28.85, 90);
}

// Bedroom 3, at the front: an oak bed under a sage quilt, a desk and shelves
// on the porch wall, a bookcase by the windows, a chest at the foot.
function bedroom3(b) {
  b.pbox([79.0, 2.9, 87.4, 12.7], 0, 0.035, 'rug5Border', { edges: false });
  b.pbox([79.4, 3.3, 87.0, 12.3], 0, 0.04, 'rug5');
  bed(b, place(88.92, 7.8, 180), { hw: 2.65, len: 6.9, head: 'tableOak', wood: true, duvet: 'quilt', cover: 'throw', lumbar: 'pillowA', shams: 2 });
  for (const [y, k] of [[3.75, 0], [11.85, 1]]) {
    const N = place(88.92, y, 180);
    nightstand(b, N);
    tableLamp(b, N.sub(k ? -0.35 : 0.35, 2.2, 0.7));
  }
  framed(b, wallFrame('-x', 88.92).at(7.8, 0.02), 3.6, 6.4, 2.4, 'art3', 'tableOak');
  // a blanket chest at the foot of the bed
  const C = place(80.85, 7.8, 0);
  C.box(b, -0.75, 0.75, 0.15, 1.75, -1.8, 1.8, 'walnut');
  C.box(b, -0.8, 0.8, 1.75, 1.85, -1.85, 1.85, 'walnut');
  for (const z of [-1.6, 1.6]) C.box(b, -0.7, 0.7, 0, 0.15, z - 0.15, z + 0.15, 'walnut', { edges: false });
  C.box(b, -0.7, 0.4, 1.85, 2.15, -0.9, 0.9, 'throw', { r: 0.08 });
  // the desk, a chair and two shelves of books over it
  const W = wallFrame('+x', 76.03), r = rng(223);
  W.box(b, 5.4, 9.6, 0, 2.0, 2.4, 2.55, 'tableOak');
  for (const s of [5.55, 9.45]) for (const d of [0.15, 1.85]) W.box(b, s - 0.08, s + 0.08, d - 0.08, d + 0.08, 0, 2.4, 'tableOak', { edges: false });
  W.box(b, 6.4, 8.6, 0.1, 1.9, 2.05, 2.4, 'tableOak');
  bar(b, W, 7.5, 2.22, 1.9, 0.6, 'brass');
  diningChair(b, place(78.75, 7.5, 180), 'chairLinen');
  tableLamp(b, W.at(9.0, 0.6).sub(0, 2.55, 0));
  W.box(b, 5.7, 6.6, 0.35, 1.15, 2.55, 2.85, 'books', { edges: false });
  for (const h of [4.9, 6.3]) {
    W.box(b, 5.6, 9.4, 0, 0.95, h, h + 0.1, 'tableOak');
    shelfBooks(b, W, 5.6, 9.4, h + 0.1, 0.95, r);
  }
  // a painted bookcase in the corner by the windows
  const F = wallFrame('+y', 0.83), [c0, c1] = [76.1, 78.3];
  for (const s of [c0, c1 - 0.08]) F.box(b, s, s + 0.08, 0, 1.2, 0, 6.8, 'cab');
  F.box(b, c0, c1, 0, 1.25, 6.72, 6.85, 'cab');
  F.box(b, c0 + 0.08, c1 - 0.08, 0, 1.2, 0, 0.35, 'cab');
  F.box(b, c0 + 0.08, c1 - 0.08, 0, 0.04, 0.35, 6.72, 'cab', { edges: false });
  for (const h of [1.9, 3.5, 5.1]) F.box(b, c0 + 0.08, c1 - 0.08, 0, 1.15, h, h + 0.07, 'cab');
  for (const h of [0.35, 1.97, 3.57, 5.17]) shelfBooks(b, F, c0 + 0.08, c1 - 0.08, h, 1.15, r);
  drapery(b, F, 78.35, 86.65, [[78.4, 79.6], [85.4, 86.6]]);
  wingDoors(b, 14.75, -90);
}

// The bedroom hall: a runner and a long print on the closet wall.
function bedHall(b) {
  b.pbox([76.55, 16.2, 78.25, 27.4], 0, 0.035, 'rug2Border', { edges: false });
  b.pbox([76.7, 16.35, 78.1, 27.25], 0, 0.04, 'rug2');
  framed(b, wallFrame('-x', 79.2).at(21.8, 0.02), 4.2, 5.6, 2.6, 'art3');
}

// The two closets between the bedrooms: double hang across the back, shelves
// of folded things and shoes down the bath side.
function wingClosets(b) {
  const { rod, shelf, stacks, side, shoes } = closetKit(b, 131);
  for (const [back, y, sideA, sideB] of [[wallFrame('-y', 20.0), 20.0, 15.25, 18.2], [wallFrame('+y', 23.98), 23.98, 25.2, 28.35]]) {
    rod(back, 79.62, 83.86, 3.4, false);
    rod(back, 79.62, 83.86, 7.1, false);
    shelf(back, 79.58, 83.9, 7.4); stacks(back, 79.58, 83.9, 7.4);
    shelf(back, 79.58, 83.9, 9.0);
    const S = wallFrame('-x', 83.9);
    for (const [h, k] of [[0.3, 0], [1.4, 0], [2.6, 1], [3.8, 1], [5.0, 1]]) {
      shelf(S, sideA, sideB, h, 1.15);
      if (k) stacks(S, sideA, sideB, h, 1.0); else shoes(S, sideA, sideB, h);
    }
    side(S, y > 22 ? sideA - 0.08 : sideB, 0, 6.2);
  }
}

// ---------------------------------------------------------------- bath 2

const NAVY = { paint: 'navyPaint', hw: 'brass', top: 'marbleTop' };

// A vanity with a rectangular undermount basin: a stack of drawers either
// side, a false front and two doors under the basin, a brass gooseneck.
function vanity(b, fr, s0, s1, k) {
  const df = DEPTH - 0.08, g = 0.012, c = (s0 + s1) / 2, a = c - 1.1, e = c + 1.1, bt = BASE_TOP - 0.6;
  baseRun(b, fr, s0, [[a - s0, 'drawers']], k);
  baseRun(b, fr, e, [[s1 - e, 'drawers']], k);
  fr.box(b, a, e, 0, DEPTH - 0.33, 0, TOE, k.paint, { edges: false });
  fr.box(b, a, e, 0, df, TOE, bt, k.paint);
  fr.box(b, a, e, df - 0.05, df, bt, BASE_TOP, k.paint);
  fr.box(b, a, e, 0, 0.05, bt, BASE_TOP, k.paint);
  face(b, fr, a + g, e - g, BASE_TOP - 0.6, BASE_TOP - 0.04, df, k.paint);
  face(b, fr, a + g, c - g, TOE + 0.04, BASE_TOP - 0.64, df, k.paint);
  face(b, fr, c + g, e - g, TOE + 0.04, BASE_TOP - 0.64, df, k.paint);
  for (const sx of [c - 0.12, c + 0.12]) vbar(b, fr, sx, BASE_TOP - 1.1, df, 0.5, k.hw);
  // the basin, seen through the hole in the top
  const [h0, h1, d0, d1] = [c - 0.85, c + 0.85, 0.45, 1.6], t = 0.05;
  fr.box(b, h0, h1, d0, d1, bt, bt + t, 'porcelain', { edges: false });
  fr.box(b, h0, h1, d0, d0 + t, bt, BASE_TOP, 'porcelain', { edges: false });
  fr.box(b, h0, h1, d1 - t, d1, bt, BASE_TOP, 'porcelain', { edges: false });
  fr.box(b, h0, h0 + t, d0, d1, bt, BASE_TOP, 'porcelain', { edges: false });
  fr.box(b, h1 - t, h1, d0, d1, bt, BASE_TOP, 'porcelain', { edges: false });
  fr.box(b, c - 0.08, c + 0.08, 1.0, 1.16, bt + t, bt + t + 0.005, 'steel', { edges: false });
  counter(b, fr, s0, s1, k, { hole: [h0, h1, d0, d1] });
  fr.box(b, s0, s1, 0, 0.05, TOP, TOP + 0.4, k.top, { edges: false });
  faucet(b, fr.at(c, 0.25), k.hw, 0.75, TOP, 1.0);
}

function bath2(b) {
  // a navy vanity at each end, one for each bedroom, a mirror and sconces
  const V = wallFrame('-x', 88.92);
  for (const [s0, s1] of [[15.2, 19.3], [24.35, 28.4]]) {
    const c = (s0 + s1) / 2;
    vanity(b, V, s0, s1, NAVY);
    V.box(b, c - 1.1, c + 1.1, 0, 0.08, 4.1, 7.1, 'brass');
    V.box(b, c - 1.0, c + 1.0, 0.08, 0.09, 4.2, 7.0, 'mirror', { edges: false });
    for (const s of [c - 1.55, c + 1.55]) sconce(b, V.at(s, 0), 6.1);
  }
  for (const [y0, y1] of [[16.0, 18.5], [25.15, 27.6]]) b.pbox([84.7, y0, 86.6, y1], 0, 0.04, 'bathMat', { edges: false });

  // the tub in its alcove under the high window, subway tile round it to
  // 6'-6", a shower head and a curtain drawn back
  const [x0, y0, x1, y1] = [86.45, 19.65, 88.92, 24.0], top = 1.6, t = 0.22;
  b.pbox([x0, y0, x1, y1], 0, 0.45, 'porcelain', { edges: false });
  b.pbox([x0, y0, x0 + t, y1], 0, top, 'porcelain');
  b.pbox([x1 - 0.15, y0, x1, y1], 0.45, top, 'porcelain', { edges: false });
  b.pbox([x0 + t, y0, x1 - 0.15, y0 + 0.15], 0.45, top, 'porcelain', { edges: false });
  b.pbox([x0 + t, y1 - 0.15, x1 - 0.15, y1], 0.45, top, 'porcelain', { edges: false });
  const tile = 6.5, k = 0.03;
  b.pbox([x1 - k, y0, x1, y1], top, tile, 'subway', { edges: false });
  b.pbox([86.4, y0, x1 - k, y0 + k], top, tile, 'subway', { edges: false });
  b.pbox([86.4, y1 - k, x1 - k, y1], top, tile, 'subway', { edges: false });
  const S = wallFrame('-y', y1 - k);
  S.box(b, 87.65, 87.75, 0, 1.0, 6.55, 6.65, 'brass', { edges: false });
  S.at(87.7, 1.0).cyl(b, 0, 0, 6.3, 6.6, 0.12, 'brass', { seg: 12, r1: 0.3 });
  S.at(87.7, 0).geo(b, new THREE.CylinderGeometry(0.26, 0.26, 0.05, 20).rotateX(Math.PI / 2), 'brass', {}, new THREE.Matrix4().makeTranslation(0, 3.7, 0.03));
  S.box(b, 87.67, 87.73, 0.04, 0.4, 3.67, 3.73, 'brass', { edges: false });
  S.box(b, 87.62, 87.78, 0, 0.55, 2.0, 2.1, 'brass', { edges: false });
  drapery(b, wallFrame('+x', 86.35), y0, y1, [[22.55, 23.95]], 6.9);
  // towels on hooks by the toilet room door
  const H = wallFrame('+x', 84.28);
  for (const s of [19.6, 24.0]) {
    H.box(b, s - 0.05, s + 0.05, 0, 0.25, 5.5, 5.6, 'brass', { edges: false });
    H.box(b, s - 0.65, s + 0.65, 0.05, 0.2, 2.9, 5.55, 'towel', { r: 0.05 });
  }
  // the toilet room, its door half open
  toilet(b, place(79.58, 21.99, 0));
  const Tp = wallFrame('+y', 20.38);
  Tp.box(b, 81.35, 81.45, 0, 0.35, 2.25, 2.33, 'brass', { edges: false });
  Tp.at(81.1, 0.3).geo(b, new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16).rotateZ(Math.PI / 2), 'porcelain', {},
    new THREE.Matrix4().makeTranslation(0, 2.05, 0));
  framed(b, wallFrame('+x', 79.58).at(21.99, 0.02), 1.9, 5.4, 1.5, 'art4', 'tableOak');
  doorLeaf(b, 83.83, 22.78, -135, 2.21);
}

// ---------------------------------------------------------------- powder

// Green botanical wallpaper above the baseboard, a walnut washstand with a
// white vessel and a round brass mirror, the toilet on the front wall.
function powder(b) {
  const [x0, y0, x1, y1] = [33.88, 29.1, 37.6, 35.72], t = 0.02, h0 = 0.4, h1 = P.PLATE - 0.01;
  const wp = (r, a = h0) => b.pbox(r, a, h1, 'wallpaper', { edges: false });
  wp([x0, y0, x1, y0 + t]);
  wp([x0, y1 - t, x1, y1]);
  wp([x1 - t, y0 + t, x1, y1 - t]);
  wp([x0, y0 + t, x0 + t, 30.97]);
  wp([x0, 33.63, x0 + t, y1 - t]);
  wp([x0, 30.97, x0 + t, 33.63], 6.67);

  toilet(b, place(35.74, 29.1, 90));
  const Sh = wallFrame('+y', 29.1 + t);
  Sh.box(b, 34.9, 36.6, 0, 0.7, 5.0, 5.1, 'walnut');
  foliage(b, Sh.at(35.3, 0.35).sub(0, 5.45, 0), 5, 0.22, 233);
  Sh.at(35.3, 0.35).cyl(b, 0, 0, 5.1, 5.45, 0.18, 'pottery', { seg: 12 });
  Sh.at(36.2, 0.35).cyl(b, 0, 0, 5.1, 5.5, 0.11, 'candle', { seg: 12 });
  const E = wallFrame('-x', x1 - t);
  E.box(b, 30.85, 30.95, 0, 0.35, 2.25, 2.33, 'brass', { edges: false });
  E.at(30.6, 0.3).geo(b, new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16).rotateZ(Math.PI / 2), 'porcelain', {},
    new THREE.Matrix4().makeTranslation(0, 2.05, 0));
  E.at(33.6, 0.02).geo(b, new THREE.TorusGeometry(0.32, 0.025, 8, 28), 'brass', {}, new THREE.Matrix4().makeTranslation(0, 4.2, 0.12));
  E.box(b, 33.35, 33.85, 0.06, 0.18, 3.0, 3.95, 'towel', { r: 0.04 });

  const V = wallFrame('-y', y1 - t), c = 35.74;
  for (const s of [c - 1.35, c + 1.35]) for (const d of [0.12, 1.5]) V.box(b, s - 0.07, s + 0.07, d - 0.07, d + 0.07, 0, 2.7, 'walnut', { edges: false });
  V.box(b, c - 1.42, c + 1.42, 0, 1.6, 2.1, 2.72, 'walnut');
  V.box(b, c - 1.3, c + 1.3, 1.6, 1.64, 2.18, 2.64, 'walnut', { edges: false });
  bar(b, V, c, 2.41, 1.6, 0.7, 'brass');
  V.box(b, c - 1.32, c + 1.32, 0.1, 1.5, 0.5, 0.58, 'walnut');
  V.box(b, c - 1.1, c - 0.15, 0.3, 1.3, 0.58, 1.15, 'basket', { r: 0.05 });
  for (let i = 0; i < 3; i++) V.box(b, c + 0.15, c + 1.1, 0.3, 1.3, 0.58 + i * 0.17, 0.74 + i * 0.17, 'towel', { r: 0.05 });
  V.box(b, c - 1.5, c + 1.5, 0, 1.72, 2.72, 2.82, 'marbleTop');
  V.at(c, 0.95).geo(b, new THREE.LatheGeometry([[0, 0], [0.32, 0], [0.5, 0.14], [0.58, 0.38], [0.6, 0.46], [0.55, 0.46], [0.52, 0.38],
    [0.44, 0.18], [0.3, 0.07], [0, 0.07]].map(([x, y]) => new THREE.Vector2(x, y)), 32), 'porcelain', {}, new THREE.Matrix4().makeTranslation(0, 2.82, 0));
  faucet(b, V.at(c, 0.22), 'brass', 0.72, 2.82, 1.05);
  const Mr = V.at(c, 0.02);
  Mr.geo(b, new THREE.TorusGeometry(1.0, 0.06, 10, 48), 'brass', {}, new THREE.Matrix4().makeTranslation(0, 5.55, 0.06));
  Mr.geo(b, new THREE.CircleGeometry(0.98, 48), 'mirror', {}, new THREE.Matrix4().makeTranslation(0, 5.55, 0.04));
  for (const s of [c - 1.45, c + 1.45]) sconce(b, V.at(s, 0), 6.0);
  // the 2668 is a pocket door, slid away into the wall
}

// ---------------------------------------------------------------- laundry

const LAU = { paint: 'laundryPaint', hw: 'brass', top: 'oak', tap: 'brass' };

// A front-loading washer or dryer, 24" wide, under the counter.
function washer(b, fr, s0, s1, dryer) {
  const c = (s0 + s1) / 2, d = DEPTH - 0.1;
  fr.box(b, s0, s1, 0.1, d, 0.02, 2.82, 'appliance', { r: 0.03 });
  fr.box(b, s0 + 0.05, s1 - 0.05, d, d + 0.02, 2.35, 2.75, 'steel', { edges: false });
  const L = fr.at(c, d);
  L.geo(b, new THREE.TorusGeometry(0.62, 0.07, 10, 36), 'steel', {}, new THREE.Matrix4().makeTranslation(0, 1.25, 0.05));
  L.geo(b, new THREE.CircleGeometry(0.58, 36), dryer ? 'appliance' : 'darkGlass', {}, new THREE.Matrix4().makeTranslation(0, 1.25, 0.03));
  L.geo(b, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16).rotateX(Math.PI / 2), 'steel', {}, new THREE.Matrix4().makeTranslation(0.55, 2.55, 0.04));
  L.box(b, -0.7, -0.1, 2.48, 2.62, 0.02, 0.03, 'darkGlass', { edges: false });
}

function laundry(b) {
  // the washer and dryer under an oak counter, a fireclay utility sink,
  // cabinets either end, open shelf and a drying rod over the machines
  const S = wallFrame('+y', 29.1);
  baseRun(b, S, 13.78, [[2.5, 'sink']], LAU);
  washer(b, S, 16.33, 18.33, false);
  washer(b, S, 18.38, 20.38, true);
  baseRun(b, S, 20.43, [[1.77, 'drawers']], LAU);
  counter(b, S, 13.78, 22.2, LAU, { hole: [13.9, 16.16, 0.28, DEPTH + 0.1] });
  splash(b, S, 13.78, 22.2, UP0 - 0.08);
  upperRun(b, S, 13.78, [[2.5, 'door']], LAU, { stack: false });
  upperRun(b, S, 20.43, [[1.77, 'door']], LAU, { stack: false });
  S.box(b, 16.28, 20.43, 0, 1.15, 7.3, 7.42, 'oak');
  for (const s of [16.6, 17.85, 19.1]) S.box(b, s, s + 1.0, 0.15, 1.0, 7.42, 8.0, 'basket', { r: 0.05 });
  // a rod under it, three shirts drying on hangers
  S.box(b, 16.28, 20.43, 0.77, 0.83, 6.85, 6.91, 'brass', { edges: false });
  for (const [s, m] of [[16.95, 'garmentA'], [18.35, 'garmentB'], [19.75, 'garmentA']]) {
    const L = S.at(s, 0.8);
    L.box(b, -0.08, 0.08, 6.68, 6.95, -0.02, 0.02, 'hw', { edges: false });
    L.sub(0, 6.68, 0, 0, 0).box(b, -0.62, 0.62, -0.18, 0, -0.04, 0.04, 'oak', { edges: false });
    L.box(b, -0.6, 0.6, 4.35, 6.62, -0.05, 0.05, m, { r: 0.04 });
    for (const x of [-0.6, 0.6]) L.sub(x, 6.45, 0, 0, 0).box(b, -0.12, 0.12, -1.2, 0, -0.04, 0.04, m, { r: 0.04, rot: [0, 0, x < 0 ? -18 : 18] });
  }
  // a tall cabinet for the brooms and the iron
  const K = wallFrame('+x', 13.78);
  K.box(b, 31.2, 33.4, 0, DEPTH - 0.08, 0, UP1, LAU.paint);
  for (const [h0, h1] of [[0.05, 4.6], [4.64, UP1 - 0.02]]) {
    face(b, K, 31.212, 32.288, h0, h1, DEPTH - 0.08, LAU.paint);
    face(b, K, 32.312, 33.388, h0, h1, DEPTH - 0.08, LAU.paint);
  }
  for (const s of [32.15, 32.45]) vbar(b, K, s, 4.0, DEPTH - 0.08, 1.0, 'brass');
  K.box(b, 31.2, 33.4, 0, DEPTH + 0.1, UP1, UP1 + 0.42, LAU.paint);
  // hampers under a peg rail, an apron and a tote on the pegs
  const E = wallFrame('-x', 22.2);
  for (const y of [32.3, 34.0]) {
    const Hm = place(21.35, y, 180);
    Hm.cyl(b, 0, 0, 0, 2.0, 0.66, 'basket', { seg: 20, r1: 0.58, edges: true });
    Hm.cyl(b, 0, 0, 2.0, 2.08, 0.7, 'basket', { seg: 20 });
  }
  E.box(b, 31.4, 35.2, 0, 0.08, 5.45, 5.8, LAU.paint);
  for (const s of [31.9, 32.85, 33.8, 34.75]) E.at(s, 0.08).geo(b, new THREE.CylinderGeometry(0.05, 0.05, 0.35, 10).rotateX(Math.PI / 2), 'oak', {},
    new THREE.Matrix4().makeTranslation(0, 5.62, 0.17));
  E.at(32.85, 0.1).box(b, -0.55, 0.55, 3.2, 5.6, 0, 0.06, 'garmentD', { r: 0.03 });
  E.at(34.75, 0.12).box(b, -0.5, 0.5, 3.9, 5.1, 0, 0.3, 'basket', { r: 0.06 });
  doorLeaf(b, 22.65, 38.315, 0, 2.88);
}

// ---------------------------------------------------------------- mudbench and hall

// Three lockers on the back wall: a bench with shoes and baskets under it,
// battened backs with hooks and coats, cubbies with baskets over, crown.
// Painted the pantry's sage, with brass, since the two rooms meet.
function mudbench(b) {
  const M = wallFrame('-y', 42.34), m = 'pantryPaint';
  const s0 = 29.95, s1 = 37.55, n = 3, bw = (s1 - s0) / n, seat = 1.55, hook = 5.3, top = 8.15;
  const { shoes, r } = closetKit(b, 251);
  M.box(b, s0, s1, 0, 0.05, seat, 6.35, m, { edges: false });
  for (let s = s0 + 0.25; s < s1 - 0.1; s += 0.5) M.box(b, s - 0.03, s + 0.03, 0.05, 0.08, seat, 6.35, m, { edges: false });
  for (let i = 0; i <= n; i++) M.box(b, s0 + i * bw - 0.04, s0 + i * bw + 0.04, 0, 1.7, 0, top, m);
  M.box(b, s0, s1, 0, 1.5, 0, TOE, m, { edges: false });
  M.box(b, s0, s1, 0, 1.65, TOE, TOE + 0.06, m);
  M.box(b, s0, s1, 0, 1.75, seat - 0.12, seat, 'oak');
  M.box(b, s0, s1, 0, 1.4, 6.35, 6.45, m);
  M.box(b, s0, s1, 0, 0.05, 6.45, top, m, { edges: false });
  M.box(b, s0 - 0.05, s1 + 0.05, 0, 1.55, top, top + 0.12, m);
  M.box(b, s0 - 0.1, s1 + 0.1, 0, 1.75, top + 0.12, top + 0.45, m);
  const coats = ['garmentC', 'garmentD', 'garmentE'];
  for (let i = 0; i < n; i++) {
    const a = s0 + i * bw + 0.04, e = a + bw - 0.08;
    shoes(M, a, a + 1.35, TOE - 0.02);
    M.box(b, a + 1.4, e - 0.05, 0.15, 1.35, TOE + 0.06, TOE + 0.85, 'basket', { r: 0.05 });
    M.box(b, a + 0.03, e - 0.03, 0.1, 1.7, seat, seat + 0.2, 'chairLinen', { r: 0.08 });
    M.box(b, a + 0.25, e - 0.25, 0.15, 1.2, 6.45, 7.4, 'basket', { r: 0.06 });
    for (const [j, s] of [[0, a + bw * 0.28], [1, e - bw * 0.28]]) {
      M.box(b, s - 0.03, s + 0.03, 0.08, 0.3, hook - 0.03, hook + 0.03, 'brass', { edges: false });
      M.box(b, s - 0.03, s + 0.03, 0.26, 0.32, hook, hook + 0.14, 'brass', { edges: false });
      if (j === 0) M.at(s, 0.33).box(b, -0.55, 0.55, hook - 2.6 - r() * 0.4, hook + 0.05, -0.22, 0.14, coats[i], { r: 0.12 });
      else if (i !== 1) M.at(s, 0.3).box(b, -0.42, 0.42, hook - 1.7, hook - 0.15, -0.12, 0.12, i ? 'basket' : 'leather', { r: 0.06 });
    }
  }
}

function hall(b) {
  mudbench(b);
  // a runner from the kitchen door to the stair
  b.pbox([26.8, 37.3, 37.4, 39.5], 0, 0.035, 'rug2Border', { edges: false });
  b.pbox([27.0, 37.5, 37.2, 39.3], 0, 0.04, 'rug2');
  // a walnut console on the powder room wall, a lamp, a painting over it
  const C = wallFrame('+y', 36.1), c = 35.55;
  C.box(b, c - 1.55, c + 1.55, 0, 1.2, 2.55, 2.7, 'walnut');
  for (const s of [c - 1.4, c + 1.4]) C.box(b, s - 0.1, s + 0.1, 0.1, 1.1, 0, 2.55, 'walnut');
  C.box(b, c - 1.3, c + 1.3, 0.15, 1.05, 0.5, 0.6, 'walnut');
  C.box(b, c - 1.1, c - 0.1, 0.25, 1.0, 0.6, 1.25, 'basket', { r: 0.05 });
  tableLamp(b, C.at(c + 0.9, 0.6).sub(0, 2.7, 0));
  C.box(b, c - 1.1, c - 0.3, 0.3, 0.9, 2.7, 2.9, 'books', { edges: false });
  framed(b, C.at(c - 0.35, 0.02), 2.6, 5.3, 2.0, 'art4');
  // the doors to the garage and the pantry, standing open
  doorLeaf(b, 23.585, 29.17, 90, 2.88);
  doorLeaf(b, 30.185, 28.53, -90, 2.88);
  // the stair: white risers, a newel, balusters and a walnut rail on the
  // open side, a wall rail on the other
  const st = P.stair, n1 = 11, run = (st.x1 - st.x0) / n1;
  for (let i = 0; i < n1; i++) {
    const xb = st.x1 - i * run;
    b.pbox([xb, st.y0, xb + 0.03, st.y1], i * st.rise, (i + 1) * st.rise, 'trim', { edges: false });
  }
  const rail = (x) => 3.0 + (st.x1 - x) * (st.rise / run);
  const y = st.y0 + 0.12;
  b.pbox([25.7, y - 0.15, 26.0, y + 0.15], 0, 3.5, 'trim');
  b.pbox([25.65, y - 0.2, 26.05, y + 0.2], 3.5, 3.62, 'walnut');
  planRod(b, [25.85, y, rail(25.85)], [22.58, y, rail(22.58)], 0.09, 'walnut');
  for (let i = 0; i < n1; i++) {
    for (const k of [0.25, 0.65]) {
      const x = st.x1 - i * run - k;
      if (x < 22.7 || x > 25.6) continue;
      planRod(b, [x, y, (i + 1) * st.rise], [x, y, rail(x)], 0.05, 'trim');
    }
  }
  planRod(b, [25.9, st.y1 - 0.18, rail(25.9)], [18.6, st.y1 - 0.18, rail(18.6)], 0.07, 'walnut');
  for (const x of [25.2, 22.4, 19.6]) b.pbox([x - 0.04, st.y1 - 0.2, x + 0.04, st.y1], rail(x) - 0.14, rail(x) - 0.06, 'hw', { edges: false });
}

// ---------------------------------------------------------------- garage

// A wheel on an axle across local x: the tyre, a dark disc with five
// silver spokes and a rim ring on the outer face, a hub cap. `side` is the
// way the outer face looks (+1 or -1).
function wheel(b, L, x, z, r, w, side) {
  const S = L.sub(x, r, z);
  S.geo(b, new THREE.CylinderGeometry(r, r, w, 28).rotateZ(Math.PI / 2), 'tire');
  const f = side * (w / 2);
  S.geo(b, new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.04, 24).rotateZ(Math.PI / 2).translate(f, 0, 0), 'castIron');
  S.geo(b, new THREE.TorusGeometry(r * 0.64, r * 0.05, 6, 32).rotateY(Math.PI / 2).translate(f, 0, 0), 'steel');
  for (let i = 0; i < 5; i++) S.sub(f + side * 0.03, 0, 0, 0, i * 72).box(b, -0.025, 0.025, r * 0.12, r * 0.62, -r * 0.07, r * 0.07, 'steel', { edges: false });
  S.geo(b, new THREE.CylinderGeometry(r * 0.14, r * 0.14, 0.06, 14).rotateZ(Math.PI / 2).translate(f + side * 0.05, 0, 0), 'steel');
}

// A side profile [u forward, v up] extruded across local x to a width w,
// with rounded edges. The bevel grows the outline by about 3/4 of `bevel`.
function profile(pts, w, bevel) {
  const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const d = w - 2 * bevel;
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.75, bevelSegments: 3, curveSegments: 12 });
  return g.rotateY(-Math.PI / 2).translate(d / 2, 0, 0);
}

// The car: a mid-size SUV in slate blue, parked nose in toward the house.
// The body and the cabin are side profiles extruded across the width; the
// glass, lamps, grille and wheels are laid on them. L stands on the floor
// under the middle of the car, z toward the nose. 16' long, 6'-4" wide.
function suv(b, L) {
  const arch = (cx) => {
    const out = [[cx - 1.69, 0.94]];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (1 - i / 12);
      out.push([cx + 1.69 * Math.cos(a), 1.2 + 1.69 * Math.sin(a)]);
    }
    return [...out, [cx + 1.69, 0.94]];
  };
  const rearX = -4.7, frontX = 4.8;
  L.geo(b, profile([[-7.6, 0.94], ...arch(rearX), ...arch(frontX), [7.6, 0.94], [7.81, 1.3], [7.81, 2.55], [7.55, 3.05],
    [3.4, 3.62], [-7.3, 3.62], [-7.75, 3.4], [-7.81, 1.3]], 6.3, 0.25), 'carPaint');
  L.geo(b, profile([[-7.35, 3.5], [3.2, 3.5], [0.35, 5.55], [-6.55, 5.62], [-7.1, 5.2]], 5.5, 0.3), 'carPaint');
  // the windscreen and the rear window lie on the slopes of the cabin
  L.sub(0, 4.73, 1.92, 0, -54.3).box(b, -2.25, 2.25, -1.42, 1.42, -0.02, 0.02, 'darkGlass', { edges: false });
  L.sub(0, 4.54, -7.45, 0, 8.4).box(b, -2.05, 2.05, -0.62, 0.62, -0.02, 0.02, 'darkGlass', { edges: false });
  // side windows on the flat of the cabin: front door, rear door, quarter
  const front = (v) => 2.75 - 1.39 * (v - 3.5), rear = (v) => -6.95 + 0.147 * (v - 3.5);
  const v0 = 3.95, v1 = 5.25;
  const panes = [
    [[-1.1, v0], [front(v0), v0], [front(v1), v1], [-1.1, v1]],
    [[-4.45, v0], [-1.45, v0], [-1.45, v1], [-4.45, v1]],
    [[rear(v0), v0], [-4.95, v0], [-4.95, v1], [rear(v1) + 0.35, v1]],
  ];
  for (const side of [-1, 1]) {
    for (const p of panes) {
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(p.map(([u, v]) => new THREE.Vector2(u, v))), { depth: 0.03, bevelEnabled: false })
        .rotateY(-Math.PI / 2).translate(side > 0 ? 2.78 : -2.75, 0, 0);
      L.geo(b, g, 'darkGlass');
    }
    const x = side * 3.15, o = side * 0.02;
    // a black sill and arch trim, the door shuts, handles and a mirror
    L.box(b, Math.min(x, x + o * 2), Math.max(x, x + o * 2), 0.78, 1.35, rearX + 1.75, frontX - 1.75, 'hw', { edges: false });
    for (const u of [2.95, -1.28, -4.45]) L.box(b, Math.min(x, x + o), Math.max(x, x + o), 1.2, 3.75, u - 0.02, u + 0.02, 'hw', { edges: false });
    for (const u of [1.0, -2.5]) L.box(b, Math.min(x, x + o * 3), Math.max(x, x + o * 3), 3.2, 3.32, u - 0.28, u + 0.28, 'hw', { edges: false });
    L.box(b, Math.min(side * 2.9, side * 3.75), Math.max(side * 2.9, side * 3.75), 3.85, 4.35, 2.35, 2.9, 'carPaint', { r: 0.1 });
    L.box(b, Math.min(side * 3.1, side * 3.7), Math.max(side * 3.1, side * 3.7), 3.9, 4.3, 2.33, 2.36, 'darkGlass', { edges: false });
    // roof rails
    L.box(b, Math.min(side * 2.05, side * 2.2), Math.max(side * 2.05, side * 2.2), 5.82, 5.98, -6.1, 0.0, 'hw', { r: 0.03 });
    // lamps: headlamps, tail lamps
    L.box(b, Math.min(side * 1.85, side * 2.95), Math.max(side * 1.85, side * 2.95), 2.55, 2.92, 7.62, 7.99, 'lens', { r: 0.06 });
    L.box(b, Math.min(side * 2.1, side * 3.05), Math.max(side * 2.1, side * 3.05), 3.0, 3.45, -8.02, -7.8, 'tailLight', { r: 0.05 });
    wheel(b, L, side * 2.72, rearX, 1.2, 0.85, side);
    wheel(b, L, side * 2.72, frontX, 1.2, 0.85, side);
  }
  // grille, bumpers and the plate
  L.box(b, -1.7, 1.7, 1.55, 2.48, 7.86, 8.04, 'hw', { r: 0.04 });
  L.box(b, -1.7, 1.7, 2.0, 2.06, 8.04, 8.07, 'steel', { edges: false });
  L.box(b, -2.85, 2.85, 0.82, 1.32, 7.6, 8.06, 'hw', { r: 0.08 });
  L.box(b, -2.95, 2.95, 0.82, 1.42, -8.06, -7.6, 'hw', { r: 0.08 });
  L.box(b, -0.5, 0.5, 2.0, 2.5, -8.05, -8.0, 'porcelain', { edges: false });
}

// A riding mower, nose toward z: a red hood and rear body over a charcoal
// frame and deck, big wheels at the back, a black seat and a wheel.
function mower(b, L) {
  const m = 'mowerPaint';
  L.box(b, -2.15, 2.15, 0.32, 0.72, -0.4, 1.45, 'castIron', { r: 0.12 });
  L.box(b, -0.75, 0.75, 0.72, 1.12, -2.35, 2.55, 'castIron');
  L.box(b, -1.0, 1.0, 0.9, 1.0, -0.55, 0.6, 'hw');
  L.box(b, -0.85, 0.85, 1.1, 2.25, 0.55, 2.7, m, { r: 0.25 });
  L.box(b, -0.62, 0.62, 1.3, 2.0, 2.66, 2.74, 'hw', { edges: false });
  L.box(b, -1.05, 1.05, 1.05, 2.05, -2.5, -0.55, m, { r: 0.2 });
  for (const s of [-1, 1]) L.box(b, Math.min(s * 1.0, s * 1.78), Math.max(s * 1.0, s * 1.78), 1.98, 2.12, -2.55, -0.45, m, { r: 0.05 });
  L.box(b, -0.75, 0.75, 2.05, 2.4, -1.65, -0.5, 'tire', { r: 0.12 });
  L.sub(0, 2.3, -1.6, 0, -12).box(b, -0.72, 0.72, 0, 1.0, -0.16, 0.08, 'tire', { r: 0.1 });
  strut(b, L, [0, 2.2, 0.75], [0, 3.05, 0.2], 0.05, 'hw');
  L.geo(b, new THREE.TorusGeometry(0.5, 0.05, 8, 28).rotateX(-Math.PI / 2 + 0.55), 'hw', {}, new THREE.Matrix4().makeTranslation(0, 3.08, 0.17));
  for (const s of [-1, 1]) {
    wheel(b, L, s * 1.38, -1.5, 0.95, 0.7, s);
    wheel(b, L, s * 1.0, 1.9, 0.55, 0.45, s);
  }
}

// A rolling trash cart: a tub, a lid with a lip, the handle and two wheels
// at the back, toward the wall. L faces out into the garage.
function cart(b, L, m) {
  L.box(b, -0.95, 0.95, 0.35, 3.4, -1.1, 1.1, m, { r: 0.08 });
  L.box(b, -1.02, 1.02, 3.4, 3.55, -1.2, 1.25, m, { r: 0.05 });
  L.box(b, -0.8, 0.8, 3.25, 3.45, -1.34, -1.12, m, { r: 0.04 });
  for (const x of [-0.82, 0.82]) L.geo(b, new THREE.CylinderGeometry(0.32, 0.32, 0.18, 16).rotateZ(Math.PI / 2), 'tire', {}, new THREE.Matrix4().makeTranslation(x, 0.32, -1.0));
}

// A bike hung by its front wheel on the wall at x = wall, its frame in the
// plane y = s. Bike points are [a, c]: a along the bike from the rear hub,
// c up from the hubs. Hung, a runs up the wall and c out from it.
function hungBike(b, wall, s, paint) {
  const R = 1.12, h0 = 1.55, off = R + 0.12;
  const pt = ([a, c]) => [wall - off - c, s, h0 + a];
  const rod = (p, q, r, m = paint) => planRod(b, pt(p), pt(q), r, m);
  const ring = (p, rad, tube, m) => {
    const [x, y, h] = pt(p);
    const g = new THREE.TorusGeometry(rad, tube, 8, 44);
    b.geo(g, new THREE.Matrix4().compose(new THREE.Vector3(wx(x), wy(h), wz(y)), new THREE.Quaternion(), new THREE.Vector3(FT, FT, FT)), m);
    g.dispose();
  };
  const Rh = [0, 0], F = [3.45, 0], BB = [1.35, -0.22], S = [1.05, 1.75], H = [3.2, 1.95], HB = [3.33, 1.45];
  for (const c of [Rh, F]) {
    ring(c, R, 0.07, 'tire');
    ring(c, R - 0.09, 0.03, 'steel');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rod(c, [c[0] + Math.cos(a) * (R - 0.1), c[1] + Math.sin(a) * (R - 0.1)], 0.008, 'steel');
    }
  }
  rod(Rh, BB, 0.05); rod(Rh, S, 0.045); rod(BB, S, 0.07); rod(S, H, 0.07); rod(BB, HB, 0.08); rod(HB, H, 0.08);
  rod(HB, F, 0.06, 'castIron');
  rod(S, [0.95, 2.3], 0.045, 'steel');
  rod([0.55, 2.38], [1.3, 2.4], 0.13, 'tire');
  rod(H, [3.15, 2.45], 0.05, 'steel');
  ring(BB, 0.33, 0.03, 'steel');
  rod([BB[0] - 0.55, BB[1]], [BB[0] + 0.55, BB[1]], 0.04, 'castIron');
  const [bx, , bh] = pt([3.15, 2.45]);
  planRod(b, [bx, s - 0.85, bh], [bx, s + 0.85, bh], 0.045, 'castIron');
  for (const k of [-1, 1]) planRod(b, [bx, s + k * 0.85, bh], [bx, s + k * 0.55, bh], 0.07, 'tire');
  // the hook through the top of the front wheel
  const top = h0 + F[0] + R - 0.05;
  planRod(b, [wall, s, top + 0.25], [wall - off, s, top + 0.25], 0.04, 'castIron');
  planRod(b, [wall - off, s, top + 0.25], [wall - off, s, top - 0.05], 0.04, 'castIron');
}

const LIDS = ['mowerPaint', 'navyPaint', 'pantryPaint', 'castIron'];

// What sits on a storage shelf from s0 to s1 at height h, depth d, under
// `top`: lidded bins, cardboard boxes, now and then a row of paint cans.
function shelfStuff(b, fr, s0, s1, h, d, top, r, { cans = true } = {}) {
  let s = s0 + 0.1;
  const room = top - h - 0.15;
  while (s < s1 - 0.7) {
    const k = r(), w = Math.min(s1 - 0.1 - s, 1.3 + r() * 0.6);
    if (k < 0.45) {
      const hh = Math.min(room, 0.95 + r() * 0.35);
      fr.box(b, s, s + w, 0.12, d - 0.1, h, h + hh - 0.1, 'bin', { r: 0.04 });
      fr.box(b, s - 0.03, s + w + 0.03, 0.09, d - 0.07, h + hh - 0.12, h + hh, LIDS[Math.floor(r() * LIDS.length)], { r: 0.03 });
      s += w + 0.12;
    } else if (k < 0.85 || !cans) {
      const hh = Math.min(room, 0.7 + r() * 0.6);
      fr.box(b, s, s + w, 0.1 + r() * 0.25, d - 0.05, h, h + hh, 'cardboard');
      if (r() < 0.4 && room - hh > 0.6) fr.box(b, s + 0.15, s + w - 0.2, 0.25, d - 0.15, h + hh, h + hh + 0.5, 'cardboard');
      s += w + 0.1;
    } else {
      for (let i = 0; i < 3 && s < s1 - 0.6; i++) {
        fr.at(s + 0.3, d / 2).cyl(b, 0, 0, h, h + 0.62, 0.28, 'steel', { seg: 16 });
        s += 0.62;
      }
      s += 0.15;
    }
  }
}

// Shelving on a wall: uprights at the ends and every four feet, and
// shelves at `levels`. Wood (pine) or a black steel rack.
function shelving(b, fr, s0, s1, d, levels, m, r, opts) {
  const t = m === 'castIron' ? 0.08 : 0.15, top = levels[levels.length - 1];
  const n = Math.max(1, Math.round((s1 - s0) / 4));
  for (let i = 0; i <= n; i++) {
    const s = Math.min(s1 - t, s0 + i * (s1 - s0) / n);
    for (const [d0, d1] of [[0.05, 0.05 + t], [d - t, d]]) fr.box(b, s, s + t, d0, d1, 0, top + 0.07, m);
  }
  levels.forEach((h, i) => {
    fr.box(b, s0, s1, 0.05, d, h, h + 0.07, m === 'castIron' ? 'steel' : m);
    if (i < levels.length - 1) shelfStuff(b, fr, s0 + t, s1 - t, h + 0.07, d, levels[i + 1], r, opts);
  });
}

function garage(b) {
  const r = rng(271);
  suv(b, place(11.3, 21.6, 0));
  mower(b, place(6.0, 10.8, 180));
  cart(b, place(2.3, 6.3, 90), 'cartPlastic');
  cart(b, place(4.5, 6.3, 90), 'cartPlastic');
  // the 4068 pair to the storage room swings out into the garage, as drawn
  doorLeaf(b, 5.035, 28.53, -90, 1.88);
  doorLeaf(b, 8.665, 28.53, -90, 1.88);

  // the inside of the overhead door: white steel sections with struts and a
  // handle, tracks up the jambs and back under the ceiling, a torsion spring
  const D = wallFrame('+x', 0.64);
  D.box(b, 7.5, 25.5, 0, 0.06, 0, 8.0, 'trim');
  for (const h of [2, 4, 6]) D.box(b, 7.5, 25.5, 0.06, 0.08, h - 0.02, h + 0.02, 'steel', { edges: false });
  for (const h of [1.0, 3.0, 5.0, 7.0]) D.box(b, 7.8, 25.2, 0.06, 0.2, h - 0.1, h + 0.1, 'steel');
  D.box(b, 16.2, 16.8, 0.06, 0.2, 1.55, 1.7, 'hw', { edges: false });
  for (const [y0, y1] of [[7.25, 7.5], [25.5, 25.75]]) {
    b.pbox([0.83, y0, 1.15, y1], 0, 8.35, 'steel');
    b.pbox([0.83, y0, 10.2, y1], 8.2, 8.45, 'steel');
    b.pbox([9.95, y0, 10.1, y1], 8.45, P.PLATE, 'steel', { edges: false });
  }
  planRod(b, [1.15, 7.3, 8.8], [1.15, 25.7, 8.8], 0.06, 'steel');
  for (const [y0, y1] of [[14.4, 16.2], [16.8, 18.6]]) planRod(b, [1.15, y0, 8.8], [1.15, y1, 8.8], 0.13, 'castIron');

  // the workbench on the front wall: a butcher-block top on steel legs, a
  // bank of drawers, pegboard and tools, wall cabinets over a shop light
  const W = wallFrame('+y', 4.93), w0 = 7.6, w1 = 18.8;
  W.box(b, w0, w1, 0, 2.3, 2.85, 3.05, 'tableOak');
  for (const s of [w0 + 0.1, 13.0, w1 - 0.35]) for (const d of [0.1, 1.95]) W.box(b, s, s + 0.25, d, d + 0.25, 0, 2.85, 'castIron');
  W.box(b, w0 + 0.1, 15.2, 0.15, 2.2, 0.55, 0.65, 'tableOak');
  W.box(b, 15.25, w1 - 0.35, 0.1, 2.15, 0.65, 2.85, 'garageCab');
  for (const [h0, h1] of [[0.7, 1.4], [1.45, 2.15], [2.2, 2.8]]) {
    face(b, W, 15.28, w1 - 0.38, h0, h1, 2.15, 'garageCab');
    bar(b, W, (15.25 + w1 - 0.35) / 2, (h0 + h1) / 2, 2.15, 1.0, 'hw');
  }
  shelfStuff(b, W, w0 + 0.4, 15.0, 0.65, 2.1, 2.75, r, { cans: false });
  W.box(b, w0 + 0.2, w1 - 0.2, 0, 0.05, 3.3, 7.2, 'pegboard');
  for (const [h0, h1] of [[3.22, 3.3], [7.2, 7.28]]) W.box(b, w0 + 0.1, w1 - 0.1, 0, 0.08, h0, h1, 'tableOak');
  // tools on the pegboard: hammer, wrenches, screwdrivers, a saw and a
  // level, a tape, an extension cord, clamps
  W.box(b, 8.4, 8.5, 0.1, 0.2, 4.3, 5.45, 'oak');
  W.box(b, 8.15, 8.75, 0.08, 0.24, 5.45, 5.62, 'hw');
  for (let i = 0; i < 8; i++) {
    const s = 9.1 + i * 0.2, len = 0.45 + i * 0.09;
    W.box(b, s - 0.03, s + 0.03, 0.08, 0.12, 6.6 - len, 6.6, 'steel', { edges: false });
    W.box(b, s - 0.06, s + 0.06, 0.08, 0.12, 6.6 - len - 0.12, 6.6 - len, 'steel', { edges: false });
  }
  ['mowerPaint', 'lemon', 'navyPaint', 'mowerPaint', 'lemon', 'navyPaint'].forEach((m, i) => {
    const L = W.at(11.0 + i * 0.22, 0.2);
    L.cyl(b, 0, 0, 6.15, 6.6, 0.06, m, { seg: 8 });
    L.cyl(b, 0, 0, 5.55, 6.15, 0.018, 'steel', { seg: 6 });
  });
  W.box(b, 12.4, 13.95, 0.07, 0.09, 5.5, 6.0, 'steel');
  W.box(b, 13.95, 14.45, 0.06, 0.16, 5.4, 6.08, 'oak');
  W.box(b, 12.2, 14.6, 0.06, 0.26, 4.42, 4.64, 'lemon');
  W.box(b, 14.95, 15.35, 0.06, 0.3, 6.2, 6.6, 'lemon', { r: 0.05 });
  W.at(16.1, 0.15).geo(b, new THREE.TorusGeometry(0.45, 0.07, 8, 24), 'pillowA', {}, new THREE.Matrix4().makeTranslation(0, 5.1, 0));
  for (const s of [17.1, 17.5, 17.9]) {
    W.box(b, s - 0.03, s + 0.03, 0.08, 0.2, 4.7, 6.2, 'castIron', { edges: false });
    W.box(b, s - 0.03, s + 0.03, 0.08, 0.5, 6.1, 6.2, 'castIron', { edges: false });
    W.box(b, s - 0.05, s + 0.05, 0.12, 0.45, 4.6, 4.95, 'mowerPaint', { edges: false });
  }
  // on the bench: a vise, a toolbox, a drill, a can of brushes
  W.box(b, w0 + 0.05, w0 + 0.75, 1.6, 2.4, 3.05, 3.5, 'castIron');
  W.box(b, 9.6, 11.4, 0.4, 1.45, 3.05, 3.8, 'mowerPaint', { r: 0.05 });
  W.box(b, 10.2, 10.8, 0.85, 1.0, 3.8, 3.95, 'hw', { edges: false });
  const Dr = W.at(13.0, 1.3).sub(0, 3.05, 0, 30);
  Dr.box(b, -0.15, 0.15, 0, 0.18, -0.3, 0.2, 'castIron');
  Dr.box(b, -0.08, 0.08, 0.18, 0.75, -0.1, 0.12, 'pantryPaint');
  Dr.box(b, -0.11, 0.11, 0.7, 0.95, -0.15, 0.55, 'pantryPaint', { r: 0.04 });
  W.at(14.5, 0.9).cyl(b, 0, 0, 3.05, 3.6, 0.22, 'steel', { seg: 16 });
  for (const [x, z] of [[-0.06, 0.05], [0.07, -0.04], [0.0, 0.08]]) W.at(14.5 + x, 0.9 + z).cyl(b, 0, 0, 3.55, 4.15, 0.035, 'tableOak', { seg: 6 });
  // wall cabinets, a shop light under them
  W.box(b, w0, w1, 0, 1.2, 7.5, 9.8, 'garageCab');
  for (let i = 0; i < 4; i++) {
    const a = w0 + i * (w1 - w0) / 4;
    face(b, W, a + 0.03, a + (w1 - w0) / 4 - 0.03, 7.55, 9.75, 1.2, 'garageCab');
    vbar(b, W, i % 2 ? a + 0.25 : a + (w1 - w0) / 4 - 0.25, 7.95, 1.2, 0.5, 'hw');
  }
  W.box(b, w0 + 1.0, w1 - 1.0, 0.4, 0.9, 7.38, 7.5, 'trim');
  W.box(b, w0 + 1.05, w1 - 1.05, 0.45, 0.85, 7.36, 7.38, 'lampShade', { edges: false });
  // a rolling tool chest by the second window
  W.box(b, 19.2, 21.0, 0.1, 1.7, 0.35, 3.4, 'mowerPaint', { r: 0.04 });
  W.box(b, 19.25, 20.95, 0.15, 1.65, 3.4, 4.5, 'mowerPaint', { r: 0.04 });
  for (const h of [0.9, 1.5, 2.1, 2.7, 3.7, 4.1]) W.box(b, 19.4, 20.8, 1.7, 1.76, h - 0.03, h + 0.03, 'steel', { edges: false });
  for (const s of [19.5, 20.7]) W.at(s, 1.2).geo(b, new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12).rotateZ(Math.PI / 2), 'tire', {}, new THREE.Matrix4().makeTranslation(0, 0.18, 0));

  // the house wall: tall cabinets where the wall steps out round the
  // pantry nook, a second fridge, a steel rack of bins, two bikes
  const C = wallFrame('-x', 26.77);
  C.box(b, 5.4, 11.9, 0, 1.8, 0, 0.33, 'castIron');
  C.box(b, 5.4, 11.9, 0, 1.95, 0.33, 7.6, 'garageCab');
  for (let i = 0; i < 3; i++) {
    const a = 5.4 + i * 6.5 / 3, e = a + 6.5 / 3;
    face(b, C, a + 0.03, e - 0.03, 0.38, 7.55, 1.95, 'garageCab');
    vbar(b, C, i === 1 ? a + 0.25 : e - 0.25, 3.9, 1.95, 1.0, 'hw');
  }
  const H = wallFrame('-x', 27.1);
  H.box(b, 12.5, 15.3, 0.1, 2.5, 0.05, 5.9, 'appliance', { r: 0.06 });
  H.box(b, 12.55, 15.25, 2.5, 2.52, 4.28, 4.32, 'hw', { edges: false });
  for (const [h0, h1] of [[2.5, 4.0], [4.55, 5.5]]) H.box(b, 12.7, 12.8, 2.52, 2.68, h0, h1, 'steel');
  shelving(b, H, 15.8, 20.3, 1.8, [0.4, 1.9, 3.4, 4.9, 6.4], 'castIron', r);
  hungBike(b, 27.1, 21.6, 'navyPaint');
  hungBike(b, 27.1, 23.5, 'pantryPaint');

  // the back wall: a shelf of paint cans, garden tools on a rail, a
  // ladder on hooks above
  const K = wallFrame('-y', 28.6);
  K.box(b, 9.6, 22.6, 0, 1.2, 6.6, 6.7, 'tableOak');
  for (const s of [10.2, 16.0, 22.0]) K.box(b, s - 0.05, s + 0.05, 0, 1.0, 6.0, 6.6, 'castIron', { edges: false });
  shelfStuff(b, K, 9.8, 22.4, 6.7, 1.15, 7.45, r);
  K.box(b, 10.0, 15.0, 0, 0.15, 5.0, 5.25, 'tableOak');
  const tools = [[10.6, 'rake'], [11.6, 'shovel'], [12.6, 'broom'], [13.6, 'shovel'], [14.5, 'rake']];
  for (const [s, kind] of tools) {
    const T0 = K.at(s, 0.3);
    T0.cyl(b, 0, 0, 0.75, 5.3, 0.06, 'oak', { seg: 8 });
    if (kind === 'shovel') T0.box(b, -0.38, 0.38, 0.05, 0.95, -0.03, 0.03, 'steel', { r: 0.02 });
    else if (kind === 'broom') T0.box(b, -0.65, 0.65, 0.05, 0.8, -0.15, 0.15, 'basket', { r: 0.04 });
    else {
      T0.box(b, -0.6, 0.6, 0.55, 0.65, -0.05, 0.05, 'hw', { edges: false });
      for (let i = 0; i < 10; i++) T0.box(b, -0.55 + i * 0.122, -0.53 + i * 0.122, 0.3, 0.6, -0.02, 0.02, 'hw', { edges: false });
    }
  }
  for (const h of [7.6, 8.75]) K.box(b, 10.5, 19.5, 0.22, 0.34, h - 0.06, h + 0.06, 'lemon');
  for (let s = 11.0; s < 19.4; s += 1.0) K.box(b, s - 0.04, s + 0.04, 0.24, 0.32, 7.6, 8.75, 'steel', { edges: false });
  for (const s of [11.5, 18.5]) K.box(b, s - 0.05, s + 0.05, 0, 0.42, 7.48, 7.54, 'castIron', { edges: false });
}

// ---------------------------------------------------------------- storage

// Pine shelving round the three walls, full of bins and boxes, totes of
// holiday things; the tree in its box, suitcases and a vacuum. Its doors
// stand open in the garage (see garage).
function storage(b) {
  const r = rng(307);
  shelving(b, wallFrame('-y', 34.5), 0.83, 13.4, 1.6, [0.35, 2.15, 3.95, 5.75, 7.55], 'tableOak', r);
  shelving(b, wallFrame('+x', 0.83), 29.1, 32.9, 1.5, [0.35, 2.15, 3.95, 5.75, 7.55], 'tableOak', r);
  // on the laundry wall: a tall box with the Christmas tree in it, a bin of
  // ornaments on top, two suitcases; an upright vacuum by the back shelf
  const E = wallFrame('-x', 13.4);
  E.box(b, 29.25, 30.85, 0.1, 1.0, 0, 4.4, 'cardboard');
  E.box(b, 29.4, 30.7, 0.15, 0.95, 4.4, 5.5, 'bin', { r: 0.04 });
  E.box(b, 29.35, 30.75, 0.12, 0.98, 5.45, 5.6, 'mowerPaint', { r: 0.03 });
  for (const [s, m, h] of [[31.3, 'navyPaint', 2.3], [32.15, 'castIron', 2.0]]) {
    E.box(b, s - 0.3, s + 0.3, 0.2, 1.6, 0.1, h, m, { r: 0.12 });
    E.box(b, s - 0.05, s + 0.05, 0.75, 1.05, h, h + 0.25, 'hw', { edges: false });
  }
  const V = place(3.5, 32.25, -90);
  V.box(b, -0.55, 0.55, 0.05, 0.4, -0.4, 0.55, 'steel', { r: 0.08 });
  V.box(b, -0.3, 0.3, 0.4, 2.6, -0.25, 0.15, 'navyPaint', { r: 0.12 });
  V.cyl(b, 0, -0.05, 2.6, 3.9, 0.05, 'steel', { seg: 8 });
  V.box(b, -0.25, 0.25, 3.85, 4.05, -0.12, 0.05, 'hw', { r: 0.04 });
}

// ---------------------------------------------------------------- fixtures

// Hung from the ceilings, so they arrive with them: pendants, the dining
// chandelier, ceiling fans, recessed cans, drum flush mounts, a ring of
// candles over the master tub, and the garage's shop lights and opener.
export function fixtures(b) {
  // three dome pendants over the island
  for (const y of [24.6, 27.7, 30.8]) pendant(b, place(45.85, y, 0), P.PLATE, 6.2);
  // a linear iron chandelier over the dining table
  chandelier(b, place(45.2, 8.65, 90), P.PLATE, 6.2);
  // fans: the living tray and the rear porch
  fan(b, place(63.7, 31.57, 20), 12, 10.0, 'oak');
  fan(b, place(61.25, 50.7, 0), 9.85, 8.6, 'hw');
  // cans
  const can = (x, y, h) => {
    const L = place(x, y, 0);
    L.cyl(b, 0, 0, h - 0.03, h - 0.005, 0.32, 'trim', { seg: 18 });
    L.cyl(b, 0, 0, h - 0.04, h - 0.03, 0.22, 'bulb', { seg: 16 });
  };
  for (const x of [56.0, 63.7, 71.4]) for (const y of [22.4, 40.7]) can(x, y, 11);
  for (const [x, y] of [[41.6, 22.0], [41.6, 29.5], [41.6, 37.5], [45.0, 37.8], [49.8, 21.0], [49.8, 37.0], [45.0, 17.6]]) can(x, y, P.PLATE);
  for (const [x, y] of [[32.6, 16.0], [32.6, 24.0]]) can(x, y, P.PLATE);
  // drum flush mounts: the pantry, the master closet, the laundry, the
  // mudbench hall; smaller ones down the bedroom hall
  const drum = (x, y, r = 0.85) => {
    const D = place(x, y, 0);
    D.cyl(b, 0, 0, P.PLATE - 0.75, P.PLATE - 0.05, r, 'lampShade', { seg: 24 });
    D.cyl(b, 0, 0, P.PLATE - 0.05, P.PLATE, 0.3, 'hw', { seg: 12 });
  };
  for (const [x, y] of [[32.6, 20.0], [7.1, 40.5], [18.0, 33.4], [28.0, 33.6], [31.0, 38.4]]) drum(x, y);
  for (const y of [18.4, 25.2]) drum(77.4, y, 0.6);
  // the master suite: a fan over the foot of the bed, the ring over the tub
  fan(b, place(21.4, 52.7, 10), P.PLATE, 8.7, 'oak');
  ringChandelier(b, place(2.4, 54.04, 0), P.PLATE, 6.9);
  for (const [x, y] of [[17.2, 46.6], [25.6, 46.6], [17.2, 59.4], [25.6, 59.4], [8.2, 48.2], [8.2, 59.8], [2.5, 59.8], [2.5, 48.4],
    [4.0, 37.2], [4.0, 42.9], [10.3, 37.2], [10.3, 42.9]]) can(x, y, P.PLATE);
  // the bedrooms: a fan over each bed's foot; cans in bath 2, the toilet
  // room, the closets, the powder room and over the mudbench
  fan(b, place(83.4, 35.45, 10), P.PLATE, 8.7, 'oak');
  fan(b, place(83.4, 7.8, 10), P.PLATE, 8.7, 'oak');
  for (const [x, y] of [[85.9, 17.3], [85.3, 21.8], [85.9, 26.3], [81.74, 22.0], [81.74, 17.6], [81.74, 26.2], [35.74, 32.4],
    [31.2, 40.2], [33.75, 40.2], [36.3, 40.2]]) can(x, y, P.PLATE);
  // the garage: four LED shop lights on chains, and the door opener: its
  // motor and light, the rail to the door, the arm down to the top section
  for (const x of [9.0, 19.5]) {
    for (const y of [12.0, 21.6]) {
      const S = place(x, y, 0);
      for (const z of [-1.6, 1.6]) S.cyl(b, 0, z, 9.15, P.PLATE, 0.02, 'iron', { seg: 4 });
      S.box(b, -0.32, 0.32, 9.0, 9.18, -2.0, 2.0, 'trim');
      S.box(b, -0.26, 0.26, 8.98, 9.0, -1.95, 1.95, 'lampShade', { edges: false });
    }
  }
  const O = place(13.2, 16.5, 0);
  O.box(b, -0.55, 0.55, 8.6, 9.25, -0.8, 0.65, 'appliance', { r: 0.06 });
  O.box(b, -0.45, 0.45, 8.56, 8.6, -0.7, 0.2, 'lampShade', { edges: false });
  for (const x of [-0.5, 0.5]) O.box(b, x - 0.04, x + 0.04, 9.25, P.PLATE, -0.1, 0.0, 'castIron', { edges: false });
  b.pbox([0.9, 16.43, 12.4, 16.57], 8.92, 9.06, 'steel');
  b.pbox([0.83, 16.3, 1.05, 16.7], 8.5, 9.1, 'steel', { edges: false });
  planRod(b, [0.85, 16.5, 7.55], [2.0, 16.5, 8.9], 0.05, 'steel');
  // the storage room: a bare bulb on a porcelain holder, a pull chain
  const Q = place(7.1, 31.8, 0);
  Q.cyl(b, 0, 0, P.PLATE - 0.2, P.PLATE, 0.24, 'porcelain', { seg: 16, r1: 0.3 });
  Q.geo(b, new THREE.SphereGeometry(0.18, 14, 10).scale(1, 1.3, 1), 'bulb', {}, new THREE.Matrix4().makeTranslation(0, P.PLATE - 0.42, 0));
  Q.cyl(b, 0.12, 0, P.PLATE - 1.6, P.PLATE - 0.2, 0.008, 'brass', { seg: 4 });
}

// A thin rod between two local points.
function strut(b, L, p, q, r, m) {
  const a = new THREE.Vector3(...p), d = new THREE.Vector3(...q).sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 6);
  const M = new THREE.Matrix4().compose(a.addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), new THREE.Vector3(1, 1, 1));
  L.geo(b, g, m, {}, M);
}

// An iron ring of six candle lights, hung from a stem by six struts.
function ringChandelier(b, L, ceil, bottom) {
  const R = 1.0, y = bottom + 0.2, top = bottom + 1.3;
  L.geo(b, new THREE.TorusGeometry(R, 0.035, 8, 48).rotateX(Math.PI / 2), 'iron', {}, new THREE.Matrix4().makeTranslation(0, y, 0));
  L.cyl(b, 0, 0, top - 0.06, top + 0.06, 0.12, 'iron', { seg: 12 });
  L.cyl(b, 0, 0, top, ceil, 0.025, 'iron', { seg: 6 });
  L.cyl(b, 0, 0, ceil - 0.08, ceil, 0.28, 'iron', { seg: 16 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
    strut(b, L, [x, y, z], [x * 0.1, top, z * 0.1], 0.018, 'iron');
    L.cyl(b, x, z, y - 0.06, y + 0.02, 0.09, 'iron', { seg: 10 });
    L.cyl(b, x, z, y + 0.02, y + 0.4, 0.045, 'candle', { seg: 10 });
    L.geo(b, new THREE.SphereGeometry(0.055, 10, 8).scale(1, 1.8, 1), 'bulb', {}, new THREE.Matrix4().makeTranslation(x, y + 0.5, z));
  }
}

function pendant(b, L, ceil, bottom) {
  const shade = [[0.0, 0.75], [0.25, 0.73], [0.48, 0.62], [0.66, 0.42], [0.76, 0.18], [0.8, 0.02], [0.82, 0]];
  const outer = new THREE.LatheGeometry(shade.map(([x, y]) => new THREE.Vector2(x, y)), 28);
  const inner = new THREE.LatheGeometry(shade.map(([x, y]) => new THREE.Vector2(Math.max(0, x - 0.025), y)).reverse(), 28);
  const at = new THREE.Matrix4().makeTranslation(0, bottom, 0);
  L.geo(b, outer, 'iron', {}, at);
  L.geo(b, inner, 'shadeIn', {}, at);
  L.cyl(b, 0, 0, bottom + 0.72, ceil, 0.03, 'iron', { seg: 6 });
  L.cyl(b, 0, 0, ceil - 0.08, ceil, 0.3, 'iron', { seg: 16 });
  L.geo(b, new THREE.SphereGeometry(0.2, 14, 10), 'bulb', {}, new THREE.Matrix4().makeTranslation(0, bottom + 0.28, 0));
}

function chandelier(b, L, ceil, bottom) {
  const hx = 0.75, hz = 2.6, y = bottom + 0.25;
  for (const x of [-hx, hx]) L.box(b, x - 0.04, x + 0.04, y - 0.04, y + 0.04, -hz, hz, 'iron', { edges: false });
  for (const z of [-hz, hz]) L.box(b, -hx, hx, y - 0.04, y + 0.04, z - 0.04, z + 0.04, 'iron', { edges: false });
  for (const z of [-hz * 0.5, 0, hz * 0.5]) L.box(b, -hx, hx, y - 0.03, y + 0.03, z - 0.03, z + 0.03, 'iron', { edges: false });
  // a top rail with scrolls down to the frame
  L.box(b, -0.04, 0.04, y + 1.0, y + 1.08, -hz, hz, 'iron', { edges: false });
  for (const z of [-hz, -hz / 2, 0, hz / 2, hz]) L.box(b, -0.025, 0.025, y, y + 1.0, z - 0.025, z + 0.025, 'iron', { edges: false });
  for (const x of [-hx, hx]) {
    for (let i = 0; i < 5; i++) {
      const z = -hz + 0.25 + i * (2 * hz - 0.5) / 4;
      L.cyl(b, x, z, y - 0.06, y, 0.1, 'iron', { seg: 10 });
      L.cyl(b, x, z, y, y + 0.42, 0.055, 'candle', { seg: 10 });
      L.geo(b, new THREE.SphereGeometry(0.06, 10, 8).scale(1, 1.8, 1), 'bulb', {}, new THREE.Matrix4().makeTranslation(x, y + 0.52, z));
    }
  }
  for (const z of [-hz * 0.6, hz * 0.6]) L.cyl(b, 0, z, y + 1.08, ceil, 0.025, 'iron', { seg: 6 });
  L.box(b, -0.25, 0.25, ceil - 0.08, ceil, -hz * 0.6 - 0.25, hz * 0.6 + 0.25, 'iron', { edges: false });
}

function fan(b, L, ceil, hub, blade) {
  L.cyl(b, 0, 0, ceil - 0.15, ceil, 0.28, 'iron', { seg: 16, r1: 0.2 });
  L.cyl(b, 0, 0, hub + 0.3, ceil - 0.15, 0.04, 'iron', { seg: 8 });
  L.cyl(b, 0, 0, hub - 0.05, hub + 0.32, 0.42, 'iron', { seg: 20, r1: 0.5 });
  L.geo(b, new THREE.SphereGeometry(0.34, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 'shadeIn', {},
    new THREE.Matrix4().makeTranslation(0, hub - 0.05, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 360;
    const arm = L.sub(0, hub + 0.12, 0, a);
    arm.box(b, -0.05, 0.05, -0.02, 0.02, 0.4, 0.95, 'iron', { edges: false });
    arm.sub(0, 0, 0, 0, 0).box(b, -0.28, 0.28, -0.02, 0.02, 0.9, 2.55, blade, { rot: [0, 0, 8] });
  }
}

// ---------------------------------------------------------------- all

export function furnish(b) {
  kitchen(b);
  living(b);
  dining(b);
  pantry(b);
  porch(b);
  masterBedroom(b);
  masterBath(b);
  masterCloset(b);
  bedroom2(b);
  bedroom3(b);
  bedHall(b);
  wingClosets(b);
  bath2(b);
  powder(b);
  laundry(b);
  hall(b);
  garage(b);
  storage(b);
}

// The fire: flames and embers, their own object so they can flicker.
export function fire(materials) {
  const g = new THREE.Group();
  const F = wallFrame('-x', 75.2).at(31.55, 1.5);
  const mk = (x, z, h, r, m) => {
    const geo = new THREE.ConeGeometry(r, h, 10, 1, true).translate(0, h / 2, 0).scale(1.6, 1, 0.7);
    const mesh = new THREE.Mesh(geo, materials[m]);
    const v = new THREE.Vector3(x, 0.55 + 0.45, z).applyMatrix4(F.M);
    mesh.position.copy(v);
    mesh.scale.setScalar(FT);
    mesh.userData.h = h;
    g.add(mesh);
  };
  const r = rng(77);
  for (let i = 0; i < 9; i++) mk((r() - 0.5) * 1.9, (r() - 0.5) * 0.5, 0.5 + r() * 0.9, 0.14 + r() * 0.12, i % 3 ? 'flame' : 'flameCore');
  const emb = new THREE.Mesh(new THREE.BoxGeometry(2.4 * FT, 0.12 * FT, 1.0 * FT), materials.ember);
  emb.position.copy(new THREE.Vector3(0, 0.62, 0).applyMatrix4(F.M));
  g.add(emb);
  return g;
}
