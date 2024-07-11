import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  addProjectConfiguration,
  readProjectConfiguration,
  updateProjectConfiguration,
  names,
  offsetFromRoot,
  GeneratorCallback,
  runExecutor,
  ExecutorContext,
  workspaceRoot,
  getProjects,
} from '@nx/devkit';
import * as path from 'path';
import { MauiGeneratorSchema } from './schema';

export async function mauiGenerator(tree: Tree, options: MauiGeneratorSchema): Promise<GeneratorCallback> {
  const libName = 'maui';
  const projectNames = names(libName);
  const projectRoot = libName;
  const targetProject = options.project;

  console.log('Generator options:', options);
  console.log('Existing projects:', Array.from(getProjects(tree).keys()));

  // 1. Create MAUI lib structure
  addProjectConfiguration(tree, libName, {
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
      },
      'generate-spartan-ui': {
        executor: '@mantistechio/maui:spartanui',
        options: {
          name: 'all',
          directory: `${projectRoot}/src/lib/spartanui`
        }
      }
    },
    tags: [],
  });

  console.log('Added project configuration for:', libName);

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

  // 4. Update target project's tailwind.config.js
  if (targetProject) {
    const targetProjectConfig = readProjectConfiguration(tree, targetProject);
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
    } else {
      // Create a new tailwind.config.js if it doesn't exist
      const newTailwindConfig = `
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

module.exports = {
  presets: [require('@spartan-ng/ui-core/hlm-tailwind-preset')],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
      tree.write(tailwindConfigPath, newTailwindConfig);
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
    }

    // 6. Update target project's configuration to use tailwind
    updateProjectConfiguration(tree, targetProject, {
      ...targetProjectConfig,
      targets: {
        ...targetProjectConfig.targets,
        build: {
          ...targetProjectConfig.targets.build,
          options: {
            ...targetProjectConfig.targets.build.options,
            styles: [
              ...targetProjectConfig.targets.build.options.styles,
              `${targetProjectRoot}/src/styles.css`
            ]
          }
        }
      }
    });
  }

  await formatFiles(tree);

  return async () => {
    await installPackagesTask(tree);
    console.log('Installed packages');

    // Run Spartan UI generator
    console.log('Attempting to run Spartan UI generator...');
    try {
      const projectConfig = readProjectConfiguration(tree, libName);
      console.log('Project configuration:', projectConfig);

      const context: ExecutorContext = {
        root: workspaceRoot,
        cwd: process.cwd(),
        isVerbose: false,
        projectName: libName,
        targetName: 'generate-spartan-ui',
        taskGraph: null,
        configurationName: null,
        projectsConfigurations: {
          projects: {
            [libName]: projectConfig,
          },
          version: 2,
        },
        workspace: {
          version: 2,
          projects: {
            [libName]: projectConfig,
          },
        },
      };

      try {
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
        throw error;
      }
    } catch (error) {
      console.error('Error reading project configuration', error);
      throw error;
    }
  };
}

export default mauiGenerator;
