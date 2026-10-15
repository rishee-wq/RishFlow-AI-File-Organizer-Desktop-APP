import { createContext, useContext } from 'react';

export interface AppActions {
  /** Play the startup animation again */
  replayIntro: () => void;
  /** Return to the welcome / onboarding screen */
  leaveToWelcome: () => void;
}

export const AppActionsContext = createContext<AppActions>({
  replayIntro: () => {},
  leaveToWelcome: () => {},
});

export const useAppActions = () => useContext(AppActionsContext);
