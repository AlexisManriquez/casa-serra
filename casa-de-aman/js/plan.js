// Casa De AMan, first floor, read off sheet A-2 (rev 01, 10/13/2026).
// Everything here is in feet, on the sheet: x runs left to right from the
// garage side wall, y runs from the front of the house (0) toward the rear.
// The builder turns it into metres and world space.

export const FT = 0.3048;
export const SIZE = { w: 89.75, d: 63.125 };   // 89'-9" by 63'-1 1/2"
export const PLATE = 10;                        // wall plate height
export const EXT = 0.83;                        // exterior wall, brick veneer + 2x6
export const INT = 0.375;                       // interior wall, 2x4 + drywall

// plan feet -> world metres. Front of the house faces +Z.
export function wx(x) { return (x - SIZE.w / 2) * FT; }
export function wz(y) { return (SIZE.d / 2 - y) * FT; }
export function wy(h) { return h * FT; }

// Openings. `at` is the centre along the wall (x for walls running along x,
// y for walls running along y). Sizes follow the plan's codes, e.g. 3060SH is
// 3'0" wide by 6'0" tall, single hung, with the head at 8'.
const win = (at, w, h, extra = {}) => ({ kind: 'window', at, w, sill: 8 - h, head: 8, ...extra });
const door = (at, w, extra = {}) => ({ kind: 'door', at, w, sill: 0, head: 6.67, ...extra });
const cased = (at, w, head = 6.67) => ({ kind: 'open', at, w, sill: 0, head });

// Exterior walls as rectangles [x0, y0, x1, y1] with the side that faces out.
// The front of the house is board-and-batten; brick stays on the far ends
// (the garage side and the bedroom side) and the rear.
export const extWalls = [
  { id: 'garageFront', r: [0, 4.1, 27.6, 4.93], out: '-y', skin: 'bb',
    open: [win(4.6, 3, 6, { shutters: true }), win(23.1, 3, 6, { shutters: true })] },
  { id: 'left', r: [0, 4.1, 0.83, 63.125], out: '-x',
    open: [{ kind: 'garage', at: 16.5, w: 18, sill: 0, head: 8 }, win(53.8, 4, 4, { fixed: true })] },
  { id: 'nookLeft', r: [26.77, 4.1, 27.6, 12.13], out: '+x', skin: 'bb', open: [] },
  { id: 'pantryFront', r: [27.6, 11.3, 37.6, 12.13], out: '-y', skin: 'bb',
    open: [win(32.6, 3, 4, { shutters: true })] },
  { id: 'diningLeft', r: [37.6, 0, 38.43, 12.13], out: '-x', skin: 'bb', open: [] },
  { id: 'diningFront', r: [37.6, 0, 52.2, 0.83], out: '-y', skin: 'bb',
    open: [win(44.9, 6.5, 6, { pair: true, shutters: true })] },
  { id: 'diningRight', r: [51.37, 0, 52.2, 15.03], out: '+x', skin: 'bb', open: [] },
  { id: 'entryFront', r: [52.2, 14.2, 75.2, 15.03], out: '-y', skin: 'bb',
    open: [win(56.3, 3, 6, { shutters: true }), { kind: 'front', at: 63.7, w: 6, sill: 0, head: 6.85 },
      win(70.8, 3, 6, { shutters: true })] },
  { id: 'bed3Left', r: [75.2, 0, 76.03, 15.03], out: '-x', skin: 'bb', open: [] },
  { id: 'bed3Front', r: [75.2, 0, 89.75, 0.83], out: '-y', skin: 'bb',
    open: [win(82.5, 6.5, 6, { pair: true, shutters: true })] },
  { id: 'right', r: [88.92, 0, 89.75, 43.17], out: '+x', open: [win(21.8, 4, 1, { fixed: true })] },
  { id: 'rear', r: [29.07, 42.34, 89.75, 43.17], out: '+y',
    open: [win(44.9, 3, 3.33), { kind: 'slider', at: 63, w: 12, sill: 0, head: 8 },
      win(78.2, 3, 5), win(86.9, 3, 5)] },
  { id: 'masterRight', r: [29.07, 42.34, 29.9, 63.125], out: '+x', open: [] },
  { id: 'masterRear', r: [0, 62.3, 29.9, 63.125], out: '+y', open: [win(16.4, 3, 5), win(26.8, 3, 5)] },
];

