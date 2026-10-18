// Finishes drawn in code, after the reference photo: white painted brick,
// white board-and-batten, charcoal architectural shingles, broom-finished
// concrete. Each makes a colour map and a normal map from a height field.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return c;
}

// Value noise, tileable over n px with period p cells.
function noiseField(n, cells, seed) {
  const r = rng(seed);
  const g = Array.from({ length: cells * cells }, r);
  const out = new Float32Array(n * n);
  const at = (i, j) => g[((j + cells) % cells) * cells + ((i + cells) % cells)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * cells, fy = (y / n) * cells;
      const i = Math.floor(fx), j = Math.floor(fy);
      let u = fx - i, v = fy - j;
      u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      out[y * n + x] = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
  }
  return out;
}

function fbm(n, seed, octaves = [[8, 0.5], [32, 0.3], [128, 0.2]]) {
  const out = new Float32Array(n * n);
  octaves.forEach(([cells, amp], k) => {
    const f = noiseField(n, cells, seed + k * 97);
    for (let i = 0; i < out.length; i++) out[i] += f[i] * amp;
  });
  return out;
}

function normalFromHeight(n, h, strength) {
  const c = canvas(n);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const l = h[y * n + ((x - 1 + n) % n)], r = h[y * n + ((x + 1) % n)];
      const u = h[((y - 1 + n) % n) * n + x], d = h[((y + 1) % n) * n + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * n + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function colourCanvas(n, fn) {
  const c = canvas(n);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let p = 0; p < n * n; p++) {
    const [r, g, b] = fn(p);
    img.data[p * 4] = r; img.data[p * 4 + 1] = g; img.data[p * 4 + 2] = b; img.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, srgb, metres, aniso) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.repeat.set(1 / metres, 1 / metres);
  t.anisotropy = aniso;
  return t;
}

// Modular brick, 3/8" mortar, running bond, painted white like the photo:
// the paint softens the joints and some brick texture shows through.
export function paintedBrick(n, aniso) {
  const inch = n / 64;            // the tile is 64" square
  const course = 2.667 * inch, len = 8 * inch, joint = 0.375 * inch;
  const h = new Float32Array(n * n);
  const tone = new Float32Array(n * n);
  const grain = fbm(n, 11, [[16, 0.4], [64, 0.35], [256, 0.25]]);
  const r = rng(7);
  const rows = Math.round(n / course);
  const bricks = [];
  for (let j = 0; j < rows; j++) bricks.push(Array.from({ length: 8 }, () => r()));
  for (let y = 0; y < n; y++) {
    const j = Math.floor(y / course);
    const fy = y - j * course;
    const offset = (j % 2) * len * 0.5;
    for (let x = 0; x < n; x++) {
      const xs = (x + offset) % n;
      const i = Math.floor(xs / len);
      const fx = xs - i * len;
      const ex = Math.min(fx, len - fx), ey = Math.min(fy, course - fy);
      const e = Math.min(ex, ey);
      const inMortar = e < joint * 0.5;
      const bevel = Math.min(1, Math.max(0, (e - joint * 0.5) / (joint * 0.9)));
      const g = grain[y * n + x];
      h[y * n + x] = inMortar ? 0.0 : 0.55 + bevel * 0.35 + g * 0.18;
      tone[y * n + x] = inMortar ? -1 : bricks[j % rows][i % 8];
    }
  }
  const col = colourCanvas(n, (p) => {
    const g = grain[p];
    if (tone[p] < 0) return [214 + g * 14, 210 + g * 14, 202 + g * 12];
    const k = 236 + (tone[p] - 0.5) * 10 + (g - 0.5) * 16;
    const thin = g > 0.78 ? (g - 0.78) * 90 : 0;  // paint worn thin, a hint of brick
    return [k - thin * 0.4, k - 2 - thin * 0.9, k - 7 - thin * 1.3];
  });
  return {
    map: tex(col, true, 64 * 0.0254, aniso),
    normalMap: tex(normalFromHeight(n, h, 2.2), false, 64 * 0.0254, aniso),
  };
}

// White board-and-batten: 1x3 battens every 16", boards with a soft grain.
export function boardBatten(n, aniso) {
  const inch = n / 48;
  const h = new Float32Array(n * n);
  const grain = fbm(n, 21, [[4, 0.3], [24, 0.3], [160, 0.4]]);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const fx = (x / inch) % 16;
      const d = Math.min(Math.abs(fx - 8), 16 - Math.abs(fx - 8));
      const batten = Math.abs(fx - 8) < 1.25 ? 1 : 0;
      const edge = batten ? Math.min(1, (1.25 - Math.abs(fx - 8)) * 3) : 0;
      h[y * n + x] = edge * 0.9 + grain[y * n + x] * 0.05 + (d < 0.05 ? -0.1 : 0);
    }
  }
  const col = colourCanvas(n, (p) => {
    const g = grain[p];
    const k = 240 + (g - 0.5) * 8;
    return [k, k - 1, k - 4];
  });
  return {
    map: tex(col, true, 48 * 0.0254, aniso),
    normalMap: tex(normalFromHeight(n, h, 2.6), false, 48 * 0.0254, aniso),
  };
}

