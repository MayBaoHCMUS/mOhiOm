## SESSION: 2026-06-21 (continued — wizard restructure + canvas editor spec)

### ✅ COMPLETED — Wizard Restructure: Steps 4 + 5 Split + Mode Modal

Restructured the wizard from 5 steps to 6 steps (keys 0–5):
- **Step 4** = "Generate" — Layout + Generate tabs (panel-by-panel flow)
- **Step 5** = "Export" — Dialogue + Export tabs

**New files:**
- `frontend/src/components/GenerationModeModal.tsx` — full-screen modal (no dismiss) shown when entering Step 4 for the first time; user chooses "Full Page" or "Panel by Panel"; choice stored in context as `comicPageMode`
- `frontend/src/components/studio-steps/Step5Export.tsx` (469 lines) — dialogue tab + export tab; ported dialogue/bubble/export logic from old Step4Generation

**Context changes (`ComicGenerationContext.tsx`):**
- `StepKey` extended: `1 | 2 | 3 | 4` → `1 | 2 | 3 | 4 | 5`
- `Step5Result = { exportedAt: string | null }`
- `comicPageMode: 'page' | 'panel' | null` state (null = modal not dismissed)
- `setComicPageMode(mode)` — sets mode, hides modal
- `resetComicPageMode()` — sets to null, re-triggers modal
- `step5` StepState added; `stepMap` includes step 5; `cooldownUntil` includes `5: 0`
- `handleApprove` guard: `nextStep <= 5`; `handleRevokeApproval(4)` cascades to lock step 5
- Step 3 regeneration resets `comicPageMode` to null + re-locks steps 4 & 5

**Step4Generation.tsx refactor (2318 lines):**
- `Step4Tab` narrowed from `'generate'|'layout'|'dialogue'|'export'` → `'layout'|'generate'`
- Removed: dialogue tab, export tab, all bubble/compose/export handlers and state
- Removed: inline mode picker cards (Generate tab) — mode is set upfront via modal
- Removed: per-page layout picker icons from the Generate tab panel grid
- Added: `comicPageMode` + `resetComicPageMode` from context
- **Layout tab additions:**
  - Mode chip + "Change mode →" button (calls `resetComicPageMode()`)
  - Panel script preview rows per page card (panelNumber, shotType, dialogueSfx/aiImagePrompt)
- **Tab sync effect:** when `comicPageMode === 'panel'` → force Layout tab first; when `'page'` → force Generate tab
- Bottom nav simplified: Layout → Generate, Generate → `handleApprove(4)`

**TextToComicGenerator.tsx:**
- `wizardSteps` extended to 6 entries (keys 0–5)
- Renders `<GenerationModeModal />` when `activeStep === 4 && comicPageMode === null`
- Bottom bar hidden for steps 1–5 (each owns its action bar)

---

### 🎯 NEXT SESSION — Canvas Editor Redesign (Step 4)

The user provided a comprehensive redesign spec for Step 4 titled **"REDESIGN: Comic Page Editor"** requesting a Canva-style 3-zone layout. This has NOT been implemented yet.

**Spec summary:**

Replace the current 2-tab (Layout + Generate) flow in Step 4 with a **unified canvas editor**:

```
┌────────────────────────────────────────────────────┐
│  [Page 1] [Page 2] [Page 3]  ← page navigator     │
├──────────┬─────────────────────────┬───────────────┤
│ LEFT     │  CENTER CANVAS          │ RIGHT         │
│ 240px    │  (fills remaining)      │ 280px         │
│          │                         │               │
│ Templates│  Comic page at 1:1.414  │ Contextual:   │
│ + scene  │  ratio with panel slots │ page overview │
│ + import │  (positioned by bbox)   │ panel props   │
│ + script │                         │ bubble editor │
│ preview  │                         │               │
├──────────┴─────────────────────────┴───────────────┤
│  [← Back]   X/Y panels generated   [Export →]      │
└────────────────────────────────────────────────────┘
```

**Key behaviors from spec:**
1. **No Layout/Generate tabs** — single unified view per page
2. **Page navigator** at top: horizontal page tabs with mini progress bars
3. **Left panel** (240px): layout template list, scene type dropdown, AI suggestion button, dialogue auto-import, page script preview
4. **Center canvas**: shows ONE page at a time; panel slots positioned using `bbox` from `confirmedLayouts[pageNumber]`; 6 panel states (no layout / pending / generating / generated / selected / error); zoom controls
5. **Click empty panel** = immediate generation (`handleRegenerateSinglePanel(panel)`)
6. **Layout change = canvas re-renders immediately** — auto-calls `comicLayoutApi.confirm()` when template selected (no explicit "Confirm" button)
7. **Right panel** (280px): contextual — page overview (default) / panel properties (when panel selected) / bubble editor (when bubble selected)
8. **Inline dialogue bubbles** always visible on canvas over panel images
9. **Bottom bar**: back to script + X/Y panels progress + Export button (calls `handleApprove(4)`)

**Implementation plan for next session:**
- Create `frontend/src/components/studio-steps/Step4CanvasEditor.tsx` (replaces Step4Generation.tsx in wizard)
- Update `TextToComicGenerator.tsx`: swap `Step4Generation` import → `Step4CanvasEditor`
- Keep `Step4Generation.tsx` until canvas editor is verified working
- Keep `Step5Export.tsx` unchanged — canvas editor calls `handleApprove(4)` to advance to export

**Key technical notes:**
- Panel positions from `confirmedLayouts[pageNumber].panels[idx].bbox = [x1,y1,x2,y2]` (in 1240×1754 space)
- CSS: `left: x1/1240*100%`, `top: y1/1754*100%`, `width: (x2-x1)/1240*100%`, `height: (y2-y1)/1754*100%`
- Diagonal panels: `clip-path: polygon(${pts.map(([x,y])=>'${x/1240*100}% ${y/1754*100}%').join(',')})`
- Map `confirmedLayouts[page].panels[idx]` ↔ `step4PanelsByPage.find([page,...])[idx]` by array index to get panel IDs
- Auto-confirm flow: user picks template → `comicLayoutApi.confirm({panel_count, layout_name})` → stores in `confirmedLayouts` → `setRawPanelDimensions(page, dimMap)` → canvas renders positioned slots
- Use `MANGA_LAYOUT_SVGS` constants from Step4Generation for wireframe previews while awaiting confirm API response
- The `comicPageMode === 'page'` case: show a single slot for the full page image; no layout picker needed

---

## SESSION: 2026-06-21 (continued — layout-first system)

### ✅ COMPLETED — Layout-First Manga Panel System

Implemented the full layout-first spec. Layout tab now comes BEFORE Generate tab.

**Backend:**
- `backend/comic/layout/mask_renderer.py` — Fixed stretch bug: `_cover_crop()` + `_expand_polygon()`. Images now fill polygon bbox without distortion. Cover-crop preserves aspect ratio; expand closes hairline gaps between panels.
- `backend/comic/layout/layout_selector.py` — Added `suggest_layout()` with scene inference from shot types, reasons, and alternatives. `select_layout()` kept for backward compat.
- `backend/comic/layout/composition_hints.py` — New file. `get_composition_hint(panel)` + `inject_composition(prompt, panel)` for framing keywords based on panel shape.
- `backend/app/routers/comic_generation.py` — Added `POST /api/comic-layout/suggest` (AI layout suggestion + alternatives) and `POST /api/comic-layout/confirm` (returns panel slots with `sd_width`/`sd_height` for exact-dimension generation).

**Frontend:**
- `frontend/src/services/api.ts` — Added `SuggestLayoutRequest/Response`, `ConfirmLayoutRequest/Response`, `ConfirmedPanelDefinition` types. Added `comicLayoutApi.suggest()` and `comicLayoutApi.confirm()`.
- `frontend/src/context/ComicGenerationContext.tsx` — Added `setRawPanelDimensions(pageNumber, dimMap)` to context (exposes direct dim override without calling Gemini endpoint).
- `frontend/src/components/studio-steps/Step4Generation.tsx`:
  - Tab order: **Layout → Generate → Dialogue → Export** (layout first)
  - Default tab: `layout`
  - `isTabLocked`: layout=never, generate=locked until `anyLayoutConfirmed` (panel mode only), others unchanged
  - New state: `confirmedLayouts`, `layoutSuggestions`, `suggestionLoading`, `confirmingLayout`
  - New handlers: `handleGetSuggestion()`, `handleConfirmLayout()` (calls `/confirm`, maps slots → panel IDs, updates `pagePanelDimensions`)
  - Layout tab redesigned: AI suggestion banner, template picker, wireframe SVG preview, "Confirm Layout" button, post-confirm shows dimensions + compose section when images exist
  - Bottom bar navigation updated for new tab order

**Key flow:** Layout tab → pick template → Confirm → `pagePanelDimensions` updated → Generate tab unlocks → generate at exact dimensions → Layout tab compose section appears → Apply Manga Layout → polygon-masked page image.

**Tests:** 14/14 templates + 8/8 procedural pass.

---

## SESSION: 2026-06-21

### ✅ COMPLETED — DialogueEditor.tsx — Bubble UX Overhaul

All work in: `frontend/src/components/studio-steps/DialogueEditor.tsx`

---

#### Cross-panel bubbles (`crossPanel` flag)

- Added `crossPanel?: boolean` to `SingleBubble` interface
- `PanelCell` filters out `crossPanel: true` bubbles from its render (`sortedBubbles.filter(b => !b.crossPanel)`)
- `PageBubbleLayer` collects all `crossPanel: true` bubbles via `useMemo` across all panels and renders them in an absolute overlay at `zIndex: 20` covering the full page grid
- Right-click → context menu: "Bring to Front" sets `crossPanel: true`; "Send to Back" sets `crossPanel: false`
- Context menu bug root cause & fix: `document.addEventListener('mousedown', close)` fired before `click`, clearing `contextMenu` state before action ran. Fixed with **backdrop pattern**: transparent `<div style={{ position:'fixed', inset:0, zIndex:199 }}>` fires `onClose` on outside clicks; menu's `onMouseDown={e.stopPropagation()}` prevents backdrop from firing on menu-internal clicks
- Backend: added `crossPanel: Optional[bool] = False` to `BubbleData` Pydantic model in `backend/app/routers/bubbles.py`
- Frontend API: added `crossPanel?: boolean` to `BubbleDataPayload` in `frontend/src/services/api.ts`

---

#### Inline text editing

- New `editingBubbleId: string | null` state in `DialogueEditor`
- `addBubble` auto-sets `setEditingBubbleId(newBubble.id)` — new bubbles immediately enter edit mode
- Transparent `<textarea autoFocus>` overlay rendered inside selected bubble when `editingBubbleId === bubble.id`:
  - `color: transparent`, `caretColor: textColor` — SVG text renders through, textarea captures input
  - `onBlur` / Escape → `onEditEnd()`
- Double-click on any bubble → `onEditStart(panelId, bubbleId)` → inline edit
- `onEditEnd` auto-deletes the bubble if `dialogue` is empty/null (no ghost bubbles)
- `PanelCellProps` new props: `editingBubbleId`, `onEditStart`, `onEditEnd`

---

#### Drag-to-create bubbles (sidebar palette)

- `BubbleSidebar` restructured: always shows a "Drag to add bubble" palette grid at the top (all 15 `BUBBLE_TYPE_OPTIONS` as draggable tiles)
- Palette tiles: `draggable={true}`, `onDragStart` sets `dataTransfer.setData('bubbleType', type)` with `effectAllowed: 'copy'`
- Clicking a palette tile when a bubble is selected changes that bubble's type (replaces old bubble-type grid in selected state)
- `PanelCell` root div: `onDragOver` + `onDrop` handlers compute normalized drop position from `clientX/Y` relative to cell rect, call `onBubbleAdd(panelId, normX, normY, type)`
- `addBubble` extended: accepts `bubbleType: BubbleType = 'speech'` parameter; new bubble uses dropped type
- `onBubbleAdd` prop signature updated: `(panelId, normX, normY, bubbleType?: BubbleType) => void`

---

#### Hover grab cursor + drag-to-move

- All bubbles (selected and non-selected) have `cursor: grab`
- **Non-selected bubbles**: `onPointerDown` → select + `startDrag(e, 'move', b)`; `onPointerMove` / `onPointerUp` run shared `onDragMove` / `onDragEnd`; `onDoubleClick` → `onEditStart`
- **Selected bubble**: whole body is draggable — `onPointerDown` on outer div starts move drag; `onDoubleClick` enters inline edit
- Removed the separate purple move-handle bar at the top of selected bubbles
- Corner/tail handles: all add `e.stopPropagation()` to prevent triggering the body's `onPointerDown`
- `dragActiveRef = useRef(false)`: only set `true` after pointer moves ≥ 3px from start; `onDragEnd` only saves + commits if `dragActiveRef.current` — prevents position save on simple clicks
- Bug fix: `computePatch(e)` called **before** `dragRef.current = null` in `onDragEnd` — previously the ref was cleared first causing `computePatch` to return `null` and the bubble snapping back

---

#### Click-to-create removed

