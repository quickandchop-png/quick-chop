import { Platform } from 'react-native';

let nativeSound: any = null;

function playWebBeep(times = 3) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1100, t + 0.15);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
      t += 0.5;
    }
  } catch (e) {
    console.warn('Web audio error:', e);
  }
}

async function playNativeAlert() {
  try {
    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    if (nativeSound) {
      try { await nativeSound.unloadAsync(); } catch {}
    }
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://cdn.freesound.org/previews/411/411637_5121236-lq.mp3' },
      { shouldPlay: true, volume: 1.0 }
    );
    nativeSound = sound;
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        nativeSound = null;
      }
    });
  } catch (e) {
    console.warn('Native audio error:', e);
  }
}

export async function playNewOrderAlert() {
  if (Platform.OS === 'web') {
    playWebBeep(3);
  } else {
    await playNativeAlert();
  }
}

export async function playNotificationBeep() {
  if (Platform.OS === 'web') {
    playWebBeep(1);
  } else {
    try {
      const { Audio } = await import('expo-av');
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://cdn.freesound.org/previews/411/411637_5121236-lq.mp3' },
        { shouldPlay: true, volume: 0.6 }
      );
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.didJustFinish) sound.unloadAsync().catch(() => {});
      });
    } catch (e) {
      console.warn('Beep error:', e);
    }
  }
}
