// Casa De AMan: the plan sheet, the walls rising out of it, the roof
// landing, the walk in through the front door, the living room, out to the
// rear porch, then the kitchen, the butler's pantry and the dining room.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as P from './plan.js';
import * as B from './build.js';
import * as F from './furnish.js';
import { revealMaterial, inkMaterial, setRoomSweep, setExtSweep, PAPER, shared } from './reveal.js';
import * as T from './textures.js';
import { drawSheet, sheetObject } from './sheet.js';

const { wx, wy, wz } = P;
const params = new URLSearchParams(location.search);
const MOBILE = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const LOW = MOBILE || params.has('low');
const TEX = LOW ? '../assets/tex-1k/' : '../assets/tex/';
const SKY = '../assets/sky/';

const canvas = document.getElementById('gl');
const gl2 = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
if (!gl2) {
  document.getElementById('nogl').hidden = false;
  throw new Error('WebGL 2 not available');
}
const renderer = new THREE.WebGLRenderer({ canvas, context: gl2, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = PAPER.clone();
scene.fog = new THREE.Fog(new THREE.Color('#d9dedf'), 90, 420);
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 2000);

// ------------------------------------------------------------------ loading

const loader = document.getElementById('loader');
const fill = document.getElementById('loadFill');
const pct = document.getElementById('loadPct');
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, done, total) => {
  const p = Math.round((done / total) * 100);
  fill.style.width = p + '%';
  pct.textContent = p + '%';
};
const texLoader = new THREE.TextureLoader(manager);
const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

function scanned(name, metres, opts = {}) {
  const set = {};
  const load = (file, srgb) => {
    const t = texLoader.load(TEX + name + '/' + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.repeat.set(1 / metres, 1 / metres);
    if (opts.rotate) { t.rotation = Math.PI / 2; }
    t.anisotropy = aniso;
    return t;
  };
  set.map = load('diff.jpg', true);
  set.normalMap = load('nor.jpg', false);
  set.roughnessMap = load('arm.jpg', false);
  return set;
}

// ------------------------------------------------------------------ materials

const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), wy(4));
const clip = [cutPlane];

function std(params, flags = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  if (flags.clip) m.clippingPlanes = clip;
  if (flags.interior) m.envMapIntensity = 0.45;
  if (!flags.poche && !flags.single) m.side = THREE.DoubleSide;
  // push faces behind their ink edges; never on the ground and floors,
  // which sit a hair above the paper sheet
  if (!flags.discard) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = 1;
    m.polygonOffsetUnits = 1;
  }
  return revealMaterial(m, flags);
}

