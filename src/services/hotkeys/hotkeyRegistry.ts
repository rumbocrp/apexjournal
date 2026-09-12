import { HotkeyDefinition, HotkeyConflict } from './types';

export const HOTKEYS_STORAGE_KEY = 'apex_journal_user_hotkeys_v1';

/**
 * True when running on macOS / iOS (overlay titlebar, Cmd glyphs, Touch ID).
 * Uses User-Agent Client Hints when available, falls back to navigator.platform.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hinted = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  const platform = hinted ?? navigator.platform ?? '';
  return /Mac|iPod|iPhone|iPad/.test(platform);
}

export const DEFAULT_HOTKEYS: HotkeyDefinition[] = [
  // --- NAVEGACIÓN PRINCIPAL ---
  {
    id: 'nav_dashboard',
    category: 'navigation',
    categoryLabel: 'Navegación',
    name: 'Ir al Resumen Principal',
    description: 'Cambia a la vista de métricas clave, curva de capital y diagnóstico AR',
    defaultCombo: '1',
    currentCombo: '1',
    scope: 'global',
  },
  {
    id: 'nav_blotter',
    category: 'navigation',
    categoryLabel: 'Navegación',
    name: 'Ir a Ingresos y Gastos',
    description: 'Cambia a la tabla de movimientos contables y registro de caja',
    defaultCombo: '2',
    currentCombo: '2',
    scope: 'global',
  },
  {
    id: 'nav_pipeline',
    category: 'navigation',
    categoryLabel: 'Navegación',
    name: 'Ir a Proyectos y Clientes',
    description: 'Cambia al tablero Kanban de proyectos y gestión de entregas',
    defaultCombo: '3',
    currentCombo: '3',
    scope: 'global',
  },
  {
    id: 'nav_journal',
    category: 'navigation',
    categoryLabel: 'Navegación',
    name: 'Ir a Bitácora y Notas',
    description: 'Cambia al editor de bitácora y acuerdos operativos',
    defaultCombo: '4',
    currentCombo: '4',
    scope: 'global',
  },

  // --- ACCIONES GLOBALES Y SISTEMA ---
  {
    id: 'global_command_palette',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Abrir Paleta de Comandos',
    description: 'Abre el buscador unificado estilo Raycast para navegar y ejecutar',
    defaultCombo: 'Mod+K',
    currentCombo: 'Mod+K',
    allowInInputs: true,
    scope: 'global',
  },
  {
    id: 'global_quick_capture',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Nuevo Registro Rápido',
    description: 'Abre el modal de captura rápida para transacciones, casos o notas',
    defaultCombo: 'Mod+N',
    currentCombo: 'Mod+N',
    allowInInputs: true,
    scope: 'global',
  },
  {
    id: 'global_hotkey_manager',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Gestor de Atajos y Teclado',
    description: 'Abre el panel interactivo para consultar y editar todos los hotkeys',
    defaultCombo: '?',
    currentCombo: '?',
    scope: 'global',
  },
  {
    id: 'global_lock_vault',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Bloquear Bóveda Cifrada',
    description: 'Zeroiza memoria y cierra de inmediato el acceso a la base de datos',
    defaultCombo: 'Mod+L',
    currentCombo: 'Mod+L',
    allowInInputs: true,
    scope: 'global',
  },
  {
    id: 'global_export_backup',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Exportar Respaldo Cifrado (.vault)',
    description: 'Genera copia de seguridad protegida con AES-256 y Argon2id',
    defaultCombo: 'Mod+Shift+B',
    currentCombo: 'Mod+Shift+B',
    allowInInputs: true,
    scope: 'global',
  },
  {
    id: 'global_export_excel',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Exportar Informe en Excel',
    description: 'Genera libro de cuentas multi-hoja con estados contables',
    defaultCombo: 'Mod+Shift+E',
    currentCombo: 'Mod+Shift+E',
    allowInInputs: true,
    scope: 'global',
  },
  {
    id: 'global_export_csv',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Exportar Vista en CSV',
    description: 'Descarga en formato CSV los datos de la vista actualmente abierta',
    defaultCombo: 'Mod+E',
    currentCombo: 'Mod+E',
    allowInInputs: true,
    scope: 'global',
  },
  {
    id: 'global_refresh_data',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Recargar y Sincronizar Datos',
    description: 'Reconsulta la base de datos y refresca todos los paneles',
    defaultCombo: 'Mod+R',
    currentCombo: 'Mod+R',
    allowInInputs: true,
    scope: 'global',
  },
  {
    id: 'global_toggle_sidebar',
    category: 'global',
    categoryLabel: 'Sistema & Global',
    name: 'Colapsar / Expandir Menú Lateral',
    description: 'Alterna entre la barra lateral completa y el modo compacto de iconos',
    defaultCombo: 'Mod+[',
    currentCombo: 'Mod+[',
    allowInInputs: true,
    scope: 'global',
  },

  // --- BLOTTER (INGRESOS Y GASTOS) ---
  {
    id: 'blotter_focus_search',
    category: 'blotter',
    categoryLabel: 'Movimientos',
    name: 'Buscar en Movimientos',
    description: 'Lleva el foco al campo de búsqueda de texto en la tabla',
    defaultCombo: '/',
    currentCombo: '/',
    scope: 'blotter',
  },
  {
    id: 'blotter_focus_amount',
    category: 'blotter',
    categoryLabel: 'Movimientos',
    name: 'Enfocar Importe Rápido',
    description: 'Enfoca la celda de importe en la barra de captura rápida',
    defaultCombo: 'A',
    currentCombo: 'A',
    scope: 'blotter',
  },
  {
    id: 'blotter_focus_notes',
    category: 'blotter',
    categoryLabel: 'Movimientos',
    name: 'Enfocar Notas Rápidas',
    description: 'Enfoca el campo de descripción/notas en la barra de captura rápida',
    defaultCombo: 'N',
    currentCombo: 'N',
    scope: 'blotter',
  },
  {
    id: 'blotter_toggle_type',
    category: 'blotter',
    categoryLabel: 'Movimientos',
    name: 'Alternar Tipo (Ingreso / Gasto)',
    description: 'Conmuta entre Ingreso (+) y Gasto (-) en la barra de captura',
    defaultCombo: 'T',
    currentCombo: 'T',
    scope: 'blotter',
  },
  {
    id: 'blotter_cycle_status',
    category: 'blotter',
    categoryLabel: 'Movimientos',
    name: 'Ciclar Filtro de Estado',
    description: 'Rota el filtro entre Todos, Cleared, Invoiced, Pending y Paid',
    defaultCombo: 'S',
    currentCombo: 'S',
    scope: 'blotter',
  },

  // --- PIPELINE (PROYECTOS) ---
  {
    id: 'pipeline_toggle_view',
    category: 'pipeline',
    categoryLabel: 'Proyectos',
    name: 'Alternar Vista Kanban / Lista',
    description: 'Alterna entre las 5 columnas Kanban y la vista de tabla compacta',
    defaultCombo: 'V',
    currentCombo: 'V',
    scope: 'pipeline',
  },
  {
    id: 'pipeline_new_case',
    category: 'pipeline',
    categoryLabel: 'Proyectos',
    name: 'Crear Proyecto / Presupuesto',
    description: 'Abre el formulario para ingresar un nuevo caso de cliente',
    defaultCombo: 'C',
    currentCombo: 'C',
    scope: 'pipeline',
  },

  // --- JOURNAL (BITÁCORA Y NOTAS) ---
  {
    id: 'journal_toggle_zen',
    category: 'journal',
    categoryLabel: 'Bitácora',
    name: 'Alternar Modo Zen Enfocado',
    description: 'Maximiza el editor de notas ocultando paneles laterales',
    defaultCombo: 'Mod+\\',
    currentCombo: 'Mod+\\',
    allowInInputs: true,
    scope: 'journal',
  },
  {
    id: 'journal_save',
    category: 'journal',
    categoryLabel: 'Bitácora',
    name: 'Guardar Nota Activa',
    description: 'Guarda inmediatamente el contenido editado de la nota',
    defaultCombo: 'Mod+S',
    currentCombo: 'Mod+S',
    allowInInputs: true,
    scope: 'journal',
  },
  {
    id: 'journal_new_entry',
    category: 'journal',
    categoryLabel: 'Bitácora',
    name: 'Nueva Entrada en Bitácora',
    description: 'Crea un borrador en blanco listo para redactar en Markdown',
    defaultCombo: 'Mod+Shift+N',
    currentCombo: 'Mod+Shift+N',
    allowInInputs: true,
    scope: 'journal',
  },
  {
    id: 'journal_cycle_preview',
    category: 'journal',
    categoryLabel: 'Bitácora',
    name: 'Alternar Modo Vista / Edición',
    description: 'Cicla entre Split (dividido), Solo Edición y Solo Vista Previa',
    defaultCombo: 'Mod+P',
    currentCombo: 'Mod+P',
    allowInInputs: true,
    scope: 'journal',
  },
  {
    id: 'journal_focus_search',
    category: 'journal',
    categoryLabel: 'Bitácora',
    name: 'Buscar en Bitácora',
    description: 'Enfoca la caja de búsqueda de notas',
    defaultCombo: 'Mod+F',
    currentCombo: 'Mod+F',
    allowInInputs: true,
    scope: 'journal',
  },

  // --- DASHBOARD (RESUMEN OPERATIVO) ---
  {
    id: 'dashboard_tf_1w',
    category: 'dashboard',
    categoryLabel: 'Resumen',
    name: 'Marco Temporal: 1 Semana',
    description: 'Ajusta la curva de capital a la última semana',
    defaultCombo: 'Alt+1',
    currentCombo: 'Alt+1',
    scope: 'dashboard',
  },
  {
    id: 'dashboard_tf_1m',
    category: 'dashboard',
    categoryLabel: 'Resumen',
    name: 'Marco Temporal: 1 Mes',
    description: 'Ajusta la curva de capital al último mes',
    defaultCombo: 'Alt+2',
    currentCombo: 'Alt+2',
    scope: 'dashboard',
  },
  {
    id: 'dashboard_tf_3m',
    category: 'dashboard',
    categoryLabel: 'Resumen',
    name: 'Marco Temporal: 3 Meses',
    description: 'Ajusta la curva de capital al último trimestre',
    defaultCombo: 'Alt+3',
    currentCombo: 'Alt+3',
    scope: 'dashboard',
  },
  {
    id: 'dashboard_tf_1y',
    category: 'dashboard',
    categoryLabel: 'Resumen',
    name: 'Marco Temporal: 1 Año',
    description: 'Ajusta la curva de capital al último año',
    defaultCombo: 'Alt+4',
    currentCombo: 'Alt+4',
    scope: 'dashboard',
  },
  {
    id: 'dashboard_tf_all',
    category: 'dashboard',
    categoryLabel: 'Resumen',
    name: 'Marco Temporal: Todo el Historial',
    description: 'Muestra la totalidad de la curva de capital registrada',
    defaultCombo: 'Alt+5',
    currentCombo: 'Alt+5',
    scope: 'dashboard',
  },
];

/**
 * Normalizes a key combination string to standard representation:
 * Mod+Alt+Shift+Key (in alphabetical modifier order).
 */
