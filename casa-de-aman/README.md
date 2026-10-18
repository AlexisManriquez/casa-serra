# Casa De AMan

A scroll-driven page for our house. It opens on the first floor plan (sheet A-2). As you scroll, the walls rise out of the drawing and the roof lands. The camera then comes down to the front porch and walks in through the front door, across the living room and out through the slider onto the rear porch, then back in through the kitchen, past the butler's pantry, to the dining table. Each room stays a line drawing until the camera gets there, and then the real finishes sweep across it. From the dining table you can explore the house on foot, and every other room but the garage and storage sweeps in the same way as you walk into it: the master suite, the two bedrooms with bath 2, the powder room, the laundry and the mudbench hall.

Built from the starter prompt in [`../starter-prompt.md`](../starter-prompt.md), direction A: front door to back porch.

## Where things come from

- **Layout:** `261013 Manriquez Plans.pdf`, sheet A-2, rev 01. Every wall, opening and room is typed into `js/plan.js` in feet, read off the plan's dimension strings. The garage keeps the side-entry 18' door from the plan. One short wall is added behind the laundry, where it meets the stair landing, which the sheet leaves open.
- **Finishes and colors:** the reference photo `IMG_20260126_110716.jpg`. That means white board-and-batten across the front and on the gables, white painted brick on the far ends of the house and the rear, charcoal architectural shingles, black window frames, cedar posts and shutters, and stained wood double doors.
- **Fit-out:** the kitchen follows the cabinet codes on A-2: the range and the fridge on the pantry wall, the apron sink under the 3034 window, and an island with a prep sink, cabinets toward the range and stools toward the living room. The living room's fireplace sits between the two B42 built-ins. Finishes are a modern farmhouse reading of the photo: white shaker cabinets with black hardware, a stained wood island, granite tops, subway tile, white painted brick at the fireplace with a cedar mantel, and a sage butler's pantry with brass.
- **Master suite:** laid out on A-2 too. The king bed backs onto the end wall, between nightstands, with a dresser on the bath wall and a pair of chairs between the two 3050 windows. In the bath, the two vanities sit either side of the 4068 double doors, the oval tub stands under the 4040 window, and the shower and the toilet room keep their 2668 and 2468 doors. The closet has double and long hang on the outside walls, drawers and shelves on the bedroom wall, shoes either side of the door from the bath, and an island. The suite takes the oak floor through; the bath has marble-look tile, a hex mosaic shower floor and stacked tile to the ceiling, white oak vanities with marble tops, and black fittings.
- **Bedroom wing:** bedroom 2 has a queen bed against the end wall, a walnut dresser on the living room wall and a reading chair between the two 3050 windows; bedroom 3 has an oak bed, a desk and shelves on the porch wall and a bookcase by the 3060 pair. Each has its closet between them, fitted with double hang, shelves and shoes. Bath 2 is a Jack-and-Jill: a navy SB4821 vanity with an undermount basin at each bedroom's end, the tub in its alcove under the 4010 window with subway tile to 6'-6", and the toilet room off it. Carpet in the bedrooms and closets, a hex mosaic in the bath.
- **Powder, laundry, mudbench:** the powder room has green botanical wallpaper, a walnut washstand with a vessel basin and a round brass mirror; its 2668 is a pocket door, as drawn. The laundry has the washer and dryer under an oak counter beside a fireclay sink, cabinets, a drying rod and a tall broom cabinet, on a cement tile floor. The mudbench is three lockers in the pantry's sage, with a bench, hooks and cubbies; the stair gets white risers, balusters and a walnut rail.
- **Textures:** the brick, board-and-batten, shingles, concrete, mulch, granite, the subway, marble-look, hex, stacked and cement tiles, the powder room's wallpaper, book spines and the four paintings are drawn in code (`js/textures.js`). Grass, oak, walnut, bark and fabrics are CC0 scans from Poly Haven, shared with the Casa Serra demo in `../assets/`.

## Checkpoint status

1. **Done:** the plan sheet, the walls rising, the roof landing, the front lawn, the porch, and the entry.
2. **Done:** the living room (11' ceiling with a raised tray), out through the 12' slider to the rear porch, then the kitchen, a look into the butler's pantry, and the dining room. Recording: `media/checkpoint-2.mp4`.
3. **Done:** explore mode. The scroll is the intro and ends at the dining table; from there **Explore the house** (or **Skip to explore** in the top bar, or `#explore` in the URL) lets you walk the house yourself. Every room has a standing spot or two, joined through the doorways: drag to look around, scroll or pinch to zoom, click a marker or the floor to walk there, or pick a room on the plan. Rooms not fitted out yet stay as the line drawing.
4. **Done:** the master suite: the bedroom, the bath with its shower and toilet room, and the walk-in closet. It is reached in explore mode (pick **Mstr bedroom** on the plan); each room sweeps from drawing to finishes the first time you walk in, from the door you came through, and goes back to the drawing when you return to the tour. Recording: `media/checkpoint-4.mp4`.
5. **Done:** the rest of the house you live in: bedrooms 2 and 3 with their closets, bath 2 and its toilet room, the bedroom hall, the powder room, the laundry, and the mudbench hall with the stair. They sweep in on foot like the master suite. Recording: `media/checkpoint-5.mp4`.
6. **Next:** the garage and the storage room.

## Run it locally

Serve the repository root, not this folder, because the textures live in `../assets/`:

```sh
npx http-server -p 8080 .
# then open http://localhost:8080/casa-de-aman/
```

Plain files with no build step: three.js 0.160, GSAP ScrollTrigger and Lenis, all loaded from CDNs. Add `?low` to the URL to force the lighter phone settings. In the console, `casa.at(0.5)` jumps to any point of the scroll, and in explore mode `casa.step(1 / 24)` moves the walk on by a frame.

## Files

- `js/plan.js`: the house as data. Walls, openings, rooms, roofs, furniture and site, all in plan feet.
- `js/build.js`: turns the data into geometry, batched per material, with ink edges. Box faces that share a plane are merged first (faces between two solids go, overlapping faces keep the larger one), so wall corners and cut poché don't z-fight. Also the slider's four panels, which slide open.
- `js/furnish.js`: the fitted rooms: cabinet runs, the range, hood and fridge, the island, the fireplace and built-ins, the sofa and chairs, the dining table and chairs, the porch furniture; the beds, dressers, vanities, tubs, shower, toilets and closets; the desk and bookcase in bedroom 3; the washstand and wallpaper in the powder room; the laundry; the lockers and the stair rail; the interior doors standing open; and the hanging fixtures (pendants, chandeliers, fans, cans, drums).
- `js/reveal.js`: the paper-to-material sweep and the black poché on cut walls, drawn only while the section plane is cutting.
- `js/sheet.js`: the ink layer of the sheet, with room names, dimensions and door swings.
- `js/main.js`: renderer, materials, lights, camera path and the scroll timeline. Outside, the camera orbits between keys; from the entry on, it walks (eye position and heading are interpolated), so it turns on the spot and stays off the walls.
- `js/explore.js`: explore mode. The standing spots and the doorway paths between them, sight lines against the walls, walking, looking around, the markers and the clickable plan. `main.js` sweeps each room in as you enter it, and hands the rooms you have lit a shared pool of four lamps, held by the ones nearest to you.