// Architectural (laminated) shingles: 5 5/8" exposure, random tab widths,
// two-tone charcoal with granule speckle.
export function shingles(n, aniso) {
  const inch = n / 48;
  const exposure = 5.625 * inch;
  const h = new Float32Array(n * n);
  const tone = new Float32Array(n * n);
  const grain = fbm(n, 31, [[64, 0.3], [256, 0.7]]);
  const r = rng(5);
  const rows = Math.round(n / exposure);
  const tabs = [];
  for (let j = 0; j < rows; j++) {
    const edges = [0];
    while (edges[edges.length - 1] < n) edges.push(edges[edges.length - 1] + (4 + r() * 9) * inch);
    tabs.push({ edges, shades: edges.map(() => r()), drop: edges.map(() => r() * 1.4 * inch) });
  }
  for (let y = 0; y < n; y++) {
    const j = Math.floor(y / exposure);
    const fy = y - j * exposure;
    const t = tabs[j % rows];
    for (let x = 0; x < n; x++) {
      let k = 0;
      while (k < t.edges.length - 1 && t.edges[k + 1] <= x) k++;
      const lip = exposure - t.drop[k];
      const lower = fy > lip;
      const g = grain[y * n + x];
      h[y * n + x] = (lower ? 0.25 : 0.6) + (fy / exposure) * 0.4 + g * 0.08 - (Math.abs(x - t.edges[k]) < 1.2 ? 0.2 : 0);
      tone[y * n + x] = lower ? 0.25 : t.shades[k];
    }
  }
  const col = colourCanvas(n, (p) => {
    const g = grain[p];
    const k = 38 + tone[p] * 16 + (g - 0.5) * 30;
    return [k, k + 1, k + 4];
  });
  return {
    map: tex(col, true, 48 * 0.0254, aniso),
    normalMap: tex(normalFromHeight(n, h, 3.0), false, 48 * 0.0254, aniso),
  };
}

export function concrete(n, aniso) {
  const g = fbm(n, 41, [[6, 0.35], [40, 0.35], [220, 0.3]]);
  const col = colourCanvas(n, (p) => {
    const k = 196 + (g[p] - 0.5) * 22;
    return [k, k - 2, k - 6];
  });
  return { map: tex(col, true, 3, aniso), normalMap: tex(normalFromHeight(n, g, 0.6), false, 3, aniso) };
}

export function mulch(n, aniso) {
  const g = fbm(n, 51, [[24, 0.3], [120, 0.3], [400, 0.4]]);
  const col = colourCanvas(n, (p) => {
    const k = g[p];
    return [52 + k * 40, 34 + k * 24, 24 + k * 14];
  });
  return { map: tex(col, true, 1.2, aniso), normalMap: tex(normalFromHeight(n, g, 4), false, 1.2, aniso) };
}