- `onClick={handleCellClick}` removed from panel cell div — clicking empty panel no longer creates a bubble
- Hover `+` button removed entirely
- Only creation paths: drag from sidebar palette, or "Auto-import from script" button

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/components/studio-steps/DialogueEditor.tsx` — all bubble UX changes (~2100 lines)
- `frontend/src/services/api.ts` — `crossPanel?: boolean` on `BubbleDataPayload`
- `backend/app/routers/bubbles.py` — `crossPanel: Optional[bool] = False` on `BubbleData`

---

### 🐛 KNOWN ISSUES / DECISIONS

- **`crossPanel` flag vs separate panel**: cross-panel bubbles stay in their original `panelBubbles[panelId]` array; only rendered differently. All save/load/delete mechanics are unchanged.
- **`PAGE_PANEL_PREFIX = '__page__'`**: exported constant kept for backward-compat with MongoDB records but not used in active logic.
- **Inline edit not available for `bubbleType: 'none'` and `'sfx'`**: `none` is invisible; `sfx` uses direct SVG text styling that doesn't need inline edit. Both still editable via sidebar textarea.
- **`dragActiveRef` threshold = 3px**: prevents spurious saves on single clicks. Does NOT block `dblclick` — double-click fires `onDoubleClick` independently, not via drag logic.
- **`onEditEnd` auto-delete**: only fires when the bubble exiting edit has `dialogue === null` or `dialogue.trim() === ''`. Bubbles with text are always preserved on blur.

---

### 🎯 NEXT SESSION PLAN

1. **Expand bubble types to 15** — add `whisper`, `double`, `electric`, `round`, `square`, `scream`, `heart`, `burst`, `wobbly` to `BubbleType` union, `BUBBLE_TYPE_DEFAULTS`, `MangaBubbleSVG` switch, and palette (see Phase 1 spec in SESSION: 2026-06-20 below)
2. **MongoDB persistence** — wire `PUT /api/bubbles/{panelId}` on save (Phase 2 spec below)
3. **PNG composite export** — html2canvas per panel (Phase 3 spec below)

---

## SESSION: 2026-06-20

### ✅ COMPLETED — DialogueEditor.tsx — Full Canvas Dialogue System

All work in: `frontend/src/components/studio-steps/DialogueEditor.tsx` (~1591 lines) and `frontend/src/components/studio-steps/Step4Generation.tsx`.

---

#### What was built this session

**MangaBubbleSVG — native SVG rendering**
- `SvgText` helper: `<text>/<tspan>` word-wrap via `wrapTextToLines()` (no `<foreignObject>`)
- `MangaBubbleSVG`: 6 bubble types — speech (oval + triangle tail), thought (cloud circles + dot trail), shout (spiky star polygon), sfx (outline text, no shape), narration (rectangle), none (hidden)
- viewBox fixed to `0 0 w h` (1:1 with display) + `overflow: 'visible'` for tails — was previously padded, making text 75% too small
- Tail shapes: `tailPts()` generates triangle polygon; `thoughtTrail()` generates 3 shrinking circles
- SFX: `paintOrder="stroke fill"` for manga-style outline text with `Bangers` font

**Drag + resize — pointer events + local override**
- `startDrag` → `setPointerCapture` on the drag element
- `onDragMove` → `setDragOverride(patch)` (local PanelCell state only — no parent re-render during drag)
- `onDragEnd` → `onBubbleUpdate(...)` commits position + calls `onDragCommit()` for immediate flush
- Zero re-renders in parent tree while dragging — only PanelCell re-renders

**Save architecture (30s/Ctrl+S + immediate on drag end)**
- `triggerSave(panelId, bubbles)` → calls `onSaveBubbles` immediately (parent state update, no snap-back) + stores `pendingSaveRef.current`
- 30s `setInterval` auto-flushes `pendingSaveRef` if changes are pending
- Ctrl+S / Cmd+S: keyboard `useEffect` calls `flushSaveRef.current()` immediately
- `onDragCommit` prop on `PanelCell` → `flushSave()` fires right after drag ends
- Status indicator: `idle` (gray) / `unsaved` (amber "● Unsaved · Ctrl+S to save") / `saving` (muted) / `saved` (green "✓ Saved") / `error` (red + Retry)

**Tail direction compass**
- 3×3 grid of 36×36px cells (8 directions + center no-op)
- Auto-detect button: `autoDetectTailDir()` uses `atan2` from bubble center to panel center → nearest compass direction

**Page navigation + counters**
- `panelHasDialogue(panelId)`: single canonical definition — `bubbles.length > 0 && some(b => text not empty and not NONE)`
- Tab badge, page dots, sidebar summary all use the same predicate
- Page dots: green (all panels done), orange (partial), gray (none)

**Bubble opacity fix**
- Non-selected bubbles: `dimmed={!!selectedBubbleId}` (only dim when a bubble is actively selected in that panel, not always)
- Dimmed opacity: `0.55 → 0.8` so bubbles remain legible on dark manga backgrounds

**Key types (canonical)**
```typescript
export type BubbleType = 'speech' | 'thought' | 'shout' | 'sfx' | 'narration' | 'none';
export type TailDir = 'up-left'|'up'|'up-right'|'left'|'right'|'down-left'|'down'|'down-right'|'none';
export interface SingleBubble {
  id: string;
  dialogue: string | null;
  bubbleType: BubbleType;
  tailDir: TailDir;
  bubblePosition: { x: number; y: number };  // normalized 0–1 relative to panel
  bubbleSize: { w: number; h: number };       // logical pixels (zoom-independent)
  fontSize: number;
  rotation: number;  // degrees, SFX only; 0 for others
  character?: string;
  zIndex: number;
}
```

**BUBBLE_TYPE_DEFAULTS**
```typescript
speech:    { fontSize: 13, minFont: 8,  maxFont: 20 }
thought:   { fontSize: 12, minFont: 8,  maxFont: 20 }
shout:     { fontSize: 18, minFont: 16, maxFont: 48 }
sfx:       { fontSize: 24, minFont: 16, maxFont: 48 }
narration: { fontSize: 11, minFont: 8,  maxFont: 20 }
none:      { fontSize: 14, minFont: 8,  maxFont: 20 }
```

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/components/studio-steps/DialogueEditor.tsx` — **All changes** (1591 lines; all bubble types, drag, save, compass, counters, opacity fix)
- `frontend/src/components/studio-steps/Step4Generation.tsx` — `onSaveBubbles` wires to `setPanelBubbles`; `autoImportDialogue` creates `SingleBubble` objects; `panelsWithDialogue` counter uses same predicate
- `frontend/src/styles/globals.css` — Bangers font import + `--font-bangers` CSS custom property

---

### 🎯 NEXT SESSION PLAN — Dialogue System Enhancements

**CONTEXT**: The following spec was provided for the next implementation phase. Priority: Phase 1 (more types), Phase 2 (MongoDB persistence), Phase 3 (PNG export). Do NOT adopt the spec's file structure — keep everything in `DialogueEditor.tsx`. Do NOT use ComicalJS — SVG rendering is working. Keep normalized 0–1 coordinate system (not the spec's 0–100 percentage).

---

#### Phase 1 — Expand bubble types (in `DialogueEditor.tsx`)

The spec defines 15 types. We currently have 6. Add these 9:

| Type | Render | Notes |
|---|---|---|
| `whisper` | oval with `strokeDasharray="6,3"` | italic font, opacity 0.9 fill |
| `double` | two concentric ovals (inner = outer − 8px) | same tail as speech |
| `electric` | oval with `strokeDasharray="4,2"`, gold stroke (`#DAA520`) | yellow-tinted fill |
| `round` | ellipse forced to circle (`rx = ry = min(w,h)/2`) | same tail as speech |
| `square` | `<rect>` with `rx={2}` sharp corners | no tail rounding; monospace font |
| `scream` | spiky polygon with 18 spikes (shout has 12) | red stroke, larger font |
| `heart` | SVG heart path, no tail | pink stroke `#FF6B9D`, pink fill |
| `burst` | 16-point starburst polygon | no tail; Bangers font |
| `wobbly` | sinusoidal ellipse path (approximate with cubic beziers) | blue stroke `#6699CC` |

**Steps:**
1. Add all 9 to `BubbleType` union
2. Add all 9 to `BUBBLE_TYPE_DEFAULTS` (font sizes, slider ranges)
3. Add rendering cases to `MangaBubbleSVG` switch
4. Add all 9 to the bubble type selector in `BubbleSidebar` (currently 5 visible types + none)
5. `autoImportDialogue` in Step4Generation: map `*text*` → `whisper`, `!TEXT!` → `scream`

**Heart SVG path formula** (for reference):
```
// cx=w/2, cy=h/2, scale to fit bubble
const scale = Math.min(w, h) * 0.45;
// standard heart: M0,-1 C0.5,-1 1,-0.5 1,0 C1,0.5 0.5,1 0,1.5 C-0.5,1 -1,0.5 -1,0 C-1,-0.5 -0.5,-1 0,-1
// apply scale and translate to cx,cy
```

---

#### Phase 2 — MongoDB persistence for bubble data

**Backend** — new router: `backend/app/routers/bubbles.py`

```python
# Schema to add to backend/app/schemas.py:
class BubbleData(BaseModel):
    id: str
    dialogue: Optional[str]
    bubbleType: str
    tailDir: str
    bubblePosition: dict  # {x: float, y: float}
    bubbleSize: dict      # {w: float, h: float}
    fontSize: float
    rotation: float
    character: Optional[str]
    zIndex: int

class PanelBubblesUpsert(BaseModel):
    panelId: str
    comicId: str
    bubbles: List[BubbleData]

# Collection: panel_bubbles
# Index: { panelId: 1 } unique
```

```python
# Endpoints:
GET  /api/bubbles?comicId=xxx          # load all bubble data for a comic
PUT  /api/bubbles/{panelId}            # upsert bubbles for one panel
DELETE /api/bubbles/{panelId}          # clear bubbles for panel
```

**Frontend** — wire in Step4Generation.tsx:
- On `DialogueEditor` mount: fetch `GET /api/bubbles?comicId={projectId}` → init `panelBubbles`
- `onSaveBubbles` currently only calls `setPanelBubbles` (in-memory) → also call `PUT /api/bubbles/{panelId}`
- Add `bubblesApi` to `frontend/src/services/api.ts`

**Key constraint**: keep `panelBubbles` React state as source of truth for rendering; MongoDB is persistence layer only. Fetch on mount, write on save.

---

#### Phase 3 — Composite PNG export per panel

**Library**: `npm install html2canvas` (already in spec; check if installed first)

**Approach** (in `frontend/src/lib/bubbles/exportComposite.ts` — new file):
```typescript
export async function exportPanelWithBubbles(panelElement: HTMLElement): Promise<Blob>
export async function exportPageWithBubbles(pageElement: HTMLElement): Promise<Blob>
```

**Wire into Step4Generation Export tab**: "Export with Dialogue" button — captures each page's panel div (with SVG overlay) using html2canvas and bundles as ZIP.

**Important**: `foreignObjectRendering: true` is NOT reliable across browsers. Since we switched to native SVG `<text>/<tspan>` (no `<foreignObject>`), html2canvas should work without that flag.

---

### 🐛 KNOWN ISSUES / DECISIONS

- **`BubbleType = 'none'`**: panels imported with "NONE" dialogue get `bubbleType: 'none'` — these render as invisible and are filtered out of `panelHasDialogue`. Do not remove this type.
- **Coordinate system**: `bubblePosition` is normalized 0–1 (not 0–100 percentage as in the spec). Do not change — changing would break all saved bubbles.
- **`onSaveBubbles` dual purpose**: currently updates both in-memory state (immediately) and queues persistence (deferred). When Phase 2 is added, the immediate `onSaveBubbles` call in `triggerSave` updates React state; the deferred `flushSave` makes the API call.
- **No ComicalJS**: the spec mentions ComicalJS but we implemented custom SVG. DO NOT add ComicalJS — it has SSR conflicts with Next.js 14 App Router and our custom rendering works correctly.
- **Bangers font**: loaded via Google Fonts in `globals.css`. Used for shout/sfx/burst bubble types.
- **`panelHasDialogue` predicate** (single canonical definition — use everywhere):
  ```typescript
  const bs = panelBubbles[panelId] ?? [];
  return bs.length > 0 && bs.some(b => {
    const t = b.dialogue?.trim() ?? '';
    return t !== '' && t.toUpperCase() !== 'NONE';
  });
  ```

---

### 📦 PACKAGES TO INSTALL BEFORE PHASE 2/3

```bash
cd frontend
npm install html2canvas   # Phase 3 PNG export
# NOTE: do NOT install comicaljs — not needed
# NOTE: do NOT install lodash.debounce — we use setInterval instead
```

---

## SESSION: 2026-06-16 (continued)

### ✅ COMPLETED — Tab-Based Layout Redesign (Step4Generation.tsx)

**What changed:**
- Replaced single-page Step 4 with a 4-tab progressive workflow: Generate → Layout → Dialogue → Export
- Tab bar: 44px tabs with badge counters, lock rules, `sessionStorage` persistence
- Tab 1 (Generate): all existing generation dashboard + panel grids; completion nudge banner
- Tab 2 (Layout): "AI Layout All Pages" button + per-page composed views + panel mini-card approval grid
- Tab 3 (Dialogue): optional dialogue editing, auto-import from script, inline textarea edit
- Tab 4 (Export): inline star rating (non-blocking), PDF/ZIP/cloud/JSON export options, page preview strip
- Simple bottom bar: prev/next nav per tab, replaces complex 190-line state machine
- Removed `ExportModal` and `ComicRatingModal` popup components (moved inline to Tab 4)
- New handlers: `handleComposeAllPages`, `handleApproveAllOnPage`, `autoImportDialogue`
- New state: `activeStep4Tab`, `dialogueEdits`, `dialogueEditOpen`, `dialogueEditValue`, `composingAll`, `showCompletionNudge`, `exportStars`, `exportHovered`, `exportPositive`, `exportNegative`, `includeMetadata`
- File went from 2688 → 2099 lines (net -589 lines)
- TypeScript: zero new errors; ESLint: went from 8 → 2 pre-existing errors

**Also completed (same session):**
- Smart panel layout (`comic_composer.py`): LLM-driven layout selection, cover-crop image fill, `LAYOUT_TEMPLATES` dict, `rule_based_layout()`, `_suggest_layout()` in `gemini.py`
- `schemas.py`: `ComposePageRequest.use_smart_layout`, `ComposePageResponse.layout_name`
- `api.ts`: updated interfaces for compose page

---

## SESSION: 2026-06-16

### 🎯 CONTEXT — Step 4 panel grid polish, progress bar, and footer standardization

All work this session is in:
- `frontend/src/components/studio-steps/Step4Generation.tsx`

---

### ✅ COMPLETED

#### 1. Consistent 2-column panel grid with odd-panel centering and lightbox

**`PanelCard` image area refactor:**
- Changed image area from `flex-none` + `style={{ height: 190 }}` → `flex-1 overflow-hidden` — fills remaining space after 90px footer, total card stays 280px via parent `style={{ height: 280 }}`
- All states (success/loading/error/pending) use `w-full h-full` — no per-state height overrides

**Hover overlay + lightbox (`🔍 View full`):**
- Added `group` class to image container; overlay div uses `group-hover:bg-black/25` + `group-hover:pointer-events-auto`
- "🔍 View full" button appears on hover, opens a fullscreen lightbox (`z-[100]`, `bg-black/90`)
- Lightbox: closes on backdrop click or ✕ button; clicking the image itself does NOT close it
- Caption at bottom: `Pg.N · Panel N · SHOT TYPE`
- Implemented via `useState(false)` local to `PanelCard`; lightbox rendered inside `<>` fragment sibling to the card

**Odd-panel centering:**
- Panel grid: `grid grid-cols-2 gap-3` (2-column, consistent across all pages)
- When `panels.length % 2 === 1`, last panel gets a wrapper `<div style={{ gridColumn: 'span 2', maxWidth: '50%', margin: '0 auto' }}>` — sits centered at half-width rather than stretching full row
- Even panels use `<React.Fragment key={panel.id}>` for key without extra DOM nodes

**Image area for error/pending:** Removed duplicate action buttons (Retry/Generate) from the image area — actions are now exclusively in the footer.

---

#### 2. `GenerationProgressBar` — enhanced segmented progress bar

**New component** (inserted before `PanelCard`):
- 8px bar, `border-radius: 4px`, segments stacked inline-flex with no gap
- Green (`#22C55E`) = done panels, yellow (`#F59E0B`, animate-pulse) = currently generating, red (`#EF4444`) = errors, gray track (`#E5E7EB`) = pending
- Percentage label right-aligned on same row as bar
- Label row below: `"15 generated · 5 pending · 3 errors · 0 running"` (each value colored to match segment; 0-count values hidden except pending)
- **Completion state**: when all done (`pending=0, errors=0`), label becomes `"✓ All X panels generated!"` in green
- **Confetti animation (300ms, one-time)**: detects `allDone` transition via `useRef` + `useEffect`; fires `box-shadow` glow on green bar + `animate-[pulse_0.3s_ease-in-out_1]` on label text; `celebrating` state resets after 400ms
- Accepts `unit: 'panel' | 'page'` prop for label pluralization

**Placement — `activeStats` hoisted out of IIFE:**
- `activeStats` previously computed inside the dashboard IIFE; moved to `useMemo` in component body so it's accessible both inside the IIFE and to the persistent bar element
- Formula: panel mode → `panelStats.*`; page mode → `step4Stats.*`

**Three locations where `GenerationProgressBar` now renders:**
1. **GENERATING IMAGES section** (inside dashboard IIFE): replaces old `SegmentedProgressBar` + inline stats row. Keeps heading + "Drawing: Page X…" + Pause/Cancel
2. **PAUSED section** (inside dashboard IIFE): replaces old amber gradient bar. Keeps "Paused" heading + Resume/Cancel
3. **Persistent element** (between dashboard IIFE and stats grid): shows when `state >= 3 && activeStats.total > 0 && !isImageGenerating && !isPaused` — guards against duplicate rendering when dashboard sections already show the bar

