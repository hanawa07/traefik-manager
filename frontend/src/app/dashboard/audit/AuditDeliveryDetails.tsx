import {
  formatAuditValue,
  type getDeliveryDetailRows,
} from "./auditPageHelpers";

type AuditDeliveryRows = ReturnType<typeof getDeliveryDetailRows>;

interface AuditDeliveryDetailsProps {
  logId: string;
  deliveryRows: AuditDeliveryRows;
}

export function AuditDeliveryDetails({ logId, deliveryRows }: AuditDeliveryDetailsProps) {
  if (deliveryRows.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">전송 상세</p>
      <div className="space-y-2">
        {deliveryRows.map((row) => (
          <div key={`${logId}-${row.key}-delivery`} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
            <span className="text-slate-500">{row.label}</span>
            <span className="break-all text-slate-900">{formatAuditValue(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
