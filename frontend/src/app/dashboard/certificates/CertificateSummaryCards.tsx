interface CertificateSummaryCardsProps {
  totalCount: number;
  pendingCount: number;
  warningCount: number;
  errorCount: number;
  recentFailureCount: number;
  repeatedFailureCount: number;
}

export default function CertificateSummaryCards({
  totalCount,
  pendingCount,
  warningCount,
  errorCount,
  recentFailureCount,
  repeatedFailureCount,
}: CertificateSummaryCardsProps) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 md:grid-cols-5">
      <SummaryCard label="전체 인증서" value={totalCount} valueClassName="text-gray-900 dark:text-slate-100" />
      <SummaryCard label="발급 대기" value={pendingCount} valueClassName="text-blue-600 dark:text-blue-300" />
      <SummaryCard label="30일 이내 만료" value={warningCount} valueClassName="text-amber-600 dark:text-amber-300" />
      <SummaryCard label="만료됨" value={errorCount} valueClassName="text-red-600 dark:text-red-300" />
      <SummaryCard
        className="col-span-2 md:col-span-1"
        label="최근 발급 실패"
        value={recentFailureCount}
        valueClassName="text-amber-600 dark:text-amber-300"
        helperText={`반복 실패 ${repeatedFailureCount}개`}
      />
    </div>
  );
}

function SummaryCard({
  className = "",
  label,
  value,
  valueClassName,
  helperText,
}: {
  className?: string;
  label: string;
  value: number;
  valueClassName: string;
  helperText?: string;
}) {
  return (
    <div className={`card p-3 sm:p-5 ${className}`}>
      <p className="text-xs text-gray-500 sm:text-sm dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${valueClassName}`}>{value}</p>
      {helperText ? <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{helperText}</p> : null}
    </div>
  );
}
