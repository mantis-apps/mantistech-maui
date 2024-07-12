import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { tailwindCSSGenerator } from './generator';
import { TailwindCSSGeneratorSchema } from './schema';

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
  });

  it('should run successfully', async () => {
    await tailwindCSSGenerator(appTree, options);
    expect(appTree.exists('apps/test-project/tailwind.config.js')).toBeTruthy();
  });

  it('should set the correct color mode in tailwind config', async () => {
    await tailwindCSSGenerator(appTree, { ...options, colorMode: 'light' });
    const updatedConfig = appTree.read('apps/test-project/tailwind.config.js').toString();
    expect(updatedConfig).toContain("darkMode: ['class', '[data-mode=\"light\"]']");
  });

  it('should create styles.css if it does not exist', async () => {
    await tailwindCSSGenerator(appTree, options);
    expect(appTree.exists('apps/test-project/src/styles.css')).toBeTruthy();
  });

  it('should update existing styles.css', async () => {
    appTree.write('apps/test-project/src/styles.css', 'body { color: red; }');
    await tailwindCSSGenerator(appTree, options);
    const updatedStyles = appTree.read('apps/test-project/src/styles.css').toString();
    expect(updatedStyles).toContain("@import '@angular/cdk/overlay-prebuilt.css'");
    expect(updatedStyles).toContain('@import \'tailwindcss/base\'');
    expect(updatedStyles).toContain('@import \'tailwindcss/components\'');
    expect(updatedStyles).toContain('@import \'tailwindcss/utilities\'');
    expect(updatedStyles).toContain('body');
    expect(updatedStyles).toContain('color: red');
  });

  it('should add Tailwind CSS dependencies', async () => {
    await tailwindCSSGenerator(appTree, options);
    const packageJson = JSON.parse(appTree.read('package.json').toString());
    expect(packageJson.devDependencies).toHaveProperty('tailwindcss');
    expect(packageJson.devDependencies).toHaveProperty('postcss');
    expect(packageJson.devDependencies).toHaveProperty('autoprefixer');
  });

  it('should handle different UI theme colors', async () => {
    await tailwindCSSGenerator(appTree, { ...options, uiThemeColor: 'theme-blue' });
    const styles = appTree.read('apps/test-project/src/styles.css').toString();
    expect(styles).toContain('.theme-blue');
  });

  it('should skip tailwind config update when skipTailwindConfig is true', async () => {
    await tailwindCSSGenerator(appTree, { ...options, skipTailwindConfig: true });
    expect(appTree.exists('apps/test-project/tailwind.config.js')).toBeFalsy();
  });

  it('should skip styles update when skipStylesUpdate is true', async () => {
    await tailwindCSSGenerator(appTree, { ...options, skipStylesUpdate: true });
    expect(appTree.exists('apps/test-project/src/styles.css')).toBeFalsy();
  });
});
