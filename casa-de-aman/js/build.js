// Builds the house from plan.js: walls with their openings, windows and
// doors, built-ins, the stair, floors and ceilings, roofs, porches, and the
// site. Geometry is batched per material; ink edges are collected alongside.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from './plan.js';

const { FT, wx, wz, wy, PLATE, EXT } = P;

// ---------------------------------------------------------------- batches

export class Batch {
  constructor() {
    this.buckets = new Map();
    this.edges = [];
    this.rects = [];
  }
  bucket(key) {
    if (!this.buckets.has(key)) this.buckets.set(key, { pos: [], nor: [], uv: [], idx: [] });
    return this.buckets.get(key);
  }
  // Planar polygon (convex, counter-clockwise seen from the normal side).
  poly(pts, key, uvFn) {
    const b = this.bucket(key);
    const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
    const base = b.pos.length / 3;
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (const p of pts) {
      b.pos.push(p.x, p.y, p.z);
      b.nor.push(n.x, n.y, n.z);
      let u, v;
      if (uvFn) [u, v] = uvFn(p);
      else if (ay >= ax && ay >= az) { u = p.x; v = p.z; }
      else if (ax >= az) { u = p.z * Math.sign(n.x || 1) * -1; v = p.y; }
      else { u = p.x * Math.sign(n.z || 1); v = p.y; }
      b.uv.push(u, v);
    }
    for (let i = 1; i < pts.length - 1; i++) b.idx.push(base, base + i, base + i + 1);
  }
  // Axis-aligned box in world metres. `m` is a material key or a per-face map
  // {px, nx, py, ny, pz, nz}. `skip` lists faces to leave out. The faces are
  // held as rectangles until toObject, which resolves the ones that coincide.
  box(min, max, m, opts = {}) {
    const f = (k) => (typeof m === 'string' ? m : m[k] ?? m.other);
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    // axis, side, plane coordinate, and the rectangle on the other two axes
    const faces = {
      px: [0, 1, x1, [y0, z0, y1, z1]], nx: [0, -1, x0, [y0, z0, y1, z1]],
      py: [1, 1, y1, [x0, z0, x1, z1]], ny: [1, -1, y0, [x0, z0, x1, z1]],
      pz: [2, 1, z1, [x0, y0, x1, y1]], nz: [2, -1, z0, [x0, y0, x1, y1]],
    };
    for (const k in faces) {
      if (opts.skip?.includes(k)) continue;
      const [axis, side, c, r] = faces[k];
      this.rects.push({ axis, side, c, r, key: f(k), uv: opts.uv });
    }
    if (opts.edges !== false) this.boxEdges(min, max);
  }
  // A rectangle of an axis-aligned plane as a polygon facing `side`.
  rectPoly({ axis, side, c }, [a0, b0, a1, b1], key, uv) {
    const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
    const P = (a, b) => {
      const v = new THREE.Vector3();
      v.setComponent(axis, c).setComponent(i, a).setComponent(j, b);
      return v;
    };
    let pts = [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)];
    const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0]));
    if (n.getComponent(axis) * side < 0) pts = pts.reverse();
    this.poly(pts, key, uv);
  }
  // Box faces that share a plane z-fight, and when the section cuts the
  // boxes, the paper face of one shows through the poché of the other. Where
  // two solids meet back to back, both faces are internal and go. Where faces
  // overlap facing the same way (wall layers at a corner), the larger one
  // keeps the overlap. Glass and paper-only materials take no part.
  resolveRects(materials) {
    const solidKey = new Map();
    const solid = (key) => {
      if (!solidKey.has(key)) {
        const mat = materials[key];
        solidKey.set(key, !!mat && !mat.transparent && !mat.userData.reveal?.discard);
      }
      return solidKey.get(key);
    };
    const planes = new Map();
    this.rects.forEach((q, i) => {
      q.i = i;
      q.area = (q.r[2] - q.r[0]) * (q.r[3] - q.r[1]);
      q.solid = solid(q.key);
      const k = q.axis + ':' + Math.round(q.c * 1e5);
      if (!planes.has(k)) planes.set(k, []);
      planes.get(k).push(q);
    });
    const E = 1e-6;
    for (const list of planes.values()) {
      for (const q of list) {
        let pieces = [q.r];
        if (q.solid) {
          for (const o of list) {
            if (o === q || !o.solid) continue;
            const [c0, d0, c1, d1] = o.r;
            if (c0 >= q.r[2] - E || c1 <= q.r[0] + E || d0 >= q.r[3] - E || d1 <= q.r[1] + E) continue;
            if (o.side === q.side && (o.area < q.area || (o.area === q.area && o.i > q.i))) continue;
            const next = [];
            for (const p of pieces) {
              const [a0, b0, a1, b1] = p;
              const ia0 = Math.max(a0, c0), ib0 = Math.max(b0, d0), ia1 = Math.min(a1, c1), ib1 = Math.min(b1, d1);
              if (ia1 - ia0 <= E || ib1 - ib0 <= E) { next.push(p); continue; }
              // what is left of p around the overlap: below, above, left, right
              if (ib0 - b0 > E) next.push([a0, b0, a1, ib0]);
              if (b1 - ib1 > E) next.push([a0, ib1, a1, b1]);
              if (ia0 - a0 > E) next.push([a0, ib0, ia0, ib1]);
              if (a1 - ia1 > E) next.push([ia1, ib0, a1, ib1]);
            }
            pieces = next;
            if (!pieces.length) break;
          }
        }
        for (const p of pieces) this.rectPoly(q, p, q.key, q.uv);
      }
    }
    this.rects = [];
  }
  boxEdges([x0, y0, z0], [x1, y1, z1]) {
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
      .forEach(([a, b]) => this.edges.push(...c[a], ...c[b]));
  }
  line(a, b) { this.edges.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  // Any BufferGeometry, placed by a world matrix. UVs are projected in
  // metres like poly(), per triangle, from its dominant normal axis.
  // `edges` is a crease angle in degrees for ink lines (0 for none).
  geo(geometry, matrix, key, { edges = 0, keepUV = false } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const flip = matrix.determinant() < 0;
    const b = this.bucket(key);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let t = 0; t < p.count; t += 3) {
      const order = flip ? [0, 2, 1] : [0, 1, 2];
      let sx = 0, sy = 0, sz = 0;
      for (let k = 0; k < 3; k++) { sx += n.getX(t + k); sy += n.getY(t + k); sz += n.getZ(t + k); }
      const ax = Math.abs(sx), ay = Math.abs(sy), az = Math.abs(sz);
      const base = b.pos.length / 3;
      for (const k of order) {
        const i = t + k;
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        b.pos.push(x, y, z);
        b.nor.push(n.getX(i), n.getY(i), n.getZ(i));
        if (keepUV) b.uv.push(g.attributes.uv.getX(i), g.attributes.uv.getY(i));
        else if (ay >= ax && ay >= az) b.uv.push(x, z);
        else if (ax >= az) b.uv.push(-z * Math.sign(sx || 1), y);
        else b.uv.push(x * Math.sign(sz || 1), y);
      }
      b.idx.push(base, base + 1, base + 2);
    }
    if (edges) this.edges.push(...new THREE.EdgesGeometry(g, edges).attributes.position.array);
    g.dispose();
  }
  // Convex polygon from plan points [x, y, h] (feet), wound so its normal
  // points away from `inside` (also [x, y, h]).
  ppoly(pts, key, inside, opts = {}) {
    const W = ([x, y, h]) => new THREE.Vector3(wx(x), wy(h), wz(y));
    let v = pts.map(W);
    const n = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0]));
    if (n.dot(new THREE.Vector3().subVectors(v[0], W(inside))) < 0) v = v.reverse();
    this.poly(v, key, opts.uv);
    if (opts.edges !== false) v.forEach((p, i) => this.line(p, v[(i + 1) % v.length]));
  }
  // Box from plan feet: [x0, y0, x1, y1], heights in feet.
  pbox([x0, y0, x1, y1], h0, h1, m, opts) {
    this.box([Math.min(wx(x0), wx(x1)), wy(h0), Math.min(wz(y0), wz(y1))],
      [Math.max(wx(x0), wx(x1)), wy(h1), Math.max(wz(y0), wz(y1))], m, opts);
  }
  toObject(materials, inkMat, { shadows = true } = {}) {
    this.resolveRects(materials);
    const g = new THREE.Group();
    for (const [key, b] of this.buckets) {
      if (!b.idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setIndex(b.idx);
      const mat = materials[key];
      if (!mat) throw new Error('no material ' + key);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows && !mat.transparent;
      mesh.receiveShadow = shadows;
      mesh.name = key;
      g.add(mesh);
    }
    if (inkMat && this.edges.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(this.edges, 3));
      const lines = new THREE.LineSegments(geo, inkMat);
      lines.name = 'ink';
      lines.renderOrder = 2;
      g.add(lines);
    }
    return g;
  }
}