// Interior walls [x0, y0, x1, y1]. Swing: which side the door leaf opens to.
export const intWalls = [
  { r: [0.83, 28.6, 27.1, 29.1], open: [door(6.85, 4, { swing: '+', double: true }), door(24.9, 3, { swing: '+' })] },
  { r: [27.1, 28.6, 37.6, 29.1], open: [door(31.5, 3, { swing: '-' })] },
  { r: [27.1, 12.13, 27.6, 28.6], open: [] },
  { r: [37.6, 12.13, 37.98, 42.34], open: [door(17.0, 3, { swing: '-' }), cased(38.4, 3)] },
  { r: [51.8, 15.03, 52.2, 42.34], open: [cased(17.0, 4), cased(32.0, 16, 8)] },
  { r: [52.2, 20.4, 75.2, 20.8], open: [cased(63.0, 16, 8)] },
  { r: [75.2, 15.03, 75.58, 42.34], open: [cased(17.0, 4)] },
  // bedroom wing: hall, two closets, toilet room, bath 2
  { r: [75.58, 14.82, 88.92, 15.2], open: [door(77.4, 2.67, { swing: '-' }), door(81.74, 2.33, { swing: '-' }), door(85.7, 2.67, { swing: '-' })] },
  { r: [75.58, 28.4, 88.92, 28.78], open: [door(77.4, 2.67, { swing: '+' }), door(81.74, 2.33, { swing: '+' }), door(85.7, 2.67, { swing: '+' })] },
  { r: [79.2, 15.2, 79.58, 28.4], open: [] },
  { r: [83.9, 15.2, 84.28, 28.4], open: [door(21.8, 2.33, { swing: '-' })] },
  { r: [79.58, 20.0, 83.9, 20.38], open: [] },
  { r: [79.58, 23.6, 83.9, 23.98], open: [] },
  { r: [86.4, 19.3, 88.92, 19.65], open: [] },
  { r: [86.4, 24.0, 88.92, 24.35], open: [] },
  // master wing
  { r: [0.83, 34.5, 13.4, 34.88], open: [] },
  { r: [0.83, 45.3, 13.4, 45.68], open: [door(6.85, 3, { swing: '+' })] },
  { r: [13.4, 29.1, 13.78, 62.3], open: [door(35.9, 2.67, { swing: '-' }), door(53.9, 4, { swing: '-', double: true })] },
  { r: [13.78, 42.96, 29.07, 43.34], open: [door(27.8, 2.67, { swing: '+' })] },
  { r: [0.83, 56.9, 4.58, 57.28], open: [] },
  { r: [4.2, 57.28, 4.58, 62.3], open: [door(59.9, 2.5, { swing: '+', glass: true })] },
  { r: [0.83, 50.8, 4.58, 51.18], open: [] },
  { r: [4.2, 45.68, 4.58, 50.8], open: [door(48.6, 2.33, { swing: '+' })] },
  // laundry, stair, powder
  { r: [13.78, 37.6, 17.2, 37.98], open: [] },
  { r: [17.2, 39.0, 22.58, 39.38], open: [] },
  { r: [22.2, 29.1, 22.58, 39.0], open: [door(37.0, 3, { swing: '+' })] },
  { r: [33.5, 29.1, 33.88, 36.1], open: [door(32.3, 2.67, { swing: '+' })] },
  { r: [33.5, 35.72, 37.6, 36.1], open: [] },
];

