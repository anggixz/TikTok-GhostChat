<script lang="ts">
  import type { CommentItem } from '../types';
  import type { UserPreferences } from '../preferences';
  import { Gift, Heart, User, Shield, Sparkles, Gem } from '@lucide/svelte';

  let { 
    item, 
    prefs 
  }: { 
    item: CommentItem; 
    prefs: UserPreferences;
  } = $props();

  let formattedTime = $derived(new Date(item.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false
  }));

  // Proportional font and avatar scale maps
  const fontConfig = {
    xs: {
      comment: 'text-[11px] leading-snug',
      nickname: 'text-[11px]',
      avatarSize: 'w-4 h-4',
      avatarInitial: 'text-[8px]',
      time: 'text-[8.5px]',
      icon: 9
    },
    sm: {
      comment: 'text-[13px] leading-snug',
      nickname: 'text-[12.5px]',
      avatarSize: 'w-5 h-5',
      avatarInitial: 'text-[9.5px]',
      time: 'text-[9px]',
      icon: 11
    },
    base: {
      comment: 'text-[14px] leading-normal',
      nickname: 'text-[13.5px]',
      avatarSize: 'w-6 h-6',
      avatarInitial: 'text-[11px]',
      time: 'text-[9.5px]',
      icon: 12
    },
    lg: {
      comment: 'text-[16px] leading-relaxed',
      nickname: 'text-[15px]',
      avatarSize: 'w-7 h-7',
      avatarInitial: 'text-[13px]',
      time: 'text-[10px]',
      icon: 14
    },
  };

  let cfg = $derived(fontConfig[prefs.fontSize || 'sm'] || fontConfig.sm);

  const densityPadding = {
    compact: 'py-1 px-2',
    normal: 'py-1.5 px-2.5',
    relaxed: 'py-2 px-3',
  };

  const outlineClass = {
    none: 'text-outline-none',
    subtle: 'text-outline-subtle',
    'high-contrast': 'text-outline-high',
  };

  let initial = $derived((item.nickname || item.uniqueId || '?').trim()[0]?.toUpperCase() || '?');
  let avatarLoadFailed = $state(false);

  let bubbleBgAlpha = $derived((prefs.bubbleOpacity ?? 65) / 100);
  let textAlpha = $derived((prefs.textOpacity ?? 100) / 100);
</script>

