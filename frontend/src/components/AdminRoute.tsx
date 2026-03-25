import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { adminApi } from "../services/adminApi";

type AuthUser = {
  role?: string;
};

function isAdminRole(role?: string) {
  const normalized = (role || "").toUpperCase();
  return normalized === "ADMIN" || normalized === "ROLE_ADMIN";
}

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const userRaw = localStorage.getItem("user");
      const localUser = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
      if (!isAdminRole(localUser?.role)) {
        if (!cancelled) setAllowed(false);
        return;
      }

      try {
        const me = await adminApi.getMe();
        if (!cancelled) setAllowed(isAdminRole(me.role));
      } catch {
        if (!cancelled) setAllowed(false);
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === null) {
    return (
      <section className="min-h-screen bg-slate-950 px-6 pt-28 text-white lg:px-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6">
          관리자 권한 확인 중...
        </div>
      </section>
    );
  }

  if (!allowed) {
    return (
      <Navigate
        to="/forbidden"
        replace
        state={{ reason: "관리자 권한이 필요하거나 세션이 만료되었습니다." }}
      />
    );
  }

  return <>{children}</>;
}
