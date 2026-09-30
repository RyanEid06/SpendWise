import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Screen } from '../../types';

export type AndroidBackAction =
  | 'close-attachment-viewer'
  | 'close-native-layer'
  | 'close-expense-editor'
  | 'close-budget'
  | 'close-settings'
  | 'go-home'
  | 'exit-app';

export interface AndroidBackState {
  attachmentViewerOpen: boolean;
  nativeBackLayerOpen: boolean;
  expenseEditorOpen: boolean;
  budgetModalOpen: boolean;
  currentScreen: Screen;
}

export function resolveAndroidBackAction(state: AndroidBackState): AndroidBackAction {
  if (state.attachmentViewerOpen) return 'close-attachment-viewer';
  if (state.nativeBackLayerOpen) return 'close-native-layer';
  if (state.expenseEditorOpen) return 'close-expense-editor';
  if (state.budgetModalOpen) return 'close-budget';
  if (state.currentScreen === 'settings') return 'close-settings';
  if (state.currentScreen !== 'home') return 'go-home';
  return 'exit-app';
}

interface UseAndroidBackOptions {
  currentScreen: Screen;
  expenseEditorOpen: boolean;
  budgetModalOpen: boolean;
  closeExpenseEditor: () => void;
  closeBudgetModal: () => void;
  closeSettings: () => void;
  goHome: () => void;
}

export function useAndroidBack({
  currentScreen,
  expenseEditorOpen,
  budgetModalOpen,
  closeExpenseEditor,
  closeBudgetModal,
  closeSettings,
  goHome,
}: UseAndroidBackOptions): void {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let disposed = false;
    let removeBackListener: (() => Promise<void>) | null = null;

    void CapacitorApp.addListener('backButton', () => {
      const action = resolveAndroidBackAction({
        attachmentViewerOpen: Boolean(document.querySelector('[data-attachment-viewer="true"]')),
        nativeBackLayerOpen: Boolean(document.querySelector('[data-native-back-layer="true"]')),
        expenseEditorOpen,
        budgetModalOpen,
        currentScreen,
      });

      switch (action) {
        case 'close-attachment-viewer':
          window.dispatchEvent(new Event('spendwise-close-attachment-preview'));
          return;
        case 'close-native-layer':
          window.dispatchEvent(new Event('spendwise-native-back'));
          return;
        case 'close-expense-editor':
          closeExpenseEditor();
          return;
        case 'close-budget':
          closeBudgetModal();
          return;
        case 'close-settings':
          closeSettings();
          return;
        case 'go-home':
          goHome();
          return;
        case 'exit-app':
          void CapacitorApp.exitApp();
          return;
      }
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        removeBackListener = () => handle.remove();
      }
    });

    return () => {
      disposed = true;
      if (removeBackListener) void removeBackListener();
    };
  }, [
    budgetModalOpen,
    closeBudgetModal,
    closeExpenseEditor,
    closeSettings,
    currentScreen,
    expenseEditorOpen,
    goHome,
  ]);
}
