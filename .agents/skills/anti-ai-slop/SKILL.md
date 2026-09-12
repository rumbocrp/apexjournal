---
name: anti-ai-slop
description: Anti-AI Slop Frontend Design Standard and Enforcement Rulebook. Eliminates AI tropes, emojis as UI elements, neon purple/cyan gradient glow overdose, glassmorphic blur abuse, generic Inter font soup, and low-contrast decorative widgets. Prescribes high-craft, precision engineering aesthetics, solid surface contrast, authentic typography hierarchy, spatial density scales, and industrial status indicator systems.
---

# Anti-AI Slop: Human-Crafted Frontend Design Standard & Agent Rulebook

## Executive Summary

"AI Slop" in frontend design refers to the repetitive, generic, and uncritical aesthetic tropes that Large Language Models (LLMs) output by default when generating UI code. These patterns result in interfaces that look immediately artificial, unpolished, low-utility, and dated.

This skill is the **mandatory design standard** to strip all AI slop from frontend codebases and enforce high-craft, precision-engineered interfaces (Linear, Raycast, Bloomberg Terminal, Vercel, Apple Pro craft).

---

## 1. The 10 Deadly Sins of AI-Generated Frontend ("AI Slop")

```
                                  AI SLOP TAXONOMY
   ┌─────────────────────────────────────┬─────────────────────────────────────┐
   │ AI SLOP PATTERN (FORBIDDEN)         │ HUMAN CRAFT ALTERNATIVE (MANDATORY) │
   ├─────────────────────────────────────┼─────────────────────────────────────┤
   │ 1. Emojis as UI Controls/Badges     │ Curated Monoline SVG Icons (Lucide) │
   │ 2. Neon Purple/Cyan Glow Halos      │ Deep Obsidian Neutrals + Dark Inset │
   │ 3. Glassmorphic Blur Overdose       │ Solid Opaque Surfaces (1px Borders) │
   │ 4. Generic Uncalibrated Inter Soup  │ Engineered Sans + Tabular Monospace │
   │ 5. Rounded-Full Pills Everywhere    │ Crisp Subtle Radii (4px - 8px)      │
   │ 6. Grey-on-Grey Low Contrast        │ WCAG AAA Strict Contrast Hierarchies│
   │ 7. Meaningless Decorative Blobs     │ Functional Data Density & Layouts   │
   │ 8. Conversational Fluff Microcopy   │ Direct, Imperative Operational Text │
   │ 9. Slow Bouncy/Dizzying Animations  │ Fast Micro-transitions (100-150ms)  │
   │ 10. Neglected Keyboard Accessibility│ Full Keyboard-First Focus Loops     │
   └─────────────────────────────────────┴─────────────────────────────────────┘
```

---

### Sin 1: Emojis as UI Controls, Headers & Status Chips

- **The Slop:** Using `🚀`, `💰`, `⚡`, `🎯`, `🔥`, `📊`, `✨`, `🔒`, `🛠️` in button labels, table headers, KPI card headers, or modal titles.
  - *Why it's bad:* Emojis render inconsistently across OSs (macOS vs Windows vs Android vs Linux), destroy typographic alignment, break professional tone, and look like a toy MVP prompt.
- **The Rule:** **NEVER USE EMOJIS AS UI ELEMENTS.** Use curated monoline SVG icons (such as `lucide-react`, `heroicons`, or custom SVG paths) with strict sizing (`14px`, `16px`, `18px`), optical centering, and dedicated color tokens.

### Sin 2: Neon Purple / Cyan Glow Gradients & Ambient Halos

- **The Slop:** Defaulting to `#6366f1` (indigo) to `#8b5cf6` (purple) to `#06b6d4` (cyan) gradient text, `box-shadow: 0 0 35px rgba(99,102,241,0.5)`, glowing border rings, and ambient background radial blur blobs (`bg-indigo-500/10 blur-3xl`).
  - *Why it's bad:* Every cookie-cutter AI landing page from 2023 uses this exact scheme. It screams "unreviewed AI template" and causes severe visual fatigue.
- **The Rule:** Use disciplined, solid surfaces. Build deep obsidian or slate palettes with high contrast. Use functional accents (emerald `#10b981` for profit/cleared, ruby `#ef4444` for expense/critical, amber `#f59e0b` for pending/warning) with solid dark container insets (`#06281e`, `#2e0b11`, `#2c1b04`), never neon halos.