**Duplicate bar fix:** Persistent bar hidden via `&& !isImageGenerating && !isPaused` condition — resolves the visual where two identical "✓ All 1 pages generated!" bars appeared simultaneously.

**`StatsBar` update:**
- Added `totalLabel?: string` prop (default `'Total'`)
- Stats card now passes `totalLabel={comicPageMode === 'panel' ? 'Panels' : 'Pages'}` so the first card doesn't say "Pages" in panel mode

---

#### 3. Standardized `PanelCard` footer — universal 3-row template

**Footer dimensions:** `flex-none flex flex-col justify-between px-3 py-2` `style={{ height: 90 }}` — 3 rows share height via `justify-between`

**Row 1 — Metadata (always):**
- Left: `Pg.N · Panel N` + `✓` (primary color, 10px) when approved
- Right: shot type in `text-[10px] font-bold uppercase tracking-wider`

**Row 2 — Feedback/status (state-dependent):**
- Generated (has image, not approved, or approved with no reaction): emoji rating buttons `😍 👍 😐 👎` (no "Rate:" label)
- Approved + has reaction: `"You rated: 😍"` — shows emoji of the selected reaction
- Loading: tiny spinner + `"Generating…"` (10px, muted)
- Error: `"⚠ Generation failed"` (10px, red)
- Pending: `"○ Not generated yet"` (10px, muted)

**Row 3 — Actions (state-dependent):**
- Generated: `[↺ Regen]` (left) · `[✓ Approve]` (right) — both `whitespace-nowrap`
- Approved: `[↺ Regen (revokes)]` (left, revoke language) · `[✓ Approved]` (right, filled primary bg)
- Error: `[↺ Retry]` (left, red) · truncated error text (right, `title` tooltip for full message)
- Pending: `[⚡ Generate this panel]` (full-width via `w-full`)
- Loading: nothing (null)

**Image area cleanup:** duplicate Retry/Generate buttons removed from error/pending image placeholders — actions exclusively in footer.

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/components/studio-steps/Step4Generation.tsx` — `PanelCard` image area (`flex-1`), hover lightbox, odd-panel grid wrapper, `GenerationProgressBar` component, `activeStats` useMemo hoisted, GENERATING/PAUSED sections simplified, persistent progress bar placement, `StatsBar` `totalLabel` prop, standardized 3-row footer

---

### 🐛 DECISIONS & NOTES

- **Lightbox z-index `z-[100]`**: above all existing modals (`z-[55]` export, `z-[60]` toasts, `z-[70]` regen modal, `z-[80]` comic rating, `z-[9999]` preview slideshow). The panel lightbox at 100 sits below the preview slideshow — intentional.
- **Odd-panel wrapper vs prop**: used a wrapper `<div>` for the odd-last-panel grid spanning rather than passing an `isLastOdd` prop to `PanelCard`. Keeps the card component unaware of grid layout concerns.
- **`activeStats` useMemo deps**: `[comicPageMode, panelStats, step4Stats]` — `panelStats` itself is a useMemo (depends on `step4.data`), so the chain is reactive without over-triggering.
- **Persistent bar guard (`!isImageGenerating && !isPaused`)**: prevents showing two `GenerationProgressBar` instances simultaneously. The dashboard IIFE's GENERATING and PAUSED branches each render their own bar internally.
- **"You rated" in approved state**: only shows if `reaction` is non-null. If the user approved without rating, the emoji buttons still show so they can rate later.
- **Pre-existing TS warnings**: `panelPageMap` unused (declared but never read) and `barColor` unused remain — pre-existing from previous sessions, not introduced this session.

---

### 🎯 NEXT STEPS

1. **Test lightbox with portrait panels** — verify "🔍 View full" renders correctly for 9:16 generated panel images; image should display at full resolution without cropping
2. **Test odd-panel centering** — generate a page with 3 or 5 panels; verify last panel is centered at 50% width, not stretched
3. **Test footer states** — cycle through all 4 states (pending → generating → error → generated → approved) and verify 3-row footer renders correctly for each
4. **Panel mode stats accuracy** — verify `panelStats.done`, `panelStats.generating`, `panelStats.errors`, `panelStats.pending` update reactively as panels transition states during generation

---

## SESSION: 2026-06-15

### 🎯 CONTEXT — SD Server API v2, Step 2 flow, Step 4 UX polish

---

### ✅ COMPLETED

#### New Image Generation Server API (SD 1.5 + IP-Adapter Plus v2)

Server API contract changed — characters are now saved server-side by name and referenced in generate calls (no more `reference_image_base64` on every request).

**`frontend/src/app/api/image-proxy/route.ts`** (updated):
- `ProxyRequestBody` updated: `scene_prompt` (was `prompt`), `control_image_b64` (was `control_image_base64`), new fields `story_id`, `character_name`, `style`
- Proxy target: `{url}/generate-page`

**`frontend/src/app/api/image-proxy/characters/route.ts`** (new file):
- `POST` proxy to `{url}/characters/save`
- Body: `{ story_id, character_name, reference_image_b64 }`
- Fire-and-forget character registration before image generation

**`frontend/src/context/ComicGenerationContext.tsx`** (updated):
- `ImageGenSettings` interface: added `characterName?`, `storyId?`, `style?`
- Added `imageGenStyle` state (default `'manga'`), exported via context
- `fetchImageFromAI`: request body now uses `scene_prompt`, `story_id`, `style`, `character_name`; removed `reference_image_base64` from all modes
- Added `saveCharacterToServer(characterName, imageDataUri)` — fire-and-forget POST to `/api/image-proxy/characters`
- `handleApproveCharacterReferences`: saves each approved character to SD server via `saveCharacterToServer`
- `generatePageImages` + `handleRegenerateWithFeedback`: now pass `characterName` (first character name, lowercased) and `storyId` instead of `referenceImageBase64`

**`frontend/src/components/story-setup/Step1.tsx`** (updated):
- New `ImageStylePicker` custom dropdown component (replaces native `<select>`)
- 4 styles: Manga (B&W lineart), Webtoon (flat vivid), Chibi (pastel kawaii), Watercolor (painterly)
- Visual style cards: colored emoji badge, bold label, muted subtitle, checkmark when selected
- Click-outside close via `useRef` + `mousedown` handler
- Placed below "Image API URL" input in Step 1 sidebar

---

#### Step 2 Flow Change — Design Sheets → References auto-flow

**`frontend/src/components/studio-steps/Step2Characters.tsx`** (updated):
- Approving the Design Sheet tab now automatically switches to the References tab AND triggers character reference image generation (if not already generated)
- Button labels updated: "Approve & Generate Images →" (not yet approved) / "View Reference Images →" (already approved)
- `switchToReferencesAndGenerate()` helper encapsulates tab switch + conditional auto-generate
- Removed `onSwitchToReferences` prop from `DesignSheetsRightPanel` and the "View in Reference Images" inline link button

---

#### Step 4 — One-click Generate (no double-click)

**`frontend/src/components/studio-steps/Step4Generation.tsx`** (updated):
- Added `wasBuildingRef` + `useEffect` that watches for state 2→3 transition (panels done building) and auto-calls `handleStartFullGeneration()`
- Only auto-fires if the panel build was triggered in this session (ref is `false` on page load — no surprise auto-generation on returning to an already-built step)
- State-1 button renamed from "⚡ Generate All Panels" → "⚡ Generate All Images" to match user expectation

---

#### Step 4 — Progress Bar Cleanup

**`frontend/src/components/studio-steps/Step4Generation.tsx`** (updated):
- Removed `SegmentedProgressBar` from the "Generation Progress" sidebar panel — `StatsBar` (4-number grid) alone is sufficient; no information lost
- Removed the 3px indigo progress line at the very top of the fixed bottom bar (`barColor: #4F46E5` during generation looked like a thick blue stripe)
- Result: during active generation, only 2 visual progress bars visible (main dashboard card A + bottom bar C) instead of 3–4

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/app/api/image-proxy/route.ts` — updated API contract
- `frontend/src/app/api/image-proxy/characters/route.ts` — **New** (character save proxy)
- `frontend/src/context/ComicGenerationContext.tsx` — new API fields, `imageGenStyle`, `saveCharacterToServer`, character-name-based generation
- `frontend/src/components/story-setup/Step1.tsx` — custom `ImageStylePicker` dropdown
- `frontend/src/components/studio-steps/Step2Characters.tsx` — Design Sheet approval auto-triggers References generation
- `frontend/src/components/studio-steps/Step4Generation.tsx` — one-click generate, removed duplicate progress bars, removed top-of-bar indigo line

---

### 🐛 DECISIONS & NOTES

- **`imageGenStyle` vs `artStyle`**: `artStyle` ("Japanese manga style, detailed") is embedded in text prompts by `buildComicPagePrompt()`. `imageGenStyle` ("manga") selects LoRA + trigger words on the SD server. Both coexist; default "manga" for both.
- **Character name convention**: character names are lowercased before saving to SD server (`character.name.toLowerCase()`). Generation calls use the same lowercased name.
- **`wasBuildingRef` pattern**: using a `useRef` (not state) to track the 2→3 transition avoids extra re-renders and prevents stale closure issues. The ref is reset to `false` after auto-triggering so it doesn't fire again on subsequent re-renders at state 3.
- **Pre-existing TS errors**: 13 canvas null-check errors in `Step4Generation.tsx` remain (pre-existing). Zero new TS errors from this session.

---

### 🎯 NEXT STEPS

1. **Test SD server integration end-to-end** — configure `localImageApiUrl`, approve characters in Step 2, verify `/api/image-proxy/characters` fires for each character; generate panels and verify `character_name` is present in proxy requests
2. **Test one-click generate flow** — click "⚡ Generate All Images" in Step 4, verify panel building starts then image generation auto-begins without a second click
3. **`story_id` per project**: currently defaults to `projectId` state (default `'three_little_pigs_manga_001'`). Consider letting users set a custom `story_id` or deriving it from the project title
4. **Character gallery search backend**: current search in `/gallery` is frontend-only; add backend search when gallery grows
5. **Gallery page auth gate**: "Add to My Library" visible to unauthenticated users — should check `localStorage['mohiom-user-id']`

---

## SESSION: 2026-06-13

### 🎯 CONTEXT — Feature 3 (Character Design Rating) + Feature 7 (Admin Analytics Dashboard + Characters Tab)

---

### ✅ COMPLETED

#### Feature 3 — Per-character emoji rating widget (Step 2 Characters)

**New constants in `Step2Characters.tsx`:**
- `CHAR_REACTIONS` — 4 reactions (`love 😍 / good 👍 / neutral 😐 / bad 👎`) with per-reaction bg/border/color styles
- `CHAR_CHIPS` — 8 feedback chips (`👤 Wrong age / 💇 Hair / 👁 Eyes / 👗 Outfit / 🎭 Personality / 📏 Build / 🎨 Color / ✨ Missing details`)

**`CharacterRatingWidget` component:**
- Emoji pill buttons (36px, `border-radius: 20px`) with inline selected-state colors
- On `love`/`good`: success message "Great! This character will be used as reference…"
- On `neutral`/`bad`: chips grid + feedback textarea fade in

**`VersionFilmstrip` modifications:**
- New prop `ratingByVersion?: Record<number, string>` — shows emoji on rated version tabs (e.g. `V2 😍`)

**`ImageGenPanel` modifications:**
- 9 new props: `charRating`, `charChips`, `charFeedback`, `onCharRate`, `onChipToggle`, `onFeedbackChange`, `approveWarning`, `onApproveAnyway`, `onRegenInstead`, `ratingByVersion`
- `CharacterRatingWidget` rendered between generation mode panel and action row
- Amber warning box shown when `approveWarning && !isApproved`

**`CharacterAccordionCard` modifications:**
- New props: `projectId: string`, `onReactionChange: (charId, version, reaction) => void`
- New state: `ratingByVersion`, `chipsByVersion`, `ratingFeedback`, `approveWarning`
- `handleRate(r)` — updates state, calls `onReactionChange`, fires `POST /api/ratings/character` (fire-and-forget)
- `handleChipToggle(chipId)` — toggles chip, auto-appends label to textarea
- `handleApproveWithCheck()` — intercepts; shows warning on `neutral`/`bad`
- `handleApproveAnyway()` — dismisses warning, logs `character_approved` event, calls `onApprove()`
- `logCharApproved()` — fires `POST /api/analytics/log` with `character_approved` event
- Emoji badge shown in card header next to character name

**`CharacterSetRatingModal` (new component at bottom of file):**
- Props: `characters`, `allCharReactions`, `activeVersionTabs`, `onSkip`, `onSave`
- Star rating (1-5, optional), comment textarea, character reactions summary row
- "Skip →" (no countdown) and "Save & Continue →" buttons

**Main `Step2Characters` additions:**
- `allCharReactions: Record<string, Record<number, string>>` state
- `showCharSetRating: boolean` state
- `stepStartRef = useRef(Date.now())` for time-spent tracking
- `handleApproveAndContinue()` now shows modal instead of calling `proceedWithApproval()` directly
- `handleCharSetRatingSave()` — saves to `/ratings/character-set`, logs `step3_completed` event, calls `proceedWithApproval()`
- `handleReactionChange()` — updates `allCharReactions`

---

#### Feature 7 — Admin Analytics Dashboard (`/admin`)

**Backend: `backend/app/routers/admin_analytics.py`** (new file):
- `GET /api/admin/overview` — KPIs (users, comics, images, avg rating, avg regens), funnel, comics-per-day sparkline, panel reaction distribution
- `GET /api/admin/quality` — star distribution, panel reactions, regen impact by version, avg rating by art style, keyword frequency
- `GET /api/admin/regeneration` — total regens, avg per comic, % users who regen'd, most-regenned pages, before/after reaction samples
- `GET /api/admin/export` — raw data dump (panel_ratings/comic_ratings/projects) as JSON or CSV
- `GET /api/admin/thesis-report` — auto-generated markdown evaluation summary
- All protected via `X-Admin-Key` header against `settings.ADMIN_SECRET_KEY` ("mohiom-admin-2024")

**Backend: `backend/app/routers/analytics.py`** (new file):
- `POST /api/analytics/log` — fire-and-forget event logging; stores to `analytics_events` MongoDB collection
- Never raises to caller; any DB error is silently swallowed

**Backend: `backend/app/routers/ratings.py`** (modified):
- Added `CharacterRatingRequest`, `CharacterSetRatingRequest` models
- Added `POST /ratings/character`, `GET /ratings/characters/{comic_id}`
- Added `POST /ratings/character-set`, `GET /ratings/character-set/{comic_id}`

**Backend: `backend/app/main.py`** (modified):
- Registered `ratings`, `admin_analytics`, `analytics` routers

**Frontend: `frontend/src/app/admin/page.tsx`** (new file):
- `AdminAuth` gate component (key validated against real API call)
- 5 tabs: Overview, Characters, Quality, Regeneration, Export
- Pure CSS/SVG chart components: `BarChart`, `DonutChart`, `LineChart`, `FunnelChart`, `ScoreBar`, `CharacterFunnel`
- `KPICard`, `Section`, `Loading` shared components
- `OverviewTab`, `CharactersTab`, `QualityTab`, `RegenerationTab`, `ExportTab`
- Date range picker: Today / Last 7d / Last 30d / All time

---

#### Feature 7 — Characters Analytics Tab

**Backend: `GET /api/admin/characters`** (added to `admin_analytics.py`):
- **FIX 1 KPIs**: total generated/rated/approved, avg versions, avg stars, approval rate
- **FIX 2 Version quality**: aggregates `character_ratings` by version (capped at V3+), computes avg score (love=4/good=3/neutral=2/bad=1), calculates V1→V2 improvement %
- **FIX 3 Role + mode quality**: `$lookup` joins `analytics_events` with `character_ratings` via `character_id`, groups by `character_role` and `generation_mode`
- **FIX 4 Chip analysis**: `Counter` on `chips_selected[]` for `neutral`/`bad` rated characters; returns sorted most-common
- **FIX 5 Pearson r correlation**: per-comic avg char score vs avg panel score; computes Pearson r from Python; reaction table shows avg panel score per char reaction
- **FIX 6 Character funnel**: generated → rated → regenerated → approved counts

**Frontend: `CharactersTab` component** (in `admin/page.tsx`):
- 4 KPI cards (Total Generated, Avg Versions/Char, Avg Stars, Approval Rate)
- Version quality `ScoreBar` chart + finding callout (V1→V2 jump %)
- Role quality + Generation mode quality side-by-side bar charts
- Chip complaint horizontal bar chart with count + %
- Pearson r badge + reaction-to-panel correlation table
- Character design funnel (`CharacterFunnel` component)
- "Export Characters CSV" download button

**Analytics logging in `Step2Characters.tsx`**:
- `character_generated` — fires in `handleCharacterVersionedRegenerate` with `generation_mode`, `version`, `character_id`, `comic_id`
- `character_approved` — fires via `logCharApproved()` in both `handleApproveWithCheck` (direct) and `handleApproveAnyway` (warning bypass)
- `step3_completed` — fires in `handleCharSetRatingSave` with `total_characters`, `avg_versions`, `stars`, `time_spent_seconds`

---

### 📂 KEY FILES CHANGED THIS SESSION

**Backend**
- `backend/app/routers/admin_analytics.py` — **New** (5 endpoints + `GET /characters` with full aggregation pipeline)
- `backend/app/routers/analytics.py` — **New** (fire-and-forget event logging)
- `backend/app/routers/ratings.py` — Added character + character-set rating endpoints
- `backend/app/main.py` — Registered 3 new routers

**Frontend**
- `frontend/src/app/admin/page.tsx` — **New** (full admin dashboard, 5 tabs, pure CSS/SVG charts)
- `frontend/src/components/studio-steps/Step2Characters.tsx` — Character rating widget, chip feedback, approve intercept, set rating modal, analytics event logging

---

### 🔑 ADMIN KEY

```
mohiom-admin-2024
```
Access at: `http://localhost:3000/admin`

