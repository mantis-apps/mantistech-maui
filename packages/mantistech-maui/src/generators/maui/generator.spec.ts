// In generator.spec.ts

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration, getProjects } from '@nx/devkit';
import * as devkit from '@nx/devkit';

import { mauiGenerator } from './generator';
import { MauiGeneratorSchema } from './schema';

jest.mock('@nx/devkit');

describe('maui generator', () => {
  let tree: Tree;
  const options: MauiGeneratorSchema = { project: 'test' };

  beforeEach(() => {
    jest.resetAllMocks();
    tree = createTreeWithEmptyWorkspace();

    (devkit.getProjects as jest.Mock).mockReturnValue(new Map());
    (devkit.formatFiles as jest.Mock).mockResolvedValue(undefined);
    (devkit.generateFiles as jest.Mock).mockReturnValue(undefined);
    (devkit.addProjectConfiguration as jest.Mock).mockReturnValue(undefined);
    (devkit.runExecutor as jest.Mock).mockResolvedValue({ success: true });
    (devkit.getWorkspaceLayout as jest.Mock).mockReturnValue({ libsDir: 'libs' });
    (devkit.addDependenciesToPackageJson as jest.Mock).mockResolvedValue({ success: true });

    (tree.exists as jest.Mock) = jest.fn().mockReturnValue(true);
    (tree.read as jest.Mock) = jest.fn().mockReturnValue(Buffer.from(''));
    (tree.write as jest.Mock) = jest.fn();
  });

  it('should run successfully', async () => {
    const generator = await mauiGenerator(tree, options);
    await generator();
    expect(devkit.addProjectConfiguration).toHaveBeenCalledWith(
      tree,
      'maui',
      expect.objectContaining({
        root: 'maui',
        projectType: 'library',
        sourceRoot: 'maui/src',
        targets: expect.objectContaining({
          build: expect.any(Object),
          'generate-spartan-ui': expect.any(Object),
          'setup-tailwindcss': expect.any(Object),
        }),
      })
    );
  });

  it('should add Spartan UI dependencies', async () => {
    const generator = await mauiGenerator(tree, options);
    await generator();
    expect(devkit.addDependenciesToPackageJson).toHaveBeenCalledWith(
      tree,
      { '@spartan-ng/ui-core': 'latest' },
      { '@spartan-ng/cli': 'latest' }
    );
  });

  it('should run Spartan UI generator', async () => {
    const generator = await mauiGenerator(tree, options);
    await generator();
    expect(devkit.runExecutor).toHaveBeenCalledWith(
      { project: 'maui', target: 'generate-spartan-ui' },
      {},
      expect.any(Object)
    );
  });

  it('should run Tailwind CSS setup', async () => {
    const generator = await mauiGenerator(tree, options);
    await generator();
    expect(devkit.runExecutor).toHaveBeenCalledWith(
      { project: 'maui', target: 'setup-tailwindcss' },
      {},
      expect.any(Object)
    );
  });
});
