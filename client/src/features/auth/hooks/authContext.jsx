import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginUser as loginAPI, loginGoogle as loginGoogleAPI } from "../api/authApi.js";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback((updatedData) => {
    setUser((prevUser) => {
      const newUserState = { ...prevUser, ...updatedData };
      localStorage.setItem("user_info", JSON.stringify(newUserState));
      return newUserState;
    });
  }, []);

  const parseTokenToUser = (token) => {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp < Date.now() / 1000) return null;
      return {
        token,
        ...decoded,
        _id: decoded.userId || decoded._id || decoded.id,
        role: (decoded.role || decoded.system_role || "").toLowerCase()
      };
    } catch (error) { return null; }
  };



  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedInfo = localStorage.getItem("user_info");
    if (token) {
      const userFromToken = parseTokenToUser(token);
      if (userFromToken) {
        const fullUser = storedInfo ? { ...userFromToken, ...JSON.parse(storedInfo) } : userFromToken;
        setUser(fullUser);
      } else { logout(); }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials) => {
      try {
        const data = await loginAPI(credentials);
        const userFromToken = parseTokenToUser(data.token);

        if (userFromToken) {
          const fullUser = { ...userFromToken, ...data.theUser };
          setUser(fullUser);

          localStorage.setItem("token", data.token);
          localStorage.setItem("user_info", JSON.stringify(data.theUser));
          localStorage.setItem("role", (fullUser.role || data.theUser?.role || data.theUser?.system_role || "").toLowerCase());
          localStorage.setItem("position", data.theUser.position || "");
        }
        return data;
      } catch (error) {
        throw error;
      }
    };

    const loginGoogle = async (credentials) => {
      try {
        const data = await loginGoogleAPI(credentials);
        const userFromToken = parseTokenToUser(data.token);

        if (userFromToken) {
          const fullUser = { ...userFromToken, ...data.theUser };
          setUser(fullUser);

          localStorage.setItem("token", data.token);
          localStorage.setItem("user_info", JSON.stringify(data.theUser));
          localStorage.setItem("role", (fullUser.role || data.theUser?.role || data.theUser?.system_role || "").toLowerCase());
          localStorage.setItem("position", data.theUser.position || "");
        }
        return data;
      } catch (error) {
        throw error;
      }
    };

    const logout = () => {
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user_info");
      localStorage.removeItem("role");
      localStorage.removeItem("position");
      window.location.href = "/login";
    };

  return (
    <AuthContext.Provider value={{ user, login, loginGoogle, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
