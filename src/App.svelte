<script lang="ts">
  import { onMount } from 'svelte';
  import HeaderBar from './lib/components/HeaderBar.svelte';
  import SettingsDrawer from './lib/components/SettingsDrawer.svelte';
  import VirtualCommentList from './lib/components/VirtualCommentList.svelte';
  import { SidecarClient, type SidecarState } from './lib/sidecarClient';
  import { 
    setIgnoreMouseEvents, 
    setAlwaysOnTop, 
    setGlobalHotkeys, 
    onGlobalHotkey 
  } from './lib/windowController';
  import { loadPreferences, type UserPreferences } from './lib/preferences';
  import { playGiftChime } from './lib/soundAlert';
  import { ttsService } from './lib/tts';
  import type { CommentItem } from './lib/types';
  import { Lock, Eye, Ghost } from '@lucide/svelte';

  // App State & Streamer Preferences
  let sidecar = new SidecarClient();
  let comments: CommentItem[] = $state([]);
  let prefs: UserPreferences = $state(loadPreferences());

  let sidecarState: SidecarState = $state({
    isWsConnected: false,
    liveStatus: 'DISCONNECTED',
    targetUsername: '',
    viewerCount: 0,
    commentsPerSec: 0,
    totalComments: 0,
    totalGifts: 0,
    totalDiamonds: 0,
    errorMessage: null,
  });

  // UI Control State
  let isGhostMode = $state(true);
  let isAlwaysOnTop = $state(true);
  let isClickThrough = $state(false);
  let showSettings = $state(false);
  let filterType: 'all' | 'chat' | 'gift' = $state('all');
  let searchQuery = $state('');
  let isTopHovered = $state(false);

  let unsubscribe: (() => void) | null = null;
  let unlistenHotkey: (() => void) | null = null;

  async function handleToggleClickThrough() {
    isClickThrough = !isClickThrough;
    await setIgnoreMouseEvents(isClickThrough);
  }

  async function handleToggleGhost() {
    isGhostMode = !isGhostMode;
  }

  async function handleTogglePin() {
    isAlwaysOnTop = !isAlwaysOnTop;
    await setAlwaysOnTop(isAlwaysOnTop);
  }

  function handleToggleSettings() {
    showSettings = !showSettings;
  }

  onMount(() => {
    unsubscribe = sidecar.subscribe((newComments, newState) => {
      // Sound alert on new gift events
      if (prefs.soundAlerts && newComments.length > comments.length) {
        const added = newComments.slice(comments.length);
        const hasGift = added.some(i => i.type === 'gift' && (i.diamondCount || 0) >= prefs.minGiftDiamonds);
        if (hasGift) {
          playGiftChime(prefs.soundVolume);
        }
      }

      // TTS alert ONLY for comments (Text-to-Speech bahasa Indonesia)
      if (prefs.ttsEnabled && newComments.length > comments.length) {
        const added = newComments.slice(comments.length);
        for (const item of added) {
          // HANYA UNTUK KOMENTAR SAJA (chat)
          if (item.type === 'chat' && item.comment) {
            ttsService.speakComment(item.comment, {
              volume: prefs.ttsVolume,
              rate: prefs.ttsRate,
              language: prefs.ttsLanguage,
              model: prefs.ttsModel,
              nickname: item.nickname,
              includeNickname: prefs.ttsIncludeNickname,
            });
          }
        }
      }

      comments = newComments;
      sidecarState = newState;
    });

    // Register initial global hotkeys with Rust backend
    setGlobalHotkeys(
      prefs.keybinds.toggleClickThrough,
      prefs.keybinds.toggleGhostMode,
      prefs.keybinds.togglePin,
      prefs.keybinds.toggleSettings
    );

    // Listen to global Windows hotkeys (fired system-wide from any app or full-screen game)
    onGlobalHotkey((action) => {
      if (action === 'clickThrough') {
        handleToggleClickThrough();
      } else if (action === 'ghostMode') {
        handleToggleGhost();
      } else if (action === 'pin') {
        handleTogglePin();
      } else if (action === 'settings') {
        handleToggleSettings();
      }
    }).then((un) => {
      unlistenHotkey = un;
    });

    // In-window keydown listener (when focused)
    const handleKeyDown = async (e: KeyboardEvent) => {
      const matchKeybind = (binding: string) => {
        const parts = binding.toLowerCase().split('+').map(p => p.trim());
        const hasAlt = parts.includes('alt');
        const hasCtrl = parts.includes('ctrl') || parts.includes('control');
        const hasShift = parts.includes('shift');
        const mainKey = parts.find(p => !['alt', 'ctrl', 'control', 'shift'].includes(p)) || '';

        return e.altKey === hasAlt && 
               e.ctrlKey === hasCtrl && 
               e.shiftKey === hasShift && 
               e.key.toLowerCase() === mainKey.toLowerCase();
      };

      if (matchKeybind(prefs.keybinds.toggleClickThrough)) {
        e.preventDefault();
        await handleToggleClickThrough();
      } else if (matchKeybind(prefs.keybinds.toggleGhostMode)) {
        e.preventDefault();
        await handleToggleGhost();
      } else if (matchKeybind(prefs.keybinds.togglePin)) {
        e.preventDefault();
        await handleTogglePin();
      } else if (matchKeybind(prefs.keybinds.toggleSettings)) {
        e.preventDefault();
        handleToggleSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (unlistenHotkey) unlistenHotkey();
      if (unsubscribe) unsubscribe();
      sidecar.destroy();
      ttsService.stop();
    };
  });

  // Watch for TTS toggle off to immediately silence speech
  $effect(() => {
    if (!prefs.ttsEnabled) {
      ttsService.stop();
    }
  });

  // Reactive message filtering
  let filteredComments = $derived.by(() => {
    let result = comments;
    if (filterType === 'chat') {
      result = result.filter(c => c.type === 'chat');
    } else if (filterType === 'gift') {
      result = result.filter(c => c.type === 'gift');
    }

    if (!prefs.showLikes) {
      result = result.filter(c => c.type !== 'like');
    }
    if (!prefs.showMembers) {
      result = result.filter(c => c.type !== 'member');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        (c.comment && c.comment.toLowerCase().includes(q)) ||
        c.nickname.toLowerCase().includes(q) ||
        c.uniqueId.toLowerCase().includes(q)
      );
    }
    return result;
  });

  // Background style based on Ghost Mode and opacity
  let containerBgStyle = $derived(
    `background-color: rgba(2, 6, 23, ${prefs.bgOpacity / 100});`
  );