// ---------------------------------------------------------------- walls

// A wall rectangle in plan feet, split around its openings. Exterior walls
// are two layers: the skin (brick or board-and-batten) and the inner wall.
export function wallPieces(r, openings, height) {
  const [x0, y0, x1, y1] = r;
  const alongX = (x1 - x0) >= (y1 - y0);
  const a0 = alongX ? x0 : y0, a1 = alongX ? x1 : y1;
  const ops = [...openings].sort((p, q) => p.at - q.at);
  const pieces = [];
  let cur = a0;
  for (const o of ops) {
    const s = o.at - o.w / 2, e = o.at + o.w / 2;
    if (s > cur) pieces.push([cur, s, 0, height]);
    if (o.sill > 0) pieces.push([s, e, 0, o.sill]);
    if (o.head < height) pieces.push([s, e, o.head, height]);
    cur = e;
  }
  if (cur < a1) pieces.push([cur, a1, 0, height]);
  return pieces.map(([s, e, h0, h1]) => ({
    r: alongX ? [s, y0, e, y1] : [x0, s, x1, e], h0, h1,
  }));
}

function splitLayers(r, out, skin) {
  const [x0, y0, x1, y1] = r;
  const k = 0.33;  // brick veneer depth, feet
  switch (out) {
    case '-y': return [[x0, y0, x1, y0 + k], [x0, y0 + k, x1, y1]];
    case '+y': return [[x0, y1 - k, x1, y1], [x0, y0, x1, y1 - k]];
    case '-x': return [[x0, y0, x0 + k, y1], [x0 + k, y0, x1, y1]];
    default: return [[x1 - k, y0, x1, y1], [x0, y0, x1 - k, y1]];
  }
}

const GROUND = -0.5;  // feet: the grade sits a half foot below the floor

export function buildWalls(batch) {
  for (const w of P.extWalls) {
    const skin = w.skin || 'brick';
    for (const piece of wallPieces(w.r, w.open, PLATE)) {
      const [outer, inner] = splitLayers(piece.r, w.out);
      const h0 = piece.h0 === 0 ? GROUND : piece.h0;
      batch.pbox(outer, h0, piece.h1, skin);
      batch.pbox(inner, h0, piece.h1, 'drywall');
    }
    for (const o of w.open) buildOpening(batch, w, o);
  }
  for (const w of P.intWalls) {
    for (const piece of wallPieces(w.r, w.open, PLATE)) batch.pbox(piece.r, piece.h0, piece.h1, 'drywall');
  }
}