// Granite counter, a warm grey: dense speckle of black mica, grey quartz
// and cream feldspar over a soft cloud. Polished, so the normal is faint.
export function granite(n, aniso) {
  const cloud = fbm(n, 61, [[3, 0.5], [12, 0.3], [48, 0.2]]);
  const fine = fbm(n, 67, [[180, 0.5], [420, 0.5]]);
  const grain = noiseField(n, Math.round(n / 3), 71);
  const grain2 = noiseField(n, Math.round(n / 5), 73);
  const col = colourCanvas(n, (p) => {
    const c = cloud[p], f = fine[p], g = grain[p], g2 = grain2[p];
    let r = 118 + (c - 0.5) * 40 + (f - 0.5) * 30, gg = r - 4, b = r - 10;
    if (g > 0.72) { const k = (g - 0.72) * 3.4; r -= 90 * k; gg -= 90 * k; b -= 88 * k; }
    if (g2 > 0.76) { const k = (g2 - 0.76) * 3.4; r += 110 * k; gg += 100 * k; b += 80 * k; }
    return [r, gg, b];
  });
  return {
    map: tex(col, true, 0.9, aniso),
    normalMap: tex(normalFromHeight(n, fine, 0.4), false, 0.9, aniso),
  };
}

// White 3x6 subway tile, running bond, with a light grey grout line.
export function subway(n, aniso) {
  const inch = n / 24;            // the tile repeat is 24" square
  const h = new Float32Array(n * n);
  const grain = fbm(n, 81, [[8, 0.6], [40, 0.4]]);
  for (let y = 0; y < n; y++) {
    const j = Math.floor(y / (3 * inch));
    const fy = y - j * 3 * inch;
    const off = (j % 2) * 3 * inch;
    for (let x = 0; x < n; x++) {
      const fx = (x + off) % (6 * inch);
      const e = Math.min(fx, 6 * inch - fx, fy, 3 * inch - fy);
      h[y * n + x] = e < 0.09 * inch ? 0 : Math.min(1, e / (0.35 * inch)) * 0.8 + grain[y * n + x] * 0.05;
    }
  }
  const col = colourCanvas(n, (p) => {
    if (h[p] === 0) return [196, 194, 188];
    const k = 238 + (grain[p] - 0.5) * 8;
    return [k, k - 1, k - 4];
  });
  return {
    map: tex(col, true, 24 * 0.0254, aniso),
    normalMap: tex(normalFromHeight(n, h, 3.0), false, 24 * 0.0254, aniso),
  };
}

// The master bath floor: 24" porcelain squares that read as Carrara, soft
// grey veins drifting across a white ground, with a thin pale grout.
export function marbleTile(n, aniso) {
  const inch = n / 48;            // a 2 x 2 block of tiles
  const warp = fbm(n, 111, [[3, 0.6], [9, 0.3], [27, 0.1]]);
  const fine = fbm(n, 117, [[60, 0.5], [200, 0.5]]);
  const r = rng(113);
  const shift = Array.from({ length: 4 }, () => [r() * 6, r() * 0.6 - 0.3]);
  const h = new Float32Array(n * n);
  const col = colourCanvas(n, (p) => {
    const x = p % n, y = Math.floor(p / n);
    const fx = x % (24 * inch), fy = y % (24 * inch);
    const e = Math.min(fx, 24 * inch - fx, fy, 24 * inch - fy);
    if (e < 0.07 * inch) { h[p] = 0; return [206, 204, 198]; }
    h[p] = 0.8;
    // each tile is cut from a different part of the slab
    const [o, tilt] = shift[(Math.floor(x / (24 * inch)) % 2) + 2 * (Math.floor(y / (24 * inch)) % 2)];
    const v = Math.abs(Math.sin((x / n) * 7 + (y / n) * 7 * tilt + warp[p] * 2.6 + o));
    const v2 = Math.abs(Math.sin((x / n) * 17 - (y / n) * 11 + warp[p] * 4 + o * 2));
    const vein = Math.pow(1 - v, 40) * 0.8 + Math.pow(1 - v, 8) * 0.12 + Math.pow(1 - v2, 90) * 0.35;
    const k = 242 + (fine[p] - 0.5) * 6 - vein * 75;
    return [k, k + 1, k + 2];
  });
  return {
    map: tex(col, true, 48 * 0.0254, aniso),
    normalMap: tex(normalFromHeight(n, h, 1.5), false, 48 * 0.0254, aniso),
  };
}

