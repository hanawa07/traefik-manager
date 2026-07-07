"use client";

import ToastNotice from "@/shared/components/ToastNotice";
import SettingsPageHeader from "./SettingsPageHeader";
import { SettingsPageSections } from "./SettingsPageSections";
import { useSettingsPageModel } from "./useSettingsPageModel";

export default function SettingsPage() {
  const settingsPage = useSettingsPageModel();
  const { toastNotice, onDismissToast, ...sections } = settingsPage;

  return (
    <div className="p-8">
      <ToastNotice notice={toastNotice} onClose={onDismissToast} />
      <SettingsPageHeader />
      <SettingsPageSections {...sections} />
    </div>
  );
}