// ---------------------------------------------------------------- openings

// Frame of an opening in an exterior wall, in a local frame: s runs along
// the wall, the outward normal is n, depth d is measured from the outer face.
function frameFor(w) {
  const [x0, y0, x1, y1] = w.r;
  const alongX = w.out === '-y' || w.out === '+y';
  const face = { '-y': y0, '+y': y1, '-x': x0, '+x': x1 }[w.out];
  const sign = w.out[0] === '-' ? -1 : 1;  // plan direction of "out"
  // plan point from (s along wall, d inward from outer face)
  const pt = (s, d) => (alongX ? [s, face - sign * d] : [face - sign * d, s]);
  return { alongX, face, sign, pt };
}

function planBoxRaw(batch, f, s0, s1, d0, d1, h0, h1, m, opts) {
  const a = f.pt(s0, d0), b = f.pt(s1, d1);
  batch.pbox([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], h0, h1, m, opts);
}

function buildOpening(batch, w, o) {
  const f = frameFor(w);
  const X = (m) => (m === 'frame' || m === 'glass' || m === 'woodDoor' ? m + 'Ext' : m);
  const planBox = (b, ff, s0, s1, d0, d1, h0, h1, m, opts) => planBoxRaw(b, ff, s0, s1, d0, d1, h0, h1, X(m), opts);
  const s0 = o.at - o.w / 2, s1 = o.at + o.w / 2;
  const fd = 0.33;              // the window sits right behind the veneer
  const fw = 0.16;              // frame width
  if (o.kind === 'window') {
    // brick sill under the window, outside
    planBox(batch, f, s0 - 0.25, s1 + 0.25, -0.12, fd, o.sill - 0.22, o.sill, w.skin || 'brick');
    // frame
    planBox(batch, f, s0, s1, fd, fd + 0.3, o.sill, o.sill + fw, 'frame');
    planBox(batch, f, s0, s1, fd, fd + 0.3, o.head - fw, o.head, 'frame');
    planBox(batch, f, s0, s0 + fw, fd, fd + 0.3, o.sill, o.head, 'frame');
    planBox(batch, f, s1 - fw, s1, fd, fd + 0.3, o.sill, o.head, 'frame');
    if (o.pair) planBox(batch, f, o.at - 0.25, o.at + 0.25, fd, fd + 0.3, o.sill, o.head, 'frame');
    if (!o.fixed) {
      const mid = (o.sill + o.head) / 2;
      planBox(batch, f, s0, s1, fd + 0.02, fd + 0.24, mid - 0.07, mid + 0.07, 'frame');
    }
    planBox(batch, f, s0 + fw, s1 - fw, fd + 0.14, fd + 0.16, o.sill + fw, o.head - fw, 'glass', { edges: false });
    // interior trim: stool, apron and casing, white
    planBox(batch, f, s0 - 0.3, s1 + 0.3, EXT - 0.02, EXT + 0.08, o.sill - 0.08, o.sill, 'trim', { edges: false });
    planBox(batch, f, s0 - 0.2, s1 + 0.2, EXT - 0.02, EXT + 0.04, o.sill - 0.4, o.sill - 0.08, 'trim', { edges: false });
    planBox(batch, f, s0 - 0.29, s0, EXT - 0.02, EXT + 0.04, o.sill, o.head + 0.29, 'trim', { edges: false });
    planBox(batch, f, s1, s1 + 0.29, EXT - 0.02, EXT + 0.04, o.sill, o.head + 0.29, 'trim', { edges: false });
    planBox(batch, f, s0, s1, EXT - 0.02, EXT + 0.04, o.head, o.head + 0.29, 'trim', { edges: false });
    if (o.shutters) {
      const sw = o.pair ? 1.65 : o.w / 2 + 0.05;
      for (const [a, b] of [[s0 - 0.12 - sw, s0 - 0.12], [s1 + 0.12, s1 + 0.12 + sw]]) {
        const bw = (b - a) / 3;
        for (let i = 0; i < 3; i++) planBox(batch, f, a + i * bw + 0.015, a + (i + 1) * bw - 0.015, -0.16, -0.06, o.sill + 0.05, o.head - 0.05, 'cedarExt', { edges: i === 0 });
        for (const t of [0.16, 0.84]) {
          const hh = o.sill + (o.head - o.sill) * t;
          planBox(batch, f, a + 0.08, b - 0.08, -0.22, -0.16, hh - 0.15, hh + 0.15, 'cedarExt', { edges: false });
        }
      }
    }
  } else if (o.kind === 'front') {
    // double door 6068, no transom: the wall closes over the head jamb
    planBox(batch, f, s0, s1, fd, fd + 0.4, o.head - 0.18, o.head, 'woodDoor');
    planBox(batch, f, s0, s0 + 0.18, fd, fd + 0.4, 0, o.head, 'woodDoor');
    planBox(batch, f, s1 - 0.18, s1, fd, fd + 0.4, 0, o.head, 'woodDoor');
    // threshold
    planBox(batch, f, s0, s1, -0.1, EXT, -0.05, 0.03, 'stone', { edges: false });
    // lanterns either side
    for (const s of [s0 - 1.0, s1 + 1.0]) {
      planBox(batch, f, s - 0.08, s + 0.08, -0.12, -0.02, 5.7, 6.6, 'lamp', { edges: false });
      planBox(batch, f, s - 0.26, s + 0.26, -0.62, -0.1, 5.55, 5.62, 'lamp', { edges: false });
      planBox(batch, f, s - 0.26, s + 0.26, -0.62, -0.1, 6.55, 6.85, 'lamp');
      planBox(batch, f, s - 0.22, s + 0.22, -0.58, -0.14, 5.62, 6.55, 'lampGlass', { edges: false });
    }
  } else if (o.kind === 'garage') {
    planBox(batch, f, s0, s1, 0.28, 0.42, 0, o.head, 'garageDoor');
    for (let i = 1; i < 4; i++) planBox(batch, f, s0, s1, 0.25, 0.28, o.head * i / 4 - 0.03, o.head * i / 4 + 0.03, 'frame', { edges: false });
    planBox(batch, f, s0 - 0.2, s0, -0.05, 0.42, 0, o.head, 'trim', { edges: false });
    planBox(batch, f, s1, s1 + 0.2, -0.05, 0.42, 0, o.head, 'trim', { edges: false });
    planBox(batch, f, s0, s1, -0.05, EXT, GROUND, 0, 'concrete', { edges: false });
  } else if (o.kind === 'slider') {
    // the frame only; the four panels are their own objects (buildSlider)
    planBox(batch, f, s0, s1, fd, fd + 0.42, o.head - fw, o.head, 'frame');
    planBox(batch, f, s0, s1, fd, fd + 0.42, 0, 0.1, 'frame');
    planBox(batch, f, s0, s0 + fw, fd, fd + 0.42, 0, o.head, 'frame');
    planBox(batch, f, s1 - fw, s1, fd, fd + 0.42, 0, o.head, 'frame');
    planBox(batch, f, s0 - 0.3, s1 + 0.3, EXT - 0.02, EXT + 0.06, o.head, o.head + 0.33, 'trim', { edges: false });
  }
}

