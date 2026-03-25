import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

type AuthState = "checking" | "ok" | "unauthorized";

interface Props {
  children: React.ReactNode;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function ProtectedRoute({ children }: Props) {
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
        });
        if (!mounted) return;
        if (res.ok) {
          const user = await res.json();
          const existingRaw = localStorage.getItem("user");
          let existingAccessToken: string | null = null;
          if (existingRaw) {
            try {
              const existing = JSON.parse(existingRaw) as { accessToken?: string };
              if (typeof existing?.accessToken === "string") {
                existingAccessToken = existing.accessToken;
              }
            } catch {
              existingAccessToken = null;
            }
          }
          localStorage.setItem(
            "user",
            JSON.stringify({
              accessToken: existingAccessToken,
              email: user?.email,
              nickname: user?.nickname,
              role: user?.role,
            })
          );
          setAuthState("ok");
          return;
        }
        localStorage.removeItem("user");
        setAuthState("unauthorized");
      } catch {
        if (!mounted) return;
        localStorage.removeItem("user");
        setAuthState("unauthorized");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (authState === "checking") {
    return <div className="pt-24 text-center text-white/70">인증 확인 중...</div>;
  }

  if (authState === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
