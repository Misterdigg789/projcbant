import React from "react";

type CategoryItem = {
  id?: string;
  value?: string;
  label: string;
  icon?: string;
  gradient?: string;
  isCreate?: boolean;
  isPage?: boolean;
};

type CategoryBarProps = {
  categories: CategoryItem[];
  selectedCategory: string;
  onSelect: (categoryId: string) => void;
  className?: string;
};

export function CategoryBar({ categories, selectedCategory, onSelect, className = "" }: CategoryBarProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="overflow-x-auto py-2">
        <div className="flex md:justify-center overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/20 gap-3 px-4">
          <div className="flex gap-2 md:max-w-[800px]">
            {categories.map((category) => {
              const id = category.id || category.value || category.label;
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => onSelect(id)}
                  className="flex-shrink-0 flex flex-col items-center relative pt-1"
                >
                  <div className="relative">
                    {/* Gradient outline container */}
                    <div
                      className={`w-14 h-14 rounded-full relative transition-all duration-300`}
                    >
                      {/* Gradient border */}
                      <div
                        className={`absolute inset-0 rounded-full bg-gradient-to-r ${category.gradient || "from-gray-300 to-gray-400"}`}
                      />

                      {/* Inner circle with icon */}
                      <div
                        className={`absolute inset-[1px] rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 ${selectedCategory === id ? "scale-105" : "scale-100"} transition-all duration-300`}
                      >
                        {category.icon ? (
                          <img src={category.icon} alt={category.label} className="w-7 h-7" />
                        ) : (
                          <span className="w-7 h-7 inline-block" />
                        )}
                      </div>
                    </div>

                    {/* Category Label Badge */}
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 z-10">
                      <div
                        className={`px-2 py-0.5 rounded-full text-[8px] font-sans font-medium whitespace-nowrap bg-white dark:bg-slate-800 ${selectedCategory === id ? "text-black dark:text-white" : "text-black/60 dark:text-white/60"} transition-all duration-300`}
                      >
                        {category.label}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryBar;
