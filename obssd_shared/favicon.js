// Remove existing favicons (optional)
document.querySelectorAll('link[rel="icon"]').forEach(el => el.remove());

// Create new favicon
const link = document.createElement('link');
link.rel = 'icon';
link.type = 'image/png'; // or 'image/x-icon' for .ico files
link.href = '/obssd_assets/OBSSD_FAVICON.png'; // Replace with your favicon path
document.head.appendChild(link);
