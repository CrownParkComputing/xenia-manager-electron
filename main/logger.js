const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

class Logger {
    constructor() {
        this.logFile = path.join(app.getPath('userData'), 'logs', 'app.log');
        this.logLevel = process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO';
        this.xeniaFilter = [
            'Title name',
            'Title ID',
            'Media ID',
            'Game content'
        ];
        this.ensureLogDirectory();
    }

    async ensureLogDirectory() {
        try {
            await fs.mkdir(path.dirname(this.logFile), { recursive: true });
        } catch (error) {
            console.error('Error creating log directory:', error);
        }
    }

    shouldLog(level) {
        const levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        return levels[level] <= levels[this.logLevel];
    }

    async log(level, message, error = null) {
        if (!this.shouldLog(level)) return;

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}${error ? '\n' + error.stack : ''}`;
        
        // Log to console
        if (level === 'ERROR') {
            console.error(logEntry);
        } else if (level === 'WARN') {
            console.warn(logEntry);
        } else {
            console.log(logEntry);
        }
        
        // Log to file
        try {
            await fs.appendFile(this.logFile, logEntry + '\n');
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    info(message) {
        this.log('INFO', message);
    }

    warn(message) {
        this.log('WARN', message);
    }

    error(message, error = null) {
        this.log('ERROR', message, error);
    }

    debug(message) {
        this.log('DEBUG', message);
    }

    // Special handler for Xenia output
    xeniaOutput(output) {
        // Filter Xenia output to only log important information
        if (this.xeniaFilter.some(filter => output.includes(filter))) {
            this.debug(`Xenia output: ${output.trim()}`);
        }
    }

    // Special handler for Xenia errors
    xeniaError(error) {
        // Filter out common GTK warnings and Wine messages
        if (error.includes('GBM-DRV error') || 
            error.includes('Failed to measure available space') ||
            error.includes('fixme:winediag') ||
            error.includes('fixme:dwmapi')) {
            return; // Ignore these common warnings
        }
        this.warn(`Xenia error: ${error.trim()}`);
    }

    async getLogContent() {
        try {
            return await fs.readFile(this.logFile, 'utf8');
        } catch (error) {
            console.error('Error reading log file:', error);
            return '';
        }
    }

    async clearLogs() {
        try {
            await fs.writeFile(this.logFile, '');
        } catch (error) {
            console.error('Error clearing log file:', error);
        }
    }

    // Log rotation
    async rotateLog() {
        try {
            const stats = await fs.stat(this.logFile);
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (stats.size > maxSize) {
                const backupPath = `${this.logFile}.1`;
                await fs.rename(this.logFile, backupPath);
                await fs.writeFile(this.logFile, '');
                this.info('Log file rotated');
            }
        } catch (error) {
            console.error('Error rotating log file:', error);
        }
    }

    // System information logging
    async logSystemInfo() {
        this.info('System Information:');
        this.info(`OS: ${process.platform} ${process.arch}`);
        this.info(`Node Version: ${process.version}`);
        this.info(`Electron Version: ${process.versions.electron}`);
        this.info(`Chrome Version: ${process.versions.chrome}`);
        this.info(`Working Directory: ${process.cwd()}`);
        this.info(`User Data Path: ${app.getPath('userData')}`);
    }
}

// Export a singleton instance
const logger = new Logger();
module.exports = logger;