export function normalizeCombo(combo: string): string {
  if (!combo) return '';
  const parts = combo
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);

  let hasMod = false;
  let hasAlt = false;
  let hasShift = false;
  let mainKey = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'mod' || lower === 'cmd' || lower === 'ctrl' || lower === 'control' || lower === 'meta') {
      hasMod = true;
    } else if (lower === 'alt' || lower === 'option') {
      hasAlt = true;
    } else if (lower === 'shift') {
      hasShift = true;
    } else {
      mainKey = part.length === 1 ? part.toUpperCase() : part;
    }
  }

  const result: string[] = [];
  if (hasMod) result.push('Mod');
  if (hasAlt) result.push('Alt');
  if (hasShift) result.push('Shift');
  if (mainKey) result.push(mainKey);

  return result.join('+');
}

/**
 * Converts a browser KeyboardEvent into our standard combo string.
 */
export function eventToCombo(e: KeyboardEvent): string | null {
  // Ignore standalone modifier presses
  const key = e.key;
  if (
    key === 'Control' ||
    key === 'Meta' ||
    key === 'Alt' ||
    key === 'Shift' ||
    key === 'CapsLock' ||
    key === 'Tab'
  ) {
    return null;
  }

  const hasMod = e.metaKey || e.ctrlKey;
  const hasAlt = e.altKey;
  const hasShift = e.shiftKey;

  let keyName = key;
  if (key === 'Escape') keyName = 'Escape';
  else if (key === 'Enter') keyName = 'Enter';
  else if (key === ' ') keyName = 'Space';
  else if (key === '\\') keyName = '\\';
  else if (key === '/') keyName = '/';
  else if (key === '?') keyName = '?';
  else if (key === '[') keyName = '[';
  else if (key === ']') keyName = ']';
  else if (key.length === 1) {
    keyName = key.toUpperCase();
  }

  const parts: string[] = [];
  if (hasMod) parts.push('Mod');
  if (hasAlt) parts.push('Alt');
  if (hasShift && (hasMod || hasAlt || keyName.length > 1)) {
    // Only add Shift modifier explicitly if paired with other modifiers or special key
    parts.push('Shift');
  }
  parts.push(keyName);

  return parts.join('+');
}

