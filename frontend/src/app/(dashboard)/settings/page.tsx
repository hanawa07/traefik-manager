"use client";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 text-sm mt-1">시스템 설정</p>
      </div>

      <div className="card py-20 text-center">
        <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 font-medium">Phase 4에서 구현 예정</p>
        <p className="text-gray-400 text-sm mt-1">
          멀티 사용자, 백업/복원, Cloudflare DNS 연동 설정
        </p>
      </div>
    </div>
  );
}
