import { describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetlistParagraph } from "./SetlistParagraph";
import type { Setlist, SetlistStep } from "../../types";

/**
 * The setlist, with every step open.
 *
 * It was one line per step and the clicked one expanded to 191px. That
 * answered "which step am I editing" and not "how does this routine go" —
 * the owner: "clicking on each step to verify how they are transitioning in
 * between is annoying". Expanding at editing size measured 2,443px for twelve
 * steps and showed three at a time, so the SIZE came down instead: the same
 * sentence at reading size, about 75px, with nothing collapsed and nothing
 * that grows.
 *
 * These assert what that buys — every step readable and editable without a
 * click, and a layout that never changes under you — plus the one thing the
 * mockup got wrong, which is that a setlist where every step looks identical
 * has nothing to point at when the transport says "Start at step 3".
 */

function step(over: Partial<SetlistStep> & { id: string; name: string }): SetlistStep {
  return {
    bpm: 96,
    subdivision: 4,
    beatGroups: [4],
    freeMode: false,
    soundType: "wood",
    volume: 0.7,
    trigger: { kind: "bars", bars: 8 },
    transition: { kind: "cut" },
    ...over,
  };
}

const SETLIST: Setlist = {
  id: "c1",
  name: "Warm-up routine",
  createdAt: 0,
  repeat: 1,
  steps: [
    step({ id: "s1", name: "Loosen up", bpm: 70, subdivision: 1 }),
    step({
      id: "s2",
      name: "Alt picking",
      trigger: { kind: "seconds", seconds: 120 },
      transition: { kind: "countIn", bars: 2 },
    }),
    step({
      id: "s3",
      name: "Odd meter",
      bpm: 88,
      subdivision: 2,
      beatGroups: [3, 2, 2],
      trigger: { kind: "manual" },
    }),
  ],
};

function draw(over: Partial<Parameters<typeof SetlistParagraph>[0]> = {}) {
  return render(
    <SetlistParagraph
      setlist={SETLIST}
      selectedStepId="s1"
      onSelectStep={() => {}}
      runningIndex={-1}
      onChange={() => {}}
      onPatchStep={() => {}}
      onAddStep={() => {}}
      {...over}
    />,
  );
}

const blocks = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".setlist-step")];
const dragHandles = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".setlist-step-drag")];

/**
 * The drag lives on `window`'s own `mousemove`/`mouseup`, not on any one
 * row — see the note on `SetlistParagraph`'s drag effect for why (native
 * HTML5 `dragover` only fires intermittently, which is what "sometimes a
 * bar appears, sometimes it doesn't" actually was). Firing on a row still
 * reaches these: both events bubble, and `window` is the top of every
 * bubble chain regardless of where an event started.
 */
function pickUp(handle: HTMLElement) {
  fireEvent.mouseDown(handle, { button: 0 });
}

function moveTo(el: HTMLElement, clientY: number) {
  fireEvent.mouseMove(el, { clientY });
}

function release(el: HTMLElement, clientY: number) {
  fireEvent.mouseUp(el, { clientY });
}

/**
 * happy-dom's `getBoundingClientRect()` returns an all-zero rect with no
 * real layout engine behind it, and `gapFromPoint` needs a real one to tell
 * a drag over the top half of a row from the bottom half. Stacks each row
 * 40px tall starting at 0, so `topOf(i)` / `bottomOf(i)` give a `clientY`
 * that lands unambiguously in one half.
 */
function mockRowRects(container: HTMLElement) {
  blocks(container).forEach((el, i) => {
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: i * 40,
      bottom: i * 40 + 40,
      height: 40,
      left: 0,
      right: 200,
      width: 200,
      x: 0,
      y: i * 40,
      toJSON: () => {},
    });
  });
}
const topOf = (i: number) => i * 40 + 10;
const bottomOf = (i: number) => i * 40 + 30;

