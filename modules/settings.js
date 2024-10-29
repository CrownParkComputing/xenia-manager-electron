import { showStatusMessage } from './ui-utils.js';

export async function showSettings(contentDiv) {
    const settings = await window.electronAPI.getSettings();
    const isLinux = await window.electronAPI.getPlatform() === 'linux';
    
    contentDiv.innerHTML = `
        <h2>Application Settings</h2>
        <div class="settings-form">
            <div class="form-group">
                <label for="xenia-path">Xenia Base Directory</label>
                <input type="text" id="xenia-path" value="${settings.xeniaPath || ''}" placeholder="Select folder containing Xenia variants" readonly>
                <button id="browse-xenia">Browse</button>
                <small class="help-text">Select the folder containing your Xenia variants</small>
                <div id="variants-list" class="variants-list">
                    <div class="variant-item">
                        <span class="variant-name">Xenia Canary:</span>
                        <span class="variant-status" data-variant="canary">Not found</span>
                    </div>
                    <div class="variant-item">
                        <span class="variant-name">Xenia Stable:</span>
                        <span class="variant-status" data-variant="stable">Not found</span>
                    </div>
                    <div class="variant-item">
                        <span class="variant-name">Xenia Netplay:</span>
                        <span class="variant-status" data-variant="netplay">Not found</span>
                    </div>
                </div>
            </div>
            ${isLinux ? `
            <div class="form-group">
                <label for="wine-prefix">Wine Prefix Path</label>
                <input type="text" id="wine-prefix" value="${settings.winePrefix || '~/.wine'}" placeholder="Path to Wine prefix">
                <small class="help-text">Required for running Xenia on Linux</small>
            </div>
            ` : ''}
            <div class="form-group">
                <label for="theme">Theme</label>
                <select id="theme">
                    <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                    <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
                </select>
            </div>
            <button id="save-settings">Save Settings</button>
            <div id="status-message"></div>
        </div>
    `;

    // Add styles for variants list
    const style = document.createElement('style');
    style.textContent = `
        .variants-list {
            margin-top: 10px;
            padding: 10px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
        }
        .variant-item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }
        .variant-status {
            color: var(--text-muted);
        }
        .variant-status.found {
            color: var(--success-color);
        }
    `;
    document.head.appendChild(style);

    // Add event listeners
    document.getElementById('browse-xenia').addEventListener('click', selectXeniaPath);
    document.getElementById('save-settings').addEventListener('click', saveSettings);

    // Update variant statuses if path is set
    if (settings.xeniaPath) {
        await updateVariantStatuses();
    }
}

async function updateVariantStatuses() {
    try {
        const variants = await window.electronAPI.getAvailableVariants();
        const statuses = document.querySelectorAll('.variant-status');
        
        statuses.forEach(status => {
            const variant = status.dataset.variant;
            if (variants.map(v => v.toLowerCase()).includes(variant)) {
                status.textContent = 'Found';
                status.classList.add('found');
            } else {
                status.textContent = 'Not found';
                status.classList.remove('found');
            }
        });
    } catch (error) {
        console.error('Error updating variant statuses:', error);
    }
}

async function selectXeniaPath() {
    const result = await window.electronAPI.selectXenia();
    if (result) {
        document.getElementById('xenia-path').value = result;
        await updateVariantStatuses();
    }
}

async function saveSettings() {
    const xeniaPath = document.getElementById('xenia-path').value;
    const theme = document.getElementById('theme').value;
    const winePrefix = document.getElementById('wine-prefix')?.value;
    
    try {
        const settings = { xeniaPath, theme };
        if (winePrefix) {
            settings.winePrefix = winePrefix;
        }
        
        await window.electronAPI.saveSettings(settings);
        showStatusMessage('Settings saved successfully!', 'success');
        
        // Apply theme change immediately
        document.documentElement.setAttribute('data-theme', theme);

        // Update variant statuses
        await updateVariantStatuses();
    } catch (error) {
        showStatusMessage('Error saving settings: ' + error.message, 'error');
    }
}

export async function showXeniaSettings(contentDiv) {
    const xeniaSettings = await window.electronAPI.getXeniaSettings();
    contentDiv.innerHTML = `
        <h2>Xenia Emulator Settings</h2>
        <div class="settings-form">
            <div class="form-group">
                <label>Graphics Backend</label>
                <select id="graphics-backend">
                    <option value="vulkan" ${xeniaSettings.graphicsBackend === 'vulkan' ? 'selected' : ''}>Vulkan</option>
                    <option value="d3d12" ${xeniaSettings.graphicsBackend === 'd3d12' ? 'selected' : ''}>Direct3D 12</option>
                </select>
            </div>
            <div class="form-group">
                <label>Resolution Scale</label>
                <select id="resolution-scale">
                    <option value="1" ${xeniaSettings.resolutionScale === '1' ? 'selected' : ''}>1x (720p)</option>
                    <option value="2" ${xeniaSettings.resolutionScale === '2' ? 'selected' : ''}>2x (1440p)</option>
                    <option value="3" ${xeniaSettings.resolutionScale === '3' ? 'selected' : ''}>3x (2160p)</option>
                </select>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="fullscreen" ${xeniaSettings.fullscreen ? 'checked' : ''}>
                    Launch games in fullscreen
                </label>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="vsync" ${xeniaSettings.vsync ? 'checked' : ''}>
                    Enable VSync
                </label>
            </div>
            <button id="save-xenia-settings">Save Xenia Settings</button>
            <div id="xenia-status-message"></div>
        </div>
    `;

    // Add event listener
    document.getElementById('save-xenia-settings').addEventListener('click', saveXeniaSettings);
}

async function saveXeniaSettings() {
    const settings = {
        graphicsBackend: document.getElementById('graphics-backend').value,
        resolutionScale: document.getElementById('resolution-scale').value,
        fullscreen: document.getElementById('fullscreen').checked,
        vsync: document.getElementById('vsync').checked
    };
    
    try {
        await window.electronAPI.saveXeniaSettings(settings);
        showStatusMessage('Xenia settings saved successfully!', 'success');
    } catch (error) {
        showStatusMessage('Error saving Xenia settings: ' + error.message, 'error');
    }
}

// Initialize theme from settings
export async function initializeTheme() {
    const settings = await window.electronAPI.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
}

// Export functions that might be needed by other modules
export {
    selectXeniaPath,
    saveSettings,
    saveXeniaSettings
};