{#if item.type === 'gift'}
  <!-- Professional Gift Alert Card -->
  <div 
    style="background-color: rgba(245, 158, 11, {bubbleBgAlpha * 0.22}); border-color: rgba(245, 158, 11, {Math.min(0.5, bubbleBgAlpha * 0.45)});"
    class="rounded-lg border {densityPadding[prefs.density]} backdrop-blur-md w-full box-border transition-colors"
  >
    <div class="flex items-center justify-between gap-1.5 mb-1">
      <div class="flex items-center gap-1.5 min-w-0">
        {#if prefs.showAvatar}
          <div class="{cfg.avatarSize} rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center {cfg.avatarInitial} font-bold text-amber-300 shrink-0 overflow-hidden">
            {#if item.profilePictureUrl && !avatarLoadFailed}
              <img 
                src={item.profilePictureUrl} 
                alt="" 
                referrerpolicy="no-referrer"
                loading="lazy"
                onerror={() => { avatarLoadFailed = true; }}
                class="w-full h-full object-cover" 
              />
            {:else}
              {initial}
            {/if}
          </div>
        {/if}

        <span class="{cfg.nickname} font-semibold text-amber-300 truncate {outlineClass[prefs.textOutline]}">
          {item.nickname}
        </span>
        <span class="text-[10px] text-amber-200/60 truncate font-mono">
          @{item.uniqueId}
        </span>
      </div>

      {#if prefs.showTimestamp}
        <span class="{cfg.time} text-amber-200/50 font-mono shrink-0">
          {formattedTime}
        </span>
      {/if}
    </div>

    <div class="flex items-center justify-between gap-2 mt-0.5">
      <div class="flex items-center gap-1.5 min-w-0">
        <div class="{cfg.avatarSize} rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
          {#if item.giftPictureUrl}
            <img 
              src={item.giftPictureUrl} 
              alt="" 
              referrerpolicy="no-referrer" 
              class="w-full h-full object-contain p-0.5" 
            />
          {:else}
            <Gift size={cfg.icon} strokeWidth={2.5} class="text-amber-400" />
          {/if}
        </div>
        <span 
          style="color: rgba(254, 243, 199, {textAlpha});"
          class="{cfg.comment} font-medium truncate {outlineClass[prefs.textOutline]}"
        >
          sent <strong class="text-amber-300 font-semibold">{item.giftName}</strong>
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        {#if (item.repeatCount || 1) > 1}
          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 font-mono shadow-xs">
            x{item.repeatCount}
          </span>
        {/if}
        {#if (item.diamondCount || 0) > 0}
          <span class="px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center gap-0.5 font-mono">
            <Gem size={10} strokeWidth={2.5} class="text-amber-400" />
            {((item.diamondCount || 0) * (item.repeatCount || 1)).toLocaleString()}
          </span>
        {/if}
      </div>
    </div>
  </div>

{:else if item.type === 'chat'}
  <!-- Clean Chat Message Card -->
  <div 
    style="background-color: rgba(15, 23, 42, {bubbleBgAlpha}); border-color: rgba(255, 255, 255, {Math.min(0.2, bubbleBgAlpha * 0.15)});"
    class="rounded-lg border {densityPadding[prefs.density]} transition-colors text-slate-100 w-full box-border"
  >
    <div class="flex items-baseline justify-between gap-1.5 mb-0.5">
      <div class="flex items-center gap-1.5 min-w-0">
        {#if prefs.showAvatar}
          <div class="{cfg.avatarSize} rounded-full bg-slate-800 border border-white/10 flex items-center justify-center {cfg.avatarInitial} font-bold text-slate-300 shrink-0 overflow-hidden">
            {#if item.profilePictureUrl && !avatarLoadFailed}
              <img 
                src={item.profilePictureUrl} 
                alt="" 
                referrerpolicy="no-referrer"
                loading="lazy"
                onerror={() => { avatarLoadFailed = true; }}
                class="w-full h-full object-cover" 
              />
            {:else}
              {initial}
            {/if}
          </div>
        {/if}

        <span 
          style="color: {prefs.usernameColor}; opacity: {Math.max(0.4, textAlpha)};" 
          class="{cfg.nickname} font-semibold truncate transition-colors {outlineClass[prefs.textOutline]}"
        >
          {item.nickname}
        </span>

        {#if prefs.showBadges}
          {#if item.isModerator}
            <span class="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 font-mono">
              <Shield size={8} strokeWidth={2.5} />
              MOD
            </span>
          {/if}
          {#if item.isSubscriber}
            <span class="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 font-mono">
              <Sparkles size={8} strokeWidth={2.5} />
              SUB
            </span>
          {/if}
        {/if}
      </div>

      {#if prefs.showTimestamp}
        <span class="{cfg.time} text-slate-500 font-mono shrink-0 select-none">
          {formattedTime}
        </span>
      {/if}
    </div>

    <!-- Comment Body with proportional text sizing -->
    <div 
      style="color: rgba(241, 245, 249, {textAlpha});"
      class="{cfg.comment} break-words font-normal tracking-wide {outlineClass[prefs.textOutline]} mt-0.5"
    >
      {item.comment}
    </div>
  </div>

{:else if item.type === 'member' && prefs.showMembers}
  <!-- Clean Member Join Banner -->
  <div 
    style="background-color: rgba(6, 78, 59, {bubbleBgAlpha * 0.4}); border-color: rgba(16, 185, 129, {Math.min(0.4, bubbleBgAlpha * 0.3)});"
    class="rounded-md border {densityPadding[prefs.density]} text-[10px] text-emerald-300 flex items-center gap-1.5 w-full box-border transition-colors"
  >
    {#if prefs.showAvatar}
      <div class="{cfg.avatarSize} rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center {cfg.avatarInitial} font-bold text-emerald-300 shrink-0 overflow-hidden">
        {#if item.profilePictureUrl && !avatarLoadFailed}
          <img 
            src={item.profilePictureUrl} 
            alt="" 
            referrerpolicy="no-referrer"
            loading="lazy"
            onerror={() => { avatarLoadFailed = true; }}
            class="w-full h-full object-cover" 
          />
        {:else}
          <User size={cfg.icon} strokeWidth={2.5} class="text-emerald-400" />
        {/if}
      </div>
    {:else}
      <User size={cfg.icon} strokeWidth={2.5} class="text-emerald-400 shrink-0" />
    {/if}
    <span 
      style="color: rgba(167, 243, 208, {textAlpha});"
      class="{cfg.nickname} font-semibold truncate {outlineClass[prefs.textOutline]}"
    >
      {item.nickname}
    </span>
    <span class="text-emerald-400/70 text-[9.5px]">joined live</span>
  </div>

{:else if item.type === 'like' && prefs.showLikes}
  <!-- Clean Like Banner -->
  <div 
    style="background-color: rgba(136, 19, 55, {bubbleBgAlpha * 0.35}); border-color: rgba(244, 63, 94, {Math.min(0.4, bubbleBgAlpha * 0.3)});"
    class="rounded-md border {densityPadding[prefs.density]} text-[10px] text-rose-300 flex items-center justify-between gap-1.5 w-full box-border transition-colors"
  >
    <div class="flex items-center gap-1.5 truncate">
      {#if prefs.showAvatar}
        <div class="{cfg.avatarSize} rounded-full bg-rose-950/60 border border-rose-500/30 flex items-center justify-center {cfg.avatarInitial} font-bold text-rose-300 shrink-0 overflow-hidden">
          {#if item.profilePictureUrl && !avatarLoadFailed}
            <img 
              src={item.profilePictureUrl} 
              alt="" 
              referrerpolicy="no-referrer"
              loading="lazy"
              onerror={() => { avatarLoadFailed = true; }}
              class="w-full h-full object-cover" 
            />
          {:else}
            <Heart size={cfg.icon} strokeWidth={2.5} class="text-rose-400" />
          {/if}
        </div>
      {:else}
        <Heart size={cfg.icon} strokeWidth={2.5} class="text-rose-400 shrink-0" />
      {/if}
      <span 
        style="color: rgba(254, 205, 211, {textAlpha});"
        class="{cfg.nickname} font-semibold truncate {outlineClass[prefs.textOutline]}"
      >
        {item.nickname}
      </span>
      <span class="text-rose-400/70 text-[9.5px]">liked</span>
    </div>
    {#if item.likeCount && item.likeCount > 1}
      <span class="text-[9px] font-mono font-bold text-rose-300 bg-rose-500/25 px-1 rounded-sm shrink-0">
        +{item.likeCount}
      </span>
    {/if}
  </div>
{/if}
