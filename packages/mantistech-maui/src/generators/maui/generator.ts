import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  addProjectConfiguration,
  names,
  offsetFromRoot,
  GeneratorCallback,
  getProjects,
  runExecutor,
  ExecutorContext,
  ProjectConfiguration,
  TargetConfiguration,
  addDependenciesToPackageJson
} from '@nx/devkit';
import * as path from 'path';
import { MauiGeneratorSchema } from './schema';

const provideContext = async(tree: Tree, projectRoot: string, projectConfiguration: ProjectConfiguration, targetName: string ): Promise<ExecutorContext> => {
  return {
    root: tree.root,
    cwd: process.cwd(),
    projectName: projectRoot,
    targetName: targetName,
    projectsConfigurations: {
      projects: {
        [projectRoot]: projectConfiguration
      },
      version: 2
    },
    workspace: {
      version: 2,
      projects: {
        [projectRoot]: projectConfiguration
      }
    },
    isVerbose: false,
    target: projectConfiguration.targets[targetName] as TargetConfiguration,
  };
}

export async function mauiGenerator(tree: Tree, options: MauiGeneratorSchema): Promise<GeneratorCallback> {
  const libName = 'maui';
  const projectNames = names(libName);
  const projectRoot = libName;
  const targetProject = options.project;

  console.log('Generator options:', options);
  console.log('Existing projects before adding maui:', Array.from(getProjects(tree).keys()));

  // Add MAUI dependencies
  addDependenciesToPackageJson(
    tree,
    {
      '@spartan-ng/ui-core': 'latest',
      '@ng-icons/core': '^25.1.0',
      '@ng-icons/lucide': '^26.3.0',
      '@swimlane/ngx-charts': '^20.5.0',
      '@ngneat/overview': '^6.1.0',
      '@ngxpert/cmdk': '^2.0.0'
    },
    {
      '@spartan-ng/cli': 'latest',
    }
  );

  // 1. Create MAUI lib structure
  console.log('Adding project configuration for:', libName);
  const projectConfiguration: ProjectConfiguration = {
    root: projectRoot,
    projectType: 'library',
    sourceRoot: `${projectRoot}/src`,
    targets: {
      build: {
        executor: '@nx/js:tsc',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: `dist/${projectRoot}`,
          main: `${projectRoot}/src/index.ts`,
          tsConfig: `${projectRoot}/tsconfig.lib.json`,
          assets: [`${projectRoot}/*.md`],
        },
      } as TargetConfiguration,
      'generate-spartan-ui': {
        executor: 'nx:run-commands',
        options: {
          command: `npx nx g @spartan-ng/cli:ui --name=all --directory=${projectRoot}/src/lib/spartanui`
        }
      } as TargetConfiguration,
      'setup-tailwindcss': {
        executor: 'nx:run-commands',
        options: {
          command: `npx nx g @mantistechio/maui:tailwindcss --project=${targetProject}`
        }
      } as TargetConfiguration
    },
    tags: [],
  };

  addProjectConfiguration(tree, libName, projectConfiguration);

  console.log('Project configuration added.');

  // 2. Generate MAUI library files
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'lib'),
    projectRoot,
    { ...projectNames, offsetFromRoot: offsetFromRoot(projectRoot) }
  );

  // 3. Generate MAUI components
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'maui'),
    `${projectRoot}/src/lib`,
    { ...projectNames, offsetFromRoot: offsetFromRoot(projectRoot) }
  );

  console.log('Files generated. Formatting...');

  await formatFiles(tree);

  return async () => {
    console.log('Running post-generation tasks...');
    await installPackagesTask(tree);
    console.log('Packages installed');

    // Run Spartan UI generator
    console.log('Attempting to run Spartan UI generator...');
    try {
      const targetName = 'generate-spartan-ui';
      const context: ExecutorContext = await provideContext(tree, libName, projectConfiguration, targetName);

      const result = await runExecutor(
        { project: libName, target: targetName },
        {},
        context
      );

      for await (const output of result) {
        if (!output.success) {
          throw new Error('Failed to generate Spartan UI components');
        }
      }

      console.log('Spartan UI generator completed successfully.');
    } catch (error) {
      console.error('Error running Spartan UI generator:', error);
      throw error;
    }

    // 4. Update target project's tailwind.config.js if specified
    if (targetProject) {
      try {
        const targetName = 'setup-tailwindcss';
        const context: ExecutorContext = await provideContext(tree, libName, projectConfiguration, targetName);

        const result = await runExecutor(
          { project: libName, target: targetName },
          {},
          context
        );

        for await (const output of result) {
          if (!output.success) {
            throw new Error('Failed to run Tailwind CSS setup');
          }
        }

        console.log('Tailwind CSS generator completed successfully.');
      } catch (error) {
        console.error('Error running Tailwind CSS generator:', error);
        throw error;
      }
    } else {
      console.log('No target project specified. Skipping project-specific updates.');
    }

    console.log('MAUI generator completed successfully.');
  };
}