// The 12' slider to the rear porch, OXXO: the outer panels are fixed on the
// outside track; the middle two run on the inside track and slide open over
// them. Returns the panels with userData.open, the travel in metres.
export function buildSlider(materials, ink) {
  const w = P.extWalls.find((e) => e.id === 'rear');
  const o = w.open.find((q) => q.kind === 'slider');
  const f = frameFor(w);
  const s0 = o.at - o.w / 2 + 0.16, s1 = o.at + o.w / 2 - 0.16;
  const pw = (s1 - s0) / 4 + 0.12;     // panels overlap at the meeting stiles
  const fd = 0.33, st = 0.19, top = o.head - 0.16;
  const panels = [];
  for (let i = 0; i < 4; i++) {
    const b = new Batch();
    const a = i === 3 ? s1 - pw : i === 0 ? s0 : s0 + i * (s1 - s0) / 4 - 0.06;
    const e = a + pw;
    const inner = i === 1 || i === 2;
    const d0 = fd + (inner ? 0.24 : 0.06), d1 = d0 + 0.12;
    const box = (sa, sb, h0, h1, m, opts) => planBoxRaw(b, f, sa, sb, d0, d1, h0, h1, m, opts);
    box(a, a + st, 0.1, top, 'frameExt');
    box(e - st, e, 0.1, top, 'frameExt');
    box(a + st, e - st, 0.1, 0.42, 'frameExt');
    box(a + st, e - st, top - st, top, 'frameExt');
    planBoxRaw(b, f, a + st, e - st, d0 + 0.05, d0 + 0.07, 0.42, top - st, 'glassExt', { edges: false });
    if (inner) {
      // a pull on the meeting stile, both faces
      const hs = i === 1 ? e - 0.1 : a + 0.1;
      planBoxRaw(b, f, hs - 0.03, hs + 0.03, d0 - 0.08, d1 + 0.08, 3.1, 4.1, 'lamp', { edges: false });
    }
    const g = b.toObject(materials, ink);
    g.userData.open = inner ? (i === 1 ? -1 : 1) * (pw - 0.3) * FT : 0;
    panels.push(g);
  }
  return panels;
}

// The front doors are their own objects so they can swing open.
export function buildFrontDoors(materials, ink) {
  const w = P.extWalls.find((e) => e.id === 'entryFront');
  const o = w.open.find((q) => q.kind === 'front');
  const leafW = (o.w - 0.36) / 2, leafH = 6.67, t = 0.15;
  const leaves = [];
  for (const side of [-1, 1]) {
    const b = new Batch();
    // leaf built in local feet, hinge at x = 0, leaf extends toward +x
    const L = (x0, x1, h0, h1, z0, z1, m, opts) => b.box([x0 * FT, h0 * FT, z0 * FT], [x1 * FT, h1 * FT, z1 * FT],
      m === 'lamp' ? m : m + 'Ext', opts);
    L(0, leafW, 0, 0.6, 0, t, 'woodDoor');
    L(0, leafW, 2.6, 2.9, 0, t, 'woodDoor');
    L(0, leafW, leafH - 0.35, leafH, 0, t, 'woodDoor');
    L(0, 0.35, 0.6, leafH - 0.35, 0, t, 'woodDoor');
    L(leafW - 0.35, leafW, 0.6, leafH - 0.35, 0, t, 'woodDoor');
    L(0.35, leafW - 0.35, 0.6, 2.6, 0.03, t - 0.03, 'woodDoor');
    L(0.35, leafW - 0.35, 2.9, leafH - 0.35, t / 2 - 0.01, t / 2 + 0.01, 'glass', { edges: false });
    // simulated divided lites: 2 x 4
    L(leafW / 2 - 0.04, leafW / 2 + 0.04, 2.9, leafH - 0.35, -0.01, t + 0.01, 'woodDoor', { edges: false });
    for (let i = 1; i < 4; i++) {
      const hh = 2.9 + (leafH - 0.35 - 2.9) * i / 4;
      L(0.35, leafW - 0.35, hh - 0.04, hh + 0.04, -0.01, t + 0.01, 'woodDoor', { edges: false });
    }
    L(leafW - 0.62, leafW - 0.5, 3.0, 3.9, -0.12, -0.02, 'lamp', { edges: false });
    const leaf = b.toObject(materials, ink);
    const pivot = new THREE.Group();
    const hingeX = side < 0 ? o.at - o.w / 2 + 0.18 : o.at + o.w / 2 - 0.18;
    pivot.position.set(wx(hingeX), 0, wz(w.r[1] + 0.45));
    leaf.scale.x = side < 0 ? 1 : -1;
    leaf.position.z = -t * FT / 2;
    pivot.add(leaf);
    pivot.userData.side = side;
    leaves.push(pivot);
  }
  return leaves;
}

