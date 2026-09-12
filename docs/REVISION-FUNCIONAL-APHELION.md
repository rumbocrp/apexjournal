# Revisión funcional Aphelion → Trading Journal · Menú de decisión

> **Adaptación (2026-09-09):** versión de `REVISION-FUNCIONAL-APEX.md` (en `JOURNAL/docs/`) tras
> el renombrado del producto de referencia ApexJournal → **Aphelion** (el clon `apex_journal/`
> pasa a ser la carpeta `aphelion/`; este archivo vive dentro de la carpeta del producto). Las
> rutas `docs/PLAN-REPLICA-APEX.md`, `lib/…`, `componentes/…` y `app/…` siguen refiriendo al
> repositorio del Trading Journal; las rutas `src/…` refieren al código de Aphelion.

**Objeto:** catálogo de funcionalidad y UX de Aphelion, listo para que marques con
`x` lo que quieres replicar. Es la fuente de decisión funcional: lo visual ya está resuelto en
`docs/PLAN-REPLICA-APEX.md` (F1–F2 hechas) y `docs/SISTEMA-VISUAL.md`; aquí solo manda el "qué hace".

**Cómo usarlo:**

1. Marca casillas (`- [ ]` → `- [x]`) en los bloques que te interesen y guarda el archivo.
2. Dime "implementa lo marcado" (o nombra un paquete): lo convierto en fases/tareas sobre
   `docs/PLAN-REPLICA-APEX.md`, con sus pruebas y puertas.
3. Si algo falta o sobra, se edita aquí primero.

**Reglas que no se negocian** (aplican a todos los ítems): dinero en enteros e invariantes
I-1…I-6 (`lib/dominio/` intocado), colores solo vía `tokens/sistema.json`, textos en `es.ts`+`en.ts`
(RNF-012), atajos respetan `editable/dialogoAbierto/menuAbierto` (`lib/atajos.ts`), sin build en
este equipo (8 GB) y sin commit.

**Leyenda:** `(F#)` fase del plan relacionada · ⚠️ requiere adaptación de dominio o decisión previa.

**Origen revisado:** `src/views/` (Dashboard, Blotter, Pipeline, Journal, LockScreen),
`src/components/` (palette, capture, hotkeys, layout, lights), `src/context/` (Data, Auth, Hotkey),
`src/services/hotkeys/`, `src/api/` (export, analytics) de Aphelion.

---

## A. Mando global de teclado (relacionada: F3)

- [ ] **A1 · Paleta con acciones de datos, no solo navegación.** La paleta Aphelion lista
  proyectos y notas por nombre y ejecuta acciones: exportar CSV/Excel/respaldo, refrescar datos,
  abrir el gestor de atajos, ir a un caso concreto, abrir/cerrar modo zen. En el Journal: ampliar
  `componentes/ui/MenuComandos.tsx` con trades/sesiones/notas y acciones existentes
  (exportación completa, respaldo).
- [ ] **A2 · Categorías visibles y pie de guía.** Cada resultado lleva chip de categoría
  (Navegación/Acciones/…) y el pie fijo "↑↓ navegar · Enter ejecutar".
- [ ] **A3 · Captura rápida universal (⌘N) con 3 pestañas** — ejecución / sesión / nota —, envío
  con ⌘Enter y cierre con Esc desde cualquier vista. En el Journal pasa por
  `lib/dominio/captura.ts` + `FormularioEjecucion.tsx`/`FormularioDiario.tsx`; opcionalmente crear
  borrador al cerrar (la infraestructura `app/api/borradores` ya existe).
- [ ] **A4 · Recordar la última pestaña usada de la captura rápida** (Aphelion siempre reabre en
  la primera; pequeño cambio de comportamiento a decidir).
- [ ] **A5 · Gestor de atajos editable.** Grabar combinación nueva, detectar conflicto, reasignar
  forzando, reset individual y total, persistencia local (`localStorage` en Aphelion). El Journal
  tiene `GestorAtajos.tsx` (solo lectura) y `AtajosPersonales.tsx` en la variante escritorio:
  decidir dónde vive la edición.
- [ ] **A6 · Scopes por vista + regla de editables.** Los atajos de blotter/diario solo actúan en
  su vista; los combos con modificador (⌘S, ⌘F…) funcionan dentro de inputs (`allowInInputs`).
  El Journal ya filtra en `decidirAtajo`: mantener y documentar el catálogo resultante.
