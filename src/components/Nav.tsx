import Link from "next/link";
import { auth, signOut } from "@/auth";

const links = [
  { href: "/", label: "แดชบอร์ด" },
  { href: "/assets", label: "สินทรัพย์" },
  { href: "/transactions", label: "ธุรกรรม" },
  { href: "/analysis", label: "Analysis" },
  { href: "/prices", label: "อัปเดตราคา" },
  { href: "/history", label: "ประวัติ" },
  { href: "/import", label: "นำเข้าข้อมูล" },
];

export default async function Nav() {
  const session = await auth();
  if (!session) return null;

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-black/60 dark:text-white/60">
          <span className="hidden sm:inline">{session.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded-md border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