export default mauiGenerator;
/**
import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  addProjectConfiguration,
  names,
  offsetFromRoot,
  GeneratorCallback,
  getProjects,
  runExecutor,
  ExecutorContext,
  ProjectConfiguration,
  TargetConfiguration,
  addDependenciesToPackageJson
} from '@nx/devkit';
import * as path from 'path';
import { MauiGeneratorSchema } from './schema';

export async function mauiGenerator(tree: Tree, options: MauiGeneratorSchema): Promise<GeneratorCallback> {
  const libName = 'maui';
  const projectNames = names(libName);
  const projectRoot = libName;
  const targetProject = options.project;

  console.log('Generator options:', options);
  console.log('Existing projects before adding maui:', Array.from(getProjects(tree).keys()));

  // Add Spartan UI dependencies
  addDependenciesToPackageJson(
    tree,
    {
      '@spartan-ng/ui-core': 'latest',
    },
    {
      '@spartan-ng/cli': 'latest',
    }
  );

  // 1. Create MAUI lib structure
  console.log('Adding project configuration for:', libName);
  const projectConfiguration: ProjectConfiguration = {
    root: projectRoot,
    projectType: 'library',
    sourceRoot: `${projectRoot}/src`,
    targets: {
      build: {
        executor: '@nx/js:tsc',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: `dist/${projectRoot}`,
          main: `${projectRoot}/src/index.ts`,
          tsConfig: `${projectRoot}/tsconfig.lib.json`,
          assets: [`${projectRoot}/*.md`],
        },
      } as TargetConfiguration,
      'generate-spartan-ui': {
        executor: 'nx:run-commands',
        options: {
          command: `npx nx g @spartan-ng/cli:ui --name=all --directory=${projectRoot}/src/lib/spartanui`
        }
      } as TargetConfiguration,
      'setup-tailwindcss': {
        executor: 'nx:run-commands',
        options: {
          command: `nx generate @mantistechio/maui:tailwindcss --project=${targetProject}`
        }
      } as TargetConfiguration
    },
    tags: [],
  };

  addProjectConfiguration(tree, libName, projectConfiguration);

  console.log('Project configuration added.');

  // 2. Generate MAUI library files
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'lib'),
    projectRoot,
    { ...projectNames, offsetFromRoot: offsetFromRoot(projectRoot) }
  );

  // 3. Generate MAUI components
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'maui'),
    `${projectRoot}/src/lib`,
    { ...projectNames, offsetFromRoot: offsetFromRoot(projectRoot) }
  );

  console.log('Files generated. Formatting...');

  await formatFiles(tree);

  return async () => {
    console.log('Running post-generation tasks...');
    await installPackagesTask(tree);
    console.log('Packages installed');

    const context: ExecutorContext = {
      root: tree.root,
      cwd: process.cwd(),
      projectName: libName,
      targetName: '',
      projectsConfigurations: {
        projects: {
          [libName]: projectConfiguration
        },
        version: 2
      },
      workspace: {
        version: 2,
        projects: {
          [libName]: projectConfiguration
        }
      },
      isVerbose: false,
    };

    // Run Spartan UI generator
    console.log('Attempting to run Spartan UI generator...');
    try {
      context.targetName = 'generate-spartan-ui';
      context.target = projectConfiguration.targets['generate-spartan-ui'] as TargetConfiguration;

      await runExecutor(
        { project: libName, target: 'generate-spartan-ui' },
        {},
        context
      );

      console.log('Spartan UI generator completed successfully.');
    } catch (error) {
      console.error('Error running Spartan UI generator:', error);
      throw error;
    }

    // Run Tailwind CSS setup
    if (targetProject) {
      console.log(`Setting up Tailwind CSS for project ${targetProject}`);
      try {
        context.targetName = 'setup-tailwindcss';
        context.target = projectConfiguration.targets['setup-tailwindcss'] as TargetConfiguration;

        await runExecutor(
          { project: libName, target: 'setup-tailwindcss' },
          {},
          context
        );

        console.log(`Tailwind CSS setup completed successfully for project ${targetProject}`);
      } catch (error) {
        console.error(`Error setting up Tailwind CSS for project ${targetProject}:`, error);
      }
    } else {
      console.log('No target project specified. Skipping Tailwind CSS setup.');
    }

    console.log('MAUI generator completed successfully.');
  };
}

export default mauiGenerator;
**/