function makeMaterials() {
  const n = LOW ? 512 : 1024;
  const brick = T.paintedBrick(n, aniso);
  const bb = T.boardBatten(n, aniso);
  const sh = T.shingles(n, aniso);
  const conc = T.concrete(LOW ? 256 : 512, aniso);
  const mul = T.mulch(LOW ? 256 : 512, aniso);
  const oak = scanned('oak_wood_planks', 2.2);
  const walnut = scanned('natural_walnut_veneer', 1.4);
  const cedarTex = scanned('natural_walnut_veneer', 1.1);
  const grass = scanned('withered_grass', 3.2);
  const bark = scanned('pine_bark', 1.0);
  const linen = scanned('rough_linen', 0.8);
  const rug = scanned('poly_wool_herringbone', 1.2);
  const marble = scanned('marble_01', 1.6);
  const leather = scanned('leather_red_02', 1.0);
  const stoneWall = scanned('rustic_stone_wall', 2.0);
  const plaster = scanned('white_stucco', 3.0);
  const gran = T.granite(LOW ? 512 : 1024, aniso);
  const tile = T.subway(LOW ? 512 : 1024, aniso);
  const spines = T.bookSpines(LOW ? 256 : 512, aniso);
  const n2 = (k) => new THREE.Vector2(k, k);

  const roofed = { ext: true, roofCut: wy(P.PLATE) + 0.01 };
  const C = { clip: true, poche: true };
  const CI = { clip: true, poche: true, interior: true };
  const cedar = { ...cedarTex, color: new THREE.Color(1.12, 0.68, 0.43), roughness: 0.72 };
  const M = {
    brick: std({ ...brick, roughness: 0.92, color: '#ffffff' }, C),
    bb: std({ ...bb, roughness: 0.6 }, C),
    drywall: std({ color: '#e8e2d6', roughness: 0.93, ...plaster, map: null, normalScale: new THREE.Vector2(0.15, 0.15) }, CI),
    trim: std({ color: '#f4f2ec', roughness: 0.45 }, CI),
    frame: std({ color: '#1a1a1b', roughness: 0.5 }, C),
    frameExt: std({ color: '#1a1a1b', roughness: 0.5 }, { ...C, ext: true }),
    glass: std({ color: '#2a3236', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false }, { clip: true, discard: true }),
    glassExt: std({ color: '#2a3236', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false }, { clip: true, discard: true, ext: true }),
    woodDoor: std({ ...walnut, color: new THREE.Color(1.05, 0.64, 0.4), roughness: 0.5 }, C),
    woodDoorExt: std({ ...walnut, color: new THREE.Color(1.05, 0.64, 0.4), roughness: 0.5 }, { ...C, ext: true }),
    cedar: std(cedar, C),
    cedarExt: std({ ...cedarTex, color: new THREE.Color(1.12, 0.68, 0.43), roughness: 0.7 }, { ...C, ext: true }),
    stone: std({ ...marble, color: '#9b9690', roughness: 0.3 }, CI),
    lamp: std({ color: '#111112', roughness: 0.4, metalness: 0.6 }, C),
    lampGlass: std({ color: '#ffd9a0', emissive: new THREE.Color('#ffb860'), emissiveIntensity: 1.6, roughness: 0.3 }, { clip: true, ext: true }),
    garageDoor: std({ ...walnut, color: new THREE.Color(0.78, 0.4, 0.3), roughness: 0.5 }, { ...C, ext: true }),
    shingle: std({ ...sh, roughness: 0.88 }, { ...roofed, single: true }),
    soffit: std({ color: '#f2f1ec', roughness: 0.7 }, roofed),
    fascia: std({ color: '#202022', roughness: 0.6 }, roofed),
    floor: std({ ...oak, color: new THREE.Color(1.22, 1.12, 1.0), roughness: 0.62 }, { clip: true, discard: true, interior: true, single: true }),
    oak: std({ ...oak, color: new THREE.Color(1.18, 1.06, 0.92), roughness: 0.62 }, CI),
    tile: std({ color: '#d9d6cf', roughness: 0.4 }, { clip: true, discard: true, interior: true, single: true }),
    carpet: std({ ...linen, color: '#cbc4b8', roughness: 1 }, { clip: true, discard: true, interior: true, single: true }),
    garageFloor: std({ ...conc, roughness: 0.85 }, { clip: true, discard: true, interior: true, single: true }),
    cab: std({ color: '#e9e6df', roughness: 0.55 }, CI),
    steel: std({ color: '#b9bcbf', roughness: 0.3, metalness: 0.85 }, CI),
    walnut: std({ ...walnut, roughness: 0.55 }, CI),
    linen: std({ ...linen, color: '#e3ddd2', roughness: 1 }, CI),
    rug: std({ ...rug, color: '#d8d0c2', roughness: 1 }, CI),
    leather: std({ ...leather, color: new THREE.Color(1.25, 0.86, 0.62), roughness: 0.55 }, CI),
    fireBrick: std({ ...brick, roughness: 0.92, color: '#f6f3ee' }, CI),
    stoneWall: std({ ...stoneWall, color: '#ffffff', roughness: 0.9 }, CI),
    porcelain: std({ color: '#f6f6f4', roughness: 0.15 }, CI),
    black: std({ color: '#1c1c1d', roughness: 0.6 }, { ...C, ext: true }),
    ceiling: std({ color: '#f1efea', roughness: 0.95 }, { interior: true }),
    lampShade: std({ color: '#f7ecd8', emissive: new THREE.Color('#ffd8a8'), emissiveIntensity: 0.9, roughness: 0.8 }, { interior: true }),
    porchSlab: std({ ...conc, roughness: 0.8 }, { ...C, ext: true }),
    concrete: std({ ...conc, roughness: 0.85 }, { ext: true, discard: true }),
    mulch: std({ ...mul, roughness: 1 }, { ext: true, discard: true }),
    grass: std({ ...grass, color: new THREE.Color(1.08, 0.94, 0.72), roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6) },
      { ext: true, discard: true, hole: true, single: true }),
    bark: std({ ...bark, roughness: 1 }, { ext: true, discard: true }),
    needles: std({ color: '#36432a', roughness: 1 }, { ext: true, discard: true }),
    shrub: std({ color: '#3f4c2c', roughness: 1 }, { ext: true, discard: true }),

    // fitted rooms (furnish.js): casework, upholstery, fixtures
    islandWood: std({ ...walnut, color: new THREE.Color(0.98, 0.62, 0.4), roughness: 0.5 }, CI),
    pantryPaint: std({ color: '#6c7765', roughness: 0.5 }, CI),
    granite: std({ ...gran, roughness: 0.16, normalScale: n2(0.3) }, CI),
    hearth: std({ ...gran, color: '#8a8580', roughness: 0.55 }, CI),
    subway: std({ ...tile, roughness: 0.12 }, CI),
    hw: std({ color: '#151515', roughness: 0.38, metalness: 0.55 }, CI),
    brass: std({ color: '#c49d5c', roughness: 0.28, metalness: 1 }, CI),
    castIron: std({ color: '#1b1b1b', roughness: 0.75, metalness: 0.3 }, CI),
    darkGlass: std({ color: '#0d0e0f', roughness: 0.08, metalness: 0.3 }, CI),
    sofa: std({ ...linen, map: null, color: '#d6cab6', roughness: 1 }, CI),
    pillowA: std({ ...linen, color: '#a8653f', roughness: 1 }, CI),
    pillowB: std({ ...linen, color: '#5c6a73', roughness: 1 }, CI),
    throw: std({ ...linen, map: null, color: '#e9e2d4', roughness: 1 }, CI),
    chairLinen: std({ ...linen, map: null, color: '#d3c3a8', roughness: 1 }, CI),
    drape: std({ ...linen, map: null, color: '#eee5d6', roughness: 1 }, CI),
    rugBorder: std({ ...rug, color: '#7a7064', roughness: 1 }, CI),
    rug2: std({ ...rug, color: '#c9ab92', roughness: 1 }, CI),
    rug2Border: std({ ...rug, color: '#6b5244', roughness: 1 }, CI),
    tableOak: std({ ...oak, color: new THREE.Color(0.92, 0.74, 0.58), roughness: 0.55 }, CI),
    beam: std({ ...cedar }, CI),
    soot: std({ color: '#121110', roughness: 1 }, CI),
    logs: std({ ...bark, color: '#8a7360', roughness: 1 }, CI),
    ember: std({ color: '#200800', emissive: new THREE.Color('#ff5a12'), emissiveIntensity: 2.4, roughness: 1 }, { ...CI, discard: true }),
    flame: std({ color: '#000000', emissive: new THREE.Color('#ff5e14'), emissiveIntensity: 1.7, transparent: true, opacity: 0.6, depthWrite: false }, { clip: true, discard: true, interior: true }),
    flameCore: std({ color: '#000000', emissive: new THREE.Color('#ffa63c'), emissiveIntensity: 1.8, transparent: true, opacity: 0.7, depthWrite: false }, { clip: true, discard: true, interior: true }),
    art: std({ map: T.painting(768, 540), roughness: 0.75 }, CI),
    books: std({ ...spines, roughness: 0.8 }, CI),
    ceramic: std({ color: '#ede7dc', roughness: 0.35 }, CI),
    pottery: std({ color: '#3e3b36', roughness: 0.7 }, CI),
    basket: std({ ...linen, color: '#a8885a', roughness: 1, normalScale: n2(2) }, CI),
    greenery: std({ color: '#4a5c35', roughness: 0.75 }, CI),
    lemon: std({ color: '#e9c43c', roughness: 0.5 }, CI),
    candle: std({ color: '#f3efe6', roughness: 0.6 }, CI),
    iron: std({ color: '#161617', roughness: 0.45, metalness: 0.6 }, { interior: true }),
    bulb: std({ color: '#fff2dc', emissive: new THREE.Color('#ffcf90'), emissiveIntensity: 2.6, roughness: 0.3 }, { interior: true }),
    shadeIn: std({ color: '#f4efe6', emissive: new THREE.Color('#ffd9a6'), emissiveIntensity: 0.7, roughness: 0.6 }, { interior: true }),
    teak: std({ ...cedarTex, color: new THREE.Color(1.0, 0.66, 0.44), roughness: 0.7 }, C),
    cushion: std({ ...linen, map: null, color: '#e8e2d6', roughness: 1 }, C),
    porchCeiling: std({ ...oak, color: new THREE.Color(1.15, 0.78, 0.55), roughness: 0.7 }, C),
    rockerPaint: std({ color: '#1f2021', roughness: 0.55 }, C),
    planter: std({ color: '#232425', roughness: 0.6 }, C),
  };
  // the ground circle has unit UVs; scale its tiling up to metres
  for (const k of ['map', 'normalMap', 'roughnessMap']) M.grass[k].repeat.set(640 / 3.2, 640 / 3.2);
  return M;
}

