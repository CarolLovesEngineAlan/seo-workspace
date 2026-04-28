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

export default function BriefRecordsLoading() {
  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] text-[#1c221d]">
      <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-6">
        <header className="mb-[18px] rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] px-[22px] py-4 shadow-[0_20px_60px_rgba(44,38,22,0.11)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-40" />
              <SkeletonBlock className="h-3 w-64" />
            </div>
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="h-11 w-[320px] rounded-full" />
              <SkeletonBlock className="h-8 w-24 rounded-full" />
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]">
            <div className="border-b border-[rgba(28,34,29,0.1)] px-[18px] py-4">
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="mt-3 h-10 w-full" />
            </div>
            <div className="space-y-3 p-[14px]">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[18px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.72)] p-4"
                >
                  <SkeletonBlock className="h-5 w-2/3" />
                  <SkeletonBlock className="mt-2 h-3 w-1/2" />
                  <div className="mt-3 flex gap-2">
                    <SkeletonBlock className="h-7 w-20 rounded-full" />
                    <SkeletonBlock className="h-7 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]">
            <div className="border-b border-[rgba(28,34,29,0.1)] px-[18px] py-4">
              <SkeletonBlock className="h-5 w-36" />
            </div>
            <div className="space-y-4 px-[18px] py-[18px]">
              <SkeletonBlock className="h-8 w-1/2" />
              <div className="flex flex-wrap gap-2">
                <SkeletonBlock className="h-7 w-24 rounded-full" />
                <SkeletonBlock className="h-7 w-20 rounded-full" />
                <SkeletonBlock className="h-7 w-28 rounded-full" />
              </div>
              <SkeletonBlock className="h-40 w-full" />
              <SkeletonBlock className="h-80 w-full" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
