import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { getAccessContext } from "@/lib/auth/server";

export default async function UnauthorizedPage() {
  const access = await getAccessContext();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.24),transparent),radial-gradient(ellipse_42%_44%_at_92%_10%,rgba(29,122,95,0.12),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_52%,#ede8da_100%)] px-4 py-10 text-[#1c221d] md:px-6">
      <div className="mx-auto max-w-[760px] rounded-[28px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] p-8 shadow-[0_20px_60px_rgba(44,38,22,0.11)] md:p-10">
        <div className="inline-flex rounded-full border border-[rgba(178,72,63,0.18)] bg-[rgba(255,245,244,0.88)] px-3 py-1 text-[12px] font-medium uppercase tracking-[0.16em] text-[#b2483f]">
          Access Pending
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.03em]">
          This account is not enabled yet
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-[#5e6860]">
          Your identity has been verified, but workspace access has not been opened for this account yet.
        </p>
        <div className="mt-6 rounded-[18px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.72)] px-4 py-4 text-[14px] leading-7 text-[#1c221d]">
          {access?.user.email || "Unknown account"}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.75)] px-5 text-[14px] font-medium text-[#1c221d]"
          >
            Back
          </Link>
          <LogoutButton className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1d7a5f] px-5 text-[14px] font-medium text-white" />
        </div>
      </div>
    </div>
  );
}
