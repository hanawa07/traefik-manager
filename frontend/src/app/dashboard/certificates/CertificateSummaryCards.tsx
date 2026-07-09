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
    <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-5">
      <SummaryCard label="전체 인증서" value={totalCount} valueClassName="text-gray-900 dark:text-slate-100" />
      <SummaryCard label="발급 대기" value={pendingCount} valueClassName="text-blue-600 dark:text-blue-300" />
      <SummaryCard label="30일 이내 만료" value={warningCount} valueClassName="text-amber-600 dark:text-amber-300" />
      <SummaryCard label="만료됨" value={errorCount} valueClassName="text-red-600 dark:text-red-300" />
      <SummaryCard
        label="최근 발급 실패"
        value={recentFailureCount}
        valueClassName="text-amber-600 dark:text-amber-300"
        helperText={`반복 실패 ${repeatedFailureCount}개`}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClassName,
  helperText,
}: {
  label: string;
  value: number;
  valueClassName: string;
  helperText?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClassName}`}>{value}</p>
      {helperText ? <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{helperText}</p> : null}
    </div>
  );
}
