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
