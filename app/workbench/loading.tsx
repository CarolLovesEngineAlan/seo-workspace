function SkeletonBlock({
  className,
}: {
  className: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-[18px] bg-[rgba(244,240,230,0.9)] ${className}`}
    />
  );
}

function HeaderTabSkeleton({
  width,
}: {
  width: string;
}) {
  return (
    <div className="inline-flex h-8 items-center rounded-full border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.55)] px-3">
      <SkeletonBlock className={`h-3 ${width}`} />
      <SkeletonBlock className="ml-2 h-4 w-7 rounded-full" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-[rgba(28,34,29,0.06)]">
      <td className="w-10 px-4 py-3">
        <SkeletonBlock className="size-4 rounded-[4px]" />
      </td>
      <td className="min-w-[220px] px-4 py-3">
        <SkeletonBlock className="h-4 w-[180px]" />
        <SkeletonBlock className="mt-2 h-5 w-[96px] rounded-full" />
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="h-5 w-[88px] rounded-full" />
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="h-5 w-[84px] rounded-full" />
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="h-5 w-[72px]" />
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="h-5 w-[48px]" />
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="h-5 w-[72px] rounded-full" />
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="h-5 w-[92px] rounded-full" />
      </td>
      <td className="px-4 py-3">
        <SkeletonBlock className="h-7 w-[58px] rounded-full" />
      </td>
    </tr>
  );
}

export default function WorkbenchLoading() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] text-[#1c221d]">
      <div className="mx-auto w-full max-w-[1560px] px-4 py-6 md:px-6 xl:px-8">
        <div className="sticky top-4 z-40 mb-4">
          <header className="rounded-[26px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.72)] px-[22px] shadow-[0_20px_52px_rgba(44,38,22,0.12)] backdrop-blur-[18px]">
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <SkeletonBlock className="size-[32px] rounded-[10px]" />
                <div>
                  <SkeletonBlock className="h-4 w-36" />
                  <SkeletonBlock className="mt-2 h-3 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden rounded-full border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.5)] px-2 py-1 md:flex md:items-center md:gap-2">
                  <SkeletonBlock className="h-8 w-20 rounded-full" />
                  <SkeletonBlock className="h-8 w-24 rounded-full" />
                  <SkeletonBlock className="h-8 w-24 rounded-full" />
                </div>
                <SkeletonBlock className="h-9 w-28 rounded-full" />
              </div>
            </div>

            <div className="border-t border-[rgba(28,34,29,0.07)] pb-3 pt-2">
              <div className="flex flex-wrap gap-1">
                <HeaderTabSkeleton width="w-10" />
                <HeaderTabSkeleton width="w-12" />
                <HeaderTabSkeleton width="w-16" />
                <HeaderTabSkeleton width="w-16" />
                <HeaderTabSkeleton width="w-14" />
                <HeaderTabSkeleton width="w-12" />
              </div>
            </div>
          </header>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.45)] px-5 py-3">
            <SkeletonBlock className="h-9 w-[200px] rounded-full" />
            <SkeletonBlock className="h-9 w-[116px] rounded-full" />
            <SkeletonBlock className="h-9 w-[116px] rounded-full" />
            <SkeletonBlock className="h-9 w-[118px] rounded-full" />
            <SkeletonBlock className="ml-auto h-3 w-16" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-[rgba(28,34,29,0.08)] bg-[rgba(244,240,230,0.5)]">
                  <th className="w-10 px-4 py-3">
                    <SkeletonBlock className="size-4 rounded-[4px]" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SkeletonBlock className="h-3 w-16" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SkeletonBlock className="h-3 w-12" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SkeletonBlock className="h-3 w-12" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SkeletonBlock className="h-3 w-12" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SkeletonBlock className="h-3 w-10" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SkeletonBlock className="h-3 w-12" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SkeletonBlock className="h-3 w-10" />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SkeletonBlock className="h-3 w-8" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, index) => (
                  <TableRowSkeleton key={index} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(28,34,29,0.08)] px-5 py-3">
            <SkeletonBlock className="h-3 w-36" />
            <div className="flex items-center gap-1">
              <SkeletonBlock className="h-8 w-8 rounded-full" />
              <SkeletonBlock className="h-8 w-8 rounded-full" />
              <SkeletonBlock className="h-8 w-8 rounded-full" />
              <SkeletonBlock className="h-8 w-8 rounded-full" />
              <SkeletonBlock className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