// ------------------------------------------------------------------ scene

const inkClip = inkMaterial();
inkClip.clippingPlanes = clip;
const inkFree = inkMaterial({ opacity: 0.85, ext: true, roofCut: wy(P.PLATE) + 0.01 });

let M, roofGroup, ceilingGroup, doors, slider, pantryDoor, fire, sheet, sky, sun, lights;

async function build() {
  M = makeMaterials();

  const arch = new B.Batch();
  B.buildWalls(arch);
  B.buildInterior(arch);
  B.buildPorches(arch);
  F.furnish(arch);
  scene.add(arch.toObject(M, inkClip));

  const roof = new B.Batch();
  B.buildRoofs(roof);
  roofGroup = roof.toObject(M, inkFree);
  scene.add(roofGroup);

  const ceil = new B.Batch();
  B.buildCeilings(ceil);
  F.fixtures(ceil);
  ceilingGroup = ceil.toObject(M, inkClip, { shadows: false });
  ceilingGroup.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  scene.add(ceilingGroup);

  doors = B.buildFrontDoors(M, inkClip);
  doors.forEach((d) => scene.add(d));
  slider = B.buildSlider(M, inkClip);
  slider.forEach((p) => scene.add(p));
  pantryDoor = F.pantryDoor(M, inkClip, B.Batch);
  scene.add(pantryDoor);
  fire = F.fire(M);
  scene.add(fire);

  const siteB = new B.Batch();
  const shrubs = B.buildSite(siteB);
  scene.add(siteB.toObject(M, null));
  scene.add(B.shrubsObject(M, shrubs));
  scene.add(B.groundObject(M));
  scene.add(B.pines(M, LOW ? 90 : 170));

  // the plan sheet
  await Promise.race([
    document.fonts.load('40px "Architects Daughter"'),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  sheet = sheetObject(drawSheet(LOW ? 4096 : 6144), PAPER);
  scene.add(sheet);

  // sky and light: late afternoon, sun low from the front right
  const skyTex = texLoader.load(SKY + 'qwantani_late_afternoon_puresky.jpg');
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  sky.rotation.y = 2.2;
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader(manager).load(SKY + 'qwantani_late_afternoon_puresky_1k.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    dirty = true;
  });

  sun = new THREE.DirectionalLight(new THREE.Color('#ffdcb4'), 3.4);
  const az = THREE.MathUtils.degToRad(38), el = THREE.MathUtils.degToRad(21);
  sun.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(80);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 2048 : 4096, LOW ? 2048 : 4096);
  const sc = sun.shadow.camera;
  sc.left = -24; sc.right = 24; sc.top = 20; sc.bottom = -20; sc.near = 20; sc.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  const entryLight = new THREE.PointLight(new THREE.Color('#ffd2a0'), 6, 9, 2);
  entryLight.position.set(wx(63.7), wy(8.2), wz(17.7));
  scene.add(entryLight);
  const porchLight = new THREE.PointLight(new THREE.Color('#ffc890'), 2.5, 6, 2);
  porchLight.position.set(wx(63.7), wy(6.3), wz(13.4));
  scene.add(porchLight);

  // warm lamps in the rooms ahead, off until each room is revealed
  const lamp = (color, max, dist, x, y, h) => {
    const l = new THREE.PointLight(new THREE.Color(color), 0, dist, 2);
    l.position.set(wx(x), wy(h), wz(y));
    l.userData.max = max;
    scene.add(l);
    return l;
  };
  lights = {
    living: lamp('#ffd2a0', 9, 13, 63.7, 31.6, 9.6),
    fire: lamp('#ff8c40', 4, 6, 71.4, 31.55, 1.8),
    kitchen: lamp('#ffd2a0', 7, 10, 45.85, 27.7, 5.5),
    pantry: lamp('#ffd6a8', 5, 7, 32.6, 20.0, 8.6),
    dining: lamp('#ffcd96', 6, 8, 45.2, 8.65, 5.8),
    rear: lamp('#ffc890', 2.5, 7, 61.25, 50.7, 8.3),
  };
}