---

### 🐛 DECISIONS & NOTES

- **Rating per version**: `ratingByVersion: Record<number, CharReaction>` — key is version index (0=V1, 1=V2, etc.), enables before/after quality comparison in admin
- **Chip auto-append**: chip label (emoji stripped) is appended to feedback textarea; duplicates are skipped
- **Approve flow**: `handleApproveWithCheck` is a wrapper, not a direct `onApprove` pass-through. The collapsed header still uses plain `onApprove` since rating widget isn't visible there
- **`CharacterSetRating` modal has NO countdown** — Skip button is instant, no auto-advance timer
- **Analytics never block user flow** — all `apiClient.post('/analytics/log', ...)` calls have `.catch(() => {})` — DB errors are silently swallowed
- **`character_generated` version index**: computed as `(versionBoundaries[charId]?.length ?? 1)` before the state update, so V1=0, V2=1, etc.
- **Pearson r threshold**: r ≥ 0.7 = strong, 0.4–0.7 = moderate, 0.1–0.4 = weak, < 0.1 = no correlation; requires ≥ 3 comics with both char + panel ratings
- **Pre-existing TS errors**: 13 `ConfettiCanvas` null-check errors in `Step4Generation.tsx` remain (pre-existing, not introduced this session). Zero new TS errors from this session's changes.

---

### 🎯 NEXT STEPS

1. **Test character rating flow end-to-end** — generate a character, rate it 😍/👎, verify chips appear, verify emoji shows in version tab + card header, verify `/ratings/character` POST fires
2. **Test CharacterSetRating modal** — click "Approve & Continue", verify modal intercepts, save stars + comment, verify `/ratings/character-set` POST fires
3. **Test admin dashboard** — navigate to `localhost:3000/admin`, enter key `mohiom-admin-2024`, verify all 5 tabs load without errors
4. **Seed analytics data** — run a full comic generation session so `analytics_events` collection has data for the Characters tab to display
5. **Gallery page auth gate** — `/gallery` shows "Add to My Library" even for unauthenticated users; should check `localStorage['mohiom-user-id']` and prompt sign-in
6. **Export error UX** — `exportStatus === 'error'` has no visible error message; should show a toast

---

## SESSION: 2026-06-12

### 🎯 CONTEXT — Export feature (ZIP + PDF) + Community Gallery (characters + comics)

---

### ✅ COMPLETED

#### Export Feature — ZIP Image Pack + PDF Comic

**New utility: `frontend/src/lib/export.ts`**
- `exportAsZip(pages, opts)` — builds a JSZip archive with `page-1.png … page-N.png` (base64-stripped from data URLs) + optional `manifest.json` (per-page panel metadata); triggers browser download as `comic-{projectId}.zip`
- `exportAsPdf(pages, opts)` — builds a jsPDF A4 portrait document, one full-bleed image per PDF page; optional text appendix page with dialogue/shot types; downloads as `comic-{projectId}.pdf`
- Packages installed: `jszip`, `jspdf`

**Context (`ComicGenerationContext.tsx`)**
- `buildExportPages(data)` — joins `pageStates` (success only) with `panels` by `pageNumber` into `ExportPage[]`
- `exportZip(includeMetadata)` / `exportPdf(includeMetadata)` — call the lib functions; manage `exportStatus: 'idle' | 'exporting' | 'error'`
- Added to `ComicGenerationContextValue` interface + provider value

**UI (`Step4Generation.tsx` — ExportModal)**
- Removed `soon: true` from "PDF Comic" and "Image Pack" — both now active
- Removed the unused resolution selector (Web / HD / Print)
- Added metadata checkbox: "Include panel script (dialogue, shot types, prompts)"
- Buttons disabled when no images exist (`hasImages` prop) or while exporting
- Both buttons trigger download then close the modal

---

#### Community Gallery — Characters + Comics

**Backend**

`backend/app/schemas.py`:
- `is_public: bool = False` added to `CharacterSummary`, `CharacterPatchPayload`, `ProjectListItem`
- New: `ProjectPublishPayload(is_public)`, `GalleryComicSummary`, `GalleryComicDetail`

`backend/app/routers/projects.py`:
- `list_characters` response now includes `is_public` from `user_characters` doc
- `update_standalone_character` PATCH handles `is_public` field
- `list_projects` response now includes `is_public` from project doc
- New: `PATCH /api/projects/{project_id}/publish` — toggles `is_public` on project doc

`backend/app/routers/gallery.py` (new file):
- `GET /api/gallery/characters` — all `user_characters` where `is_public=True`; no auth required
- `GET /api/gallery/comics` — all `projects` where `is_public=True` AND has ≥1 success page image; returns `GalleryComicSummary` (cover URL, title from first story line, genre, art style, synopsis, page count)
- `GET /api/gallery/comics/{project_id}` — full detail for reader (story text, characters, all success page URLs)

`backend/app/main.py`: registered gallery router at `/api/gallery`

**Frontend — Types + API (`api.ts`)**
- `is_public?: boolean` on `CharacterSummary` and `CloudProjectListItem`
- New interfaces: `GalleryComicSummary`, `GalleryComicDetail`
- `projectsApi.publishProject(id, isPublic)` → `PATCH /api/projects/{id}/publish`
- New `galleryApi`: `characters()`, `comics()`, `comicDetail(id)`

**`CharacterLibraryModal.tsx`**
- Globe icon (lucide-react) share toggle on each card (bottom-right corner)
- Optimistic state update: clicks call `projectsApi.updateStandaloneCharacter(id, { is_public })`, reverts on error
- `onShareToggle` prop passed down from modal to `CharacterCard`

**`GalleryModal.tsx` (new component)**
- Community character picker modal — same layout/UX as `CharacterLibraryModal` but fetches from `galleryApi.characters()`
- No share toggle (can't modify others' data)
- "Add to Project" footer → `onConfirm(selected)` → `injectLibraryCharacters()`

**`ComicReaderModal.tsx` (new component)**
- Fullscreen black-background comic reader
- Screen 0: story info (title, genre, art style, synopsis); "Start Reading" button
- Pages 1…N: full-bleed image per screen
- Keyboard nav (← → Escape), prev/next chevron buttons, page counter
- "Story" toggle button in top bar opens overlay with full `story_content` + `main_characters`
- Page dot indicator (shown if ≤12 pages)

**`Step2Characters.tsx`**
- Added "Browse Community" button (public icon) in the same toolbar row as "From Library"
- Opens `GalleryModal` with same `existingIds` and `onConfirm={injectLibraryCharacters}`

**`ProjectsDrawer.tsx`**
- "Publish" / "Published" globe button on each project card that has Step 4 images (`has_step4=true`)
- Calls `projectsApi.publishProject()` with optimistic state update
- Indigo styling when published; gray when private

**`app/gallery/page.tsx` (replaced static marketing page)**
- Full-page community gallery with **Comics** | **Characters** tab switcher
- **Comics tab**: responsive grid of comic cover cards (3:4 image, title, genre badge, art style, synopsis snippet, page count); click → opens `ComicReaderModal`
- **Characters tab**: responsive grid of character cards; "Add to My Library" button per card → `POST /api/projects/characters` (clone to own library); shows "✓ In Library" after success
- Search in both tabs; loading skeletons; empty states with CTAs
- Back link to Studio

---

### 📂 KEY FILES CHANGED THIS SESSION

**Backend**
- `backend/app/schemas.py` — `is_public` on 3 schemas; new `ProjectPublishPayload`, `GalleryComicSummary`, `GalleryComicDetail`
- `backend/app/routers/projects.py` — `is_public` flows through list/update; new PATCH publish endpoint
- `backend/app/routers/gallery.py` — **New** (3 public GET endpoints)
- `backend/app/main.py` — gallery router registered

**Frontend**
- `frontend/src/lib/export.ts` — **New** (ZIP + PDF utilities)
- `frontend/src/services/api.ts` — `is_public` on types; new gallery types + APIs
- `frontend/src/context/ComicGenerationContext.tsx` — `exportZip`, `exportPdf`, `exportStatus`; imports from `@/lib/export`
- `frontend/src/components/CharacterLibraryModal.tsx` — globe share toggle
- `frontend/src/components/GalleryModal.tsx` — **New** (community character picker)
- `frontend/src/components/ComicReaderModal.tsx` — **New** (fullscreen reader)
- `frontend/src/components/studio-steps/Step2Characters.tsx` — "Browse Community" button + `GalleryModal`
- `frontend/src/components/studio-steps/Step4Generation.tsx` — ExportModal: remove `soon`, metadata toggle, `exportZip`/`exportPdf` wired
- `frontend/src/components/ProjectsDrawer.tsx` — publish toggle per project
- `frontend/src/app/gallery/page.tsx` — **Full rewrite** (tabbed community gallery)

---

### 🐛 DECISIONS & NOTES

