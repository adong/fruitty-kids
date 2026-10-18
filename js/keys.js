/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "FruiTTy Kids",
  keys: [
    ["slice", "hold the mouse button and drag"],
    ["pick your chef (title)", "← →"],
    ["call your brother", "T"],
    ["start · play again", "Space or Enter"],
    ["pause", "P or Esc"],
    ["sound on / off", "M"],
  ],
  touch: "Swipe a finger to slice (several fingers work at once). Tap your brother's face (bottom right) to call him.",
});
