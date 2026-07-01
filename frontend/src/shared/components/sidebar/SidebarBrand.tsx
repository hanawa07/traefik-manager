import Image from "next/image";

export function SidebarBrand() {
  return (
    <div
      className={
        "flex flex-col items-center gap-4 border-b border-sidebar-border/10 " +
        "bg-gradient-to-b from-black/[0.01] to-transparent px-6 py-12 dark:border-slate-800"
      }
    >
      <div className="group relative cursor-default">
        <div
          className={
            "absolute -inset-8 rounded-full bg-brand-primary/5 opacity-0 blur-3xl " +
            "transition-all duration-1000 group-hover:opacity-100"
          }
        />
        <div className="relative transition-all duration-700 hover:scale-105">
          <Image
            src="/icon.png"
            alt=""
            width={160}
            height={160}
            className={
              "h-40 w-40 object-contain drop-shadow-[0_20px_30px_rgba(59,130,246,0.15)] " +
              "dark:drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            }
          />
        </div>
      </div>

      <div className="mt-2 w-full text-center">
        <Image
          src="/logo.png"
          alt="Traefik Manager"
          width={160}
          height={40}
          className="mx-auto h-10 w-auto object-contain dark:brightness-110"
        />
      </div>
    </div>
  );
}
