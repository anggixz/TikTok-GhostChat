let audioCtx: AudioContext | null = null;

export function playGiftChime(volumePercent = 50): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    const vol = Math.max(0, Math.min(1, volumePercent / 100)) * 0.15;
    masterGain.gain.setValueAtTime(vol, now);
    masterGain.connect(audioCtx.destination);

    // Two-tone pleasant chord (C6 & E6)
    const tones = [1046.5, 1318.5];
    tones.forEach((freq, idx) => {
      const osc = audioCtx!.createOscillator();
      const oscGain = audioCtx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      oscGain.gain.setValueAtTime(1, now + idx * 0.06);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.36);
    });
  } catch (_) {
    // Ignore audio autostart restrictions
  }
}