### Sin 3: Glassmorphism & Translucent Blur Abuse

- **The Slop:** Stacking `backdrop-blur-md bg-white/5` or `bg-black/40` across sidebars, cards, modals, and tables.
  - *Why it's bad:* Multiple stacked blur filters slaughter GPU frame rates, create muddy legibility under scrolled text, and produce fuzzy border artifacts.
- **The Rule:** Use solid, opaque layers with razor-sharp 1px borders:
  - Base Canvas: `#09090b` (Deep Obsidian)
  - Primary Surface: `#111113`
  - Inset / Input Surface: `#161619`
  - Active / Hover Surface: `#1e1e24`
  - Border Primary: `#242429` (1px solid crisp separation)

### Sin 4: Generic Typography & Uncalibrated Sans Soups

- **The Slop:** Applying unstyled `Inter` across every element without tracking adjustments, weight hierarchy, or tabular numeric settings. Numerical data shifts positions during live updates.
- **The Rule:**
  - Technical & Data Figures: `Geist Mono`, `SF Mono`, or `JetBrains Mono` with `font-variant-numeric: tabular-nums` (`.tabular-nums`).
  - Headings: Tight letter spacing (`tracking-tight`), uppercase micro-labels (`text-[10px] tracking-wider uppercase font-semibold text-zinc-500`).
  - High typographic density with intentional line-heights (`leading-none` for metrics, `leading-relaxed` for editorial text).

### Sin 5: Generic Rounded-Full Pills Everywhere

- **The Slop:** Wrapping every badge, tag, button, and input in `rounded-full px-4 py-2`.
- **The Rule:** Use crisp, architectural radii:
  - Badges / Metric tags: `rounded` (4px) or `rounded-md` (6px) with compact padding `px-1.5 py-0.5`.
  - Cards & Containers: `rounded-lg` (8px).
  - Modals & Drawers: `rounded-xl` (12px max).

### Sin 6: Low Contrast & Grey-on-Grey Illegibility

- **The Slop:** `#71717a` text on `#18181b` backgrounds with zero hierarchy, making content impossible to scan in bright rooms or for vision-impaired users.
- **The Rule:** Enforce WCAG AAA contrast:
  - Primary Content: `#ededef` or `#fafafa`
  - Secondary Content: `#9e9ea7`
  - Structural / Muted Labels: `#63636c`
  - Border Highlights: `#323238`

### Sin 7: Meaningless Decorative Widgets & Fake Metrics

- **The Slop:** Inserting fake sparklines, arbitrary progress rings, or random "AI Assistant Insights ✨" chips that have no real data backing.
- **The Rule:** Every pixel must represent authentic domain telemetry. If a metric has no data, show a structured, architectural empty state with keyboard shortcut guidance (`⌘N`).

### Sin 8: Conversational Fluff & Vague AI Microcopy

- **The Slop:** "Welcome back! Ready to supercharge your financial journey? 🚀 Click below to unleash your workflow."
- **The Rule:** Use concise, imperative, domain-accurate engineering language:
  - *Good:* "Resumen Operativo y Financiero", "Cartera al día (0-30 días)", "Exportar CSV (⌘E)".

### Sin 9: Sloppy Hover & Motion Junk

- **The Slop:** Slow bouncy transitions (`duration-500 ease-bounce`), hover rotations (`hover:rotate-6`), floaty scale effects (`hover:scale-110`).
- **The Rule:** High-performance micro-interactions (`duration-100` to `duration-150`, linear or `cubic-bezier(0.16, 1, 0.3, 1)`). State feedback must feel instantaneous (under 50ms perceived latency).

### Sin 10: Lack of Keyboard-First Architecture

- **The Slop:** Mouse-only click targets, missing `:focus-visible` styles, no global keyboard shortcuts, broken Tab order.
- **The Rule:** Implement a keyboard-first navigation loop:
  - Global Command Palette (`⌘K`)
  - Quick Capture (`⌘N`)
  - Numeric view switching (`1-4`) with input typing guards
  - Explicit, high-contrast focus rings (`outline: 2px solid #52525b; outline-offset: 1px`).

---

## 2. Visual Hierarchy, Spatial Density & Grid Rhythm

