# Casa De AMan

A scroll-driven page for our house. It opens on the first floor plan (sheet A-2). As you scroll, the walls rise out of the drawing and the roof lands. The camera then comes down to the front porch and walks in through the front door, across the living room and out through the slider onto the rear porch, then back in through the kitchen, past the butler's pantry, to the dining table. Each room stays a line drawing until the camera gets there, and then the real finishes sweep across it.

Built from the starter prompt in [`../starter-prompt.md`](../starter-prompt.md), direction A: front door to back porch.

## Where things come from

- **Layout:** `261013 Manriquez Plans.pdf`, sheet A-2, rev 01. Every wall, opening and room is typed into `js/plan.js` in feet, read off the plan's dimension strings. The garage keeps the side-entry 18' door from the plan.
- **Finishes and colors:** the reference photo `IMG_20260126_110716.jpg`. That means white board-and-batten across the front and on the gables, white painted brick on the far ends of the house and the rear, charcoal architectural shingles, black window frames, cedar posts and shutters, and stained wood double doors.
- **Fit-out:** the kitchen follows the cabinet codes on A-2: the range and the fridge on the pantry wall, the apron sink under the 3034 window, and an island with a prep sink, cabinets toward the range and stools toward the living room. The living room's fireplace sits between the two B42 built-ins. Finishes are a modern farmhouse reading of the photo: white shaker cabinets with black hardware, a stained wood island, granite tops, subway tile, white painted brick at the fireplace with a cedar mantel, and a sage butler's pantry with brass.
- **Textures:** the brick, board-and-batten, shingles, concrete, mulch, granite, subway tile, book spines and the painting over the mantel are drawn in code (`js/textures.js`). Grass, oak, walnut, bark and fabrics are CC0 scans from Poly Haven, shared with the Casa Serra demo in `../assets/`.

## Checkpoint status

1. **Done:** the plan sheet, the walls rising, the roof landing, the front lawn, the porch, and the entry.
2. **Done:** the living room (11' ceiling with a raised tray), out through the 12' slider to the rear porch, then the kitchen, a look into the butler's pantry, and the dining room. Recording: `media/checkpoint-2.mp4`.
3. **Next:** the owner's notes on checkpoint 2.

## Run it locally

Serve the repository root, not this folder, because the textures live in `../assets/`:

```sh
npx http-server -p 8080 .
# then open http://localhost:8080/casa-de-aman/
```

Plain files with no build step: three.js 0.160, GSAP ScrollTrigger and Lenis, all loaded from CDNs. Add `?low` to the URL to force the lighter phone settings. In the console, `casa.at(0.5)` jumps to any point of the scroll.

## Files

- `js/plan.js`: the house as data. Walls, openings, rooms, roofs, furniture and site, all in plan feet.
- `js/build.js`: turns the data into geometry, batched per material, with ink edges. Also the slider's four panels, which slide open.
- `js/furnish.js`: the fitted rooms: cabinet runs, the range, hood and fridge, the island, the fireplace and built-ins, the sofa and chairs, the dining table and chairs, the porch furniture, and the hanging fixtures (pendants, chandelier, fans, cans).
- `js/reveal.js`: the paper-to-material sweep and the black poché on cut walls.
- `js/sheet.js`: the ink layer of the sheet, with room names, dimensions and door swings.
- `js/main.js`: renderer, materials, lights, camera path and the scroll timeline. Outside, the camera orbits between keys; from the entry on, it walks (eye position and heading are interpolated), so it turns on the spot and stays off the walls.