// Rooms: clear floor area, label, plan square footage. `zone` groups rects
// that reveal together.
export const rooms = [
  { id: 'entry', name: 'Entry', sf: 136, r: [52.2, 15.03, 75.2, 20.4], label: [58, 17.7] },
  { id: 'living', name: 'Living', sf: 483, r: [52.2, 20.8, 75.2, 42.34], label: [63.5, 30.5], note: "11' ceiling ht", ceiling: 11, tray: 12 },
  { id: 'kitchen', name: 'Kitchen', sf: 393, r: [37.98, 14.2, 51.8, 42.34], label: [49.6, 19] },
  { id: 'dining', name: 'Dining', sf: 197, r: [38.43, 0.83, 51.37, 14.2], label: [41.5, 2.6] },
  { id: 'pantry', name: "Butler's pantry", sf: 165, r: [27.6, 12.13, 37.6, 28.6], label: [32.6, 20] },
  { id: 'hall', name: 'Mudbench', sf: 0, r: [22.58, 29.1, 37.6, 42.34], label: [31.2, 39] },
  { id: 'hall', name: '', r: [13.78, 37.98, 29.07, 42.96] },
  { id: 'powder', name: 'Powder', sf: 25, r: [33.88, 29.1, 37.6, 35.72], label: [35.7, 31.4], small: true },
  { id: 'laundry', name: 'Laundry', sf: 0, r: [13.78, 29.1, 22.2, 37.6], label: [18, 34.6] },
  { id: 'garage', name: 'Garage', sf: 644, r: [0.83, 4.93, 27.1, 28.6], label: [13.8, 16.6] },
  { id: 'storage', name: 'Storage', sf: 71, r: [0.83, 29.1, 13.4, 34.5], label: [7.1, 31.8] },
  { id: 'mcloset', name: 'Mstr closet', sf: 132, r: [0.83, 34.88, 13.4, 45.3], label: [7.1, 40.1] },
  { id: 'mbath', name: 'Master bath', sf: 181, r: [0.83, 45.68, 13.4, 62.3], label: [8.4, 54.0] },
  { id: 'mbed', name: 'Master bdrm', sf: 310, r: [13.78, 43.34, 29.07, 62.3], label: [21.4, 58.6] },
  { id: 'bed2', name: 'Bedroom 2', sf: 194, r: [75.58, 28.78, 88.92, 42.34], label: [80.5, 38.6] },
  { id: 'bed3', name: 'Bedroom 3', sf: 194, r: [76.03, 0.83, 88.92, 14.82], label: [80.5, 11.6] },
  { id: 'bhall', name: '', r: [75.58, 15.2, 79.2, 28.4] },
  { id: 'closets', name: '', r: [79.58, 15.2, 83.9, 28.4] },
  { id: 'bath2', name: 'Bath 2', sf: 72, r: [84.28, 15.2, 88.92, 28.4], label: [86.2, 21.8], small: true, vertical: true },
];

// Extra labels for spaces that are not revealed rooms.
export const labels = [
  { name: 'Porch', sf: 171, at: [63.7, 9.4] },
  { name: 'Porch', sf: 412, at: [61.3, 51.5] },
  { name: 'Shower', sf: 20, at: [2.5, 61.2], small: true },
  { name: 'Potty', sf: 20, at: [2.5, 49.6], small: true },
  { name: 'Closet', sf: 22, at: [81.74, 17.6], small: true },
  { name: 'Closet', sf: 22, at: [81.74, 26.2], small: true },
  { name: 'UP', at: [21.5, 41.1], small: true, plain: true },
];

// The building outline seen from outside (exterior faces), used for the
// roof-free ground hole and the ceiling.
export const footprint = [
  [0, 4.1, 27.6, 28.6], [0, 28.6, 29.9, 63.125], [27.6, 11.3, 37.6, 43.17],
  [37.6, 0, 52.2, 43.17], [52.2, 14.2, 75.2, 43.17], [75.2, 0, 89.75, 43.17],
];

