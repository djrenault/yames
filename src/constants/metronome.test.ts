import { describe, it, expect } from "vitest";
import {
  addCustomPulse,
  cycleAccentLevel,
  defaultCustomPattern,
  getTempoMarking,
  getTempoScale,
  MAX_BPM,
  MAX_CUSTOM_PULSES,
  MIN_BPM,
  MIN_CUSTOM_PULSES,
  removeCustomPulse,
  TEMPO_MARKINGS,
  TEMPO_SCALE_LABELS,
  withPulseCycled,
} from "./metronome";

describe("tempo markings", () => {
  it("names the band a tempo falls in, not the nearest one", () => {
    expect(getTempoMarking(130)).toBe("Allegro"); // Vivace starts at 132
    expect(getTempoMarking(132)).toBe("Vivace");
    expect(getTempoMarking(20)).toBe("Grave");
    expect(getTempoMarking(300)).toBe("Prestissimo");
  });

  it("clamps below the first marking rather than returning nothing", () => {
    expect(getTempoMarking(1)).toBe("Grave");
  });
});

describe("tempo ruler scale", () => {
  it("labels only markings that exist", () => {
    // getTempoScale throws on a name TEMPO_MARKINGS does not have, so this
    // both documents the coupling and fails loudly if a marking is renamed.
    expect(() => getTempoScale()).not.toThrow();
    expect(getTempoScale().map((m) => m.label)).toEqual([...TEMPO_SCALE_LABELS]);
  });

  it("positions each label where its tempo actually sits on the slider", () => {
    for (const { label, percent } of getTempoScale()) {
      const bpm = TEMPO_MARKINGS.find(([, name]) => name === label)![0];
      expect(percent).toBeCloseTo(((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100, 6);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    }
  });

  it("keeps each label clear of the next one at the width they are shown at", () => {
    // Five markings are labelled and thirteen are not because a label needs
    // room. Labels are placed at their tempo's position and read left to
    // right, so what matters for each pair is the gap against the width of
    // the LEFT label — not one worst case applied to all of them.
    //
    // The bar comes from the narrowest ruler the labels appear on:
    // metronome.css hides `.tempo-scale` below a 980px window, where the
    // ruler is about 720px. Uppercase 9.5px/700 with 0.06em tracking runs
    // roughly 7.4px per character.
    //
    // An earlier version of this test asserted a flat 9% and passed while
    // "MODERATO" was overlapping "ALLEGRO" on screen — the ruler was
    // rendering at ~515px, not the width the number assumed. The assumption
    // is now written down where it can be checked.
    const RULER_PX = 720;
    const PER_CHAR_PX = 7.4;
    const BREATHING_PX = 6;
    const scale = getTempoScale();
    for (let i = 1; i < scale.length; i++) {
      const gapPx = ((scale[i].percent - scale[i - 1].percent) / 100) * RULER_PX;
      const needed = scale[i - 1].label.length * PER_CHAR_PX + BREATHING_PX;
      expect(
        gapPx,
        `${scale[i - 1].label} would run into ${scale[i].label}`,
      ).toBeGreaterThan(needed);
    }
  });

  it("runs left to right", () => {
    const percents = getTempoScale().map((m) => m.percent);
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
  });
});

describe("custom accent pattern", () => {
  it("defaults to an accent on the first pulse and Weak elsewhere", () => {
    expect(defaultCustomPattern(6)).toEqual([3, 1, 1, 1, 1, 1]);
  });

  it("clamps the default pattern's length to the valid range", () => {
    expect(defaultCustomPattern(0)).toHaveLength(MIN_CUSTOM_PULSES);
    expect(defaultCustomPattern(1000)).toHaveLength(MAX_CUSTOM_PULSES);
  });

  it("cycles a level Off -> Weak -> Medium -> Strong -> Off", () => {
    expect(cycleAccentLevel(0)).toBe(1);
    expect(cycleAccentLevel(1)).toBe(2);
    expect(cycleAccentLevel(2)).toBe(3);
    expect(cycleAccentLevel(3)).toBe(0);
  });

  it("advances only the pulse at the given index", () => {
    expect(withPulseCycled([3, 1, 1], 1)).toEqual([3, 2, 1]);
    expect(withPulseCycled([3, 1, 1], 0)).toEqual([0, 1, 1]);
  });

  it("adds a pulse as Weak, up to the maximum", () => {
    expect(addCustomPulse([3, 1])).toEqual([3, 1, 1]);
    const full = new Array(MAX_CUSTOM_PULSES).fill(1);
    expect(addCustomPulse(full)).toBe(full); // no-op, same reference
  });

  it("removes the last pulse, down to the minimum", () => {
    expect(removeCustomPulse([3, 1, 2])).toEqual([3, 1]);
    const min = [3];
    expect(removeCustomPulse(min)).toBe(min); // no-op, same reference
  });

  it("the correct 6/8 fix: 2 real beats of 3, only the beat-starts above Weak", () => {
    // Strong-weak-weak-Medium-weak-weak — the pattern the built-in "6/8"
    // preset should have produced all along (see engine.rs's custom-pattern
    // branch and its accompanying tests).
    const sixEight = [3, 1, 1, 2, 1, 1];
    expect(sixEight).toHaveLength(6);
    expect(sixEight[0]).toBe(3);
    expect(sixEight[3]).toBe(2);
    expect([1, 2, 4, 5].every((i) => sixEight[i] === 1)).toBe(true);
  });
});
