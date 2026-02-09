"use client";

import { MobileVision } from "./MobileVision";

interface MobileVisionTabProps {
    totalValueEUR: number;
    onOpenImpactSheet: () => void;
}

export function MobileVisionTab({ totalValueEUR }: MobileVisionTabProps) {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <MobileVision totalValueEUR={totalValueEUR} />
        </div>
    );
}