</script>

<!-- Main Container with Dynamic Transparency & Resizable Boundaries -->
<div 
  class="relative h-screen w-screen flex flex-col overflow-hidden transition-colors duration-150 select-none border-none outline-none shadow-none rounded-none {prefs.enableBlur ? 'backdrop-blur-md' : ''}"
  style={containerBgStyle}
>
  <!-- Ghost Mode: Top Hover Detection Zone to Reveal Header on Demand -->
  {#if isGhostMode}
    <div 
      role="toolbar"
      tabindex="-1"
      onmouseenter={() => isTopHovered = true}
      class="absolute top-0 left-0 right-0 h-4 z-40 pointer-events-auto"
    ></div>
  {/if}

  <!-- Header Bar: Hidden in Ghost Mode unless hovered or drawer is open -->
  {#if !isGhostMode || isTopHovered || showSettings}
    <div 
      role="region"
      aria-label="Window Header Region"
      onmouseleave={() => isTopHovered = false}
      class="transition-transform duration-200"
    >
      <HeaderBar 
        bind:isGhostMode
        bind:isAlwaysOnTop
        bind:isClickThrough
        liveStatus={sidecarState.liveStatus}
        viewerCount={sidecarState.viewerCount}
        targetUsername={sidecarState.targetUsername}
        bind:prefs
        onToggleSettings={handleToggleSettings}
      />
    </div>
  {/if}

  <!-- Ghost Mode Minimal Floating Viewer Pill (When header is hidden & viewsOpacity > 0) -->
  {#if isGhostMode && !isTopHovered && !showSettings && prefs.viewsOpacity > 0}
    <div 
      style="background-color: rgba(2, 6, 23, {prefs.viewsOpacity / 100}); border-color: rgba(255, 255, 255, {(prefs.viewsOpacity / 100) * 0.15}); opacity: {Math.max(0.1, prefs.viewsOpacity / 100)};"
      class="absolute top-2 right-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border text-rose-300 text-[11px] font-mono shadow-lg select-none animate-message-in"
    >
      <Eye size={11} strokeWidth={2.5} class="text-rose-400" />
      <span class="font-bold">{sidecarState.viewerCount.toLocaleString()}</span>
      <button 
        onclick={handleToggleGhost}
        title="Exit Ghost Mode ({prefs.keybinds.toggleGhostMode})"
        class="text-slate-400 hover:text-white p-0.5 ml-1 transition-colors cursor-pointer"
      >
        <Ghost size={11} />
      </button>
    </div>
  {/if}

  <!-- Customizable Settings & Option Drawer -->
  {#if showSettings}
    <SettingsDrawer 
      {sidecarState}
      bind:prefs
      bind:filterType
      bind:searchQuery
      onConnect={(username) => sidecar.connect(username)}
      onDisconnect={() => sidecar.disconnect()}
      onStartDemo={() => sidecar.startMock()}
      onClearChat={() => {
        sidecar.clearComments();
        ttsService.stop();
      }}
      onClose={() => showSettings = false}
    />
  {/if}

  <!-- Virtual Scroll Area (Responsive to Resizing & Dynamic Height Calculation) -->
  <main class="flex-1 w-full min-h-0 overflow-hidden relative">
    <VirtualCommentList 
      items={filteredComments} 
      {prefs}
    />
  </main>
</div>
