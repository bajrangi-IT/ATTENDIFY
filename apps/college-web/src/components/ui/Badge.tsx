import React, { ReactNode } from 'react';
import { AttendanceStatus } from '@campusattend/shared-types';

export const StatusBadge: React.FC<{ status: AttendanceStatus | string; className?: string }> = ({
  status,
  className = '',
}) => {
  const normalized = status.toLowerCase();

  const styles: Record<string, string> = {
    present: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    late: 'bg-amber-100 text-amber-800 border-amber-200',
    excused: 'bg-blue-100 text-blue-800 border-blue-200',
    absent: 'bg-rose-100 text-rose-800 border-rose-200',
    pending: 'bg-slate-100 text-slate-800 border-slate-200',
    in_progress: 'bg-indigo-100 text-indigo-800 border-indigo-200 animate-pulse',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
    good: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    critical: 'bg-rose-100 text-rose-800 border-rose-200',
    online: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    offline: 'bg-slate-200 text-slate-700 border-slate-300',
    unpaired: 'bg-amber-100 text-amber-800 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-800 border-rose-200',
    submitted: 'bg-blue-100 text-blue-800 border-blue-200',
    changes_requested: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  const style = styles[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style} ${className}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
};

export const Badge: React.FC<{
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | string;
  className?: string;
  children: ReactNode;
}> = ({ variant = 'default', className = '', children }) => {
  const styles: Record<string, string> = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-rose-100 text-rose-800 border-rose-200',
    info: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };

  const style = styles[variant] || 'bg-slate-100 text-slate-800 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style} ${className}`}
    >
      {children}
    </span>
  );
};