/**
 * Formats a combo string for display with Mac or PC symbols.
 */
export function formatDisplayCombo(combo: string, isMac: boolean = true): string {
  if (!combo) return '';

  const normalized = normalizeCombo(combo);
  const parts = normalized.split('+');

  const modLabel = isMac ? '⌘' : 'Ctrl';
  const altLabel = isMac ? '⌥' : 'Alt';
  const shiftLabel = isMac ? '⇧' : 'Shift';

  const renderedParts = parts.map((p) => {
    if (p === 'Mod') return modLabel;
    if (p === 'Alt') return altLabel;
    if (p === 'Shift') return shiftLabel;
    if (p === 'Enter') return isMac ? '↵' : 'Enter';
    if (p === 'Escape') return 'ESC';
    if (p === 'Space') return 'Espacio';
    return p;
  });

  return isMac ? renderedParts.join('') : renderedParts.join('+');
}

/**
 * Load user custom keybindings from localStorage.
 */
export function loadCustomHotkeys(): Record<string, string> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(HOTKEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to load custom hotkeys from localStorage:', err);
  }
  return {};
}

/**
 * Save user custom keybindings into localStorage.
 */
export function saveCustomHotkeys(map: Record<string, string>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(HOTKEYS_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save custom hotkeys to localStorage:', err);
  }
}

/**
 * Build the active hotkeys catalog combining defaults with user customizations.
 */
export function getRegisteredHotkeys(): HotkeyDefinition[] {
  const customMap = loadCustomHotkeys();
  return DEFAULT_HOTKEYS.map((def) => {
    const userCombo = customMap[def.id];
    return {
      ...def,
      currentCombo: userCombo ? normalizeCombo(userCombo) : def.defaultCombo,
    };
  });
}

/**
 * Checks if a given combination conflicts with any other registered hotkey.
 */
export function checkHotkeyConflict(
  actionId: string,
  targetCombo: string,
  hotkeys: HotkeyDefinition[]
): HotkeyConflict {
  const normalizedTarget = normalizeCombo(targetCombo);
  const conflicting = hotkeys.find(
    (h) => h.id !== actionId && normalizeCombo(h.currentCombo) === normalizedTarget
  );
  if (conflicting) {
    return { hasConflict: true, conflictingAction: conflicting };
  }
  return { hasConflict: false };
}
