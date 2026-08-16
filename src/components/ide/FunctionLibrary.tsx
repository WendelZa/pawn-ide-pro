import { useState } from "react";
import { SNIPPET_CATEGORIES } from "@/lib/pawn/library";

interface FunctionLibraryProps {
  onInsert: (code: string) => void;
  onReplaceAll: (code: string) => void;
}

export function FunctionLibrary({ onInsert, onReplaceAll }: FunctionLibraryProps) {
  const [open, setOpen] = useState<string>("basico");

  return (
    <div className="min-h-0 flex-1 overflow-auto text-[12.5px]">
      {SNIPPET_CATEGORIES.map((cat) => {
        const isOpen = open === cat.id;
        return (
          <div key={cat.id} className="border-b border-sidebar-border/70">
            <button
              onClick={() => setOpen(isOpen ? "" : cat.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sidebar-foreground transition-colors hover:bg-accent/60"
            >
              <span className="text-primary">{cat.icon}</span>
              <span className="font-medium">{cat.label}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {cat.snippets.length} {isOpen ? "▾" : "▸"}
              </span>
            </button>
            {isOpen && (
              <ul className="pb-1">
                {cat.snippets.map((s) => (
                  <li key={s.name}>
                    <button
                      onClick={() =>
                        s.name.startsWith("Modelo completo") ? onReplaceAll(s.code) : onInsert(s.code)
                      }
                      title={s.description}
                      className="block w-full px-3 py-1.5 pl-8 text-left text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                    >
                      <span className="tk-function">{s.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {s.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
