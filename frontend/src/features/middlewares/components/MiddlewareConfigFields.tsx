import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { MiddlewareTemplateType } from "../api/middlewareApi";
import { BasicAuthConfigFields } from "./BasicAuthConfigFields";
import { HeadersConfigFields } from "./HeadersConfigFields";
import { IpAllowListConfigFields } from "./IpAllowListConfigFields";
import { RateLimitConfigFields } from "./RateLimitConfigFields";
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
    return <IpAllowListConfigFields register={register} errors={errors} />;
  }

  if (type === "rateLimit") {
    return <RateLimitConfigFields register={register} errors={errors} />;
  }

  if (type === "basicAuth") {
    return <BasicAuthConfigFields register={register} errors={errors} />;
  }

  if (type === "headers") {
    return (
      <HeadersConfigFields
        register={register}
        errors={errors}
        fields={fields}
        append={append}
        remove={remove}
      />
    );
  }

  return null;
}
