import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  readProjectConfiguration,
  addDependenciesToPackageJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { execSync } from 'child_process';
import * as path from 'path';
import { MauiGeneratorSchema } from './schema';

export async function mauiGenerator(tree: Tree, options: MauiGeneratorSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  // Steps 1-2: Install dependencies (SpartanUI and MAUI)
  const dependencies = {
    '@spartan-ng/ui-core': 'latest',
    '@spartan-ng/ui-accordion-helm': 'latest',
    '@spartan-ng/ui-button-helm': 'latest',
    '@mantistechio/ui-core': 'latest',
    // Add other dependencies here
  };

  const devDependencies = {
    '@spartan-ng/cli': 'latest',
    '@mantistechio/ui-devkit': 'latest',
    // Add other dev dependencies here
  };

  addDependenciesToPackageJson(tree, dependencies, devDependencies);

  // Step 3: Generate MAUI configuration files
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    projectConfig.root,
    {
      ...options,
      template: '',
    }
  );

  // Step 4: Modify existing files to import and use MAUI
  const appModulePath = `${projectConfig.sourceRoot}/app/app.module.ts`;
  const mainTsPath = `${projectConfig.sourceRoot}/main.ts`;

  if (!options.standalone && tree.exists(appModulePath)) {
    // Traditional NgModule approach
    let appModuleContent = tree.read(appModulePath, 'utf-8');
    if (appModuleContent) {
      appModuleContent = appModuleContent.replace(
        'imports: [',
        'imports: [\n    MauiModule,'
      );
      appModuleContent = `import { MauiModule } from '@mantistechio/ui-core';\n${appModuleContent}`;
      tree.write(appModulePath, appModuleContent);
    }
  } else if (options.standalone && tree.exists(mainTsPath)) {
    // Standalone approach
    let mainTsContent = tree.read(mainTsPath, 'utf-8');
    if (mainTsContent && mainTsContent.includes('bootstrapApplication')) {
      mainTsContent = mainTsContent.replace(
        /bootstrapApplication\((.*?),\s*{/s,
        `bootstrapApplication($1, {\n  imports: [MauiModule],`
      );
      mainTsContent = `import { MauiModule } from '@mantistechio/ui-core';\n${mainTsContent}`;
      tree.write(mainTsPath, mainTsContent);
    } else {
      console.log('Unable to automatically add MAUI to main.ts. Please add it manually.');
    }
  } else {
    console.log('Unable to determine project structure. Please add MAUI manually to your application.');
  }

  // Step 5: Update project configuration
  projectConfig.targets = {
    ...projectConfig.targets,
    'build-storybook': {
      executor: '@storybook/angular:build-storybook',
      options: {
        configDir: `${projectConfig.root}/.storybook`,
        outputDir: `${projectConfig.root}/dist/storybook`,
        browserTarget: `${options.project}:build`
      }
    }
  };

  updateProjectConfiguration(tree, options.project, projectConfig);

  await formatFiles(tree);

  return () => {
    installPackagesTask(tree);
    // Run SpartanUI CLI commands
    console.log('Running SpartanUI setup commands...');
    execSync('npx @spartan-ng/cli:init', { stdio: 'inherit' });
    execSync('npx @spartan-ng/cli:add accordion button', { stdio: 'inherit' });
    // Add other SpartanUI CLI commands as needed
  };
}

export default mauiGenerator;