// ---------------------------------------------------------------- inside

export function buildInterior(batch) {
  for (const f of P.furniture) {
    const [x0, y0, x1, y1, h0, h1] = f.b;
    if (f.frame) {
      // a table base: four legs
      const lw = 0.25;
      for (const [a, b] of [[x0, y0], [x1 - lw, y0], [x0, y1 - lw], [x1 - lw, y1 - lw]]) batch.pbox([a, b, a + lw, b + lw], h0, h1, f.m);
      continue;
    }
    batch.pbox([x0, y0, x1, y1], h0, h1, f.ext ? 'black' : f.m);
  }
  // stair: first run rises toward -x, then a landing, then a run toward the front
  const s = P.stair;
  const n1 = 11, run = (s.x1 - s.x0) / n1;
  for (let i = 0; i < n1; i++) {
    const xa = s.x1 - (i + 1) * run, xb = s.x1 - i * run;
    batch.pbox([xa, s.y0, xb, s.y1], 0, (i + 1) * s.rise, 'oak');
  }
  const top = (n1 + 1) * s.rise;
  batch.pbox(s.landing, 0, top, 'oak');
  // floors, one per room, plus thresholds
  for (const r of P.rooms) {
    // the master suite takes the oak through, and marble-look tile in the bath
    const m = r.id === 'garage' ? 'garageFloor' : r.id === 'mbath' ? 'bathTile'
      : ['bath2', 'powder', 'laundry'].includes(r.id) ? 'tile' : ['bed2', 'bed3', 'closets'].includes(r.id) ? 'carpet' : 'oak';
    batch.pbox(r.r, -0.02, 0, m === 'oak' ? 'floor' : m, { edges: false, skip: ['ny', 'px', 'nx', 'pz', 'nz'] });
  }
  // baseboards wherever a wall meets the floor, and casings on the openings
  for (const r of P.rooms) if (!['garage', 'closets'].includes(r.id)) baseboards(batch, r.r);
  for (const w of P.intWalls) for (const o of w.open) casing(batch, w.r, o);
}

// Spans [a0, a1] of a room edge where some wall stands on the floor.
function solidSpans(alongX, coord, a0, a1) {
  const spans = [];
  for (const w of [...P.extWalls, ...P.intWalls]) {
    const [x0, y0, x1, y1] = w.r;
    if (((x1 - x0) >= (y1 - y0)) !== alongX) continue;
    const faces = alongX ? [y0, y1] : [x0, x1];
    if (!faces.some((f) => Math.abs(f - coord) < 0.12)) continue;
    for (const piece of wallPieces(w.r, w.open, PLATE)) {
      if (piece.h0 !== 0) continue;
      const [px0, py0, px1, py1] = piece.r;
      const lo = Math.max(alongX ? px0 : py0, a0), hi = Math.min(alongX ? px1 : py1, a1);
      if (hi - lo > 0.05) spans.push([lo, hi]);
    }
  }
  return spans;
}

function baseboards(batch, [x0, y0, x1, y1]) {
  const t = 0.06, h = 0.42;
  for (const [s0, s1] of solidSpans(true, y0, x0, x1)) batch.pbox([s0, y0, s1, y0 + t], 0, h, 'trim', { edges: false });
  for (const [s0, s1] of solidSpans(true, y1, x0, x1)) batch.pbox([s0, y1 - t, s1, y1], 0, h, 'trim', { edges: false });
  for (const [s0, s1] of solidSpans(false, x0, y0, y1)) batch.pbox([x0, s0, x0 + t, s1], 0, h, 'trim', { edges: false });
  for (const [s0, s1] of solidSpans(false, x1, y0, y1)) batch.pbox([x1 - t, s0, x1, s1], 0, h, 'trim', { edges: false });
}

// Flat 3 1/2" casing on both faces of an interior opening, and a jamb.
function casing(batch, [x0, y0, x1, y1], o) {
  const alongX = (x1 - x0) >= (y1 - y0);
  const c = 0.29, p = 0.05, s0 = o.at - o.w / 2, s1 = o.at + o.w / 2;
  const box = (a, b, h0, h1, d0, d1) => batch.pbox(alongX ? [a, d0, b, d1] : [d0, a, d1, b], h0, h1, 'trim', { edges: false });
  const [f0, f1] = alongX ? [y0, y1] : [x0, x1];
  for (const [d0, d1] of [[f0 - p, f0], [f1, f1 + p]]) {
    box(s0 - c, s0, 0, o.head + c, d0, d1);
    box(s1, s1 + c, 0, o.head + c, d0, d1);
    box(s0, s1, o.head, o.head + c, d0, d1);
  }
  box(s0, s0 + 0.04, 0, o.head, f0, f1);
  box(s1 - 0.04, s1, 0, o.head, f0, f1);
  box(s0, s1, o.head - 0.04, o.head, f0, f1);
}

