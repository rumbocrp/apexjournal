export type HotkeyScope = 'global' | 'dashboard' | 'blotter' | 'pipeline' | 'journal';

export type HotkeyCategory =
  | 'navigation'
  | 'global'
  | 'blotter'
  | 'pipeline'
  | 'journal'
  | 'dashboard';

export interface HotkeyDefinition {
  id: string;
  category: HotkeyCategory;
  categoryLabel: string;
  name: string;
  description: string;
  defaultCombo: string;
  currentCombo: string;
  allowInInputs?: boolean;
  scope?: HotkeyScope;
}

export interface HotkeyConflict {
  hasConflict: boolean;
  conflictingAction?: HotkeyDefinition;
}
