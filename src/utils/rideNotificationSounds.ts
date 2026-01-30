// Unified Ride Notification Sounds & Vibration Patterns
// This file centralizes all audio and vibration logic for the ride system

export const VibrationPatterns = {
  accepted: [200, 100, 200],
  arrived: [300, 100, 300, 100, 300, 100, 500],
  inProgress: [150, 50, 150],
  completed: [100, 50, 100, 50, 100, 50, 100],
  riderArrived: [200, 100, 200, 100, 400],
  cancelled: [500, 200, 500],
  driverFound: [200, 100, 200],
  riderOnWay: [150, 80, 150],
  riderWait: [200, 100, 200],
  riderQuestion: [100, 50, 100, 50, 200],
  messageSent: [50, 50, 100],
  driverApproaching: [200, 100, 200, 100, 300],
  driverMessage: [150, 80, 150]
};

// Vibrate device with pattern
export const vibrate = (pattern: number[]) => {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (error) {
    // Silently fail if vibration blocked by browser
  }
};

// Play notification sound based on status
export const playSound = (type: keyof typeof SoundTypes) => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    
    // Resume context if suspended (required by browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    const playTone = (freq: number, startTime: number, duration: number, oscType: OscillatorType = 'sine', volume = 0.5) => {
      try {
        const osc = ctx.createOscillator();
        const toneGain = ctx.createGain();
        toneGain.connect(gainNode);
        osc.connect(toneGain);
        toneGain.gain.value = volume;
        osc.frequency.value = freq;
        osc.type = oscType;
        osc.start(startTime);
        osc.stop(startTime + duration);
      } catch (e) {
        // Ignore if audio blocked
      }
    };

    const now = ctx.currentTime;
    gainNode.gain.value = 0.6;

    SoundTypes[type](playTone, now, gainNode);

    setTimeout(() => ctx.close(), 2000);
  } catch (e) {
    // Silently fail - audio not available or blocked
  }
};

type PlayToneFn = (freq: number, startTime: number, duration: number, type?: OscillatorType, volume?: number) => void;

