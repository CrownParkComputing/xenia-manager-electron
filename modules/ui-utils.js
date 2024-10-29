// Status message handling
export function showStatusMessage(message, type) {
    const existingStatus = document.getElementById('status-message');
    if (existingStatus) {
        existingStatus.remove();
    }

    const statusDiv = document.createElement('div');
    statusDiv.id = 'status-message';
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;

    document.body.appendChild(statusDiv);

    setTimeout(() => {
        statusDiv.classList.add('fade-out');
        setTimeout(() => statusDiv.remove(), 300);
    }, 3000);
}

// Modal dialog creation
export function createModal(title, content, buttons = []) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const titleElement = document.createElement('h2');
    titleElement.textContent = title;
    modalContent.appendChild(titleElement);
    
    const contentElement = document.createElement('div');
    contentElement.className = 'modal-body';
    if (typeof content === 'string') {
        contentElement.innerHTML = content;
    } else {
        contentElement.appendChild(content);
    }
    modalContent.appendChild(contentElement);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'modal-buttons';
    
    buttons.forEach(button => {
        const buttonElement = document.createElement('button');
        buttonElement.textContent = button.text;
        buttonElement.className = button.class || '';
        buttonElement.onclick = () => {
            if (button.onClick) {
                button.onClick();
            }
            modal.remove();
        };
        buttonContainer.appendChild(buttonElement);
    });
    
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    
    return modal;
}

// Loading indicator
export function showLoading(message = 'Loading...') {
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
    `;
    document.body.appendChild(loading);
    return loading;
}

export function hideLoading(loadingElement) {
    if (loadingElement && loadingElement.parentNode) {
        loadingElement.remove();
    }
}

// Confirmation dialog
export function showConfirmation(message, onConfirm, onCancel) {
    const modal = createModal('Confirmation', message, [
        {
            text: 'Cancel',
            class: 'secondary-button',
            onClick: onCancel
        },
        {
            text: 'Confirm',
            class: 'primary-button',
            onClick: onConfirm
        }
    ]);
    
    document.body.appendChild(modal);
}

// Error dialog
export function showError(title, message) {
    const modal = createModal(title, message, [
        {
            text: 'OK',
            class: 'primary-button',
            onClick: () => {}
        }
    ]);
    
    document.body.appendChild(modal);
}

// Context menu creation
export function createContextMenu(items, x, y) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        if (item.class) {
            menuItem.classList.add(item.class);
        }
        menuItem.textContent = item.text;
        menuItem.onclick = (e) => {
            e.stopPropagation();
            menu.remove();
            item.onClick();
        };
        menu.appendChild(menuItem);
    });

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

    return menu;
}

// Form validation
export function validateForm(formData, rules) {
    const errors = {};
    
    for (const [field, value] of Object.entries(formData)) {
        if (rules[field]) {
            const fieldRules = rules[field];
            
            if (fieldRules.required && !value) {
                errors[field] = `${field} is required`;
            }
            
            if (fieldRules.minLength && value.length < fieldRules.minLength) {
                errors[field] = `${field} must be at least ${fieldRules.minLength} characters`;
            }
            
            if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
                errors[field] = `${field} format is invalid`;
            }
            
            if (fieldRules.custom && !fieldRules.custom(value)) {
                errors[field] = fieldRules.message || `${field} is invalid`;
            }
        }
    }
    
    return Object.keys(errors).length === 0 ? null : errors;
}
