import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "서비스 점검 중",
  description: "현재 서비스 점검이 진행 중입니다.",
  robots: { index: false, follow: false },
};

const DEFAULT_MESSAGE =
  "현재 서비스 점검이 진행 중입니다. 설정과 데이터는 그대로 보존되어 있으며, 작업이 끝나는 대로 다시 연결됩니다.";

export default async function MaintenancePage() {
  const requestHeaders = await headers();
  const message = decodeMaintenanceMessage(
    requestHeaders.get("x-tm-maintenance-message"),
  ) ?? DEFAULT_MESSAGE;
  const until = formatMaintenanceUntil(
    requestHeaders.get("x-tm-maintenance-until"),
  );

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[#f3ede0] px-6 py-16 text-[#172019]">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(#172019 1px, transparent 1px), linear-gradient(90deg, #172019 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div aria-hidden="true" className="absolute -right-20 -top-16 h-72 w-72 rotate-12 rounded-[4rem] bg-[#ef6a35]" />
      <div aria-hidden="true" className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full border-[42px] border-[#1f6f5c]" />

      <section className="relative mx-auto w-full max-w-4xl border-2 border-[#172019] bg-[#fffaf0] p-7 shadow-[12px_12px_0_#172019] sm:p-12">
        <div className="flex items-center justify-between gap-4 border-b-2 border-[#172019] pb-4 font-mono text-xs font-bold uppercase tracking-[0.2em]">
          <span>Service notice</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ef6a35]" />
            Maintenance
          </span>
        </div>
        <div className="py-10 sm:py-16">
          <p className="font-mono text-sm font-bold text-[#1f6f5c]">잠시만 기다려 주세요</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
            더 나은 상태로<br />돌아오겠습니다.
          </h1>
          <p className="mt-7 max-w-xl text-base font-medium leading-7 text-[#435047] sm:text-lg">
            {message}
          </p>
          {until ? (
            <p className="mt-5 inline-flex border-2 border-[#172019] bg-[#f3ede0] px-4 py-2 font-mono text-sm font-bold">
              점검 종료 예정 · {until} (KST)
            </p>
          ) : null}
        </div>
        <p className="border-t-2 border-[#172019] pt-4 font-mono text-xs text-[#435047]">
          새로고침 후에도 이 화면이 보이면 잠시 뒤 다시 접속해 주세요.
        </p>
      </section>
    </main>
  );
}

function decodeMaintenanceMessage(value: string | null) {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

function formatMaintenanceUntil(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
