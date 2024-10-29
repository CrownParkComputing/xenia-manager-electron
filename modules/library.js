import { showStatusMessage, createContextMenu } from './ui-utils.js';
import { launchGame, showGameContextMenu } from './game-operations.js';

// Game Library State
let games = [];

export async function showLibrary(contentDiv) {
    const settings = await window.electronAPI.getSettings();
    games = await window.electronAPI.getGames();

    contentDiv.innerHTML = `
        <div class="library-header">
            <h2>Game Library</h2>
            <button id="add-game" class="primary-button">Add Game</button>
        </div>
        <div class="games-grid" id="games-grid">
            ${games.length === 0 ? 
                '<p class="no-games">No games added. Click "Add Game" to get started.</p>' : 
                ''}
        </div>
    `;

    // Add event listener for the Add Game button
    document.getElementById('add-game').addEventListener('click', addGame);

    // If there are games, display them
    if (games.length > 0) {
        await loadGamesIntoUI();
    }
}

async function addGame() {
    const settings = await window.electronAPI.getSettings();
    if (!settings.xeniaPath) {
        showStatusMessage('Please configure Xenia path in settings first', 'error');
        return;
    }

    const filePaths = await window.electronAPI.selectGame();
    if (!filePaths) return;

    for (const filePath of filePaths) {
        try {
            const game = await window.electronAPI.addGame(filePath);
            games.push(game);
            await loadGamesIntoUI();
            showStatusMessage(`Added ${game.title} successfully`, 'success');
        } catch (error) {
            showStatusMessage(`Error adding game: ${error.message}`, 'error');
        }
    }
}

async function loadGamesIntoUI() {
    const gamesGrid = document.getElementById('games-grid');
    if (!gamesGrid) return;
    
    gamesGrid.innerHTML = '';

    // Sort games by title
    games.sort((a, b) => a.title.localeCompare(b.title));

    for (const game of games) {
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
