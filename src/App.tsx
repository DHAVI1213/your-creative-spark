import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { AppShell } from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ToolWorkspace from "./pages/ToolWorkspace";
import Checkout from "./pages/Checkout";
import NotFound from "./pages/NotFound";

function RotaApp({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/entrar" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route
            path="/app"
            element={
              <RotaApp>
                <AppShell />
              </RotaApp>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path=":toolId" element={<ToolWorkspace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
