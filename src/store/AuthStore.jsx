import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";

export const useAuthStore = create(() => ({
  loginGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  },

  logout: async () => {
    await supabase.auth.signOut();
  },
}));
