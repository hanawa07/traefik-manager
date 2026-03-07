"use client";
import { Shield } from "lucide-react";

export default function CertificatesPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">인증서</h1>
        <p className="text-gray-500 text-sm mt-1">TLS 인증서 상태 관리</p>
      </div>

      <div className="card py-20 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 font-medium">Phase 2에서 구현 예정</p>
        <p className="text-gray-400 text-sm mt-1">
          Traefik API 연동으로 인증서 만료일 및 상태를 표시합니다
        </p>
      </div>
    </div>
  );
}
