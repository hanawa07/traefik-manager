import type { CloudflareDriftCheckResult, CloudflareDriftRecord } from "@/features/settings/api/settingsApi";

interface CloudflareDriftRecordGroupsProps {
  result: CloudflareDriftCheckResult;
}

interface CloudflareDriftRecordGroup {
  color: string;
  items: CloudflareDriftRecord[];
  title: string;
}

export function CloudflareDriftRecordGroups({ result }: CloudflareDriftRecordGroupsProps) {
  if (result.success) return null;

  const groups: CloudflareDriftRecordGroup[] = [
    {
      title: "누락",
      color: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
      items: result.missing_records,
    },
    {
      title: "불일치",
      color: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
      items: result.mismatched_records,
    },
    {
      title: "고아",
      color: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100",
      items: result.orphan_records,
    },
  ];

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {groups.map((group) => (
        <CloudflareDriftRecordGroupCard key={group.title} group={group} />
      ))}
    </div>
  );
}

function CloudflareDriftRecordGroupCard({ group }: { group: CloudflareDriftRecordGroup }) {
  return (
    <div className={`rounded-lg border p-3 text-xs ${group.color}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{group.title}</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium dark:bg-slate-950/70">
          {group.items.length}개
        </span>
      </div>
      {group.items.length ? <CloudflareDriftRecordList group={group} /> : <p className="mt-2 opacity-80">없음</p>}
    </div>
  );
}

function CloudflareDriftRecordList({ group }: { group: CloudflareDriftRecordGroup }) {
  return (
    <ul className="mt-2 space-y-2">
      {group.items.slice(0, 5).map((item) => (
        <li
          key={`${group.title}-${item.domain}`}
          className="rounded-md border border-white/60 bg-white/60 p-2 dark:border-slate-700 dark:bg-slate-950/60"
        >
          <p className="font-mono text-[11px] font-medium">{item.domain}</p>
          <p className="mt-1 break-all text-[11px] opacity-90">{item.detail}</p>
        </li>
      ))}
      {group.items.length > 5 ? (
        <li className="text-[11px] opacity-80">외 {group.items.length - 5}개 더 있음</li>
      ) : null}
    </ul>
  );
}
