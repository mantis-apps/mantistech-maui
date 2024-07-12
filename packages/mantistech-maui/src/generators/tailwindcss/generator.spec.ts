import { Tree } from '@nx/devkit';
import { TailwindCSSGeneratorSchema } from './schema';
import * as devkit from '@nx/devkit';
import { TextEncoder } from 'util';

// Set up global TextEncoder
beforeAll(async () => {
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
  }
});

// Create a mock tree that implements the Tree interface
const createMockTree = (): jest.Mocked<Tree> => ({
  root: '',
  read: jest.fn().mockImplementation(() => 'mock content'),
  write: jest.fn(),
  exists: jest.fn().mockImplementation(() => true),
  delete: jest.fn(),
  rename: jest.fn(),
  isFile: jest.fn().mockImplementation(() => true),
  children: jest.fn().mockReturnValue([]),
  listChanges: jest.fn().mockReturnValue([]),
  changePermissions: jest.fn(),
});

// Mock the entire @nx/devkit module
jest.mock('@nx/devkit', () => ({
  formatFiles: jest.fn(),
  installPackagesTask: jest.fn(),
  addDependenciesToPackageJson: jest.fn(() => Promise.resolve()),
  getProjects: jest.fn(() => new Map([['test-project', { root: 'apps/test-project' }]])),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('mock file content'),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
}));

// Mock the utility functions
jest.mock('./tailwind.config.utils', () => ({
  mergeConfigs: jest.fn().mockImplementation((existing, newConfig) => newConfig),
}));

jest.mock('./update.root.tags', () => ({
  updateRootTags: jest.fn(),
}));

// Import the generator after mocking
import { tailwindCSSGenerator } from './generator';

describe('tailwindcss generator', () => {
  let mockTree: jest.Mocked<Tree>;
  const options: TailwindCSSGeneratorSchema = {
    project: 'test-project',
    colorMode: 'light',
    uiThemeColor: 'theme-blue',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTree = createMockTree();
  });

  it('should run successfully and update files', async () => {
    await tailwindCSSGenerator(mockTree, options);

    // Check if addDependenciesToPackageJson was called
    expect(devkit.addDependenciesToPackageJson).toHaveBeenCalled();

    // Check if tree.write was called for tailwind.config.js
    expect(mockTree.write).toHaveBeenCalledWith(
      expect.stringContaining('tailwind.config.js'),
      expect.any(String)
    );

    // Check if tree.write was called for styles.css
    expect(mockTree.write).toHaveBeenCalledWith(
      expect.stringContaining('styles.css'),
      expect.any(String)
    );

    // Check if formatFiles was called
    expect(devkit.formatFiles).toHaveBeenCalled();

    // Check if installPackagesTask was called
    expect(devkit.installPackagesTask).toHaveBeenCalled();

    // Log all calls to tree.write for debugging
    console.log('All calls to tree.write:', (mockTree.write as jest.Mock).mock.calls);
  });

  // Add more specific tests for updateTailwindConfig, updateStyles, etc.
});
