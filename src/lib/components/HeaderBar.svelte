<script lang="ts">
  import { 
    setAlwaysOnTop, 
    setIgnoreMouseEvents, 
    setPresetSize, 
    minimizeWindow, 
    closeWindow,
    startDragging
  } from '../windowController';
  import type { LiveStatus } from '../types';
  import { type UserPreferences, savePreferences } from '../preferences';
  import { ttsService } from '../tts';
  import { 
    Ghost, 
    Pin, 
    Lock, 
    SlidersHorizontal, 
    Minus, 
    X, 
    Eye, 
    Maximize2,
    Check,
    Speech
  } from '@lucide/svelte';

  let { 
    isGhostMode = $bindable(false),
    isAlwaysOnTop = $bindable(true),
    isClickThrough = $bindable(false),
    liveStatus = 'DISCONNECTED',
    viewerCount = 0,
    targetUsername = '',
    prefs = $bindable(),
    onToggleSettings
  }: { 
    isGhostMode: boolean;
    isAlwaysOnTop: boolean;
    isClickThrough: boolean;
    liveStatus: LiveStatus;
    viewerCount: number;
    targetUsername: string;
    prefs: UserPreferences;
    onToggleSettings: () => void;
  } = $props();

  let showPresetMenu = $state(false);

  async function handleToggleGhost() {
    isGhostMode = !isGhostMode;
  }

  async function handleTogglePin() {
    isAlwaysOnTop = !isAlwaysOnTop;
    await setAlwaysOnTop(isAlwaysOnTop);
  }

  async function handleToggleClickThrough() {
    isClickThrough = !isClickThrough;
    await setIgnoreMouseEvents(isClickThrough);
  }

  function handleToggleTts() {
    prefs.ttsEnabled = !prefs.ttsEnabled;
    savePreferences(prefs);
    if (!prefs.ttsEnabled) {
      ttsService.stop();
    }
  }

  async function handleSelectPreset(w: number, h: number, e: MouseEvent) {
    e.stopPropagation();
    showPresetMenu = false;
    await setPresetSize(w, h);
  }

  function handleHeaderMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('button, input, select, .no-drag')) return;
    startDragging();
  }
</script>

<header 
  role="toolbar"
  tabindex="-1"
  class="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/85 backdrop-blur-xl border-b border-white/8 select-none shrink-0 transition-colors relative z-40"