// The same outline pulled in to the middle of the exterior walls. A point
// inside belongs to a room; outside it belongs to the exterior.
export const interiorMask = [
  [0.4, 4.5, 27.2, 28.6], [0.4, 28.6, 29.5, 62.7], [27.2, 11.7, 38.1, 42.75],
  [38.0, 0.4, 51.8, 14.6], [38.0, 14.6, 52.2, 42.75], [51.8, 14.6, 75.6, 42.75],
  [75.6, 0.4, 89.35, 14.6], [75.2, 14.6, 89.35, 42.75],
];

export const porches = {
  front: { r: [52.2, 6.2, 75.2, 14.2], posts: [59.4, 68.0] },
  rear: { r: [47.5, 43.17, 75.0, 58.2] },
};

// Roof masses, 12/12 pitch. Ridge runs along `axis`; each end is a hip or a
// gable. Read from the elevations on A-4 and the hip lines on A-2.
export const roofs = [
  { id: 'garage', r: [0, 4.1, 27.6, 40], axis: 'y', ends: ['gable', 'hip'], window: true },
  { id: 'master', r: [0, 30, 29.9, 63.125], axis: 'y', ends: ['hip', 'hip'] },
  { id: 'main', r: [27.6, 15.4, 89.75, 43.17], axis: 'x', ends: ['hip', 'hip'] },
  { id: 'nook', r: [27.6, 11.3, 37.6, 22], axis: 'y', ends: ['hip', 'hip'] },
  { id: 'dining', r: [37.6, 0, 52.2, 24], axis: 'y', ends: ['gable', 'hip'] },
  { id: 'bed3', r: [75.2, 0, 89.75, 24], axis: 'y', ends: ['gable', 'hip'] },
  { id: 'rearPorch', r: [47.5, 36, 75.0, 58.2], axis: 'y', ends: ['hip', 'gable'] },
];

// Furniture and built-ins, as boxes [x0, y0, x1, y1, z0, z1] in feet.
export const furniture = [
  // the kitchen, living, dining room, butler's pantry and the master suite
  // are fitted out in furnish.js
  // bedrooms
  { m: 'linen', b: [82.4, 32.8, 88.92, 38.0, 0, 2.1] },
  { m: 'linen', b: [82.4, 4.6, 88.92, 9.8, 0, 2.1] },
  // baths, powder, laundry
  { m: 'porcelain', b: [86.5, 19.65, 88.92, 24.0, 0, 1.8] },
  { m: 'cab', b: [87.4, 15.2, 88.92, 19.3, 0, 2.95] },
  { m: 'cab', b: [87.4, 24.35, 88.92, 28.4, 0, 2.95] },
  { m: 'porcelain', b: [80.7, 21.4, 82.1, 22.9, 0, 1.4] },
  { m: 'porcelain', b: [35.0, 29.3, 36.4, 30.8, 0, 1.4] },
  { m: 'cab', b: [33.88, 34.0, 37.6, 35.72, 0, 2.8] },
  { m: 'steel', b: [15.3, 29.1, 17.5, 31.6, 0, 3.2] },
  { m: 'steel', b: [17.6, 29.1, 19.8, 31.6, 0, 3.2] },
  // mudbench
  { m: 'cab', b: [29.9, 41.0, 37.6, 42.34, 0, 1.6] },
  { m: 'cab', b: [29.9, 42.0, 37.6, 42.34, 1.6, 6.5] },
];

// Stair to the theater over the garage: up toward the master wing, a
// landing, then a second run toward the front.
export const stair = { x0: 17.2, x1: 26.0, y0: 39.38, y1: 42.96, rise: 0.65, landing: [13.78, 37.98, 17.2, 42.96] };

// Site, in plan feet.
export const site = {
  walk: [[61.2, -8, 66.2, 6.2], [-14, -8, 66.2, -4]],
  drive: [[-30, -120, -14, 4], [-30, 4, 0, 30]],
  beds: [[0, -3, 37.6, 4.1], [38.2, -3.2, 52.2, 0], [52.2, 2.2, 61.0, 6.2], [66.4, 2.2, 75.2, 6.2], [75.2, -3.2, 89.75, 0]],
};
