// Retro Chiptune & Arcade Sound Synthesizer (Web Audio API)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicPlaying = false;
    this.currentTheme = 'overworld';
    this.musicTimer = null;
    this.stepIndex = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic();
    } else {
      this.startMusic(this.currentTheme);
    }
    return this.muted;
  }

  playTone(freq, type, duration, vol = 0.12, slideFreq = null, delay = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideFreq), now + duration);
    }

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  jump(isMega = false) {
    this.playTone(isMega ? 160 : 210, 'square', 0.22, 0.11, isMega ? 540 : 660);
  }

  coin() {
    this.playTone(987.77, 'square', 0.08, 0.10, null, 0);
    this.playTone(1318.51, 'square', 0.26, 0.10, null, 0.075);
  }

  stomp() {
    this.playTone(420, 'triangle', 0.08, 0.16, 150, 0);
    this.playTone(580, 'square', 0.12, 0.10, 820, 0.05);
  }

  kick() {
    this.playTone(180, 'sawtooth', 0.09, 0.15, 620, 0);
  }

  bump() {
    this.playTone(150, 'triangle', 0.10, 0.18, 75, 0);
  }

  breakBlock() {
    this.playTone(220, 'sawtooth', 0.07, 0.14, 90, 0);
    this.playTone(160, 'square', 0.12, 0.12, 55, 0.05);
  }

  powerupAppear() {
    const notes = [330, 392, 659, 523, 587, 784];
    notes.forEach((n, i) => this.playTone(n, 'square', 0.07, 0.09, null, i * 0.055));
  }

  powerupCollect() {
    const notes = [330, 392, 659, 523, 587, 784, 1046];
    notes.forEach((n, i) => this.playTone(n, 'triangle', 0.09, 0.14, null, i * 0.055));
  }

  oneUp() {
    const notes = [330, 392, 659, 523, 587, 784];
    notes.forEach((n, i) => this.playTone(n * 1.25, 'square', 0.09, 0.11, null, i * 0.07));
  }

  shoot() {
    this.playTone(680, 'square', 0.11, 0.10, 220, 0);
  }

  hurt() {
    const notes = [440, 392, 349, 293, 220];
    notes.forEach((n, i) => this.playTone(n, 'sawtooth', 0.09, 0.12, null, i * 0.06));
  }

  flagpole() {
    const notes = [261, 329, 392, 523, 659, 784, 1046];
    notes.forEach((n, i) => this.playTone(n, 'square', 0.11, 0.11, null, i * 0.07));
  }

  levelClear() {
    this.stopMusic();
    const melody = [
      [523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.24],
      [784, 0.12], [1046, 0.45]
    ];
    let t = 0;
    melody.forEach(([freq, dur]) => {
      this.playTone(freq, 'square', dur, 0.13, null, t);
      this.playTone(freq * 0.5, 'triangle', dur, 0.12, null, t);
      t += dur + 0.03;
    });
  }

  gameOver() {
    this.stopMusic();
    const melody = [
      [523, 0.16], [392, 0.16], [329, 0.22],
      [440, 0.16], [493, 0.16], [440, 0.16],
      [392, 0.22], [349, 0.22], [329, 0.4]
    ];
    let t = 0;
    melody.forEach(([freq, dur]) => {
      this.playTone(freq, 'triangle', dur, 0.14, null, t);
      t += dur + 0.03;
    });
  }

  startMusic(theme = 'overworld') {
    this.currentTheme = theme;
    this.stopMusic();
    if (this.muted) return;
    this.init();
    this.musicPlaying = true;
    this.stepIndex = 0;

    // Upbeat Mario-inspired chiptune loops
    const themes = {
      overworld: {
        tempo: 145,
        lead: [
          659, 659, 0, 659, 0, 523, 659, 0,
          784, 0, 0, 0, 392, 0, 0, 0,
          523, 0, 0, 392, 0, 0, 330, 0,
          0, 440, 0, 494, 0, 466, 440, 0,
          392, 659, 784, 880, 0, 698, 784, 0,
          659, 0, 523, 587, 494, 0, 0, 0
        ],
        bass: [
          131, 0, 196, 0, 262, 0, 196, 0,
          196, 0, 131, 0, 98, 0, 131, 0,
          131, 0, 165, 0, 196, 0, 165, 0,
          147, 0, 175, 0, 196, 0, 147, 0,
          131, 0, 196, 0, 220, 0, 175, 0,
          165, 0, 131, 0, 147, 0, 196, 0
        ]
      },
      underground: {
        tempo: 130,
        lead: [
          262, 523, 220, 440, 233, 466, 0, 0,
          262, 523, 220, 440, 233, 466, 0, 0,
          175, 349, 147, 294, 156, 311, 0, 0,
          175, 349, 147, 294, 156, 311, 294, 262
        ],
        bass: [
          131, 0, 110, 0, 116, 0, 98, 0,
          131, 0, 110, 0, 116, 0, 98, 0,
          87, 0, 73, 0, 78, 0, 65, 0,
          87, 0, 73, 0, 78, 0, 98, 0
        ]
      },
      castle: {
        tempo: 110,
        lead: [
          294, 311, 294, 277, 294, 311, 294, 277,
          330, 349, 330, 311, 330, 349, 330, 311,
          392, 415, 392, 370, 392, 415, 392, 370,
          587, 0, 554, 0, 523, 0, 494, 0
        ],
        bass: [
          110, 110, 0, 110, 116, 116, 0, 116,
          123, 123, 0, 123, 131, 131, 0, 131,
          147, 147, 0, 147, 156, 156, 0, 156,
          196, 0, 185, 0, 175, 0, 165, 0
        ]
      },
      star: {
        tempo: 95,
        lead: [
          523, 523, 523, 0, 523, 523, 587, 523,
          494, 494, 494, 0, 494, 494, 523, 494,
          659, 659, 784, 659, 587, 523, 494, 440
        ],
        bass: [
          262, 196, 262, 196, 262, 196, 294, 262,
          247, 196, 247, 196, 247, 196, 262, 247,
          330, 262, 392, 330, 294, 262, 247, 220
        ]
      }
    };

    const data = themes[theme] || themes.overworld;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.musicPlaying) return;
      const i = this.stepIndex % data.lead.length;
      const lNote = data.lead[i];
      const bNote = data.bass[i % data.bass.length];

      if (lNote > 0) {
        this.playTone(lNote, 'square', (data.tempo / 1000) * 0.85, 0.045);
      }
      if (bNote > 0) {
        this.playTone(bNote, 'triangle', (data.tempo / 1000) * 0.9, 0.065);
      }
      this.stepIndex++;
    }, data.tempo);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

window.soundFX = new SoundManager();
