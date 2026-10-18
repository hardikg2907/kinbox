import { posterUrl } from "@/lib/tmdb/images";

export type PosterPalette = {
  /** Calm colours to mix into the page colour, one per colour scheme. */
  calmDark: string;
  calmLight: string;
  /** The poster's most vivid hue, lifted so it reads on glass in both schemes. */
  vivid: string;
};

type Rgb = [number, number, number];

const WIDTH = 24;
const HEIGHT = 36;

// Relative luminance bounds for the calm colours. Dark: a bright poster must not lift the page so
// far that muted text drops under AA. Light: a dark poster must not sink it below the same line.
const CALM_DARK_MAX = 0.05;
const CALM_LIGHT_MIN = 0.45;

const loaded = new Map<string, Promise<PosterPalette | null>>();
const settled = new Map<string, PosterPalette | null>();

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function saturation([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

function average(list: Rgb[]): Rgb {
  const sum = list.reduce<Rgb>((total, p) => [total[0] + p[0], total[1] + p[1], total[2] + p[2]], [0, 0, 0]);
  const count = Math.max(list.length, 1);
  return [Math.round(sum[0] / count), Math.round(sum[1] / count), Math.round(sum[2] / count)];
}

function toCss([r, g, b]: Rgb): string {
  return `rgb(${r} ${g} ${b})`;
}

// Mixes toward black or white in steps until the luminance is inside the bound.
function clampLuminance(colour: Rgb, bound: number, towards: 0 | 255): Rgb {
  const darken = towards === 0;
  let current = colour;
  for (let step = 0; step < 24; step++) {
    const luma = luminance(current);
    if (darken ? luma <= bound : luma >= bound) return current;
    current = current.map((v) => Math.round(v + (towards - v) * 0.12)) as Rgb;
  }
  return current;
}

function vividCss(colour: Rgb): string {
  const [r, g, b] = colour.map((v) => v / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  }
  return `hsl(${Math.round(hue * 60 + 360) % 360} ${delta > 0 ? 78 : 10}% 62%)`;
}

function describe(data: Uint8ClampedArray): PosterPalette {
  const pixels: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) pixels.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
  const byLuminance = [...pixels].sort((a, b) => luminance(a) - luminance(b));
  const light = average(byLuminance.slice(Math.floor(pixels.length * 0.8)));
  const middle = byLuminance.slice(Math.floor(pixels.length * 0.2), Math.floor(pixels.length * 0.85));
  const vivid = average(
    [...middle].sort((a, b) => saturation(b) - saturation(a)).slice(0, Math.max(8, Math.floor(middle.length * 0.15))),
  );
  return {
    calmDark: toCss(clampLuminance(average(pixels), CALM_DARK_MAX, 0)),
    calmLight: toCss(clampLuminance(light, CALM_LIGHT_MIN, 255)),
    vivid: vividCss(vivid),
  };
}

async function read(url: string): Promise<PosterPalette | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    // A canvas the poster tainted throws here: that means no colour, never a guess.
    return describe(context.getImageData(0, 0, WIDTH, HEIGHT).data);
  } catch {
    return null;
  }
}

/** The palette of a poster, or null when it has none or cannot be read. Read once per path. */
export function readPalette(posterPath: string | null): Promise<PosterPalette | null> {
  const url = posterUrl(posterPath, "w92");
  if (posterPath === null || url === null) return Promise.resolve(null);
  let promise = loaded.get(posterPath);
  if (!promise) {
    // TMDB sends its CORS header only when asked and does not vary its answer by origin, so a plain
    // <img> of this poster elsewhere caches a copy the canvas may not read. An address of its own
    // keeps the readable copy apart.
    promise = read(`${url}?palette`).then((palette) => {
      settled.set(posterPath, palette);
      return palette;
    });
    loaded.set(posterPath, promise);
  }
  return promise;
}

/** The palette if it is already read; undefined while it is not. */
export function cachedPalette(posterPath: string | null): PosterPalette | null | undefined {
  return posterPath === null ? null : settled.get(posterPath);
}
