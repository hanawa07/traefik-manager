"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ServiceCreate } from "../api/serviceApi";

const schema = z.object({
  name: z.string().min(1, "서비스 이름을 입력하세요"),
  domain: z.string().regex(
    /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    "유효한 도메인 형식이 아닙니다"
  ),
  upstream_host: z.string().min(1, "업스트림 호스트를 입력하세요"),
  upstream_port: z.coerce.number().min(1).max(65535, "1~65535 범위의 포트를 입력하세요"),
  tls_enabled: z.boolean(),
  auth_enabled: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface ServiceFormProps {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: ServiceCreate) => void;
  loading?: boolean;
  submitLabel?: string;
}

export default function ServiceForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: ServiceFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tls_enabled: true,
      auth_enabled: false,
      upstream_port: 80,
      ...defaultValues,
    },
  });

  const authEnabled = watch("auth_enabled");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* 서비스 이름 */}
      <div>
        <label className="label">서비스 이름</label>
        <input className="input" placeholder="예: Portainer" {...register("name")} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      {/* 도메인 */}
      <div>
        <label className="label">도메인</label>
        <input className="input" placeholder="예: portainer.example.com" {...register("domain")} />
        {errors.domain && <p className="text-xs text-red-500 mt-1">{errors.domain.message}</p>}
      </div>

      {/* 업스트림 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">업스트림 호스트</label>
          <input className="input" placeholder="예: 192.168.1.100" {...register("upstream_host")} />
          {errors.upstream_host && <p className="text-xs text-red-500 mt-1">{errors.upstream_host.message}</p>}
        </div>
        <div>
          <label className="label">포트</label>
          <input type="number" className="input" placeholder="8080" {...register("upstream_port")} />
          {errors.upstream_port && <p className="text-xs text-red-500 mt-1">{errors.upstream_port.message}</p>}
        </div>
      </div>

      {/* 토글 옵션 */}
      <div className="space-y-3 pt-1">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("tls_enabled")} />
          <div>
            <span className="text-sm font-medium text-gray-700">HTTPS (TLS) 활성화</span>
            <p className="text-xs text-gray-500">Let's Encrypt 인증서 자동 발급</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("auth_enabled")} />
          <div>
            <span className="text-sm font-medium text-gray-700">Authentik 인증 활성화</span>
            <p className="text-xs text-gray-500">
              {authEnabled
                ? "Authentik에 Provider/Application이 자동 생성됩니다"
                : "활성화 시 웹 로그인 폼이 추가됩니다"}
            </p>
          </div>
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
