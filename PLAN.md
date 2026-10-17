# Fruit Teddy — plan

Status: all three phases done; see README.md for what shipped and what wasn't verified.

A Fruit Ninja-style slicing game for Teddy (≈8) and Tommy (≈5), in the house style of Metro Surfer:
Three.js r149 classic scripts, everything procedural (boxes, canvas textures, Web Audio), one HTML page.

## Screen and world

- Perspective camera looking at the z = 0 plane. Fruit fly in that plane, so slicing is 2D maths in world units.
- The camera distance is fitted so at least a 10 × 14.5 world-unit rectangle is visible: phones in portrait get a
  tall view, desktops a wide one. Gravity scales with the visible height, so a toss takes the same time everywhere.
- Backdrop: a canvas-painted wooden fruit-stand wall with bunting, on a plane behind the play area. Juice splats
  stick to it for a couple of seconds.
- The chef (your character) stands in the bottom-left corner, behind the fruit plane, and reacts.

## Core loop

- **Waves**: a gentle spawner. One fruit at a time for the first seconds, waves every ~2.8 s easing toward ~1.3 s,
  up to 4–5 fruit per wave later on; tosses take ~3.4 s at first, ~2.5 s at full speed.
- **Fruit**: watermelon, orange, apple, banana, pineapple, strawberry, built from spheres, lathes and a tapered
  tube with canvas textures.
- **Slicing**: pointer (mouse / touch / pen) drags are converted to world segments on z = 0; a segment that passes
  within a fruit's padded radius slices it. Multi-touch works (each finger has its own blade).
- **Halves**: two copies of the fruit, each clipped by the cut plane (local clipping planes, re-applied every frame
  as the half tumbles). Back faces render as flat flesh colour, so the open side looks like a cut face; an inner,
  smaller shell gives watermelon and orange their rind ring.
- **Juice**: droplet particles in the fruit's colour (Points with a small shader), plus a splat on the wall.
- **Blade trail**: a tapered glowing ribbon drawn on a 2D overlay canvas, which also draws the floating "+1" texts.
- **Combos**: fruit sliced in one stroke, each within 0.35 s of the last: 2 = DOUBLE (+1), 3+ = COMBO (+n).
- **Lives**: 3 hearts. A dropped fruit costs one (golden fruit and bonus bubbles never do). Every 50 points
  gives a heart back if you're missing one.
- **Zombie heads** (the "bombs"): slicing one costs a heart and triggers a short harmless scare: screen shake,
  green flash, Kit.sound.groan(). The head goes *poof* in a green cloud with stars; it is never cut.
- **Golden fruit**: rare, worth +5, sparkles.
- **Freeze bubble**: Teddy's or Tommy's face in a soap bubble, about every 40 s. Popping it slows time to a crawl
  for 4 s (frosty overlay). Faces are never sliced, only popped.
- **Best score** saved per character in localStorage.

## Chef reactions

- idle: breathing, head follows the fruit
- slice: little bounce · double: cheer · combo ≥ 3, golden fruit, new best: **signature move**
  - Tommy: the Y pose (`peace`)
  - Teddy: alternates a basketball `jumpshot` (a ball flies off) and `boxing` (jab, straight)
  - others: their roster pose, or a wave
- miss: wobble · zombie: startled jump · game over: wave

## Phases

1. (now) Core loop with placeholder chef, Three.js from ../metro-surfer/vendor.
2. When kit/README.md exists: `python3 ../kit/tools/sync.py .`, load kit scripts, use Kit.people / Kit.roster /
   Kit.portraits / Kit.sound / Kit.gfx, title-screen portrait cards, zombie head from the zombie look.
3. Verify in the Browser pane (window.fruit.step / swipe), README, `python3 ../kit/tools/bundle.py .`, commit.

## Testing hooks

`window.fruit`: `step(s)`, `swipe(points)` (screen px), `sliceAll()`, `spawn(kind, opts)`, `where()`,
`start(id)`, `chef(mode)`, `state`.