// Ceilings at the plate, one per room, so each stays drawn until revealed.
// A room with its own `ceiling` height (the living room) has its walls
// carried up to it and a raised tray in the middle.
export function buildCeilings(batch) {
  const down = { edges: false, skip: ['py', 'px', 'nx', 'pz', 'nz'] };
  for (const r of P.rooms) {
    if (!r.ceiling) { batch.pbox(r.r, PLATE - 0.01, PLATE, 'ceiling', down); continue; }
    const [x0, y0, x1, y1] = r.r, c = r.ceiling, t = r.tray, k = 3.2;
    // the walls from the plate up, as a skin on the room side
    batch.pbox([x0 - 0.06, y0, x0, y1], PLATE - 0.02, c, 'drywall', { edges: false });
    batch.pbox([x1, y0, x1 + 0.06, y1], PLATE - 0.02, c, 'drywall', { edges: false });
    batch.pbox([x0, y0 - 0.06, x1, y0], PLATE - 0.02, c, 'drywall', { edges: false });
    batch.pbox([x0, y1, x1, y1 + 0.06], PLATE - 0.02, c, 'drywall', { edges: false });
    // ceiling band around the tray, the tray's sides, its ceiling, crown
    const [ix0, iy0, ix1, iy1] = [x0 + k, y0 + k, x1 - k, y1 - k];
    for (const q of [[x0, y0, x1, iy0], [x0, iy1, x1, y1], [x0, iy0, ix0, iy1], [ix1, iy0, x1, iy1]]) batch.pbox(q, c - 0.01, c, 'ceiling', down);
    for (const q of [[ix0, iy0 - 0.02, ix1, iy0], [ix0, iy1, ix1, iy1 + 0.02], [ix0 - 0.02, iy0, ix0, iy1], [ix1, iy0, ix1 + 0.02, iy1]]) {
      batch.pbox(q, c - 0.01, t, 'ceiling', { edges: false });
    }
    batch.pbox([ix0, iy0, ix1, iy1], t - 0.01, t, 'ceiling', down);
    for (const q of [[ix0 - 0.3, iy0 - 0.3, ix1 + 0.3, iy0], [ix0 - 0.3, iy1, ix1 + 0.3, iy1 + 0.3],
      [ix0 - 0.3, iy0, ix0, iy1], [ix1, iy0, ix1 + 0.3, iy1]]) batch.pbox(q, c - 0.3, c, 'trim', { edges: false });
    for (const q of [[x0, y0, x1, y0 + 0.25], [x0, y1 - 0.25, x1, y1], [x0, y0, x0 + 0.25, y1], [x1 - 0.25, y0, x1, y1]]) {
      batch.pbox(q, c - 0.35, c, 'trim', { edges: false });
    }
  }
  // simple drum light in the entry
  const c = [63.7, 17.7];
  batch.pbox([c[0] - 0.9, c[1] - 0.9, c[0] + 0.9, c[1] + 0.9], PLATE - 1.6, PLATE - 0.9, 'lampShade');
  batch.pbox([c[0] - 0.05, c[1] - 0.05, c[0] + 0.05, c[1] + 0.05], PLATE - 0.9, PLATE, 'lamp', { edges: false });
}

// ---------------------------------------------------------------- roofs

const PITCH = 1;        // 12/12
const OVER = 1.0;       // eave and rake overhang, feet
const THICK = 0.55;     // roof build-up, feet (fascia height)

