export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true"><span className="skeleton-shape"/><span className="skeleton-shape"/><span className="skeleton-shape"/></div>;
}

export function VideoListSkeleton() {
  return <div className="latest-list" role="status" aria-label="Loading videos">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="video-skeleton"/>)}</div>;
}

export function CardGridSkeleton() {
  return <div className="playlist-strip" role="status" aria-label="Loading items">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="card-skeleton"/>)}</div>;
}

export function MeetingListSkeleton() {
  return <div className="zoom-meeting-list" role="status" aria-label="Loading meetings">{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="meeting-skeleton"/>)}</div>;
}
