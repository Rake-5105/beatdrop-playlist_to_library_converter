import { Skeleton } from "@/components/ui/skeleton";

export const PlaylistSkeleton = () => {
  return (
    <section className="w-full animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-2xl glass glow-white-sm overflow-hidden border-foreground/[0.09]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-foreground/[0.07] bg-foreground/[0.03]">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          </div>

          {/* Tracks */}
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl">
                <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
                <Skeleton className="h-4 w-10 hidden sm:block" />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-foreground/[0.07] bg-foreground/[0.02] p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <Skeleton className="h-11 w-36 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
