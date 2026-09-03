// Metro (RN's bundler) needs explicit config to work in a monorepo: by
// default it only watches this app's folder and only resolves
// node_modules inside it. Here we point it at the workspace root so it
// can see packages/core (a workspace package, not something installed
// into node_modules) and the hoisted node_modules at the repo root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so changes in packages/core are picked up.
config.watchFolders = [workspaceRoot];

// Resolve modules from this app's node_modules first, then the hoisted
// workspace-root node_modules (how npm/yarn/pnpm workspaces install).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
