import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

type Item = { value: string; label: string };

type Props = {
  items: Item[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  dir?: "rtl" | "ltr";
};

export default function SearchableCombobox({
  items,
  value,
  onChange,
  placeholder = "انتخاب کنید…",
  searchPlaceholder = "جستجو...",
  emptyText = "چیزی پیدا نشد",
  className,
  disabled,
  dir = "rtl",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = items.find((i) => String(i.value) === String(value)) || null;

  const join = (...xs: (string | undefined | false)[]) => xs.filter(Boolean).join(" ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={join("w-full justify-between", className)}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[--radix-popover-trigger-width] p-0"
        dir={dir}
      >
        <Command dir={dir}>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((i) => {
                const active = selected?.value === i.value;
                return (
                  <CommandItem
                    key={i.value}
                    value={i.label} // ← فیلتر روی متن لیبل انجام می‌شود
                    onSelect={() => {
                      onChange(i.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={join("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                    {i.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
