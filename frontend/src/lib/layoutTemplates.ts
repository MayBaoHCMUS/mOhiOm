// Panel layout templates for client-side page composition.
// Polygon coordinates are in absolute 1200×1600 page-space pixels.
// Derived from LAYOUT_PANEL_RECTS (48×64 grid) × scale factor 25.
// Diagonal panel shapes use actual SVG polygon coordinates (× 25).

export type Polygon = [number, number][]
export interface PanelDefinition { polygon: Polygon }
export type LayoutTemplate = PanelDefinition[]

export const PAGE_W = 1200
export const PAGE_H = 1600

// Convert a bounding-box rect (on 48×64 grid) to a 1200×1600 polygon
function r(x: number, y: number, w: number, h: number): Polygon {
  const S = 25
  return [[x*S, y*S], [(x+w)*S, y*S], [(x+w)*S, (y+h)*S], [x*S, (y+h)*S]]
}

function p(...pts: [number, number][]): Polygon {
  return pts.map(([x, y]) => [x * 25, y * 25] as [number, number])
}

export const LAYOUT_TEMPLATES: Record<string, LayoutTemplate> = {
  // ── 1 panel ──────────────────────────────────────────────────────
  full_bleed: [
    { polygon: r(2, 2, 44, 60) },
  ],
  single: [
    { polygon: r(1, 1, 46, 62) },
  ],

  // ── 2 panels ─────────────────────────────────────────────────────
  diagonal_split_2: [
    { polygon: p([2,2],[32,2],[24,62],[2,62]) },
    { polygon: p([34,2],[46,2],[46,62],[26,62]) },
  ],
  horizontal_duo: [
    { polygon: r(1, 1, 46, 31) },
    { polygon: r(1, 32, 46, 31) },
  ],
  widescreen_pair: [
    { polygon: r(1, 1, 46, 31) },
    { polygon: r(1, 32, 46, 31) },
  ],

  // ── 3 panels ─────────────────────────────────────────────────────
  one_large_two_small: [
    { polygon: r(2, 2, 26, 60) },
    { polygon: r(31, 2, 15, 28) },
    { polygon: r(31, 33, 15, 29) },
  ],
  two_small_one_large: [
    { polygon: r(2, 2, 15, 28) },
    { polygon: r(2, 33, 15, 29) },
    { polygon: r(20, 2, 26, 60) },
  ],
  three_panels_row: [
    { polygon: r(2, 2, 12, 60) },
    { polygon: r(17, 2, 14, 60) },
    { polygon: r(34, 2, 12, 60) },
  ],
  diagonal_3_panels: [
    { polygon: r(2, 2, 44, 24) },
    { polygon: p([2,28],[22,28],[17,62],[2,62]) },
    { polygon: p([24,28],[46,28],[46,62],[19,62]) },
  ],
  cinematic_strips: [
    { polygon: r(2, 2, 44, 17) },
    { polygon: r(2, 23, 44, 17) },
    { polygon: r(2, 44, 44, 18) },
  ],
  vertical_trio: [
    { polygon: r(1, 1, 15, 62) },
    { polygon: r(16, 1, 15, 62) },
    { polygon: r(32, 1, 15, 62) },
  ],
  wide_duo: [
    { polygon: r(1, 1, 46, 34) },
    { polygon: r(1, 36, 23, 27) },
    { polygon: r(24, 36, 23, 27) },
  ],
  widescreen_trio: [
    { polygon: r(1, 1, 46, 20) },
    { polygon: r(1, 22, 46, 21) },
    { polygon: r(1, 44, 46, 19) },
  ],
  l_shape: [
    { polygon: r(1, 1, 28, 62) },
    { polygon: r(29, 1, 18, 31) },
    { polygon: r(29, 32, 18, 31) },
  ],

  // ── 4 panels ─────────────────────────────────────────────────────
  grid_2x2: [
    { polygon: r(2, 2, 20, 28) },
    { polygon: r(26, 2, 20, 28) },
    { polygon: r(2, 34, 20, 28) },
    { polygon: r(26, 34, 20, 28) },
  ],
  action_dynamic_4: [
    { polygon: p([2,2],[21,2],[18,30],[2,30]) },
    { polygon: p([27,2],[46,2],[46,30],[29,30]) },
    { polygon: p([2,33],[18,33],[21,62],[2,62]) },
    { polygon: p([29,33],[46,33],[46,62],[27,62]) },
  ],
  splash_top: [
    { polygon: r(2, 2, 44, 34) },
    { polygon: r(2, 39, 12, 23) },
    { polygon: r(18, 39, 12, 23) },
    { polygon: r(34, 39, 12, 23) },
  ],
  splash_bottom: [
    { polygon: r(2, 2, 12, 23) },
    { polygon: r(18, 2, 12, 23) },
    { polygon: r(34, 2, 12, 23) },
    { polygon: r(2, 28, 44, 34) },
  ],
  asymmetric_4: [
    { polygon: r(2, 2, 25, 36) },
    { polygon: r(30, 2, 16, 16) },
    { polygon: r(30, 21, 16, 17) },
    { polygon: r(2, 41, 44, 21) },
  ],
  vertical_flow: [
    { polygon: r(2, 2, 13, 28) },
    { polygon: r(18, 2, 28, 28) },
    { polygon: r(2, 34, 24, 28) },
    { polygon: r(29, 34, 17, 28) },
  ],
  hero_left: [
    { polygon: r(1, 1, 28, 62) },
    { polygon: r(29, 1, 18, 20) },
    { polygon: r(29, 22, 18, 20) },
    { polygon: r(29, 43, 18, 20) },
  ],
  hero_right: [
    { polygon: r(1, 1, 18, 20) },
    { polygon: r(1, 22, 18, 20) },
    { polygon: r(1, 43, 18, 20) },
    { polygon: r(19, 1, 28, 62) },
  ],
  film_strip: [
    { polygon: r(1, 1, 11, 62) },
    { polygon: r(12, 1, 11, 62) },
    { polygon: r(24, 1, 11, 62) },
    { polygon: r(36, 1, 11, 62) },
  ],
  t_shape: [
    { polygon: r(1, 1, 46, 21) },
    { polygon: r(1, 23, 15, 40) },
    { polygon: r(16, 23, 15, 40) },
    { polygon: r(32, 23, 15, 40) },
  ],

  // ── 5 panels ─────────────────────────────────────────────────────
  manga_classic_5: [
    { polygon: r(2, 2, 27, 22) },
    { polygon: r(32, 2, 14, 22) },
    { polygon: r(2, 27, 15, 16) },
    { polygon: r(20, 27, 26, 16) },
    { polygon: r(2, 46, 44, 16) },
  ],

  // ── 6 panels ─────────────────────────────────────────────────────
  grid_2x3: [
    { polygon: r(1, 1, 23, 20) },
    { polygon: r(24, 1, 23, 20) },
    { polygon: r(1, 22, 23, 20) },
    { polygon: r(24, 22, 23, 20) },
    { polygon: r(1, 43, 23, 20) },
    { polygon: r(24, 43, 23, 20) },
  ],
}

// Fallback layout used when the page's layout key is not found
export const FALLBACK_LAYOUT_KEY = 'grid_2x2'
