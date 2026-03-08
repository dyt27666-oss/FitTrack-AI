import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
import { Food } from "../types";
import { searchFoods } from "../services/aiClient";

interface FoodSearchSelectProps {
  selectedFood: Food | null;
  onSelect: (food: Food) => void;
  placeholder?: string;
  helperText?: string;
  className?: string;
  useAI?: boolean;
}

export function FoodSearchSelect({
  selectedFood,
  onSelect,
  placeholder = "搜索食物",
  helperText,
  className = "",
  useAI = true,
}: FoodSearchSelectProps) {
  const [query, setQuery] = useState(selectedFood?.name || "");
  const [results, setResults] = useState<Food[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchTokenRef = useRef(0);

  useEffect(() => {
    setQuery(selectedFood?.name || "");
  }, [selectedFood?.id, selectedFood?.name]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const token = ++searchTokenRef.current;
    setIsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = (await searchFoods(trimmed, useAI)) as unknown as Food[];
        if (searchTokenRef.current !== token) return;
        setResults(found);
        setIsOpen(true);
      } finally {
        if (searchTokenRef.current === token) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query, useAI]);

  const hasResults = useMemo(() => results.length > 0, [results]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-2xl bg-[#F8F9FA] px-12 py-4 pr-12 font-bold outline-none ring-0 transition-all focus:ring-2 focus:ring-black"
        />
        {isLoading && (
          <LoaderCircle className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-black/30" size={18} />
        )}
      </div>

      {helperText && <p className="text-[10px] font-bold text-black/35">{helperText}</p>}

      {isOpen && (
        <div className="rounded-2xl border border-black/5 bg-[#F8F9FA] p-2 shadow-sm">
          {hasResults ? (
            <div className="space-y-1">
              {results.map((food) => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => {
                    onSelect(food);
                    setQuery(food.name);
                    setResults([]);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all hover:bg-white"
                >
                  <span className="font-bold">{food.name}</span>
                  <span className="text-xs font-bold text-black/35">
                    {Math.round(food.calories_per_100g ?? food.calories)} kcal/100g
                  </span>
                </button>
              ))}
            </div>
          ) : (
            !isLoading && <p className="px-3 py-4 text-xs font-bold text-black/35">没有匹配结果</p>
          )}
        </div>
      )}
    </div>
  );
}
