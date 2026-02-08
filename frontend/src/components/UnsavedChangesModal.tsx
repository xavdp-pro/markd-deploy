import React, { useEffect } from 'react';
import { AlertTriangle, Save, Trash2, X, Loader2 } from 'lucide-react';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';

const UnsavedChangesModal: React.FC = () => {
  const { showModal, confirmDiscard, confirmSave, cancelAction, isSaving } = useUnsavedChanges();

  // Handle Escape key
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelAction();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, cancelAction]);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={cancelAction}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={cancelAction}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertTriangle size={28} className="text-amber-600 dark:text-amber-400" />
        </div>

        {/* Title */}
        <h3 className="mb-2 text-center text-lg font-bold text-gray-900 dark:text-white">
          Unsaved changes
        </h3>

        {/* Description */}
        <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
          You have unsaved changes. What would you like to do?
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {/* Save & Continue */}
          <button
            onClick={confirmSave}
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save and continue
              </>
            )}
          </button>

          {/* Discard */}
          <button
            onClick={confirmDiscard}
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-100 active:scale-[0.98] dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
            Discard changes
          </button>

          {/* Cancel */}
          <button
            onClick={cancelAction}
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-500 transition-all hover:bg-gray-100 active:scale-[0.98] dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesModal;
