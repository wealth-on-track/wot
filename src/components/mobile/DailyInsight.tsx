"use client";

import { useMemo, useState, useEffect } from "react";
import { Sparkles, Quote } from "lucide-react";

export function DailyInsight() {
    const [quote, setQuote] = useState<{ text: string, author: string } | null>(null);

    useEffect(() => {
        const quotes = [
            { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
            { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
            { text: "Price is what you pay. Value is what you get.", author: "Warren Buffett" },
            { text: "Compound interest is the eighth wonder of the world.", author: "Albert Einstein" },
            { text: "Time in the market beats timing the market.", author: "Ken Fisher" },
            { text: "Be fearful when others are greedy, and greedy when others are fearful.", author: "Warren Buffett" },
            { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
            { text: "The four most dangerous words in investing are: 'This time it's different.'", author: "Sir John Templeton" },
            { text: "Investing should be more like watching paint dry or watching grass grow.", author: "Paul Samuelson" },
            { text: "You get recessions, you have stock market declines. If you don't understand that's going to happen, then you're not ready, you won't do well in the markets.", author: "Peter Lynch" },
            { text: "The individual investor should act consistently as an investor and not as a speculator.", author: "Ben Graham" },
            { text: "Know what you own, and know why you own it.", author: "Peter Lynch" },
            { text: "Money is just a tool. It will take you wherever you wish, but it will not replace you as the driver.", author: "Ayn Rand" },
            { text: "A budget is telling your money where to go instead of wondering where it went.", author: "Dave Ramsey" },
            { text: "Financial freedom is available to those who learn about it and work for it.", author: "Robert Kiyosaki" },
            { text: "It's not how much money you make, but how much money you keep.", author: "Robert Kiyosaki" },
            { text: "Don't look for the needle in the haystack. Just buy the haystack!", author: "John Bogle" },
            { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
            { text: "Do not save what is left after spending, but spend what is left after saving.", author: "Warren Buffett" },
            { text: "Someone is sitting in the shade today because someone planted a tree a long time ago.", author: "Warren Buffett" }
        ];

        // Random selection on mount
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        setQuote(randomQuote);
    }, []);

    if (!quote) return null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '8px',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(139, 92, 246, 0.03) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.1)',
            borderRadius: '16px',
            marginTop: '24px',
            marginBottom: '40px', // Extra bottom margin
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Decor */}
            <div style={{ position: 'absolute', top: -10, left: -10, opacity: 0.05 }}><Quote size={60} color="var(--accent)" /></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em' }}>Daily Wisdom</span>
                <Sparkles size={14} style={{ color: 'var(--accent)' }} />
            </div>

            <p style={{
                fontSize: '0.9rem',
                fontStyle: 'italic',
                fontWeight: 500,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                margin: 0,
                maxWidth: '90%'
            }}>
                "{quote.text}"
            </p>

            <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginTop: '4px'
            }}>
                — {quote.author}
            </span>
        </div>
    );
}