describe("every step is open", () => {
  it("draws all of them, not one", () => {
    const { container } = draw();
    expect(blocks(container)).toHaveLength(3);
    expect(container.querySelectorAll(".setlist-sentence-folded")).toHaveLength(3);
  });

  it("says the whole routine without a click, handovers included", () => {
    const { container } = draw();
    const text = container.textContent ?? "";
    for (const said of ["Loosen up", "Alt picking", "Odd meter", "70", "96", "88"]) {
      expect(text).toContain(said);
    }
    // The complaint this exists for: every handover, at the same time.
    expect(text).toContain("8 bars");
    expect(text).toContain("2 min");
    expect(text).toContain("when I say");
    expect(text).toContain("count in 2 bars");
  });

  it("makes the phrases reachable on every step, not just the selected one", () => {
    // A phrase you can read but not press would be the collapsed row again
    // with extra steps.
    const { container } = draw({ selectedStepId: "s1" });
    for (const block of blocks(container)) {
      expect(within(block).getAllByRole("button").length).toBeGreaterThan(4);
    }
  });

  it("routes an edit through onPatchStep, which is what reaches the engine", async () => {
    const onPatchStep = vi.fn();
    const onChange = vi.fn();
    const { container } = draw({ onPatchStep, onChange });
    const third = blocks(container)[2];
    await userEvent.click(within(third).getByText("eighth").closest("button")!);
    await userEvent.click(await screen.findByText("Quarter"));
    expect(onPatchStep).toHaveBeenCalledWith("s3", { subdivision: 1 });
    // `onChange` replaces the whole setlist and does NOT reach the engine.
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("which step Start will begin on", () => {
  it("marks the selected one, and only it", () => {
    // The mockup drew every step accented, which left "Start at step 3" with
    // nothing on screen to point at.
    const { container } = draw({ selectedStepId: "s2" });
    const selected = container.querySelectorAll(".setlist-step.selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("Alt picking");
  });

  it("selects a step when you click one you are not on", () => {
    const onSelectStep = vi.fn();
    const { container } = draw({ selectedStepId: "s1", onSelectStep });
    blocks(container)[2].click();
    expect(onSelectStep).toHaveBeenCalledWith("s3");
  });

  it("marks the running step separately from the selected one", () => {
    // Leaving the player does not stop the run, so both marks exist at once
    // and they are not the same mark.
    const { container } = draw({ selectedStepId: "s3", runningIndex: 0 });
    const running = container.querySelector(".setlist-step.running")!;
    const selected = container.querySelector(".setlist-step.selected")!;
    expect(running.textContent).toContain("Loosen up");
    expect(selected.textContent).toContain("Odd meter");
    expect(running).not.toBe(selected);
  });
});

describe("nothing grows", () => {
  it("gives every step its tools, so a row cannot change height by gaining them", () => {
    // The cards reserved 31px apiece for buttons invisible until hover. These
    // are drawn on every step and revealed with opacity — same reservation,
    // no height.
    const { container } = draw();
    for (const block of blocks(container)) {
      const tools = block.querySelector<HTMLElement>(".setlist-step-tools")!;
      expect(within(tools).getAllByRole("button")).toHaveLength(4);
    }
  });

  it("keeps the tools working without selecting the step they sit on", () => {
    const onChange = vi.fn();
    const onSelectStep = vi.fn();
    const { container } = draw({ selectedStepId: "s1", onChange, onSelectStep });
    const third = blocks(container)[2];
    within(third).getByRole("button", { name: "Remove this step" }).click();
    expect(onChange).toHaveBeenCalled();
    // Removing a step is not a request to edit it.
    expect(onSelectStep).not.toHaveBeenCalled();
  });
});

describe("the rest of the paragraph", () => {
  it("offers the way back to the player only while something is playing", async () => {
    const onBackToPlaying = vi.fn();
    const props = {
      setlist: SETLIST,
      selectedStepId: "s1",
      onSelectStep: () => {},
      onChange: () => {},
      onPatchStep: () => {},
      onAddStep: () => {},
      onBackToPlaying,
    };
    const { rerender } = render(<SetlistParagraph {...props} runningIndex={-1} />);
    expect(screen.queryByText("Back to playing")).toBeNull();

    rerender(<SetlistParagraph {...props} runningIndex={1} />);
    await userEvent.click(screen.getByText("Back to playing"));
    expect(onBackToPlaying).toHaveBeenCalled();
  });

  it("an empty setlist says what a setlist is", () => {
    draw({ setlist: { ...SETLIST, steps: [] }, selectedStepId: null });
    expect(screen.getByText(/plays your steps in order/i)).toBeTruthy();
    expect(screen.getByText("+ Add a step")).toBeTruthy();
  });
});

describe("drag to reorder", () => {
  it("has a handle on every step, on top of the up/down buttons", () => {
    // Pointer-only: the buttons stay as the keyboard/assistive-tech path.
    const { container } = draw();
    expect(dragHandles(container)).toHaveLength(3);
    for (const tools of container.querySelectorAll(".setlist-step-tools")) {
      expect(within(tools as HTMLElement).getAllByRole("button")).toHaveLength(4);
    }
  });

  it("dropping on a row's top half inserts before it", () => {
    const onChange = vi.fn();
    const { container } = draw({ onChange });
    mockRowRects(container);
    pickUp(dragHandles(container)[0]);
    moveTo(blocks(container)[2], topOf(2));
    release(blocks(container)[2], topOf(2));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Setlist;
    // s1 lands directly ahead of s3 — where the line was drawn, not past it.
    expect(next.steps.map((s) => s.id)).toEqual(["s2", "s1", "s3"]);
  });

  it("dropping on a row's bottom half inserts after it", () => {
    const onChange = vi.fn();
    const { container } = draw({ onChange });
    mockRowRects(container);
    pickUp(dragHandles(container)[0]);
    moveTo(blocks(container)[1], bottomOf(1));
    release(blocks(container)[1], bottomOf(1));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Setlist;
    expect(next.steps.map((s) => s.id)).toEqual(["s2", "s1", "s3"]);
  });

  it("shows the line on the hovered row's own top half, and on the next row for its bottom half", () => {
    const { container } = draw();
    mockRowRects(container);
    pickUp(dragHandles(container)[0]);

    const dropline = (i: number) => blocks(container)[i].querySelector(".setlist-step-dropline");

    moveTo(blocks(container)[2], topOf(2));
    expect(dropline(2)?.hasAttribute("data-active")).toBe(true);
    expect(dropline(1)?.hasAttribute("data-active")).toBe(false);

    // The bottom half of row 1 is the same gap as the top of row 2 — the
    // line has to move to row 2's own leading edge either way, since row 1
    // has no trailing indicator of its own.
    moveTo(blocks(container)[1], bottomOf(1));
    expect(dropline(2)?.hasAttribute("data-active")).toBe(true);
    expect(dropline(1)?.hasAttribute("data-active")).toBe(false);
  });

  it("lets you drop after the last step, in the dedicated end zone", () => {
    const onChange = vi.fn();
    const { container } = draw({ onChange });
    mockRowRects(container);
    const endZone = container.querySelector(".setlist-step-end-zone") as HTMLElement;
    expect(endZone).not.toBeNull();

    pickUp(dragHandles(container)[0]);
    moveTo(endZone, bottomOf(2) + 20);
    expect(endZone.querySelector(".setlist-step-dropline")?.hasAttribute("data-active")).toBe(true);

    release(endZone, bottomOf(2) + 20);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Setlist;
    expect(next.steps.map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
  });

  it("marks the picked-up row", () => {
    const { container } = draw();
    pickUp(dragHandles(container)[0]);
    expect(blocks(container)[0].className).toContain("dragging");
  });

  it("puts the cursor in charge of the whole gesture, not just the handle", () => {
    // `.setlist-step` sets its own `cursor: pointer`; without the body
    // class overriding it, dragging over a row would visibly change the
    // cursor away from "grabbing" mid-gesture.
    const { container } = draw();
    pickUp(dragHandles(container)[0]);
    expect(document.body.classList.contains("setlist-reordering")).toBe(true);
    release(blocks(container)[0], topOf(0));
    expect(document.body.classList.contains("setlist-reordering")).toBe(false);
  });

  it("clears the drag markers once it lands", () => {
    const { container } = draw();
    mockRowRects(container);
    pickUp(dragHandles(container)[0]);
    moveTo(blocks(container)[2], topOf(2));
    release(blocks(container)[2], topOf(2));

    for (const block of blocks(container)) {
      expect(block.className).not.toContain("dragging");
      expect(block.querySelector(".setlist-step-dropline")?.hasAttribute("data-active")).toBe(false);
    }
  });

  it("does nothing when dropped back where it already was", () => {
    // Both the gap right before and right after the dragged step are a
    // no-op — dropping it back next to itself is not a move.
    const onChange = vi.fn();
    const { container } = draw({ onChange });
    mockRowRects(container);

    pickUp(dragHandles(container)[1]);
    moveTo(blocks(container)[1], topOf(1));
    release(blocks(container)[1], topOf(1));
    expect(onChange).not.toHaveBeenCalled();

    pickUp(dragHandles(container)[1]);
    moveTo(blocks(container)[1], bottomOf(1));
    release(blocks(container)[1], bottomOf(1));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not select the step just from grabbing its handle", () => {
    const onSelectStep = vi.fn();
    const { container } = draw({ selectedStepId: "s1", onSelectStep });
    fireEvent.click(dragHandles(container)[2]);
    expect(onSelectStep).not.toHaveBeenCalled();
  });
});

describe("a step is a control, not a div that happens to be clickable", () => {
  it("says so in the DOM, which is what Windows clicks depend on", () => {
    /*
     * `useDrag` decides on mousedown whether the pointer is on a control or
     * on window furniture, and it decides for the whole document. A bare
     * `div` with an `onClick` fails that test, so on Windows `startDragging()`
     * takes the mouse and the click never lands; macOS survives it because
     * `startDragging()` rejects on a focused undecorated window.
     *
     * This is the second clickable `div` in this project to cost a
     * Windows-only bug. The assertion is cheap and the bug is invisible on
     * the machine most of this was written on.
     */
    const { container } = draw();
    for (const block of container.querySelectorAll<HTMLElement>(".setlist-step")) {
      expect(block.getAttribute("role")).toBe("button");
      expect(block.getAttribute("tabindex")).toBe("0");
    }
  });

  it("selects from the keyboard as well as the pointer", () => {
    const onSelectStep = vi.fn();
    const { container } = draw({ selectedStepId: "s1", onSelectStep });
    const third = [...container.querySelectorAll<HTMLElement>(".setlist-step")][2];
    third.focus();
    third.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelectStep).toHaveBeenCalledWith("s3");
  });
});
