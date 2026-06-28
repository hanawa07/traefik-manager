"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  Layers3,
  Pencil,
  Search,
  Server,
  Shield,
  Trash2,
  Wand2,
} from "lucide-react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import Modal from "@/shared/components/Modal";
import StatusBadge from "@/shared/components/StatusBadge";
import MiddlewareForm from "@/features/middlewares/components/MiddlewareForm";
import { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import { Service } from "@/features/services/api/serviceApi";
import { useServices } from "@/features/services/hooks/useServices";
import { useTraefikMiddlewares } from "@/features/traefik/hooks/useTraefik";
import {
  useAssignMiddlewareTemplate,
  useCreateMiddlewareTemplate,
  useDeleteMiddlewareTemplate,
  useMiddlewareTemplates,
  useUpdateMiddlewareTemplate,
} from "@/features/middlewares/hooks/useMiddlewares";
import GeneratedMiddlewaresTab from "./GeneratedMiddlewaresTab";
import MiddlewarePageHeader from "./MiddlewarePageHeader";
import {
  Checkmark,
  type MiddlewareTab,
  buildGeneratedMiddlewareItems,
  extractErrorMessage,
  generatedSearchValue,
  getTemplateConfigSummary,
  getTemplateTypeLabel,
  mapRuntimeStatus,
} from "./middlewarePageHelpers";

export default function MiddlewaresPage() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const [activeTab, setActiveTab] = useState<MiddlewareTab>("templates");
  const [generatedSearch, setGeneratedSearch] = useState("");

  const {
    data: templates = [],
    error: templateError,
    isError: isTemplateError,
    isLoading: isTemplateLoading,
  } = useMiddlewareTemplates();
  const {
    data: services = [],
    error: servicesError,
    isError: isServicesError,
    isLoading: isServicesLoading,
  } = useServices();
  const {
    data: runtimeMiddlewaresResponse,
    error: runtimeError,
    isLoading: isRuntimeLoading,
  } = useTraefikMiddlewares();
  const createTemplate = useCreateMiddlewareTemplate();
  const deleteTemplate = useDeleteMiddlewareTemplate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MiddlewareTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MiddlewareTemplate | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<MiddlewareTemplate | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const updateTemplate = useUpdateMiddlewareTemplate(editTarget?.id || "");
  const assignTemplate = useAssignMiddlewareTemplate(assignmentTarget?.id || "");

  const runtimeConnected = runtimeMiddlewaresResponse?.connected ?? false;
  const runtimeMap = useMemo(
    () =>
      new Map(
        (runtimeMiddlewaresResponse?.middlewares ?? []).map((middleware) => [middleware.name, middleware])
      ),
    [runtimeMiddlewaresResponse?.middlewares]
  );

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [templates]
  );

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [services]
  );

  const appliedServicesByTemplate = useMemo(() => {
    const initial = Object.fromEntries(sortedTemplates.map((template) => [template.id, [] as Service[]]));
    for (const service of sortedServices) {
      for (const templateId of service.middleware_template_ids) {
        if (initial[templateId]) {
          initial[templateId].push(service);
        }
      }
    }
    return initial;
  }, [sortedServices, sortedTemplates]);

  useEffect(() => {
    if (!assignmentTarget) {
      setAssignmentSearch("");
      setSelectedServiceIds([]);
      return;
    }
    setAssignmentSearch("");
    setSelectedServiceIds((appliedServicesByTemplate[assignmentTarget.id] || []).map((service) => service.id));
  }, [assignmentTarget?.id, assignmentTarget, appliedServicesByTemplate]);

  const filteredServicesForAssignment = useMemo(() => {
    const query = generatedSearchValue(assignmentSearch);
    if (!query) return sortedServices;
    return sortedServices.filter((service) =>
      generatedSearchValue(`${service.name} ${service.domain}`).includes(query)
    );
  }, [assignmentSearch, sortedServices]);

  const generatedServiceGroups = useMemo(() => {
    const query = generatedSearchValue(generatedSearch);

    return sortedServices
      .map((service) => ({
        service,
        items: buildGeneratedMiddlewareItems(service, runtimeMap, runtimeConnected),
      }))
      .filter(({ service, items }) => {
        if (items.length === 0) return false;
        if (!query) return true;
        return generatedSearchValue(`${service.name} ${service.domain}`).includes(query);
      });
  }, [generatedSearch, runtimeConnected, runtimeMap, sortedServices]);

  const generatedServiceCount = generatedServiceGroups.length;

  const runtimeBannerMessage = runtimeError
    ? extractErrorMessage(runtimeError, "Traefik 런타임 미들웨어 상태를 불러오지 못했습니다")
    : runtimeConnected
      ? null
      : runtimeMiddlewaresResponse?.message || "Traefik 연결 상태를 아직 확인하지 못했습니다";

  const sharedTabBlocked = isTemplateError || isServicesError;
  const sharedTabErrorMessage = isTemplateError
    ? extractErrorMessage(templateError, "미들웨어 템플릿을 불러오지 못했습니다")
    : extractErrorMessage(servicesError, "서비스 목록을 불러오지 못했습니다");

  return (
    <div className="p-8">
      <MiddlewarePageHeader
        activeTab={activeTab}
        canManage={canManage}
        templatesCount={templates.length}
        onCreateOpen={() => setIsCreateOpen(true)}
        onTabChange={setActiveTab}
      />

      {activeTab === "templates" ? (
        <div className="space-y-4">
          {runtimeBannerMessage ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
              <p className="text-sm font-medium text-yellow-800">Traefik 런타임 상태 확인</p>
              <p className="mt-1 text-xs text-yellow-700">{runtimeBannerMessage}</p>
            </div>
          ) : null}

          {isTemplateLoading || isServicesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : sharedTabBlocked ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
              <Shield className="mx-auto mb-3 h-10 w-10 text-red-300" />
              <p className="text-sm font-medium text-red-600">미들웨어 관리 화면을 불러오지 못했습니다</p>
              <p className="mt-2 text-xs text-gray-500">{sharedTabErrorMessage}</p>
            </div>
          ) : sortedTemplates.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500">
              <Layers3 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm">등록된 공유 미들웨어 템플릿이 없습니다</p>
              <p className="mt-2 text-xs text-gray-400">
                서비스별 자동 생성 미들웨어는 옆 탭에서 확인하고, 재사용할 공용 규칙만 여기서 관리합니다.
              </p>
              {canManage ? (
                <button className="mt-3 text-sm text-blue-500 hover:underline" onClick={() => setIsCreateOpen(true)}>
                  첫 번째 템플릿 추가하기
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTemplates.map((template) => {
                const appliedServices = appliedServicesByTemplate[template.id] || [];
                const sharedRuntime = runtimeMap.get(`${template.shared_name}@file`);
                const templateStatus =
                  appliedServices.length === 0
                    ? "inactive"
                    : mapRuntimeStatus(sharedRuntime, { runtimeConnected });

                return (
                  <article key={template.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            {getTemplateTypeLabel(template.type)}
                          </span>
                          <StatusBadge status={templateStatus} />
                          <span className="text-xs text-gray-400">
                            {appliedServices.length}개 서비스 적용
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-xs text-gray-500">{template.shared_name}@file</p>
                        <p className="mt-2 text-sm text-gray-600">{getTemplateConfigSummary(template)}</p>
                      </div>

                      {canManage ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm"
                            onClick={() => setAssignmentTarget(template)}
                          >
                            <Wand2 className="h-4 w-4" />
                            서비스에 적용
                          </button>
                          <button
                            className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm"
                            onClick={() => setEditTarget(template)}
                          >
                            <Pencil className="h-4 w-4" />
                            수정
                          </button>
                          <button
                            className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm text-red-600 hover:border-red-200 hover:bg-red-50"
                            onClick={() => setDeleteTarget(template)}
                          >
                            <Trash2 className="h-4 w-4" />
                            삭제
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <Server className="h-3.5 w-3.5" />
                        적용 서비스
                      </div>
                      {appliedServices.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-500">
                          아직 적용된 서비스가 없습니다. `서비스에 적용`에서 여러 앱에 바로 붙일 수 있습니다.
                        </p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {appliedServices.map((service) => (
                            <Link
                              key={service.id}
                              href={`/dashboard/services/${service.id}`}
                              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <span className="font-medium">{service.name}</span>
                              <span className="ml-2 text-xs text-gray-500">{service.domain}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    {appliedServices.length > 0 ? (
                      <p className="mt-4 text-xs text-gray-500">
                        템플릿을 수정하면 연결된 서비스 YAML이 즉시 다시 생성되어 Traefik에 반영됩니다.
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <GeneratedMiddlewaresTab
          generatedSearch={generatedSearch}
          onGeneratedSearchChange={setGeneratedSearch}
          runtimeBannerMessage={runtimeBannerMessage}
          isServicesLoading={isServicesLoading}
          isRuntimeLoading={isRuntimeLoading}
          isServicesError={isServicesError}
          servicesError={servicesError}
          generatedServiceCount={generatedServiceCount}
          generatedServiceGroups={generatedServiceGroups}
        />
      )}

      <Modal isOpen={canManage && isCreateOpen} onClose={() => setIsCreateOpen(false)} title="미들웨어 템플릿 추가">
        {createTemplate.error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">
              {extractErrorMessage(createTemplate.error, "템플릿 추가 중 오류가 발생했습니다")}
            </p>
          </div>
        )}
        <MiddlewareForm
          onSubmit={async (data) => {
            await createTemplate.mutateAsync(data);
            setIsCreateOpen(false);
          }}
          loading={createTemplate.isPending}
          submitLabel="템플릿 추가"
        />
      </Modal>

      <Modal
        isOpen={canManage && !!editTarget}
        onClose={() => setEditTarget(null)}
        title="미들웨어 템플릿 수정"
        maxWidthClass="max-w-2xl"
      >
        {editTarget && (
          <>
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-700">수정 즉시 반영</p>
              <p className="mt-1 text-xs text-blue-600">
                이 템플릿을 사용하는 서비스가 있으면 저장과 동시에 해당 서비스 설정이 다시 생성됩니다.
              </p>
            </div>
            {updateTemplate.error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">
                  {extractErrorMessage(updateTemplate.error, "템플릿 수정 중 오류가 발생했습니다")}
                </p>
              </div>
            )}
            <MiddlewareForm
              defaultValues={editTarget}
              onSubmit={async (data) => {
                await updateTemplate.mutateAsync(data);
                setEditTarget(null);
              }}
              loading={updateTemplate.isPending}
              submitLabel="수정 완료"
            />
          </>
        )}
      </Modal>

      <Modal
        isOpen={canManage && !!assignmentTarget}
        onClose={() => setAssignmentTarget(null)}
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
                저장하면 각 서비스 YAML이 즉시 다시 생성됩니다. 현재 선택: {selectedServiceIds.length} / {services.length}
              </p>
            </div>

            {assignTemplate.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">
                  {extractErrorMessage(assignTemplate.error, "서비스 적용 중 오류가 발생했습니다")}
                </p>
              </div>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400"
                placeholder="서비스 이름 또는 도메인 검색"
              />
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-2">
              {filteredServicesForAssignment.map((service) => {
                const checked = selectedServiceIds.includes(service.id);
                return (
                  <label
                    key={service.id}
                    className={clsx(
                      "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors",
                      checked
                        ? "border-blue-200 bg-blue-50"
                        : "border-transparent bg-white hover:border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-blue-600"
                        checked={checked}
                        onChange={() =>
                          setSelectedServiceIds((current) =>
                            checked
                              ? current.filter((id) => id !== service.id)
                              : [...current, service.id]
                          )
                        }
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

              {filteredServicesForAssignment.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  검색 조건에 맞는 서비스가 없습니다.
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setAssignmentTarget(null)}>
                취소
              </button>
              <button
                className="btn-primary"
                disabled={assignTemplate.isPending}
                onClick={async () => {
                  if (!assignmentTarget) return;
                  await assignTemplate.mutateAsync({
                    services,
                    selectedServiceIds,
                  });
                  setAssignmentTarget(null);
                }}
              >
                {assignTemplate.isPending ? "적용 중..." : "적용 저장"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={canManage && !!deleteTarget} onClose={() => setDeleteTarget(null)} title="미들웨어 템플릿 삭제">
        <p className="mb-1 text-sm text-gray-600">다음 템플릿을 삭제합니다:</p>
        <p className="mb-1 font-semibold text-gray-900">{deleteTarget?.name}</p>
        <p className="mb-4 text-sm text-gray-500">{deleteTarget?.shared_name}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
            취소
          </button>
          <button
            className="btn-danger"
            disabled={deleteTemplate.isPending}
            onClick={async () => {
              if (!deleteTarget) return;
              await deleteTemplate.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            }}
          >
            {deleteTemplate.isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
