import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  className?: string;
  lines?: number;
  withHeader?: boolean;
  withAvatar?: boolean;
}

/**
 * Skeleton loader component for app-like loading states
 * Shows while pages are loading
 */
export function PageSkeleton({
  className,
  lines = 3,
  withHeader = false,
  withAvatar = false,
}: PageSkeletonProps) {
  return (
    <div className={cn('space-y-4 animate-pulse', className)}>
      {/* Header Skeleton */}
      {withHeader && (
        <div className="space-y-2">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-3/4 skeleton" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 skeleton" />
        </div>
      )}

      {/* Avatar Skeleton */}
      {withAvatar && (
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full skeleton" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 skeleton" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3 skeleton" />
          </div>
        </div>
      )}

      {/* Content Skeleton Lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded skeleton" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6 skeleton" />
        </div>
      ))}
    </div>
  );
}

export default PageSkeleton;
