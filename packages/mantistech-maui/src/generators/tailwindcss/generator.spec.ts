import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { tailwindcssGenerator } from './generator';
import { TailwindcssGeneratorSchema } from './schema';

describe('tailwindcss generator', () => {
  let tree: Tree;
  const options: TailwindcssGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await tailwindcssGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
