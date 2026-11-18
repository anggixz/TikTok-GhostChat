// Google Text-to-Speech (TTS) Service for TikTok Live Comments
// Supports Google voice models: Wanita (Female) / Pria (Male)
// Supports languages: Bahasa Indonesia (id) & English (en)

export interface TtsOptions {
  volume?: number;           // 0 to 100
  rate?: number;             // 0.7 to 1.5
  language?: 'id' | 'en';    // 'id' = Indonesia, 'en' = English
  model?: 'female' | 'male'; // 'female' = Wanita, 'male' = Pria
  nickname?: string;
  includeNickname?: boolean;
}

interface QueuedItem {
  text: string;
  options: TtsOptions;
}

class TtsService {
  private queue: QueuedItem[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private maxQueueSize = 6; // Prevent lag/backlog when chat is buzzing

  /**
   * Clean and sanitize comment text for TTS:
   * - Limit max characters (Google Translate TTS works best <= 150 chars)
   * - Compress repeated spam characters (e.g. "wkwkwkwkwk" -> "wkwk", "haaaaaai" -> "haai")
   * - Remove URLs and pure emojis
   */
  public cleanText(rawText: string): string {
    if (!rawText) return '';

    let text = rawText.trim();

    // Replace URLs
    text = text.replace(/https?:\/\/\S+/gi, 'tautan');

    // Compress excessive character repetitions (4+ identical chars to 2)
    text = text.replace(/(.)\1{3,}/g, '$1$1');

    // Compress repeated laugh patterns
    text = text.replace(/(wk){3,}/gi, 'wkwk');
    text = text.replace(/(ha){3,}/gi, 'haha');
    text = text.replace(/(he){3,}/gi, 'hehe');
    text = text.replace(/(lo){3,}/gi, 'lolo');

    // Remove emojis/symbols that would cause silence or weird speech artifacts
    text = text.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ''
    );

    // Limit to 140 characters so Google TTS stays crisp and fast
    if (text.length > 140) {
      text = text.slice(0, 137) + '...';
    }

    return text.trim();
  }

  /**
   * Queue comment to be read using Google TTS.
   * Strictly ONLY comments should call this.
   */
  public speakComment(rawText: string, options: TtsOptions = {}): void {
    if (typeof window === 'undefined') return;

    const cleaned = this.cleanText(rawText);
    if (!cleaned) return;

    let textToSpeak = cleaned;
    if (options.includeNickname && options.nickname) {
      const cleanNick = options.nickname.slice(0, 20).trim();
      const prefix = options.language === 'en' ? `${cleanNick} says:` : `${cleanNick}:`;
      textToSpeak = `${prefix} ${cleaned}`;
    }

    // Drop oldest queued item if queue is getting too long (prevent stream latency)
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }

    this.queue.push({ text: textToSpeak, options });

