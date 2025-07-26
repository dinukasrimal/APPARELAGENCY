// Tablet breakpoints
export const TABLET_BREAKPOINTS = {
  small: 768,  // 4 inch tablet
  medium: 1024, // 7.5 inch tablet
  large: 1280
};

// Check if current device is a tablet
export const isTablet = () => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  return /ipad|android(?!.*mobile)/.test(userAgent);
};

// Get tablet size category
export const getTabletSize = () => {
  if (typeof window === 'undefined') return 'unknown';
  
  const width = window.innerWidth;
  if (width <= TABLET_BREAKPOINTS.small) return 'small';
  if (width <= TABLET_BREAKPOINTS.medium) return 'medium';
  return 'large';
};

// Get responsive class names based on tablet size
export const getResponsiveClasses = (baseClasses: string, tabletClasses: string) => {
  return isTablet() ? tabletClasses : baseClasses;
};

// Get optimal font size for tablet
export const getTabletFontSize = () => {
  const size = getTabletSize();
  switch (size) {
    case 'small':
      return 'text-sm';
    case 'medium':
      return 'text-base';
    case 'large':
      return 'text-lg';
    default:
      return 'text-base';
  }
};

// Get optimal padding for tablet
export const getTabletPadding = () => {
  const size = getTabletSize();
  switch (size) {
    case 'small':
      return 'p-2';
    case 'medium':
      return 'p-4';
    case 'large':
      return 'p-6';
    default:
      return 'p-4';
  }
};

// Get optimal grid columns for tablet
export const getTabletGridCols = () => {
  const size = getTabletSize();
  switch (size) {
    case 'small':
      return 'grid-cols-1';
    case 'medium':
      return 'grid-cols-2';
    case 'large':
      return 'grid-cols-3';
    default:
      return 'grid-cols-2';
  }
}; 