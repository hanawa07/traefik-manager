"use client";

import GeneratedMiddlewaresTab from "./GeneratedMiddlewaresTab";
import MiddlewarePageHeader from "./MiddlewarePageHeader";
import MiddlewareTemplateModals from "./MiddlewareTemplateModals";
import SharedMiddlewareTemplatesTab from "./SharedMiddlewareTemplatesTab";
import { useMiddlewaresPageModel } from "./useMiddlewaresPageModel";

export default function MiddlewaresPage() {
  const { pageHeader, sharedTab, generatedTab, modals } = useMiddlewaresPageModel();

  return (
    <div>
      <MiddlewarePageHeader {...pageHeader} />
      {pageHeader.activeTab === "templates" ? (
        <SharedMiddlewareTemplatesTab {...sharedTab} />
      ) : (
        <GeneratedMiddlewaresTab {...generatedTab} />
      )}
      <MiddlewareTemplateModals {...modals} />
    </div>
  );
}
