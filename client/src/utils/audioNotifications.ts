// Web Audio API beep generation utilities
const MUTE_STORAGE_KEY = 'notification_sound_muted';

// Alert frequencies for different notification types
const ALERT_FREQUENCIES = {
  jobAssignment: 440,    // A4 note
  cycleTimeAlert: 880,   // A5 note (higher, more urgent)
};

let audioContext: AudioContext | null = null;

/**
 * Check if notifications are muted (from localStorage)
 */
export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set the muted state (persists to localStorage)
 */
export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // localStorage not available
  }
}

/**
 * Toggle the muted state and return the new state
 */
export function toggleMute(): boolean {
  const newMuted = !isMuted();
  setMuted(newMuted);
  return newMuted;
}

/**
 * Initialize the audio context (must be called from a user interaction)
 */
export function initAudioContext(): void {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Resume the audio context if it's suspended
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

/**
 * Play a beep sound with given parameters
 */
export function playBeep(frequency: number, duration: number, volume: number = 0.3): void {
  if (isMuted()) return;

  // Initialize audio context if not already done
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }

  // Resume context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  // Fade in and out to avoid clicking
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

/**
 * Play job assignment notification - two quick beeps at 440Hz
 */
export function playJobAssignmentBeep(): void {
  if (isMuted()) return;

  const frequency = ALERT_FREQUENCIES.jobAssignment;
  const beepDuration = 0.15;
  const pauseDuration = 0.1;

  // First beep
  playBeep(frequency, beepDuration, 0.4);

  // Second beep after pause
  setTimeout(() => {
    playBeep(frequency, beepDuration, 0.4);
  }, (beepDuration + pauseDuration) * 1000);
}

/**
 * Play cycle time alert notification - three ascending beeps (more urgent)
 */
export function playCycleTimeAlertBeep(): void {
  if (isMuted()) return;

  const baseFrequency = ALERT_FREQUENCIES.cycleTimeAlert;
  const beepDuration = 0.12;
  const pauseDuration = 0.08;

  // Three ascending beeps
  playBeep(baseFrequency, beepDuration, 0.5);

  setTimeout(() => {
    playBeep(baseFrequency * 1.25, beepDuration, 0.5);
  }, (beepDuration + pauseDuration) * 1000);

  setTimeout(() => {
    playBeep(baseFrequency * 1.5, beepDuration, 0.5);
  }, (beepDuration + pauseDuration) * 2 * 1000);
}
