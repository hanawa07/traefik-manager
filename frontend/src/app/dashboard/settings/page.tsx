"use client";

import SettingsPageHeader from "./SettingsPageHeader";
import { SettingsPageSections } from "./SettingsPageSections";
import { useSettingsPageModel } from "./useSettingsPageModel";

export default function SettingsPage() {
  const settingsPage = useSettingsPageModel();

  return (
    <div className="p-8">
      <SettingsPageHeader />
      <SettingsPageSections {...settingsPage} />
    </div>
  );
}
