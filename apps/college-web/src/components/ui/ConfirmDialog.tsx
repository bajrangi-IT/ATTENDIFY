import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isDestructive?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmText,
  confirmLabel,
  cancelText = 'Cancel',
  variant = 'primary',
  isDestructive = false,
  loading = false,
}) => {
  const handleClose = onCancel || onClose || (() => {});
  const effectiveVariant = isDestructive ? 'danger' : variant;
  const effectiveConfirmText = confirmLabel || confirmText || 'Confirm';

  const Icon = effectiveVariant === 'danger' ? AlertCircle : effectiveVariant === 'warning' ? AlertTriangle : Info;

  const btnStyle = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  }[effectiveVariant];

  const iconStyle = {
    danger: 'text-rose-600 bg-rose-50 border-rose-100',
    warning: 'text-amber-600 bg-amber-50 border-amber-100',
    primary: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  }[effectiveVariant];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-start space-x-3.5">
          <div className={`p-2.5 rounded-xl border shrink-0 ${iconStyle}`}>
            <Icon className="h-6 w-6" />
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pt-1">{message}</p>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition ${btnStyle}`}
          >
            {loading ? 'Processing...' : effectiveConfirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
