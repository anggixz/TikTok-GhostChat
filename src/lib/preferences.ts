export interface KeybindSettings {
  toggleClickThrough: string;
  toggleGhostMode: string;
  togglePin: string;
  toggleSettings: string;
}

export interface UserPreferences {
  usernameColor: string;
  fontSize: 'xs' | 'sm' | 'base' | 'lg';
  density: 'compact' | 'normal' | 'relaxed';
  textOutline: 'none' | 'subtle' | 'high-contrast';
  showAvatar: boolean;
  showBadges: boolean;
  showTimestamp: boolean;
  showLikes: boolean;
  showMembers: boolean;
  minGiftDiamonds: number;
  soundAlerts: boolean;
  soundVolume: number;
  bgOpacity: number;
  bubbleOpacity: number;
  textOpacity: number;
  viewsOpacity: number;
  enableBlur: boolean;
  showStatsHud: boolean;
  ttsEnabled: boolean;
  ttsVolume: number;
  ttsRate: number;
  ttsLanguage: 'id' | 'en';
  ttsModel: 'female' | 'male';
  ttsVoiceURI: string;
  ttsIncludeNickname: boolean;
  keybinds: KeybindSettings;
}

export const USERNAME_COLOR_PRESETS = [
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Emerald', hex: '#34d399' },
  { name: 'Amber Gold', hex: '#fbbf24' },
  { name: 'Neon Rose', hex: '#fb7185' },
  { name: 'Electric Purple', hex: '#c084fc' },
  { name: 'Vibrant Orange', hex: '#fb923c' },
  { name: 'Clean White', hex: '#f8fafc' },
];

const STORAGE_KEY = 'tikzient_prefs_v3';

export const defaultPreferences: UserPreferences = {
  usernameColor: '#38bdf8',
  fontSize: 'sm',
  density: 'normal',
  textOutline: 'subtle',
  showAvatar: true,
  showBadges: true,
  showTimestamp: true,
  showLikes: true,
  showMembers: true,
  minGiftDiamonds: 0,
  soundAlerts: true,
  soundVolume: 50,
  ttsEnabled: false,
  ttsVolume: 80,
  ttsRate: 1.0,
  ttsLanguage: 'id',
  ttsModel: 'female',
  ttsVoiceURI: '',
  ttsIncludeNickname: false,
  bgOpacity: 80,
  bubbleOpacity: 65,
  textOpacity: 100,
  viewsOpacity: 80,
  enableBlur: true,
  showStatsHud: true,
  keybinds: {
    toggleClickThrough: 'Alt+G',
    toggleGhostMode: 'Alt+H',
    togglePin: 'Alt+P',
    toggleSettings: 'Alt+S',
  },
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...defaultPreferences };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { 
        ...defaultPreferences, 
        ...parsed,
        keybinds: {
          ...defaultPreferences.keybinds,
          ...(parsed.keybinds || {})
        }
      };
    }
  } catch (_) {}
  return { ...defaultPreferences };
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (_) {}
}
