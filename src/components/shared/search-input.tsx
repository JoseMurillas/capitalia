"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUrlParams } from "@/hooks/use-url-params";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  paramName?: string;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
};

/** Debounced search box bound to a URL query parameter. */
export function SearchInput({
  paramName = "q",
  placeholder = "Buscar…",
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const { searchParams, setParams } = useUrlParams();
  const current = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(current);
  const lastPushed = useRef(current);

  useEffect(() => {
    if (value === lastPushed.current) return;
    const timeout = setTimeout(() => {
      lastPushed.current = value;
      setParams({ [paramName]: value.trim() }, { resetPage: true });
    }, debounceMs);
    return () => clearTimeout(timeout);
  }, [value, paramName, debounceMs, setParams]);

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-8 pr-8"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => setValue("")}
          aria-label="Limpiar búsqueda"
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
