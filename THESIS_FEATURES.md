# Thesis Feature Recommendations — mOhiOm

Recommended features organized by research impact and implementation effort.

---

## Tier 1 — Core Research Contributions (High Impact, Thesis-Essential)

### 1. Panel Regeneration with Guided Feedback
User can click any generated panel and request a re-generation with a typed correction (e.g., "make the character look angrier", "change to night time").

- **Why it matters**: Demonstrates iterative human-AI collaboration within a creative loop. Shows the system supports *directed creative refinement*, not just one-shot generation.
- **Thesis angle**: Human-in-the-loop AI, iterative co-creation.

### 2. Multi-Version Generation & A/B Panel Picker
Generate 2–3 variants per panel simultaneously and let the user pick the best one.

- **Why it matters**: Positions AI as a creative assistant rather than a decision-maker. Generates data on user preference patterns.
- **Thesis angle**: AI as collaborator, user preference analysis for evaluation chapter.

### 3. User Rating & Feedback Collection System
Per-comic and per-panel star rating + optional text comment stored in MongoDB.

- **Why it matters**: Turns the app into a data collection instrument. Enables quantitative evaluation of which prompts/styles yield higher-rated outputs.
- **Thesis angle**: Evaluation methodology, AI output quality measurement.

---

## Tier 2 — Differentiation Features (Strengthen Novelty Claims)

### 4. Prompt Transparency Layer
Show users the actual AI prompt used to generate each panel (collapsible). Allow editing and regeneration.

- **Why it matters**: Makes the system educationally transparent, supports an explainability framing.
- **Thesis angle**: Explainable AI, prompt engineering, user agency.

### 5. Visual Style Consistency Score
After generation, compute and display a consistency score across panels (color palette similarity, character visual repetition via CLIP embeddings or simple heuristic).

- **Why it matters**: Addresses a known weakness of AI comic generation. Provides a measurable quality metric.
- **Thesis angle**: AI evaluation, visual coherence, Limitations & Evaluation section.

### 6. Comic Templates / Story Scaffolds
Pre-built genre templates (superhero origin, slice-of-life, horror encounter) that pre-fill story fields.

- **Why it matters**: Lowers barrier for new users. Enables a controlled user study comparing template users vs. freeform users.
- **Thesis angle**: UX design, usability evaluation, onboarding.

---

## Tier 3 — Polish & Evaluation Support (Good-to-Have)

### 7. Admin Analytics Dashboard
Page at `/admin` showing: total comics generated, average panels per comic, most-used art styles, average rating, daily active users.

- **Why it matters**: Makes evaluation data visible. Provides concrete usage metrics for the thesis.
- **Thesis angle**: System evaluation, deployment metrics.

### 8. Onboarding Tour / Tutorial Mode
Guided first-run walkthrough (Step 1 → Step 4) with tooltips and a sample project.

- **Why it matters**: Necessary for usability studies — new users must onboard without hand-holding.
- **Thesis angle**: UX research, usability study setup.

### 9. Comic Sharing with Public Embed Links
Public comics get a shareable URL (e.g., `/read/{comic_id}`) and an embeddable `<iframe>` snippet.

- **Why it matters**: Demonstrates real-world deployment readiness. Lets external evaluators read comics without logging in.
- **Thesis angle**: Deployment, public access, system completeness.

### 10. Localization — Vietnamese + English (i18n)
Add `next-intl` with a language toggle for Vietnamese and English.

- **Why it matters**: Broadens the target user demographic. Demonstrates software engineering maturity appropriate for a Vietnamese university thesis.
- **Thesis angle**: Accessibility, internationalization, deployment scope.

---

## Priority Order for Thesis Deadline

If time is short, implement in this order:

| Priority | Feature | Reason |
|----------|---------|--------|
| 1 | Panel Regeneration | Strongest research story |
| 2 | Rating System | Gives quantitative evaluation data |
| 3 | A/B Comparison | Differentiates from simple text-to-image wrappers |
| 4 | Admin Analytics | Backs up evaluation chapter with numbers |
| 5 | Prompt Transparency | Positions system as educational/explainable |
| 6 | Templates | Enables controlled user study |
| 7 | Onboarding Tour | Required for usability study |
| 8 | Sharing Links | Deployment polish |
| 9 | Consistency Score | Strong but technically complex |
| 10 | i18n | Polish, lower research value |
