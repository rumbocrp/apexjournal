# Investigación Técnica: Hotkeys Universales, Editables y de Alta Ergonomía en ApexJournal

**Fecha:** 2026-09-03  
**Fase:** 01 (Tree Research)  
**Dominio:** Frontend Keyboard Engine & User-Customizable Hotkey System  
**Objetivo:** Diseñar e implementar un sistema de atajos de teclado (hotkeys) universales, editables por el usuario y de nula latencia para todos los campos, vistas y funciones del sistema en ApexJournal.

---

## Resumen Ejecutivo

ApexJournal contaba con un conjunto estático y codificado en duro de atajos de teclado (`1-4` para vistas, `Cmd+K` para la paleta de comandos, `Cmd+N` para captura rápida y `Cmd+\` para Zen Mode). Para transformar la plataforma en una consola operativa de máxima velocidad (al nivel de Linear, Bloomberg Terminal o Superhuman), se diseñó una arquitectura de registro centralizado (`HotkeyRegistry`) persistido localmente (`localStorage`), con resolución dinámica de colisiones, captura interactiva de combinaciones de teclas (Keybinding Recorder), y vinculación visual bidireccional (los badges de teclas en botones y campos se actualizan inmediatamente cuando el usuario personaliza un atajo).

---

## Hallazgos Técnicos (Findings)

- **F-1: Acoplamiento Rígido en Dispersión de Componentes**  
  Los atajos estaban definidos de forma independiente en múltiples archivos (`App.tsx`, `CommandPalette.tsx`, `QuickCaptureModal.tsx`, `JournalView.tsx`) usando bloques `useEffect` aislados. Esto impedía la edición dinámica por parte del usuario, provocaba inconsistencias al cambiar asignaciones y no permitía que los botones del sistema (respaldos, exportaciones CSV/Excel, bloqueos de bóveda) tuvieran atajos editables y unificados.

- **F-2: Prevención de Colisiones en Entornos de Edición Contable/Financiera**  
  Al ser una plataforma con inputs numéricos de precisión (`amount`, tipos de cambio) y áreas de redacción Markdown (`JournalView`), los atajos de tecla única (`1`, `2`, `/`, `V`, `A`) deben quedar estrictamente suspendidos cuando el foco activo reside en elementos interactivos de texto (`INPUT`, `TEXTAREA`, `SELECT`, `[contenteditable]`), a excepción de combinaciones con teclas modificadoras del sistema (`Mod+Enter`, `Mod+S`, `Mod+K`).

- **F-3: Rendimiento y Cero Latencia en Despacho de Eventos**  
  Un único listener global a nivel de `window` conectado a una tabla hash indexada por `Mod+Shift+Key` garantiza un tiempo de resolución constante $O(1)$ (< 1ms), evitando la degradación por acumulación de escuchadores o re-renders innecesarios de componentes React.

- **F-4: Persistencia y Coherencia Anti-AI Slop**  
  La configuración personalizada del usuario debe almacenarse de forma segura en `localStorage` con sanitización estricta y capacidad de restauración instantánea a valores predeterminados de fábrica. La interfaz del gestor y los badges deben respetar el estándar de diseño industrial: `#09090b` canvas, `#111113` superficies, bordes nítidos de `1px #242429`, tipografía monoespaciada tabular (`tabular-nums`) y cero desenfoques difusos ni emojis.

---

## Recomendaciones de Arquitectura (Recommendations)

- **R-1: Contexto Global y Hook Unificado (`HotkeyContext`)**  
  Implementar un proveedor `HotkeyProvider` y el hook `useHotkeys()` que exponga el catálogo completo de acciones, el método de actualización `updateHotkey(id, newCombo)`, comprobación de conflictos `checkConflict(combo)`, restablecimiento `resetDefaults()` y el mapa activo de badges.

- **R-2: Catálogo Exhaustivo de Acciones y Funciones**  
  Cubrir la totalidad de las operaciones del sistema:
  1. **Navegación:** Resumen (`1`), Blotter (`2`), Pipeline (`3`), Bitácora (`4`).
  2. **Acciones Globales:** Paleta de Comandos (`Mod+K`), Registro Rápido (`Mod+N`), Gestor de Atajos (`?` o `Mod+/`), Bloqueo Cifrado (`Mod+L`), Exportar Copia Bóveda (`Mod+Shift+B`), Exportar Excel (`Mod+Shift+E`), Exportar CSV (`Mod+E`), Recargar Datos (`Mod+R`), Alternar Menú Lateral (`Mod+[`).
  3. **Campos y Enfoque Directo en Blotter:** Foco en Buscador (`/`), Foco en Importe Rápido (`A`), Foco en Notas Rápido (`N`), Alternar Tipo Ingreso/Gasto (`T`), Alternar Filtro de Estados (`S`).
  4. **Pipeline & Proyectos:** Alternar Vista Kanban / Tabla (`V`), Nuevo Proyecto (`C`).
  5. **Bitácora (Journal):** Alternar Modo Zen (`Mod+\`), Guardar Nota (`Mod+S`), Nueva Nota (`Mod+Shift+N`), Foco en Búsqueda (`Mod+F`), Alternar Modo Editor (`Mod+P`).

- **R-3: Modal Interactivo de Gestión y Reasignación ("Gestor de Hotkeys")**  
  Crear el componente `HotkeySettingsModal.tsx` que permita visualizar todas las categorías, buscar comandos, pulsar cualquier atajo para entrar en modo de escucha/grabación (capturando `keydown` con `metaKey`, `ctrlKey`, `altKey`, `shiftKey` y la tecla), alertar si hay conflicto con otra acción y persistir los cambios al instante.

- **R-4: Componente de Badge Visual Reactivo (`HotkeyBadge`)**  
  Proveer un micro-componente `<HotkeyBadge actionId="..." />` que se integre en la barra de título, menú lateral, botones de exportación, botones de bloqueo y cabeceras de tablas, actualizándose en tiempo real si el usuario edita la combinación.

- **R-5: Suite de Pruebas Empíricas de Verificación Automática**  
  Extender la suite de tests en `tests/` para verificar de forma determinista la carga predeterminada, la modificación de combinaciones, la detección de conflictos, la persistencia en almacenamiento y la neutralización de colisiones en inputs.
