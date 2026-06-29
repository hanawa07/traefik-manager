export default function LoginBrandHeader() {
  return (
    <div className="text-center mb-10">
      <div className="relative inline-block group">
        <div className="absolute -inset-10 bg-brand-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        <div className="relative transition-all duration-700 hover:scale-105">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt=""
            className="w-32 h-32 object-contain drop-shadow-[0_20px_40px_rgba(59,130,246,0.2)] dark:drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          />
        </div>
      </div>
      <h1 className="text-3xl font-bold text-white mt-8 tracking-tight">
        Traefik <span className="text-brand-primary">Manager</span>
      </h1>
      <p className="text-slate-400 text-sm mt-2 font-medium tracking-wide">
        프리미엄 인프라 통합 관리 시스템
      </p>
    </div>
  );
}
