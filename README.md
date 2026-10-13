# Lintel · Casa Serra

At first it looks like a flat floor plan of a house. Until you scroll.

**Live demo:** https://sam1983aing.github.io/casa-serra/

**The starter prompt, on its own:** [starter-prompt.md](starter-prompt.md)

Work in progress, and still in the early stages. It runs best on a laptop. The whole house is drawn in real time, with about 39 MB of textures on a laptop and about 13 MB on a phone. If your device can't run it, you get a still and a clip of the walk.

## How it was made

There is no single prompt. It took about 70 prompts over two weeks and four full versions, with Claude Code and Opus 5.5. It started from a short video of an old game site I liked. The floor plan idea only showed up four days in.

The floor plan is not a picture. It is the real 3D model, cut at 1.2 m and seen from straight above through a very long lens. Scrolling raises the cut, and that is the walls growing. Every room stays a line drawing until the camera gets there.

- three.js, GSAP ScrollTrigger and Lenis. Plain files, no build step.
- Everything you see is geometry made in code. No Blender on this one.
- Textures are free CC0 scans from [Poly Haven](https://polyhaven.com).

## The prompt I would start with today

It won't give you this page. It gets you a first version of the idea, and then the real work starts. Swap the parts in `[brackets]` for your own subject.

```text
I want to build a scroll-driven landing page for [an architecture studio, a house, a
hotel, your subject].

The idea: the page opens on a flat floor plan, like a sheet an architect prints. Black
ink on paper, room names, dimensions. Nothing looks 3D. When the visitor scrolls, the
walls rise out of the drawing, the camera comes down to the front door and walks through
[the rooms you want, in order] at eye height. Each room stays a line drawing until the
camera gets there, then the real materials sweep across it.

What I care about:
- The floor plan is not a picture. It is the real 3D model, cut at about 1.2 m and seen
  from straight above through a very long lens. The drawing and the building are the
  same thing.
- The camera travels deep into the space, room after room. It does not orbit the
  building from outside.
- It should feel like [a house that costs millions, your level of ambition]: big rooms,
  real furniture, late afternoon light.
- three.js, GSAP ScrollTrigger and Lenis, plain files, no build step. Free CC0 materials
  for the textures.

Before you write any code, propose the layout of the building with sizes I can picture,
and the camera path stop by stop. Give me two or three directions to choose from and
wait for my answer. Then build in checkpoints. First checkpoint only: the plan sheet,
the walls rising, and the walk to the first room. Record it and show me before you go
further.
```

The last paragraph matters as much as the idea. Without it you get a finished page you did not choose.

## What one prompt gives you

I tested that prompt once, on a fresh session that knew nothing about this project. It proposed three layouts and waited. I answered with one line, and about an hour later it came back with a first checkpoint: a plan sheet, walls that rise, and a walk into the first room.

- Live: https://sam1983aing.github.io/casa-larga/
- Code, readable and as it came: https://github.com/Sam1983Aing/casa-larga

That is one run, so yours will look different. It is a good start. The rest was two weeks of looking at recordings, giving each room a score out of ten, and asking again.

## This copy

This repo is the published copy of the demo, so the scripts are minified.
