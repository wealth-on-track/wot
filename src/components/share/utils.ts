export const formatValue = (value: number, currency: string, isMasked: boolean) => {
    if (isMasked) return "****";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(value);
};

export const generateImage = async (elementId: string) => {
    // Dynamic import to avoid SSR issues if any
    const { toPng } = await import('html-to-image');
    const node = document.getElementById(elementId);
    if (!node) throw new Error('Element not found');

    // Safety delay to ensure fonts/images loaded
    // await new Promise(resolve => setTimeout(resolve, 100));

    const dataUrl = await toPng(node, {
        pixelRatio: 2, // Retina quality
        backgroundColor: '#0f172a', // Ensure dark background
        cacheBust: true,
        style: {
            // Force visibility in case it was hidden
            display: 'flex',
            visibility: 'visible'
        }
    });

    return dataUrl;
};
