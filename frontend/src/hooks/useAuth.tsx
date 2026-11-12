// Auth Hook and Context
// Preserves existing Clerk + local fallback architecture

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { initClerk, signIn as clerkSignIn, signUp as clerkSignUp, signOut as clerkSignOut, getCurrentUser } from '../services/api';
import { loadProfile, saveProfile } from '../services/storage';

interface UserProfile {
  name: string;
  email?: string;
  /** True for "Continue as guest" sessions (local demo mode, no account). */
  guest?: boolean;
}

interface AuthContextType {
  user: unknown | null;
  profile: UserProfile | null;
  isLoading: boolean;
  authError: string | null;
  isAuthenticated: boolean;
  signIn: (redirectUrl?: string) => Promise<void>;
  signUp: (redirectUrl?: string) => Promise<void>;
  signOut: (redirectUrl?: string) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, publishableKey }: { children: ReactNode; publishableKey?: string }) {
  const [user, setUser] = useState<unknown | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    let mounted = true;
    window.addEventListener('clerk:auth-change', handleAuthChange as EventListener);
    
    async function initializeAuth() {
      try {
        // Load local profile as fallback
        const localProfile = loadProfile();
        if (mounted) {
          setProfileState(localProfile);
        }
        
        // Initialize Clerk if key is provided
        if (publishableKey && !publishableKey.includes('your_clerk_key')) {
          await initClerk(publishableKey);
          if (mounted) {
            setUser(getCurrentUser());
            setProfileState(prev => prev || (getCurrentUser() ? { name: (getCurrentUser() as any)?.firstName || (getCurrentUser() as any)?.username || 'Student' } : null));
          }
        } else {
          console.warn('Clerk publishable key not configured. Using local-only mode.');
        }
      } catch {
        if (mounted) setAuthError('Account sign-in could not connect. Reload to retry, or use a local guest workspace.');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    
    function handleAuthChange(event: Event) {
      if (!mounted) return;
      const customEvent = event as CustomEvent;
      const { session, user: clerkUser } = customEvent.detail;
      
      if (session && clerkUser) {
        setUser(clerkUser);
        const newProfile = { name: (clerkUser as any).firstName || (clerkUser as any).username || 'Student' };
        setProfileState(newProfile);
        saveProfile(newProfile);
      } else {
        setUser(null);
        if (!loadProfile()?.guest) {
          setProfileState(null);
          saveProfile(null);
        }
      }
    }
    
    initializeAuth();
    
    return () => {
      mounted = false;
      window.removeEventListener('clerk:auth-change', handleAuthChange as EventListener);
    };
  }, [publishableKey]);

  const signIn = useCallback(async (redirectUrl = '/app/dashboard') => {
    await clerkSignIn(redirectUrl);
  }, []);

  const signUp = useCallback(async (redirectUrl = '/app/dashboard') => {
    await clerkSignUp(redirectUrl);
  }, []);

  const signOut = useCallback(async (redirectUrl = '/app/') => {
    await clerkSignOut(redirectUrl);
    setUser(null);
    setProfileState(null);
    saveProfile(null);
  }, []);

  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
    saveProfile(newProfile);
    if (newProfile?.guest) setIsLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isLoading,
      authError,
      isAuthenticated: !!user || !!profile,
      signIn,
      signUp,
      signOut,
      setProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
