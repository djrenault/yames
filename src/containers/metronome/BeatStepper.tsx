import { useTranslation } from "react-i18next";
import {
  addBeatToLastGroup,
  addCustomPulse,
  MAX_CUSTOM_PULSES,
  MAX_FREE_BEATS,
  MIN_CUSTOM_PULSES,
  MIN_FREE_BEATS,
  nextFreeBeatCount,
  prevFreeBeatCount,
  removeBeatFromLastGroup,
  removeCustomPulse,
} from "../../constants/metronome";

/** Clicks per beat, by subdivision. */
const SUBDIVISION_MULTIPLIER: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6,
};

interface BeatStepperProps {
  beatGroups: number[];
  subdivision: number;
  freeMode: boolean;
  onBeatGroupsChange?: (groups: number[]) => void;
  /** True for a 6/8-style additive meter — see AppState.compoundMeter. */
  compoundMeter?: boolean;
  /** Non-empty when a custom accent pattern is active — see GroupEditor. */
  customPattern?: number[];
  onCustomPatternChange?: (next: number[]) => void;
}

/**
 * The bar's length — `− 6 +` — and clicks/bar beside it.
 *
 * It lived at the end of the dots row, which meant it slid sideways every time
 * the bar got longer or shorter: the control moved out from under the pointer
 * at the exact moment you were clicking it repeatedly, which is how you end up
 * pressing the wrong thing. It sits on the meter row now, at a fixed offset —
 * see `.meter-row` in metronome.css, where the position is a grid column
 * rather than the end of a flow.
 *
 * Nothing inside it may resize either, so both numbers are tabular and both
 * their boxes are wide enough for the largest value they can hold. 9 → 10
 * beats must not nudge the `+` a pixel.
 *
 * FREE mode wraps at both ends and so never disables; a grouped meter clamps,
 * because wrapping would discard the grouping. See `addBeatToLastGroup`.
 */
export function BeatStepper({
  beatGroups,
  subdivision,
  freeMode,
  onBeatGroupsChange,
  compoundMeter = false,
  customPattern = [],
  onCustomPatternChange,
}: BeatStepperProps) {
  const { t } = useTranslation();
  const isCustom = customPattern.length > 0;
  const total = isCustom ? customPattern.length : beatGroups.reduce((sum, n) => sum + n, 0);
  // A compound meter's `total` already counts eighth notes (7/8's
  // "3+2+2" sums to 7) — there is no separate Subdivision multiplier to
  // apply on top, unlike a simple meter's beat count.
  const clicksPerBar =
    isCustom || compoundMeter ? total : total * (SUBDIVISION_MULTIPLIER[subdivision] ?? 1);

  return (
    <div className="beat-stepper-row">
      <div
        className="beat-stepper"
        role="group"
        aria-label={t("metronome.beatCount", { count: total })}
      >
        <button
          className="beat-stepper-btn"
          onClick={() => {
            if (isCustom) onCustomPatternChange?.(removeCustomPulse(customPattern));
            else {
              onBeatGroupsChange?.(
                freeMode ? [prevFreeBeatCount(total)] : removeBeatFromLastGroup(beatGroups),
              );
            }
          }}
          disabled={isCustom ? total <= MIN_CUSTOM_PULSES : !freeMode && total <= MIN_FREE_BEATS}
          aria-label={t("metronome.removeBeat")}
        >
          −
        </button>
        <span className="beat-stepper-value">{total}</span>
        <button
          className="beat-stepper-btn"
          onClick={() => {
            if (isCustom) onCustomPatternChange?.(addCustomPulse(customPattern));
            else {
              onBeatGroupsChange?.(
                freeMode ? [nextFreeBeatCount(total)] : addBeatToLastGroup(beatGroups),
              );
            }
          }}
          disabled={isCustom ? total >= MAX_CUSTOM_PULSES : !freeMode && total >= MAX_FREE_BEATS}
          aria-label={t("metronome.addBeat")}
        >
          +
        </button>
      </div>
      <span className="beat-clicks">
        {t("metronome.clicksPerBar", { count: clicksPerBar })}
      </span>
    </div>
  );
}