- [ ] **A7 · Badges de atajo reactivos.** Cada botón muestra su `Kbd` y se actualiza al reasignar
  el atajo (componente `componentes/ui/Kbd.tsx` disponible).
- [ ] **A8 · Mapa de dígitos para 8 rutas.** Aphelion navega con 1–4; con 8 rutas hay que fijar el
  mapa (propuesta: 1 Hoy · 2 Trades · 3 Sesiones · 4 Diario · 5 Analítica · 6 Calendario · 7
  Riesgo · 8 Capturar) sin robar teclas de captura de las vistas.

## B. Trades tipo Blotter (relacionada: F5)

- [ ] **B1 · Fila de captura rápida sobre la tabla** (fecha/tipo/categoría/importe/nota) que no
  abre diálogo: Enter registra y limpia importe y nota para encadenar capturas.
- [ ] **B2 · Edición inline de celdas** (importe, fecha, nota): clic para editar, Enter guarda,
  Esc cancela.
- [ ] **B3 · Ciclado de estado con un clic** sobre la etiqueta de la fila (Aphelion rota
  Cleared→Pending→Invoiced→Paid). En el Journal: estado de ejecución pendiente ↔ confirmada,
  respetando I-3 (confirmada solo se corrige).
- [ ] **B4 · Resumen en vivo del filtro:** "Mostrando N · Ingresos +X · Gastos −Y · Neto Z"
  recalculado con los filtros activos, en enteros y con `tabular-nums`.
- [ ] **B5 · Filtros combinados:** búsqueda (nota/categoría/importe), tipo, categoría, estado y
  rango de fechas, todos apilables.
- [ ] **B6 · Exportar CSV de la vista** con nombre fechado y atajo dedicado.
- [ ] **B7 · Borrado en 2 pasos en la misma fila** (papelera → confirmar) y estado vacío que
  enseña el atajo de captura.

## C. Sesiones tipo Pipeline (relacionada: F6)

- [ ] **C1 · Conmutador kanban/tabla con atajo (V):** misma información en dos densidades.
- [ ] **C2 · Mover de etapa con flechas ‹ ›** en cada tarjeta, sin abrir el detalle.
- [ ] **C3 · Drawer de detalle completo:** cabecera (código/etapa/valor objetivo), métricas del
  caso, hitos con checklist (crear con importe y fecha), notas de diario vinculadas con creación
  en línea y refresco del detalle tras cada cambio.
- [ ] **C4 · Etiquetas de etapa con color semántico** (presupuesto ámbar, entregado verde,
  perdido rojo) siempre vía tokens.
- [ ] **C5 · Crear sesión desde la vista con atajo (C).**
- [ ] **C6 · Confirmación al mover con riesgo abierto** (Aphelion no la tiene; el Journal ya la
  prevé en F6 con `lib/riesgo.ts`): conservar esa mejora.

## D. Diario tipo Journal Zen (relacionada: F7)

- [ ] **D1 · Modos edit/split/preview ciclables (⌘P).**
- [ ] **D2 · Zen a pantalla completa (⌘\\):** oculta la lista lateral; Esc cierra.
- [ ] **D3 · Toolbar Markdown con inserción en la selección:** B/I/H/lista/tarea/cita/código
  operando sobre el texto seleccionado del textarea (sin `react-markdown`).
- [ ] **D4 · Panel lateral con búsqueda global** (título+cuerpo+etiquetas), filtro por etiqueta y
  destacados (estrella).
