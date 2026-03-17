import { Outlet } from "react-router-dom";
import useMediaQuery from "../../hooks/useMediaQuery";
import HomePage from "../../pages/HomePage";

export default function DesktopLayout() {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!isDesktop) return <Outlet />;

  return (
    <div className="desktop-shell">
      <aside className="desktop-sidebar">
        <HomePage />
      </aside>
      <main className="desktop-main">
        <Outlet />
      </main>
    </div>
  );
}
