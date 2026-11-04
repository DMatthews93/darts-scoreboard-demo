// Edit these to match OBS > Tools > WebSocket Server Settings.
// URL query parameters override them, e.g. overlay.html?password=abc&port=4455
window.OVERLAY_CONFIG = {
  obsUrl: '',
  obsPassword: '',
  theme: 'arena',            // arena (TV-style scoreboard) | broadcast | default
  look: 'pdc',               // pdc (dials board) | sky (stacked rows) - the extension popup switches it live
  view: 'both',              // both | scoreboard | summary - or ?view= on each OBS Browser source's URL
  canvas: 'compact',         // arena only - compact: Browser source 1000 x 720 (or any size that ratio) hugging the scoreboard; full: 1920 x 1080
  position: 'bottom-left',   // bottom-left | bottom-right | top-left | top-right (arena is always bottom-centre)
  accent: '#e5484d',
  // arena theme colours and texts
  // arena colours (the extension popup's "Scoreboard style" overrides these live)
  arenaAccent: '#0b4fc0',    // highlight gradient start: thrower's name tab, score rings, thrower's checkout chips
  arenaAccent2: '#2a7bf2',   // highlight gradient end (same as arenaAccent for a flat colour)
  arenaPanel: '#1c1f26',     // main body
  arenaTab: '#2a2e37',       // inactive name tab
  arenaChip: '#1c1f26',      // checkout chips of the player who isn't throwing
  caption: '',               // line under the board, e.g. 'FRIDAY NIGHT LEAGUE - FINAL'
  formatLabel: '',           // overrides 'FIRST TO 11' if Scolia's format isn't detected
  showCheckout: true,
  showAverage: true,
  showFlags: true,           // country flags above the name tabs, from the players' Scolia profiles
  summarySeconds: 0,        // how long the post-game stats screen stays up (0 = don't show it)
};
