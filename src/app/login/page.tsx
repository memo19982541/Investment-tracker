import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 p-8 text-center dark:border-white/10">
        <h1 className="text-xl font-semibold">ติดตามพอร์ตการลงทุน</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          เข้าสู่ระบบด้วยบัญชี Google เพื่อเริ่มใช้งาน
          ข้อมูลของคุณจะถูกเก็บไว้ใน Google Sheets ส่วนตัวของคุณเอง
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button className="w-full rounded-md bg-black py-2.5 font-medium text-white dark:bg-white dark:text-black">
            เข้าสู่ระบบด้วย Google
          </button>
        </form>
      </div>
    </main>
  );
}
