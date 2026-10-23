import { createContext, useState, useCallback, useEffect } from "react";
import api from "../services/api";

export const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);


  const login = useCallback((userData) => {
    setUser(userData)
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.get('/users/logout')
    } catch (error) {
      console.log(error);
    } finally {
      setUser(null)
    }

  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await api.get('/users/me');
        setUser(response.data);
      } catch (err) {
        console.log(err);
        setUser(null);
      } finally {
        setLoading(false)
      }
    };
    checkSession();
  }, [])

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {!loading && children}
    </UserContext.Provider>
  );
}
