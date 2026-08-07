"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface SortOption {
  value: string;
  label: string;
}

interface ListToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: SortOption[];
  onExport?: () => void;
}

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  sortValue,
  onSortChange,
  sortOptions,
  onExport,
}: ListToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="max-w-xs"
      />
      {sortOptions && onSortChange && (
        <Select value={sortValue} onChange={(e) => onSortChange(e.target.value)} className="w-auto">
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
      {onExport && (
        <Button variant="secondary" size="sm" onClick={onExport} className="ml-auto">
          <Download className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
          Export CSV
        </Button>
      )}
    </div>
  );
}