- [ ] **D5 · Plantilla de nueva entrada** con estructura fija (Aphelion usa "Resumen / Acuerdos /
  Próximos pasos"; el Journal puede definir la suya de diario operativo).
- [ ] **D6 · Vincular entrada ↔ trade/sesión** (como Aphelion vincula nota ↔ proyecto) y
  navegación cruzada desde el drawer.
- [ ] **D7 · Guardar con ⌘S + indicador de guardado** (Aphelion guarda manual; el Journal hoy
  guarda al enviar el formulario).

## E. Hoy/Analítica tipo Dashboard (relacionada: F4)

- [ ] **E1 · Fila de KPIs con delta del período** (margen, win rate, volumen, ticket medio).
- [ ] **E2 · Curva con crosshair:** línea vertical + punto + etiqueta fecha/valor al pasar el
  ratón; marco 1W/1M/3M/1Y/ALL con atajos Alt+1…5 (el Journal ya emite `trading-journal:marco`;
  faltan teclado y crosshair).
- [ ] **E3 · Barras mensuales comparativas** (últimos 6 meses, dos series) con detalle al pasar y
  cifras bajo cada mes.
- [ ] **E4 · Estado vacío orientado a acción** ("no hay registros en el intervalo; usa ⌘N").

## F. Semáforo de riesgo (relacionada: F4/F6) ⚠️

El semáforo Aphelion mide cobranza (cubetas 0-30/31-60/61-90/+90). Su lógica financiera está
descartada en el plan; lo replicable es el patrón: estado global + desglose + export + simulador.

- [ ] **F1 · Semáforo de 3 diodos en la topbar** con el estado de riesgo del día (el bezel ya está
  portado en `HardwareOpticalBezel.tsx`; falta cablearlo a `lib/riesgo.ts` y saltar a Riesgo).
- [ ] **F2 · Reglas de estado documentadas y deterministas,** motor puro fuera de React (como
  `trafficLightEngine.ts`), con pruebas y palabra + color (SPEC-005).
- [ ] **F3 · Desglose por niveles + espectro de exposición** adaptado al riesgo (p. ej. uso del
  límite diario/semanal, rachas, déficit).
- [ ] **F4 · Export de informe ejecutivo del estado de riesgo** (Markdown con diagnóstico + tabla,
  y CSV), como `trafficLightExport.ts`.
- [ ] **F5 · Simulador/laboratorio de riesgo** en `app/(app)/laboratorio` con escenarios
  sintéticos para probar el motor.

## G. Datos, carga y respaldo ⚠️

- [ ] **G1 · Resincronización única tras cada mutación** para que KPIs, curva y semáforo queden
  coherentes (Aphelion hace `refreshAll`; auditar cobertura de `SincronizadorDatos.tsx`).
- [ ] **G2 · Recarga selectiva al cambiar de marco temporal** (solo la curva, sin recargar todo).
- [ ] **G3 · Estados de carga por panel** ("Cargando datos del proyecto…" en el drawer).
- [ ] **G4 · Aviso de error visible en fallos de exportación** (Aphelion usa `alert`; en el
  Journal, `componentes/ui/Aviso.tsx`).
- [ ] **G5 · Acción "respaldar ahora" en la topbar con atajo** (ya existen
  `herramientas/respaldar.ts` y agenda de respaldo; falta el acceso en un clic).
- [ ] **G6 · Bloqueo manual/autolock con zeroización** — ⚠️ solo tiene sentido en el paquete
  escritorio (Tauri); fuera de alcance web hoy.

## H. Exportaciones (transversal)

- [ ] **H1 · CSV por dominio con fecha en el nombre** (ejecuciones, sesiones, diario).
- [ ] **H2 · Informe multi-hoja tipo Excel** — ⚠️ el Journal ya tiene
  `app/api/exportacion/completa`; decidir si basta exponerla con atajo (⌘⇧E en Aphelion).
- [ ] **H3 · Informe Markdown ejecutivo** del estado de riesgo (ver F4).

## Paquetes sugeridos

- **Paquete 1 · Estación de mando (F3 reforzada):** A1, A2, A3, A6, A8 + B1, B2, B4.
- **Paquete 2 · Analítica viva (F4):** E1, E2, E3, E4 + F1, F2, F3.
- **Paquete 3 · Control fino:** A4, A5, A7, B3, B5–B7, C1–C6, D1–D7, F4, F5, G1–G5, H1–H3.

## Descartes recomendados (sin casilla)

Si no estás de acuerdo con algún descarte, se habla primero: rompen reglas del repo o requieren
su propio ADR.

- **Motor financiero Aphelion** (INCOME/EXPENSE, `base_amount`, buckets AR, win rate sobre
  proyectos): rompe I-1 y el dominio del Journal.
- **Bóveda SQLCipher/Argon2/biometría tal cual:** exige ADR y solo aplica al paquete escritorio.
- **`react-markdown`:** sin ADR; el render actual se queda.
- **Iconografía Aphelion (lucide):** decisión D5 vigente (sin iconos).
- **Colores y fuentes Aphelion:** solo tokens del sistema (nocturno único, ADR-022).

## Siguiente paso

1. Marca con `x` lo que quieras y guarda.
2. Dime "implementa lo marcado" (o el paquete): lo convierto en fases/tareas concretas sobre
   `docs/PLAN-REPLICA-APEX.md`, con pruebas, e2e y puertas de cada fase.
3. Este archivo queda como registro de la decisión funcional (fecha de marcado libre).
