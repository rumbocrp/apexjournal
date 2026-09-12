import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  HotkeyDefinition,
} from '../services/hotkeys/types';
import {
  DEFAULT_HOTKEYS,
  getRegisteredHotkeys,
  saveCustomHotkeys,
  loadCustomHotkeys,
  normalizeCombo,
  eventToCombo,
  formatDisplayCombo,
  isMacPlatform,
  checkHotkeyConflict,
} from '../services/hotkeys/hotkeyRegistry';

interface HotkeyContextType {
  hotkeys: HotkeyDefinition[];
  isHotkeyManagerOpen: boolean;
  setHotkeyManagerOpen: (open: boolean) => void;
  updateHotkey: (
    actionId: string,
    newCombo: string,
    force?: boolean
  ) => { success: boolean; conflictWith?: HotkeyDefinition };
  resetHotkey: (actionId: string) => void;
  resetAllHotkeys: () => void;
  getDisplayCombo: (actionId: string) => string;
  registerActionHandler: (actionId: string, handler: () => void) => () => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

const HotkeyContext = createContext<HotkeyContextType | undefined>(undefined);

export const HotkeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hotkeys, setHotkeys] = useState<HotkeyDefinition[]>(() => getRegisteredHotkeys());
  const [isHotkeyManagerOpen, setHotkeyManagerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Registered action handlers map: actionId -> Set of callback functions
  const handlersRef = useRef<Map<string, Set<() => void>>>(new Map());

  // Detect Mac platform (overlay titlebar, Cmd glyphs)
  const isMac = isMacPlatform();

  const registerActionHandler = useCallback((actionId: string, handler: () => void) => {
    if (!handlersRef.current.has(actionId)) {
      handlersRef.current.set(actionId, new Set());
    }
    handlersRef.current.get(actionId)!.add(handler);

    return () => {
      const set = handlersRef.current.get(actionId);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          handlersRef.current.delete(actionId);
        }
      }
    };
  }, []);

  const updateHotkey = useCallback(
    (actionId: string, newCombo: string, force: boolean = false) => {
      const normalized = normalizeCombo(newCombo);
      if (!normalized) {
        return { success: false };
      }

      // Check for conflicts
      const conflict = checkHotkeyConflict(actionId, normalized, hotkeys);
      if (conflict.hasConflict && !force) {
        return { success: false, conflictWith: conflict.conflictingAction };
      }

      const updated = hotkeys.map((h) => {
        if (h.id === actionId) {
          return { ...h, currentCombo: normalized };
        }
        // If forcing over a conflicting hotkey, clear or swap conflict
        if (conflict.hasConflict && h.id === conflict.conflictingAction?.id && force) {
          return { ...h, currentCombo: '' };
        }
        return h;
      });

      setHotkeys(updated);

      // Persist to localStorage
      const customMap = loadCustomHotkeys();
      customMap[actionId] = normalized;
      if (conflict.hasConflict && force && conflict.conflictingAction) {
        delete customMap[conflict.conflictingAction.id];
      }
      saveCustomHotkeys(customMap);

      return { success: true };
    },
    [hotkeys]
  );

  const resetHotkey = useCallback((actionId: string) => {
    const customMap = loadCustomHotkeys();
    delete customMap[actionId];
    saveCustomHotkeys(customMap);

    setHotkeys((prev) =>
      prev.map((h) => (h.id === actionId ? { ...h, currentCombo: h.defaultCombo } : h))
    );
  }, []);

  const resetAllHotkeys = useCallback(() => {
    saveCustomHotkeys({});
    setHotkeys(DEFAULT_HOTKEYS.map((d) => ({ ...d, currentCombo: d.defaultCombo })));
  }, []);

  const getDisplayCombo = useCallback(
    (actionId: string) => {
      const def = hotkeys.find((h) => h.id === actionId);
      if (!def || !def.currentCombo) return '';
      return formatDisplayCombo(def.currentCombo, isMac);
    },
    [hotkeys, isMac]
  );

  // Global keydown event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is recording a new key combination in the manager modal, do not intercept
      if (isRecording) {
        return;
      }

      // Check if target is an interactive form element
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const combo = eventToCombo(e);
      if (!combo) return;

      const normalizedCombo = normalizeCombo(combo);

      // Match against hotkeys
      const matched = hotkeys.find((h) => normalizeCombo(h.currentCombo) === normalizedCombo);
      if (!matched) return;

      // Guard: if typing in text inputs, reject single-key hotkeys or actions not marked allowInInputs
      if (isInput && !matched.allowInInputs) {
        return;
      }

      // Built-in Hotkey Manager toggle shortcut '?'
      if (matched.id === 'global_hotkey_manager') {
        e.preventDefault();
        setHotkeyManagerOpen((prev) => !prev);
        return;
      }

      // Execute registered handlers for this action
      const handlers = handlersRef.current.get(matched.id);
      if (handlers && handlers.size > 0) {
        e.preventDefault();
        for (const handler of handlers) {
          handler();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys, isRecording]);

  return (
    <HotkeyContext.Provider
      value={{
        hotkeys,
        isHotkeyManagerOpen,
        setHotkeyManagerOpen,
        updateHotkey,
        resetHotkey,
        resetAllHotkeys,
        getDisplayCombo,
        registerActionHandler,
        isRecording,
        setIsRecording,
      }}
    >
      {children}
    </HotkeyContext.Provider>
  );
};

export const useHotkeys = (): HotkeyContextType => {
  const context = useContext(HotkeyContext);
  if (!context) {
    throw new Error('useHotkeys must be used within a HotkeyProvider');
  }
  return context;
};
