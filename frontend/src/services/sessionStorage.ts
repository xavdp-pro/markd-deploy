import { SessionState } from '../types';

const SESSION_KEY = 'markd_session_state';

class SessionStorageService {
  saveState(state: SessionState) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving session state:', error);
    }
  }

  loadState(): SessionState | null {
    try {
      const data = window.sessionStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading session state:', error);
      return null;
    }
  }

  clearState() {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error('Error clearing session state:', error);
    }
  }
}

export const sessionStorageService = new SessionStorageService();