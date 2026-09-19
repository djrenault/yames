import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Setlist } from "../../types";

function ListPlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="15" y2="18" />
      <line x1="4" y1="6" x2="4" y2="6.01" />
      <line x1="4" y1="12" x2="4" y2="12.01" />
      <path d="M18 16v6" />
      <path d="M15 19h6" />
    </svg>
  );
}

interface AddToSetlistButtonProps {
  setlists: Setlist[];
  /** The setlist "add" last landed the current state in, or null. */
  feedback: string | null;
  onAdd: (setlistId: string) => void;
  onAddNew: (name: string) => void;
}

/**
 * "Add to setlist" (U9.8) — dial something in on the metronome page (more
 * room for options than the setlist paragraph has) and save it as a step
 * without leaving. The picker sorts by most recently touched: the setlist
 * you are actively building is the one you are about to add another bar to.
 *
 * Lives in the header rather than the setlist tab because that is where the
 * thing being added lives — the metronome's current dial-in, not a setlist
 * you already have open.
 */
export function AddToSetlistButton({ setlists, feedback, onAdd, onAddNew }: AddToSetlistButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sorted = [...setlists].sort(
    (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
  );

  const close = () => {
    setOpen(false);
    setCreating(false);
    setName("");
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  function commitNew() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddNew(trimmed);
    close();
  }

  return (
    <div className="header-add-setlist-wrap" ref={wrapRef}>
      <button
        className={`context-chip ${open ? "context-chip-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tooltip={!open ? t("setlist.addToSetlistTooltip") : undefined}
      >
        <ListPlusIcon />
        <span className="context-chip-label">
          {feedback ? t("setlist.addedTo", { name: feedback }) : t("setlist.addToSetlist")}
        </span>
      </button>
      {open && (
        <div className="header-sound-menu header-add-setlist-menu" role="menu">
          {sorted.length === 0 && !creating && (
            <div className="add-setlist-empty">{t("setlist.pickerEmpty")}</div>
          )}
          {sorted.map((c) => (
            <button
              key={c.id}
              role="menuitem"
              className="sub-dropdown-item add-setlist-item"
              onClick={() => {
                onAdd(c.id);
                close();
              }}
            >
              <span className="add-setlist-name">{c.name}</span>
              <span className="add-setlist-count">
                {t("setlist.librarySteps", { count: c.steps.length })}
              </span>
            </button>
          ))}
          {sorted.length > 0 && <div className="add-setlist-divider" role="separator" />}
          {creating ? (
            <form
              className="add-setlist-new-form"
              onSubmit={(e) => {
                e.preventDefault();
                commitNew();
              }}
            >
              <input
                ref={inputRef}
                className="add-setlist-new-input"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder={t("setlist.untitled")}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setCreating(false);
                    setName("");
                  }
                }}
              />
            </form>
          ) : (
            <button
              role="menuitem"
              className="sub-dropdown-item add-setlist-new-btn"
              onClick={() => setCreating(true)}
            >
              + {t("setlist.newSetlist")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
