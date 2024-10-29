const { contextBridge, ipcRenderer } = require('electron');

// Create a secure bridge between main and renderer processes
contextBridge.exposeInMainWorld('electronAPI', {
    // Game Management
    addGame: (filePath) => ipcRenderer.invoke('add-game', filePath),
    removeGame: (gameId) => ipcRenderer.invoke('remove-game', gameId),
    getGames: () => ipcRenderer.invoke('get-games'),
    launchGame: (gameId, windowedMode) => ipcRenderer.invoke('launch-game', gameId, windowedMode),
    checkCompatibility: (gameId) => ipcRenderer.invoke('check-compatibility', gameId),
    updateGameCover: (gameId, coverPath) => ipcRenderer.invoke('update-game-cover', gameId, coverPath),
    installPatch: (gameId, patchPath) => ipcRenderer.invoke('install-patch', gameId, patchPath),
    
    // Game Info Management
    showGameInfo: (gameId) => ipcRenderer.invoke('show-game-info', gameId),
    updateGameInfo: (gameId, updates) => ipcRenderer.invoke('game-info-changed', gameId, updates),
    switchGameVariant: (gameId, newVariant) => ipcRenderer.invoke('switch-game-variant', { gameId, newVariant }),
    changeGameLocation: (gameId, newPath) => ipcRenderer.invoke('change-game-location', gameId, newPath),
    
    // Settings Management
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    getXeniaSettings: () => ipcRenderer.invoke('get-xenia-settings'),
    saveXeniaSettings: (settings) => ipcRenderer.invoke('save-xenia-settings', settings),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAvailableVariants: () => ipcRenderer.invoke('get-available-variants'),
    
    // File Selection
    selectGame: () => ipcRenderer.invoke('select-game'),
    selectXenia: () => ipcRenderer.invoke('select-xenia'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    selectImage: () => ipcRenderer.invoke('select-image'),
    
    // Window Management
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    getWindowState: () => ipcRenderer.invoke('get-window-state'),

    // IPC Event Listeners
    onGameInfoChanged: (callback) => {
        ipcRenderer.on('game-info-changed', (event, game) => callback(game));
    },
    onGameLocationChanged: (callback) => {
        ipcRenderer.on('game-location-changed', (event, newPath) => callback(newPath));
    },
    onBoxartChanged: (callback) => {
        ipcRenderer.on('boxart-changed', (event, newPath) => callback(newPath));
    },
    onIconChanged: (callback) => {
        ipcRenderer.on('icon-changed', (event, newPath) => callback(newPath));
    },
    onUpdateVariants: (callback) => {
        ipcRenderer.on('update-variants', (event, variants) => callback(variants));
    }
});

// Error handling
window.addEventListener('error', (event) => {
    ipcRenderer.invoke('handle-error', {
        message: event.error.message,
        stack: event.error.stack
    });
});

window.addEventListener('unhandledrejection', (event) => {
    ipcRenderer.invoke('handle-error', {
        message: event.reason.message,
        stack: event.reason.stack
    });
});
