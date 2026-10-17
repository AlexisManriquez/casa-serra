// The drawing-to-material sweep. Every material in the house is patched so
// that, until the camera gets there, it renders as paper with ink edges. Each
// room and the exterior own a sweep (a growing sphere); inside it the real,
// lit material shows. Walls also render their back faces in ink, so a wall
// cut by the section plane reads as solid black poché, like on the sheet.
import * as THREE from 'three';
import { rooms, interiorMask, wx, wz, wy } from './plan.js';

export const PAPER = new THREE.Color('#f3f0e8');
export const INK = new THREE.Color('#1d1d1f');

const NR = rooms.length;
function srgb(c) {
  const s = c.clone().convertLinearToSRGB();
  return new THREE.Vector3(s.r, s.g, s.b);
}
const NM = interiorMask.length;

// Rect in world xz: (minX, minZ, maxX, maxZ), padded so wall faces on a room
// edge belong to it.
function worldRect([x0, y0, x1, y1], pad) {
  const a = wx(x0 - pad), b = wx(x1 + pad);
  const c = wz(y1 + pad), d = wz(y0 - pad);
  return new THREE.Vector4(Math.min(a, b), Math.min(c, d), Math.max(a, b), Math.max(c, d));
}

export const shared = {
  uRoomRect: { value: rooms.map((r) => worldRect(r.r, 0.2)) },
  uRoomSweep: { value: rooms.map(() => new THREE.Vector4(0, 0, 0, 0)) },
  uMask: { value: interiorMask.map((r) => worldRect(r, 0)) },
  uExtSweep: { value: new THREE.Vector4(0, 0, 0, 0) },
  // compared after the colour-space conversion, so these are sRGB values
  uPaper: { value: srgb(PAPER) },
  uInk: { value: srgb(INK) },
  uEdgeGlow: { value: 1 },
  // 1 while the section plane cuts the walls: only then do back faces read
  // as poché. Once it lifts, a back face is an open shell seen from inside.
  uSection: { value: 1 },
  // rooms taller than the plate (the living room's tray): roofs are cut
  // away below their ceiling, not just below the plate
  uRoofHiRect: { value: worldRect(rooms.find((r) => r.tray).r, 0.25) },
  uRoofHi: { value: wy(rooms.find((r) => r.tray).tray) + 0.02 },
};

// Rooms that share an id reveal together.
export function setRoomSweep(id, centre, radius) {
  rooms.forEach((r, i) => {
    if (r.id === id) shared.uRoomSweep.value[i].set(centre.x, centre.z, centre.y, radius);
  });
}
export function setExtSweep(centre, radius) {
  shared.uExtSweep.value.set(centre.x, centre.y, centre.z, radius);
}

const GLSL_COMMON = /* glsl */ `
uniform vec4 uRoomRect[${NR}];
uniform vec4 uRoomSweep[${NR}];
uniform vec4 uMask[${NM}];
uniform vec4 uExtSweep;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uEdgeGlow;
uniform float uSection;
uniform vec4 uRoofHiRect;
uniform float uRoofHi;
uniform float uForceExt;
uniform float uDiscard;
uniform float uPoche;
uniform float uHole;
uniform float uRoofCut;
varying vec3 vRevealPos;
varying vec3 vRevealN;

bool inRect(vec2 p, vec4 r) { return p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w; }

float sweep(float d, float r) { return 1.0 - smoothstep(r - 0.45, r, d); }

float revealAt(vec3 p) {
  bool inside = false;
  for (int i = 0; i < ${NM}; i++) { if (inRect(p.xz, uMask[i])) inside = true; }
  if (uForceExt > 0.5 || !inside) {
    if (uExtSweep.w <= 0.0) return 0.0;
    return sweep(distance(p, uExtSweep.xyz), uExtSweep.w);
  }
  float rv = 0.0;
  for (int i = 0; i < ${NR}; i++) {
    vec4 s = uRoomSweep[i];
    if (s.w > 0.0 && inRect(p.xz, uRoomRect[i])) {
      vec3 d = vec3(p.x - s.x, (p.y - s.z) * 0.7, p.z - s.y);
      rv = max(rv, sweep(length(d), s.w));
    }
  }
  return rv;
}
`;