function setSun(azDeg, elDeg) {
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg);
  sun.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(80);
}

// ------------------------------------------------------------------ camera path

// Each key: look-at target, azimuth/elevation of the camera around it (deg),
// distance (m) and vertical field of view (deg). Plan keys are fitted to the
// screen; walk keys are written as eye position and a point looked at.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DRAW = { x0: wx(-8), x1: wx(98), z0: wz(72), z1: wz(-23) };

function fitDist(w, h, fov, aspect) {
  const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  return Math.max(h / (2 * t), w / (2 * t * aspect));
}

function eye(pos, look, fov) {
  const d = pos.clone().sub(look);
  const dist = d.length();
  return { target: look, az: THREE.MathUtils.radToDeg(Math.atan2(d.x, d.z)), el: THREE.MathUtils.radToDeg(Math.asin(d.y / dist)), dist, fov,
    pos, yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(-d.y / dist) };
}
// a point in plan feet at height h
const at = (x, y, h) => V(wx(x), wy(h), wz(y));

// keep the horizontal view of eye-level shots on tall screens
function adaptFov(fov, aspect) {
  const ref = 1.5;
  if (aspect >= ref) return fov;
  const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * Math.min(1.7, ref / aspect);
  return THREE.MathUtils.radToDeg(2 * Math.atan(t));
}

