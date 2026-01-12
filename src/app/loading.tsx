import { DashboardSkeleton } from "@/components/SkeletonLoader";

export default function Loading() {
    return (
        <div style={{ paddingTop: '6rem' }}>
            <DashboardSkeleton />
        </div>
    );
}