function patchVertex(src) {
  return src
    .replace('#include <common>', '#include <common>\nvarying vec3 vRevealPos;\nvarying vec3 vRevealN;')
    .replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec4 rp = vec4(transformed, 1.0);
    vec3 rn = vec3(0.0, 1.0, 0.0);
    #ifdef REVEAL_NORMAL
      rn = objectNormal;
    #endif
    #ifdef USE_INSTANCING
      rp = instanceMatrix * rp;
      rn = mat3(instanceMatrix) * rn;
    #endif
    vRevealPos = (modelMatrix * rp).xyz;
    vRevealN = normalize(mat3(modelMatrix) * rn);
  }`);
}

const FRAG_HEAD = (src) => src
  .replace('#include <common>', '#include <common>\n' + GLSL_COMMON)
  .replace('void main() {', `void main() {
  float rv = revealAt(vRevealPos);
  if (uDiscard > 0.5 && rv < 0.01) discard;
  if (uHole > 0.5 || (uRoofCut > 0.0 && vRevealPos.y < uRoofCut)) {
    for (int i = 0; i < ${NM}; i++) { if (inRect(vRevealPos.xz, uMask[i])) discard; }
  }
  if (uRoofCut > 0.0 && vRevealPos.y < uRoofHi && inRect(vRevealPos.xz, uRoofHiRect)) discard;`);

// Surfaces: after the lit colour is computed and tone mapped, mix toward
// paper where the sweep has not arrived. A thin ink line rides the front.
function patchSurface(shader, flags) {
  Object.assign(shader.uniforms, shared, {
    uForceExt: { value: flags.ext ? 1 : 0 },
    uDiscard: { value: flags.discard ? 1 : 0 },
    uPoche: { value: flags.poche ? 1 : 0 },
    uHole: { value: flags.hole ? 1 : 0 },
    uRoofCut: { value: flags.roofCut || 0 },
  });
  shader.vertexShader = '#define REVEAL_NORMAL\n' + patchVertex(shader.vertexShader);
  shader.fragmentShader = FRAG_HEAD(shader.fragmentShader).replace(
    '#include <premultiplied_alpha_fragment>',
    `{
    vec3 n = normalize(vRevealN);
    float shade = 0.93 + 0.07 * n.y - 0.035 * abs(n.x);
    vec3 drawn = uPaper * shade;
    if (uPoche > 0.5 && uSection > 0.5 && !gl_FrontFacing) {
      gl_FragColor = vec4(uInk, 1.0);
    } else {
      gl_FragColor.rgb = mix(drawn, gl_FragColor.rgb, rv);
      gl_FragColor.a = mix(1.0, gl_FragColor.a, rv);
      float band = smoothstep(0.25, 0.5, rv) * smoothstep(0.75, 0.5, rv);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uInk, band * 0.35 * uEdgeGlow);
    }
  }
  #include <premultiplied_alpha_fragment>`,
  );
}

export function revealMaterial(mat, flags = {}) {
  mat.onBeforeCompile = (shader) => patchSurface(shader, flags);
  mat.customProgramCacheKey = () => 'reveal-surface';
  if (flags.poche) mat.side = THREE.DoubleSide;
  mat.userData.reveal = flags;
  return mat;
}

// Ink edges: hidden once the room behind them is revealed.
export function inkMaterial(opts = {}) {
  const mat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: opts.opacity ?? 0.9, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, {
      uForceExt: { value: opts.ext ? 1 : 0 }, uDiscard: { value: 0 }, uPoche: { value: 0 }, uHole: { value: 0 },
      uRoofCut: { value: opts.roofCut || 0 },
    });
    shader.vertexShader = patchVertex(shader.vertexShader);
    shader.fragmentShader = FRAG_HEAD(shader.fragmentShader).replace(
      '#include <premultiplied_alpha_fragment>',
      `if (rv > 0.6) discard;
  gl_FragColor.a *= 1.0 - rv;
  #include <premultiplied_alpha_fragment>`,
    );
  };
  mat.customProgramCacheKey = () => 'reveal-ink';
  return mat;
}
