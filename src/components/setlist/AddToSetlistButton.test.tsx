import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddToSetlistButton } from "./AddToSetlistButton";
import type { Setlist } from "../../types";

function setlist(over: Partial<Setlist> = {}): Setlist {
  return {
    id: "c1",
    name: "Warm-up",
    createdAt: 0,
    repeat: 1,
    steps: [],
    ...over,
  };
}

function openPicker(props: Partial<Parameters<typeof AddToSetlistButton>[0]> = {}) {
  const onAdd = vi.fn();
  const onAddNew = vi.fn();
  const view = render(
    <AddToSetlistButton setlists={[]} feedback={null} onAdd={onAdd} onAddNew={onAddNew} {...props} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /add to setlist|added to/i }));
  return { ...view, onAdd, onAddNew };
}

describe("AddToSetlistButton", () => {
  it("lists setlists most-recently-touched first", () => {
    const older = setlist({ id: "old", name: "Older", createdAt: 1, updatedAt: 10 });
    const newer = setlist({ id: "new", name: "Newer", createdAt: 2, updatedAt: 20 });
    openPicker({ setlists: [older, newer] });
    const names = screen.getAllByRole("menuitem").map((b) => b.textContent);
    expect(names[0]).toContain("Newer");
    expect(names[1]).toContain("Older");
  });

  it("falls back to createdAt when a setlist predates updatedAt", () => {
    const legacy = setlist({ id: "legacy", name: "Legacy", createdAt: 5 });
    const fresh = setlist({ id: "fresh", name: "Fresh", createdAt: 1, updatedAt: 100 });
    openPicker({ setlists: [legacy, fresh] });
    const names = screen.getAllByRole("menuitem").map((b) => b.textContent);
    expect(names[0]).toContain("Fresh");
  });

  it("adds to the setlist you click, and closes the picker", () => {
    const { onAdd } = openPicker({ setlists: [setlist()] });
    fireEvent.click(screen.getByText("Warm-up"));
    expect(onAdd).toHaveBeenCalledWith("c1");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("says what an empty library looks like, without hiding the new-setlist option", () => {
    openPicker({ setlists: [] });
    expect(screen.getByText(/no setlists yet/i)).toBeInTheDocument();
    expect(screen.getByText(/new setlist/i)).toBeInTheDocument();
  });

  it("creates a new setlist by name from the picker's own input", () => {
    const { onAddNew } = openPicker({ setlists: [] });
    fireEvent.click(screen.getByText(/\+ new setlist/i));
    const input = screen.getByPlaceholderText("New setlist");
    fireEvent.change(input, { target: { value: "Encore" } });
    fireEvent.submit(input.closest("form")!);
    expect(onAddNew).toHaveBeenCalledWith("Encore");
  });

  it("shows the last add as feedback on the button itself", () => {
    render(
      <AddToSetlistButton setlists={[]} feedback="Warm-up" onAdd={vi.fn()} onAddNew={vi.fn()} />,
    );
    expect(screen.getByText(/added to warm-up/i)).toBeInTheDocument();
  });
});
