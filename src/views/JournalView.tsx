import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen,
  Plus,
  Search,
  Star,
  Maximize2,
  Minimize2,
  Calendar,
  Edit3,
  Eye,
  Columns,
  Bold,
  Italic,
  Code,
  Heading,
  List,
  CheckSquare,
  Quote,
  Save,
  Download,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useHotkeys } from '../context/HotkeyContext';
import { HotkeyBadge } from '../components/hotkeys';
import { Dropdown } from '../components/common/Dropdown';
import { JournalEntry } from '../types';
import { triggerCsvExport } from '../api/export';

export const JournalView: React.FC = () => {
  const {
    journal,
    cases,
    createJournalEntry,
    updateJournalEntry,
    isZenMode,
    setZenMode,
  } = useData();

  const { registerActionHandler } = useHotkeys();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [onlyStarred, setOnlyStarred] = useState(false);

  // Selected note for editing / viewing
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Editor state
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorCaseId, setEditorCaseId] = useState<string>('');
  const [editorTags, setEditorTags] = useState('');
  const [editorStarred, setEditorStarred] = useState(false);
  const [editorMode, setEditorMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [isSaving, setIsSaving] = useState(false);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const j of journal) {
      for (const t of j.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [journal]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return journal.filter((j) => {
      if (onlyStarred && !j.is_starred) return false;
      if (selectedTag !== 'ALL' && !j.tags.includes(selectedTag)) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = j.title.toLowerCase().includes(q);
        const matchContent = j.content.toLowerCase().includes(q);
        const matchTag = j.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchContent && !matchTag) return false;
      }
      return true;
    });
  }, [journal, onlyStarred, selectedTag, search]);

  // Set initial selected note
  useEffect(() => {
    if (!selectedEntryId && filteredEntries.length > 0) {
      const first = filteredEntries[0];
      setSelectedEntryId(first.id);
      setEditorTitle(first.title);
      setEditorContent(first.content);
      setEditorCaseId(first.case_id || '');
      setEditorTags(first.tags.join(', '));
      setEditorStarred(first.is_starred);
    }
  }, [filteredEntries, selectedEntryId]);

  // Escape to close Zen mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZenMode) {
        e.preventDefault();
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isZenMode, setZenMode]);

  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedEntryId(entry.id);
    setEditorTitle(entry.title);
    setEditorContent(entry.content);
    setEditorCaseId(entry.case_id || '');
    setEditorTags(entry.tags.join(', '));
    setEditorStarred(entry.is_starred);
  };

  const handleCreateNew = () => {
    setSelectedEntryId(null);
    setEditorTitle('Nueva Nota');
    setEditorContent('# Registro y Avance\n\n- Resumen: \n- Acuerdos: \n- Próximos pasos: \n');
    setEditorCaseId('');
    setEditorTags('');
    setEditorStarred(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tagList = editorTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (selectedEntryId) {
        await updateJournalEntry(selectedEntryId, {
          title: editorTitle,
          content: editorContent,
          case_id: editorCaseId || null,
          tags: tagList,
          is_starred: editorStarred,
        });
      } else {
        const created = await createJournalEntry({
          title: editorTitle,
          content: editorContent,
          case_id: editorCaseId || null,
          tags: tagList,
          is_starred: editorStarred,
        });
        setSelectedEntryId(created.id);
      }
    } catch (err: any) {
      console.error('Failed to save journal entry:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Register Journal hotkey handlers
  useEffect(() => {
    const unregZen = registerActionHandler('journal_toggle_zen', () => {
      setZenMode((prev) => !prev);
    });

    const unregSave = registerActionHandler('journal_save', () => {
      handleSave();
    });

    const unregNew = registerActionHandler('journal_new_entry', () => {
      handleCreateNew();
    });

    const unregMode = registerActionHandler('journal_cycle_preview', () => {
      setEditorMode((curr) => (curr === 'split' ? 'edit' : curr === 'edit' ? 'preview' : 'split'));
    });

    const unregSearch = registerActionHandler('journal_focus_search', () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => {
      unregZen();
      unregSave();
      unregNew();
      unregMode();
      unregSearch();
    };
  }, [registerActionHandler, setZenMode, handleSave, handleCreateNew]);

  // Helper for formatting shortcuts
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('journalTextarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editorContent.substring(start, end);
    const replacement = `${prefix}${selected || 'texto'}${suffix}`;
    const nextContent = editorContent.substring(0, start) + replacement + editorContent.substring(end);
    setEditorContent(nextContent);
  };

  return (
    <div className="flex-1 flex h-full bg-obsidian-950 overflow-hidden relative text-obsidian-100 select-none">
      {/* Left Column: Entries List (Hidden in Zen Mode) */}
      {!isZenMode && (
        <aside className="w-80 border-r border-surface-border bg-surface-primary flex flex-col justify-between shrink-0">
          {/* Header & Filter Controls */}
          <div className="p-3.5 border-b border-surface-border space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-semibold tracking-[0.2em] text-obsidian-100 font-mono uppercase flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-obsidian-400" />
                <span>Bitácora y Notas</span>
              </h1>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={async () => {
                    try {
                      const csv = await triggerCsvExport('journal');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `bitacora_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                    } catch (err: any) {
                      alert(`Error al exportar CSV: ${err.message || err}`);
                    }
                  }}
                  className="p-1 rounded bg-surface-secondary hover:bg-surface-hover text-obsidian-400 hover:text-white border border-surface-border transition-fast"
                  title="Exportar notas en CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-obsidian-100 hover:bg-white text-obsidian-950 text-xs font-semibold rounded transition-fast"
                  title="Crear nueva entrada"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva</span>
                  <HotkeyBadge actionId="journal_new_entry" variant="accent" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-obsidian-500 absolute left-2.5 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar en el contenido o etiquetas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-500 focus:outline-none focus:border-obsidian-400"
              />
              <div className="absolute right-2 top-2 pointer-events-none">
                <HotkeyBadge actionId="journal_focus_search" variant="subtle" />
              </div>
            </div>

            {/* Filter Pill Row */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-[11px] font-mono">
              <button
                onClick={() => setOnlyStarred(!onlyStarred)}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded border transition-fast ${
                  onlyStarred
                    ? 'bg-financial-warningMuted text-financial-warningText border-financial-warningBorder'
                    : 'bg-surface-secondary text-obsidian-400 border-surface-border hover:text-obsidian-200'
                }`}
              >
                <Star className={`w-3 h-3 ${onlyStarred ? 'fill-current' : ''}`} />
                <span>Destacadas</span>
              </button>

              <button
                onClick={() => setSelectedTag('ALL')}
                className={`px-2 py-0.5 rounded border transition-fast ${
                  selectedTag === 'ALL'
                    ? 'bg-obsidian-100 text-obsidian-950 font-bold border-transparent'
                    : 'bg-surface-secondary text-obsidian-400 border-surface-border hover:text-obsidian-200'
                }`}
              >
                Todas
              </button>

              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2 py-0.5 rounded border transition-fast whitespace-nowrap ${
                    selectedTag === tag
                      ? 'bg-obsidian-100 text-obsidian-950 font-bold border-transparent'
                      : 'bg-surface-secondary text-obsidian-400 border-surface-border hover:text-obsidian-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Entries Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-surface-borderSubtle">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-obsidian-500">
                No hay notas que coincidan con la búsqueda.
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isSelected = selectedEntryId === entry.id;
                const caseObj = cases.find((c) => c.id === entry.case_id);

                return (
                  <div
                    key={entry.id}
                    onClick={() => handleSelectEntry(entry)}
                    className={`p-3.5 cursor-pointer transition-fast space-y-1.5 ${
                      isSelected
                        ? 'bg-surface-secondary border-l-2 border-obsidian-100 pl-3'
                        : 'hover:bg-surface-hover/50 text-obsidian-400'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h3
                        className={`text-xs font-semibold line-clamp-1 ${
                          isSelected ? 'text-obsidian-100' : 'text-obsidian-300'
                        }`}
                      >
                        {entry.title || 'Sin título'}
                      </h3>
                      {entry.is_starred && (
                        <Star className="w-3 h-3 text-financial-warningText fill-current shrink-0 ml-1 mt-0.5" />
                      )}
                    </div>

                    <p className="text-[11px] text-obsidian-500 line-clamp-2 leading-relaxed">
                      {entry.content.replace(/[#*`_]/g, '') || 'Nota vacía'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-obsidian-500 pt-1">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-2.5 h-2.5" />
                        <span>{entry.created_at ? entry.created_at.substring(0, 10) : 'Hoy'}</span>
                      </span>

                      {caseObj && (
                        <span className="truncate max-w-[100px] text-obsidian-400">
                          {caseObj.title}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* Right Column: Markdown Editor / Live Preview Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-obsidian-950">
        {/* Editor Toolbar */}
        <div className="p-3 border-b border-surface-border bg-surface-primary flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2">
            {/* Star toggle */}
            <button
              onClick={() => setEditorStarred(!editorStarred)}
              className={`p-1.5 rounded transition-fast ${
                editorStarred
                  ? 'text-financial-warningText bg-financial-warningMuted border border-financial-warningBorder'
                  : 'text-obsidian-500 hover:text-obsidian-300 bg-surface-secondary border border-surface-border'
              }`}
              title="Destacar nota"
            >
              <Star className={`w-3.5 h-3.5 ${editorStarred ? 'fill-current' : ''}`} />
            </button>

            {/* Markdown quick format buttons */}
            <div className="flex items-center space-x-0.5 bg-surface-secondary p-0.5 rounded border border-surface-border">
              <button
                onClick={() => insertFormatting('**', '**')}
                className="p-1 rounded text-obsidian-400 hover:text-white hover:bg-surface-hover transition-fast"
                title="Negrita"
              >
                <Bold className="w-3 h-3" />
              </button>
              <button
                onClick={() => insertFormatting('*', '*')}
                className="p-1 rounded text-obsidian-400 hover:text-white hover:bg-surface-hover transition-fast"
                title="Cursiva"
              >
                <Italic className="w-3 h-3" />
              </button>
              <button
                onClick={() => insertFormatting('# ')}
                className="p-1 rounded text-obsidian-400 hover:text-white hover:bg-surface-hover transition-fast"
                title="Encabezado"
              >
                <Heading className="w-3 h-3" />
              </button>
              <button
                onClick={() => insertFormatting('- ')}
                className="p-1 rounded text-obsidian-400 hover:text-white hover:bg-surface-hover transition-fast"
                title="Lista"
              >
                <List className="w-3 h-3" />
              </button>
              <button
                onClick={() => insertFormatting('- [ ] ')}
                className="p-1 rounded text-obsidian-400 hover:text-white hover:bg-surface-hover transition-fast"
                title="Tarea"
              >
                <CheckSquare className="w-3 h-3" />
              </button>
              <button
                onClick={() => insertFormatting('> ')}
                className="p-1 rounded text-obsidian-400 hover:text-white hover:bg-surface-hover transition-fast"
                title="Cita"
              >
                <Quote className="w-3 h-3" />
              </button>
              <button
                onClick={() => insertFormatting('`', '`')}
                className="p-1 rounded text-obsidian-400 hover:text-white hover:bg-surface-hover transition-fast"
                title="Código"
              >
                <Code className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Split / Edit / Preview Mode */}
            <div className="flex items-center space-x-0.5 bg-surface-secondary p-0.5 rounded border border-surface-border">
              <button
                onClick={() => setEditorMode('edit')}
                className={`px-2 py-0.5 rounded text-xs transition-fast ${
                  editorMode === 'edit'
                    ? 'bg-obsidian-100 text-obsidian-950 font-bold'
                    : 'text-obsidian-400 hover:text-obsidian-200'
                }`}
                title="Solo Editor"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setEditorMode('split')}
                className={`px-2 py-0.5 rounded text-xs transition-fast ${
                  editorMode === 'split'
                    ? 'bg-obsidian-100 text-obsidian-950 font-bold'
                    : 'text-obsidian-400 hover:text-obsidian-200'
                }`}
                title="Vista Dividida"
              >
                <Columns className="w-3 h-3" />
              </button>
              <button
                onClick={() => setEditorMode('preview')}
                className={`px-2 py-0.5 rounded text-xs transition-fast ${
                  editorMode === 'preview'
                    ? 'bg-obsidian-100 text-obsidian-950 font-bold'
                    : 'text-obsidian-400 hover:text-obsidian-200'
                }`}
                title="Solo Previsualización"
              >
                <Eye className="w-3 h-3" />
              </button>
              <div className="px-1">
                <HotkeyBadge actionId="journal_cycle_preview" variant="subtle" />
              </div>
            </div>

            {/* Zen Mode Button */}
            <button
              onClick={() => setZenMode(!isZenMode)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs border transition-fast ${
                isZenMode
                  ? 'bg-obsidian-100 text-obsidian-950 font-bold border-transparent'
                  : 'bg-surface-secondary text-obsidian-300 border-surface-border hover:text-white'
              }`}
              title="Modo Zen de Escritura"
            >
              {isZenMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              <span className="text-[11px] font-mono">Zen</span>
              <HotkeyBadge actionId="journal_toggle_zen" variant="subtle" />
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-1.5 px-3 py-1 bg-obsidian-100 hover:bg-white text-obsidian-950 font-semibold text-xs rounded transition-fast disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
              <HotkeyBadge actionId="journal_save" variant="accent" />
            </button>
          </div>
        </div>

        {/* Title, Case Link and Tags Input Header */}
        <div className="px-6 py-3 border-b border-surface-borderSubtle bg-surface-primary space-y-2">
          <input
            type="text"
            placeholder="Título de la nota..."
            value={editorTitle}
            onChange={(e) => setEditorTitle(e.target.value)}
            className="w-full bg-transparent text-lg font-bold text-obsidian-100 placeholder-obsidian-600 focus:outline-none tracking-tight"
          />

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Case linkage */}
            <div className="flex items-center space-x-2">
              <span className="text-obsidian-500 font-mono text-[10px] uppercase">Proyecto:</span>
              <Dropdown
                value={editorCaseId}
                onChange={setEditorCaseId}
                ariaLabel="Proyecto del apunte"
                className="flex-1"
                options={[
                  { value: '', label: 'Sin vincular a proyecto' },
                  ...cases.map((c) => ({
                    value: c.id,
                    label: `${c.title} (${c.client_name})`,
                  })),
                ]}
              />
            </div>

            {/* Tags input */}
            <div className="flex items-center space-x-2">
              <span className="text-obsidian-500 font-mono text-[10px] uppercase">Etiquetas:</span>
              <input
                type="text"
                placeholder="reunión, avance, estrategia (separadas por coma)"
                value={editorTags}
                onChange={(e) => setEditorTags(e.target.value)}
                className="flex-1 bg-surface-secondary border border-surface-border rounded px-2 py-1 text-xs text-obsidian-300 placeholder-obsidian-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Markdown Editor / Preview Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Pane */}
          {(editorMode === 'edit' || editorMode === 'split') && (
            <div
              className={`${
                editorMode === 'split' ? 'w-1/2 border-r border-surface-border' : 'w-full'
              } h-full p-6 bg-obsidian-950 overflow-y-auto`}
            >
              <textarea
                id="journalTextarea"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="Comienza a redactar tu bitácora en Markdown..."
                className="w-full h-full bg-transparent text-obsidian-200 placeholder-obsidian-600 font-mono text-xs leading-relaxed focus:outline-none resize-none"
              />
            </div>
          )}

          {/* Live Markdown Preview Pane */}
          {(editorMode === 'preview' || editorMode === 'split') && (
            <div
              className={`${
                editorMode === 'split' ? 'w-1/2' : 'w-full'
              } h-full p-6 bg-surface-primary overflow-y-auto select-text text-obsidian-200`}
            >
              <article className="prose prose-invert prose-xs max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-financial-positiveText prose-code:text-obsidian-300 prose-code:bg-surface-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-blockquote:border-l-2 prose-blockquote:border-obsidian-500 prose-blockquote:text-obsidian-400">
                <ReactMarkdown>{editorContent || '*Sin contenido para previsualizar.*'}</ReactMarkdown>
              </article>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
