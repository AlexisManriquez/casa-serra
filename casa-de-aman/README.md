# Casa De AMan

A scroll-driven page for our house. It opens on the first floor plan (sheet A-2). As you scroll, the walls rise out of the drawing and the roof lands. The camera then comes down to the front porch and walks in through the front door. Each room stays a line drawing until the camera gets there, and then the real finishes sweep across it.

Built from the starter prompt in [`../starter-prompt.md`](../starter-prompt.md), direction A: front door to back porch.

## Where things come from

- **Layout:** `261013 Manriquez Plans.pdf`, sheet A-2, rev 01. Every wall, opening and room is typed into `js/plan.js` in feet, read off the plan's dimension strings. The garage keeps the side-entry 18' door from the plan.
- **Finishes and colors:** the reference photo `IMG_20260126_110716.jpg`. That means white painted brick, white board-and-batten on the porch wall and the gables, charcoal architectural shingles, black window frames, cedar posts and shutters, and stained wood double doors.
- **Textures:** the brick, board-and-batten, shingles, concrete and mulch are drawn in code (`js/textures.js`). Grass, oak, walnut, bark and fabrics are CC0 scans from Poly Haven, shared with the Casa Serra demo in `../assets/`.

## Checkpoint status

1. **Done:** the plan sheet, the walls rising, the roof landing, the front lawn, the porch, and the entry.
2. **Next:** the living room (11' ceiling), out through the 12' slider to the rear porch, then the kitchen, the butler's pantry and the dining room.

## Run it locally

Serve the repository root, not this folder, because the textures live in `../assets/`:

```sh
npx http-server -p 8080 .
# then open http://localhost:8080/casa-de-aman/
```

Plain files with no build step: three.js 0.160, GSAP ScrollTrigger and Lenis, all loaded from CDNs. Add `?low` to the URL to force the lighter phone settings. In the console, `casa.at(0.5)` jumps to any point of the scroll.

## Files

- `js/plan.js`: the house as data. Walls, openings, rooms, roofs, furniture and site, all in plan feet.
- `js/build.js`: turns the data into geometry, batched per material, with ink edges.
- `js/reveal.js`: the paper-to-material sweep and the black poché on cut walls.
- `js/sheet.js`: the ink layer of the sheet, with room names, dimensions and door swings.
- `js/main.js`: renderer, materials, camera path and the scroll timeline.
