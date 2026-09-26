import React from 'react';
import { CategorySpend } from '../types';
import { formatCurrency } from '../utils/currency';

interface CategoryBreakdownSectionProps {
  categoryBreakdown: CategorySpend[];
  currencyCode: string;
}

export const CategoryBreakdownSection: React.FC<CategoryBreakdownSectionProps> = ({
  categoryBreakdown,
  currencyCode,
}) => {
  return (
    <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white text-sm sm:text-base">
          Spending by Category
        </h3>
      </div>

      {categoryBreakdown.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          No category data available for this month.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Multi-color distribution bar */}
          <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden flex">
            {categoryBreakdown.map((item) => (
              <div
                key={item.categoryName}
                style={{
                  width: `${Math.max(1, item.percentage)}%`,
                  backgroundColor: item.color,
                }}
                className="h-full transition-all duration-300"
                title={`${item.categoryName}: ${item.percentage.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Detailed category rows */}
          <div className="space-y-3 pt-1">
            {categoryBreakdown.map((item) => (
              <div key={item.categoryName} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">{item.iconEmoji}</span>
                    <span className="font-semibold text-slate-200">
                      {item.categoryName}
                    </span>
                    <span
                      style={{ color: item.color, backgroundColor: `${item.color}20` }}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    >
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <span className="font-bold text-white">
                    {formatCurrency(item.amount, currencyCode)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
