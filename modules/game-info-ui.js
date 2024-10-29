// Get access to electron IPC
const { ipcRenderer } = require('electron');

class GameInfoUI {
    constructor() {
        this.currentGame = null;
        this.initializeElements();
        this.setupEventListeners();
        this.setupIPCListeners();
    }

    initializeElements() {
        // Game info elements
        this.gameIdInput = document.getElementById('gameId');
        this.mediaIdInput = document.getElementById('mediaId');
        this.gameTitleInput = document.getElementById('gameTitle');
        this.gameBoxart = document.getElementById('gameBoxart');
        this.gameIcon = document.getElementById('gameIcon');
        this.boxartUrlInput = document.getElementById('boxartUrl');
        this.iconUrlInput = document.getElementById('iconUrl');
        this.xeniaVariantSelect = document.getElementById('xeniaVariant');

        // Buttons
        this.closeBtn = document.getElementById('closeBtn');
        this.changeLocationBtn = document.getElementById('changeLocation');
    }

    setupEventListeners() {
        // Close button
        this.closeBtn.addEventListener('click', () => {
            this.saveChanges();
            ipcRenderer.send('close-game-info');
        });

        // Game title changes
        this.gameTitleInput.addEventListener('change', () => {
            if (this.currentGame) {
                this.currentGame.title = this.gameTitleInput.value;
                this.markUnsavedChanges();
            }
        });

        // Change game location
        this.changeLocationBtn.addEventListener('click', () => {
            ipcRenderer.send('change-game-location', this.currentGame.gameId);
        });

        // Variant selection changes
        this.xeniaVariantSelect.addEventListener('change', () => {
            this.switchVariant(this.xeniaVariantSelect.value);
        });

        // Boxart and icon click handlers
        this.gameBoxart.addEventListener('click', () => {
            ipcRenderer.send('change-game-boxart', this.currentGame.gameId);
        });

        this.gameIcon.addEventListener('click', () => {
            ipcRenderer.send('change-game-icon', this.currentGame.gameId);
        });

        // URL selection handlers
        this.boxartUrlInput.addEventListener('click', () => {
            this.boxartUrlInput.select();
        });

        this.iconUrlInput.addEventListener('click', () => {
            this.iconUrlInput.select();
        });
    }

    setupIPCListeners() {
        // Load game data
        ipcRenderer.on('load-game-info', (event, game) => {
            this.loadGameInfo(game);
        });

        // Handle game location change
        ipcRenderer.on('game-location-changed', (event, newPath) => {
            if (this.currentGame) {
                this.currentGame.path = newPath;
                this.markUnsavedChanges();
            }
        });

        // Handle boxart/icon updates
        ipcRenderer.on('boxart-changed', (event, newPath) => {
            this.gameBoxart.src = newPath;
            if (this.currentGame) {
                this.currentGame.coverPath = newPath;
                this.markUnsavedChanges();
            }
        });

        ipcRenderer.on('icon-changed', (event, newPath) => {
            this.gameIcon.src = newPath;
            if (this.currentGame) {
                this.currentGame.iconPath = newPath;
                this.markUnsavedChanges();
            }
        });

        // Handle variant availability updates
        ipcRenderer.on('update-variants', (event, availableVariants) => {
            this.updateVariantOptions(availableVariants);
        });
    }

    loadGameInfo(game) {
        this.currentGame = game;
        
        // Update UI elements
        this.gameIdInput.value = game.gameId || '';
        this.mediaIdInput.value = game.mediaId || '';
        this.gameTitleInput.value = game.title || '';
        
        // Update images
        if (game.coverPath) {
            this.gameBoxart.src = game.coverPath;
        }
        if (game.iconPath) {
            this.gameIcon.src = game.iconPath;
        }

        // Update artwork URLs
        if (game.gameId) {
            this.boxartUrlInput.value = `http://download.xbox.com/content/images/66acd000-77fe-1000-9115-d802${game.gameId}/1033/boxartlg.jpg`;
        }
        if (game.mediaId) {
            this.iconUrlInput.value = `http://download.xbox.com/content/images/${game.mediaId}/icon.png`;
        }

        // Update variant selection
        if (game.variant) {
            this.xeniaVariantSelect.value = game.variant;
        }
    }

    updateVariantOptions(availableVariants = null) {
        if (availableVariants) {
            // Show/hide options based on available variants
            Array.from(this.xeniaVariantSelect.options).forEach(option => {
                option.disabled = !availableVariants.includes(option.value);
            });
        }
    }

    async switchVariant(newVariant) {
        if (!this.currentGame) return;

        try {
            await ipcRenderer.invoke('switch-game-variant', {
                gameId: this.currentGame.gameId,
                newVariant: newVariant
            });

            this.currentGame.variant = newVariant;
            this.markUnsavedChanges();
        } catch (error) {
            console.error('Error switching variant:', error);
            // Reset select to current variant
            this.xeniaVariantSelect.value = this.currentGame.variant;
            // TODO: Show error to user
        }
    }

    markUnsavedChanges() {
        // Notify main process of changes
        ipcRenderer.send('game-info-changed', this.currentGame);
    }

    saveChanges() {
        if (this.currentGame) {
            ipcRenderer.send('save-game-info', this.currentGame);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.gameInfoUI = new GameInfoUI();
});
