/**
 * FullscreenView feature preservation tests.
 *
 * Locks in:
 * - Renders the BPM display
 * - Escape key calls onExit
 * - Double-click on the root calls onExit
 * - Renders 7 zen-style options (focus/pulse/gravity/radar/cosmos/warp/rain)
 *   when the theme picker is opened
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { FullscreenView } from "./FullscreenView";
import { DEFAULT_TEST_STATE } from "../../test/mocks";

const baseProps = {
  state: DEFAULT_TEST_STATE,
  currentBeat: null,
  activeTab: "beat" as const,
};

describe("FullscreenView", () => {
  it("renders the BPM number", () => {
    const { container } = render(
      <FullscreenView {...baseProps} onExit={vi.fn()} />,
    );
    const bpm = container.querySelector(".fs-bpm");
    expect(bpm?.textContent).toContain("120");
  });

  it("pressing Escape calls onExit", () => {
    const onExit = vi.fn();
    render(<FullscreenView {...baseProps} onExit={onExit} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onExit).toHaveBeenCalled();
  });

  it("double-click on the root calls onExit", () => {
    const onExit = vi.fn();
    const { container } = render(
      <FullscreenView {...baseProps} onExit={onExit} />,
    );
    const root = container.querySelector(".fullscreen-view") as HTMLElement;
    fireEvent.doubleClick(root);
    expect(onExit).toHaveBeenCalled();
  });

  it("clicking theme trigger reveals 7 zen-style options", async () => {
    const { container } = render(
      <FullscreenView {...baseProps} onExit={vi.fn()} />,
    );
    const trigger = container.querySelector(".zen-theme-trigger") as HTMLElement;
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger);
    await waitFor(() => {
      const opts = container.querySelectorAll(".zen-theme-option");
      expect(opts.length).toBe(7);
    });
  });

  /**
   * The Zen drill tab took its dot count from `ramp.beatsPerBar` while
   * `activeBeat` is the engine's `measureBeat` — which the engine only
   * wraps at `beatsPerBar` WHILE THE RAMP IS RUNNING. With the ramp
   * stopped in a meter longer than beatsPerBar, `measureBeat` ran past
   * the last rendered dot and nothing ever lit.
   */
  /**
   * The Zen view had its own copy of the beat-grouping logic, unaware of
   * `compoundMeter` — a real 6/8 (`beatGroups: [3, 3]`, compound) drew six
   * flat "group" dots and only ever lit the first two, since the engine's
   * `measureBeat` in compound mode counts the 2 real beats, not the 6
   * eighth notes. `GroupEditor` (the metronome screen) already drew this
   * correctly; this locks Zen's copy of it in too.
   */
  describe("compound meter dots", () => {
    const sixEight = {
      ...DEFAULT_TEST_STATE,
      timeSignature: 6,
      beatGroups: [3, 3],
      compoundMeter: true,
    };
    const beat = (measureBeat: number, subdivision = 0, isDownbeat = subdivision === 0) => ({
      beat: measureBeat,
      measureBeat,
      subdivision,
      isDownbeat,
      isAccent: measureBeat === 0 && isDownbeat,
    });

    it("draws one big dot per real beat, not one per eighth note", () => {
      const { container } = render(
        <FullscreenView state={sixEight} currentBeat={beat(0)} activeTab="beat" onExit={vi.fn()} />,
      );
      expect(container.querySelectorAll(".fs-group-cluster").length).toBe(2);
      expect(container.querySelectorAll(".fs-beat").length).toBe(2);
    });

    it("draws the eighth-note sub-dots under each real beat", () => {
      const { container } = render(
        <FullscreenView state={sixEight} currentBeat={beat(0)} activeTab="beat" onExit={vi.fn()} />,
      );
      // 3 eighth notes per beat = 2 sub-dots left over after the big one.
      expect(container.querySelectorAll(".fs-sub-dot").length).toBe(4);
    });

    it("lights the second real beat's dot, not a sixth flat one", () => {
      const { container } = render(
        <FullscreenView state={sixEight} currentBeat={beat(1)} activeTab="beat" onExit={vi.fn()} />,
      );
      expect(container.querySelectorAll(".fs-beat.active").length).toBe(1);
      const clusters = container.querySelectorAll(".fs-group-cluster");
      expect(clusters[1].querySelector(".fs-beat.active")).not.toBeNull();
    });

    it("lights the sub-dot for the eighth note within the real beat", () => {
      const { container } = render(
        <FullscreenView state={sixEight} currentBeat={beat(0, 1, false)} activeTab="beat" onExit={vi.fn()} />,
      );
      const subDots = container.querySelectorAll(".fs-sub-dot");
      expect(subDots[0].className).toContain("active");
    });
  });

  describe("drill tab dot count", () => {
    const sevenEight = {
      ...DEFAULT_TEST_STATE,
      timeSignature: 7,
      beatGroups: [3, 2, 2],
      speedRamp: { ...DEFAULT_TEST_STATE.speedRamp, beatsPerBar: 4 },
    };
    const beat = (measureBeat: number) => ({
      beat: measureBeat,
      measureBeat,
      subdivision: 0,
      isDownbeat: true,
      isAccent: measureBeat === 0,
    });

    it("uses the meter total when the ramp is NOT active", () => {
      const { container } = render(
        <FullscreenView
          state={sevenEight}
          currentBeat={beat(6)}
          activeTab="drill"
          onExit={vi.fn()}
        />,
      );
      expect(container.querySelectorAll(".fs-beat").length).toBe(7);
      // Bar position 6 exists and lights — under the old formula only
      // four dots were drawn and this beat lit nothing.
      expect(container.querySelectorAll(".fs-beat.active").length).toBe(1);
    });

    it("uses the ramp's beatsPerBar while the ramp IS active", () => {
      const rampOn = {
        ...sevenEight,
        speedRamp: {
          ...sevenEight.speedRamp,
          active: true,
          warmupCount: 4,
          warmupBeats: 4,
        },
      };
      const { container } = render(
        <FullscreenView
          state={rampOn}
          currentBeat={beat(2)}
          activeTab="drill"
          onExit={vi.fn()}
        />,
      );
      expect(container.querySelectorAll(".fs-beat").length).toBe(4);
      expect(container.querySelectorAll(".fs-beat.active").length).toBe(1);
    });

    it("lights a dot for every bar position in both ramp states", () => {
      for (const [state, bars] of [
        [sevenEight, 7],
        [
          {
            ...sevenEight,
            speedRamp: {
              ...sevenEight.speedRamp,
              active: true,
              warmupCount: 4,
              warmupBeats: 4,
            },
          },
          4,
        ],
      ] as const) {
        for (let pos = 0; pos < bars; pos++) {
          const { container, unmount } = render(
            <FullscreenView
              state={state}
              currentBeat={beat(pos)}
              activeTab="drill"
              onExit={vi.fn()}
            />,
          );
          expect(
            container.querySelectorAll(".fs-beat.active").length,
            `bar position ${pos} of ${bars} lit no dot`,
          ).toBe(1);
          unmount();
        }
      }
    });
  });
});
