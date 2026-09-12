# Sistema de Luces: Standalone Industrial Telemetry Engine

An enterprise-grade, deterministic Accounts Receivable Aging and operational risk telemetry system built under the **Anti-AI-Slop** design standard.

---

## Features

- **Precision Determinism:** Fixed-point sub-cent calculations with bank-grade half-to-even rounding.
- **No Timezone Skew:** Calendar-based UTC day boundary calculations with zero DST drift.
- **Hardware Optical Bezel:** Machined physical LED clusters with central specular refraction point. No blurry neon glow or generic AI pills.
- **Accessible by Design:** Built-in geometric glyphs for colorblind accessibility (`colorblindMode={true}`), full keyboard navigation, and WCAG AAA contrast ratios.
- **Multi-Segment Exposure Spectrum:** Continuous proportional risk distribution visualization.
- **Pluggable & Zero-Lockin:** Usable with SQLCipher, PostgreSQL, REST APIs, or pure in-memory state.

---

## Quick Start

### 1. Evaluate Invoices in React

```tsx
import React from 'react';
import { useTrafficLightEngine, TrafficLightSystemPanel } from './components/lights';

export const MyFinancialConsole = () => {
  const invoices = [
    { id: 'inv-1', amount: 4500, date: '2026-08-15', status: 'INVOICED' },
    { id: 'inv-2', amount: 1200, date: '2026-06-20', status: 'INVOICED' },
  ];

  const report = useTrafficLightEngine(invoices);

  return (
    <div className="p-6 bg-[#09090b]">
      <TrafficLightSystemPanel
        report={report}
        onInspectBlotter={() => console.log('Open ledger')}
      />
    </div>
  );
};
```

### 2. Standalone Compact Optical Beacon

```tsx
import { HardwareOpticalBezel } from './components/lights';

// Render compact 3-diode status indicator
<HardwareOpticalBezel state="GREEN" size="sm" showLabels={false} />
<HardwareOpticalBezel state="YELLOW" size="md" showLabels={true} colorblindMode={true} />
```

---

## API Reference

### Component Props

#### `<HardwareOpticalBezel />`
| Prop | Type | Default | Description |
|---|---|---|---|
| `state` | `'GREEN' \| 'YELLOW' \| 'RED'` | **Required** | Current resolved system state |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Optical diameter (8px / 10px / 16px) |
| `showLabels` | `boolean` | `false` | Shows text status badge (`SANO` / `ALERTA` / `CRÍTICO`) |
| `colorblindMode`| `boolean` | `false` | Renders geometric micro-glyphs inside diodes |

#### `<ExposureSpectrumBar />`
| Prop | Type | Default | Description |
|---|---|---|---|
| `buckets` | `AgingBucketTelemetry[]` | **Required** | Array of 4 aging buckets |
| `heightPx` | `number` | `6` | Height of the continuous bar in pixels |
| `showLabels` | `boolean` | `true` | Shows percentage markers at axis boundaries |

#### `<TrafficLightSystemPanel />`
| Prop | Type | Default | Description |
|---|---|---|---|
| `report` | `TrafficLightTelemetryReport` | **Required** | Engine evaluation report |
| `onInspectBlotter` | `() => void` | `undefined` | Callback for "Ver en Registro" action |
| `onSelectBucket` | `(bucketId: string) => void` | `undefined` | Callback when clicking a bucket row |
| `colorblindMode` | `boolean` | `false` | Enables accessible glyphs |

---

## State Machine Rules

1. **RED (`#ef4444`):** Triggered when $\mathcal{S}_{90+} > 0$ (invoices overdue by $>90$ days).
2. **YELLOW (`#f59e0b`):** Triggered when $\mathcal{S}_{90+} = 0$ and $\mathcal{S}_{61-90} > 0$ (invoices between 61 and 90 days).
3. **GREEN (`#10b981`):** Triggered when all invoices are within the normal commercial cycle (0 to 60 days).

---

## Anti-AI-Slop Design Compliance

- [x] Zero Emojis in controls, badges, headers, or data grids.
- [x] Zero Neon Glow Halos (`#6366f1` to `#8b5cf6`) or blurry radial background blobs.
- [x] Solid Obsidian Surfaces (`#09090b` canvas, `#111113` surface, `#161619` inset).
- [x] Tabular Numerals (`tabular-nums`) with `Geist Mono` or `SF Mono`.
- [x] Crisp 1px Borders (`#242429`).
- [x] WCAG AAA High Contrast Text (`#ededef` and `#9e9ea7`).