- **Gallery characters**: only `user_characters` (standalone library chars) are shareable. Characters embedded only in projects (`step2ImageReview`) must be saved to the library first before sharing.
- **Gallery comics**: only projects with `is_public=True` AND ≥1 success page image appear. The cover is the first success pageState URL. Story title is derived from the first line of `story_content` (80-char limit).
- **"Add to My Library" on gallery page**: clones the character as a new standalone `user_characters` doc with a fresh `gallery-{original_id}-{timestamp}` ID. Does not import it into the current project (that's the GalleryModal flow inside Step 2).
- **Standalone `/gallery` page context**: lives outside `ComicGenerationProvider`, so cannot call `injectLibraryCharacters()` directly. The two flows are: (A) gallery page → Add to Library → use via library modal in Step 2; (B) Studio Step 2 → GalleryModal → inject directly.
- **Pre-existing TS errors**: 13 `ConfettiCanvas` null-check errors in `Step4Generation.tsx` remain; not introduced by this session. `npx tsc --noEmit` shows zero new errors.
- **`user_inputs` field names**: backend saves camelCase from frontend (`story_content` or `storyText`, `manga_genre` or `genre`, etc.) depending on when the project was saved. Gallery endpoint tries both key variants with `or` fallback.

---

### 🎯 NEXT STEPS

1. **Test gallery end-to-end**: share a character → verify it appears in `/gallery` Characters tab; publish a project with images → verify it appears in Comics tab
2. **Gallery page auth**: currently shows "Add to My Library" even for unauthenticated users — should check for `localStorage['mohiom-user-id']` and prompt sign-in
3. **Pagination**: gallery endpoints return all public items; add `?limit=` + `?skip=` pagination when content grows
4. **Character gallery search backend**: current search is frontend-only (client-side filter on fetched array) — fine for now, needs backend search when gallery grows
5. **PDF appendix improvement**: currently only includes dialogue/SFX; could also include shot types and panel labels for richer script output
6. **Export error UX**: `exportStatus === 'error'` currently no visible error message in UI — should show a toast

---

## SESSION: 2026-06-11

### 🎯 CONTEXT — Step 3 Script polish + Step 4 Generation full UI overhaul

All work this session is in:
- `frontend/src/components/studio-steps/Step3Script.tsx`
- `frontend/src/components/studio-steps/Step4Generation.tsx`
- `frontend/src/styles/globals.css`

---

### ✅ COMPLETED

#### Step 3 Script — UI polish pass

**Panel-level accordion (one panel open globally):**
- Replaced per-panel local expand state with `expandedPanelKey: string | null` (format `ch-pg-panel`)
- 48px collapsed header: chevron, `[PANEL N]` badge, shot-type tag, 1-line summary, Ch.N·P.N ref, StatusDot
- Expanded: `#EEF2FF` bg + 3px brand-color left border
- Approved panels dim to 70% opacity
- CSS grid accordion: `grid-rows-[0fr]` ↔ `grid-rows-[1fr]`

**Auto-advance on approve:** clicking approve in a panel auto-expands the next un-approved panel on the same page; when all panels on a page are done, auto-advances to the next page's first panel.

**Navigation panel — sticky + scrollable:**
- Removed `items-start` from flex container (was causing parent height = element height → zero scroll range)
- Fixed height via `style={{ height: 'calc(100vh - 14rem)' }}` (not `max-h`) to activate `flex-1 overflow-y-auto`
- Accounts for topbar + bottom bar in the calc

**Toolbar cleanup (duplicate CTAs removed):**
- Removed `[Approve All]` button entirely
- Removed `[Regen Pending]` disabled stub from toolbar
- Removed `Filter` select from toolbar (duplicates left nav filter)
- Kept: Hide Nav toggle, Collapse All / Expand All, View Mode selector

**Bottom bar redesign:**
- 4px animated progress bar at top of bar (emerald when approved, brand-blue otherwise)
- `Regen Pending (N)` with pill badge + tooltip "Regenerate all N pending panels at once"
- `Revoke` button (shown when step is approved)
- CTA: `Approved · Continue →` (emerald + glow + 2× pulse on first completion) vs `Approve & Continue →`
- Pulse animation via `useRef` detecting `allDone` transition

**Markdown rendering:**
- Replaced raw text renders with `<Markdown>` shared component (`react-markdown` + `remark-gfm` + `rehype-raw`)
- Applied to both streaming live text and raw script fallback `<pre>`

**Lint fixes in Step3Script:**
- Removed unused `StateBadge` component (leftover from earlier rewrite)
- Rewrote ternary `s.has(n) ? s.delete(n) : s.add(n)` as `if/else` blocks (ESLint `no-unused-expressions`)

---

#### Step 4 Generation — full UI overhaul

**Global Generation Dashboard (4 visual states):**
- **Before / building panels:** centered card, "✦ Ready to generate" or spinner; full-width gradient CTA `⚡ Generate All Panels` (`bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]`, `rounded-full`, shadow glow)
- **Panels built, ready for images:** "✦ Panels ready — generate your images", `⚡ Generate All Images` CTA
- **Generating:** `SegmentedProgressBar` (green/amber/shimmer/gray), color-coded stats row, italic "Drawing: Page X…" label, Pause + Cancel buttons
- **Paused:** amber bar + "Paused — N/M completed", Resume + Cancel
- **Complete (no errors):** "🎉 Comic của bạn đã sẵn sàng!" banner (`linear-gradient(135deg,#EEF2FF,#F0FDF4)`, `border-[#BBF7D0]`, `animate-slide-down`), "👁 Preview Comic" + "⬇ Export & Finish →" CTA
- **Complete (with errors):** amber theme, segmented bar, "↺ Thử lại N panels lỗi"

**Panel card — 5-state image areas (`PanelImageArea` component):**
1. **Queued** (`idle`, far back): gray dashed border, hollow circle icon, "#N trong hàng đợi"
2. **Skeleton** (`idle`, queue position 0–1): shimmer wave animation
3. **Generating** (`loading`): `#EEF2FF` bg, `animate-border-pulse`, 32px brand spinner, "Đang vẽ...", mini progress bar + countdown timer (~45s estimate, updates per second)
4. **Success** (`success` + imageUrl): image fill, green border flash on first appear, `animate-panel-appear` entry; hover overlay → "🔍 Xem full / ↺ Vẽ lại / ✓"
5. **Error** (`error`): `#FEF2F2` bg, dashed red border, ⚠ icon, "↺ Thử lại" button

**Queue position computation:** global `panelQueuePositions` memo counts idle panels in flat order across all pages; skeleton threshold ≤ 1.

**`PanelHeaderBadge` component:** replaces `PanelStatusDot` in card headers — shows "⟳ Generating" (blue), "✗ Error" (red), "✓ Done" (green) contextual badges.

**Finish button — 4-state machine (bottom bar):**
- `not-started`: gray, disabled, 60% opacity; tooltip "Vui lòng generate ảnh trước…"
- `in-progress`: gray, disabled; SVG mini progress ring (inline `<circle>` with `strokeDasharray`); tooltip "Đang tạo ảnh… N/M hoàn thành"
- `has-errors`: amber `#FEF3C7` bg, `#92400E` text, yellow border, clickable → opens error confirmation modal
- `all-complete`: green `#22C55E`, "✓ Finish & Export →", shadow glow; pulse+scale animation on first completion; click → opens Export modal

**Error confirmation modal** (state `has-errors`): "↺ Thử lại panels lỗi" (retries all error pages) + "Tiếp tục anyway →" (calls `handleApprove(4)`)

**Error handling system:**
- `SegmentedProgressBar` component: 3 segments — emerald (success) / amber (errors) / shimmer (loading) / gray bg (pending); used in dashboard, StatsBar section, and bottom bar
- **Toast stack** (fixed top-right, z-60): fires on new panel error transitions (detected via `prevPanelStatesRef`); auto-dismiss after 6s; "Bỏ qua" / "Thử lại ngay" buttons; max 4 stacked; `animate-panel-appear` entry; toast timeouts cleaned up on unmount
- **Error filter toggle**: "⚠ Xem panels lỗi (N)" button in panel view header; when active, narrows all 3 views (page/grid/list) to error panels only; auto-clears when `step4Stats.error === 0`
- **Bottom bar center**: "✓ N/M hoàn thành · ⚠ N lỗi · [↺ Thử lại]" with inline segmented bar (6px height)
- **Dashboard complete card**: shows error count + retry CTA inline; hides export CTA when errors exist

**Completion emotional payoff:**
- `ConfettiCanvas` component: fixed canvas overlay (z-70, pointer-events-none), 90 brand-colored rectangular particles, gravity + rotation physics, fades out over 1.8s, auto-removes via `onDone`; triggered once when `isImageGenerating` transitions false with 100% success
- **Success banner**: "🎉 Comic của bạn đã sẵn sàng!" with panel/chapter/page counts, `animate-slide-down` 400ms
- `PreviewModal` component: full-screen dark overlay, page image slideshow, keyboard arrow navigation + Escape to close, page counter
- `ExportModal` component: "📦 Xuất truyện tranh" modal, 2×2 grid (PDF Comic — soon, Image Pack — soon, Save to Cloud — live, Export JSON — live), resolution selector (Web 72dpi / HD 150dpi / Print 300dpi), "✓ Đánh dấu hoàn thành" footer → calls `handleApprove(4)`

**Button style:** all `rounded-[10px]` → `rounded-full` to match webapp style system.

**Bottom bar 4px progress line:** replaces border-t at top of bar; color follows `finishBtnState` (green/amber/indigo).

---

#### CSS additions (`globals.css`)

```css
@keyframes shimmer        /* skeleton loading wave */
.animate-shimmer

@keyframes border-pulse   /* generating panel border oscillation */
.animate-border-pulse

@keyframes panel-appear   /* scale(0.95)→1, opacity 0→1 on image reveal */
.animate-panel-appear

@keyframes slide-down     /* translateY(-14px)→0 for success banner + export modal */
.animate-slide-down
```

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/components/studio-steps/Step3Script.tsx` — panel accordion, nav sticky, toolbar cleanup, bottom bar redesign, markdown fix, lint fixes
- `frontend/src/components/studio-steps/Step4Generation.tsx` — Generation Dashboard 4 states, 5-state panel image areas, finish button state machine, error toasts, segmented progress bar, error filter, confetti, success banner, preview modal, export modal
- `frontend/src/styles/globals.css` — 4 new keyframe animations + utility classes

---

### 🐛 DECISIONS & NOTES

- **`isImageGenerating` before initialization bug**: derived value was placed after the `useEffect` that depended on it → fixed by moving all derived values (`cooldown`, `isGenerating`, `isImageGenerating`, `canBuildPanels`) above the effects
- **Sticky nav + `items-start`**: classic sticky trap — parent height equals sticky element height = zero scroll range. Fix: remove `items-start` from flex container so column stretches to content height
- **Queue position for skeleton state**: panels with `status === 'idle'` are counted in flat order across all pages; position 0–1 → skeleton (shimmer); 2+ → queued (static)
- **Toast timer cleanup**: `toastTimeoutsRef` accumulates `setTimeout` IDs; a separate `useEffect([])`  clears all on unmount; individual `dismissToast` calls clear their specific timeout
- **PDF/Image Pack in export modal**: marked "Soon" (disabled) since backend doesn't support these formats yet; UI is ready to wire up
- **`handleApprove(4)`** is called from within the export modal (not from the Finish button directly) — the button now opens the modal, and "Mark Complete" lives inside the modal

---

### ✅ Step 3 — Streaming Render System

Replaced raw `<Markdown>{step3.streamingText}</Markdown>` during generation with a structured live render:

**New types:** `PanelStreamStatus`, `LivePanelField`, `LivePanel`, `LivePage`, `LiveChapter`, `StreamParserState`, `StreamProgressInfo`

**`buildSkeletonChapters()`:** Reads chapter titles from `step1.data.structuredJson.steps.step_1_analysis.data.chapter_outline`. Falls back to `numChapters × (targetPages/numChapters)` pages. Shows real chapter titles in skeletons before streaming begins.

**`useStreamParser` (ref-based):** `parserRef` holds `StreamParserState` — mutated in-place each tick, never triggers re-renders directly. `streamTick` counter incremented on each `setStreamTick(t+1)` causes re-renders. O(n) total parse cost. Lines stripped of `##`, `**`, `- ` prefix before matching. Stops at `===JSON===` (JSON block never visible).

**`LivePanelCard`:** Renders live panels during streaming. `status === 'skeleton'` → `SkeletonPanelCard` shimmer. `status === 'streaming'` → `animate-border-pulse` border, `▋` cursor on active field, shimmer placeholders for empty fields. `status === 'complete'` → static card, no cursor.

**Streaming layout:** Two-column (NavPanel + content) same as post-stream. NavPanel reads `liveChaptersAsParsed` (LiveChapters converted to ParsedChapter[] via useMemo + streamTick). Active streaming panel auto-expanded via `activeStreamPanelKey`.

**Skeleton placeholders:** Before first chapter arrives, shows full skeleton structure. After chapters start arriving, shows remaining expected chapters as skeleton accordions (with real titles from step1 outline).

**Progress bar:** `ScriptBottomBar` accepts new `streamProgressInfo?: StreamProgressInfo` prop. Shows "N panels written · Ch.X · P.Y · Panel Z" during generation.

**Key files changed:**
- `frontend/src/components/studio-steps/Step3Script.tsx` (+538 lines)

---

### 🎯 NEXT STEPS

1. **Test panel-level accordion with real script data** — verify `expandedPanelKey` auto-advance works correctly with the actual backend panel numbering
2. **Wire PDF/Image Pack export** — implement backend endpoints for PDF generation (e.g., using `reportlab`) and image ZIP packaging
3. **Panel-level regeneration** — currently "↺ Vẽ lại" and "↺ Thử lại" in panel image areas call `handleRegeneratePage(pageNumber)` (page-level); implement panel-level regen in context when backend supports it
4. **Pause button functionality** — `setIsPaused(true)` updates UI to paused state but doesn't actually pause the generation queue; needs backend SSE cancellation or queue management
5. **Preview modal with panel images** — currently shows page-level images (`pageStates[].imageUrl`); could also support panel-level images if those become available

---

## SESSION: 2026-06-10

### 🎯 CONTEXT — Step 2 Character Designs UI polish + Step 3 Panel Script full rewrite

All work this session is in:
- `frontend/src/components/studio-steps/Step2Characters.tsx`
- `frontend/src/components/studio-steps/Step3Script.tsx`

---

### ✅ COMPLETED

#### Step 2 Characters — UI redesign

**Typography & readability (`CharacterDesignInfo`)**
- Character name: `text-[20px] font-bold text-primary`, subtitle: `text-[14px] font-medium text-on-surface-variant`
- Section labels: `text-[11px] font-semibold uppercase text-[#888] letterSpacing: 0.08em`
- Section content: `text-[13px] text-[#444] leading-[1.6]`, wrapper `max-w-[520px]`
- Chip extraction from Physical/Outfit sections: `split(/[,;·•]+/)` → filter ≤30 chars, 1–5 words → show as pills when ≥2 found
- Dark AI prompt code block: `bg-[#1e1e1e]` pre, `bg-[#2d2d2d]` toolbar, copy button with `check` / `content_copy` icon toggle

**Accordion list spacing:** `space-y-2` → `space-y-4` (16px between character cards)

**Header summary status bar:**
- Shows `N Character(s)` + colored dot indicators: emerald `Approved`, blue `Generated`, gray `Pending`
- Computed from `approvedCount`, `generatedCount` (candidates but not approved), `noCandidatesCount`

**`ApprovalProgressBadge` component (references tab, top-right):**
- Shows `Approved N/total characters` with check_circle / pending icon
- Progress bar: `bg-emerald-500` when all done, `bg-primary/60` otherwise

**Global toolbar (references tab) grouped into single pill container:**
- `Regenerate All (primary) | From Library | Reset` with `|` dividers inside one `rounded-2xl border bg-surface-container` wrapper

**Sticky bottom bar redesign:**
- Completion dots: colored circles per character (emerald = approved, blue = generated, gray = pending) + `N/total` counter
- `Revoke` button moved inline to bottom bar (designs tab only, state 4)
- Regenerate button shown only on designs tab

#### Step 3 Panel Script — full rewrite (`Step3Script.tsx`, ~370 lines)

**Parser:**
- `parseScript(md)` — state machine with 5 modes (description/dialogue/prompt/layout/none)
- Handles `Chapter N`, `Page N`, `Panel N` headers; `Layout Summary:`, `AI Image Prompt:`, `Dialogue/SFX:` labels
- Fallback to raw `<pre>` if no page/panel markers found
- Produces `ParsedChapter[] → ParsedPage[] → ParsedPanel[]`

**Components:**
- `StatusDot` — emerald check_circle (approved), blue filled circle (generated), gray ring (pending)
- `PromptBlock` — `bg-[#1E1E2E]` / `text-[#A8B4FF]` code block with `bg-[#2D2D4E]` toolbar and copy button
- `DialogueLines` — speech (left border `border-primary/30`, italic, speaker bold), SFX (`text-[#FF6B00]` monospace), caption (gray italic)
- `ChapterHeading` — `CH.N` badge `bg-primary`, `text-[18px] font-bold`, `bg-primary/10` container
- `PageHeading` — `text-[15px] font-semibold`, `border-l-[3px] border-[#CBD5E1]`, `sticky top-[2.5rem] z-10 bg-white`
- `PanelCard` — 2-column layout (Script: white | Image Prompt: `bg-[#F8F9FF]`), CSS grid accordion animation (`grid-rows-[0fr]` ↔ `grid-rows-[1fr]`), per-panel Regen/Edit/Copy/Approve footer

**Left nav panel (280px):**
- Tree view: Chapter → Page → Panel with collapse toggles
- `StatusDot` per panel; filter pills (All / Pending / Ready / Approved) sync with main content
- Non-matching panels dimmed (`opacity-30`); clicking scrolls via `document.getElementById`

**Toolbar (sticky below page title):**
- Collapse All / Expand All pills
- Filter select (synced with nav panel filter)
- Disabled "Regen Pending" stub
- "Approve All" button (active when state 3 or 5)
- 4-way View Mode toggle: Script | Prompts | Dialogue | Compact

**Bottom navigation bar (`ScriptBottomBar`, fixed):**
- `fixed bottom-0 right-0 style={{ left: 'var(--studio-sidebar-width, 0)' }}`
- Left: `← Previous Step` → `setActiveStep(2)`
- Center: progress bar (`X Generated · Y Pending — Z%`) turns emerald when approved
- Right: Regenerate button (disabled during cooldown, shows countdown) + `Continue → Images` button
- Continue warning popover if pending panels > 0 ("continue anyway?" with Cancel / Continue Anyway)

**Removed (user requested, too over-designed):**
- `GlobalRulesBanner` — collapsible scripting rules banner at top of page
- `RulesSlideOver` — fixed 400px slide-over panel for rules
- Floating "Rules" tab button pinned to right edge
- `SummaryDrawer` — slide-up table with chapter/page/panel stats
- Floating "📊 Summary" button
- `parsePreamble`, `parsePreambleIntoSections`, `DEFAULT_RULES`, `PageSummaryRow`, `handleExportJSON`

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/components/studio-steps/Step2Characters.tsx` — UI polish: typography, chips, status bar, progress badge, toolbar pill, bottom bar redesign
- `frontend/src/components/studio-steps/Step3Script.tsx` — **full rewrite**: structured panel cards, nav panel, toolbar, bottom bar (~370 lines final)

---

### 🐛 DECISIONS & NOTES

- `parsePanelStatus`: `undefined` key in `panelExpandStates` means expanded (truthy default), avoids needing an init effect
- ViewMode `compact` overrides `isExpanded` locally in `PanelCard` without modifying stored state — switching back restores previous expand states
- Filter in nav dims non-matching panels (structural nav preserved); filter in toolbar hides panels entirely from main content
- `setActiveStep(2)` = go to Step 2 (Character Designs), `setActiveStep(4)` = go to Step 4 (Image Generation) from Step 3
- TypeScript strict-mode check (`npx tsc --noEmit`) passes with zero errors after all changes

---

### 🎯 NEXT STEPS

1. **Test Step 3 parser with real backend output** — verify `parseScript` correctly detects Chapter/Page/Panel headers from actual Gemini script markdown
2. **Step 4 Generation** — connect Step 3 `Continue → Images` to actual Step 4 generation flow
3. **Panel-level regeneration** — currently stubbed as disabled; implement per-panel regen when backend supports it
4. **Inline panel editing** — "Edit" button in each PanelCard footer is currently disabled stub

---

## SESSION: 2026-06-09

### 🎯 CONTEXT — Step 2 Characters: Full streaming accordion rewrite + earlier UI fixes

All work this session is in `frontend/src/components/studio-steps/Step2Characters.tsx` and `frontend/src/context/ComicGenerationContext.tsx`.

---

### ✅ COMPLETED

#### Phase 1 — UI fixes (earlier in session)

**Prompt queue panel fix** — was showing 27 sub-section entries instead of 2–3 character names.
- Root cause: AI generates H2-depth character headers (`## Kael / The Blacksmith God`) with H3-depth sub-sections (`### Name & Role`). The old `sectionsWithMeta` treated H3 as `isMainChar=true`, so sub-sections became separate cards/nav tabs.
- Fix: Added `DESIGN_SUB_RE` pattern matching; when all H3 sections look like design sub-fields, filter to depth-2 only. Nav counter changed to `{total} character{total !== 1 ? 's' : ''}`.

**Sub-nav ugly pills fix** — was overflowing with sub-section names ("Name & Role", "Personality & Backstory", etc.).
- `navLabel` strips subtitle after `/`: `sec.name.replace(/\s*[\/—–-].*$/, '')...slice(0, 24)`
- `SectionNavPills` styling cleaned: removed gradient fade, `text-sm` pills, `bg-gray-100` inactive

**Console logging** — added prompt + response logging in `ComicGenerationContext.tsx` Step 2 generation paths (both streaming and non-streaming). Logs before API call (indigo group) and after stream completes (green group with `designMarkdown` and `structuredJson`).

#### Phase 2 — Full streaming accordion rewrite (Design Sheets tab)

`Step2Characters.tsx` completely rewritten using the same streaming accordion pattern as `Step1Analysis.tsx`.

**New parsing infrastructure:**
- `DESIGN_SECTION_DEFS` — 5 sections matching actual AI output: Global Design Guidelines, Main Character Design Sheets, Supporting Character Design Sheets, Interaction & Relationship Notes, Final Design Summary
- `findMarker(text, coreMarker)` — handles any heading prefix (`##`, `###`, `#`, `####`, `**`, bare)
- `parseDesignSections(text)` — returns `skeleton | active | complete` per section during streaming
- `cleanContent(raw)` — strips trailing bullet noise

**New components:**
- `SkeletonLines` — shimmer placeholder (same as Step1Analysis)
- `SectionAccordion` — `React.forwardRef`, dot/spinner/checkmark per status, auto-open during stream does NOT count as reviewed
- `DesignSheetsRightPanel` — progress bar during stream, per-section dots with 3 states, reviewed counter (`N / 5 reviewed`), approved badge, "View in Reference Images" shortcut
- `StateBadge` — now accepts streaming progress bar props; shows live `{current} / {total}` during generation

**Accordion state in main component:**
- `openSections: Set<number>`, `reviewedSections: Set<number>`, `showReviewWarning`
- `prevActiveRef` — detects new active section to auto-open without marking reviewed
- `wasLoadingRef` — detects generation start to reset open sections
- `prevStateRef` — detects stream complete (2→3) to reset review tracking
- Auto-open effect, reset-on-generate effect, stream-complete effect

**Review tracking + warning dialog:**
- Only user-triggered expands (`toggleSection`) mark a section reviewed
- "Approve & Continue →" when unreviewed sections exist → shows warning banner with "Review sections ↑" scroll shortcut and "Approve anyway →" override
- Warning dismisses automatically once all sections reviewed

**Scroll-to navigation:** `sectionRefs` map + `scrollTo(id)` + `scrollIntoView({ behavior: 'smooth' })`

**Removed components** (no longer needed):
- `CharSection`, `parseCharacterSections`, `slugify`, `SectionNavPills`
- `FieldLabel`, `FieldValue`, `DesignSheetCard`, `PromptQueuePanel`

**Kept 100% intact:**
- Reference Images tab — split panel, `CharacterReviewCard`, version history, `CharacterDesignSummary`, `AspectRatioSelector`, `CharacterLibraryModal` wiring, all context hooks
- `parseStructuredSections`, `extractCharacterSection` — still used by `CharacterDesignSummary`
- `useSplitPanel`, `computeVersions`, `CharacterReviewCard`

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/components/studio-steps/Step2Characters.tsx` — full rewrite (streaming accordion + cleanup)
- `frontend/src/context/ComicGenerationContext.tsx` — added Step 2 console logging

---

### 🐛 DECISIONS & NOTES

- `findMarker` tries heading prefixes in order `## → ### → # → #### → ** → bare`. This handles all known Gemini output variants without requiring exact markdown format.
- Fallback in `parsedSections` useMemo: if no section markers found in final markdown, dumps everything into section 1 content so the output is never lost.
- Stream auto-open via `prevActiveRef` — only fires when `active.id !== prevActiveRef.current`, preventing re-opens on each re-render tick.
- State 2→3 transition (stream complete): `setReviewedSections(new Set())` + `setOpenSections(new Set([1]))` — counter resets to 0, user must manually expand all 5 sections before approving.
- TypeScript strict-mode check (`npx tsc --noEmit`) passes with zero errors after all changes.

---

### 🎯 NEXT STEPS

1. **Test streaming with real backend** — verify `findMarker` correctly parses actual Gemini output for all 5 sections
2. **Verify section fallback** — confirm the "dump to section 1" fallback works correctly when AI omits numbered section headers
3. **Mobile layout** — `DesignSheetsRightPanel` is `lg:sticky lg:top-28`; verify it stacks correctly on narrow viewports below `lg` breakpoint
4. **Review warning on References tab** — warning banner currently only shows on Design Sheets tab; confirm approve button on References tab skips warning correctly (it calls `handleApproveAndContinue` not `handleDesignApproveClick`)

---

## SESSION: 2026-06-08

### 🎯 CONTEXT — Pipeline Step 2 Story Breakdown (Step1Analysis.tsx) polish sprint

All work this session is in a single file: `frontend/src/components/studio-steps/Step1Analysis.tsx`.
Support files: `frontend/src/styles/globals.css`.

---

### ✅ COMPLETED

#### Scrollbar fix — right panel thin scrollbar
- Added `.thin-scrollbar` utility class to `frontend/src/styles/globals.css`:
  - `scrollbar-gutter: stable` (prevents layout shift)
  - `scrollbar-width: thin; scrollbar-color: #E5E7EB transparent` (Firefox)
  - `::-webkit-scrollbar` 4 px wide, transparent track, #E5E7EB thumb → #9CA3AF on hover, `border-radius: 999px`
- Applied `thin-scrollbar` to the right panel sticky container (`lg:sticky lg:top-28 overflow-y-auto max-h-[calc(100vh-10rem)]`)

#### Review tracking fixes (P0)
- **Stream auto-open no longer marks sections as reviewed** — removed `setReviewedSections` call from the auto-open `useEffect`
- **Stream complete resets review counter to 0** — `setReviewedSections(new Set())` instead of inheriting open sections from stream; ensures "0 / 6 reviewed" at stream end
- Only user-triggered accordion expand (`toggleSection`) marks a section reviewed
- Right panel counter: hidden during stream, shows `{N} / 6 reviewed` after stream, shows `6 / 6 reviewed ✅` (emoji) when all 6 done

#### Section dots 3 states (P0)
- During stream: active section = blue pulse; already-complete sections = green filled check; pending = gray pulse
- After stream: ALL dots immediately reset to green outline ○ (unreviewed state)
- As user expands sections: dot transitions from ○ to ✅ filled (driven by `reviewedSections` set)

#### Approve & Continue warning (P1)
- Warning banner text updated:
  - "You've reviewed **X / 6 sections**" (was "You haven't reviewed these sections")
  - "Unreviewed: [section names]" subtitle
  - "Review sections ↑" button (was "Review missing") — scrolls to + expands first unreviewed section
  - "Approve anyway →" button (was "Continue anyway →")

#### Bottom bar layout (P2)
- Regrouped: `[← Previous Step]` on left · `[↺ Regenerate] [✅ Approve & Continue →]` grouped on right
- Regenerate + Approve are now in a `flex gap-3` wrapper on the right — clearly separates navigation from story actions

#### Streaming visibility fix (P0 — critical bug)
- **Root cause**: `SECTION_DEFS` used exact markers like `'## 1. Character Breakdown'` but the backend prompt instructs the AI with `1. Character Breakdown` (no `##`). Gemini may produce `## `, `# `, `### `, `**`, or bare numbered items — any mismatch caused all sections to stay skeleton throughout streaming, so the user saw nothing.
- **Fix**: Replaced `marker` field with `coreMarker` (number + name only, no heading prefix) and added `findMarker(text, coreMarker)` helper:
  - Tries prefixes in order: `'## '`, `'### '`, `'# '`, `'#### '`, `'**'`, `''` (bare)
  - Searches for `\n` + prefix + coreMarker at the start of any line
  - Returns `{ start, contentStart }` where `contentStart` is after the full header line (handles extra suffix text like `(boxed table)` or `(the most important part)` automatically)
- `parseStreamSections` updated to use `findMarker`; slices content from `contentStart` to next section's `start`

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/components/studio-steps/Step1Analysis.tsx` — streaming fix, review tracking, section dots, approve warning, bottom bar layout
- `frontend/src/styles/globals.css` — added `.thin-scrollbar` utility class

---

### 🐛 DECISIONS & NOTES

- The backend prompt (`generate_step1_stream` in `services.py`) instructs the AI with plain numbered items (`1. Character Breakdown`) inside a "clean markdown" directive. Gemini interprets this and may add heading markers. The frontend now handles all output formats robustly.
- Review tracking resets on each new generation (via `handleConfirmRegen` → `setReviewedSections(new Set())`), so the counter always starts from 0 for each analysis run.
- `scrollToFirstUnreviewed` still marks the scrolled-to section as reviewed (since the user sees it) — this is intentional.

---

### 🎯 NEXT STEPS

1. **Test streaming with real backend** — verify `findMarker` correctly parses actual Gemini output for all 6 sections
2. **Accordion scroll-to behavior** — when right panel section link is clicked, section should expand AND scroll into view on mobile (currently uses `scrollIntoView({ block: 'nearest' })`)
3. **Edit mode save → re-approval warning** — when user saves edits to any section, consider revoking approval automatically (currently only warns once via `showEditedWarning`)

---

## SESSION: 2026-06-06

### 🎯 CONTEXT — Major Architecture Refactor
**Core decision**: Users can ONLY enter the Pipeline (Step 1) via Story Setup. Direct manual entry is forbidden.  
**Entry points allowed**: Story Setup (primary) · My Projects (returning users) · Import JSON (escape hatch)

---

### ✅ COMPLETED

#### P0 — Architecture

**Change 6.1 + 6.5 + 7.1 — Pipeline Step 1 complete rewrite**
- File: `frontend/src/components/story-setup/Step1.tsx` — full rewrite
- **No-story state** (`!fromStorySetup`): shows "No story found" card with "Go to Story Setup" (primary), "Open existing project" + "Import JSON" (secondary escape hatches). No story input fields whatsoever.
- **Story-imported state**: blue import banner with title, word count, genre, AI-adapted badge, and 3 action buttons:
  - "Edit in Story Setup ↗" → Link to `/studio/story-setup`
  - "Switch story" → opens `StoryPickerModal` (library picker) → confirm dialog
  - "Remove & start over" → confirm dialog → clears localStorage + sets `fromStorySetup(false)`
- **Form**: Project Identity (project ID, tags, summary) + Visual Execution (art style with genre-aware suggestions, image API URL, special requests / content guardrails)
- **Read-only Output Estimate**: pages, chapters, est. panels, characters from context values — with "Edit targets ↗" link back to Story Setup
- **Progress indicator**: 3/3 required (story imported · project ID · art style) with live check/circle icons
- Removed ALL: story text, file upload, main characters, chapters, target pages, max panels, genre, presets, AI Suggest All, output estimate inputs

**Change 2.1 + 2.2 — Advanced Setup section in Story Setup**
- File: `frontend/src/app/studio/story-setup/page.tsx`
- Collapsible card after Creative Direction (collapsed by default)
- Header shows live summary: `{pages} pages · {chapters} chapters · {chars} chars`
- Quick presets: "Quick read (20p)", "Short comic (50p)", "Full book (200p)"
- 4 numeric fields: Main Characters (1–10), Chapters (1–20), Target Pages (5–200), Max Panels/Page (2–8)
- **Story capacity check**: after analysis runs, shows amber warnings:
  - `Story has N characters but you configured M. Adjust to N ↓`
  - `Story may need ~N pages. You configured M. Adjust to N ↓`
- "Adjust to X ↓" buttons update the field immediately
- Auto-expands on mismatch after analysis completes
- Estimate footer: `~{pages × panels × 0.7} panels`

**Advanced Setup → Pipeline context integration**
- `handleNext()` in Story Setup now saves explicit production targets to `mohiom-story-setup` localStorage: `mainCharacters`, `numChapters`, `targetPages`, `maxPanelsPerPage`
- `ComicGenerationContext.tsx` mount effect updated: reads explicit values first (takes priority over analysis-derived auto-fill), falls back to analysis-derived values only if no explicit targets were set

**`ComicGenerationContext.tsx` — `setFromStorySetup` exposed**
- Added `setFromStorySetup: (v: boolean) => void` to context interface and value object
- Required by Step 1's "Remove & start over" action

#### P1 — Core UX

**Change 1.1 — Quick Start mode**
- Mode tabs added to Story Setup header: **Quick Start** · **Full Setup** · **Load Story**
- Quick Start hides: Project ID field, Genre field + chips, Creative Direction section, Advanced Setup section
- Title field spans full width in Quick Start
- Essentials tracker adapts: 2/2 (Title + Narrative) instead of 3/3
- **Auto-analysis**: fires 1.5 s after user stops typing when Title + Narrative (≥80 chars) are set
- Analysis panel adapts: "Analysis will auto-run" placeholder, "Starting automatically…" in ready state
- "Switch to Full Setup" hint shown at bottom of form

**Change 4 — "Manage story" dropdown**
- Renamed "More" button → "Manage story" with `menu_book` icon
- Added **Export as JSON** option: downloads current story state (all fields, analysis result, production targets) as `.json` file named `{projectId}_{date}.json`
- Fixed **Duplicate story**: now saves a proper copy with "(copy)" suffix + toast notification with "View →" link
- Dropdown divider separates non-destructive from destructive actions

**Change 3.2 + 3.3 — Character confidence cards + warning banner**
- In AI analysis panel (STATE 5 — Done), each character card shows confidence score based on mention frequency in story text:
  - High (≥5 mentions) → green card border
  - Medium (2–4 mentions) → amber card border
  - Low (<2 mentions) → red card border
- Confidence label shown below character name
- Warning banner appears above the grid listing low-confidence characters: "Elena appears rarely — add more detail for accurate character sheets."

**Change 6.4 — Required fields checklist tooltip on Generate button**
- Generate button in Pipeline Step 1 wrapped in `group` div
- On hover when `!canGenerate`: dark tooltip above button showing 3 required fields with check/circle icons:
  - Story imported · Project ID (min 3 chars) · Art style reference

#### P2 — Polish

**Change 5 — Creative Direction placeholder fix**
- Removed "Create a plot twist" from `DIRECTION_CHIPS` quick suggestions array

**Change 8 — 5-step WORKFLOW sidebar**
- `StudioSidebar.tsx`: `WORKFLOW` array expanded from 4 → 5 steps:
  - ① Story Setup · ② Comic Pipeline · ③ Character Manager · ④ Comic Editor · ⑤ Export & Publish
- `STEP_NUMERALS` extended: `['①','②','③','④','⑤']`
- Removed the standalone "Comic Pipeline" link that was added in the previous session (now lives in WORKFLOW at step ②)

---

### ✅ COMPLETED THIS SESSION (2026-06-07 — continued)

| # | Change | Implementation |
|---|--------|----------------|
| 3.1 | **Lightweight analysis backend prompt** | New `POST /api/gemini/analyze-story-lightweight` endpoint. `analyze_story_lightweight_stream()` in `services.py` — single prompt returning `detected_characters`, `tone_tags`, `scene_beats`, `estimated_panels`. Story Setup page now uses `analyzeStoryLightweightStream()` (new `api.ts` function) instead of the heavy `analyzeStoryStructuredStream`. |
| 3.4 | **Expandable scene beats** | Scene beats header in STATE 5 Done panel is now a toggle button. When expanded, shows numbered beat descriptions derived from story text paragraphs (frontend-only, no AI changes needed). |
| 3.5 | **Estimate disclaimer** | `*` footnote added below Output Estimate grid in `Step1.tsx`. |
| 9 | **Home page entry point redesign** | "Start something new" section added to `/studio/dashboard` with 3 cards: "Start with my story" → `/studio/story-setup`, "Open existing project" → `/studio`, "Import JSON" → file picker → saves to `mohiom-import-json` localStorage → studio context auto-loads on mount. |
| P0 | **Global 5-state machine + StepState fields** | Added `regeneratedAfterApproval: boolean` and `approvedAt: string or null` to `StepState<T>` in `ComicGenerationContext.tsx`. Added `handleRevokeApproval(step)`. `handleGenerate` captures `wasApproved` before gen starts; `regeneratedAfterApproval` set to `wasApproved` on completion. Fixed all 8 TypeScript errors in `loadMockStepData`, `loadMockCharacterReview`, and second `restoreFromFullSave` path. |
| P0 | **Step1Analysis.tsx — full rewrite** | 5-state machine + structured sections. Parses `analysisMarkdown` by `##` headings into collapsible `AnalysisSection` cards (first 2 expanded by default). Character cards from `characterBreakdown`. Stats bar from `structuredJson`. Approve/Revoke/Regenerate buttons per state. Streaming live preview. Approval timestamp badge in STATE 4. |
| P0 | **Step3Script.tsx — full rewrite** | 5-state machine + structured page/panel view. Parser extracts `Page N` / `Panel N` / `Dialogue/SFX:` / `AI Image Prompt:` lines into collapsible `PageCard` components (first page open by default). Falls back to raw `<pre>` if no page markers. Stats row showing page + panel counts + approval timestamp. |
| P0 | **Step4Generation.tsx — full rewrite** | 5-state machine. 3-mode panel view toggle: **Page** (default, full-page image + panel cards), **Grid** (thumbnail grid, 2–5 cols), **List** (accordion list). Progress stats bar with emerald progress bar. Collapsible JSON export section (collapsed by default) with Save to Cloud, Download, Copy, My Projects buttons. Remove all raw debug info. Approve/Revoke per state. |
| P1 | **Step2Characters.tsx — full rewrite** | Design sheet section: parse by `###` character headings into collapsible `DesignSheetCard` components. Prompt queue sidebar with per-character status dots (idle/loading/success/error). Character review section: per-character `CharacterReviewCard` with selected-candidate ring highlight, generation status badge, locked section overlay when `step2.locked`. Approve references gated on ALL characters having a `selectedCandidateId`. State machine on both design sheet and image review. |
| P2 | **ImageGenModePanel — rename "Full" → "All inputs"** | Mode 4 label updated in `MODES` array in `ImageGenModePanel.tsx`. |
| P0 | **react-markdown integration** | Installed `react-markdown`, `remark-gfm`, `rehype-raw`. New `frontend/src/components/Markdown.tsx` shared renderer with full Tailwind token styling. All step components now use `<Markdown>` instead of raw text for streaming and structured output. |
| P0 | **Fix 2.1 — Backend byline preprocessing** | Added `GeminiService._preprocess_story_text()` static method in `backend/app/services.py`. Strips author credits ("A [X] story by Author"), standalone bylines, copyright lines, and lone proper-noun sequences before sending story to LLM. Updated `analyze_story_lightweight_stream` to use it and added beat rules to prompt (beats must describe ACTION/EVENT/STATE CHANGE, not metadata). |
| P0 | **Fix 2.2 — Frontend beat validation** | Added `isValidBeat(desc)` + `ACTION_VERBS_RE` helpers to `story-setup/page.tsx`. Invalid beats (bylines, name-only strings, ≤4-word phrases without action verbs) show `[Beat could not be extracted · Add more story content]` in italic muted style. |
| P0 | **Fix 4 — Low confidence Keep/Remove** | Low-confidence character cards in STATE 5 Done always show [Keep] and [Remove] buttons. Keep promotes to medium confidence (removes buttons, shows ⚠️, fires toast). Remove fades the card from the list. Uses new `charOverrides` state map. |
| P1 | **Fix 5 — Quick Start notice placement** | Moved from bottom of form (after Advanced Setup) to directly below mode tabs. Restyled as blue left-border alert with [×] dismiss button (session-only, `quickNoticeDismissed` state). "Switch to Full Setup →" text link. |
| P1 | **Fix 7 — Character split layout** | Confirmed chars (high/medium confidence) rendered in auto-fill grid (`minmax(100px, 1fr)`). Uncertain chars (low confidence) rendered as full-width cards below a "Please review" divider. Removed characters disappear cleanly. |
| P1 | **Fix 3.1 — Genre chips in Quick Start** | Optional genre chip selector added below Story Title in Quick Start mode. Same chip style as Full Setup. Clicking active chip deselects (toggle). Helper text "Helps AI understand your story's visual tone." |
| P1 | **Fix 3.2 — Tone tags source label** | When genre is not set, an ℹ️ note appears below tone tags: "Auto-detected from story content · Set a genre for more accurate visual direction". Hidden when genre is set. |
| P1 | **Fix 6 — Essentials count dynamic** | STATE 2 (filling) checklist updated to be mode-aware: Quick Start shows 2 items (Title + Narrative), Full Setup shows 3 (Title + Genre + Narrative). Bottom bar `{essentials}/3` updated to `{essentials}/{essentialsTotal}`. |
| P2 | **Fix 3.3 — Pro Tip contextual** | Foundation tip dynamically switches: when `activeSection === 'foundation'` and `!genre`, shows generic tip "Setting a genre helps the AI choose the right visual palette and art style for your comic." rather than the hardcoded genre example tip. |
| P2 | **Fix 8 — Beat truncation + expand** | Beat descriptions max 60 chars with `…` suffix. Each beat row is a click button that toggles `expandedBeats` set, showing full text inline with ▼/▲ indicator. `title` attribute shows full text on hover when truncated. |

---

### 📂 KEY FILES CHANGED THIS SESSION

- `frontend/src/components/story-setup/Step1.tsx` — **full rewrite** (new architecture: no-story state + imported state)
- `frontend/src/app/studio/story-setup/page.tsx` — Major additions: Quick Start mode, mode tabs, Advanced Setup section, capacity check, Manage story dropdown, Export JSON, character confidence, auto-analysis
- `frontend/src/context/ComicGenerationContext.tsx` — Added `setFromStorySetup` to interface + value; updated mount effect to read explicit production targets from localStorage with priority over analysis-derived values
- `frontend/src/components/StudioSidebar.tsx` — 5-step WORKFLOW, removed standalone Comic Pipeline link

### 🔧 DESIGN CONSTRAINTS (carry forward — must be preserved)
- Keep existing color system, typography, and visual identity
- Keep auto-save draft behavior as-is
- All confirmation dialogs: **[Cancel] always on left** as secondary action
- AI suggestions must always be overridable by user
- Import JSON path must always remain available as escape hatch
- My Projects path must always remain available for returning users
- The lightweight analysis (Change 3.1) must NOT replace or interfere with the full Pipeline Step 2 analysis prompt
- Quick Start mode must feel as lightweight as possible — do not show Advanced Setup or Creative Direction by default

---

## SESSION: 2026-06-04

### ✅ COMPLETED

#### 1. Settings page — real functionality
- Removed "Change Email" row (not supported)
- **Live stats**: `GET /api/projects/stats` endpoint added to `backend/app/routers/projects.py` (before `/{project_id}` to avoid route collision); returns `project_count`, `character_count` (standalone + project-embedded, deduped), `panel_count`. Frontend calls `projectsApi.stats()` on mount with loading skeleton.
- **Change password**: `POST /api/auth/change-password` endpoint; verifies current password via bcrypt, enforces 8-char min, updates hash. Frontend inline form shown only for users with `providers.includes('manual')`.
- **Connect OAuth accounts**: `oauth_start` extended with `mode=connect` — validates existing JWT cookie, embeds `user_id` in state token; `oauth_callback` calls `repo.link_oauth_provider()` on `mode=connect`. Frontend "Connect" button per provider redirects via `authApi.oauthStart(provider, 'connect')`.
- **App Preferences persistence**: Comic Style + Export Format selects now initialize from `localStorage` (lazy initializer) and `savePrefs()` on every change with "Saved" flash indicator.
- **Provider badge fix**: Badge map key corrected from `'password'` → `'manual'` (backend sends `"manual"`).
- **Connect notice toast**: reads `?connected=provider` or `?error=connect_failed` query params on mount.

#### 2. CORS error on registration — root cause fixed
- **Root cause**: `ServerErrorMiddleware` sits above `CORSMiddleware` in Starlette's stack. When a 500 is thrown, `ServerErrorMiddleware` catches it before `CORSMiddleware` can add CORS headers, so the browser sees a CORS error masking the real 500.
- **Actual 500 cause**: `passlib` + `bcrypt ≥ 4.0` incompatibility — `ValueError: password cannot be longer than 72 bytes` thrown during passlib's internal wrap-bug detection test on every password hash.
- **Fix**: Replaced passlib with direct bcrypt API in `backend/app/security.py`:
  - `hash_password` → `bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()`
  - `verify_password` → `bcrypt.checkpw(pw.encode(), hashed.encode())` (returns False on any exception)
  - Removed: `from passlib.context import CryptContext` and `pwd_context`

#### 3. Password strength meter
- New component `frontend/src/components/PasswordStrengthMeter.tsx`: 4 bar segments (red→orange→yellow→green), strength label ("Weak"/"Fair"/"Good"/"Strong"), 4 criteria checklist. Score stays 0 until ≥8 chars; returns null when password empty.
- Added to **register page** (`frontend/src/app/(auth)/register/page.tsx`) after password field.
- Added to **settings change-password form** inline.

#### 4. `/studio/story-setup` — full page implementation from design file
- Complete rewrite of `frontend/src/app/studio/story-setup/page.tsx` as `'use client'`
- Local state for all 12+ form inputs (no ComicGenerationContext — not available on this route)
- **5 form cards**:
  - Story Foundation: title, projectId, genre input + quick-pick chips
  - Your Narrative: file upload, textarea with word/char count, AI tool buttons
  - Art Direction: 5 style cards with checkmark overlay, art-ref chips, palette select
  - Structure & Pacing: 4 inline steppers + preset buttons (Short/Standard/Epic)
  - Constraints: toggle chips + "special instructions" textarea
- **Sticky AI Analysis panel**: idle → loading → done states; real SSE stream via `analyzeStoryStructuredStream`; parses `detected_characters`, `tone_tags`, `scene_beats` from structured JSON
- Progress bar (5 essentials), auto-save indicator
- "Next" saves to `localStorage['mohiom-story-setup']` and navigates to `/studio`
- ESLint fix: changed `(_msg) =>` → `() =>` in onError callback to remove unused-var error

#### 5. Title style consistency (story-setup ↔ character-manager)
- Removed step badge ("Step 1 · Story Setup")
- Changed `text-4xl md:text-5xl font-extrabold tracking-tight` → `text-4xl font-extrabold tracking-tighter text-on-surface`
- Subtitle: plain `<p className="text-on-surface-variant mt-1">` — matches character-manager exactly

---

### 🔧 SCHEMAS & API CHANGES

**Backend**
- `backend/app/schemas.py`: Added `ChangePasswordRequest(current_password, new_password)`, `StatsResponse(project_count, character_count, panel_count)`
- `backend/app/routers/auth.py`: Added `POST /auth/change-password`; modified `oauth_start` + `oauth_callback` for `mode=connect`
- `backend/app/routers/projects.py`: Added `GET /projects/stats` (before `/{project_id}`)
- `backend/app/crud.py`: Added `UserRepository.link_oauth_provider(user_id, provider, profile)`
- `backend/app/security.py`: Replaced passlib with direct bcrypt

**Frontend**
- `frontend/src/services/api.ts`: Added `authApi.changePassword()`, updated `oauthStart` mode type, added `projectsApi.stats()`
- `frontend/src/app/settings/page.tsx`: Full rewrite
- `frontend/src/app/(auth)/register/page.tsx`: Added `PasswordStrengthMeter`
- `frontend/src/app/studio/story-setup/page.tsx`: Full rewrite
- `frontend/src/components/PasswordStrengthMeter.tsx`: New component

---

### 🎯 NEXT STEPS (from previous session, still relevant)

1. **Delete or redirect `studio/character-setup/page.tsx`** — superseded by character-manager detail panel
2. **MongoDB index for projects collection** — compound unique index `{user_id: 1, project_id: 1}`
3. **Wire CreateCharacterModal into Step 2 pipeline** — "Create Character" button alongside "From Library" in Step 2
4. **Character archive feature** — "Archived" tab in character-manager shows placeholder
5. **Test full save/load round-trip** — verify character images survive MongoDB round-trip

---

## SESSION: 2026-05-31

### ✅ COMPLETED

#### 1. Import JSON feature (file-based, no DB)
- Added `loadProjectJson(json)` to `ComicGenerationContext` — auto-detects two formats:
  - **Legacy format** (`step_1_analysis` snake_case keys) — from the old "Download JSON" export
  - **Full-save format** (`step1` camelCase keys) — from cloud save (see below)
- "Import JSON" button added to **Step 0 Setup** (file picker, `.json` only)
- "My Projects" button added to Step 0 — opens `ProjectsDrawer` to load from cloud
- On import, all steps are restored and the app navigates to Step 4

#### 2. Remote project save/load to MongoDB
- **Backend** — new `projects` collection + router at `backend/app/routers/projects.py`:
  - `POST /api/projects/save` — upsert by `(user_id, project_id)` using `X-User-Id` header
  - `GET /api/projects/` — list metadata (project_id, saved_at, genre, step completion flags)
  - `GET /api/projects/{project_id}` — load full project JSON
  - `DELETE /api/projects/{project_id}` — remove project
  - Registered in `backend/app/main.py`
- **What gets saved**: user inputs + image gen settings + steps 1–3 full data + step 2 image review (selected candidate image only per character, not all candidates) + step 4 panel list (no generated page images — too large)
- **Context additions** (`ComicGenerationContext.tsx`):
  - `buildFullSave()` — assembles the payload; strips unselected image candidates and page images
  - `restoreFromFullSave(json)` — full restore including character images back into candidate slots, all approval flags, image gen settings; unlocks all steps
  - `saveToCloud()` / `loadFromCloud(projectId)` / `listCloudProjects()` — API wrappers with `cloudSaveStatus` / `cloudSaveError` state
  - On-mount effect reads `localStorage['mohiom-pending-load']`; if set, calls `loadFromCloud()` and clears the key (used by dashboard to trigger project load in studio context)
- **UI**:
  - `ProjectsDrawer.tsx` — slide-in right panel; save current project, list all projects with step badges (S1/S2/Img/S3/S4), Load button per row
  - **Step 4 "Project export" card**: "Save to Cloud" + "My Projects" buttons added alongside existing Copy/Download JSON
  - **Step 0**: "My Projects" button only (save belongs at Step 4 after pipeline is complete)
- **Schemas added to `backend/app/schemas.py`**: `ProjectSaveRequest`, `ProjectListItem` (includes `genre` field)

#### 3. Dashboard — real data replacing hardcoded static arrays
- `frontend/src/app/studio/dashboard/page.tsx` converted to `'use client'` component
- Fetches `projectsApi.list()` for Recent Projects, `projectsApi.characters()` for Recent Characters
- **Recent Projects**: gradient cover cards (deterministic color per project_id hash), genre badge (first word/segment), step completion badges (S1/S2/Img/S3/S4), "last saved Xm/h/d ago" timestamp; clicking sets `localStorage['mohiom-pending-load']` + navigates to `/studio`
- **Recent Characters**: avatar with saved image, name, project source; clicking loads that project
- **"Resume Last Project"** hero button wires to the most recent saved project
- Loading skeletons for both sections; empty states with CTAs
- `timeAgo()` helper and deterministic `gradientFor(id)` from a 6-color palette

#### 4. Character Manager — full CRUD + merged with character-setup
- `frontend/src/app/studio/character-manager/page.tsx` fully rewritten as `'use client'`
- **Layout**: left 2/3 = character list cards; right 1/3 = sticky dynamic panel
- **Character cards**: avatar, name, seed (hash of character_id), prompt excerpt (2-line clamp), project label, lock-face toggle (local state), selected highlight border
- **Right panel modes**:
  - **Stats** (default): locked/slots progress bars, "By Project" breakdown with load buttons
  - **Detail** (character selected): editable name input, prompt textarea, Image API URL field (pre-filled from `sessionStorage['mohiom-image-api-url']`), Generate Image button (calls `/api/image-proxy`), live preview with checkmark badge, Save Changes (PATCH), Delete with two-click confirm
- **Tabs**: Active / Archived (archived shows empty state — no archived concept yet)
- **Search**: filters by name or project_id
- **FAB** + "Add Character" slot → open `CreateCharacterModal`
- **Backend routes added** to `backend/app/routers/projects.py`:
  - `POST /api/projects/{project_id}/characters` — append new character; 409 if ID already exists
  - `PATCH /api/projects/{project_id}/characters/{character_id}` — update name/prompt/selectedImageUrl in-place (fetch → modify Python list → $set)
  - `DELETE /api/projects/{project_id}/characters/{character_id}` — remove from array
- **Schemas added**: `CharacterUpsertPayload`, `CharacterPatchPayload`
- `CharacterSummary` schema now includes `prompt` field
- **`api.ts` additions**: `CharacterCreatePayload`, `CharacterPatchPayload` types; `projectsApi.createCharacter()`, `projectsApi.updateCharacter()`, `projectsApi.deleteCharacter()`

#### 5. CreateCharacterModal — 3-method reusable creation modal
- New file: `frontend/src/components/CreateCharacterModal.tsx`
- **Props**: `isOpen`, `onClose`, `onCreated(char)`, `projects[]`, `defaultProjectId?`
- **Layout**: large centered modal (max-w-4xl), two columns — left (config) + right (preview + project selector + actions)
- **Method 1 — Start from Image**: drag-and-drop / file picker zone; uploaded image immediately becomes the character; no generation needed
- **Method 2 — Describe your Character**: description textarea + 14 style chips: Photorealistic, Digital Art, Anime, 3D Render, Pixar, Fantasy Art, RPG, Comic Book, Clay, Vector Art, Minimalist, Watercolor, Oil Painting, GTA Style
- **Method 3 — Build your Character**: 5 chip selectors — Look Vibe (10 options), Gender (4), Ethnicity (8), Age Range (6), Build (6) — plus optional free-text Additional Description; auto-assembles a descriptive prompt from all selections
- Shared: Image API URL field (pre-filled from `sessionStorage`), Generate Image → `/api/image-proxy`, live preview, project selector dropdown, Save Character via `projectsApi.createCharacter()`
- Resets all state on close; Escape + backdrop-click to close
- **Used in**: Character Manager page (replaces the old inline `CreatePanel`)

#### 6. Select character into project (CharacterLibraryModal)
- New file: `frontend/src/components/CharacterLibraryModal.tsx`
- **Props**: `isOpen`, `onClose`, `existingIds: Set<string>`, `onConfirm(chars[])`
- Fetches `projectsApi.characters()` fresh on each open
- 4-column image grid with search (name or project_id)
- Characters already in the project shown greyed-out with "Added" badge (not selectable)
- New selections show filled checkmark overlay; footer shows live count "Add N to Project"
- **`injectLibraryCharacters(chars: CharacterSummary[])` added to `ComicGenerationContext`**:
  - Deduplicates against existing `step2ImageReview.data.characters` by `characterId`
  - Converts each `CharacterSummary` → `CharacterImageItem` with the saved image as a pre-selected candidate (`status: 'success'`)
  - Sets `step2ImageReview.locked = false` so review section activates even if Step 2 hasn't run — allows bypassing AI generation entirely
- **"From Library" button** added to Step 2 Reference Image Review section in `Step2Characters.tsx`
- Info notice shown when library characters are present but Step 2 hasn't been generated

#### 7. CLAUDE.md improvements (via /init)
- Added missing env vars: OAuth (Google/GitHub), SMTP (for password reset), Auth URLs, rate limiter overrides
- Noted Docker MongoDB URI difference vs local dev
- Added "No Python formatter/linter" gotcha
- Added "No Prettier on frontend — ESLint only"
- Corrected Testing section: 3 actual test files documented with paths
- `api/items/*` route added to API Structure
- Prepended session continuity instruction at top of CLAUDE.md

---

### 🔧 IN PROGRESS / NEEDS CONTINUATION

- **Character archive/delete at project level**: The "Archived" tab in Character Manager shows an empty state placeholder. No archive concept exists yet.
- **`character-setup/page.tsx`** still exists as a static hardcoded page — it was not deleted or redirected. It is now superseded by the Detail panel inside character-manager. Should be removed or redirected.
- **CreateCharacterModal in pipeline**: The modal was implemented and works in the Character Manager, but was not wired into the pipeline itself (e.g., a "Create New Character" button inside Step 2). Only "From Library" exists in Step 2.
- **No MongoDB index** on `projects` collection `(user_id, project_id)` — index is never explicitly created. PyMongo upsert works without it but will be slow at scale.

---

### 🐛 ISSUES & DECISIONS

- **Document size limit for page images**: MongoDB has a 16 MB document limit. Character images (~300–500 KB base64 each) fit. Panel/page images (~500 KB–1 MB each × 20 pages) would exceed it. Decision: **page images are never saved to DB** — users regenerate them after loading a project. Only the selected character candidate image per character is saved.
- **`/api/projects/characters` route ordering**: FastAPI matches literal paths before parameterized ones at the same level. `GET /projects/characters` must be defined **before** `GET /projects/{project_id}` in the router or it gets swallowed. This is correctly ordered in the current code.
- **`loadProjectJson` format detection**: Two exported JSON formats exist. Detection logic: if `json.steps.step1` (camelCase) exists → full-save format; if `json.steps.step_1_analysis` (snake_case) → legacy export format.
- **"Save to Cloud" placement**: Initially placed on Step 0, but moved to Step 4 because step 3 must be complete before there's anything meaningful to save, and the user is on Step 4 by that point.
- **`injectLibraryCharacters` bypasses lock**: Intentional. The point of the library feature is to let users skip the AI generation step (Step 2) and use pre-made characters. Setting `locked: false` on `step2ImageReview` enables this.
- **Image API URL storage**: The local image API URL is stored in `sessionStorage['mohiom-image-api-url']` (set by the studio context). The Character Manager and CreateCharacterModal read directly from sessionStorage to pre-fill the field, since they run outside the ComicGenerationContext.
- **User identity**: All project/character endpoints use `X-User-Id` header (auto-injected by `apiClient` interceptor from `localStorage['mohiom-user-id']`). No JWT auth required for these endpoints — same pattern as existing routes.

---

### 📂 KEY FILES CHANGED

**Backend**
- `backend/app/schemas.py` — Added: `ProjectSaveRequest`, `ProjectListItem` (+ `genre`), `CharacterSummary` (+ `prompt`), `CharacterUpsertPayload`, `CharacterPatchPayload`
- `backend/app/routers/projects.py` — **New file**: 8 endpoints — save, list, load, delete project; list characters; create/patch/delete character within project
- `backend/app/main.py` — Registered `projects.router`

**Frontend — Context**
- `frontend/src/context/ComicGenerationContext.tsx` — Added: `buildFullSave()`, `restoreFromFullSave()`, modified `loadProjectJson()` (format detection), `saveToCloud()`, `loadFromCloud()`, `listCloudProjects()`, `injectLibraryCharacters()`, `cloudSaveStatus`/`cloudSaveError` state, pending-load mount effect, `CharacterSummary` type import

**Frontend — Services**
- `frontend/src/services/api.ts` — Added: `FullProjectSave`, `CloudProjectListItem` (+ `genre`), `CharacterSummary` (+ `prompt`), `CharacterCreatePayload`, `CharacterPatchPayload`, `projectsApi` object (save/list/load/delete/characters/createCharacter/updateCharacter/deleteCharacter)

**Frontend — New components**
- `frontend/src/components/ProjectsDrawer.tsx` — Slide-in drawer: save current project + list/load/delete saved projects with step badges
- `frontend/src/components/CreateCharacterModal.tsx` — 3-method character creation modal (image upload / describe+style / structured builder)
- `frontend/src/components/CharacterLibraryModal.tsx` — Multi-select character picker from saved library; shows "Already Added" state for existing project characters

**Frontend — Modified components**
- `frontend/src/components/story-setup/Step1.tsx` — Added: "Import JSON" file picker button, "My Projects" button (opens ProjectsDrawer), `loadProjectJson` + `listCloudProjects` wired from context
- `frontend/src/components/studio-steps/Step2Characters.tsx` — Added: "From Library" button, `CharacterLibraryModal` wired with `injectLibraryCharacters`, info notice for library-sourced characters
- `frontend/src/components/studio-steps/Step4Generation.tsx` — Added: "Save to Cloud" button, "My Projects" button, `ProjectsDrawer`, `saveToCloud`/`cloudSaveStatus`/`cloudSaveError` from context

**Frontend — Pages**
- `frontend/src/app/studio/dashboard/page.tsx` — Full rewrite: `'use client'`, real API data for recent projects (gradient cards + step badges) and recent characters (real avatars), load-project navigation via `mohiom-pending-load`
- `frontend/src/app/studio/character-manager/page.tsx` — Full rewrite: `'use client'`, CRUD character list + detail panel + stats panel; uses `CreateCharacterModal`; removed old `CreatePanel` and `generateImage` helper

**Docs**
- `CLAUDE.md` — Added missing env vars (OAuth, SMTP, Auth URLs, rate limiter overrides), Docker MongoDB URI note, no-Python-linter gotcha, no-Prettier note, corrected test file paths, session continuity instruction prepended

---

### 🎯 NEXT STEPS (highest priority)

1. **Delete or redirect `studio/character-setup/page.tsx`** — it's now superseded by the character-manager detail panel; keeping it causes confusion
2. **MongoDB index for projects collection** — add compound unique index `{user_id: 1, project_id: 1}` at app startup in `lifespan.py` to avoid slow scans as project count grows
3. **Wire CreateCharacterModal into Step 2 pipeline** — add a "Create Character" button alongside "From Library" in Step 2 so users can create a new character without leaving the studio
4. **Character archive feature** — the "Archived" tab in character-manager shows a placeholder; implement archiving (soft-delete flag on character document or separate archived array)
5. **Test the full save/load round-trip** — specifically verify that character images (base64 data URLs) survive the MongoDB round-trip and render correctly after load; base64 strings in MongoDB can be slow to query if large
6. **"Resume Last Project" button on dashboard** — currently works if at least one saved project exists; add a loading spinner on the hero button while the project is being fetched

---

### 💡 CONTEXT TO REMEMBER

- **Characters live inside project documents**, not in a separate collection. `steps.step2ImageReview.data.characters[]` in the `projects` MongoDB collection. The `/api/projects/characters` endpoint aggregates across all projects per user. This is a trade-off (simpler data model, but character queries require scanning all projects).
- **`X-User-Id` header** is the only identity mechanism for project/character endpoints — no JWT required. Value comes from `localStorage['mohiom-user-id']` (auto-created UUID on first visit), injected by the Axios interceptor in `api.ts`.
- **Image API URL** is stored in `sessionStorage['mohiom-image-api-url']` by the studio context. Components outside the context (Character Manager, CreateCharacterModal) read it directly from sessionStorage.
- **`mohiom-pending-load` localStorage key** is the handshake between the dashboard/character-manager and the studio context. Set it to a `project_id`, navigate to `/studio`, and the context's mount effect will auto-load that project and clear the key.
- **Two JSON export formats coexist**: the old `projectSnapshot` export (snake_case step keys, no character images) and the new full-save format (camelCase step keys, includes character images). `loadProjectJson()` detects format and routes accordingly.
- **Step 4 page images are never persisted** (too large for MongoDB 16 MB doc limit). Users always regenerate them after loading a project. Character images are saved (selected candidate only, ~300–500 KB base64 per character).
- **The `step2ImageReview.locked` flag gates the image review section** in Step 2. `injectLibraryCharacters()` forcibly sets it to `false` so library characters bypass the Step 2 generation requirement — this is intentional behavior.
- **Material Symbols** icons are used throughout the studio UI (not lucide-react). CLAUDE.md says lucide-react only for the pipeline UI, but dashboard/character-manager use Material Symbols. Don't mix within the same component.
- **`ComicGenerationContext.tsx` is ~2400 lines and load-bearing** — be very careful with edits; TypeScript strict mode will catch type errors but runtime bugs in state management can corrupt the pipeline.
- **No test suite** — always run `npx tsc --noEmit` after frontend changes and `python3 -c "import ast; ast.parse(...)"` for backend syntax checks.
