"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useServices, useDeleteService } from "@/features/services/hooks/useServices";
import ServiceCard from "@/features/services/components/ServiceCard";
import Modal from "@/shared/components/Modal";
import { Service } from "@/features/services/api/serviceApi";
import { Server, Plus, Search, ArrowUpDown } from "lucide-react";
import { useTraefikRouterStatus } from "@/features/traefik/hooks/useTraefik";
import { useAuthStore } from "@/features/auth/store/useAuthStore";

type SortKey = "name" | "domain" | "auth" | "router" | "created_at";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "이름" },
  { value: "domain", label: "도메인" },
  { value: "auth", label: "인증 여부" },
  { value: "router", label: "라우터 상태" },
  { value: "created_at", label: "생성일" },
];

export default function ServicesPage() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const { data: services = [], isLoading } = useServices();
  const { data: routerStatus } = useTraefikRouterStatus();
  const deleteService = useDeleteService();
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteService.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? services.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.domain.toLowerCase().includes(q)
      )
      : [...services];

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "domain") cmp = a.domain.localeCompare(b.domain);
      else if (sortKey === "auth")
        cmp =
          Number(b.auth_enabled || b.basic_auth_enabled) -
          Number(a.auth_enabled || a.basic_auth_enabled);
      else if (sortKey === "router") {
        const ra = routerStatus?.domains?.[a.domain]?.active;
        const rb = routerStatus?.domains?.[b.domain]?.active;
        cmp = Number(rb ?? false) - Number(ra ?? false);
      } else if (sortKey === "created_at")
        cmp = a.created_at > b.created_at ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [services, search, sortKey, sortDir, routerStatus]);

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">서비스</h1>
          <p className="text-gray-500 text-sm mt-1">
            Traefik 라우팅 서비스 관리 ({filteredServices.length}/{services.length}개)
          </p>
        </div>
        {canManage ? (
          <Link href="/dashboard/services/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            서비스 추가
          </Link>
        ) : null}
      </div>

      {/* 검색 + 정렬 툴바 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름 또는 도메인 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ArrowUpDown className="w-4 h-4 text-gray-400" />
          <select
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value as SortKey);
              setSortDir("asc");
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors select-none min-w-[70px]"
            title={sortDir === "asc" ? "오름차순" : "내림차순"}
          >
            {sortDir === "asc" ? "↑ 오름" : "↓ 내림"}
          </button>
        </div>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="card py-20 text-center">
          <Server className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">
            {search ? `"${search}" 검색 결과가 없습니다` : "등록된 서비스가 없습니다"}
          </p>
          {search ? (
            <button
              onClick={() => setSearch("")}
              className="text-blue-500 text-sm mt-2 hover:underline"
            >
              검색 초기화
            </button>
          ) : canManage ? (
            <Link
              href="/dashboard/services/new"
              className="btn-primary inline-flex items-center gap-2 mt-4"
            >
              <Plus className="w-4 h-4" />
              서비스 추가
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onDelete={setDeleteTarget}
              routerActive={routerStatus?.domains?.[service.domain]?.active}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="서비스 삭제"
      >
        <p className="text-gray-600 text-sm mb-1">다음 서비스를 삭제합니다:</p>
        <p className="font-semibold text-gray-900 mb-1">{deleteTarget?.name}</p>
        <p className="text-sm text-gray-500 mb-4">{deleteTarget?.domain}</p>
        {deleteTarget?.auth_enabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-amber-700 text-sm">
              ⚠️ Authentik Provider/Application도 함께 삭제됩니다
            </p>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
            취소
          </button>
          <button
            className="btn-danger"
            onClick={handleDelete}
            disabled={deleteService.isPending}
          >
            {deleteService.isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
