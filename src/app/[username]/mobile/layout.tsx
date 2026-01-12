import "@/app/mobile.css";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata = {
    title: 'Portfolio Tracker - Mobile',
    description: 'Track your wealth on mobile',
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
        viewportFit: 'cover'
    },
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
        { media: '(prefers-color-scheme: dark)', color: '#0B0B0F' }
    ],
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Portfolio Tracker'
    },
    formatDetection: {
        telephone: false
    }
};

export default function MobileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ThemeProvider>
            <div className="mobile-app">
                {children}
            </div>
        </ThemeProvider>
    );
}
