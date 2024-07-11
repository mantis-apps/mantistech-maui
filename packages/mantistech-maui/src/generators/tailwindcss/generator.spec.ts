import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration, addProjectConfiguration } from '@nx/devkit';
import { tailwindCSSGenerator } from './generator';
import { TailwindCSSGeneratorSchema } from './schema';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('tailwindcss generator', () => {
  let appTree: Tree;
  const options: TailwindCSSGeneratorSchema = { project: 'test-project' };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(appTree, 'test-project', {
      root: 'apps/test-project',
      sourceRoot: 'apps/test-project/src',
      projectType: 'application',
    });

    // Mock file system operations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath) => {
      if (filePath.includes('tailwind.config.js.template')) {
        return 'module.exports = { content: [], theme: { extend: {} }, plugins: [] }';
      }
      if (filePath.includes('tailwind.imports.css.template')) {
        return '@import "tailwindcss/base";\n@import "tailwindcss/components";\n@import "tailwindcss/utilities";';
      }
      return '';
    });
  });

  it('should run successfully', async () => {
    await tailwindCSSGenerator(appTree, options);
    const config = readProjectConfiguration(appTree, 'test-project');
    expect(config).toBeDefined();
  });

  it('should add Tailwind CSS dependencies', async () => {
    await tailwindCSSGenerator(appTree, options);
    const packageJson = JSON.parse(appTree.read('package.json').toString());
    expect(packageJson.devDependencies).toHaveProperty('tailwindcss');
    expect(packageJson.devDependencies).toHaveProperty('postcss');
    expect(packageJson.devDependencies).toHaveProperty('autoprefixer');
  });

  it('should create tailwind.config.js if it does not exist', async () => {
    await tailwindCSSGenerator(appTree, options);
    expect(appTree.exists('apps/test-project/tailwind.config.js')).toBeTruthy();
  });

  it('should update existing tailwind.config.js', async () => {
    appTree.write(
      'apps/test-project/tailwind.config.js',
      'module.exports = { theme: { extend: { colors: { primary: "blue" } } } }'
    );
    await tailwindCSSGenerator(appTree, options);
    const updatedConfig = appTree.read('apps/test-project/tailwind.config.js').toString();
    expect(updatedConfig).toContain("primary: 'blue'");
    expect(updatedConfig).toContain('content: []');
  });

  it('should create styles.css if it does not exist', async () => {
    await tailwindCSSGenerator(appTree, options);
    expect(appTree.exists('apps/test-project/src/styles.css')).toBeTruthy();
  });

  it('should update existing styles.css', async () => {
    appTree.write('apps/test-project/src/styles.css', 'body { color: red; }');
    await tailwindCSSGenerator(appTree, options);
    const updatedStyles = appTree.read('apps/test-project/src/styles.css').toString();
    expect(updatedStyles).toContain("@import 'tailwindcss/base'");
    expect(updatedStyles).toMatch(/body\s*{\s*color:\s*red;\s*}/);
  });

  it('should handle missing project gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    await tailwindCSSGenerator(appTree, { project: 'non-existent-project' });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error updating target project non-existent-project")
    );
    consoleSpy.mockRestore();
  });

  it('should skip updates when no project is specified', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    await tailwindCSSGenerator(appTree, { project: undefined });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("No target project specified")
    );
    consoleWarnSpy.mockRestore();
  });
});
