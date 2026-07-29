// Minimal CODE39 barcode generator — pure, no deps — for the receipt's invoice barcode.
// CODE39 encodes 0-9, A-Z, space, and - . $ / + %. Each character is 9 elements
// (bar,space,bar,…) with exactly 3 wide; characters are separated by a narrow gap.
// Returns bar rectangles ({x, w}) over a total width, so the caller can render an SVG.

const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
  "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
  F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn",
  P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn",
  Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
  $: "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn",
};

export type Barcode = { bars: { x: number; w: number }[]; width: number };

/** Encode `text` as CODE39. narrow = 1 module, wide = `ratio` modules, 1-module gaps.
 *  Unsupported characters are dropped. The value is wrapped in the * start/stop guards. */
export function code39(text: string, narrow = 2, ratio = 3): Barcode {
  const wide = narrow * ratio;
  const clean = text.toUpperCase().split("").filter((c) => c in CODE39 && c !== "*").join("");
  const chars = `*${clean}*`.split("");
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  chars.forEach((ch, ci) => {
    const pattern = CODE39[ch];
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] === "w" ? wide : narrow;
      if (i % 2 === 0) bars.push({ x, w }); // even index = bar (dark)
      x += w;
    }
    if (ci < chars.length - 1) x += narrow; // inter-character gap
  });
  return { bars, width: x };
}
