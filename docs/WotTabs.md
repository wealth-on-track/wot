# WotTabs - Unified Tab Component

## 📖 Overview

`WotTabs` is the centralized tab system used across the Wealth On Track application. It provides a consistent, folder-style tab interface with customizable styling.

## ✨ Features

- **Folder-style tabs** with active indicator
- **Customizable colors** - Change active indicator color globally
- **Count badges** - Display counts or labels on tabs
- **Smooth transitions** - Professional animations
- **Consistent styling** - One component, multiple uses

## 🎯 Usage

### Basic Example

```tsx
import { WotTabs } from '@/components/WotTabs';

function MyComponent() {
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <WotTabs
      tabs={[
        { id: 'tab1', label: 'First Tab' },
        { id: 'tab2', label: 'Second Tab' }
      ]}
      activeTabId={activeTab}
      onTabChange={setActiveTab}
    />
  );
}
```

### With Count Badges

```tsx
<WotTabs
  tabs={[
    { id: 'open', label: 'Open Positions', count: 15 },
    { id: 'closed', label: 'Closed Positions', count: 8, isHistory: true }
  ]}
  activeTabId={activeTab}
  onTabChange={setActiveTab}
/>
```

### Custom Active Color (Blue Tabs)

```tsx
<WotTabs
  tabs={[
    { id: 'performance', label: 'Performance' },
    { id: 'vision', label: 'Vision' }
  ]}
  activeTabId={activeTab}
  onTabChange={setActiveTab}
  activeIndicatorColor="#3B82F6" // Blue instead of default green
/>
```

### Custom Gap

```tsx
<WotTabs
  tabs={tabs}
  activeTabId={activeTab}
  onTabChange={setActiveTab}
  gap="12px" // Wider spacing between tabs
/>
```

## 🎨 Customization

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `WotTabItem[]` | **required** | Array of tab items |
| `activeTabId` | `string` | **required** | Currently active tab ID |
| `onTabChange` | `(id: string) => void` | **required** | Callback when tab changes |
| `layoutIdPrefix` | `string` | `'wot-tabs'` | Prefix for animation layout IDs |
| `theme` | `'dark' \| 'light'` | `'light'` | Theme variant |
| `activeIndicatorColor` | `string` | `'#10B981'` | Color of active tab bottom border |
| `gap` | `string` | `'7px'` | Gap between tabs |

### WotTabItem Interface

```typescript
interface WotTabItem {
  id: string;              // Unique identifier
  label: string;           // Display text
  count?: number | string; // Optional count badge
  isHistory?: boolean;     // If true, count shown as (count)
}
```

## 🌈 Color Examples

Want to change the active tab color globally? Just update the `activeIndicatorColor` prop:

- **Green (Default)**: `#10B981`
- **Blue**: `#3B82F6`
- **Purple**: `#8B5CF6`
- **Red**: `#EF4444`
- **Orange**: `#F59E0B`

## 📍 Current Usage

### 1. Portfolio Performance Chart
Location: `src/components/PortfolioPerformanceChart.tsx`

```tsx
<WotTabs
  tabs={[
    { id: 'performance', label: 'Performance' },
    { id: 'vision', label: 'Vision' }
  ]}
  activeTabId={!isVisionMode ? 'performance' : 'vision'}
  onTabChange={(id) => setIsVisionMode(id === 'vision')}
/>
```

### 2. Dashboard Positions
Location: `src/components/DashboardV2.tsx`

```tsx
<WotTabs
  tabs={[
    { id: 'open', label: 'Open Positions', count: availableAssets.length },
    { id: 'closed', label: 'Closed Positions', count: 0, isHistory: true }
  ]}
  activeTabId={activeTab}
  onTabChange={(id) => setActiveTab(id as 'open' | 'closed')}
/>
```

## 🎯 Design Philosophy

The WotTabs component follows the "folder tab" design pattern where:

1. **Active tabs** have:
   - Visible border
   - Colored bottom indicator
   - Higher opacity
   - Subtle shadow

2. **Inactive tabs** have:
   - Transparent border (maintains spacing)
   - Lower opacity
   - Muted text color

3. **Positioning**:
   - `marginBottom: '1.5px'` locks tabs to card border
   - Creates seamless integration with card below

## 🚀 Benefits of Centralization

### Before (Multiple Implementations)
```tsx
// PortfolioPerformanceChart.tsx - 90 lines of tab code
<button onClick={...} style={{...}}>Performance</button>
<button onClick={...} style={{...}}>Vision</button>

// DashboardV2.tsx - Another 90 lines of similar tab code
<button onClick={...} style={{...}}>Open Positions</button>
<button onClick={...} style={{...}}>Closed Positions</button>
```

### After (Single Component)
```tsx
// Both files now use:
<WotTabs tabs={...} activeTabId={...} onTabChange={...} />
```

**Result**: 
- ✅ 180+ lines of duplicate code eliminated
- ✅ Consistent styling across the app
- ✅ Single source of truth for tab behavior
- ✅ Easy global style changes (e.g., "make all active tabs blue")

## 🔧 Maintenance

To change the active tab color across the entire app:

1. **Option A**: Update default in `WotTabs.tsx`
   ```tsx
   activeIndicatorColor = '#3B82F6' // Change default to blue
   ```

2. **Option B**: Pass prop to each instance
   ```tsx
   <WotTabs {...props} activeIndicatorColor="#3B82F6" />
   ```

## 📝 Notes

- Component uses inline styles for maximum flexibility
- Integrates with CSS variables (`var(--surface)`, `var(--text-primary)`, etc.)
- Fully responsive and accessible
- Smooth transitions via CSS `transition: all 0.2s`

---

**Made with ❤️ for Wealth On Track**
