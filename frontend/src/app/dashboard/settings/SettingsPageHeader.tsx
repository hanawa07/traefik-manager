const SETTINGS_CATEGORY_LINKS = [
  { href: "#settings-basic", label: "기본" },
  { href: "#settings-security", label: "보안" },
  { href: "#settings-operations", label: "운영" },
  { href: "#settings-data", label: "데이터" },
];

export default function SettingsPageHeader() {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">설정</h1>
      <p className="text-gray-500 text-sm mt-1 dark:text-slate-400">시스템 설정</p>
      <nav
        aria-label="설정 범주 바로가기"
        className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-gray-200 py-2.5 dark:border-slate-700"
        data-testid="settings-category-nav"
      >
        {SETTINGS_CATEGORY_LINKS.map((link) => (
          <a
            key={link.href}
            className="rounded-sm text-sm font-medium text-gray-600 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 dark:text-slate-300 dark:hover:text-blue-300"
            href={link.href}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
