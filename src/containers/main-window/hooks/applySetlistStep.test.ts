/**
 * `applySetlistStep` is the one place that turns a step into engine calls,
 * shared by the runner and by clicking a step in the editor. It used to stop
 * at `set_beat_groups`, so a step built as real 6/8 (compound, `[3, 3]`)
 * played back as two ordinary 3-beat groups — the same wrong accent the
 * metronome page itself had before `compoundMeter` existed.
 */
import { describe, expect, it } from "vitest";
import { applySetlistStep } from "./applySetlistStep";
import { mockInvoke } from "../../../test/mocks";
import type { SetlistStep } from "../../../types";

function step(over: Partial<SetlistStep> = {}): SetlistStep {
  return {
    id: "s1",
    name: "Chorus",
    bpm: 100,
    subdivision: 1,
    beatGroups: [4],
    freeMode: false,
    soundType: "click",
    volume: 0.5,
    trigger: { kind: "manual" },
    transition: { kind: "cut" },
    ...over,
  };
}

/** Args of every invoke of `command` so far. */
function callsTo(command: string) {
  return mockInvoke.mock.calls.filter((c) => c[0] === command).map((c) => c[1]);
}

describe("applySetlistStep", () => {
  it("sets compound meter before pushing a compound grouping", () => {
    applySetlistStep(step({ beatGroups: [3, 3], compoundMeter: true }));
    expect(callsTo("set_compound_meter")).toContainEqual({ enabled: true });
    expect(callsTo("set_beat_groups")).toContainEqual({ groups: [3, 3] });
  });

  it("clears compound meter for a step that doesn't carry it", () => {
    applySetlistStep(step());
    expect(callsTo("set_compound_meter")).toContainEqual({ enabled: false });
  });

  it("pushes a step's custom pattern", () => {
    applySetlistStep(step({ customPattern: [3, 1, 2, 1] }));
    expect(callsTo("set_custom_pattern")).toContainEqual({ pattern: [3, 1, 2, 1] });
  });

  it("clears the custom pattern for a step that doesn't carry one, so a custom step left behind doesn't keep clicking", () => {
    applySetlistStep(step());
    expect(callsTo("set_custom_pattern")).toContainEqual({ pattern: [] });
  });
});