const SoundTypes = {
  // نغمة احترافية ناعمة - تم قبول الطلب من السائق
  accepted: (playTone: PlayToneFn, now: number) => {
    playTone(440, now, 0.15, 'sine', 0.4);      // A4
    playTone(554, now + 0.12, 0.15, 'sine', 0.45); // C#5
    playTone(659, now + 0.25, 0.2, 'sine', 0.5);   // E5
    playTone(880, now + 0.4, 0.3, 'sine', 0.5);    // A5 (نهاية ناعمة)
  },

  // نغمة تنبيه واضحة - وصل السائق
  arrived: (playTone: PlayToneFn, now: number, gainNode: GainNode) => {
    gainNode.gain.value = 0.6;
    playTone(698, now, 0.15, 'sine', 0.6);       // F5
    playTone(880, now + 0.12, 0.15, 'sine', 0.65); // A5
    playTone(1047, now + 0.28, 0.2, 'sine', 0.7);  // C6
    playTone(880, now + 0.5, 0.25, 'sine', 0.6);   // A5 (تكرار ناعم)
  },

  // Smooth starting melody - Ride started
  inProgress: (playTone: PlayToneFn, now: number) => {
    playTone(440, now, 0.15, 'triangle');         // A4
    playTone(554, now + 0.12, 0.15, 'triangle');  // C#5
    playTone(659, now + 0.25, 0.2, 'triangle');   // E5
    playTone(880, now + 0.4, 0.25, 'triangle');   // A5
  },

  // Success fanfare - Ride completed
  completed: (playTone: PlayToneFn, now: number, gainNode: GainNode) => {
    gainNode.gain.value = 0.7;
    playTone(523, now, 0.1);            // C5
    playTone(659, now + 0.08, 0.1);     // E5
    playTone(784, now + 0.16, 0.1);     // G5
    playTone(1047, now + 0.26, 0.12);   // C6
    playTone(1318, now + 0.38, 0.15);   // E6
    playTone(1568, now + 0.52, 0.25);   // G6 (celebration)
    // Shimmer effect
    playTone(1760, now + 0.72, 0.12, 'sine', 0.25);
    playTone(2093, now + 0.82, 0.15, 'sine', 0.2);
  },

  // Distinctive chime - Rider arrived at destination
  riderArrived: (playTone: PlayToneFn, now: number, gainNode: GainNode) => {
    gainNode.gain.value = 0.8;
    playTone(1047, now, 0.08);           // C6
    playTone(1319, now + 0.08, 0.08);    // E6
    playTone(1568, now + 0.16, 0.08);    // G6
    playTone(1319, now + 0.26, 0.08);    // E6
    playTone(1568, now + 0.34, 0.08);    // G6
    playTone(2093, now + 0.44, 0.15);    // C7 (very high)
  },

  // Sad descending tones - Cancelled
  cancelled: (playTone: PlayToneFn, now: number) => {
    playTone(440, now, 0.2);            // A4
    playTone(392, now + 0.18, 0.2);     // G4
    playTone(349, now + 0.36, 0.25);    // F4
    playTone(294, now + 0.58, 0.35);    // D4 (low sad)
  },

  // Driver found sound
  driverFound: (playTone: PlayToneFn, now: number) => {
    playTone(659, now, 0.1);            // E5
    playTone(784, now + 0.1, 0.12);     // G5
    playTone(988, now + 0.22, 0.15);    // B5
    playTone(1175, now + 0.38, 0.2);    // D6
  },

  // Confirmation success
  confirm: (playTone: PlayToneFn, now: number) => {
    playTone(784, now, 0.1);            // G5
    playTone(988, now + 0.1, 0.15);     // B5
  },

  // Driver broadcast events
  driverArrived: (playTone: PlayToneFn, now: number) => {
    playTone(880, now, 0.08);
    playTone(1046, now + 0.08, 0.08);
    playTone(1318, now + 0.18, 0.12);
  },

  rideStarted: (playTone: PlayToneFn, now: number) => {
    playTone(523, now, 0.1);
    playTone(659, now + 0.1, 0.1);
    playTone(784, now + 0.2, 0.15);
  },

  rideCompleted: (playTone: PlayToneFn, now: number, gainNode: GainNode) => {
    gainNode.gain.value = 0.7;
    playTone(784, now, 0.1);
    playTone(988, now + 0.1, 0.1);
    playTone(1175, now + 0.2, 0.15);
    playTone(1568, now + 0.35, 0.2);
  },

  // Warning sound - waiting time approaching limit
  warning: (playTone: PlayToneFn, now: number, gainNode: GainNode) => {
    gainNode.gain.value = 0.7;
    playTone(523, now, 0.15);            // C5
    playTone(440, now + 0.15, 0.15);     // A4
    playTone(523, now + 0.3, 0.15);      // C5
    playTone(440, now + 0.45, 0.2);      // A4
  },

  // Urgent alert - critical time remaining
  urgent: (playTone: PlayToneFn, now: number, gainNode: GainNode) => {
    gainNode.gain.value = 0.9;
    playTone(880, now, 0.1);             // A5
    playTone(698, now + 0.1, 0.1);       // F5
    playTone(880, now + 0.2, 0.1);       // A5
    playTone(698, now + 0.3, 0.1);       // F5
    playTone(880, now + 0.4, 0.08);      // A5
    playTone(698, now + 0.48, 0.08);     // F5
    playTone(880, now + 0.56, 0.08);     // A5
    playTone(1046, now + 0.65, 0.2);     // C6 (urgent peak)
  },

  // Rider on the way notification - for driver
  riderOnWay: (playTone: PlayToneFn, now: number) => {
    playTone(659, now, 0.1, 'triangle');            // E5
    playTone(784, now + 0.1, 0.1, 'triangle');      // G5
    playTone(880, now + 0.2, 0.12, 'triangle');     // A5
    playTone(1047, now + 0.32, 0.15, 'triangle');   // C6
  },

  // Rider wait request - for driver
  riderWait: (playTone: PlayToneFn, now: number) => {
    playTone(523, now, 0.12);            // C5
    playTone(440, now + 0.12, 0.12);     // A4
    playTone(523, now + 0.24, 0.15);     // C5
  },

  // Rider asking where driver is - for driver
  riderQuestion: (playTone: PlayToneFn, now: number) => {
    playTone(784, now, 0.08);            // G5
    playTone(659, now + 0.1, 0.08);      // E5
    playTone(784, now + 0.2, 0.08);      // G5
    playTone(988, now + 0.3, 0.12);      // B5
  },

  // Quick message sent confirmation - for rider
  messageSent: (playTone: PlayToneFn, now: number) => {
    playTone(880, now, 0.08);            // A5
    playTone(1047, now + 0.08, 0.1);     // C6
  },

  // Driver approaching alert (200m) - for rider
  driverApproaching: (playTone: PlayToneFn, now: number, gainNode: GainNode) => {
    gainNode.gain.value = 0.7;
    playTone(659, now, 0.1);             // E5
    playTone(784, now + 0.1, 0.1);       // G5
    playTone(880, now + 0.2, 0.1);       // A5
    playTone(1047, now + 0.32, 0.12);    // C6
    playTone(1175, now + 0.45, 0.15);    // D6
  },

  // Driver quick message sounds for rider
  driverAtLocation: (playTone: PlayToneFn, now: number) => {
    playTone(784, now, 0.1);             // G5
    playTone(988, now + 0.1, 0.1);       // B5
    playTone(1175, now + 0.2, 0.15);     // D6
  },

  driverWaitingOutside: (playTone: PlayToneFn, now: number) => {
    playTone(659, now, 0.08);            // E5
    playTone(784, now + 0.08, 0.08);     // G5
    playTone(880, now + 0.18, 0.12);     // A5
  },

  driverCarInfo: (playTone: PlayToneFn, now: number) => {
    playTone(523, now, 0.1);             // C5
    playTone(659, now + 0.1, 0.1);       // E5
    playTone(784, now + 0.2, 0.12);      // G5
  }
};

// Show browser notification
export const showNotification = async (title: string, body: string, options?: {
  tag?: string;
  requireInteraction?: boolean;
  duration?: number;
}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: options?.tag || 'ride-notification',
      requireInteraction: options?.requireInteraction || false
    });

    if (options?.duration) {
      setTimeout(() => notification.close(), options.duration);
    }

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }
  return null;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
};

// Complete notification trigger (sound + vibration + browser notification)
export const triggerNotification = (
  soundType: keyof typeof SoundTypes,
  vibrationPattern: number[],
  title: string,
  body: string,
  options?: { tag?: string; requireInteraction?: boolean; duration?: number }
) => {
  playSound(soundType);
  vibrate(vibrationPattern);
  showNotification(title, body, options);
};
