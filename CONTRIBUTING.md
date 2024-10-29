# Contributing to Electron Xenia Manager

First off, thank you for considering contributing to Electron Xenia Manager! This is an Electron-based reimplementation of the original [Xenia Manager](https://github.com/xenia-manager/xenia-manager) project.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:

- Be respectful and inclusive
- Exercise consideration and empathy
- Focus on what is best for the community
- Use welcoming and inclusive language

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if possible
* Include your environment details (OS, Xenia version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* A clear and descriptive title
* A detailed description of the proposed feature
* Explain why this enhancement would be useful
* List any similar features in other applications
* Include mockups or examples if applicable

### Pull Requests

* Fork the repo and create your branch from `main`
* If you've added code that should be tested, add tests
* Ensure the test suite passes
* Make sure your code lints
* Update the documentation if needed

## Development Process

1. Fork the repository
2. Create a new branch for your feature/fix
3. Make your changes
4. Write or update tests if needed
5. Run the test suite
6. Push your changes
7. Create a Pull Request

### Setup Development Environment

```bash
# Clone your fork
git clone https://github.com/your-username/electron-xenia-manager.git

# Install dependencies
cd electron-xenia-manager
npm install

# Start development server
npm run dev
```

### Project Structure

```
electron-xenia-manager/
├── main/                 # Main process code
│   ├── game/            # Game-related functionality
│   └── handlers/        # IPC handlers
├── modules/             # Renderer process modules
├── assets/             # Static assets
└── ...
```

## Style Guide

### JavaScript

* Use ES6+ features
* Use meaningful variable and function names
* Add comments for complex logic
* Follow the existing code style

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

## Additional Notes

### Issue and Pull Request Labels

* `bug` - Confirmed bugs or reports likely to be bugs
* `enhancement` - Feature requests
* `documentation` - Documentation improvements
* `good first issue` - Good for newcomers
* `help wanted` - Extra attention is needed

## Recognition

This project is a reimplementation of the original [Xenia Manager](https://github.com/xenia-manager/xenia-manager) project. We aim to maintain compatibility and similar functionality while leveraging Electron for cross-platform support.