function roofBlock(batch, rf, gables) {
  const [x0, y0, x1, y1] = rf.r;
  const along = rf.axis;
  const a0 = along === 'y' ? y0 : x0, a1 = along === 'y' ? y1 : x1;
  const b0 = along === 'y' ? x0 : y0, b1 = along === 'y' ? x1 : y1;
  const hs = (b1 - b0) / 2, bm = (b0 + b1) / 2;
  const R = PLATE + hs * PITCH, E = PLATE - OVER * PITCH;
  const [e0, e1] = rf.ends;
  let ra0 = e0 === 'hip' ? a0 + hs : a0 - OVER;
  let ra1 = e1 === 'hip' ? a1 - hs : a1 + OVER;
  if (ra0 > ra1) ra0 = ra1 = (a0 + a1) / 2;
  const A0 = a0 - OVER, A1 = a1 + OVER, B0 = b0 - OVER, B1 = b1 + OVER;
  // point from (a, b, h) in plan feet -> world
  const W = (a, b, h) => (along === 'y'
    ? new THREE.Vector3(wx(b), wy(h), wz(a))
    : new THREE.Vector3(wx(a), wy(h), wz(b)));
  const faces = [];
  // side faces (toward b0 and b1); eaves run along a
  faces.push({ pts: [[A0, B0, E], [ra0, bm, R], [ra1, bm, R], [A1, B0, E]], uAxis: 'a' });
  faces.push({ pts: [[A1, B1, E], [ra1, bm, R], [ra0, bm, R], [A0, B1, E]], uAxis: 'a' });
  if (e0 === 'hip') faces.push({ pts: [[A0, B1, E], [ra0, bm, R], [A0, B0, E]], uAxis: 'b' });
  if (e1 === 'hip') faces.push({ pts: [[A1, B0, E], [ra1, bm, R], [A1, B1, E]], uAxis: 'b' });
  const k = Math.SQRT2 * FT;
  for (const fc of faces) {
    let pts = fc.pts.map(([a, b, h]) => W(a, b, h));
    // make sure the top faces up
    const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0]));
    if (n.y < 0) { pts = pts.reverse(); fc.pts = [...fc.pts].reverse(); }
    const uv = (p) => {
      const a = along === 'y' ? -p.z : p.x, b = along === 'y' ? p.x : -p.z;
      return [fc.uAxis === 'a' ? a : b, (p.y / FT - E) * k];
    };
    batch.poly(pts, 'shingle', uv);
    const down = pts.map((p) => p.clone().setY(p.y - THICK * FT));
    batch.poly([...down].reverse(), 'soffit');
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const isEave = Math.abs(p.y - q.y) < 1e-4 && Math.abs(p.y - wy(E)) < 1e-3;
      const isRake = !isEave && Math.abs(p.y - q.y) > 1e-4 && (p.y < wy(R) - 1e-3 || q.y < wy(R) - 1e-3);
      if (isEave || (isRake && gables)) {
        batch.poly([p, q, down[(i + 1) % pts.length], down[i]].reverse(), 'fascia');
      }
      batch.line(p, q);
    }
  }
  // gable ends: board-and-batten triangles on the wall face
  rf.ends.forEach((e, i) => {
    if (e !== 'gable') return;
    const a = i === 0 ? a0 : a1;
    const inset = i === 0 ? 0.02 : -0.02;
    let tri = [W(a - inset * 0, b0, PLATE), W(a, b1, PLATE), W(a, bm, R - THICK * 0.6)];
    const n = new THREE.Vector3().subVectors(tri[1], tri[0]).cross(new THREE.Vector3().subVectors(tri[2], tri[0]));
    const outward = along === 'y' ? (i === 0 ? 1 : -1) : (i === 0 ? -1 : 1);
    const wantZ = along === 'y';
    if ((wantZ ? Math.sign(n.z) : Math.sign(n.x)) !== outward) tri = tri.reverse();
    batch.poly(tri, 'bb', (p) => [along === 'y' ? p.x : p.z, p.y]);
    batch.line(tri[0], tri[1]);
    // a gable vent or the theater window
    if (rf.window) {
      const ww = 3, wh = 5, sill = PLATE + 2.6;
      const f = { pt: (s, d) => [s, a - d * (i === 0 ? -1 : 1)] };
      const planBox = (b, ff, s0, s1, d0, d1, h0, h1, m, opts) => planBoxRaw(b, ff, s0, s1, d0, d1, h0, h1, m === 'frame' || m === 'glass' ? m + 'Ext' : m, opts);
      planBox(batch, f, bm - ww / 2 - 0.16, bm + ww / 2 + 0.16, -0.12, 0.2, sill - 0.16, sill + wh + 0.16, 'frame');
      planBox(batch, f, bm - ww / 2, bm + ww / 2, -0.14, -0.12, sill, sill + wh, 'glass', { edges: false });
      planBox(batch, f, bm - ww / 2, bm + ww / 2, -0.16, -0.12, sill + wh / 2 - 0.07, sill + wh / 2 + 0.07, 'frame', { edges: false });
      for (const [s, e2] of [[bm - ww / 2 - 1.75, bm - ww / 2 - 0.2], [bm + ww / 2 + 0.2, bm + ww / 2 + 1.75]]) {
        planBox(batch, f, s, e2, -0.24, -0.14, sill, sill + wh, 'cedarExt');
      }
    }
  });
}

export function buildRoofs(batch) {
  for (const rf of P.roofs) roofBlock(batch, rf, true);
  // front porch: a 6/12 shed from the cedar beam back into the main roof
  const [px0, py0, px1] = P.porches.front.r;
  const yEave = py0 - 0.5, hEave = 9.85;
  const yTop = 16.6, hTop = hEave + (yTop - yEave) * 0.5;
  const pts = [
    new THREE.Vector3(wx(px0 - 0.5), wy(hEave), wz(yEave)),
    new THREE.Vector3(wx(px1 + 0.5), wy(hEave), wz(yEave)),
    new THREE.Vector3(wx(px1 + 0.5), wy(hTop), wz(yTop)),
    new THREE.Vector3(wx(px0 - 0.5), wy(hTop), wz(yTop)),
  ];
  const k = Math.hypot(1, 0.5) / 0.5 * FT;
  batch.poly(pts, 'shingle', (p) => [p.x, (p.y / FT - hEave) * k]);
  const down = pts.map((p) => p.clone().setY(p.y - THICK * FT));
  batch.poly([...down].reverse(), 'soffit');
  batch.poly([pts[1], pts[0], down[0], down[1]], 'fascia');
  batch.line(pts[0], pts[1]); batch.line(pts[1], pts[2]); batch.line(pts[3], pts[0]);
  // porch ceilings, white beadboard, under the roofs
  batch.pbox([px0, py0 + 1.3, px1, P.porches.front.r[3]], 9.84, 9.85, 'soffit', { edges: false, skip: ['py'] });
  const [rx0, ry0, rx1, ry1] = P.porches.rear.r;
  batch.pbox([rx0, ry0, rx1, ry1 - 0.5], 9.84, 9.85, 'soffit', { edges: false, skip: ['py'] });
}

// ---------------------------------------------------------------- porches

