# Git Hooks with Husky

This directory contains Git hooks managed by Husky.

## Pre-commit Hook

The `pre-commit` hook automatically runs before each commit to ensure code quality:

1. **ESLint**: Checks and fixes linting issues in TypeScript/JavaScript files
2. **Prettier**: Formats code consistently

## Configuration

- Hook configuration: `.husky/pre-commit`
- Lint-staged configuration: `package.json` > `lint-staged`
- ESLint configuration: `eslint.config.js`
- Prettier configuration: `.prettierrc`

## Usage

The hooks run automatically when you commit. If there are linting errors that can't be auto-fixed, the commit will be blocked until you fix them manually.

To bypass hooks (not recommended):

```bash
git commit --no-verify -m "commit message"
```

## Files Processed

- `*.{ts,js}`: ESLint + Prettier
- `*.{json,md}`: Prettier only
