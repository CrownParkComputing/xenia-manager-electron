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

        // Buttons
        this.closeBtn = document.getElementById('closeBtn');
        this.changeLocationBtn = document.getElementById('changeLocation');
        this.variantButtons = {
            stable: document.getElementById('switchStable'),
            canary: document.getElementById('switchCanary'),
            netplay: document.getElementById('switchNetplay')
        };
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

        // Variant switching
        Object.entries(this.variantButtons).forEach(([variant, button]) => {
            button.addEventListener('click', () => {
                this.switchVariant(variant);
            });
        });

        // Boxart and icon click handlers
        this.gameBoxart.addEventListener('click', () => {
            ipcRenderer.send('change-game-boxart', this.currentGame.gameId);
        });

        this.gameIcon.addEventListener('click', () => {
            ipcRenderer.send('change-game-icon', this.currentGame.gameId);
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
            this.updateVariantButtons(availableVariants);
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

        // Update variant buttons
        this.updateVariantButtons();
        this.highlightCurrentVariant(game.variant);
    }

    updateVariantButtons(availableVariants = null) {
        if (availableVariants) {
            // Show/hide buttons based on available variants
            Object.entries(this.variantButtons).forEach(([variant, button]) => {
                button.style.display = availableVariants.includes(variant) ? 'block' : 'none';
            });
        }

        // Disable the button for current variant
        if (this.currentGame) {
            Object.entries(this.variantButtons).forEach(([variant, button]) => {
                button.disabled = variant === this.currentGame.variant;
            });
        }
    }

    highlightCurrentVariant(variant) {
        Object.entries(this.variantButtons).forEach(([key, button]) => {
            button.classList.toggle('active', key === variant);
        });
    }

    async switchVariant(newVariant) {
        if (!this.currentGame) return;

        try {
            await ipcRenderer.invoke('switch-game-variant', {
                gameId: this.currentGame.gameId,
                newVariant: newVariant
            });

            this.currentGame.variant = newVariant;
            this.highlightCurrentVariant(newVariant);
            this.updateVariantButtons();
            this.markUnsavedChanges();
        } catch (error) {
            console.error('Error switching variant:', error);
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
