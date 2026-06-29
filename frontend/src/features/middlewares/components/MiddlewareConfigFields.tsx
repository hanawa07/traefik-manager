import { Plus, Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { MiddlewareTemplateType } from "../api/middlewareApi";
import type { MiddlewareFormData } from "./middlewareFormModel";

interface MiddlewareConfigFieldsProps {
  type?: MiddlewareTemplateType;
  register: UseFormRegister<MiddlewareFormData>;
  errors: FieldErrors<MiddlewareFormData>;
  fields: { id: string }[];
  append: (value: { key: string; value: string }) => void;
  remove: (index: number) => void;
}

export default function MiddlewareConfigFields({
  type,
  register,
  errors,
  fields,
  append,
  remove,
}: MiddlewareConfigFieldsProps) {
  if (type === "ipAllowList") {
    return (
      <div>
        <label className="label">허용 IP 목록</label>
        <textarea
          className="input min-h-24"
          placeholder={"예:\n192.168.0.0/24\n10.0.0.1"}
          {...register("source_range_input")}
        />
        <p className="mt-1 text-xs text-gray-400">
          한 줄에 IP 또는 CIDR 형식으로 입력. 목록에 없는 IP는 403 차단됩니다.
        </p>
        {errors.source_range_input ? (
          <p className="mt-1 text-xs text-red-500">{errors.source_range_input.message}</p>
        ) : null}
      </div>
    );
  }

  if (type === "rateLimit") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">
            average <span className="font-normal text-gray-400">(초당 평균 요청 수)</span>
          </label>
          <input type="number" className="input" min={1} placeholder="예: 100" {...register("rate_limit_average")} />
        </div>
        <div>
          <label className="label">
            burst <span className="font-normal text-gray-400">(순간 최대 요청 수)</span>
          </label>
          <input type="number" className="input" min={1} placeholder="예: 200" {...register("rate_limit_burst")} />
        </div>
        <p className="col-span-2 text-xs text-gray-400">
          일반 웹: 100/200 · API: 50/100 · 관리자: 20/30. 초과 시 429 응답.
        </p>
        {errors.rate_limit_average ? (
          <p className="col-span-2 mt-1 text-xs text-red-500">{errors.rate_limit_average.message}</p>
        ) : null}
      </div>
    );
  }

  if (type === "basicAuth") {
    return (
      <div>
        <label className="label">users (htpasswd 형식)</label>
        <textarea
          className="input min-h-24"
          placeholder={"예:\nadmin:$apr1$...\nviewer:$2y$..."}
          {...register("basic_auth_users_input")}
        />
        {errors.basic_auth_users_input ? (
          <p className="mt-1 text-xs text-red-500">{errors.basic_auth_users_input.message}</p>
        ) : null}
        <p className="mt-1 text-xs text-gray-500">한 줄에 `username:hashedPassword` 형태로 입력합니다</p>
      </div>
    );
  }

  if (type === "headers") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">customResponseHeaders</p>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 py-1.5 text-sm"
            onClick={() => append({ key: "", value: "" })}
          >
            <Plus className="h-3.5 w-3.5" />
            헤더 추가
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input className="input" placeholder="헤더 키" {...register(`custom_headers.${index}.key`)} />
              <input className="input" placeholder="헤더 값" {...register(`custom_headers.${index}.value`)} />
              <button
                type="button"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                title="헤더 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {errors.custom_headers ? (
          <p className="mt-1 text-xs text-red-500">{errors.custom_headers.message as string}</p>
        ) : null}
      </div>
    );
  }

  return null;
}
