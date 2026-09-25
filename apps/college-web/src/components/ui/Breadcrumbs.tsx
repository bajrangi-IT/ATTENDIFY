import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export const Breadcrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  return (
    <nav className="flex items-center space-x-1.5 text-xs text-slate-500 mb-4 select-none">
      <div className="flex items-center hover:text-slate-900 transition-colors cursor-pointer">
        <Home className="h-3.5 w-3.5" />
      </div>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="hover:text-indigo-600 font-medium transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span
              className={`font-semibold ${
                idx === items.length - 1 ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
