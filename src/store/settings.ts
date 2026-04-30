// Single source of truth for every localStorage key the game touches.
//
// Existing call sites (hooks, components) still read/write directly from their
// own keys for legacy reasons — this module's main job is to provide:
//   1. A typed catalog so we can never forget a key when wiping data
//   2. Export / import for backup or future cross-device sync
//   3. A single "wipe everything" button (data privacy, dev reset, etc.)
//
// If you add a new persistent setting, register its key here.

export const STORAGE_KEYS = {
  bestScore:           'penguin_best',
  muted:               'penguin_muted',
  playerName:          'penguin_player_name',
  skin:                'penguin_skin_v1',
  achievements:        'penguin_achievements_v1',
  dailyRecord:         'penguin_daily_v1',
  onboardingDone:      'penguin_onboarding_done',
  installPromptShown:  'penguin_install_prompt_shown',
  savedGame:           'penguin_saved_game_v1',
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;

/** Snapshot all stored values as a JSON-serializable object. */
export function exportSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return out;
  for (const key of Object.values(STORAGE_KEYS)) {
    const v = localStorage.getItem(key);
    if (v !== null) out[key] = v;
  }
  return out;
}

/** Returns a downloadable JSON string. */
export function exportSettingsJson(): string {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: exportSettings(),
  }, null, 2);
}

/**
 * Restore settings from a previously exported JSON string. Unknown keys are
 * ignored. Returns true on success.
 */
export function importSettings(json: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const parsed = JSON.parse(json) as { settings?: Record<string, unknown> };
    if (!parsed.settings || typeof parsed.settings !== 'object') return false;

    const validKeys = new Set<string>(Object.values(STORAGE_KEYS));
    for (const [k, v] of Object.entries(parsed.settings)) {
      if (!validKeys.has(k)) continue; // ignore unknown keys
      if (typeof v !== 'string') continue;
      localStorage.setItem(k, v);
    }
    return true;
  } catch {
    return false;
  }
}

/** Wipe every key this game owns (preserves other apps' data on the same origin). */
export function clearAllSettings(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of Object.values(STORAGE_KEYS)) {
    try { localStorage.removeItem(key); } catch { /* private mode */ }
  }
}

/** Trigger a download of the current settings as a JSON file. */
export function downloadSettingsAsFile(filename = 'penguin-settings.json'): void {
  const json = exportSettingsJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
