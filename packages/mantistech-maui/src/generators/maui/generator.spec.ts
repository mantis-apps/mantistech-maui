import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration, getProjects } from '@nx/devkit';
import * as devkit from '@nx/devkit';

import { mauiGenerator } from './generator';
import { MauiGeneratorSchema } from './schema';

// Mock the entire @nx/devkit module
jest.mock('@nx/devkit', () => {
  const actual = jest.requireActual('@nx/devkit');
  return {
    ...actual,
    readProjectConfiguration: jest.fn(),
    addProjectConfiguration: jest.fn(),
    generateFiles: jest.fn(),
    formatFiles: jest.fn(),
    getWorkspaceLayout: jest.fn().mockReturnValue({ libsDir: 'libs' }),
    getProjects: jest.fn().mockReturnValue(new Map()),
  };
});

describe('maui generator', () => {
  let tree: Tree;
  const options: MauiGeneratorSchema = { project: 'test' };

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();

    // Mock tree methods
    tree.exists = jest.fn().mockReturnValue(true);
    tree.read = jest.fn().mockReturnValue(Buffer.from(''));
    tree.write = jest.fn();

    // Ensure getProjects returns a Map
    (devkit.getProjects as jest.Mock).mockReturnValue(new Map());

    // Mock readProjectConfiguration
    (devkit.readProjectConfiguration as jest.Mock).mockReturnValue({
      root: 'apps/test',
      sourceRoot: 'apps/test/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/test',
            index: 'apps/test/src/index.html',
            main: 'apps/test/src/main.ts',
            polyfills: 'apps/test/src/polyfills.ts',
            tsConfig: 'apps/test/tsconfig.app.json',
            assets: ['apps/test/src/favicon.ico', 'apps/test/src/assets'],
            styles: ['apps/test/src/styles.css'],
            scripts: []
          }
        }
      }
    });
  });

  it('should run successfully', async () => {
    await mauiGenerator(tree, options);
    expect(devkit.addProjectConfiguration).toHaveBeenCalledWith(
      tree,
      'maui',
      expect.objectContaining({
        root: 'maui',
        projectType: 'library',
        sourceRoot: 'maui/src',
      })
    );
  });
});