// The shower floor: 2" white hexagons with grey grout.
export function hexMosaic(n, aniso) {
  const inch = n / 12;
  const s = 1.15 * inch;          // hexagon side: 2" across the flats
  const w = Math.sqrt(3) * s, hh = 1.5 * s;
  const h = new Float32Array(n * n);
  const tone = fbm(n, 121, [[12, 1]]);
  const col = colourCanvas(n, (p) => {
    const x = p % n, y = Math.floor(p / n);
    // nearest centre on a pointy-top hex lattice
    let best = 1e9, second = 1e9;
    const row = Math.round(y / hh);
    for (let j = row - 1; j <= row + 1; j++) {
      const off = (j & 1) * w / 2;
      const i = Math.round((x - off) / w);
      for (let k = i - 1; k <= i + 1; k++) {
        const d = Math.hypot(x - (k * w + off), y - j * hh);
        if (d < best) { second = best; best = d; } else if (d < second) second = d;
      }
    }
    const e = second - best;
    if (e < 0.16 * inch) { h[p] = 0; return [168, 166, 160]; }
    h[p] = Math.min(1, e / (0.5 * inch));
    const k = 236 + (tone[p] - 0.5) * 14;
    return [k, k, k - 3];
  });
  return {
    map: tex(col, true, 12 * 0.0254, aniso),
    normalMap: tex(normalFromHeight(n, h, 2.5), false, 12 * 0.0254, aniso),
  };
}

// The shower walls: 3x12 glazed tile in a vertical stack bond, each tile a
// touch different, like handmade.
export function stackTile(n, aniso) {
  const inch = n / 24;
  const h = new Float32Array(n * n);
  const r = rng(131);
  const shade = Array.from({ length: 16 }, () => (r() - 0.5) * 12);
  const wave = fbm(n, 133, [[16, 0.6], [48, 0.4]]);
  const col = colourCanvas(n, (p) => {
    const x = p % n, y = Math.floor(p / n);
    const i = Math.floor(x / (3 * inch)), j = Math.floor(y / (12 * inch));
    const fx = x - i * 3 * inch, fy = y - j * 12 * inch;
    const e = Math.min(fx, 3 * inch - fx, fy, 12 * inch - fy);
    if (e < 0.08 * inch) { h[p] = 0; return [200, 198, 192]; }
    h[p] = Math.min(1, e / (0.3 * inch)) * 0.7 + wave[p] * 0.25;
    const k = 236 + shade[(i + j * 8) % 16] + (wave[p] - 0.5) * 10;
    return [k, k - 2, k - 6];
  });
  return {
    map: tex(col, true, 24 * 0.0254, aniso),
    normalMap: tex(normalFromHeight(n, h, 2.4), false, 24 * 0.0254, aniso),
  };
}

// Book spines for the shelves: stripes of muted cloth colours, 3/4" to 2"
// wide, with a pale band or two for titles. Mapped in world metres, so a
// box of "books" shows one spine per stripe.
export function bookSpines(n, aniso) {
  const r = rng(91);
  const palette = [[122, 52, 44], [44, 62, 82], [196, 182, 156], [58, 76, 60], [150, 112, 70], [32, 32, 34], [214, 206, 190], [96, 70, 92], [170, 128, 96]];
  const cols = [];
  const inch = n / 24;
  let x = 0;
  while (x < n) {
    const w = Math.round((0.7 + r() * 1.3) * inch);
    cols.push({ x0: x, x1: Math.min(n, x + w), c: palette[Math.floor(r() * palette.length)], band: r() * 0.5 + 0.2 });
    x += w;
  }
  const col = colourCanvas(n, (p) => {
    const px = p % n, py = Math.floor(p / n) / n;
    const s = cols.find((q) => px >= q.x0 && px < q.x1);
    const edge = px - s.x0 < 1 || s.x1 - px <= 1;
    let [cr, cg, cb] = s.c;
    if (Math.abs(py - s.band) < 0.03) { cr = cr * 0.6 + 90; cg = cg * 0.6 + 80; cb = cb * 0.6 + 60; }
    return edge ? [cr * 0.55, cg * 0.55, cb * 0.55] : [cr, cg, cb];
  });
  const t = tex(col, true, 24 * 0.0254, aniso);
  t.repeat.set(1 / (24 * 0.0254), 1 / 0.3);
  return { map: t };
}

