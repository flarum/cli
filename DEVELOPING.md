# Developing Flarum CLI

This guide covers how to set up and work with the Flarum CLI codebase locally.

## Prerequisites

- Node.js >= 18.0.0
- Yarn package manager

## Initial Setup

1. **Clone the repository** (if you haven't already)

2. **Install dependencies:**
   ```bash
   yarn install
   ```

3. **Build the TypeScript source:**
   ```bash
   yarn prepack
   ```

   This command:
   - Compiles TypeScript from `src/` to `lib/`
   - Generates the oclif manifest
   - Updates the README with command documentation

## Running Locally

You have several options for running the CLI during development:

### Option 1: Direct execution via bin/run
```bash
./bin/run [command]
```

Example:
```bash
./bin/run --help
./bin/run init
./bin/run make model
```

### Option 2: Create a development alias (recommended)
Add an alias to your shell configuration file without affecting existing installations:

**For zsh** (add to `~/.zshrc`):
```bash
alias fl-dev='/path/to/cli/bin/run'
```

**For bash** (add to `~/.bashrc` or `~/.bash_profile`):
```bash
alias fl-dev='/path/to/cli/bin/run'
```

After adding the alias, reload your shell:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

Then use:
```bash
fl-dev [command]
```

This allows you to keep your existing `fl1`, `fl2`, etc. aliases intact while having a dedicated `fl-dev` for local development.

### Option 3: Link globally for development
```bash
yarn link
```

After linking, you can use any of these commands:
- `flarum-cli [command]`
- `fl [command]`
- `fl2 [command]`

**Warning:** This will override any globally installed version of `@flarum/cli`.

## Development Workflow

### Making Changes

1. **Edit TypeScript source files** in `src/`
2. **Rebuild the project:**
   ```bash
   yarn prepack
   ```
3. **Test your changes:**
   ```bash
   ./bin/run [command]
   ```

### Testing

Run the test suite:
```bash
yarn test
```

This will:
- Run Jest tests
- Check code formatting with Prettier
- Lint code with ESLint
- Perform a TypeScript dry-run build

### Code Formatting

Format code automatically:
```bash
yarn format
```

This runs ESLint with auto-fix and Prettier.

## Project Structure

```
.
├── bin/                    # Executable entry points
│   └── run                 # Main CLI entry point
├── src/                    # TypeScript source code
│   ├── commands/           # CLI command definitions
│   ├── steps/              # Reusable step implementations
│   ├── boilersmith/        # Scaffolding system
│   └── base-command.ts     # Base command class
├── lib/                    # Compiled JavaScript (gitignored)
├── test/                   # Test files
├── boilerplate/            # Scaffolding templates
├── stubs/                  # Code generation templates
├── php-subsystem/          # PHP parser for extend.php
└── package.json
```

## Architecture Overview

### Technology Stack

- **oclif**: CLI framework
- **TypeScript**: Primary language
- **PHP subsystem**: Uses `nikic/php-parser` for PHP code manipulation
- **mem-fs**: In-memory filesystem for atomic operations

### Key Concepts

**Commands** (in `src/commands/`)
- User-facing CLI commands
- Built on oclif framework
- Orchestrate step execution

**Steps** (in `src/steps/`)
- Granular, reusable operations
- Modify in-memory filesystem
- Can be composed atomically
- Support parameter sharing between steps

**Step Manager**
- Fluent API for chaining steps
- Handles optional steps
- Manages parameter passing between steps
- Supports atomic groups for transactional changes

**Scaffolding System** (`src/boilersmith/`)
- Manages extension infrastructure modules
- Supports initialization and updates
- Module-based file and config ownership

## Debugging

### Running with Node Inspector
```bash
node --inspect ./bin/run [command]
```

### Verbose Output
Most commands support flags for additional output. Check command help:
```bash
./bin/run [command] --help
```

## Common Tasks

### Adding a New Command

1. Create command file in `src/commands/`
2. Extend from `BaseCommand` class
3. Define steps using Step Manager
4. Rebuild with `yarn prepack`
5. Test with `./bin/run [your-command]`

### Adding a New Step

1. Create step class in appropriate `src/steps/` subdirectory
2. Implement required methods (`run`, `getExposedParams`, etc.)
3. Add unit tests
4. Use step in command's `steps()` method

### Updating Boilerplate Templates

1. Edit files in `boilerplate/skeleton/extension/`
2. Update module definitions in scaffolding system
3. Test with `./bin/run init` or `./bin/run infra`

## Troubleshooting

### "Command not found" after changes
- Ensure you've run `yarn prepack` to rebuild
- Check that `lib/` directory exists and contains compiled code

### TypeScript errors
- Run `yarn posttest` to see type checking output
- Ensure `tsconfig.json` includes your new files

### Tests failing
- Run `yarn test` to see full output
- Check that step unit tests match your changes

## Contributing

When making changes:

1. Follow existing code patterns
2. Add unit tests for new steps and functionality
3. Update documentation as needed
4. Run `yarn format` before committing
5. Ensure `yarn test` passes

## Additional Resources

- [oclif Documentation](https://oclif.io/)
- [README.md](README.md) - User-facing documentation
- Main README "For Maintainers" section - Architecture deep-dive
