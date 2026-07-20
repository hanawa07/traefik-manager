import { CheckCircle2, Clipboard, Loader2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";

import type {
  TraefikDeploymentStatus,
  TraefikHealth,
  TraefikUpdateOperations,
} from "@/features/traefik/api/traefikApi";
import { useRequestTraefikPatchUpdate } from "@/features/traefik/hooks/useTraefik";
import { buildTraefikUpdatePlan, type TraefikUpdateRisk } from "./traefikUpdatePlan";

interface TraefikUpdatePlanPanelProps {
  canManage: boolean;
  deployment?: TraefikDeploymentStatus;
  health?: TraefikHealth;
  operations?: TraefikUpdateOperations;
}

export function TraefikUpdatePlanPanel({
  canManage,
  deployment,
  health,
  operations,
}: TraefikUpdatePlanPanelProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);
  const requestUpdate = useRequestTraefikPatchUpdate();
  const plan = buildTraefikUpdatePlan(health, deployment);
  if (!plan) return null;
  const canRequest = canManage
    && plan.risk === "low"
    && operations?.runner.available === true
    && !operations.pending_request;
  const requestBlockedReason = getRequestBlockedReason(plan.risk, operations);

  const copyCommand = async (label: string, command: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedCommand(label);
    window.setTimeout(() => setCopiedCommand(null), 1800);
  };

  const handleRequestUpdate = async () => {
    if (!window.confirm(
      `${plan.latestVersion} 패치 업데이트를 호스트 실행기에 요청할까요? 백업 후 적용하며 검증 실패 시 자동 롤백합니다.`,
    )) return;
    setRequestFeedback(null);
    try {
      const result = await requestUpdate.mutateAsync(plan.latestVersion);
      setRequestFeedback(result.message);
    } catch (error) {
      setRequestFeedback(getRequestError(error));
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-white/75 p-4 shadow-sm dark:border-amber-500/30 dark:bg-slate-950/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Traefik 업데이트 영향 점검</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRiskClassName(plan.risk)}`}>
              {plan.riskLabel}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{plan.summary}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {canRequest ? "호스트 안전 요청 가능" : plan.canApply ? "자동 적용 가능" : "명령 확인 후 적용"}
          </div>
          {canManage ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
              disabled={!canRequest || requestUpdate.isPending}
              onClick={() => void handleRequestUpdate()}
              type="button"
            >
              {requestUpdate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {requestUpdate.isPending ? "요청 중" : `${plan.latestVersion} 안전 업데이트 요청`}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <TraefikDeploymentFact label="현재 이미지" value={plan.currentImage || "-"} />
        <TraefikDeploymentFact label="목표 이미지" value={plan.targetImage || "-"} />
        <TraefikDeploymentFact label="Compose 위치" value={plan.composeWorkingDir || "-"} monospace />
      </div>
      {canManage && !canRequest ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {requestBlockedReason || plan.applyBlockedReason}
        </p>
      ) : null}
      {requestFeedback ? (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${requestUpdate.isError ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200" : "bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200"}`}
          role={requestUpdate.isError ? "alert" : "status"}
        >
          {requestFeedback}
        </p>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" />
            업데이트 전 확인
          </div>
          <ul className="space-y-2">
            {plan.checks.map((check) => (
              <li className="flex gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300" key={check}>
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <RotateCcw className="mr-1 inline h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            {plan.rollbackNote}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          {plan.commands.map((item) => (
            <div
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-950 p-3 text-slate-100 shadow-sm dark:border-slate-700"
              key={item.label}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{item.description}</p>
                </div>
                <button
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-100 hover:bg-white/15"
                  onClick={() => copyCommand(item.label, item.command)}
                  type="button"
                >
                  <Clipboard className="h-3 w-3" />
                  {copiedCommand === item.label ? "복사됨" : "복사"}
                </button>
              </div>
              <code className="mt-2 block max-w-full overflow-x-auto whitespace-pre rounded-lg bg-black/35 px-2.5 py-2 text-[11px] leading-5 text-emerald-200">
                {item.command}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TraefikDeploymentFact({ label, monospace = false, value }: { label: string; monospace?: boolean; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/60">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-100 ${monospace ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function getRiskClassName(risk: TraefikUpdateRisk) {
  if (risk === "low") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (risk === "medium") return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100";
  if (risk === "high") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
}

function getRequestBlockedReason(
  risk: TraefikUpdateRisk,
  operations?: TraefikUpdateOperations,
) {
  if (risk !== "low") return "안전 자동 요청은 동일 메이저·마이너의 패치 업데이트만 지원합니다.";
  if (operations?.pending_request) return "이미 처리 중인 Traefik 업데이트 요청이 있습니다.";
  if (!operations) return "호스트 업데이트 실행기 상태를 확인하는 중입니다.";
  if (!operations.runner.available) return operations.runner.message;
  return null;
}

function getRequestError(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || "Traefik 호스트 업데이트를 요청하지 못했습니다.";
}
