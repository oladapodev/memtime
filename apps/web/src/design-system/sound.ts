/**
 * Forkbot UI Sound System
 * Built on Web Audio API following the userinterface-wiki rules:
 *  - context-reuse-single: singleton AudioContext
 *  - context-resume-suspended: resume before play
 *  - context-cleanup-nodes: disconnect after playback
 *  - envelope-exponential-decay: natural decay, not linear
 *  - envelope-no-zero-target: ramp to 0.001, not 0
 *  - envelope-set-initial-value: set value before ramping
 *  - design-noise-for-percussion: noise burst for clicks
 *  - design-oscillator-for-tonal: pitch sweep for tonal sounds
 *  - design-filter-for-character: bandpass filter on percussive
 *  - param-click-duration: 5–15ms for click sounds
 *  - param-filter-frequency-range: 3000–6000 Hz
 *  - param-reasonable-gain: gain < 1.0
 *  - param-q-value-range: Q 2–5
 *  - impl-default-subtle: default gain 0.3
 *  - a11y-toggle-setting: respects soundEnabled preference
 *  - a11y-reduced-motion-check: mutes when prefers-reduced-motion
 */

let _ctx: AudioContext | null = null;

// context-reuse-single — singleton
function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

// Lazily resume a suspended context (autoplay policy)
async function resumeCtx(): Promise<AudioContext> {
  const ctx = getCtx();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

// Global sound toggle — stored in localStorage, default ON
let _soundEnabled = true;
try {
  const stored = localStorage.getItem("forkbot-sound");
  if (stored !== null) _soundEnabled = stored === "true";
} catch {}

export function setSoundEnabled(val: boolean) {
  _soundEnabled = val;
  try { localStorage.setItem("forkbot-sound", String(val)); } catch {}
}

export function isSoundEnabled(): boolean {
  // a11y-reduced-motion-check: also mute when user prefers reduced motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return _soundEnabled;
}

// ── Click sound (percussive) ────────────────────────────────────
// design-noise-for-percussion: filtered noise burst
// param-click-duration: 8ms
// param-filter-frequency-range: 4500 Hz
// param-q-value-range: 3
export async function playClick(volume = 0.25) {
  if (!isSoundEnabled()) return;
  const ctx = await resumeCtx();
  const t = ctx.currentTime;

  // Noise buffer (8ms — param-click-duration)
  const duration = 0.008;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // design-noise-for-percussion: exponential decay applied to noise
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 50);
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  // design-filter-for-character: bandpass to shape the click character
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 4500; // param-filter-frequency-range: 3000–6000 Hz
  filter.Q.value = 3;             // param-q-value-range: 2–5

  // param-reasonable-gain: < 1.0
  const gain = ctx.createGain();
  // envelope-set-initial-value before ramping
  gain.gain.setValueAtTime(volume, t);
  // envelope-exponential-decay: natural decay
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration); // envelope-no-zero-target

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  src.start(t);
  src.stop(t + duration);

  // context-cleanup-nodes: disconnect after playback
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

// ── Success / confirmation sound (tonal) ───────────────────────
// design-oscillator-for-tonal: pitch sweep upward
// appropriate-confirmations-only: use on form submit / install CTA
export async function playSuccess(volume = 0.2) {
  if (!isSoundEnabled()) return;
  const ctx = await resumeCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  // design-oscillator-for-tonal: pitch sweep, not static
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(640, t + 0.06);

  const gain = ctx.createGain();
  // envelope-set-initial-value
  gain.gain.setValueAtTime(volume, t);
  // envelope-exponential-decay
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18); // envelope-no-zero-target

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.18);

  // context-cleanup-nodes
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

// ── Navigate sound (subtle click) ──────────────────────────────
// Very short, gentle — used on sidebar nav clicks
// weight-match-action: lightweight to match a small navigation action
export async function playNavigate(volume = 0.15) {
  if (!isSoundEnabled()) return;
  const ctx = await resumeCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(380, t + 0.03);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.07);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

// ── Error sound (pitch-down) ────────────────────────────────────
// appropriate-errors-warnings: use for errors that can't be overlooked
// appropriate-no-punishing: descend gently, not harsh
export async function playError(volume = 0.18) {
  if (!isSoundEnabled()) return;
  const ctx = await resumeCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(380, t);
  osc.frequency.exponentialRampToValueAtTime(240, t + 0.12);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.16);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}