let KEYS = [];
function makeKeys(aspect) {
  const W = DRAW.x1 - DRAW.x0, H = DRAW.z1 - DRAW.z0;
  const cx = (DRAW.x0 + DRAW.x1) / 2, cz = (DRAW.z0 + DRAW.z1) / 2;
  const fov0 = 2.4;
  const t0 = Math.tan(THREE.MathUtils.degToRad(fov0) / 2);
  let target, dist;
  if (aspect >= 1) {
    const vh = Math.max(H / 0.86, W / 0.6 / aspect);
    dist = vh / 2 / t0;
    target = V(cx - 0.2 * vh * aspect, 0, cz);
  } else {
    const vw = W / 0.94;
    const vh = Math.max(vw / aspect, H / 0.5);
    dist = vh / 2 / t0;
    target = V(cx, 0, cz + 0.17 * vh);
  }
  const k1fov = 16, k2fov = 30;
  return [
    { target, az: 0, el: 89.99, dist, fov: fov0 },
    { target: V(0.4, 0.6, 1.2), az: -12, el: 54, dist: fitDist(36, 30, k1fov, aspect), fov: k1fov },
    { target: V(wx(56), 1.2, wz(22)), az: 24, el: 27, dist: fitDist(34, 22, k2fov, aspect), fov: k2fov },
    { target: V(wx(62), wy(9), wz(12)), az: 14, el: 11, dist: 26, fov: adaptFov(40, aspect) },
    eye(V(wx(60), wy(5.3), wz(-62)), V(wx(57), wy(9.5), wz(14.2)), adaptFov(42, aspect)),
    eye(V(wx(63.7), wy(5.3), wz(7.2)), V(wx(63.7), wy(5.6), wz(26)), adaptFov(54, aspect)),
    eye(V(wx(63.7), wy(5.3), wz(13.2)), V(wx(63.2), wy(0), wz(22.5)), adaptFov(60, aspect)),
    eye(V(wx(68.2), wy(5.3), wz(16.4)), V(wx(56.5), wy(2.6), wz(26)), adaptFov(60, aspect)),
    // checkpoint 2: from here the camera walks (see placeCamera)
    eye(at(55.6, 22.4, 5.4), at(71.5, 34.0, 4.0), adaptFov(58, aspect)),         // 8 living
    eye(at(62.0, 37.0, 5.4), at(63.4, 52.0, 4.6), adaptFov(56, aspect)),         // 9 the slider
    eye(at(61.6, 46.4, 5.3), at(73.0, 60.0, 4.8), adaptFov(58, aspect)),         // 10 rear porch
    eye(at(61.2, 55.6, 5.2), at(62.5, 80.0, 6.8), adaptFov(58, aspect)),         // 11 the pines
    eye(at(62.9, 44.2, 5.4), at(52.0, 34.0, 4.5), adaptFov(56, aspect)),         // 12 (passing) the slider
    eye(at(54.0, 34.2, 5.4), at(41.5, 28.4, 3.8), adaptFov(56, aspect)),         // 13 kitchen
    eye(at(48.5, 15.8, 5.4), at(45.3, 42.3, 4.6), adaptFov(50, aspect)),         // 14 the sink wall
    eye(at(41.9, 16.5, 5.3), at(29.0, 17.4, 4.2), adaptFov(54, aspect)),         // 15 pantry
    eye(at(50.4, 19.0, 5.5), at(44.0, 2.0, 4.2), adaptFov(58, aspect)),          // 16 dining
    eye(at(49.4, 17.2, 5.5), at(44.0, 1.0, 4.8), adaptFov(54, aspect)),          // 17 out the windows
  ];
}
const WALK = 7;   // keys from here on are interpolated as a walk

