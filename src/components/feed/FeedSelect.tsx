import React, { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type FeedSelectOption = {
  value: string;
  label: string;
};

interface FeedSelectProps {
  label: string;
  value: string;
  options: FeedSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

// A feed-specific lightweight select built on Popover + Command to avoid Radix Select auto-scroll side effects.
export const FeedSelect = ({ label, value, options, onChange, placeholder }: FeedSelectProps) => {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? placeholder ?? "Select",
    [options, value, placeholder]
  );

  return (
    <div className="flex w-full flex-col gap-1 sm:flex-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between rounded-xl border border-border/60 bg-background px-3 py-3 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="truncate text-left">{selectedLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(current) => {
                      onChange(current);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <span>{option.label}</span>
                    <Check
                      className={cn(
                        "h-4 w-4 text-primary",
                        option.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default FeedSelect;
