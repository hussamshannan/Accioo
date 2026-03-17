import { useAuth } from "../../contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <span className="loading-text">Loading...</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