// Monotone cubic through integer knots, so nothing overshoots between keys.
function monotone(values, t) {
  const n = values.length;
  const i = Math.min(n - 2, Math.max(0, Math.floor(t)));
  const u = t - i;
  const d = (k) => values[Math.min(n - 1, k + 1)] - values[Math.max(0, k)];
  const slope = (k) => {
    if (k <= 0 || k >= n - 1) return d(Math.max(0, Math.min(n - 2, k)));
    const a = values[k] - values[k - 1], b = values[k + 1] - values[k];
    if (a * b <= 0) return 0;
    return (2 * a * b) / (a + b);
  };
  const p0 = values[i], p1 = values[i + 1], m0 = slope(i), m1 = slope(i + 1);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
}

const UP_Y = V(0, 1, 0), UP_PLAN = V(0, 0, -1);
function placeCamera(t) {
  if (t > WALK) return walkCamera(t - WALK);
  const ch = (f) => KEYS.slice(0, WALK + 1).map(f);
  const tx = monotone(ch((k) => k.target.x), t);
  const ty = monotone(ch((k) => k.target.y), t);
  const tz = monotone(ch((k) => k.target.z), t);
  const az = THREE.MathUtils.degToRad(monotone(ch((k) => k.az), t));
  const el = THREE.MathUtils.degToRad(Math.min(89.99, monotone(ch((k) => k.el), t)));
  const dist = Math.exp(monotone(ch((k) => Math.log(k.dist)), t));
  const fov = 2 * Math.atan(Math.exp(monotone(ch((k) => Math.log(Math.tan(THREE.MathUtils.degToRad(k.fov) / 2))), t)));
  const target = V(tx, ty, tz);
  camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(target);
  const upMix = THREE.MathUtils.smoothstep(THREE.MathUtils.radToDeg(el), 70, 89);
  camera.up.copy(UP_Y).lerp(UP_PLAN, upMix).normalize();
  camera.fov = THREE.MathUtils.radToDeg(fov);
  camera.near = Math.max(0.05, Math.min(dist * 0.6, dist - 40));
  camera.far = dist + 1400;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

// Indoors the camera walks: the eye position and the heading are
// interpolated, not an orbit, so it turns on the spot and keeps off walls.
function walkCamera(t) {
  const keys = KEYS.slice(WALK);
  const yaws = [];
  keys.forEach((k, i) => {
    let y = k.yaw;
    if (i) while (y - yaws[i - 1] > Math.PI) y -= 2 * Math.PI;
    if (i) while (y - yaws[i - 1] < -Math.PI) y += 2 * Math.PI;
    yaws.push(y);
  });
  const ch = (f) => keys.map(f);
  const yaw = monotone(yaws, t), pitch = monotone(ch((k) => k.pitch), t);
  camera.position.set(monotone(ch((k) => k.pos.x), t), monotone(ch((k) => k.pos.y), t), monotone(ch((k) => k.pos.z), t));
  const fov = 2 * Math.atan(Math.exp(monotone(ch((k) => Math.log(Math.tan(THREE.MathUtils.degToRad(k.fov) / 2))), t)));
  camera.up.copy(UP_Y);
  camera.fov = THREE.MathUtils.radToDeg(fov);
  camera.near = 0.12;
  camera.far = 1400;
  camera.lookAt(camera.position.clone().add(V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))));
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ the scroll

const state = {
  hero: 0, cam: 0, cut: wy(4), roof: 1, ink: 1, ext: 0, sky: 0, door: 0, entry: 0,
  living: 0, slider: 0, sun: 0, kitchen: 0, pantry: 0, dining: 0,
};
const DOOR_W = V(wx(63.7), 0, wz(14.2));
const ENTRY_C = V(wx(63.7), wy(4), wz(15.4));
// where each room's sweep starts: the opening the camera comes through
const SWEEP = {
  living: [at(63.7, 20.6, 4), 11], kitchen: [at(51.8, 31.0, 4), 12],
  pantry: [at(37.8, 17.0, 4), 8], dining: [at(45.0, 14.2, 4), 8],
};

