# FruiTTy Kids

[![FruiTTy Kids title screen](docs/screenshot.jpg)](https://adong.github.io/fruitty-kids/)

Swipe to slice flying fruit. Watch out for the zombie bombs, and call your brother as a second chef.

**中文：** 划一下，切开飞起来的水果。小心僵尸炸弹，叫兄弟来当第二个大厨。

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

A fruit-slicing game starring Teddy and Tommy. It's built with Claude Code from plain JavaScript and Three.js, in the same style as Metro Surfer.
There are no image, model or audio files: the fruit are spheres, lathes and a bent tube with canvas-painted skins, the characters come from the shared kit (`kit/`), and every sound is synthesised.

## Play

- **Double-click `index.html`.** It works offline, because Three.js and the kit are copied into `kit/`.
- **Send one file:** `dist/fruitty-kids.html` is the whole game in one file, about 730 KB. AirDrop or email it, then open it in a browser.
- **Rebuild that file** after any edit: `python3 kit/tools/bundle.py . --name fruitty-kids`
- **Get kit updates** (new poses, characters or sounds) from `~/claude-games/kit`: `python3 ../kit/tools/sync.py .`, then rebuild.
- Best scores and the chosen chef are saved per browser, and separately for each way of opening the game, so `index.html` and `dist/fruitty-kids.html` each keep their own.

| Mouse | Touch | Keys | |
|---|---|---|---|
| hold the button and drag | swipe a finger | | slice (several fingers work at once) |
| click a card | tap a card | ← → | pick your chef on the title screen |
| buddy button (bottom right) or his title card | same | T | call your buddy (and toss up a card to slice) |
| ▶ PLAY | ▶ PLAY | Space / Enter | start, or play again |
| ❚❚ button | ❚❚ button | P / Esc | pause |
| 🔊 button | 🔊 button | M | sound on/off |

## How it plays

- **Slice the fruit:** watermelon, orange, apple, banana, pineapple and strawberry are tossed up from the bottom. Each one you slice is +1. It splits into two halves that tumble apart, showing the inside: red flesh, seeds and rind for the watermelon, segments and pith for the orange, a core for the apple. Juice splashes in the fruit's colour and leaves a splat on the wall.
- **Combos:** slice several fruit in one swipe, each within 0.35 s of the one before. Two is a DOUBLE (+1); three or more is a combo worth +1 per fruit (TRIPLE +3, SUPER, MEGA).
- **⭐ Golden fruit:** now and then a fruit glows gold. It's worth +5, and dropping it costs nothing.
- **🫧 Freeze bubble:** about every 40 s, a soap bubble floats up with the other brother's face in it. Tommy pops up when you play Teddy; Teddy when you play Tommy; either one for the other chefs. Pop it (+3) and time slows almost to a stop for 4.5 s, with frost on the screen edges, so everything is easy to slice. Faces are only ever popped, never cut.
- **🧟 Zombie heads** are the bombs. Slicing one costs a heart and plays a short, harmless scare: the head goes *poof* in a green cloud with stars, the screen shakes and flashes green, the zombie groans, and a little "BOO!" pops up a couple of seconds later. Heads are never cut in half.
- **Hearts:** you have 3. A dropped fruit costs one, except in the first 12 seconds, when it just shows a "swipe across the fruit" hint. Every 50 points gives a lost heart back.
- **Pace:** gentle on purpose. For the first 12 s there's one fruit at a time, then waves grow from 1–2 to up to 5 fruit, about every 2.7 s easing toward 1.25 s. Tosses start slow (3.4 s up and down) and speed up a little (2.4 s). Zombie heads start after 25 s and golden fruit after 15 s. To change any of this, edit the constants at the top of `js/game.js`.

## Your buddy

Tap the buddy button (bottom right, with his face on it), press **T**, or tap his dashed **BUDDY · TAP ME!** card on the title screen, and the other brother runs in as a second chef. It works like the buddy in Metro Surfer. It's Tommy for everyone, and Teddy when Tommy is the chef (`Kit.roster.buddyFor`). A visit lasts about 10 s:

- He runs in from the right, wearing a name tag, and says hi with his signature move: Tommy's Y, or Teddy's boxing combo.
- About once a second he slices a fruit for you with a blade swipe from his side, saving the ones about to drop first. His points count. When it's Teddy, every slice is a punch with a 💥.
- Halfway through, he throws you a treat (🍦 💧 🧃 🍪 🍉 🍌, with a toast like "🍦 ICE CREAM FROM TOMMY!"), and your chef holds it for a while.
- He says bye with his goodbye move (Tommy's Y, or Teddy's jump shot through a pop-up hoop) and runs off.
- **He has your back:** for the first 9.6 s of the visit, a dropped fruit or a sliced zombie head costs no heart. He saves the fruit or bats the head off the screen, and "TOMMY SAVED YOU!" (or "TEDDY SAVED YOU!") pops up. While he's guarding, his button glows and a bar with his face under the score shows the time left.
- Every tap brings him, as often as you like. Tapping again after he's handed over his treat makes him say hi again and bring another one. Tapping while he's leaving brings him straight back.
- **Every call also tosses up a character card** with a random roster character's portrait, one card per call and at most two in the air. Slice it for +5 and confetti. The ZOMBIE card groans and says "BOO!", but it never costs a heart. A card that drops costs nothing.

## The chefs

Your character stands in the bottom-left corner, watches the fruit and reacts. They bounce a little on every slice, cheer on a DOUBLE, wobble when a fruit drops and jump when a zombie pops. On a combo of 3+, a golden fruit, a freeze bubble or a new best, they do their **signature move**:

- **TEDDY** takes turns with two moves. One is a Mike Tyson-style boxing combo (jab, straight) with a 💥 at each punch. The other is a basketball jump shot: he jumps, a hoop pops up on the wall, and the ball drops through the net with a "SWISH!".
- **TOMMY** does his Y pose (比耶): both arms up with peace fingers, a happy little dance, and ✌️ floating up.
- **ZOOM, LUNA, BOLT and BRUNO** wave. The **ZOMBIE** reaches out with both arms, as zombies always do.

All seven come from the shared kit roster (`Kit.roster`), and each keeps their own best score. When the game ends, your chef keeps celebrating on the results screen.

## Testing from the browser console

`window.fruit` drives the game without a mouse. That's how it was checked in the Browser pane, where `requestAnimationFrame` is throttled while the pane is hidden:

```js
fruit.autoPause = false; fruit.hold(true)   // stop the live loop; only step() moves time
fruit.start('tommy')                          // start a game as Tommy
fruit.step(3)                                 // advance 3 s of game time, drawing every frame
fruit.where()                                 // every item's kind and screen position
fruit.swipe([[100, 300], [700, 380]])         // drag a blade along this path (screen px)
fruit.sliceAll()                              // one swipe through every fruit (avoids zombie heads)
fruit.spawn('bubble', { place: [500, 300] }) // 'fruit' | 'zombie' | 'bubble'; also { type, golden, x, apex }
fruit.chef('signature')                       // make the chef celebrate
fruit.buddy()                                 // call the buddy, like T (also tosses a card)
fruit.buddyInfo()                             // who he is, visit time, guarding, treat, pose
fruit.card('luna')                            // toss a character card
```

The buddy was checked with both pairings: Teddy calling Tommy, and Tommy calling Teddy. With him guarding, a sliced zombie and a dropped fruit left the hearts at 3. After he left, each one cost a heart. In a 60 s run with nobody slicing and him called every 2 s, he sliced 42 fruit and no hearts were lost. Called once, the first heart went at 14.8 s, after he'd left and the 12 s grace period was over.

A 3-minute run with a careful bot (slice every fruit that's on screen and not near a zombie head) tossed 165 items: at most 5 on screen at once, 24 zombie heads, 4 golden fruit and 4 freeze bubbles. The bot finished with 3 hearts and 165 points.

## Files

```
index.html     page, HUD and screens (CSS inline)
js/sfx.js      slicing, popping, freeze and combo sounds, built on Kit.sound.tone / hiss
js/fruits.js   the six fruit, their clipped halves, zombie heads, freeze bubbles and character cards
js/fx.js       juice particles, wall splats, emoji flyers, and the 2D overlay (blade trail, +1 texts, ✖ marks)
js/chef.js     FT.makeActor: a chef in a bottom corner, with reactions, signature moves, Teddy's ball and hoop; FT.chef is you
js/buddy.js    the buddy: his visit, helper blade, treat and guarding
js/game.js     view fitting, waves, slicing, combos, hearts, input, HUD, main loop, window.fruit
js/zh.js       中文 for every word on the page, the toasts, the canvas pop-ups and the ? panel (Kit.lang); names and the logo stay English
kit/           copy of ~/claude-games/kit (Three.js r149, people, roster, portraits, sound, bundler); edit the kit there, not here
dist/fruitty-kids.html  the single-file build
PLAN.md        the original plan
```

How slicing works: the camera looks straight at the plane where the fruit fly, so a pointer drag becomes a line segment in world units. A segment that passes within 1.25 × a fruit's radius cuts it; zombie heads need 0.7 ×, so a near miss is safe. Each half is the same fruit drawn with a clipping plane through its centre, perpendicular to the swipe. Its back faces are drawn in flat flesh colour, so the open side looks like a cut face. A smaller inner shell adds the rind ring.

## Kit candidates

These live in this game for now. Move them into `~/claude-games/kit` if another game wants them:

- **Zombie head on its own:** `Kit.people.build(zombie.look).head`, detached and turned to face the camera (see `boot()` in `js/game.js`). A `Kit.people.head(look)` helper would make it one line.
- **A chef in a corner:** `FT.makeActor(side)` in `js/chef.js` places a roster character facing the camera in a bottom corner and runs reactions, signature moves, props and run-ins on top of `Kit.people.pose`. A second game with on-screen characters could share it.
- **Basketball and pop-up hoop** for the `jumpshot` pose (`ballTexture`, `buildHoop`, `updateBall` in `js/chef.js`). The ball is aimed so it reaches the rim a fixed time after it leaves the hands.
- **Standing celebrations:** `peace` and `wave` swing the legs like a runner's stride. A standing character damps the legs to 35 % after `Kit.people.pose` (in `update` in `js/chef.js`). A "standing" option on those poses would help any game where the character doesn't run.
- **Extra sounds:** `slice`, `pop`, `freeze`, `combo(n)`, `heart`, `miss`, `toss` and `poof` in `js/sfx.js`.
- **Testing pattern:** `hold()` plus `autoPause = false`. The Browser pane hides the page between steps, which fires `visibilitychange` and pauses the game. Screenshots taken right after a synchronous `step()` can also be one frame stale, so take a second one.

## Not verified

- **Sound:** the effects and music run through Web Audio, but no one has listened to them yet.
- **Real touch devices:** iPad and phone layouts were checked in the browser's device emulation, including portrait phone, iPad portrait and a phone on its side. Touch input uses the same pointer-event path as the mouse, which was tested with real mouse drags, but it hasn't been tried with fingers on a real device or in iOS Safari.
