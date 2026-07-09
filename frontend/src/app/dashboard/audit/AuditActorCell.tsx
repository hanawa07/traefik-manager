export function AuditActorCell({ actor }: { actor: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
        <span className="text-xs font-black text-slate-700 dark:text-slate-200">{actor.charAt(0).toUpperCase()}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{actor}</span>
    </div>
  );
}