Inspired by the UI/UX Pro Max intelligence framework, interfaces must enforce a strict spatial rhythm based on a **4-point precision grid**:

```
                       SPATIAL SCALE & DENSITY MATRIX
 ┌───────────────┬─────────┬──────────────────────────────────────────────────────┐
 │ TOKEN         │ VALUE   │ APPLICATION                                          │
 ├───────────────┼─────────┼──────────────────────────────────────────────────────┤
 │ `--space-2xs` │ 2px     │ Micro-offsets, focus ring offsets                    │
 │ `--space-xs`  │ 4px     │ Badge internal padding, inline tag gaps              │
 │ `--space-sm`  │ 8px     │ Button vertical padding, compact form gaps           │
 │ `--space-md`  │ 12px    │ Card internal padding (Dense), input padding         │
 │ `--space-lg`  │ 16px    │ Card padding (Standard), column gutter               │
 │ `--space-xl`  │ 24px    │ Section gaps, modal padding, main container padding  │
 │ `--space-2xl` │ 32px    │ View header vertical padding                         │
 └───────────────┴─────────┴──────────────────────────────────────────────────────┘
```

### Density Dials:
- **High-Density Dashboard / Financial Console (Density 8–10):** Spacing scale 4px–16px. Maximizes visible data density without sacrificing readability. Enables 5+ KPI metrics and 15+ table rows visible above the fold.
- **Standard Console (Density 5–7):** Spacing scale 8px–24px. Ideal for multi-step workflows and form drawers.
- **Zen / Editorial Mode (Density 1–4):** Spacing scale 16px–48px. Distraction-free typography for markdown writing and reading.

---

## 3. Three-Tier Token Architecture (Obsidian & Slate)

```
                        3-TIER TOKEN ARCHITECTURE
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ TIER 1: PRIMITIVES (Raw Hex Values)                                         │
 │   --obsidian-950: #09090b;  --obsidian-900: #111113;  --obsidian-850: #161619│
 │   --emerald-500:  #10b981;  --amber-500:    #f59e0b;  --rose-500:     #ef4444│
 ├─────────────────────────────────────────────────────────────────────────────┤
 │ TIER 2: SEMANTIC TOKENS (Purpose-Driven)                                    │
 │   --bg-canvas: var(--obsidian-950);    --bg-surface: var(--obsidian-900);   │
 │   --bg-inset:  var(--obsidian-850);    --border-subtle: #1a1a1e;            │
 │   --border-primary: #242429;           --border-active: #36363f;            │
 │   --signal-success: var(--emerald-500);--signal-warning: var(--amber-500);  │
 │   --signal-critical: var(--rose-500);                                       │
 ├─────────────────────────────────────────────────────────────────────────────┤
 │ TIER 3: COMPONENT TOKENS (Contextual)                                       │
 │   --kpi-card-bg: var(--bg-surface);    --kpi-card-border: var(--border-primary);│
 │   --diode-bezel-bg: #0e0e11;           --diode-bezel-border: #242429;        │
 │   --table-row-hover: #1e1e24;          --focus-ring: #52525b;                │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Typographic Discipline & Tabular Figures

```
                     TYPOGRAPHIC SCALE SPECIFICATION
 ┌──────────┬──────────┬───────────┬──────────────┬────────────────────────────┐
 │ LEVEL    │ FONT     │ SIZE / LH │ TRACKING     │ USAGE                      │
 ├──────────┼──────────┼───────────┼──────────────┼────────────────────────────┤
 │ Metric XL│ Mono     │ 24px/28px │ tight (-0.02)│ Primary financial totals   │
 │ Heading  │ Sans     │ 14px/18px │ tight (-0.01)│ View headers, card titles  │
 │ Body     │ Sans     │ 12px/16px │ normal (0.00)│ Descriptions, case names   │
 │ Data Cell│ Mono     │ 11px/14px │ tight (0.00) │ Table amounts, dates, IDs  │
 │ Tag/Chip │ Mono     │ 10px/12px │ wide (+0.05) │ Uppercase status indicators│
 └──────────┴──────────┴───────────┴──────────────┴────────────────────────────┘