const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
tl.to(state, { hero: 1, duration: 6, ease: 'power1.in' }, 1.5)
  .to(state, { cam: 1, duration: 17, ease: 'sine.inOut' }, 5)
  .to(state, { cut: wy(10.5), duration: 19, ease: 'power1.inOut' }, 9)
  .to(state, { cut: 80, duration: 0.5 }, 29)
  .to(state, { ink: 0.35, duration: 14 }, 24)
  .to(state, { cam: 2, duration: 14, ease: 'sine.inOut' }, 22)
  .to(state, { roof: 0, duration: 10, ease: 'power2.inOut' }, 30)
  .to(state, { cam: 3, duration: 10, ease: 'sine.in' }, 38)
  .to(state, { cam: 4, duration: 11, ease: 'sine.out' }, 48)
  .to(state, { ink: 0, duration: 8 }, 48)
  .to(state, { ext: 1, duration: 16, ease: 'power1.in' }, 50)
  .to(state, { sky: 1, duration: 10 }, 53)
  .to(state, { cam: 5, duration: 12, ease: 'sine.inOut' }, 66)
  .to(state, { door: 1, duration: 8, ease: 'power1.inOut' }, 74)
  .to(state, { cam: 6, duration: 7, ease: 'sine.inOut' }, 79)
  .to(state, { entry: 1, duration: 9, ease: 'power1.inOut' }, 82)
  .to(state, { cam: 7, duration: 9, ease: 'sine.inOut' }, 89)
  // checkpoint 2
  .to(state, { cam: 8, duration: 12, ease: 'sine.inOut' }, 100)
  .to(state, { living: 1, duration: 11, ease: 'power1.inOut' }, 101)
  .to(state, { sun: 1, duration: 12, ease: 'sine.inOut' }, 100)
  .to(state, { cam: 9, duration: 11, ease: 'sine.inOut' }, 118)
  .to(state, { slider: 1, duration: 8, ease: 'power1.inOut' }, 124)
  .to(state, { cam: 10, duration: 12, ease: 'sine.inOut' }, 131)
  .to(state, { cam: 11, duration: 10, ease: 'sine.inOut' }, 145)
  .to(state, { cam: 13, duration: 15, ease: 'sine.inOut' }, 159)
  .to(state, { kitchen: 1, duration: 11, ease: 'power1.inOut' }, 164)
  .to(state, { sun: 0, duration: 13, ease: 'sine.inOut' }, 166)
  .to(state, { cam: 14, duration: 11, ease: 'sine.inOut' }, 180)
  .to(state, { cam: 15, duration: 11, ease: 'sine.inOut' }, 195)
  .to(state, { pantry: 1, duration: 9, ease: 'power1.inOut' }, 199)
  .to(state, { cam: 16, duration: 13, ease: 'sine.inOut' }, 212)
  .to(state, { dining: 1, duration: 11, ease: 'power1.inOut' }, 214)
  .to(state, { cam: 17, duration: 9, ease: 'sine.inOut' }, 227)
  .to({}, { duration: 5 }, 236);

// stops shown along the way: [start, end] in timeline time
const STOPS = [
  { at: [58, 79], no: '01', name: 'Front porch', text: "23' × 8' · cedar posts on white brick, double doors with a transom" },
  { at: [84, 101], no: '02', name: 'Entry', text: "136 sq ft · a 16' cased opening into the living room" },
  { at: [106, 129], no: '03', name: 'Living', text: "483 sq ft · an 11' ceiling with a raised tray, the fireplace between built-ins, a 12' four-panel slider" },
  { at: [135, 157], no: '04', name: 'Rear porch', text: "28' × 15' · cedar posts under a gable roof, out to the pines" },
  { at: [168, 196], no: '05', name: 'Kitchen', text: "393 sq ft · custom cabinets, granite tops, a 10' island, the sink under the window" },
  { at: [201, 214], no: '06', name: "Butler's pantry", text: '165 sq ft · glass-front uppers, a second sink and a coffee station, off the kitchen' },
  { at: [220, 242], no: '07', name: 'Dining', text: '197 sq ft · a table for ten under an iron chandelier, the front lawn through the windows' },
];

const ui = {
  hero: document.getElementById('hero'),
  titleblock: document.getElementById('titleblock'),
  stop: document.getElementById('stop'),
  stopNo: document.getElementById('stopNo'),
  stopName: document.getElementById('stopName'),
  stopText: document.getElementById('stopText'),
  count: document.getElementById('count'),
  hint: document.getElementById('hint'),
  rulerNow: document.getElementById('rulerNow'),
};

