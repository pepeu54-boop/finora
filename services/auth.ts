import { supabase } from './supabase';

export const authService = {
  // Login with Email/Password
  async login(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  // Register new user
  async register(email: string, password: string) {
    return await supabase.auth.signUp({
      email,
      password,
    });
  },

  // Logout
  async logout() {
    return await supabase.auth.signOut();
  },

  // Password Recovery
  async resetPasswordForEmail(email: string) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin, // Redirects back to app after click
    });
  },

  // Get current session
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  // Get current user
  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  }
};