export function buildPorches(batch) {
  const fp = P.porches.front;
  const [x0, y0, x1, y1] = fp.r;
  batch.pbox([x0, y0, x1, y1], GROUND, -0.12, 'porchSlab');
  // two steps' worth of drop at the front edge reads as one step
  for (const x of fp.posts) {
    batch.pbox([x - 0.75, y0 + 0.15, x + 0.75, y0 + 1.65], -0.12, 2.2, 'trim');
    batch.pbox([x - 0.85, y0 + 0.05, x + 0.85, y0 + 1.75], 2.2, 2.45, 'trim');
    batch.pbox([x - 0.3, y0 + 0.6, x + 0.3, y0 + 1.2], 2.45, 9.0, 'cedar');
  }
  batch.pbox([x0, y0 + 0.5, x1, y0 + 1.3], 9.0, 9.85, 'cedar');
  // rear porch: slab, cedar posts, beam
  const [rx0, ry0, rx1, ry1] = P.porches.rear.r;
  batch.pbox([rx0, ry0, rx1, ry1], GROUND, -0.12, 'porchSlab');
  for (const x of [rx0 + 0.6, rx0 + (rx1 - rx0) / 3, rx0 + 2 * (rx1 - rx0) / 3, rx1 - 0.6]) {
    batch.pbox([x - 0.3, ry1 - 1.2, x + 0.3, ry1 - 0.6], -0.12, 9.0, 'cedar');
  }
  batch.pbox([rx0, ry1 - 1.3, rx1, ry1 - 0.5], 9.0, 9.85, 'cedar');
  // side beams, post to post, so the eaves sit on wood, not in the air
  batch.pbox([rx0 + 0.3, ry0, rx0 + 0.9, ry1 - 1.3], 9.0, 9.85, 'cedar');
  batch.pbox([rx1 - 0.9, ry0, rx1 - 0.3, ry1 - 1.3], 9.0, 9.85, 'cedar');
  batch.pbox([rx0 + 0.3, ry0, rx0 + 0.9, ry0 + 0.6], -0.12, 9.0, 'cedar');
  batch.pbox([rx1 - 0.9, ry0, rx1 - 0.3, ry0 + 0.6], -0.12, 9.0, 'cedar');
}

// ---------------------------------------------------------------- site

export function buildSite(batch) {
  for (const r of P.site.walk) batch.pbox(r, GROUND, GROUND + 0.12, 'concrete', { edges: false });
  for (const r of P.site.drive) batch.pbox(r, GROUND, GROUND + 0.1, 'concrete', { edges: false });
  for (const r of P.site.beds) batch.pbox(r, GROUND, GROUND + 0.06, 'mulch', { edges: false });
  // shrubs along the front beds
  const shrubs = [];
  const add = (x, y, s) => shrubs.push([x, y, s]);
  for (let x = 3; x < 37; x += 4.2) add(x, 0.6, 1.3);
  for (let x = 40; x < 52; x += 3.4) add(x, -1.6, 1.1);
  for (let x = 77; x < 89; x += 3.4) add(x, -1.6, 1.1);
  add(54.5, 4.2, 1.0); add(73.2, 4.2, 1.0);
  return shrubs;
}

export function groundObject(materials) {
  const g = new THREE.Mesh(new THREE.CircleGeometry(320, 96).rotateX(-Math.PI / 2), materials.grass);
  g.position.y = wy(GROUND);
  g.receiveShadow = true;
  g.name = 'ground';
  return g;
}

// Loblolly pines: tall bare trunks with the crown in the top third, like the
// stand behind the house in the photo.
export function pines(materials, count, seed = 3) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const spots = [];
  let tries = 0;
  while (spots.length < count && tries++ < 20000) {
    const ang = r() * Math.PI * 2, dist = 26 + Math.pow(r(), 0.8) * 190;
    const x = Math.sin(ang) * dist, z = Math.cos(ang) * dist;
    // keep the front lawn open toward the street, and the driveway clear
    if (z > 8 && z < 75 && Math.abs(x) < 46) continue;
    if (x < -3 && x > -16 && z > -14) continue;
    if (spots.some(([a, b]) => Math.hypot(a - x, b - z) < 4.5)) continue;
    spots.push([x, z, 22 + r() * 12, r()]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.24, 1, 7, 1).translate(0, 0.5, 0);
  const crownGeo = lumpy(2, 0.22, 4.1);
  const trunks = new THREE.InstancedMesh(trunkGeo, materials.bark, spots.length);
  const clumps = 8;
  const crowns = new THREE.InstancedMesh(crownGeo, materials.needles, spots.length * clumps);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  spots.forEach(([x, z, h, k], i) => {
    m.compose(new THREE.Vector3(x, wy(GROUND), z), q.identity(), new THREE.Vector3(1 + k * 0.4, h, 1 + k * 0.4));
    trunks.setMatrixAt(i, m);
    for (let c = 0; c < clumps; c++) {
      const t = c / clumps;
      const y = h * (0.7 + t * 0.29) + (r() - 0.5);
      const spread = (1 - t) * 2.6 + 0.9;
      const ang = r() * Math.PI * 2;
      e.set(r() * 0.5, r() * 6, r() * 0.5);
      q.setFromEuler(e);
      const sz = 1.0 + (1 - t) * 1.2 + r() * 0.6;
      m.compose(new THREE.Vector3(x + Math.sin(ang) * spread * 0.7, y, z + Math.cos(ang) * spread * 0.7), q,
        new THREE.Vector3(sz * 1.4, sz * 0.55, sz * 1.25));
      crowns.setMatrixAt(i * clumps + c, m);
    }
  });
  trunks.castShadow = crowns.castShadow = true;
  const g = new THREE.Group();
  g.add(trunks, crowns);
  g.name = 'pines';
  return g;
}

function lumpy(detail, amount, seed) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 2) * Math.sin(v.z * 6.7 - seed)
      + 0.5 * Math.sin(v.x * 13 + v.z * 11 + seed);
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function shrubsObject(materials, list) {
  const geo = lumpy(3, 0.12, 1.3);
  const mesh = new THREE.InstancedMesh(geo, materials.shrub, list.length);
  const m = new THREE.Matrix4();
  list.forEach(([x, y, s], i) => {
    m.compose(new THREE.Vector3(wx(x), wy(GROUND) + s * 0.22, wz(y)), new THREE.Quaternion(), new THREE.Vector3(s * 0.42, s * 0.34, s * 0.42));
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true;
  return mesh;
}
