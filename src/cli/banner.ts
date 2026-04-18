export const VERSION = '0.2.0';

export const BANNER_LINES = [
  '██╗  ██╗ █████╗ ██╗██████╗  ██████╗ ███████╗      ████████╗██████╗  █████╗ ██████╗ ███████╗',
  '██║ ██╔╝██╔══██╗██║██╔══██╗██╔═══██╗██╔════╝      ╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗██╔════╝',
  '█████╔╝ ███████║██║██████╔╝██║   ██║███████╗█████╗   ██║   ██████╔╝███████║██║  ██║█████╗  ',
  '██╔═██╗ ██╔══██║██║██╔══██╗██║   ██║╚════██║╚════╝   ██║   ██╔══██╗██╔══██║██║  ██║██╔══╝  ',
  '██║  ██╗██║  ██║██║██║  ██║╚██████╔╝███████║         ██║   ██║  ██║██║  ██║██████╔╝███████╗',
  '╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝         ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝',
];

// KAIROS-TRADE split into per-letter cells so the Header can paint a left-to-right
// market gradient across the wordmark. Concatenating each row reproduces
// BANNER_LINES exactly. Cells: K A I R O S - T R A D E (12 total).
export const BANNER_LETTERS: readonly (readonly string[])[] = [
  ['██╗  ██╗', ' █████╗ ', '██╗', '██████╗ ', ' ██████╗ ', '███████╗', '      ', '████████╗', '██████╗ ', ' █████╗ ', '██████╗ ', '███████╗'],
  ['██║ ██╔╝', '██╔══██╗', '██║', '██╔══██╗', '██╔═══██╗', '██╔════╝', '      ', '╚══██╔══╝', '██╔══██╗', '██╔══██╗', '██╔══██╗', '██╔════╝'],
  ['█████╔╝ ', '███████║', '██║', '██████╔╝', '██║   ██║', '███████╗', '█████╗', '   ██║   ', '██████╔╝', '███████║', '██║  ██║', '█████╗  '],
  ['██╔═██╗ ', '██╔══██║', '██║', '██╔══██╗', '██║   ██║', '╚════██║', '╚════╝', '   ██║   ', '██╔══██╗', '██╔══██║', '██║  ██║', '██╔══╝  '],
  ['██║  ██╗', '██║  ██║', '██║', '██║  ██║', '╚██████╔╝', '███████║', '      ', '   ██║   ', '██║  ██║', '██║  ██║', '██████╔╝', '███████╗'],
  ['╚═╝  ╚═╝', '╚═╝  ╚═╝', '╚═╝', '╚═╝  ╚═╝', ' ╚═════╝ ', '╚══════╝', '      ', '   ╚═╝   ', '╚═╝  ╚═╝', '╚═╝  ╚═╝', '╚═════╝ ', '╚══════╝'],
];

// K → E traces a green → teal → cyan → sky → indigo → violet → fuchsia → rose
// gradient — reads as a rising price trajectory that climbs through the brand
// indigo and into the warm "trade execution" end of the spectrum.
export const LETTER_COLORS: readonly string[] = [
  '#4ade80', // K
  '#22c55e', // A
  '#14b8a6', // I
  '#06b6d4', // R
  '#0ea5e9', // O
  '#6366f1', // S
  '#8b5cf6', // -
  '#a855f7', // T
  '#c026d3', // R
  '#d946ef', // A
  '#ec4899', // D
  '#f43f5e', // E
];

export const LOGO_MARK = [
  ' ▄▀▖',
  ' ▜▛ ',
  ' ▀▝▖',
];

export const TAGLINE = 'adaptive tick-based auto-trader';
export const SUBTAG = 'Deriv synthetic indices · kairos-trade signal engine';
