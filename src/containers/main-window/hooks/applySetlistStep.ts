import {
  setBeatGroups,
  setBpm,
  setCompoundMeter,
  setCustomPattern,
  setFreeMode,
  setSoundType,
  setSubdivision,
  setVolume,
} from "../../../ipc";
import type { SetlistStep, Subdivision } from "../../../types";

/**
 * Push a step's configuration onto the engine.
 *
 * Two callers need this and they must agree exactly: the runner applies a
 * step when the setlist lands on it, and selecting a step in the track applies
 * it so the metronome underneath is showing the thing you are editing. Two
 * copies would be two definitions of what a step *is*.
 *
 * Order is not load-bearing for the runner — every one of its applications
 * lands on a downbeat, so the `measure_beat` reset that `set_beat_groups`
 * triggers is a no-op there. Selecting a step while stopped has no bar to
 * cut in half either.
 *
 * `customPattern` is applied unconditionally, empty or not: it takes over
 * from `beatGroups` whenever it's non-empty (see `GroupEditor`), so leaving
 * a custom step behind must clear it, exactly as `MeterPresets.handleSelect`
 * clears it when leaving Custom for a stock preset. `compoundMeter` goes
 * before `beatGroups` for the same reason `MeterPresets` orders them that
 * way: the interpretation before the array it applies to.
 *
 * Each call is guarded on its own: one setter rejecting must not take the
 * rest of the step's configuration down with it, the same rule
 * `handleLoadPreset` follows.
 */
export function applySetlistStep(step: SetlistStep): void {
  void setBpm(step.bpm).catch(() => {});
  void setSubdivision(step.subdivision as Subdivision).catch(() => {});
  void setCustomPattern(step.customPattern ?? []).catch(() => {});
  void setCompoundMeter(step.compoundMeter ?? false).catch(() => {});
  if (step.beatGroups.length > 0) void setBeatGroups(step.beatGroups).catch(() => {});
  if (typeof step.freeMode === "boolean") void setFreeMode(step.freeMode).catch(() => {});
  void setSoundType(step.soundType).catch(() => {});
  void setVolume(step.volume).catch(() => {});
}
