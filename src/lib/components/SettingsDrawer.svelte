<script lang="ts">
  import { untrack } from 'svelte';
  import type { SidecarState } from '../sidecarClient';
  import { 
    type UserPreferences, 
    USERNAME_COLOR_PRESETS,
    savePreferences,
    defaultPreferences
  } from '../preferences';
  import { playGiftChime } from '../soundAlert';
  import { ttsService } from '../tts';
  import { setGlobalHotkeys } from '../windowController';
  import { 
    Play, 
    X, 
    Search, 
    Volume2, 
    Palette, 
    Check, 
    Keyboard,
    RotateCcw,
    Speech
  } from '@lucide/svelte';

  let {
    sidecarState,
    prefs = $bindable(),
    filterType = $bindable('all'),
    searchQuery = $bindable(''),
    onConnect,
    onDisconnect,
    onStartDemo,
    onClearChat,
    onClose
  }: {
    sidecarState: SidecarState;
    prefs: UserPreferences;
    filterType: 'all' | 'chat' | 'gift';
    searchQuery: string;
    onConnect: (username: string) => void;
    onDisconnect: () => void;
    onStartDemo: () => void;
    onClearChat: () => void;
    onClose: () => void;
  } = $props();

  let inputUsername = $state('');
  let activeTab: 'connection' | 'appearance' | 'filters' | 'keybinds' = $state('connection');

  $effect(() => {
    const target = sidecarState.targetUsername;
    untrack(() => {
      if (target && !inputUsername) {
        inputUsername = target;
      }
    });
  });

  function handleConnect() {
    if (inputUsername.trim()) {
      onConnect(inputUsername.trim());
    }
  }

  function handlePrefChange() {
    savePreferences(prefs);
  }

  async function handleKeybindChange() {
    savePreferences(prefs);
    await setGlobalHotkeys(
      prefs.keybinds.toggleClickThrough,
      prefs.keybinds.toggleGhostMode,
      prefs.keybinds.togglePin,
      prefs.keybinds.toggleSettings
    );
  }

  function resetKeybinds() {
    prefs.keybinds = { ...defaultPreferences.keybinds };
    handleKeybindChange();
  }

  function testSound() {
    playGiftChime(prefs.soundVolume);
  }

  function handleTtsToggle() {
    savePreferences(prefs);
    if (!prefs.ttsEnabled) {
      ttsService.stop();
    }
  }

  function handleTestTts() {
    ttsService.testSpeech(undefined, {
      volume: prefs.ttsVolume,
      rate: prefs.ttsRate,
      language: prefs.ttsLanguage,
      model: prefs.ttsModel,
    });
  }
</script>

