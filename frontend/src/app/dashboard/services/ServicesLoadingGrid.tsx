export function ServicesLoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[...Array(6)].map((_, index) => (
        <div key={index} className="card h-36 animate-pulse p-5" />
      ))}
    </div>
  );
}
