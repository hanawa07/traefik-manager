export function RedirectsLoadingRows() {
  return (
    <div className="space-y-3 p-6">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}
