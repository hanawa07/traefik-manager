import { clsx } from "clsx";
import { Search } from "lucide-react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import Modal from "@/shared/components/Modal";
import { Checkmark, extractErrorMessage } from "./middlewarePageHelpers";

interface MiddlewareAssignmentModalProps {
  isOpen: boolean;
  assignmentTarget: MiddlewareTemplate | null;
  assignmentSearch: string;
  selectedServiceIds: string[];
  servicesCount: number;
  filteredServices: Service[];
  error: unknown;
  isSaving: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onToggleService: (serviceId: string) => void;
  onSave: () => Promise<void>;
}

export default function MiddlewareAssignmentModal({
  isOpen,
  assignmentTarget,
  assignmentSearch,
  selectedServiceIds,
  servicesCount,
  filteredServices,
  error,
  isSaving,
  onClose,
  onSearchChange,
  onToggleService,
  onSave,
}: MiddlewareAssignmentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={assignmentTarget ? `${assignmentTarget.name} 적용 서비스 관리` : "적용 서비스 관리"}
      maxWidthClass="max-w-3xl"
    >
      {assignmentTarget ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">
              선택한 서비스에 이 템플릿을 바로 적용하거나 해제할 수 있습니다.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              저장하면 각 서비스 YAML이 즉시 다시 생성됩니다. 현재 선택: {selectedServiceIds.length} / {servicesCount}
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">
                {extractErrorMessage(error, "서비스 적용 중 오류가 발생했습니다")}
              </p>
            </div>
          ) : null}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={assignmentSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400"
              placeholder="서비스 이름 또는 도메인 검색"
            />
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-2">
            {filteredServices.map((service) => {
              const checked = selectedServiceIds.includes(service.id);
              return (
                <label
                  key={service.id}
                  className={clsx(
                    "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors",
                    checked
                      ? "border-blue-200 bg-blue-50"
                      : "border-transparent bg-white hover:border-gray-200 hover:bg-gray-50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-blue-600"
                      checked={checked}
                      onChange={() => onToggleService(service.id)}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{service.name}</p>
                      <p className="text-xs text-gray-500">{service.domain}</p>
                    </div>
                  </div>
                  {checked ? <Checkmark /> : null}
                </label>
              );
            })}

            {filteredServices.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                검색 조건에 맞는 서비스가 없습니다.
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button className="btn-primary" disabled={isSaving} onClick={onSave}>
              {isSaving ? "적용 중..." : "적용 저장"}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
