export type AvatarPixel = string | null;

const AVATAR_WIDTH = 8;
const AVATAR_HEIGHT = 8;
const TOKEN_SIZE = 6;
const AVATAR_TOKEN_COUNT = AVATAR_WIDTH * AVATAR_HEIGHT;
const AVATAR_CODE_LENGTH = AVATAR_TOKEN_COUNT * TOKEN_SIZE;

export const AVATAR_COLORS = {
  black: "#1A1A1A",
  white: "#FFFFFF",
  red: "#FF2A5F",
  blue: "#0077FF",
  green: "#00C853",
  yellow: "#FFB300",
  pink: "#FF66E5",
};

export const AVATAR_BG_COLORS = [
  AVATAR_COLORS.red,
  AVATAR_COLORS.blue,
  AVATAR_COLORS.green,
  AVATAR_COLORS.yellow,
  AVATAR_COLORS.white,
  AVATAR_COLORS.pink,
];

export const AVATAR_PATTERNS: Record<string, string[]> = {
  creeper: ["00000000", "01100110", "01100110", "00011000", "00111100", "00111100", "00100100", "00000000"],
  derp: ["00000000", "01110000", "01210010", "01110000", "00000000", "00111100", "00000000", "00000000"],
  cat: ["10000001", "11000011", "12100121", "11100111", "00000000", "01011010", "00100100", "00000000"],
  slime: ["00000000", "00000000", "01000010", "01000010", "00000000", "00111100", "00000000", "00000000"],
  reverse: ["00011000", "00100100", "01000000", "11100000", "00000111", "00000010", "00100100", "00011000"],
  plus4: ["00000000", "00101000", "01111100", "00101000", "00000000", "01001100", "01111000", "00001000"],
  skull: ["00111100", "01222210", "12122121", "12222221", "12122121", "01222210", "00122100", "00111100"],
  ghost: ["00111100", "01222210", "12122121", "12222221", "12222221", "12222221", "11011011", "00000000"],
  heart: ["00000000", "01100110", "12211221", "12222221", "01222210", "00122100", "00011000", "00000000"],
  glasses: ["00000000", "00000000", "00000000", "11111111", "12211221", "11111111", "00000000", "00000000"],
  smile: ["00000000", "00100100", "00100100", "00000000", "01000010", "00111100", "00000000", "00000000"],
  duck: ["00000000", "00111000", "00121000", "01111000", "12211110", "01111110", "00111100", "00000000"],
  sword: ["00000020", "00000210", "00002100", "00021000", "00210000", "02100000", "11000000", "10000000"],
  star: ["00011000", "10011001", "01011010", "00111100", "01111110", "10100101", "00000000", "00000000"],
};

export const DEFAULT_AVATAR_CODE = patternToAvatarCode("smile", AVATAR_COLORS.yellow);

function cleanAvatarCode(code: string | null | undefined): string {
  return String(code || "").replace(/\s/g, "").toUpperCase();
}

function normalizeHexColor(color: string | null | undefined): string | null {
  const match = String(color || "").trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toUpperCase()}` : null;
}

export function isAvatarCode(code: string | null | undefined): boolean {
  const clean = cleanAvatarCode(code);
  if (clean.length !== AVATAR_CODE_LENGTH) return false;

  for (let i = 0; i < clean.length; i += TOKEN_SIZE) {
    const token = clean.slice(i, i + TOKEN_SIZE);
    if (token !== "------" && !/^[0-9A-F]{6}$/.test(token)) return false;
  }

  return true;
}

export function normalizeAvatarCode(code: string | null | undefined): string {
  const clean = cleanAvatarCode(code);
  return isAvatarCode(clean) ? clean : DEFAULT_AVATAR_CODE;
}

export function encodeAvatarPixels(pixels: AvatarPixel[]): string {
  const normalized = new Array<AvatarPixel>(AVATAR_TOKEN_COUNT).fill(null);
  for (let i = 0; i < AVATAR_TOKEN_COUNT; i++) {
    normalized[i] = normalizeHexColor(pixels[i]);
  }

  return normalized
    .map((color) => (color ? color.slice(1) : "------"))
    .join("");
}

export function decodeAvatarCode(code: string | null | undefined): AvatarPixel[] {
  const normalized = normalizeAvatarCode(code);
  const pixels: AvatarPixel[] = [];

  for (let i = 0; i < normalized.length; i += TOKEN_SIZE) {
    const token = normalized.slice(i, i + TOKEN_SIZE);
    pixels.push(token === "------" ? null : `#${token}`);
  }

  return pixels;
}

export function patternToAvatarCode(patternNameOrRows: string | string[], bgColor: string = AVATAR_COLORS.yellow): string {
  const pattern = Array.isArray(patternNameOrRows)
    ? patternNameOrRows
    : AVATAR_PATTERNS[patternNameOrRows] || AVATAR_PATTERNS.smile;
  const background = normalizeHexColor(bgColor) || AVATAR_COLORS.yellow;
  const pixels: AvatarPixel[] = [];

  for (let y = 0; y < AVATAR_HEIGHT; y++) {
    const row = pattern[y] || "00000000";
    for (let x = 0; x < AVATAR_WIDTH; x++) {
      const token = row[x] || "0";
      if (token === "1") pixels.push(AVATAR_COLORS.black);
      else if (token === "2") pixels.push(AVATAR_COLORS.white);
      else pixels.push(background);
    }
  }

  return encodeAvatarPixels(pixels);
}

export function randomAvatarCode(): string {
  const patternNames = Object.keys(AVATAR_PATTERNS);
  const patternName = patternNames[Math.floor(Math.random() * patternNames.length)];
  const bgColor = AVATAR_BG_COLORS[Math.floor(Math.random() * AVATAR_BG_COLORS.length)];
  return patternToAvatarCode(patternName, bgColor);
}

export function renderAvatar(code: string | null | undefined, size: number | string = "100%", className: string = ""): string {
  const cssSize = typeof size === "number" ? `${size}px` : size;
  const cells = decodeAvatarCode(code)
    .map((color) => `<span style="display:block;background:${color || "transparent"};"></span>`)
    .join("");

  return `
    <div class="pixel-avatar ${className}" aria-hidden="true" style="width:${cssSize};height:${cssSize};display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);overflow:hidden;image-rendering:pixelated;line-height:0;box-sizing:border-box;">
      ${cells}
    </div>
  `;
}
