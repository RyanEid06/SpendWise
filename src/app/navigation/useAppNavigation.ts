import { useCallback, useReducer } from 'react';
import { PrimaryScreen, Screen } from '../../types';

export const PRIMARY_SCREENS: readonly PrimaryScreen[] = ['home', 'history', 'insights', 'statistics'];

export interface AppNavigationSnapshot {
  currentScreen: Screen;
  settingsReturnScreen: PrimaryScreen;
}

type AppNavigationAction =
  | { type: 'select-primary'; screen: PrimaryScreen }
  | { type: 'open-settings' }
  | { type: 'close-settings' };

export const INITIAL_APP_NAVIGATION: AppNavigationSnapshot = {
  currentScreen: 'home',
  settingsReturnScreen: 'home',
};

export function reduceAppNavigation(
  state: AppNavigationSnapshot,
  action: AppNavigationAction
): AppNavigationSnapshot {
  switch (action.type) {
    case 'select-primary':
      return {
        currentScreen: action.screen,
        settingsReturnScreen: action.screen,
      };
    case 'open-settings':
      if (state.currentScreen === 'settings') return state;
      return {
        currentScreen: 'settings',
        settingsReturnScreen: state.currentScreen,
      };
    case 'close-settings':
      return {
        ...state,
        currentScreen: state.settingsReturnScreen,
      };
  }
}

export function useAppNavigation() {
  const [state, dispatch] = useReducer(reduceAppNavigation, INITIAL_APP_NAVIGATION);

  const selectPrimaryScreen = useCallback((screen: PrimaryScreen) => {
    dispatch({ type: 'select-primary', screen });
  }, []);

  const openSettings = useCallback(() => {
    dispatch({ type: 'open-settings' });
  }, []);

  const closeSettings = useCallback(() => {
    dispatch({ type: 'close-settings' });
  }, []);

  return {
    ...state,
    selectPrimaryScreen,
    openSettings,
    closeSettings,
  };
}
