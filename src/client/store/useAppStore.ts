import { create } from "zustand";
import type { DistilledPersona, TrainingSession, SessionSummary, DualReviewReport } from "../../shared/types";
import { client } from "../api";

interface AppState {
  // Data
  personas: DistilledPersona[];
  selectedPersona: DistilledPersona | null;
  selectedBasePersonaId: string | null;
  sessions: SessionSummary[];
  session: TrainingSession | null;
  review: DualReviewReport | null;
  error: string | null;

  // Actions
  setError: (error: string | null) => void;
  loadPersonas: () => Promise<void>;
  selectBase: (personaId: string) => void;
  loadSessions: (personaId: string) => Promise<void>;
  selectPersona: (persona: DistilledPersona) => void;
  createSession: (personaId: string) => Promise<TrainingSession | null>;
  resumeSession: (sessionId: string) => Promise<void>;
  endAndReview: (sessionId: string) => Promise<void>;
  viewReview: () => void;
  clonePersona: (personaId: string) => Promise<void>;
  deleteClone: (personaId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  resetNavigation: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  personas: [],
  selectedPersona: null,
  selectedBasePersonaId: null,
  sessions: [],
  session: null,
  review: null,
  error: null,

  setError: (error) => set({ error }),

  loadPersonas: async () => {
    try {
      const personas = await client.getPersonas();
      set({ personas });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  selectBase: (personaId) => {
    set({ selectedBasePersonaId: personaId });
  },

  selectPersona: (persona) => {
    set({ selectedPersona: persona });
  },

  loadSessions: async (personaId) => {
    try {
      const sessions = await client.getPersonaSessions(personaId);
      set({ sessions });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  createSession: async (personaId) => {
    try {
      set({ error: null });
      const session = await client.createSession(personaId);
      set({ session, review: null });
      return session;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    }
  },

  resumeSession: async (sessionId) => {
    try {
      set({ error: null });
      const session = await client.getSession(sessionId);
      set({ session });
      if (session.status === "reviewed") {
        try {
          const review = await client.getReview(sessionId);
          set({ review });
        } catch {
          set({ review: null });
        }
      } else {
        set({ review: null });
      }
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  endAndReview: async (sessionId) => {
    try {
      set({ error: null });
      const review = await client.runReview(sessionId);
      const session = await client.getSession(sessionId);
      set({ review, session });
      get().loadPersonas();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  viewReview: () => {
    // Navigation handled by component
  },

  clonePersona: async (personaId) => {
    try {
      set({ error: null });
      const clone = await client.clonePersona(personaId);
      set((state) => ({ personas: [...state.personas, clone] }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  deleteClone: async (personaId) => {
    try {
      set({ error: null });
      await client.deletePersona(personaId);
      set((state) => ({ personas: state.personas.filter((p) => p.id !== personaId) }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  deleteSession: async (sessionId) => {
    if (!confirm("确定要永久删除这个会话吗？\n\n删除后无法恢复，包括聊天记录和复盘数据都会被清除。")) return false;
    try {
      set({ error: null });
      await client.deleteSession(sessionId);
      const { selectedPersona } = get();
      if (selectedPersona) {
        const sessions = await client.getPersonaSessions(selectedPersona.id);
        set({ sessions });
      }
      get().loadPersonas();
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },

  resetNavigation: () => {
    set({
      selectedPersona: null,
      selectedBasePersonaId: null,
      session: null,
      review: null,
      sessions: [],
    });
    get().loadPersonas();
  },
}));
