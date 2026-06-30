export function AuditLogEmptyRow() {
  return (
    <tr>
      <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
        기록된 감사 로그가 없습니다.
      </td>
    </tr>
  );
}
