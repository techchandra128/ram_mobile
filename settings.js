// settings.js

const HOMEPAGE_KEY = 'ram_homepage';
const DEFAULT_HOMEPAGE = 'library';

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    loadHomepage();

    // Listen for theme changes from parent
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'themeChange') {
            document.documentElement.setAttribute('data-theme', e.data.theme);
        }
    });

    // Save on radio change and notify parent
    document.querySelectorAll('input[name="homepage"]').forEach(radio => {
        radio.addEventListener('change', () => {
            localStorage.setItem(HOMEPAGE_KEY, radio.value);
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'homepageChanged', value: radio.value }, '*');
            }
        });
    });
});

function applyTheme() {
    const theme = localStorage.getItem('ram_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
}

function loadHomepage() {
    const saved = localStorage.getItem(HOMEPAGE_KEY) || DEFAULT_HOMEPAGE;
    const radio = document.querySelector(`input[name="homepage"][value="${saved}"]`);
    if (radio) radio.checked = true;
}