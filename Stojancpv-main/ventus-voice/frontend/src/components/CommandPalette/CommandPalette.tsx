/**
 * CommandPalette Component
 * Cmd+K style command palette with fuzzy search
 */

import { useEffect, useRef } from "react";
import { Search, Command as CommandIcon, ArrowRight, CornerDownLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { useCommandPalette, categoryLabels, type Command } from "../../hooks/useCommandPalette";

interface CommandPaletteProps {
  className?: string;
}

export function CommandPalette({ className }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const {
    isOpen,
    query,
    groupedCommands,
    selectedIndex,
    close,
    search,
    executeCommand,
    executeSelected,
    commands,
    setSelectedIndex,
  } = useCommandPalette();

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Calculate flat index for groupedCommands
  const getFlatIndex = (categoryIndex: number, commandIndex: number): number => {
    let index = 0;
    for (let i = 0; i < categoryIndex; i++) {
      index += groupedCommands[i].commands.length;
    }
    return index + commandIndex;
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && close()}>
      <DialogContent
        className={cn("sm:max-w-[640px] p-0 gap-0 overflow-hidden", className)}
        onOpenAutoFocus={e => e.preventDefault()}
        onEscapeKeyDown={e => {
          // UX: first Escape clears the query, second Escape closes.
          // Prevent Radix from closing the dialog when there is an active query.
          if (query.trim()) {
            e.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search Input */}
        <div className="flex items-center border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" aria-hidden="true" />
          <Input
            ref={inputRef}
            placeholder="Type a command or search..."
            value={query}
            onChange={e => search(e.target.value)}
            className="border-0 p-0 h-auto focus-visible:ring-0 text-base placeholder:text-muted-foreground"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={selectedIndex >= 0 ? `command-item-${selectedIndex}` : undefined}
            role="combobox"
            aria-expanded="true"
          />
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <kbd
              className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground"
              aria-label="Press Escape to close"
            >
              <span className="text-xs">ESC</span>
            </kbd>
          </div>
        </div>

        {/* Commands List */}
        <ScrollArea className="max-h-[400px]">
          {commands.length === 0 ? (
            <div className="py-12 text-center" role="status" aria-live="polite">
              <CommandIcon
                className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50"
                aria-hidden="true"
              />
              <p className="text-muted-foreground">No commands found</p>
              <p className="text-sm text-muted-foreground/60">Try a different search term</p>
            </div>
          ) : (
            <div
              id="command-list"
              className="py-2"
              role="listbox"
              aria-label="Available commands"
              aria-live="polite"
            >
              {groupedCommands.map((group, groupIndex) => (
                <div key={group.category} role="group" aria-labelledby={`group-${group.category}`}>
                  {/* Category Header */}
                  <div className="px-4 py-2">
                    <span
                      id={`group-${group.category}`}
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {group.label}
                    </span>
                  </div>

                  {/* Commands */}
                  {group.commands.map((command, commandIndex) => {
                    const flatIndex = getFlatIndex(groupIndex, commandIndex);
                    const isSelected = selectedIndex === flatIndex;

                    return (
                      <button
                        key={command.id}
                        id={`command-item-${flatIndex}`}
                        ref={el => (itemRefs.current[flatIndex] = el)}
                        role="option"
                        aria-selected={isSelected}
                        aria-label={`${command.name}${command.description ? `: ${command.description}` : ""}`}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150",
                          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                        )}
                        onClick={() => executeCommand(command)}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                      >
                        {/* Icon */}
                        {command.icon && (
                          <command.icon
                            className="h-5 w-5 text-muted-foreground shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        {!command.icon && (
                          <ArrowRight
                            className="h-5 w-5 text-muted-foreground shrink-0"
                            aria-hidden="true"
                          />
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{command.name}</p>
                          {command.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {command.description}
                            </p>
                          )}
                        </div>

                        {/* Shortcut or Enter indicator */}
                        <div className="shrink-0">
                          {command.shortcut ? (
                            <kbd
                              className="inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground"
                              aria-label={`Keyboard shortcut: ${command.shortcut}`}
                            >
                              {command.shortcut}
                            </kbd>
                          ) : isSelected ? (
                            <CornerDownLeft
                              className="h-4 w-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-2 bg-muted/30">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-xs">
                <span>&#8593;</span>
              </kbd>
              <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-xs">
                <span>&#8595;</span>
              </kbd>
              <span className="ml-1">to navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-xs">
                <span>Enter</span>
              </kbd>
              <span className="ml-1">to select</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Open with</span>
            <kbd className="inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs">
              <CommandIcon className="h-3 w-3" />K
            </kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Trigger button for command palette
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const { open } = useCommandPalette();

  return (
    <button
      onClick={open}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground rounded-lg border bg-muted/50 hover:bg-muted transition-colors",
        className
      )}
      aria-label="Open command palette (Ctrl+K or Cmd+K)"
      aria-keyshortcuts="Control+K Meta+K"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Search commands...</span>
      <kbd
        className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-xs font-medium"
        aria-hidden="true"
      >
        <CommandIcon className="h-3 w-3" />K
      </kbd>
    </button>
  );
}
