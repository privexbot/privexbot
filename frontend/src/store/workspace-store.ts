/**
 * Workspace Store - Global workspace state
 *
 * WHY:
 * - Current workspace context
 * - User preferences
 * - Navigation state
 *
 * HOW:
 * - Zustand for state management
 * - Persist to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
}

interface Workspace {
  id: string;
  name: string;
  org_id: string;
}

interface WorkspaceState {
  user: User | null;
  currentWorkspace: Workspace | null;
  setUser: (user: User | null) => void;
  setWorkspace: (workspace: Workspace | null) => void;
  logout: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      user: null,
      currentWorkspace: null,

      setUser: (user) => set({ user }),

      setWorkspace: (workspace) => set({ currentWorkspace: workspace }),

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, currentWorkspace: null });
      },
    }),
    {
      name: 'workspace-storage',
    }
  )
);
