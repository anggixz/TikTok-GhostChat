let appWindow: any = null;
let isTauriEnv = false;

// Check if running in Tauri environment
if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    appWindow = getCurrentWindow();
    isTauriEnv = true;
  } catch (err) {
    console.warn('[WindowController] Failed to initialize Tauri window API:', err);
  }
}

export function isTauri(): boolean {
  return isTauriEnv;
}

export async function setAlwaysOnTop(isTop: boolean): Promise<void> {
  if (isTauriEnv && appWindow) {
    try {
      await appWindow.setAlwaysOnTop(isTop);
    } catch (err) {
      console.warn('[WindowController] setAlwaysOnTop error:', err);
    }
  } else {
    console.log('[WindowController] Mock setAlwaysOnTop:', isTop);
  }
}

export async function setIgnoreMouseEvents(ignore: boolean): Promise<void> {
  if (isTauriEnv && appWindow) {
    try {
      await appWindow.setIgnoreCursorEvents(ignore);
    } catch (err) {
      console.warn('[WindowController] setIgnoreMouseEvents error:', err);
    }
  } else {
    console.log('[WindowController] Mock setIgnoreMouseEvents:', ignore);
  }
}

export async function startDragging(): Promise<void> {
  if (isTauriEnv && appWindow) {
    try {
      await appWindow.startDragging();
    } catch (err) {
      console.warn('[WindowController] startDragging error:', err);
    }
  }
}

export async function setPresetSize(width: number, height: number): Promise<void> {
  if (isTauriEnv && appWindow) {
    try {
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      await appWindow.setSize(new LogicalSize(width, height));
    } catch (err) {
      console.warn('[WindowController] setPresetSize error:', err);
    }
  } else {
    console.log('[WindowController] Mock setPresetSize:', width, height);
  }
}

export async function minimizeWindow(): Promise<void> {
  if (isTauriEnv && appWindow) {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.warn('[WindowController] minimizeWindow error:', err);
    }
  }
}

export async function closeWindow(): Promise<void> {
  if (isTauriEnv && appWindow) {
    try {
      await appWindow.close();
    } catch (err) {
      console.warn('[WindowController] closeWindow error:', err);
    }
  } else {
    window.close();
  }
}

export async function setGlobalHotkeys(
  clickThrough: string,
  ghostMode: string,
  pin: string,
  settings: string
): Promise<void> {
  if (isTauriEnv) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_global_hotkeys', {
        clickThroughKey: clickThrough,
        ghostModeKey: ghostMode,
        pinKey: pin,
        settingsKey: settings
      });
    } catch (err) {
      console.warn('[WindowController] setGlobalHotkeys error:', err);
    }
  }
}

export async function onGlobalHotkey(callback: (action: string) => void): Promise<() => void> {
  if (isTauriEnv) {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<string>('global-hotkey', (event) => {
        callback(event.payload);
      });
      return unlisten;
    } catch (err) {
      console.warn('[WindowController] onGlobalHotkey listen error:', err);
    }
  }
  return () => {};
}
