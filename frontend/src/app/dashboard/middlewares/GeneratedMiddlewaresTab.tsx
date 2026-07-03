import type { Service } from "@/features/services/api/serviceApi";

import { GeneratedMiddlewaresHeader } from "./GeneratedMiddlewaresHeader";
import { GeneratedMiddlewareServiceCard } from "./GeneratedMiddlewareServiceCard";
import {
  GeneratedMiddlewaresStatusPanels,
  GeneratedRuntimeBanner,
} from "./GeneratedMiddlewaresStatusPanels";
import { type GeneratedMiddlewareItem } from "./middlewarePageHelpers";

interface GeneratedMiddlewaresTabProps {
  generatedSearch: string;
  onGeneratedSearchChange: (value: string) => void;
  runtimeBannerMessage: string | null;
  isServicesLoading: boolean;
  isRuntimeLoading: boolean;
  isServicesError: boolean;
  servicesError: unknown;
  generatedServiceCount: number;
  generatedServiceGroups: Array<{
    service: Service;
    items: GeneratedMiddlewareItem[];
  }>;
}

export default function GeneratedMiddlewaresTab({
  generatedSearch,
  onGeneratedSearchChange,
  runtimeBannerMessage,
  isServicesLoading,
  isRuntimeLoading,
  isServicesError,
  servicesError,
  generatedServiceCount,
  generatedServiceGroups,
}: GeneratedMiddlewaresTabProps) {
  const shouldShowGroups =
    !isServicesLoading && !isRuntimeLoading && !isServicesError && generatedServiceCount > 0;

  return (
    <div className="space-y-4">
      <GeneratedMiddlewaresHeader
        generatedSearch={generatedSearch}
        onGeneratedSearchChange={onGeneratedSearchChange}
      />

      <GeneratedRuntimeBanner runtimeBannerMessage={runtimeBannerMessage} />
      <GeneratedMiddlewaresStatusPanels
        generatedServiceCount={generatedServiceCount}
        isRuntimeLoading={isRuntimeLoading}
        isServicesError={isServicesError}
        isServicesLoading={isServicesLoading}
        servicesError={servicesError}
      />

      {shouldShowGroups ? (
        <div className="space-y-4">
          {generatedServiceGroups.map(({ service, items }) => (
            <GeneratedMiddlewareServiceCard key={service.id} service={service} items={items} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
