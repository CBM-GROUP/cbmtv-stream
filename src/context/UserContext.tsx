"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { login as loginService, getUserProfile } from "@/services/accounts";
import apiClient from "@/services/api";

interface User {
  // Define your user properties here, e.g., id, email, name
  id: number;
  email: string;
  // ... other properties
}

import { LoginData } from "@/types";

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const response = await getUserProfile();
          setUser(response.data);
        } catch (error) {
          console.error("Failed to fetch user profile", error);
          // Token might be invalid, so log out
          logout();
        }
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  const login = async (data: LoginData) => {
    const response = await loginService(data);
    const access_token = response.data.access;
    const refresh_token = response.data.refresh;
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    apiClient.defaults.headers.common["Authorization"] =
      `Bearer ${access_token}`;
    const profileResponse = await getUserProfile();
    setUser(profileResponse.data);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    delete apiClient.defaults.headers.common["Authorization"];
    setUser(null);
  };

  const isAuthenticated = !!user;

  return (
    <UserContext.Provider
      value={{ user, isAuthenticated, login, logout, loading }}
    >
      {children}
    </UserContext.Provider>
  );
};