<div class="bg-slate-950/95 backdrop-blur-2xl border-b border-white/10 text-slate-200 text-xs flex flex-col select-none animate-message-in">
  <!-- Drawer Header & Tab Navigation -->
  <div class="flex items-center justify-between px-3 py-1.5 border-b border-white/6 bg-slate-900/40">
    <div class="flex items-center gap-1">
      <button 
        onclick={() => activeTab = 'connection'}
        class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer {activeTab === 'connection' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}"
      >
        Live Stream
      </button>
      <button 
        onclick={() => activeTab = 'appearance'}
        class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer {activeTab === 'appearance' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}"
      >
        Appearance
      </button>
      <button 
        onclick={() => activeTab = 'filters'}
        class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer {activeTab === 'filters' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}"
      >
        Alerts & Filter
      </button>
      <button 
        onclick={() => activeTab = 'keybinds'}
        class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 {activeTab === 'keybinds' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}"
      >
        <Keyboard size={10} strokeWidth={2} />
        <span>Keybinds</span>
      </button>
    </div>

    <button 
      onclick={onClose}
      title="Close drawer"
      class="text-slate-400 hover:text-white p-1 rounded hover:bg-white/8 transition-colors cursor-pointer"
    >
      <X size={13} strokeWidth={2} />
    </button>
  </div>

  <div class="p-3 max-h-[360px] overflow-y-auto flex flex-col gap-3 no-scrollbar" style="scrollbar-width: none; -ms-overflow-style: none;">
    <!-- TAB 1: CONNECTION & STATUS -->
    {#if activeTab === 'connection'}
      <div class="flex flex-col gap-2">
        <div class="flex gap-1.5">
          <div class="relative flex-1">
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold text-xs">@</span>
            <input 
              type="text" 
              bind:value={inputUsername}
              placeholder="Streamer username (e.g. rrqr7tatsumaki)"
              onkeydown={(e) => e.key === 'Enter' && handleConnect()}
              class="w-full pl-6 pr-2.5 py-1.5 rounded-md bg-slate-900 border border-white/10 focus:border-sky-500 focus:outline-none text-white text-[12px] font-mono placeholder-slate-500 transition-colors"
            />
          </div>

          {#if sidecarState.liveStatus === 'CONNECTED' || sidecarState.liveStatus === 'CONNECTING'}
            <button 
              onclick={onDisconnect}
              class="px-3 py-1.5 rounded-md bg-rose-600/80 hover:bg-rose-500 text-white font-medium text-[11px] transition-colors cursor-pointer shrink-0"
            >
              Disconnect
            </button>
          {:else}
            <button 
              onclick={handleConnect}
              class="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium text-[11px] transition-colors cursor-pointer shrink-0"
            >
              Connect
            </button>
          {/if}

          <button 
            onclick={onStartDemo}
            title="Launch live stream test simulator"
            class="px-2.5 py-1.5 rounded-md bg-white/6 hover:bg-white/12 border border-white/10 text-slate-200 font-medium text-[11px] transition-colors cursor-pointer shrink-0 flex items-center gap-1"
          >
            <Play size={11} strokeWidth={2.5} class="text-emerald-400" />
            <span>Demo</span>
          </button>
        </div>

        {#if sidecarState.errorMessage}
          <div class="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-md px-2.5 py-1.5 flex items-center gap-1.5 font-mono">
            <span>{sidecarState.errorMessage}</span>
          </div>
        {/if}

        <!-- Stream Performance Statistics -->
        <div class="grid grid-cols-4 gap-1.5 bg-slate-900/60 p-2 rounded-lg border border-white/6 mt-1 font-mono">
          <div class="flex flex-col text-center">
            <span class="text-[9px] uppercase tracking-wider text-slate-400">Rate</span>
            <span class="font-bold text-sky-400 text-[12px]">{sidecarState.commentsPerSec}/s</span>
          </div>
          <div class="flex flex-col text-center">
            <span class="text-[9px] uppercase tracking-wider text-slate-400">Chats</span>
            <span class="font-bold text-slate-200 text-[12px]">{sidecarState.totalComments.toLocaleString()}</span>
          </div>
          <div class="flex flex-col text-center">
            <span class="text-[9px] uppercase tracking-wider text-slate-400">Gifts</span>
            <span class="font-bold text-amber-300 text-[12px]">{sidecarState.totalGifts.toLocaleString()}</span>
          </div>
          <div class="flex flex-col text-center">
            <span class="text-[9px] uppercase tracking-wider text-slate-400">Diamonds</span>
            <span class="font-bold text-pink-400 text-[12px]">{sidecarState.totalDiamonds.toLocaleString()}</span>
          </div>
        </div>
      </div>

    <!-- TAB 2: APPEARANCE & TRANSPARENCY -->
    {:else if activeTab === 'appearance'}
      <div class="flex flex-col gap-3">
        <!-- Username Color Picker -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-[11px] text-slate-300">
            <span class="font-medium flex items-center gap-1.5">
              <Palette size={12} strokeWidth={2} class="text-sky-400" />
              Username Color Theme
            </span>
            <div class="flex items-center gap-1.5 font-mono text-[10px]">
              <div class="w-2.5 h-2.5 rounded-full border border-white/20" style="background-color: {prefs.usernameColor};"></div>
              <span>{prefs.usernameColor}</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            {#each USERNAME_COLOR_PRESETS as preset}
              <button 
                onclick={() => { prefs.usernameColor = preset.hex; handlePrefChange(); }}
                title={preset.name}
                class="w-6 h-6 rounded-md border flex items-center justify-center transition-transform active:scale-90 cursor-pointer {prefs.usernameColor === preset.hex ? 'border-white scale-110 shadow-sm' : 'border-white/20 hover:scale-105'}"
                style="background-color: {preset.hex};"
              >
                {#if prefs.usernameColor === preset.hex}
                  <Check size={12} strokeWidth={3} class="text-slate-950" />
                {/if}
              </button>
            {/each}

            <input 
              type="color" 
              bind:value={prefs.usernameColor}
              onchange={handlePrefChange}
              title="Custom Hex Color"
              class="w-6 h-6 rounded-md border border-white/20 bg-transparent cursor-pointer p-0"
            />
          </div>
        </div>

        <!-- Typography & Density Controls -->
        <div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/6">
          <!-- Font Size Scale -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-slate-400 font-medium">Font Scale</span>
            <div class="flex bg-slate-900 rounded-md p-0.5 border border-white/8 font-mono">
              {#each ['xs', 'sm', 'base', 'lg'] as size}
                <button 
                  onclick={() => { prefs.fontSize = size as any; handlePrefChange(); }}
                  class="flex-1 py-0.5 rounded text-[10px] font-medium uppercase transition-colors {prefs.fontSize === size ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}"
                >
                  {size}
                </button>
              {/each}
            </div>
          </div>

          <!-- Kerapatan Pesan (Density) -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-slate-400 font-medium">Kerapatan Pesan (Jarak Bubble)</span>
            <div class="flex bg-slate-900 rounded-md p-0.5 border border-white/8">
              <button 
                onclick={() => { prefs.density = 'compact'; handlePrefChange(); }}
                title="Rapat (Hemat ruang, pesan padat)"
                class="flex-1 py-1 rounded text-[10px] font-medium transition-colors {prefs.density === 'compact' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}"
              >
                Rapat
              </button>
              <button 
                onclick={() => { prefs.density = 'normal'; handlePrefChange(); }}
                title="Sedang (Standar seimbang & nyaman)"
                class="flex-1 py-1 rounded text-[10px] font-medium transition-colors {prefs.density === 'normal' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}"
              >
                Sedang
              </button>
              <button 
                onclick={() => { prefs.density = 'relaxed'; handlePrefChange(); }}
                title="Lega (Spasi luas & santai)"
                class="flex-1 py-1 rounded text-[10px] font-medium transition-colors {prefs.density === 'relaxed' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}"
              >
                Lega
              </button>
            </div>
          </div>
        </div>

        <!-- Readability Outline -->
        <div class="flex flex-col gap-1 pt-2 border-t border-white/6">
          <span class="text-[10px] text-slate-400 font-medium">Text Outline Contrast</span>
          <div class="flex bg-slate-900 rounded-md p-0.5 border border-white/8">
            <button 
              onclick={() => { prefs.textOutline = 'none'; handlePrefChange(); }}
              class="flex-1 py-0.5 rounded text-[10px] transition-colors {prefs.textOutline === 'none' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}"
            >
              Normal
            </button>
            <button 
              onclick={() => { prefs.textOutline = 'subtle'; handlePrefChange(); }}
              class="flex-1 py-0.5 rounded text-[10px] transition-colors {prefs.textOutline === 'subtle' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}"
            >
              Subtle Shadow
            </button>
            <button 
              onclick={() => { prefs.textOutline = 'high-contrast'; handlePrefChange(); }}
              class="flex-1 py-0.5 rounded text-[10px] transition-colors {prefs.textOutline === 'high-contrast' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}"
            >
              High Contrast Stroke
            </button>
          </div>
        </div>

        <!-- Dedicated Opacity Sliders (All 0% - 100%) -->
        <div class="flex flex-col gap-2.5 pt-2 border-t border-white/6">
          <!-- Bubble Chat Opacity -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-[11px] text-slate-300">
              <span class="font-medium">Bubble Chat Card Opacity</span>
              <span class="font-mono text-sky-400 text-[10px]">{prefs.bubbleOpacity}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              bind:value={prefs.bubbleOpacity}
              onchange={handlePrefChange}
              class="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <!-- Text Opacity -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-[11px] text-slate-300">
              <span class="font-medium">Text Transparency</span>
              <span class="font-mono text-sky-400 text-[10px]">{prefs.textOpacity}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              bind:value={prefs.textOpacity}
              onchange={handlePrefChange}
              class="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <!-- Views Indicator Opacity -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-[11px] text-slate-300">
              <span class="font-medium">Views / Viewer Count Opacity</span>
              <span class="font-mono text-sky-400 text-[10px]">{prefs.viewsOpacity}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              bind:value={prefs.viewsOpacity}
              onchange={handlePrefChange}
              class="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <!-- Window Background Opacity -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-[11px] text-slate-300">
              <span class="font-medium">Window Background Opacity</span>
              <span class="font-mono text-sky-400 text-[10px]">{prefs.bgOpacity}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              bind:value={prefs.bgOpacity}
              onchange={handlePrefChange}
              class="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        <!-- Element Visibility Toggles -->
        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/6 text-[11px]">
          <label class="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input 
              type="checkbox" 
              bind:checked={prefs.showAvatar} 
              onchange={handlePrefChange}
              class="rounded accent-sky-500"
            />
            <span>Show Avatars</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input 
              type="checkbox" 
              bind:checked={prefs.showBadges} 
              onchange={handlePrefChange}
              class="rounded accent-sky-500"
            />
            <span>Show Badges</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input 
              type="checkbox" 
              bind:checked={prefs.showTimestamp} 
              onchange={handlePrefChange}
              class="rounded accent-sky-500"
            />
            <span>Show Timestamps</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input 
              type="checkbox" 
              bind:checked={prefs.enableBlur} 
              onchange={handlePrefChange}
              class="rounded accent-sky-500"
            />
            <span>Glassmorphism Blur</span>
          </label>
        </div>
      </div>

    <!-- TAB 3: ALERTS & FILTERS -->
    {:else if activeTab === 'filters'}
      <div class="flex flex-col gap-3">
        <!-- Text-to-Speech (TTS) Settings - GOOGLE VOICE KHUSUS KOMENTAR -->
        <div class="flex flex-col gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-white/6">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-1.5 cursor-pointer text-slate-200 font-medium">
              <input 
                type="checkbox" 
                bind:checked={prefs.ttsEnabled} 
                onchange={handleTtsToggle}
                class="rounded accent-emerald-500 cursor-pointer"
              />
              <Speech size={14} strokeWidth={2.2} class="text-emerald-400" />
              <span class="text-[11px] font-semibold">TTS Komentar (Suara Google)</span>
            </label>

            {#if prefs.ttsEnabled}
              <button 
                onclick={handleTestTts}
                class="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono transition-colors cursor-pointer"
              >
                Test Suara
              </button>
            {/if}
          </div>

          <p class="text-[10px] text-slate-400 leading-tight">
            Membaca pesan komentar (chat) dengan suara Google online. <span class="text-emerald-300/90 font-medium">Hanya untuk komentar saja</span> (tidak membaca gift/like).
          </p>

          {#if prefs.ttsEnabled}
            <div class="flex flex-col gap-2 pt-1 border-t border-white/6">
              <!-- Language Selector: Indonesia vs English -->
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 text-[10px]">Bahasa:</span>
                <div class="flex gap-1 bg-slate-950 p-0.5 rounded-md border border-white/8">
                  <button
                    type="button"
                    onclick={() => { prefs.ttsLanguage = 'id'; handlePrefChange(); }}
                    class="px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer {prefs.ttsLanguage === 'id' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}"
                  >
                    🇮🇩 Indonesia
                  </button>
                  <button
                    type="button"
                    onclick={() => { prefs.ttsLanguage = 'en'; handlePrefChange(); }}
                    class="px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer {prefs.ttsLanguage === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}"
                  >
                    🇺🇸 English
                  </button>
                </div>
              </div>

              <!-- Voice Model Selector: Wanita vs Pria -->
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 text-[10px]">Model Suara:</span>
                <div class="flex gap-1 bg-slate-950 p-0.5 rounded-md border border-white/8">
                  <button
                    type="button"
                    onclick={() => { prefs.ttsModel = 'female'; handlePrefChange(); }}
                    class="px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer {prefs.ttsModel === 'female' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}"
                  >
                    👩 Wanita (Google)
                  </button>
                  <button
                    type="button"
                    onclick={() => { prefs.ttsModel = 'male'; handlePrefChange(); }}
                    class="px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer {prefs.ttsModel === 'male' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}"
                  >
                    👨 Pria (Google)
                  </button>
                </div>
              </div>

              <!-- TTS Volume -->
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-slate-400 w-16">Volume</span>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  bind:value={prefs.ttsVolume} 
                  onchange={handlePrefChange}
                  class="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span class="text-[10px] font-mono text-emerald-300 w-7 text-right">{prefs.ttsVolume}%</span>
              </div>

              <!-- TTS Speed -->
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-slate-400 w-16">Kecepatan</span>
                <input 
                  type="range" 
                  min="0.7" 
                  max="1.5" 
                  step="0.1"
                  bind:value={prefs.ttsRate} 
                  onchange={handlePrefChange}
                  class="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span class="text-[10px] font-mono text-emerald-300 w-7 text-right">{prefs.ttsRate}x</span>
              </div>

              <!-- Read Nickname toggle -->
              <label class="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[10px] pt-0.5">
                <input 
                  type="checkbox" 
                  bind:checked={prefs.ttsIncludeNickname} 
                  onchange={handlePrefChange}
                  class="rounded accent-emerald-500"
                />
                <span>Sebutkan nama akun pengirim (contoh: "Budi: Halo")</span>
              </label>
            </div>
          {/if}
        </div>

        <!-- Sound Alert Settings -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium">
              <input 
                type="checkbox" 
                bind:checked={prefs.soundAlerts} 
                onchange={handlePrefChange}
                class="rounded accent-amber-500"
              />
              <Volume2 size={13} strokeWidth={2} class="text-amber-400" />
              <span>Gift Sound Chime</span>
            </label>

            {#if prefs.soundAlerts}
              <button 
                onclick={testSound}
                class="px-2 py-0.5 rounded bg-white/6 hover:bg-white/12 text-[10px] text-amber-300 font-mono transition-colors cursor-pointer"
              >
                Test Chime
              </button>
            {/if}
          </div>

          {#if prefs.soundAlerts}
            <div class="flex items-center gap-2 pl-5">
              <span class="text-[10px] text-slate-400 w-12">Volume</span>
              <input 
                type="range" 
                min="5" 
                max="100" 
                bind:value={prefs.soundVolume} 
                onchange={handlePrefChange}
                class="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span class="text-[10px] font-mono text-amber-300 w-7 text-right">{prefs.soundVolume}%</span>
            </div>
          {/if}
        </div>

        <!-- Filter Likes & Members -->
        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/6 text-[11px]">
          <label class="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input 
              type="checkbox" 
              bind:checked={prefs.showLikes} 
              onchange={handlePrefChange}
              class="rounded accent-rose-500"
            />
            <span>Show Likes</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer text-slate-300">
            <input 
              type="checkbox" 
              bind:checked={prefs.showMembers} 
              onchange={handlePrefChange}
              class="rounded accent-emerald-500"
            />
            <span>Show Joins</span>
          </label>
        </div>

        <!-- Search & Clear -->
        <div class="flex gap-1.5 pt-2 border-t border-white/6">
          <div class="relative flex-1">
            <Search size={11} strokeWidth={2} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              bind:value={searchQuery}
              placeholder="Filter comments or nicknames..."
              class="w-full pl-6 pr-2 py-1.5 rounded-md bg-slate-900 border border-white/10 text-white text-[11px] placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
          <button 
            onclick={onClearChat}
            class="px-2.5 py-1.5 rounded-md bg-white/6 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/8 text-[11px] transition-colors cursor-pointer shrink-0"
          >
            Clear
          </button>
        </div>
      </div>

    <!-- TAB 4: KEYBINDS & SHORTCUTS -->
    {:else if activeTab === 'keybinds'}
      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between pb-1 border-b border-white/6">
          <div>
            <span class="text-[11px] font-semibold text-slate-200">Global Windows Hotkeys</span>
            <p class="text-[10px] text-slate-400">Works everywhere across games & full-screen apps without focusing window.</p>
          </div>
          <button 
            onclick={resetKeybinds}
            title="Reset to default keybinds"
            class="px-2 py-1 rounded bg-white/6 hover:bg-white/12 text-[10px] text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw size={10} />
            <span>Reset</span>
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <!-- Toggle Click-Through -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col">
              <span class="text-[11px] font-medium text-slate-300">Mouse Pass-Through</span>
              <span class="text-[9.5px] text-slate-500">Locks/unlocks mouse clicks passing through to game</span>
            </div>
            <input 
              type="text"
              bind:value={prefs.keybinds.toggleClickThrough}
              onchange={handleKeybindChange}
              class="w-24 px-2 py-1 rounded bg-slate-900 border border-white/12 text-center text-[11px] font-mono text-sky-300 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <!-- Toggle Ghost Mode -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col">
              <span class="text-[11px] font-medium text-slate-300">Ghost Mode (Hide Title Bar)</span>
              <span class="text-[9.5px] text-slate-500">Shows only chat bubbles & floating viewer count</span>
            </div>
            <input 
              type="text"
              bind:value={prefs.keybinds.toggleGhostMode}
              onchange={handleKeybindChange}
              class="w-24 px-2 py-1 rounded bg-slate-900 border border-white/12 text-center text-[11px] font-mono text-sky-300 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <!-- Toggle Always On Top -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col">
              <span class="text-[11px] font-medium text-slate-300">Always on Top (Pin)</span>
              <span class="text-[9.5px] text-slate-500">Pins overlay above all games and applications</span>
            </div>
            <input 
              type="text"
              bind:value={prefs.keybinds.togglePin}
              onchange={handleKeybindChange}
              class="w-24 px-2 py-1 rounded bg-slate-900 border border-white/12 text-center text-[11px] font-mono text-sky-300 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <!-- Toggle Settings Drawer -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col">
              <span class="text-[11px] font-medium text-slate-300">Settings Drawer</span>
              <span class="text-[9.5px] text-slate-500">Opens and closes this streamer options drawer</span>
            </div>
            <input 
              type="text"
              bind:value={prefs.keybinds.toggleSettings}
              onchange={handleKeybindChange}
              class="w-24 px-2 py-1 rounded bg-slate-900 border border-white/12 text-center text-[11px] font-mono text-sky-300 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