// A loose painting for over the mantel: a pine stand at dusk, in oils.
export function painting(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#5f6f7a'); sky.addColorStop(0.45, '#c9a27a'); sky.addColorStop(0.7, '#e2bf8e'); sky.addColorStop(1, '#6d5a44');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const r = rng(101);
  // field
  ctx.fillStyle = '#7a6440'; ctx.fillRect(0, h * 0.74, w, h * 0.26);
  ctx.fillStyle = 'rgba(214,170,110,0.5)'; ctx.fillRect(0, h * 0.74, w, h * 0.04);
  // pines: tall bare trunks, crowns at the top
  for (let i = 0; i < 26; i++) {
    const x = r() * w, top = h * (0.08 + r() * 0.25), base = h * (0.72 + r() * 0.06);
    const tone = 30 + r() * 30;
    ctx.strokeStyle = `rgb(${tone + 20},${tone + 10},${tone})`;
    ctx.lineWidth = w * (0.003 + r() * 0.004);
    ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + (r() - 0.5) * w * 0.01, top + h * 0.05); ctx.stroke();
    ctx.fillStyle = `rgba(${40 + r() * 20},${52 + r() * 20},${36 + r() * 10},0.9)`;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(x + (r() - 0.5) * w * 0.05, top + r() * h * 0.12, w * (0.02 + r() * 0.025), h * (0.012 + r() * 0.02), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // brush texture
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 230 : 0},${r() > 0.5 ? 200 : 0},0.035)`;
    ctx.fillRect(r() * w, r() * h, w * 0.02 * r(), h * 0.004);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Over the dresser in the master bedroom: a salt marsh at first light, wide
// and quiet, in soft washes.
export function marsh(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#b9c3c4'); sky.addColorStop(0.7, '#e8dcc6'); sky.addColorStop(1, '#efd9b8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const r = rng(141);
  // water, then bands of marsh grass toward the front
  ctx.fillStyle = '#c9cbc2'; ctx.fillRect(0, h * 0.58, w, h * 0.1);
  const bands = [['#a39a6e', 0.62], ['#8d8457', 0.7], ['#7a6d44', 0.8], ['#5f5434', 0.9]];
  for (const [colr, y0] of bands) {
    ctx.fillStyle = colr;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, h * (y0 + (r() - 0.5) * 0.04));
    ctx.lineTo(w, h); ctx.fill();
  }
  // a far line of trees on the horizon
  ctx.fillStyle = 'rgba(92,100,92,0.75)';
  for (let x = 0; x < w; x += w / 90) ctx.fillRect(x, h * (0.56 - r() * 0.035), w / 70, h * 0.04);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 40},${r() > 0.5 ? 240 : 40},${r() > 0.5 ? 220 : 30},0.03)`;
    ctx.fillRect(r() * w, r() * h, w * 0.03 * r(), h * 0.003);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The laundry floor: 8" cement tiles, cream with a charcoal pattern. Quarter
// circles in the corners make a circle where four tiles meet; each tile has
// a thin ring and a small diamond at its middle. Mottled like the real thing.
export function cementTile(n, aniso) {
  const inch = n / 16;            // a 2 x 2 block of tiles
  const mott = fbm(n, 151, [[6, 0.5], [24, 0.3], [90, 0.2]]);
  const h = new Float32Array(n * n);
  const col = colourCanvas(n, (p) => {
    const x = p % n, y = Math.floor(p / n);
    const fx = x % (8 * inch), fy = y % (8 * inch);
    const e = Math.min(fx, 8 * inch - fx, fy, 8 * inch - fy);
    if (e < 0.06 * inch) { h[p] = 0; return [150, 146, 138]; }
    h[p] = 0.8 + mott[p] * 0.05;
    const u = Math.abs(fx / (4 * inch) - 1), v = Math.abs(fy / (4 * inch) - 1);
    const corner = Math.hypot(1 - u, 1 - v), mid = Math.hypot(u, v);
    const dark = corner < 0.5 || (corner > 0.58 && corner < 0.64) || Math.abs(mid - 0.62) < 0.045 || u + v < 0.22;
    const k = (mott[p] - 0.5) * 16;
    return dark ? [60 + k, 62 + k, 63 + k] : [233 + k, 227 + k, 213 + k];
  });
  return {
    map: tex(col, true, 16 * 0.0254, aniso),
    normalMap: tex(normalFromHeight(n, h, 1.2), false, 16 * 0.0254, aniso),
  };
}