let dirty = true;
function apply() {
  const t = tl.time();
  placeCamera(state.cam);
  cutPlane.constant = state.cut;
  if (roofGroup) {
    roofGroup.position.y = state.roof * 9;
    roofGroup.visible = state.roof < 0.999;
    ceilingGroup.visible = state.roof < 0.02;
    sheet.userData.ink.material.opacity = state.ink;
    doors.forEach((d) => { d.rotation.y = -d.userData.side * state.door * THREE.MathUtils.degToRad(160); });
    sky.material.opacity = state.sky;
    sky.visible = state.sky > 0.001;
    sky.position.copy(camera.position);
    scene.background = state.sky > 0.999 ? null : PAPER;
    // once the sky is in, drop the paper well under the grass, out of its depth
    sheet.userData.base.position.y = state.sky > 0.999 ? -3 : -0.17;
  }
  setExtSweep(DOOR_W, state.ext <= 0 ? 0 : 0.5 + state.ext * state.ext * 420);
  setRoomSweep('entry', ENTRY_C, state.entry * 9);
  for (const id in SWEEP) setRoomSweep(id, SWEEP[id][0], state[id] * SWEEP[id][1]);
  if (lights) {
    for (const id of ['living', 'kitchen', 'pantry', 'dining']) lights[id].intensity = lights[id].userData.max * state[id];
    const flick = 0.85 + 0.1 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 17.1);
    lights.fire.intensity = lights.fire.userData.max * state.living * flick;
    lights.rear.intensity = lights.rear.userData.max * state.slider;
    fire.children.forEach((f, i) => { if (f.userData.h) f.scale.y = P.FT * (0.85 + 0.2 * Math.sin(t * (5 + i) + i * 2)); });
    slider.forEach((p) => { p.position.x = p.userData.open * state.slider; });
    // from inside, the window tint that reads dark from the lawn would make
    // the view out look dull; thin it once the walk is past the entry
    M.glass.opacity = M.glassExt.opacity = 0.32 - 0.18 * state.living;
    setSun(38 + state.sun * 44, 21 - state.sun * 7);
    // a lower sun throws longer shadows: widen the shadow camera with it
    const sc = sun.shadow.camera, k = 1 + state.sun * 0.6;
    if (sc.right !== 24 * k) {
      sc.left = -24 * k; sc.right = 24 * k; sc.top = 20 * k; sc.bottom = -20 * k; sc.far = 160 + state.sun * 60;
      sc.updateProjectionMatrix();
    }
  }
  shared.uEdgeGlow.value = 1;

  ui.hero.style.opacity = String(1 - state.hero);
  ui.hero.style.transform = `translateY(${-state.hero * 30}px)`;
  ui.hero.style.visibility = state.hero > 0.99 ? 'hidden' : 'visible';
  ui.titleblock.style.opacity = String(Math.max(0, 1 - state.hero * 1.4));
  ui.hint.style.opacity = String(Math.max(0, 1 - tl.time() / 3));
  const s = STOPS.find((x) => t >= x.at[0] && t <= x.at[1]);
  if (s) {
    ui.stopNo.textContent = s.no;
    ui.stopName.textContent = s.name;
    ui.stopText.textContent = s.text;
  }
  ui.stop.classList.toggle('on', !!s);
  const passed = STOPS.filter((x) => t >= x.at[0]).length;
  ui.count.innerHTML = `<b>${String(passed).padStart(2, '0')}</b> / 07 stops`;
  ui.rulerNow.style.transform = `translateY(${tl.progress() * 100}%)`;
  dirty = true;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  KEYS = makeKeys(camera.aspect);
  apply();
}

function render() {
  if (!dirty || !roofGroup) return;
  dirty = false;
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------ start

await build();
await new Promise((res) => {
  if (manager.itemsLoaded >= manager.itemsTotal && manager.itemsTotal > 0) return res();
  manager.onLoad = res;
  setTimeout(res, 20000);
});
resize();
addEventListener('resize', resize);
renderer.compile(scene, camera);
render();
loader.classList.add('done');

gsap.registerPlugin(ScrollTrigger);
const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => { lenis.raf(time * 1000); render(); });
gsap.ticker.lagSmoothing(0);
tl.eventCallback('onUpdate', apply);
ScrollTrigger.create({ trigger: '#track', start: 'top top', end: 'bottom bottom', animation: tl, scrub: 1.1 });

// For recording and checking a single frame: casa.at(0.5) jumps there.
window.casa = {
  tl, state,
  at(p) { tl.progress(p); apply(); dirty = true; render(); },
  scene, shared, camera, renderer,
  info: () => renderer.info,
};
document.documentElement.classList.add('ready');
