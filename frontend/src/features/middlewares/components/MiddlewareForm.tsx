"use client";

import { useMemo } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { MiddlewareTemplate, MiddlewareTemplateCreate } from "../api/middlewareApi";
import MiddlewareConfigFields from "./MiddlewareConfigFields";
import {
  buildMiddlewareTemplatePayload,
  extractMiddlewareFormDefaults,
  type MiddlewareFormData,
  middlewareFormSchema,
} from "./middlewareFormModel";

interface MiddlewareFormProps {
  defaultValues?: MiddlewareTemplate;
  onSubmit: (data: MiddlewareTemplateCreate) => void;
  loading?: boolean;
  submitLabel?: string;
}

export default function MiddlewareForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: MiddlewareFormProps) {
  const formDefaults = useMemo(() => extractMiddlewareFormDefaults(defaultValues), [defaultValues]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<MiddlewareFormData>({
    resolver: zodResolver(middlewareFormSchema),
    defaultValues: formDefaults,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "custom_headers",
  });
  const type = useWatch({ control, name: "type" });

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(buildMiddlewareTemplatePayload(data)))}
      className="space-y-5"
    >
      <div>
        <label className="label">템플릿 이름</label>
        <input className="input" placeholder="예: 사내망 허용 IP" {...register("name")} />
        {errors.name ? <p className="mt-1 text-xs text-red-500">{errors.name.message}</p> : null}
      </div>

      <div>
        <label className="label">미들웨어 타입</label>
        <select className="input" {...register("type")}>
          <option value="ipAllowList">ipAllowList — 특정 IP만 접근 허용</option>
          <option value="rateLimit">rateLimit — 초당 요청 수 제한 (DDoS 방어)</option>
          <option value="basicAuth">basicAuth — 아이디/비밀번호 팝업 인증</option>
          <option value="headers">headers — 응답 헤더 추가/수정</option>
        </select>
      </div>

      <MiddlewareConfigFields
        type={type}
        register={register}
        errors={errors}
        fields={fields}
        append={append}
        remove={remove}
      />

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" className="btn-primary w-full justify-center sm:w-auto" disabled={loading}>
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
