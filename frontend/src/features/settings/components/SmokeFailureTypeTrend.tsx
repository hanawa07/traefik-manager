import type { SmokeRunStatistics } from "@/features/settings/api/settingsApi";

const EMPTY_COUNTS = {
  external_api: 0,
  login: 0,
  unclassified: 0,
  visual_regression: 0,
};

const TYPE_BARS = [
  { key: "login", label: "로그인", style: "bg-rose-500" },
  { key: "external_api", label: "외부 API", style: "bg-amber-500" },
  { key: "visual_regression", label: "화면 회귀", style: "bg-cyan-500" },
] as const;

interface SmokeFailureTypeTrendProps {
  statistic?: SmokeRunStatistics;
}

export function SmokeFailureTypeTrend({ statistic }: SmokeFailureTypeTrendProps) {
  if (!statistic) return null;
  const counts = statistic.failure_type_counts ?? EMPTY_COUNTS;
  const daily = statistic.failure_type_daily ?? [];
  const classified = counts.login + counts.external_api + counts.visual_regression;
  const maxDailyTypeCount = Math.max(
    1,
    ...daily.flatMap((point) => TYPE_BARS.map(({ key }) => point[key])),
  );

  return (
    <section
      className="mt-2 basis-full rounded-md border border-current/15 bg-white/50 px-2.5 py-2 text-[11px] dark:bg-slate-900/50"
      data-testid="smoke-failure-type-summary"
      data-window-days={statistic.window_days}
    >
      <p className="font-semibold" data-testid="smoke-failure-type-period-counts">
        최근 {statistic.window_days}일 전체 실패 유형 · 분류 {classified}/
        {statistic.failure_count}건
      </p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {TYPE_BARS.map(({ key, label, style }) => (
          <span className="inline-flex items-center gap-1" key={key}>
            <span className={`h-2 w-2 rounded-sm ${style}`} aria-hidden="true" />
            {label} {counts[key]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-slate-400" aria-hidden="true" />
          미분류 {counts.unclassified}
        </span>
      </p>
      {daily.length ? (
        <ol
          aria-label={`최근 ${statistic.window_days}일 실패 유형 발생일 추이`}
          className="mt-2 flex min-h-12 items-end gap-1.5 overflow-x-auto pb-1"
          data-testid="smoke-failure-type-trend"
        >
          {daily.map((point) => (
            <li
              className="grid min-w-10 justify-items-center gap-1"
              key={point.captured_on}
              title={`${point.captured_on} · 로그인 ${point.login} · 외부 API ${point.external_api} · 화면 회귀 ${point.visual_regression}`}
            >
              <span className="flex h-8 items-end gap-0.5" aria-hidden="true">
                {TYPE_BARS.map(({ key, style }) => (
                  <span
                    className={`w-1.5 rounded-t-sm ${style}`}
                    key={key}
                    style={{
                      height: point[key]
                        ? `${Math.max(4, Math.round((point[key] / maxDailyTypeCount) * 32))}px`
                        : 0,
                    }}
                  />
                ))}
              </span>
              <time className="tabular-nums opacity-70" dateTime={point.captured_on}>
                {point.captured_on.slice(5).replace("-", "/")}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 opacity-70" data-testid="smoke-failure-type-trend-empty">
          분류된 실패 발생일이 없습니다.
        </p>
      )}
      <p className="mt-1 opacity-70">
        전체 실패 수는 GitHub 기준이며, 미분류는 보관된 실패 정보가 없는 실행입니다.
      </p>
    </section>
  );
}
