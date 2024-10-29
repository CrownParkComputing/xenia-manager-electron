// Import our modules
const { showLibrary } = await import('./modules/library.js');
const { showSettings, showXeniaSettings, initializeTheme } = await import('./modules/settings.js');
const { showStatusMessage } = await import('./modules/ui-utils.js');

// DOM Elements
const libraryLink = document.getElementById('library');
const settingsLink = document.getElementById('settings');
const xeniaSettingsLink = document.getElementById('xenia-settings');
const contentDiv = document.querySelector('.content');

// Navigation handling
async function updateContent(section) {
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }

    // Update active state in navigation
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(section).classList.add('active');

    try {
        switch (section) {
            case 'library':
                await showLibrary(contentDiv);
                break;
            case 'settings':
                await showSettings(contentDiv);
                break;
            case 'xenia-settings':
                await showXeniaSettings(contentDiv);
                break;
        }
    } catch (error) {
        showStatusMessage(`Error loading ${section}: ${error.message}`, 'error');
    }
}

// Event Listeners
libraryLink.addEventListener('click', (e) => {
    e.preventDefault();
    updateContent('library');
});

settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    updateContent('settings');
});

xeniaSettingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    updateContent('xenia-settings');
});

// Initialize application
async function initializeApp() {
    try {
        // Initialize theme
        await initializeTheme();
        
        // Start with library view
        await updateContent('library');
    } catch (error) {
        showStatusMessage(`Error initializing application: ${error.message}`, 'error');
    }
}

// Start the application
initializeApp();
