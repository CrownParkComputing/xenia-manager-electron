import { showStatusMessage, createModal, showConfirmation } from './ui-utils.js';
import { removeGame, loadGamesIntoUI } from './library.js';

export async function launchGame(gameId, windowedMode = false) {
    try {
        await window.electronAPI.launchGame(gameId, windowedMode);
        showStatusMessage('Game launched successfully', 'success');
    } catch (error) {
        showStatusMessage(`Error launching game: ${error.message}`, 'error');
    }
}

export function showGameContextMenu(event, game) {
    event.preventDefault();

    // Remove any existing context menus
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="menu-item" data-action="launch-windowed">Launch in Windowed Mode</div>
        <div class="menu-item" data-action="manage-patches">Manage Patches</div>
        <div class="menu-item" data-action="install-content">Install Content</div>
        <div class="menu-item" data-action="create-shortcut">Create Desktop Shortcut</div>
        <div class="menu-item" data-action="edit">Game Info</div>
        <div class="menu-item delete" data-action="remove">Remove from Library</div>
    `;

    // Position the menu
    menu.style.position = 'absolute';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;

    // Add event listeners
    menu.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        if (!action) return;

        menu.remove();

        switch (action) {
            case 'launch-windowed':
                await launchGame(game.gameId, true);
                break;
            case 'manage-patches':
                showPatchManager(game);
                break;
            case 'install-content':
                showContentInstaller(game);
                break;
            case 'create-shortcut':
                await createShortcut(game);
                break;
            case 'edit':
                await showGameInfo(game);
                break;
            case 'remove':
                showConfirmation(
                    `Are you sure you want to remove ${game.title}?`,
                    () => removeGame(game.gameId),
                    () => {}
                );
                break;
        }
    });

    // Add the menu to the document
    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 0);
}

async function showGameInfo(game) {
    try {
        await window.electronAPI.showGameInfo(game.gameId);
    } catch (error) {
        showStatusMessage(`Error showing game info: ${error.message}`, 'error');
    }
}

async function createShortcut(game) {
    try {
        await window.electronAPI.createShortcut(game.gameId);
        showStatusMessage('Desktop shortcut created', 'success');
    } catch (error) {
        showStatusMessage(`Error creating shortcut: ${error.message}`, 'error');
    }
}

function showPatchManager(game) {
    const dialog = createModal('Manage Patches', `
        <div class="patches-list">
            ${game.patches ? game.patches.map(patch => `
                <div class="patch-item">
                    <label>
                        <input type="checkbox" ${patch.enabled ? 'checked' : ''} 
                               data-patch-path="${patch.path}">
                        ${patch.path.split('/').pop()}
                    </label>
                    <button class="remove-patch" data-patch-path="${patch.path}">Remove</button>
                </div>
            `).join('') : 'No patches installed'}
        </div>
    `, [
        {
            text: 'Add New Patch',
            class: 'secondary-button',
            onClick: () => addNewPatch(game)
        },
        {
            text: 'Close',
            class: 'primary-button',
            onClick: () => {}
        }
    ]);

    // Add listeners for patch toggles and removal
    dialog.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => togglePatch(game.gameId, checkbox.dataset.patchPath));
    });

    dialog.querySelectorAll('.remove-patch').forEach(button => {
        button.addEventListener('click', () => removePatch(game.gameId, button.dataset.patchPath));
    });

    document.body.appendChild(dialog);
}

async function addNewPatch(game) {
    const patchPath = await window.electronAPI.selectPatch();
    if (patchPath) {
        try {
            await window.electronAPI.installPatch(game.gameId, patchPath);
            showStatusMessage('Patch installed successfully', 'success');
            showPatchManager(game); // Refresh the patch manager
        } catch (error) {
            showStatusMessage(`Error installing patch: ${error.message}`, 'error');
        }
    }
}

async function togglePatch(gameId, patchPath) {
    try {
        await window.electronAPI.togglePatch(gameId, patchPath);
        showStatusMessage('Patch settings updated', 'success');
    } catch (error) {
        showStatusMessage(`Error updating patch: ${error.message}`, 'error');
    }
}

async function removePatch(gameId, patchPath) {
    showConfirmation(
        'Are you sure you want to remove this patch?',
        async () => {
            try {
                await window.electronAPI.removePatch(gameId, patchPath);
                showStatusMessage('Patch removed successfully', 'success');
                showPatchManager(game); // Refresh the patch manager
            } catch (error) {
                showStatusMessage(`Error removing patch: ${error.message}`, 'error');
            }
        },
        () => {}
    );
}

function showContentInstaller(game) {
    const dialog = createModal('Install Content', `
        <div class="content-installer">
            <p>Select content files to install:</p>
            <div class="content-list"></div>
        </div>
    `, [
        {
            text: 'Select Files',
            class: 'secondary-button',
            onClick: () => selectContent(game)
        },
        {
            text: 'Close',
            class: 'primary-button',
            onClick: () => {}
        }
    ]);

    document.body.appendChild(dialog);
}

async function selectContent(game) {
    const contentPaths = await window.electronAPI.selectContent();
    if (contentPaths) {
        try {
            for (const path of contentPaths) {
                await window.electronAPI.installContent(game.gameId, path);
            }
            showStatusMessage('Content installed successfully', 'success');
        } catch (error) {
            showStatusMessage(`Error installing content: ${error.message}`, 'error');
        }
    }
}
