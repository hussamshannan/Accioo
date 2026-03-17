import { createContext, useContext, useEffect, useState } from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/react";
import { API_URL } from "../utils/constants";
import { setTokenGetter } from "../services/api";
import { setUploadTokenGetter } from "../services/uploadService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useClerkAuth();
  const [dbUser, setDbUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Wire Clerk token into Axios and XHR upload instances
  useEffect(() => {
    setTokenGetter(() => getToken());
    setUploadTokenGetter(() => getToken());
  }, [getToken]);

  // Sync Clerk user with MongoDB user
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setDbUser(null);
      setIsAuthReady(true);
      return;
    }

    const syncUser = async () => {
      try {
        const token = await getToken() || "";
        const res = await fetch(`${API_URL}/api/auth/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            username: user.username || user.firstName || "User",
            displayName: user.fullName || user.firstName || "User",
            avatarUrl: user.imageUrl,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setDbUser(data.user);
        }
      } catch (err) {
        console.error("Failed to sync user:", err);
      } finally {
        setIsAuthReady(true);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, user]);

  return (
    <AuthContext.Provider
      value={{
        isLoaded,
        isSignedIn,
        clerkUser: user,
        dbUser,
        setDbUser,
        isAuthReady,
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
