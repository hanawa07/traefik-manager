import { Archive, DatabaseZap } from "lucide-react";

import type {
  AuditArchiveItem,
  AuditRetentionSettingsInput,
  AuditRetentionSettingsStatus,
} from "@/features/settings/api/settingsApi";
import { AuditArchiveList } from "./AuditArchiveList";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "./SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface AuditRetentionSettingsCardProps {
  canManage: boolean;
  timezone?: string;
  isLoading: boolean;
  isError: boolean;
  isEditing: boolean;
  status?: AuditRetentionSettingsStatus;
  formValue: AuditRetentionSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  isCleaning: boolean;
  archives?: AuditArchiveItem[];
  isArchivesLoading: boolean;
  isArchivesError: boolean;
  restoringFilename: string | null;
  onEdit: () => void;
  onSave: () => void;
  onCleanup: () => void;
  onRestore: (filename: string) => void;
  onCancel: () => void;
  onFormChange: (value: AuditRetentionSettingsInput) => void;
}

export function AuditRetentionSettingsCard({
  canManage,
  timezone,
  isLoading,
  isError,
  isEditing,
  status,
  formValue,
  errorMessage,
  isSaving,
  isCleaning,
  archives,
  isArchivesLoading,
  isArchivesError,
  restoringFilename,
  onEdit,
  onSave,
  onCleanup,
  onRestore,
  onCancel,
  onFormChange,
}: AuditRetentionSettingsCardProps) {
  return (
    <div className="card order-7 p-6" data-testid="audit-retention-settings-card">
      <SettingsCardHeader
        icon={<Archive className="h-5 w-5 text-amber-600" />}
        title="감사 로그 보존"
        description="오래된 감사 로그를 매일 정리합니다. 아카이브 사용 시 삭제 전에 gzip JSONL로 보존합니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isError || !status ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">보존 정책을 불러오지 못했습니다.</p>
      ) : isEditing ? (
        <div className="space-y-4">
          <label className="grid gap-1.5 text-sm text-gray-700 dark:text-slate-200">
            보존 일수
            <input
              className="input"
              min={30}
              max={3650}
              type="number"
              value={formValue.retention_days}
              onChange={(event) =>
                onFormChange({ ...formValue, retention_days: Number(event.target.value) })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={formValue.archive_enabled}
              onChange={(event) =>
                onFormChange({ ...formValue, archive_enabled: event.target.checked })
              }
            />
            삭제 전 gzip 아카이브
          </label>
          {!formValue.archive_enabled ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
              아카이브를 끄면 보존 기간이 지난 로그는 복구할 수 없이 삭제됩니다.
            </p>
          ) : null}
          {errorMessage ? <p className="text-xs text-rose-600 dark:text-rose-300">{errorMessage}</p> : null}
          <SettingsActionRow>
            <button className="btn-primary" disabled={isSaving} onClick={onSave} type="button">
              {isSaving ? "저장 중" : "저장"}
            </button>
            <button className="btn-secondary" disabled={isSaving} onClick={onCancel} type="button">
              취소
            </button>
          </SettingsActionRow>
        </div>
      ) : (
        <SettingsSummary>
          <SettingsSummaryRow label="보존 기간" value={`${status.retention_days}일`} />
          <SettingsSummaryRow label="삭제 전 아카이브" value={status.archive_enabled ? "사용" : "사용 안 함"} />
          <SettingsSummaryRow label="최근 정리" value={formatDateTime(status.last_run_at, timezone)} />
          <SettingsSummaryRow label="최근 처리" value={`${status.last_archived_count}건 아카이브 · ${status.last_deleted_count}건 삭제`} />
          <SettingsSummaryRow label="최근 파일" value={status.last_archive_file || "없음"} mono />
          {canManage ? (
            <SettingsActionRow>
              <button
                className="btn-secondary flex items-center gap-2"
                disabled={isCleaning}
                onClick={onCleanup}
                type="button"
              >
                <DatabaseZap className="h-4 w-4" />
                {isCleaning ? "정리 중" : "지금 정리"}
              </button>
            </SettingsActionRow>
          ) : null}
        </SettingsSummary>
      )}
      {canManage && status && !isEditing ? (
        <AuditArchiveList
          archives={archives}
          isError={isArchivesError}
          isLoading={isArchivesLoading}
          onRestore={onRestore}
          restoringFilename={restoringFilename}
          timezone={timezone}
        />
      ) : null}
    </div>
  );
}
