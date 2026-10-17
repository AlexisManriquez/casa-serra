// The sheet under the model: paper, dimension strings, room names and
// square footage, door swings. The walls themselves are the 3D model cut at
// 4 feet; this layer only carries the annotations an architect would add.
import * as THREE from 'three';
import * as P from './plan.js';

// The sheet covers this world rect (metres): X -24..24, Z -18..18.
export const SHEET = { x0: -24, x1: 24, z0: -18, z1: 18 };

export function drawSheet(px, fonts) {
  const W = px, H = Math.round(px * (SHEET.z1 - SHEET.z0) / (SHEET.x1 - SHEET.x0));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const k = W / ((SHEET.x1 - SHEET.x0) / P.FT);   // px per foot
  const X = (x) => (P.wx(x) - SHEET.x0) / (SHEET.x1 - SHEET.x0) * W;
  const Y = (y) => (P.wz(y) - SHEET.z0) / (SHEET.z1 - SHEET.z0) * H;
  const ink = '#1d1d1f', soft = 'rgba(29,29,31,0.55)';
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round';

  // labels
  const hand = `"Architects Daughter", "Comic Neue", ui-rounded, sans-serif`;
  const roomLabel = (name, sf, x, y, small, note, vertical) => {
    ctx.save();
    ctx.translate(X(x), Y(y));
    if (vertical) ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    const s = (small ? 0.62 : 0.95) * k;
    ctx.font = `${s}px ${hand}`;
    ctx.fillText(name.toUpperCase(), 0, 0);
    if (sf) {
      ctx.font = `${s * 0.66}px ${hand}`;
      ctx.fillText(`${sf} SQ FT`, 0, s * 0.95);
    }
    if (note) {
      ctx.font = `${s * 0.66}px ${hand}`;
      ctx.fillText(note.toUpperCase(), 0, s * 2.6);
    }
    ctx.restore();
  };
  for (const r of P.rooms) if (r.name) roomLabel(r.name, r.sf, r.label[0], r.label[1], r.small, r.note, r.vertical);
  for (const l of P.labels) {
    if (l.plain) {
      ctx.fillStyle = ink; ctx.textAlign = 'center';
      ctx.font = `${0.6 * k}px ${hand}`;
      ctx.fillText(l.name, X(l.at[0]), Y(l.at[1]));
      // stair arrow, rising toward -x
      ctx.strokeStyle = ink; ctx.lineWidth = 0.05 * k;
      ctx.beginPath(); ctx.moveTo(X(25.4), Y(41.2)); ctx.lineTo(X(17.8), Y(41.2)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(17.8), Y(41.2)); ctx.lineTo(X(18.6), Y(40.8)); ctx.lineTo(X(18.6), Y(41.6)); ctx.closePath(); ctx.stroke();
      continue;
    }
    roomLabel(l.name, l.sf, l.at[0], l.at[1], l.small);
  }

  // door swings: leaf line and quarter arc, on the side the door opens to
  ctx.strokeStyle = soft;
  ctx.lineWidth = 0.045 * k;
  const swing = (wall, o) => {
    const [x0, y0, x1, y1] = wall.r;
    const alongX = (x1 - x0) >= (y1 - y0);
    const dir = o.swing === '-' ? -1 : 1;
    const leaves = o.double ? [[o.at - o.w / 2, 1], [o.at + o.w / 2, -1]] : [[o.at - o.w / 2, 1]];
    const lw = o.double ? o.w / 2 : o.w;
    for (const [hinge, sgn] of leaves) {
      const face = alongX ? (dir > 0 ? y1 : y0) : (dir > 0 ? x1 : x0);
      const hx = alongX ? hinge : face, hy = alongX ? face : hinge;
      const tipA = alongX ? [hinge + sgn * lw, face] : [face, hinge + sgn * lw];
      const tipB = alongX ? [hinge, face + dir * lw] : [face + dir * lw, hinge];
      ctx.beginPath(); ctx.moveTo(X(hx), Y(hy)); ctx.lineTo(X(tipB[0]), Y(tipB[1])); ctx.stroke();
      const a0 = Math.atan2(Y(tipA[1]) - Y(hy), X(tipA[0]) - X(hx));
      const a1 = Math.atan2(Y(tipB[1]) - Y(hy), X(tipB[0]) - X(hx));
      let d = a1 - a0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      ctx.beginPath(); ctx.arc(X(hx), Y(hy), lw * k, a0, a0 + d, d < 0); ctx.stroke();
    }
  };
  for (const w of P.intWalls) for (const o of w.open) if (o.kind === 'door') swing(w, o);
  // front doors swing in
  const ef = P.extWalls.find((w) => w.id === 'entryFront');
  swing(ef, { at: 63.7, w: 6, swing: '+', double: true });

  // porch edges, drawn dashed like the roof lines on the sheet
  ctx.setLineDash([0.5 * k, 0.35 * k]);
  ctx.strokeStyle = soft;
  const rect = ([x0, y0, x1, y1]) => ctx.strokeRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
  rect([P.porches.front.r[0], 5.7, P.porches.front.r[2], 14.2]);
  ctx.setLineDash([]);

  // dimension strings
  const fmt = (ft) => {
    const whole = Math.floor(ft + 1e-6);
    let inch = Math.round((ft - whole) * 24) / 2;
    let w2 = whole;
    if (inch >= 12) { w2 += 1; inch -= 12; }
    if (!inch) return `${w2}'`;
    const i = Math.floor(inch), half = inch % 1 ? ' 1/2' : '';
    return `${w2}'-${i}${half}"`;
  };
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.035 * k;
  const tick = (x, y) => {
    ctx.beginPath(); ctx.moveTo(x - 0.35 * k, y + 0.35 * k); ctx.lineTo(x + 0.35 * k, y - 0.35 * k); ctx.stroke();
  };
  const dimH = (y, xs, labelsAbove = true) => {
    ctx.beginPath(); ctx.moveTo(X(xs[0]) - 0.8 * k, Y(y)); ctx.lineTo(X(xs[xs.length - 1]) + 0.8 * k, Y(y)); ctx.stroke();
    ctx.font = `${0.62 * k}px ${hand}`; ctx.textAlign = 'center';
    xs.forEach((x, i) => {
      tick(X(x), Y(y));
      if (i) ctx.fillText(fmt(x - xs[i - 1]), (X(x) + X(xs[i - 1])) / 2, Y(y) + (labelsAbove ? -0.3 : 0.85) * k);
    });
  };
  const dimV = (x, ys, labelsLeft = true) => {
    ctx.beginPath(); ctx.moveTo(X(x), Y(ys[0]) + 0.8 * k); ctx.lineTo(X(x), Y(ys[ys.length - 1]) - 0.8 * k); ctx.stroke();
    ctx.font = `${0.62 * k}px ${hand}`; ctx.textAlign = 'center';
    ys.forEach((y, i) => {
      tick(X(x), Y(y));
      if (i) {
        ctx.save();
        ctx.translate(X(x) + (labelsLeft ? -0.3 : 0.85) * k, (Y(y) + Y(ys[i - 1])) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(fmt(y - ys[i - 1]), 0, 0);
        ctx.restore();
      }
    });
  };
  const W0 = 0, W1 = P.SIZE.w, D1 = P.SIZE.d;
  dimH(D1 + 3.2, [W0, 29.875, 47.46, 75.46, W1]);
  dimH(D1 + 6.2, [W0, W1]);
  dimH(-12.5, [W0, 27.58, 37.58, 52.17, 75.17, W1], false);
  dimH(-15.5, [W0, W1], false);
  dimV(-4.5, [4.1, D1]);
  dimV(W1 + 4.5, [0, 43.17, 58.17], false);
  dimV(W1 + 7.5, [0, D1], false);

  // drawing title under the plan
  ctx.textAlign = 'left';
  ctx.font = `${1.25 * k}px ${hand}`;
  ctx.fillText('FIRST FLOOR PLAN', X(0), Y(-19.5));
  ctx.font = `${0.62 * k}px ${hand}`;
  ctx.fillText('LIVING AREA 3171 SQ FT  ·  SCALE 3/16" = 1\'-0"', X(0), Y(-21.2));
  ctx.beginPath(); ctx.moveTo(X(0), Y(-19.9)); ctx.lineTo(X(20), Y(-19.9)); ctx.lineWidth = 0.07 * k; ctx.stroke();


  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function sheetObject(texture, paper) {
  const geo = new THREE.PlaneGeometry(SHEET.x1 - SHEET.x0, SHEET.z1 - SHEET.z0).rotateX(-Math.PI / 2);
  // under the paper: one big plain plane so the edge never shows
  const base = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: paper, toneMapped: false, fog: false }));
  const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false, fog: false }));
  base.position.y = -0.17;
  ink.position.y = -0.165;
  ink.position.x = (SHEET.x0 + SHEET.x1) / 2;
  ink.position.z = (SHEET.z0 + SHEET.z1) / 2;
  const g = new THREE.Group();
  g.add(base, ink);
  g.userData.ink = ink;
  g.userData.base = base;
  return g;
}
