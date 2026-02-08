import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface UnsavedChangesContextType {
  /** Whether there are unsaved changes in the current module */
  hasUnsavedChanges: boolean;
  /** Set the unsaved changes flag with optional save/discard callbacks */
  setUnsavedChanges: (
    dirty: boolean,
    callbacks?: { onSave?: () => Promise<void>; onDiscard?: () => void }
  ) => void;
  /** Try to proceed with an action — shows modal if dirty, otherwise runs action immediately */
  guardAction: (action: () => void) => void;
  /** Internal: modal state */
  showModal: boolean;
  /** Internal: confirm (discard) the pending action */
  confirmDiscard: () => void;
  /** Internal: save then proceed */
  confirmSave: () => void;
  /** Internal: cancel the pending action */
  cancelAction: () => void;
  /** Whether a save is in progress */
  isSaving: boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export const UnsavedChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dirty, setDirty] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const onSaveRef = useRef<(() => Promise<void>) | undefined>();
  const onDiscardRef = useRef<(() => void) | undefined>();
  const pendingActionRef = useRef<(() => void) | undefined>();

  const setUnsavedChanges = useCallback(
    (
      flag: boolean,
      callbacks?: { onSave?: () => Promise<void>; onDiscard?: () => void }
    ) => {
      setDirty(flag);
      onSaveRef.current = callbacks?.onSave;
      onDiscardRef.current = callbacks?.onDiscard;
    },
    []
  );

  const guardAction = useCallback(
    (action: () => void) => {
      if (dirty) {
        pendingActionRef.current = action;
        setShowModal(true);
      } else {
        action();
      }
    },
    [dirty]
  );

  const confirmDiscard = useCallback(() => {
    setShowModal(false);
    setDirty(false);
    // Call discard callback (e.g. unlock document)
    if (onDiscardRef.current) {
      onDiscardRef.current();
    }
    // Execute the pending action
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = undefined;
    }
  }, []);

  const confirmSave = useCallback(async () => {
    if (onSaveRef.current) {
      setIsSaving(true);
      try {
        await onSaveRef.current();
        setShowModal(false);
        setDirty(false);
        // Execute the pending action after successful save
        if (pendingActionRef.current) {
          pendingActionRef.current();
          pendingActionRef.current = undefined;
        }
      } catch (err) {
        console.error('Error saving before navigation:', err);
        // Keep modal open on save error
      } finally {
        setIsSaving(false);
      }
    }
  }, []);

  const cancelAction = useCallback(() => {
    setShowModal(false);
    pendingActionRef.current = undefined;
  }, []);

  // Warn user when closing/refreshing browser tab with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges: dirty,
        setUnsavedChanges,
        guardAction,
        showModal,
        confirmDiscard,
        confirmSave,
        cancelAction,
        isSaving,
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
};