// The powder room's wallpaper: sprigs of leaves in sage and old gold on a
// deep green ground, in a half-drop repeat of 24".
export function wallpaper(n, aniso) {
  const c = canvas(n);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2e3b33';
  ctx.fillRect(0, 0, n, n);
  const r = rng(161);
  // a faint linen weave under the print
  for (let i = 0; i < n; i += 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.02})`;
    ctx.fillRect(0, i, n, 1);
    ctx.fillRect(i, 0, 1, n);
  }
  const sprig = (cx, cy, scale, turn) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(turn);
    ctx.strokeStyle = '#a8955f';
    ctx.lineWidth = n * 0.004 * scale;
    ctx.beginPath(); ctx.moveTo(0, n * 0.09 * scale); ctx.quadraticCurveTo(n * 0.02 * scale, 0, 0, -n * 0.09 * scale); ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const t = -0.08 + k * 0.026, side = k % 2 ? 1 : -1;
      ctx.save();
      ctx.translate(n * 0.006 * scale, n * t * scale);
      ctx.rotate(side * 0.9 - 0.2);
      ctx.fillStyle = k % 3 === 0 ? '#b49f63' : '#8f9f80';
      ctx.beginPath();
      ctx.ellipse(side * n * 0.022 * scale, 0, n * 0.024 * scale, n * 0.009 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };
  // a half-drop grid of sprigs, turned this way and that; drawn with wraps
  const motifs = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) motifs.push([(i + 0.5) / 4, (j + 0.25 + (i % 2) * 0.5) / 4, 0.75 + r() * 0.3, r() * 6.3]);
  for (const [mx, my, s, t] of motifs) {
    for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) sprig((mx + ox) * n, (my + oy) * n, s * 0.9, t);
  }
  return { map: tex(c, true, 24 * 0.0254, aniso) };
}

// In the halls: an abstract of low hills, ochre and slate under a pale sky,
// laid on in broad strokes.
export function hills(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e1d0'; ctx.fillRect(0, 0, w, h);
  const r = rng(171);
  const bands = [['#c9cfcc', 0.38], ['#9aa7ad', 0.5], ['#c79a5b', 0.6], ['#6f7d86', 0.7], ['#b07c48', 0.8], ['#3f4a50', 0.9]];
  for (const [colr, y0] of bands) {
    ctx.fillStyle = colr;
    ctx.beginPath(); ctx.moveTo(0, h);
    const a = r() * 6, f = 1.5 + r() * 2;
    for (let x = 0; x <= w; x += w / 40) ctx.lineTo(x, h * (y0 + Math.sin(x / w * f * Math.PI + a) * 0.05 + (r() - 0.5) * 0.008));
    ctx.lineTo(w, h); ctx.fill();
  }
  // brush marks
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? 250 : 30},${r() > 0.5 ? 240 : 35},${r() > 0.5 ? 225 : 30},0.035)`;
    ctx.fillRect(r() * w, r() * h, w * (0.02 + r() * 0.06), h * 0.006);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Over the bed in bedroom 3 and in bath 2's toilet room: a pressed fern on
// cream paper.
export function fern(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe8da'; ctx.fillRect(0, 0, w, h);
  const r = rng(181);
  const frond = (x0, y0, len, ang, col) => {
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = len * 0.012;
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, bend = Math.sin(t * 1.4) * 0.25;
      pts.push([x0 + Math.sin(ang + bend) * len * t, y0 - Math.cos(ang + bend) * len * t]);
    }
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    for (let i = 3; i < 30; i++) {
      const t = i / 30, [x, y] = pts[i], l = len * 0.16 * Math.sin(t * Math.PI) * (1 - t * 0.3);
      for (const side of [-1, 1]) {
        const a = ang + side * (1.05 - t * 0.3);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, -l / 2, l * 0.13, l / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  };
  frond(w * 0.5, h * 0.92, h * 0.85, -0.12, '#5e6e4a');
  frond(w * 0.42, h * 0.95, h * 0.6, -0.5, '#7f8c63');
  frond(w * 0.6, h * 0.95, h * 0.55, 0.45, '#6b7a55');
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = `rgba(120,100,70,${0.02 * r()})`;
    ctx.fillRect(r() * w, r() * h, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