    if (!this.isPlaying) {
      this.processQueue();
    }
  }

  /**
   * Test selected Google voice model immediately.
   */
  public testSpeech(
    sampleText?: string,
    options: TtsOptions = {}
  ): void {
    if (typeof window === 'undefined') return;

    const lang = options.language || 'id';
    const model = options.model || 'female';

    let defaultText = '';
    if (lang === 'en') {
      defaultText = model === 'female' 
        ? 'Hello! This is Google female voice for TikTok Live chat.'
        : 'Hello! This is Google male voice for TikTok Live chat.';
    } else {
      defaultText = model === 'female'
        ? 'Halo! Ini adalah suara Google model wanita untuk komentar TikTok Live.'
        : 'Halo! Ini adalah suara Google model pria untuk komentar TikTok Live.';
    }

    this.stop();
    this.queue.push({ text: sampleText || defaultText, options });
    this.processQueue();
  }

  /**
   * Process next item from queue.
   */
  private processQueue(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentAudio = null;
      this.currentUtterance = null;
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    this.isPlaying = true;
    this.playAudio(next.text, next.options);
  }

  /**
   * Play Google TTS audio.
   * First attempts local sidecar HTTP proxy (http://localhost:21213/api/tts),
   * then direct Google TTS with no-referrer,
   * then Web Speech API as last resort.
   */
  private playAudio(text: string, options: TtsOptions): void {
    const lang = options.language || 'id';
    const model = options.model || 'female';
    const baseVolume = typeof options.volume === 'number' ? options.volume : 80;
    const baseRate = typeof options.rate === 'number' ? options.rate : 1.0;

    const encodedText = encodeURIComponent(text);
    // Priority 1: Local sidecar proxy on port 21213 (strips tauri referer and proxies directly to Google)
    const proxyUrl = `http://localhost:21213/api/tts?tl=${lang}&q=${encodedText}`;
    // Priority 2: Direct Google Translate TTS with no-referrer
    const directUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodedText}`;

    const playWithUrl = (url: string, onFail: () => void) => {
      try {
        const audio = document.createElement('audio');
        audio.referrerPolicy = 'no-referrer';
        audio.crossOrigin = 'anonymous';
        audio.src = url;
        this.currentAudio = audio;

        // Set volume (0.0 to 1.0)
        audio.volume = Math.max(0, Math.min(1, baseVolume / 100));

        if (model === 'male') {
          // Voice Model Pria (Male):
          // Pitch shift the Google voice down into a deeper masculine register
          (audio as any).preservesPitch = false;
          (audio as any).mozPreservesPitch = false;
          (audio as any).webkitPreservesPitch = false;
          audio.playbackRate = 0.82 * baseRate;
        } else {
          // Voice Model Wanita (Female):
          // Original authentic Google Voice
          (audio as any).preservesPitch = true;
          (audio as any).mozPreservesPitch = true;
          (audio as any).webkitPreservesPitch = true;
          audio.playbackRate = 1.0 * baseRate;
        }

        audio.onended = () => {
          this.currentAudio = null;
          setTimeout(() => this.processQueue(), 60);
        };

        audio.onerror = () => {
          this.currentAudio = null;
          onFail();
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            this.currentAudio = null;
            onFail();
          });
        }
      } catch (_) {
        this.currentAudio = null;
        onFail();
      }
    };

    // Try local sidecar proxy first
    playWithUrl(proxyUrl, () => {
      // If local proxy fails, try direct Google URL with no-referrer
      playWithUrl(directUrl, () => {
        // If direct Google also fails, use Web Speech API
        this.fallbackWebSpeech(text, options);
      });
    });
  }

  /**
   * Fallback to Web Speech API if Google endpoint is temporarily unreachable.
   */
  private fallbackWebSpeech(text: string, options: TtsOptions): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.currentUtterance = null;
      setTimeout(() => this.processQueue(), 60);
      return;
    }

    try {
      const lang = options.language === 'en' ? 'en-US' : 'id-ID';
      const model = options.model || 'female';
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      utterance.lang = lang;
      utterance.volume = Math.max(0, Math.min(1, (options.volume ?? 80) / 100));
      utterance.rate = Math.max(0.6, Math.min(1.5, options.rate ?? 1.0));
      
      // Female higher pitch, Male deeper pitch
      utterance.pitch = model === 'female' ? 1.15 : 0.8;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        // Try finding matching voice for language & gender
        const targetLang = lang.toLowerCase().split('-')[0];
        const match = voices.find((v) => {
          const vLang = v.lang.toLowerCase();
          const vName = v.name.toLowerCase();
          const matchLang = vLang.startsWith(targetLang);
          if (!matchLang) return false;

          if (model === 'female') {
            return vName.includes('female') || vName.includes('gadis') || vName.includes('zira') || vName.includes('jenny');
          } else {
            return vName.includes('male') || vName.includes('ardi') || vName.includes('david') || vName.includes('guy');
          }
        });

        if (match) {
          utterance.voice = match;
        }
      }

      utterance.onend = () => {
        this.currentUtterance = null;
        setTimeout(() => this.processQueue(), 60);
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        setTimeout(() => this.processQueue(), 60);
      };

      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      this.currentUtterance = null;
      setTimeout(() => this.processQueue(), 60);
    }
  }

  /**
   * Stop all active playback and clear pending comment queue immediately.
   */
  public stop(): void {
    this.queue = [];
    this.isPlaying = false;

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch (_) {}
      this.currentAudio = null;
    }

    if (this.currentUtterance) {
      this.currentUtterance = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }
}

export const ttsService = new TtsService();
