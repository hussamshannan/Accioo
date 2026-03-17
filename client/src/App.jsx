import { Routes, Route, Navigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ChatProvider } from "./contexts/ChatContext";
import { CallProvider } from "./contexts/CallContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import DesktopLayout from "./components/layout/DesktopLayout";
import useMediaQuery from "./hooks/useMediaQuery";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import ContactsPage from "./pages/ContactsPage";
import UserProfilePage from "./pages/UserProfilePage";
import ProfilePage from "./pages/ProfilePage";
import StoryViewerPage from "./pages/StoryViewerPage";
import StoryCreatorPage from "./pages/StoryCreatorPage";
import PostViewerPage from "./pages/PostViewerPage";
import ActivityPage from "./pages/ActivityPage";

/* On desktop the sidebar already shows the conversation list, so the index
   route shows a welcome pane. On mobile it shows the full HomePage. */
function HomeRoute() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (!isDesktop) return <HomePage />;
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 bg-card text-muted-foreground select-none">
      <MessageCircle className="w-16 h-16" style={{ opacity: 0.12 }} />
      <p className="text-sm font-medium">Select a conversation to start chatting</p>
    </div>
  );
}

function AppProviders({ children }) {
  return (
    <AuthProvider>
      <SocketProvider>
        <ThemeProvider>
          <ChatProvider>
            <CallProvider>{children}</CallProvider>
          </ChatProvider>
        </ThemeProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        {/* All protected routes share the DesktopLayout (sidebar + main on ≥768px) */}
        <Route
          element={
            <ProtectedRoute>
              <DesktopLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRoute />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<UserProfilePage />} />
          <Route path="/stories/create" element={<StoryCreatorPage />} />
          <Route path="/stories/:userId" element={<StoryViewerPage />} />
          <Route path="/post/:postId" element={<PostViewerPage />} />
          <Route path="/activity" element={<ActivityPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProviders>
  );
}

export default App;
