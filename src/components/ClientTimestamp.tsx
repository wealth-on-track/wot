'use client';

export default function ClientTimestamp({ date }: { date: Date | string }) {
    // Format: DD.MM.YYYY HH:MM:SS
    // suppressHydrationWarning is essential because Server renders UTC, Client renders Local
    return (
        <span suppressHydrationWarning>
            {new Date(date).toLocaleString('tr-TR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            })}
        </span>
    );
}
