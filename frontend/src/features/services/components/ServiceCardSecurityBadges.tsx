import { Globe, Lock, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";

import type { Service } from "../api/serviceApi";

export function ServiceCardSecurityBadges({ service }: { service: Service }) {
  return (
    <>
      <TlsBadge tlsEnabled={service.tls_enabled} />
      <AuthBadge service={service} />
    </>
  );
}

function TlsBadge({ tlsEnabled }: { tlsEnabled: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tlsEnabled
          ? "bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-200"
          : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400",
      )}
    >
      <Globe className="h-3 w-3" />
      {tlsEnabled ? "TLS 설정" : "TLS 없음"}
    </span>
  );
}

function AuthBadge({ service }: { service: Service }) {
  if (service.auth_mode === "authentik") {
    return (
      <span className={authBadgeClassName("bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200")}>
        <ShieldCheck className="h-3 w-3" />
        Authentik
      </span>
    );
  }

  if (service.auth_mode === "token") {
    return (
      <span className={authBadgeClassName("border border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-200")}>
        <Lock className="h-3 w-3" />
        Token
      </span>
    );
  }

  if (service.basic_auth_enabled) {
    return (
      <span className={authBadgeClassName("bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200")}>
        <Lock className="h-3 w-3" />
        Basic Auth ({service.basic_auth_user_count})
      </span>
    );
  }

  return (
    <span className={authBadgeClassName("bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400")}>
      <Lock className="h-3 w-3" />
      인증 없음
    </span>
  );
}

function authBadgeClassName(colorClassName: string) {
  return clsx(
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
    colorClassName,
  );
}
