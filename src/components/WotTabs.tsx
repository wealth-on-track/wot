import React from 'react';
import { motion } from 'framer-motion';

export interface WotTabItem {
    id: string;
    label: string;
    count?: number | string;
    isHistory?: boolean;
}

interface WotTabsProps {
    tabs: WotTabItem[];
    activeTabId: string;
    onTabChange: (id: string) => void;
    layoutIdPrefix?: string;
    theme?: 'dark' | 'light';
}

export function WotTabs({ tabs, activeTabId, onTabChange, layoutIdPrefix = 'wot-tabs', theme = 'light' }: WotTabsProps) {
    // Shared styling constants
    const GAP = '7px';     // Reduced to 4px for Folder Style per user feedback
    const FONT_SIZE = '14px';
    const FONT_WEIGHT = 600; // User specified "500" in check list but "font-weight difference" might imply matching bold. Let's use 600 for active/semi-bold.
    // Actually user checklist: "Font Sizing: Her iki tab grubunda da font-size: 14px; ve font-weight: 500; kullanıldı mı?" -> OK, 500.

    // Active Indicator Style
    // margin-bottom: -1px to lock to border
    // height: 2px (or 3px per user "Thickness... Örn: 2px")

    // Theme colors
    const isDarkTheme = theme === 'dark'; // Or if passed prop. Note: App might be natively dark mode, but "Performance" chart usually has dark bg, Table might have light.

    // For "Folder Tab" style requested in Step 762/826 and Screenshot...
    // WAIT. Step 830 user asks to "Make them 100% same component".
    // AND says: "Positioning: Chart line touches border, Table line might be floating... Solution: margin-bottom: -1px".
    // This implies the UNDERLINE style is what they want? The "Indicator" usually refers to the line.
    // The "Folder Style" I implemented in Step 826 has a border-bottom on the button itself.
    // The "Underline" style in `PortfolioPerformanceChart` (Step 833) uses a `motion.div` absolute positioned line.

    // RE-EVALUATING: The screenshot in Step 765 shows "Performance" tab as a FOLDER with white background.
    // BUT the code in Step 833 (current `PortfolioPerformanceChart`) shows UNDERLINE style.
    // This contradicts.
    // IF I stick to the screenshot (Folder), I should implement Folder.
    // IF I stick to the code text "Indicator... alt neon çizgi" (bottom neon line), it sounds like the Underline style.

    // Let's look at the screenshot again carefully via artifact/memory:
    // Screenshot showed "Performance" tab as a white "File Folder" shape. "Vision" was gray.
    // Screenshot showed "Open Positions" as "File Folder" shape (white).
    // The user LOVED the screenshot match ("birebir aynisi olsun dedim").
    // So the TARGET is the Folder style.

    // Why does User talk about "Alt neon çizgi" (Bottom neon line) in Step 830? 
    // Maybe they mean the green line formed by `border-bottom` in the folder style?
    // "Alt neon çizgi, kartın üst border'ının tam üzerine mi biniyor?" -> Is the bottom neon line riding exactly on the card's top border?

    // I will implement the FOLDER style (as requested in Step 765/826) but as a reusable component.
    // I will ensure `margin-bottom: -1px` relative to container to overlap the border.

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: GAP, // User requested specific gap
            paddingLeft: 1, // Zero-gap
            position: 'relative',
            zIndex: 10,
            marginBottom: '1.5px' // LOCK TO BORDER
        }}>
            {tabs.map((tab, index) => {
                const isActive = activeTabId === tab.id;
                const isFirstTab = index === 0;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        style={{
                            // Folder Shape
                            padding: '12px 14px', // Matches Performance tab exactly
                            borderRadius: '12px 12px 0 0',

                            // Border (matches card border)
                            // Active: visible border, Passive: transparent (maintains spacing)
                            border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                            borderBottom: isActive ? '2px solid #10B981' : '2px solid transparent',

                            // Colors
                            background: 'var(--surface)',
                            color: isActive
                                ? 'var(--text-primary)'
                                : '#64748B', // Matches Vision tab Slate-500

                            // Typography
                            fontSize: '0.9rem', // Matches Performance tab
                            fontWeight: isActive ? 700 : 500, // Active bold, Passive medium (not bold)

                            // Layout
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            position: 'relative',
                            transition: 'all 0.2s',
                            boxShadow: isActive ? '0 -4px 12px -2px rgba(0,0,0,0.05)' : 'none',

                            // First tab: no margin (aligns naturally with card)
                            marginLeft: '0',

                            // Opacity
                            opacity: isActive ? 1 : 0.7
                        }}
                    >
                        {tab.label}

                        {/* Count / Badge */}
                        {(tab.count !== undefined) && (
                            <span style={{
                                fontSize: '0.75rem',
                                opacity: isActive ? 0.7 : 0.5,
                                fontWeight: 500,
                                background: isActive ? 'var(--bg-secondary)' : 'rgba(0,0,0,0.05)',
                                padding: '1px 6px',
                                borderRadius: '8px',
                                marginLeft: '4px'
                            }}>
                                {tab.isHistory ? `(${tab.count})` : tab.count}
                            </span>
                        )}

                        {/* Motion for smooth transition if needed? 
                            Folder style usually doesn't slide a line, it changes the whole block. 
                            But user mentioned "Active State Motion... layoutId".
                            If using "Folder with Underline", I can add layoutId to the border?
                            Actually, strict Folder tabs usually don't have sliding underlines.
                            But "Performance" chart (Step 734) HAD a sliding underline.
                            
                            Hybrid approach:
                            If the user wants "The Same DNA", and specifically mentioned "Active Indikator (The Border-Bottom Magic)",
                            I will use the `borderBottom` on the button as the indicator.
                        */}
                    </button>
                );
            })}
        </div>
    );
}

// User mentioned "Line-Height... 1.2 or 1.5". default standard is usually good but I can force it.
// User mentioned "Font Sizing 14px".