```

### Font Pairing Protocol:
- **Primary UI Sans:** Native Apple/System (`-apple-system`, `BlinkMacSystemFont`, `SF Pro Display`, `Inter Display`).
- **Primary Technical Mono:** `Geist Mono`, `JetBrains Mono`, `SF Mono`, `Fira Code`.
- **Mandatory CSS Rule:** All numeric columns, currency tags, time stamps, and percentage deltas **MUST** include:
  ```css
  font-variant-numeric: tabular-nums;
  ```

---

## 5. The "Sistema de Luces" (Hardware Optical Telemetry Standard)

The **Sistema de Luces** (Traffic Light Status System) is an industrial telemetry pattern designed to visualize state, health, aging, and risk without falling into the trap of cartoonish icons or glowing pastel pill badges.

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SISTEMA DE LUCES: PROTOCOLO DE BALIZA ÓPTICA DE HARDWARE               │
 ├────────────────────────────────────────────────────────────────────────┤
 │ [●] VERDE  (#10b981) → ESTADO ÓPTIMO / CARTERA AL CORRIENTE (0-30d)    │
 │ [●] ÁMBAR  (#f59e0b) → ATENCIÓN PREVENTIVA / MORA MODERADA (31-90d)    │
 │ [●] ROJO   (#ef4444) → RIESGO CRÍTICO / ACCIÓN INMEDIATA (+90d)        │
 └────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Física y Colorimetría de la Baliza Óptica
- **Bisel Exterior:** Contenedor mecanizado oscuro (`#0e0e11` con borde `1px solid #242429`), nunca un degradado flotante.
- **Lente Diodo Activo:** Pigmento puro y de alto contraste (`#10b981`, `#f59e0b`, `#ef4444`) con anillo perimetral de 1px (`#34d399`, `#fbbf24`, `#f87171`) y un micro-punto central blanco especular (`w-0.5 h-0.5 bg-white/90`) para simular óptica física de vidrio sin desenfoque difuso.
- **Lente Diodo Inactivo:** Estado reposo oscurecido y tintado con opacidad baja (35%), simulando LEDs apagados en una consola real.

### 5.2 Barra de Espectro Proporcional
En paneles de envejecimiento o volumen financiero, sustituye las barras de progreso genéricas por un **espectro segmentado continuo**:
- Cada tramo representa la proporción exacta del total (`0-30d`, `31-60d`, `61-90d`, `+90d`).
- Borde sutil de 1px con fondo oscuro de contraste (`#161619`).
- Etiquetas de porcentaje monoespaciadas debajo de la barra.

### 5.3 Implementación Reusable en React & Tailwind
```tsx
import React from 'react';

export type TrafficLightState = 'GREEN' | 'YELLOW' | 'RED';

export const HardwareOpticalBezel: React.FC<{ state: TrafficLightState; size?: 'sm' | 'md' }> = ({
  state,
  size = 'md',
}) => {
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <div className="inline-flex items-center bg-[#0e0e11] border border-[#242429] rounded-md p-1.5 gap-1.5 shadow-subtle select-none" role="status">
      {/* Verde */}
      <div className={`${dot} rounded-full border flex items-center justify-center ${state === 'GREEN' ? 'bg-[#10b981] border-[#34d399]' : 'bg-[#06281e]/40 border-[#0e533c]/60 opacity-35'}`}>
        {state === 'GREEN' && <span className="w-0.5 h-0.5 bg-white/90 rounded-full" />}
      </div>
      {/* Ámbar */}
      <div className={`${dot} rounded-full border flex items-center justify-center ${state === 'YELLOW' ? 'bg-[#f59e0b] border-[#fbbf24]' : 'bg-[#2c1b04]/40 border-[#6b4308]/60 opacity-35'}`}>
        {state === 'YELLOW' && <span className="w-0.5 h-0.5 bg-white/90 rounded-full" />}
      </div>
      {/* Rojo */}
      <div className={`${dot} rounded-full border flex items-center justify-center ${state === 'RED' ? 'bg-[#ef4444] border-[#f87171]' : 'bg-[#2e0b11]/40 border-[#711b25]/60 opacity-35'}`}>
        {state === 'RED' && <span className="w-0.5 h-0.5 bg-white/90 rounded-full" />}
      </div>
    </div>
  );
};
```

---

## 6. Code Comparison: AI Slop vs. Human Craft

### Example 1: Financial Status Badge

