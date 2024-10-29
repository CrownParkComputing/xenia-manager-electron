import { showStatusMessage, createContextMenu } from './ui-utils.js';
import { launchGame, showGameContextMenu } from './game-operations.js';

// Game Library State
let games = [];
let activeTab = 'retail'; // 'retail' or 'xbla'

export async function showLibrary(contentDiv) {
    const settings = await window.electronAPI.getSettings();
    games = await window.electronAPI.getGames();

    contentDiv.innerHTML = `
        <div class="library-header">
            <h2>Game Library</h2>
            <div class="library-tabs">
                <button id="retail-tab" class="tab-button active">Retail Games</button>
                <button id="xbla-tab" class="tab-button">Xbox Live Games</button>
            </div>
            <button id="add-game" class="primary-button">Add Game</button>
        </div>
        <div class="games-grid" id="games-grid">
            ${games.length === 0 ? 
                '<p class="no-games">No games added. Click "Add Game" to get started.</p>' : 
                ''}
        </div>
    `;

    // Add event listeners for tabs
    document.getElementById('retail-tab').addEventListener('click', () => switchTab('retail'));
    document.getElementById('xbla-tab').addEventListener('click', () => switchTab('xbla'));

    // Add event listener for the Add Game button
    document.getElementById('add-game').addEventListener('click', addGame);

    // If there are games, display them
    if (games.length > 0) {
        await loadGamesIntoUI();
    }
}

function switchTab(tab) {
    activeTab = tab;
    
    // Update tab button styles
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.getElementById(`${tab}-tab`).classList.add('active');

    // Update add game button text
    const addGameBtn = document.getElementById('add-game');
    addGameBtn.textContent = activeTab === 'retail' ? 'Add Game' : 'Add XBLA Game';

    // Reload games for the selected tab
    loadGamesIntoUI();
}

async function addGame() {
    const settings = await window.electronAPI.getSettings();
    if (!settings.xeniaPath) {
        showStatusMessage('Please configure Xenia path in settings first', 'error');
        return;
    }

    try {
        let filePaths;
        if (activeTab === 'retail') {
            // For retail games, select files with specific extensions
            filePaths = await window.electronAPI.selectGame({
                type: 'retail'
            });
        } else {
            // For XBLA games, select a folder
            filePaths = await window.electronAPI.selectGame({
                type: 'xbla'
            });
        }

        if (!filePaths) return;

        // Convert to array if single folder selected for XBLA
        const paths = Array.isArray(filePaths) ? filePaths : [filePaths];

        for (const filePath of paths) {
            try {
                const game = await window.electronAPI.addGame(filePath, { type: activeTab });
                games.push(game);
                await loadGamesIntoUI();
                showStatusMessage(`Added ${game.title} successfully`, 'success');
            } catch (error) {
                showStatusMessage(`Error adding game: ${error.message}`, 'error');
            }
        }
    } catch (error) {
        showStatusMessage(`Error selecting game: ${error.message}`, 'error');
    }
}

async function loadGamesIntoUI() {
    const gamesGrid = document.getElementById('games-grid');
    if (!gamesGrid) return;
    
    gamesGrid.innerHTML = '';

    // Filter games based on active tab
    const filteredGames = games.filter(game => 
        activeTab === 'retail' ? game.type !== 'XBLA' : game.type === 'XBLA'
    );

    // Sort games by title
    filteredGames.sort((a, b) => a.title.localeCompare(b.title));

    if (filteredGames.length === 0) {
        gamesGrid.innerHTML = `<p class="no-games">No ${activeTab === 'retail' ? 'retail' : 'Xbox Live'} games added.</p>`;
        return;
    }

    for (const game of filteredGames) {
        const gameElement = createGameElement(game);
        gamesGrid.appendChild(gameElement);
        
        // Check compatibility if unknown
        if (game.compatibilityRating === 'Unknown') {
            const rating = await window.electronAPI.checkCompatibility(game.gameId);
            if (rating !== game.compatibilityRating) {
                game.compatibilityRating = rating;
                updateGameCompatibilityUI(gameElement, rating);
            }
        }
    }
}

function createGameElement(game) {
    const gameDiv = document.createElement('div');
    gameDiv.className = 'game-item';
    gameDiv.innerHTML = `
        <div class="game-cover">
            <img src="${game.coverPath || 'assets/default-cover.png'}" alt="${game.title}">
            <div class="compatibility-badge ${game.compatibilityRating.toLowerCase()}">
                ${game.compatibilityRating}
            </div>
        </div>
        <div class="game-info">
            <h3>${game.title}</h3>
            <p class="playtime">${formatPlaytime(game.playtime)}</p>
        </div>
        <div class="game-actions">
            <button class="launch-button">Launch</button>
            <button class="context-menu-button">⋮</button>
        </div>
    `;

    // Add event listeners
    const launchButton = gameDiv.querySelector('.launch-button');
    launchButton.addEventListener('click', () => launchGame(game.gameId));

    const contextButton = gameDiv.querySelector('.context-menu-button');
    contextButton.addEventListener('click', (e) => showGameContextMenu(e, game));

    return gameDiv;
}

function formatPlaytime(minutes) {
    if (!minutes) return 'Never played';
    if (minutes < 60) return `${Math.floor(minutes)} minutes`;
    return `${(minutes / 60).toFixed(1)} hours`;
}

function updateGameCompatibilityUI(gameElement, rating) {
    const badge = gameElement.querySelector('.compatibility-badge');
    if (badge) {
        badge.className = `compatibility-badge ${rating.toLowerCase()}`;
        badge.textContent = rating;
    }
}

export async function removeGame(gameId) {
    try {
        await window.electronAPI.removeGame(gameId);
        games = games.filter(g => g.gameId !== gameId);
        await loadGamesIntoUI();
        showStatusMessage('Game removed successfully', 'success');
    } catch (error) {
        showStatusMessage(`Error removing game: ${error.message}`, 'error');
    }
}

export {
    games,
    loadGamesIntoUI,
    addGame,
    updateGameCompatibilityUI
};
