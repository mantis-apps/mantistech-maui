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
      const context: ExecutorContext = {
        root: tree.root,
        cwd: process.cwd(),
        projectName: libName,
        targetName: 'generate-spartan-ui',
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
        target: projectConfiguration.targets['generate-spartan-ui'] as TargetConfiguration,
      };

      const result = await runExecutor(
        { project: libName, target: 'generate-spartan-ui' },
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
      console.log('Final list of projects:', Array.from(getProjects(tree).keys()));
      throw error;
    }

    // 4. Update target project's tailwind.config.js if specified
    if (targetProject) {
      try {
        const projects = getProjects(tree);
        const targetProjectConfig = projects.get(targetProject);

        if (!targetProjectConfig) {
          throw new Error(`Target project '${targetProject}' not found`);
        }

        const targetProjectRoot = targetProjectConfig.root;
        const tailwindConfigPath = `${targetProjectRoot}/tailwind.config.js`;

        if (tree.exists(tailwindConfigPath)) {
          const tailwindConfig = tree.read(tailwindConfigPath).toString();
          const updatedTailwindConfig = tailwindConfig.replace(
            'module.exports = {',
            `module.exports = {
  presets: [require('@spartan-ng/ui-core/hlm-tailwind-preset')],`
          );
          tree.write(tailwindConfigPath, updatedTailwindConfig);
          console.log(`Updated tailwind.config.js for project ${targetProject}`);
        } else {
          console.log(`tailwind.config.js not found for project ${targetProject}. Skipping Tailwind configuration update.`);
        }

        // 5. Update target project's styles.css
        const stylesPath = `${targetProjectRoot}/src/styles.css`;
        if (tree.exists(stylesPath)) {
          const stylesContent = tree.read(stylesPath).toString();
          const updatedStylesContent = `@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

${stylesContent}`;
          tree.write(stylesPath, updatedStylesContent);
          console.log(`Updated styles.css for project ${targetProject}`);
        } else {
          console.log(`styles.css not found for project ${targetProject}. Skipping styles update.`);
        }

        console.log(`Finished updating project ${targetProject}`);
      } catch (error) {
        console.error(`Error updating target project ${targetProject}:`, error);
      }
    } else {
      console.log('No target project specified. Skipping project-specific updates.');
    }

    console.log('MAUI generator completed successfully.');
  };
}

export default mauiGenerator;
