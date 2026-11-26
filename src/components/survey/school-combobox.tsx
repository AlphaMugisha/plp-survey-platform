"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, School, Search } from "lucide-react";
import { cn, matchesSearch } from "@/lib/utils";

/**
 * Searchable school selector over the full original list.
 *
 * School names are rendered and submitted VERBATIM. Search is
 * accent- and case-insensitive and token-based so "college immaculee" finds
 * "Collège de l'Immaculée Conception", but the stored value is always the
 * original string, untouched.
 *
 * Implemented directly on Popover + a filtered listbox rather than a generic
 * combobox library so the 180-item list stays keyboard-navigable and the
 * selected value can never be coerced to a normalised form.
 */
export function SchoolCombobox({
  id,
  options,
  value,
  onChange,
  onBlur,
  placeholder = "Choose",
  invalid,
  describedBy,
  disabled,
}: {
  id: string;
  options: string[];
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listboxId = `${id}__listbox`;

  const filtered = React.useMemo(
    () => options.filter((option) => matchesSearch(option, query)),
    [options, query],
  );

  // Keep the highlighted row valid as the list narrows.
  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // When opening, start on the current selection so it is visible.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const current = value ? options.indexOf(value) : -1;
    setActiveIndex(current >= 0 ? current : 0);
  }, [open, options, value]);

  // Scroll the highlighted row into view.
  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function commit(option: string) {
    onChange(option);
    setOpen(false);
    onBlur?.();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) commit(option);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onBlur={() => {
            if (!open) onBlur?.();
          }}
          className={cn(
            "flex h-12 w-full items-center justify-between gap-3 rounded-xl border bg-surface px-4",
            "text-left text-[0.9375rem] shadow-subtle",
            "transition-all duration-200 ease-premium",
            "hover:border-forest-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
            invalid ? "border-destructive" : "border-border",
            open && !invalid && "border-forest-400 shadow-glow-emerald",
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <School className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <span className={cn("truncate", value ? "text-ink" : "text-ink-faint")}>
              {value || placeholder}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className={cn(
            "z-50 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border",
            "bg-surface shadow-float",
            "data-[state=open]:animate-scale-in",
          )}
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          {/* Search */}
          <div className="relative border-b border-border/70">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                filtered[activeIndex] ? `${listboxId}__${activeIndex}` : undefined
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search schools…"
              className={cn(
                "h-12 w-full bg-transparent pl-11 pr-4 text-[0.9375rem] text-ink",
                "placeholder:text-ink-faint focus:outline-none",
              )}
            />
          </div>

          {/* Results */}
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Schools"
            className="scroll-slim max-h-[min(20rem,50vh)] overflow-y-auto p-1.5"
          >
            {filtered.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-sm text-ink-muted">
                No school matches “{query}”.
                <span className="mt-1.5 block text-[0.8125rem] text-ink-faint">
                  Try a shorter search, or part of the school&apos;s name.
                </span>
              </p>
            ) : (
              filtered.map((option, index) => {
                const selected = option === value;
                const active = index === activeIndex;
                return (
                  <div
                    key={option}
                    id={`${listboxId}__${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={selected}
                    onClick={() => commit(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5",
                      "text-[0.9375rem] leading-snug transition-colors duration-150",
                      active ? "bg-forest-50 text-forest-800" : "text-ink-soft",
                      selected && "font-medium text-forest-800",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0 text-forest-600",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    {/* exact original name */}
                    <span className="min-w-0">{option}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border/70 bg-cream px-4 py-2.5 text-[0.75rem] text-ink-faint">
            {filtered.length} of {options.length} schools
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
