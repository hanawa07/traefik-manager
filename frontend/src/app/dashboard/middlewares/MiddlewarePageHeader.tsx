import { clsx } from "clsx";
import { Plus } from "lucide-react";

import type { MiddlewareTab } from "./middlewarePageHelpers";

interface MiddlewarePageHeaderProps {
  activeTab: MiddlewareTab;
  canManage: boolean;
  templatesCount: number;
  onCreateOpen: () => void;
  onTabChange: (tab: MiddlewareTab) => void;
}

export default function MiddlewarePageHeader({
  activeTab,
  canManage,
  templatesCount,
  onCreateOpen,
  onTabChange,
}: MiddlewarePageHeaderProps) {
  return (
    <>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">미들웨어</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-slate-800 dark:text-slate-300">
              템플릿 {templatesCount}개
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            공용 템플릿과 서비스 저장값으로 자동 생성되는 Traefik 미들웨어를 분리해서 관리합니다.
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
            템플릿은 여러 서비스에 재사용되고, 서비스 자동 생성 항목은 각 서비스 설정을 저장할 때 함께 만들어집니다.
          </p>
        </div>
        {canManage && activeTab === "templates" ? (
          <button className="btn-primary inline-flex w-full items-center justify-center gap-2 lg:w-auto" onClick={onCreateOpen}>
            <Plus className="h-4 w-4" />
            템플릿 추가
          </button>
        ) : null}
      </div>

      <div
        className="mb-6 grid w-full grid-cols-2 rounded-2xl bg-gray-100 p-1 dark:bg-slate-800 sm:inline-flex sm:w-auto"
        data-visual-surface
      >
        <button
          className={clsx(
            "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "templates"
              ? "bg-white text-gray-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
              : "text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100",
          )}
          onClick={() => onTabChange("templates")}
        >
          공유 템플릿
        </button>
        <button
          className={clsx(
            "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "generated"
              ? "bg-white text-gray-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
              : "text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100",
          )}
          onClick={() => onTabChange("generated")}
        >
          서비스 자동 생성
        </button>
      </div>
    </>
  );
}