#### ❌ AI Slop (Generic, Neon Glow, Emoji, Pill)
```tsx
// BAD: AI Slop Pattern
<div className="rounded-full px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 shadow-[0_0_20px_#6366f1] text-white flex items-center gap-2 backdrop-blur-md">
  <span>🚀</span>
  <span className="font-sans font-medium">Overdue Invoice: $1,250.00!</span>
</div>
```

#### ✅ Human Craft (Crisp, Monospace, Tabular, High-Contrast Solid)
```tsx
// GOOD: Precision High-Craft Pattern
<div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#2e0b11] border border-[#711b25] text-[#f87171] font-mono text-[10px] font-bold tracking-wider">
  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" aria-hidden="true" />
  <span className="uppercase">Vencido (+90d)</span>
  <span className="text-zinc-400 font-normal">|</span>
  <span className="tabular-nums font-bold text-zinc-100">$1,250.00</span>
</div>
```

---

### Example 2: KPI Metric Card

#### ❌ AI Slop (Vague Text, Neon Gradients, Generic Inter)
```tsx
// BAD: AI Slop Card
<div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 shadow-2xl hover:scale-105 transition-all">
  <div className="text-sm text-gray-400 flex justify-between">
    <span>My Awesome Revenue 💰</span>
    <span>✨ Live</span>
  </div>
  <h2 className="text-4xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
    $45,230.50
  </h2>
  <p className="text-xs text-green-400 mt-2">You're doing great! Keep it up 🚀</p>
</div>
```

#### ✅ Human Craft (Solid Surface, Tabular Figures, Precise Hierarchy)
```tsx
// GOOD: Precision Engineering Card
<div className="bg-[#111113] border border-[#242429] rounded-lg p-4 space-y-2">
  <div className="flex items-center justify-between text-xs text-[#9e9ea7]">
    <span className="font-medium font-sans">Margen Neto Acumulado</span>
    <DollarSign className="w-3.5 h-3.5 text-[#63636c]" />
  </div>
  <div className="text-xl font-bold font-mono text-[#ededef] tabular-nums">
    $45,230.50
  </div>
  <div className="flex items-center justify-between text-[11px]">
    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#06281e] text-[#34d399] border border-[#0e533c] font-mono text-[10px] font-bold">
      <ArrowUpRight className="w-3 h-3 text-[#10b981]" />
      <span>+24.8% Margen</span>
    </span>
    <span className="text-[#63636c] text-[10px] font-mono">Realizado YTD</span>
  </div>
</div>
```

---

## 7. Pre-flight QA Rubric & Scorecard (0–100 Points)

Every agent delivering UI code must evaluate its output against this **10-Category Scorecard**. Code achieving `<90` points must be refactored before presenting to the user:

```
 ┌───────────────────────────────────────────────────────┬────────────┬────────┐
 │ AUDIT CRITERIA                                        │ WEIGHT     │ STATUS │
 ├───────────────────────────────────────────────────────┼────────────┼────────┤
 │ 1. Zero Emojis in Controls, Headers, Badges & Tables  │ 10 pts     │ [ ]    │
 │ 2. No Neon Purple/Cyan Glow Halos & Ambient Blobs     │ 10 pts     │ [ ]    │
 │ 3. Solid Surface Hierarchy (Zero Stacked Muddy Blurs) │ 10 pts     │ [ ]    │
 │ 4. Tabular Numerals (`tabular-nums`) on All Figures   │ 10 pts     │ [ ]    │
 │ 5. Crisp 1px Borders with Geometric Radii (4-8px)     │ 10 pts     │ [ ]    │
 │ 6. Curated Monoline SVG Iconography (Lucide/Heroicons)│ 10 pts     │ [ ]    │
 │ 7. WCAG AAA Contrast (Minimum 4.5:1 text/bg ratio)    │ 10 pts     │ [ ]    │
 │ 8. Instant State Transitions (< 150ms duration)       │ 10 pts     │ [ ]    │
 │ 9. Keyboard Accessibility (`:focus-visible` & ⌘-keys) │ 10 pts     │ [ ]    │
 │ 10. Direct Imperative Microcopy (Zero AI Filler Text) │ 10 pts     │ [ ]    │
 ├───────────────────────────────────────────────────────┼────────────┼────────┤
 │ TOTAL SCORE                                           │ 100 pts    │        │
 └───────────────────────────────────────────────────────┴────────────┴────────┘
```
