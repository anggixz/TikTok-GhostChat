<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { createVirtualizer } from '@tanstack/svelte-virtual';
  import type { CommentItem } from '../types';
  import type { UserPreferences } from '../preferences';
  import CommentItemComponent from './CommentItem.svelte';
  import { MessageSquare, ArrowDown } from '@lucide/svelte';

  let { 
    items = [], 
    prefs 
  }: { 
    items: CommentItem[]; 
    prefs: UserPreferences;
  } = $props();

  let scrollElement: HTMLDivElement | null = $state(null);
  let isAutoScrollEnabled = $state(true);
  let hasNewCommentsWhilePaused = $state(false);
  let prevItemsLength = 0;

  let rowSpacing = $derived(
    prefs.density === 'compact' ? 4 : prefs.density === 'relaxed' ? 8 : 6
  );

  // Initialize TanStack Virtualizer
  const virtualizer = createVirtualizer({
    count: 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => (prefs.fontSize === 'lg' ? 72 : prefs.fontSize === 'xs' ? 44 : 56),
    overscan: 6,
  });

  let virtualizerInstance: any = null;
  const unsubVirtualizer = virtualizer.subscribe((v) => {
    virtualizerInstance = v;
  });

  onDestroy(() => {
    unsubVirtualizer();
  });

  // Attach ResizeObserver measurement once per DOM node without recursive update loops
  function measureElementAction(node: HTMLElement) {
    if (virtualizerInstance) {
      virtualizerInstance.measureElement(node);
    }
    return {
      destroy() {
        if (virtualizerInstance) {
          virtualizerInstance.measureElement(null);
        }
      }
    };
  }

  // Clear virtual size cache when font scale, density, or avatar toggle changes
  $effect(() => {
    const _font = prefs.fontSize;
    const _dens = prefs.density;
    const _avatar = prefs.showAvatar;

    untrack(() => {
      if (virtualizerInstance && scrollElement) {
        const est = _font === 'lg' ? 72 : _font === 'xs' ? 44 : 56;
        virtualizerInstance.setOptions({
          count: items.length,
          getScrollElement: () => scrollElement,
          estimateSize: () => est,
          overscan: 6,
        });

        tick().then(() => {
          if (virtualizerInstance) {
            virtualizerInstance.measure();
          }
        });
      }
    });
  });

  // Synchronize item count changes
  $effect(() => {
    const count = items.length;
    const el = scrollElement;

    untrack(() => {
      if (virtualizerInstance && el) {
        virtualizerInstance.setOptions({
          count,
          getScrollElement: () => el,
          estimateSize: () => (prefs.fontSize === 'lg' ? 72 : prefs.fontSize === 'xs' ? 44 : 56),
          overscan: 6,
        });

        if (count > prevItemsLength) {
          if (isAutoScrollEnabled) {
            tick().then(() => {
              if (virtualizerInstance) {
                virtualizerInstance.scrollToIndex(count - 1, { align: 'end' });
              }
            });
          } else {
            hasNewCommentsWhilePaused = true;
          }
        }
      }
      prevItemsLength = count;
    });
  });

  function handleScroll() {
    if (!scrollElement) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom <= 40) {
      isAutoScrollEnabled = true;
      hasNewCommentsWhilePaused = false;
    } else {
      isAutoScrollEnabled = false;
    }
  }

  function scrollToBottom() {
    isAutoScrollEnabled = true;
    hasNewCommentsWhilePaused = false;
    if (items.length > 0 && virtualizerInstance) {
      virtualizerInstance.scrollToIndex(items.length - 1, { align: 'end' });
    }
  }
</script>

<div class="relative w-full h-full flex flex-col min-h-0 overflow-hidden">
  <div
    bind:this={scrollElement}
    onscroll={handleScroll}
    class="flex-1 w-full overflow-y-auto overflow-x-hidden px-2.5 py-1.5 select-text no-scrollbar"
    style="scrollbar-width: none; -ms-overflow-style: none;"
  >
    {#if items.length === 0}
      <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 select-none">
        <div class="w-10 h-10 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center mb-2.5">
          <MessageSquare size={18} strokeWidth={1.8} class="text-slate-400" />
        </div>
        <p class="text-xs font-medium text-slate-300 mb-0.5">Live Stream Inactive</p>
        <p class="text-[11px] text-slate-500 max-w-[210px] leading-relaxed">
          Connect to a TikTok streamer above or launch Demo mode to test layout.
        </p>
      </div>
    {:else}
      <div
        style="height: {$virtualizer.getTotalSize()}px; width: 100%; position: relative;"
      >
        {#each $virtualizer.getVirtualItems() as virtualRow (virtualRow.index)}
          {@const item = items[virtualRow.index]}
          {#if item}
            <div
              data-index={virtualRow.index}
              use:measureElementAction
              style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({virtualRow.start}px);"
            >
              <div style="padding-bottom: {rowSpacing}px; width: 100%;">
                <CommentItemComponent {item} {prefs} />
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  {#if hasNewCommentsWhilePaused}
    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 animate-bounce">
      <button
        onclick={scrollToBottom}
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium shadow-lg shadow-sky-950/40 border border-sky-400/30 transition-transform active:scale-95 cursor-pointer"
      >
        <ArrowDown size={12} strokeWidth={2.5} />
        <span>New messages</span>
      </button>
    </div>
  {/if}
</div>

<style>
  div::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    opacity: 0 !important;
  }
</style>
