export function ProfileSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto py-8 px-4 md:px-6 animate-pulse">
      {/* Profile Header: Avatar + Name + Badges + Button */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between pb-6 border-b">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-5 w-24 rounded-lg bg-muted" />
              <div className="h-5 w-32 rounded-lg bg-muted" />
            </div>
          </div>
        </div>
        <div className="h-10 w-32 rounded-xl bg-muted" />
      </div>

      {/* Tab Selector */}
      <div className="flex justify-center">
        <div className="h-11 w-full max-w-[400px] rounded-xl bg-muted" />
      </div>

      {/* Content Grid: 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Column: Personal Info + Plan Usage */}
        <div className="space-y-6">
          <div className="h-56 rounded-2xl bg-muted" />
          <div className="h-72 rounded-2xl bg-muted" />
        </div>

        {/* Right Column: Organization Card */}
        <div className="h-80 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
