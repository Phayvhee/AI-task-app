import { useState, useCallback } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { AuthContext } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "";
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

const decodeUser = (authToken) => {
  if (!authToken) return null;
  try {
    return jwtDecode(authToken);
  } catch (err) {
    console.error("Invalid stored token, clearing auth:", err);
    localStorage.removeItem("token");
    return null;
  }
};

const getInitialToken = () => {
  const savedToken = localStorage.getItem("token");
  if (decodeUser(savedToken)) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
    return savedToken;
  }
  return null;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(getInitialToken);
  const [user, setUser] = useState(() => decodeUser(localStorage.getItem("token")));

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete apiClient.defaults.headers.common["Authorization"];
  }, []);

  const login = async (username, password) => {
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    const res = await apiClient.post("/api/auth/login", {
      username,
      password,
    });

    const token = res.data.token;
    localStorage.setItem("token", token);
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setToken(token);
    setUser(decodeUser(token));
    return res.data;
  };

  const register = async (username, password) => {
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    const res = await apiClient.post("/api/auth/register", {
      username,
      password,
    });

    const token = res.data.token;
    localStorage.setItem("token", token);
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setToken(token);
    setUser(decodeUser(token));
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
};
