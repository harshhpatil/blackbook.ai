"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, invalidateCsrfToken } from "./api-client";

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  avatarUrl?: string;
  collegeName?: string;
  branch?: string;
  guideName?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  credits: number;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  refetchCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const refetchCredits = useCallback(async () => {
    try {
      const data = await api.credits.getBalance();
      if (typeof data.balance === "number") {
        setCredits(data.balance);
      } else if (typeof data.credits === "number") {
        setCredits(data.credits);
      }
    } catch {
      // User might be unauthenticated
    }
  }, []);

  const refetchUser = useCallback(async () => {
    try {
      const data = await api.user.getProfile();
      const profile = data.profile || data.user || data;
      if (profile?._id) {
        setUser(profile);
        await refetchCredits();
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refetchCredits]);

  useEffect(() => {
    refetchUser();
  }, [refetchUser]);

  const login = async (email: string, password: string) => {
    await api.auth.login({ email, password });
    await refetchUser();
  };

  const register = async (name: string, email: string, password: string) => {
    await api.auth.register({ name, email, password });
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network/auth errors during logout cleanup
    } finally {
      setUser(null);
      setCredits(0);
      invalidateCsrfToken();
      router.push("/signin");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        credits,
        loading,
        login,
        register,
        logout,
        refetchUser,
        refetchCredits,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
