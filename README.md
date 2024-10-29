# Electron Xenia Manager

A cross-platform Xenia emulator manager built with Electron. This is an Electron-based reimplementation of the original [Xenia Manager](https://github.com/xenia-manager/xenia-manager) project.

## Features

- Manage multiple Xenia variants (Stable, Canary, Netplay)
- Automatic game information extraction
- Game compatibility tracking
- Game artwork downloading
- Cross-platform support (Linux, Windows)
- Clean and modern user interface

## Installation

### Linux

Three package formats are available in the [releases](../../releases) section:

- **AppImage**: Portable executable that works on most Linux distributions
  ```bash
  chmod +x "Xenia Manager-1.0.0.AppImage"
  ./"Xenia Manager-1.0.0.AppImage"
  ```

- **DEB Package**: For Debian/Ubuntu based systems
  ```bash
  sudo dpkg -i "Xenia Manager-1.0.0.deb"
  ```

- **RPM Package**: For Fedora/RHEL based systems
  ```bash
  sudo rpm -i "Xenia Manager-1.0.0.rpm"
  ```

### Windows

Windows builds will be available in future releases.

## Development

### Prerequisites

- Node.js (LTS version recommended)
- npm (comes with Node.js)
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/electron-xenia-manager.git
   cd electron-xenia-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Building

To create distribution packages:

For Linux:
```bash
npm run build:linux
```

For Windows:
```bash
npm run build:win
```

## Credits

This project is an Electron-based reimplementation of the original [Xenia Manager](https://github.com/xenia-manager/xenia-manager) project. We extend our gratitude to the original project's developers for their work and inspiration.

### Related Projects

- [Xenia](https://github.com/xenia-project/xenia) - Xbox 360 Research Emulator
- [Original Xenia Manager](https://github.com/xenia-manager/xenia-manager)

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