>
  <!-- Draggable Stream info & Title (Drag region isolated here) -->
  <div 
    role="presentation"
    data-tauri-drag-region
    onmousedown={handleHeaderMouseDown}
    class="flex items-center gap-2 overflow-hidden flex-1 min-w-0 mr-2 cursor-move py-0.5"
  >
    <!-- Status Indicator Dot -->
    <div class="relative flex items-center justify-center w-2 h-2 shrink-0 pointer-events-none">
      {#if liveStatus === 'CONNECTED'}
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
      {:else if liveStatus === 'CONNECTING'}
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
      {:else}
        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-500"></span>
      {/if}
    </div>

    <!-- Title & Streamer Handle -->
    <div class="flex flex-col truncate leading-tight pointer-events-none">
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] font-bold text-slate-200 tracking-wider uppercase font-mono">
          TikZient
        </span>
        {#if liveStatus === 'CONNECTED' && viewerCount > 0 && prefs.viewsOpacity > 0}
          <div 
            style="background-color: rgba(244, 63, 94, {(prefs.viewsOpacity / 100) * 0.25}); opacity: {Math.max(0.1, prefs.viewsOpacity / 100)};"
            class="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-rose-300 text-[10px] font-mono font-medium"
          >
            <Eye size={9} strokeWidth={2.5} class="text-rose-400" />
            <span>{viewerCount.toLocaleString()}</span>
          </div>
        {/if}
      </div>
      {#if targetUsername}
        <span class="text-[10px] text-slate-400 truncate font-mono">@{targetUsername}</span>
      {/if}
    </div>
  </div>

  <!-- Actions & Window Controls (Completely Non-Draggable to ensure 100% click reliability) -->
  <div 
    role="toolbar"
    tabindex="-1"
    data-tauri-drag-region="false"
    onmousedown={(e) => e.stopPropagation()}
    class="flex items-center gap-0.5 shrink-0 no-drag"
  >
    <!-- Presets Menu Button -->
    <div class="relative">
      <button 
        type="button"
        onclick={(e) => { e.stopPropagation(); showPresetMenu = !showPresetMenu; }}
        title="Window Size Presets"
        class="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/8 transition-colors flex items-center cursor-pointer {showPresetMenu ? 'bg-white/10 text-white' : ''}"
      >
        <Maximize2 size={13} strokeWidth={2} />
      </button>

      {#if showPresetMenu}
        <!-- Backdrop to close preset menu on outside click -->
        <div 
          role="presentation"
          class="fixed inset-0 z-40" 
          onclick={() => showPresetMenu = false}
        ></div>

        <div 
          role="menu"
          tabindex="-1"
          data-tauri-drag-region="false"
          onmousedown={(e) => e.stopPropagation()}
          class="absolute right-0 top-full mt-1.5 w-40 bg-slate-900 border border-white/12 rounded-lg shadow-2xl py-1 z-50 text-[11px] backdrop-blur-2xl animate-message-in"
        >
          <div class="px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-400 font-bold border-b border-white/8 font-mono">
            Size Presets
          </div>
          <button 
            type="button"
            onclick={(e) => handleSelectPreset(280, 420, e)}
            class="w-full text-left px-2.5 py-1.5 hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer flex justify-between items-center"
          >
            <span class="font-medium">Compact</span>
            <span class="text-slate-400 font-mono text-[10px]">280×420</span>
          </button>
          <button 
            type="button"
            onclick={(e) => handleSelectPreset(380, 600, e)}
            class="w-full text-left px-2.5 py-1.5 hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer flex justify-between items-center"
          >
            <span class="font-medium">Standard</span>
            <span class="text-slate-400 font-mono text-[10px]">380×600</span>
          </button>
          <button 
            type="button"
            onclick={(e) => handleSelectPreset(480, 720, e)}
            class="w-full text-left px-2.5 py-1.5 hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer flex justify-between items-center"
          >
            <span class="font-medium">Wide</span>
            <span class="text-slate-400 font-mono text-[10px]">480×720</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Toggle Ghost Mode (Hide Title Bar, show only chat & views) -->
    <button 
      type="button"
      onclick={handleToggleGhost}
      title={isGhostMode ? `Exit Ghost Mode (${prefs.keybinds.toggleGhostMode})` : `Ghost Mode: Hide Title Bar (${prefs.keybinds.toggleGhostMode})`}
      class="p-1 rounded-md transition-colors cursor-pointer {isGhostMode ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40' : 'text-slate-400 hover:text-white hover:bg-white/8'}"
    >
      <Ghost size={13} strokeWidth={2} />
    </button>

    <!-- Always On Top (Pin) -->
    <button 
      type="button"
      onclick={handleTogglePin}
      title={isAlwaysOnTop ? `Always On Top: Active (${prefs.keybinds.togglePin})` : `Always On Top: Off (${prefs.keybinds.togglePin})`}
      class="p-1 rounded-md transition-colors cursor-pointer {isAlwaysOnTop ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' : 'text-slate-400 hover:text-white hover:bg-white/8'}"
    >
      <Pin size={13} strokeWidth={2} />
    </button>

    <!-- Click Through Toggle (Pass-through cursor) -->
    <button 
      type="button"
      onclick={handleToggleClickThrough}
      title={isClickThrough ? `Mouse Pass-Through Active (${prefs.keybinds.toggleClickThrough})` : `Enable Mouse Pass-Through (${prefs.keybinds.toggleClickThrough})`}
      class="p-1 rounded-md transition-colors cursor-pointer {isClickThrough ? 'bg-rose-500/25 text-rose-300 border border-rose-400/30 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-white/8'}"
    >
      <Lock size={13} strokeWidth={2} />
    </button>

    <!-- TTS (Text-to-Speech) Toggle for Comments -->
    <button 
      type="button"
      onclick={handleToggleTts}
      title={prefs.ttsEnabled ? `TTS Komentar (Google ${prefs.ttsLanguage.toUpperCase()} - ${prefs.ttsModel === 'female' ? 'Wanita' : 'Pria'}): Aktif (Klik untuk matikan)` : 'TTS Komentar (Google Voice): Nonaktif (Klik untuk aktifkan)'}
      class="p-1 rounded-md transition-colors cursor-pointer {prefs.ttsEnabled ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/8'}"
    >
      <Speech size={13} strokeWidth={2} />
    </button>

    <!-- Settings Drawer Toggle -->
    <button 
      type="button"
      onclick={onToggleSettings}
      title={`Settings & Keybinds (${prefs.keybinds.toggleSettings})`}
      class="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
    >
      <SlidersHorizontal size={13} strokeWidth={2} />
    </button>

    <div class="h-3 w-px bg-white/10 mx-0.5"></div>

    <!-- Window Minimize -->
    <button 
      type="button"
      onclick={minimizeWindow}
      title="Minimize Window"
      class="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
    >
      <Minus size={13} strokeWidth={2} />
    </button>

    <!-- Window Close -->
    <button 
      type="button"
      onclick={closeWindow}
      title="Close Application"
      class="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
    >
      <X size={13} strokeWidth={2} />
    </button>
  </div>
</header>
