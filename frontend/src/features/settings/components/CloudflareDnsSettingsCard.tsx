import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Cloud, Save, X } from "lucide-react";

import type {
  CloudflareDriftCheckResult,
  CloudflareSettingsStatus,
  CloudflareZoneInput,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import {
  ActionResultNotice,
  CloudflareDriftNotice,
  SettingsTestHistoryNotice,
} from "@/features/settings/components/SettingsNotices";
import { createDefaultCloudflareZoneForm } from "@/features/settings/lib/settingsDefaults";

interface CloudflareDnsSettingsCardProps {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  status?: CloudflareSettingsStatus;
  formValue: CloudflareZoneInput[];
  errorMessage: string;
  isSaving: boolean;
  isTesting: boolean;
  isDiagnosing: boolean;
  isReconciling: boolean;
  isHistoryLoading: boolean;
  timezone?: string;
  testHistory?: SettingsTestHistoryItem | null;
  driftHistory?: SettingsTestHistoryItem | null;
  reconcileHistory?: SettingsTestHistoryItem | null;
  testResult: SettingsActionTestResult | null;
  driftResult: CloudflareDriftCheckResult | null;
  reconcileResult: SettingsActionTestResult | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTest: () => void;
  onDiagnose: () => void;
  onReconcile: () => void;
  onFormChange: Dispatch<SetStateAction<CloudflareZoneInput[]>>;
}

export function CloudflareDnsSettingsCard({
  canManage,
  isLoading,
  isEditing,
  status,
  formValue,
  errorMessage,
  isSaving,
  isTesting,
  isDiagnosing,
  isReconciling,
  isHistoryLoading,
  timezone,
  testHistory,
  driftHistory,
  reconcileHistory,
  testResult,
  driftResult,
  reconcileResult,
  onEdit,
  onSave,
  onCancel,
  onTest,
  onDiagnose,
  onReconcile,
  onFormChange,
}: CloudflareDnsSettingsCardProps) {
  const updateZone = (index: number, patch: Partial<CloudflareZoneInput>) => {
    onFormChange((current) =>
      current.map((zone, currentIndex) =>
        currentIndex === index ? { ...zone, ...patch } : zone,
      ),
    );
  };
  const addZone = () => {
    onFormChange((current) => [...current, createDefaultCloudflareZoneForm()]);
  };
  const removeZone = (index: number) => {
    onFormChange((current) =>
      current.length === 1
        ? [createDefaultCloudflareZoneForm()]
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  return (
    <div className="card p-6 h-full order-10">
      <SettingsCardHeader
        icon={<Cloud className="w-5 h-5 text-blue-600" />}
        title="Cloudflare DNS 자동 연동"
        description="서비스 추가/삭제 시 Cloudflare DNS A 레코드를 자동으로 생성/삭제합니다. 이미 DNS가 수동으로 설정되어 있다면 사용하지 않아도 됩니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
      ) : isEditing ? (
        <CloudflareEditForm
          zones={formValue}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onUpdateZone={updateZone}
          onAddZone={addZone}
          onRemoveZone={removeZone}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <CloudflareSummary
          canManage={canManage}
          status={status}
          isTesting={isTesting}
          isDiagnosing={isDiagnosing}
          isReconciling={isReconciling}
          isHistoryLoading={isHistoryLoading}
          timezone={timezone}
          testHistory={testHistory}
          driftHistory={driftHistory}
          reconcileHistory={reconcileHistory}
          testResult={testResult}
          driftResult={driftResult}
          reconcileResult={reconcileResult}
          onTest={onTest}
          onDiagnose={onDiagnose}
          onReconcile={onReconcile}
        />
      )}

      <CloudflarePermissionNote />
    </div>
  );
}

function CloudflareEditForm({
  zones,
  errorMessage,
  isSaving,
  onUpdateZone,
  onAddZone,
  onRemoveZone,
  onSave,
  onCancel,
}: {
  zones: CloudflareZoneInput[];
  errorMessage: string;
  isSaving: boolean;
  onUpdateZone: (index: number, patch: Partial<CloudflareZoneInput>) => void;
  onAddZone: () => void;
  onRemoveZone: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      {zones.map((zone, index) => (
        <CloudflareZoneForm
          key={`cf-zone-${index}`}
          zone={zone}
          index={index}
          canRemove={zones.length > 1}
          onUpdate={onUpdateZone}
          onRemove={onRemoveZone}
        />
      ))}

      <button type="button" className="btn-secondary py-1.5 text-xs" onClick={onAddZone}>
        영역 추가
      </button>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
        <p>멀티존 지원: 여러 Cloudflare zone을 나란히 저장할 수 있습니다.</p>
        <p>비Cloudflare 도메인: 저장/드리프트/재동기화 대상에서 자동 제외되며, 진단 결과에 제외 사유가 표시됩니다.</p>
        <p>모든 영역을 비우고 저장하면 Cloudflare 자동 연동 설정이 완전히 초기화됩니다.</p>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <SettingsActionRow>
        <button
          className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
          onClick={onSave}
          disabled={isSaving}
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs" onClick={onCancel}>
          <X className="w-3.5 h-3.5" /> 취소
        </button>
      </SettingsActionRow>
    </div>
  );
}

function CloudflareZoneForm({
  zone,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: {
  zone: CloudflareZoneInput;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, patch: Partial<CloudflareZoneInput>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Cloudflare 영역 {index + 1}</p>
          <p className="text-xs text-gray-500">한 zone과 그 하위 도메인만 자동 연동 대상으로 포함됩니다.</p>
        </div>
        <button
          type="button"
          className="btn-secondary py-1.5 text-xs"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
        >
          영역 제거
        </button>
      </div>

      <TextField
        label="API Token"
        type="password"
        placeholder="새 토큰 입력 (비워두면 기존 값 유지가 아니라 이 영역 저장 자체가 비활성화됩니다)"
        value={zone.api_token}
        help={
          <>
            Cloudflare → My Profile → API Tokens → Create Token →{" "}
            <strong>Zone:DNS:Edit</strong>, <strong>Zone:Zone:Read</strong> 권한이 필요합니다.
          </>
        }
        onChange={(api_token) => onUpdate(index, { api_token })}
      />
      <TextField
        label="Zone ID"
        value={zone.zone_id}
        help="Cloudflare 도메인 대시보드 우측 하단 `Zone ID`. 이 zone에 속한 도메인만 자동 DNS 등록과 드리프트 진단 대상이 됩니다."
        onChange={(zone_id) => onUpdate(index, { zone_id })}
      />
      <TextField
        label="Record Target"
        labelSuffix="(선택)"
        placeholder="예: 1.2.3.4 (비워두면 서비스 업스트림 호스트 사용)"
        value={zone.record_target}
        help={
          "DNS A/CNAME 레코드가 가리킬 대상입니다. 비워두면 서비스 upstream_host를 사용하지만, " +
          "upstream이 내부 IP인 경우 공인 IP나 외부 hostname을 직접 입력해야 합니다."
        }
        onChange={(record_target) => onUpdate(index, { record_target })}
      />

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={zone.proxied}
            onChange={(event) => onUpdate(index, { proxied: event.target.checked })}
          />
          Cloudflare Proxy (Proxied) 사용
        </label>
        <p className="text-xs text-gray-400 mt-1">
          활성화 시 트래픽이 Cloudflare를 경유하며 실제 서버 IP가 숨겨집니다. DNS only가 필요하면 체크를 해제하세요.
        </p>
      </div>
    </div>
  );
}

function CloudflareSummary({
  canManage,
  status,
  isTesting,
  isDiagnosing,
  isReconciling,
  isHistoryLoading,
  timezone,
  testHistory,
  driftHistory,
  reconcileHistory,
  testResult,
  driftResult,
  reconcileResult,
  onTest,
  onDiagnose,
  onReconcile,
}: {
  canManage: boolean;
  status?: CloudflareSettingsStatus;
  isTesting: boolean;
  isDiagnosing: boolean;
  isReconciling: boolean;
  isHistoryLoading: boolean;
  timezone?: string;
  testHistory?: SettingsTestHistoryItem | null;
  driftHistory?: SettingsTestHistoryItem | null;
  reconcileHistory?: SettingsTestHistoryItem | null;
  testResult: SettingsActionTestResult | null;
  driftResult: CloudflareDriftCheckResult | null;
  reconcileResult: SettingsActionTestResult | null;
  onTest: () => void;
  onDiagnose: () => void;
  onReconcile: () => void;
}) {
  return (
    <SettingsSummary>
      <p className={`text-sm font-medium ${status?.enabled ? "text-green-700" : "text-gray-600"}`}>
        {status?.enabled ? "활성화됨" : "비활성화됨"}
      </p>
      <p className="text-xs text-gray-500 mt-1">{status?.message}</p>
      <div className="pt-1">
        <SettingsSummaryRow label="설정된 영역 수" value={`${status?.zone_count ?? 0}개`} />
        <SettingsSummaryRow label="적용 범위" value="Cloudflare zone과 일치하는 도메인만 자동 연동" />
        <SettingsSummaryRow label="비Cloudflare 도메인" value="자동 제외 후 진단 결과에 표시" />
      </div>
      {status?.zones?.length ? <CloudflareZoneList status={status} /> : null}
      {canManage ? (
        <SettingsActionRow>
          <CloudflareActionButton label="연결 테스트" busyLabel="테스트 중..." isBusy={isTesting} onClick={onTest} />
          <CloudflareActionButton
            label="드리프트 진단"
            busyLabel="진단 중..."
            isBusy={isDiagnosing}
            onClick={onDiagnose}
          />
          <CloudflareActionButton
            label="DNS 재동기화"
            busyLabel="재동기화 중..."
            isBusy={isReconciling}
            onClick={onReconcile}
          />
        </SettingsActionRow>
      ) : null}
      <p className="text-xs text-gray-500">
        테스트, 드리프트 진단, 재동기화는 현재 저장된 Cloudflare zone 목록 기준으로 수행됩니다.
      </p>
      {!isHistoryLoading ? (
        <>
          <SettingsTestHistoryNotice label="마지막 연결 테스트" history={testHistory} timezone={timezone} />
          <SettingsTestHistoryNotice label="마지막 드리프트 진단" history={driftHistory} timezone={timezone} />
          <SettingsTestHistoryNotice label="마지막 DNS 재동기화" history={reconcileHistory} timezone={timezone} />
        </>
      ) : null}
      <ActionResultNotice result={testResult} />
      <CloudflareDriftNotice result={driftResult} />
      <ActionResultNotice result={reconcileResult} />
    </SettingsSummary>
  );
}

function CloudflareZoneList({ status }: { status: CloudflareSettingsStatus }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <p className="text-xs font-medium text-gray-700">설정된 영역 목록</p>
      <div className="space-y-2">
        {status.zones.map((zone) => (
          <div
            key={zone.zone_id}
            className="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-gray-900">{zone.zone_name || "(영역 이름 미확인)"}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                {zone.proxied ? "프록시 활성" : "DNS only"}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-gray-500">{zone.zone_id}</p>
            <p className="mt-2 text-[11px] text-gray-600">
              대상: <span className="font-mono text-gray-700">{zone.record_target || "(서비스 업스트림 사용)"}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CloudflareActionButton({
  label,
  busyLabel,
  isBusy,
  onClick,
}: {
  label: string;
  busyLabel: string;
  isBusy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
      onClick={onClick}
      disabled={isBusy}
    >
      <Cloud className="h-3.5 w-3.5" />
      {isBusy ? busyLabel : label}
    </button>
  );
}

function CloudflarePermissionNote() {
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-medium">추가 권한 안내</p>
      <p className="mt-1">권한 구성 예시:</p>
      <ul className="mt-2 space-y-1 text-amber-800">
        <li>- 리소스: <strong>영역(Zone)</strong> / 권한: <strong>DNS 설정(Edit)</strong></li>
        <li>- 리소스: <strong>영역(Zone)</strong> / 권한: <strong>영역(Read)</strong></li>
        <li>- 리소스: <strong>영역(Zone)</strong> / 권한: <strong>DNS(Read)</strong></li>
      </ul>
      <p className="mt-1 text-amber-800">
        연결 테스트는 zone 접근만 확인하지만, 드리프트 진단은 DNS 레코드 목록까지 조회합니다.
        따라서 연결 테스트가 통과해도 <strong>DNS:Read</strong>가 없으면 드리프트 진단은 실패할 수 있습니다.
      </p>
      <p className="mt-1 text-amber-800">
        드리프트 진단 결과가 <strong>드리프트 0개</strong>로 나오면, Cloudflare 관리 대상 도메인의
        DNS가 현재 목표 상태와 일치한다는 뜻입니다.
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  help,
  labelSuffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  help?: ReactNode;
  labelSuffix?: string;
}) {
  return (
    <div>
      <label className="label">
        {label} {labelSuffix ? <span className="text-gray-400 font-normal">{labelSuffix}</span> : null}
      </label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <p className="text-xs text-gray-400 mt-1">{help}</p> : null}
    </div>
  );
}
