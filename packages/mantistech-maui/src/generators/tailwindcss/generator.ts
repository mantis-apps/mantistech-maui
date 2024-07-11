import {
  Tree,
  formatFiles,
  installPackagesTask,
  GeneratorCallback,
  addDependenciesToPackageJson,
  getProjects,
  logger,
} from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';
import { TailwindCSSGeneratorSchema } from './schema';

export async function tailwindCSSGenerator(
  tree: Tree,
  options: TailwindCSSGeneratorSchema
): Promise<GeneratorCallback> {
  const { project: targetProject } = options;

  // Install Tailwind CSS and its dependencies
  addDependenciesToPackageJson(
    tree,
    {},
    {
      tailwindcss: '^3.3.0',
      postcss: '^8.4.21',
      autoprefixer: '^10.4.14',
    }
  );

  if (targetProject) {
    try {
      const projects = getProjects(tree);
      const targetProjectConfig = projects.get(targetProject);

      if (!targetProjectConfig) {
        throw new Error(`Target project '${targetProject}' not found`);
      }

      const targetProjectRoot = targetProjectConfig.root;

      if (!options.skipTailwindConfig) {
        updateTailwindConfig(tree, targetProjectRoot, targetProject);
      }

      if (!options.skipStylesUpdate) {
        updateStyles(tree, targetProjectRoot, targetProject);
      }

      logger.info(`Finished updating project ${targetProject}`);
    } catch (error) {
      logger.error(`Error updating target project ${targetProject}: ${error}`);
    }
  } else {
    logger.warn('No target project specified. Skipping project-specific updates.');
  }

  await formatFiles(tree);

  return async () => {
    await installPackagesTask(tree);
  };
}

function updateTailwindConfig(tree: Tree, projectRoot: string, projectName: string) {
  const tailwindConfigPath = path.join(projectRoot, 'tailwind.config.js');
  const templatePath = path.join(__dirname, 'files', 'tailwind.config.js.template');

  try {
    if (!fs.existsSync(templatePath)) {
      throw new Error('Tailwind config template file not found');
    }

    const newConfig = fs.readFileSync(templatePath, 'utf-8').trim();

    if (tree.exists(tailwindConfigPath)) {
      logger.info(`tailwind.config.js found for project ${projectName}. Merging configurations.`);
      const existingConfig = tree.read(tailwindConfigPath).toString().trim();
      const mergedConfig = mergeConfigs(existingConfig, newConfig);
      tree.write(tailwindConfigPath, mergedConfig);
    } else {
      logger.info(`tailwind.config.js not found for project ${projectName}. Creating new configuration.`);
      tree.write(tailwindConfigPath, newConfig);
    }
  } catch (error) {
    logger.error(`Error updating Tailwind config for ${projectName}: ${error}`);
  }
}

function mergeConfigs(existingConfig: string, newConfig: string): string {
  // This is a simple merge strategy. You might need to adjust it based on your specific needs.
  try {
    const existingModule = eval(`(${existingConfig})`);
    const newModule = eval(`(${newConfig})`);

    const mergedModule = {
      ...existingModule,
      ...newModule,
      darkMode: newModule.darkMode,
      presets: [...new Set([...(existingModule.presets || []), ...(newModule.presets || [])])],
      content: [...new Set([...(existingModule.content || []), ...(newModule.content || [])])],
      theme: {
        ...existingModule.theme,
        extend: {
          ...(existingModule.theme?.extend || {}),
          ...(newModule.theme?.extend || {}),
        },
      },
      plugins: [...new Set([...(existingModule.plugins || []), ...(newModule.plugins || [])])],
      variants: {
        ...(existingModule.variants || {}),
        extend: {
          ...(existingModule.variants?.extend || {}),
          ...(newModule.variants?.extend || {}),
        },
      },
    };

  // Use JSON.stringify with a custom replacer and then replace double quotes with single quotes
  return `module.exports = ${JSON.stringify(mergedModule, null, 2).replace(/"([^"]+)":/g, "'$1':")};
    `;
  } catch (error) {
    logger.error(`Error merging Tailwind configs: ${error}`);
    return newConfig; // Fallback to using the new config if merge fails
  }
}

function updateStyles(tree: Tree, projectRoot: string, projectName: string) {
  const stylesPath = `${projectRoot}/src/styles.css`;
  const templatePath = path.join(__dirname, 'files', 'tailwind.imports.css.template');

  try {
    if (!fs.existsSync(templatePath)) {
      throw new Error('Tailwind imports template file not found');
    }

    const updatedStylesImports = fs.readFileSync(templatePath, 'utf-8').trim();

    if (tree.exists(stylesPath)) {
      const existingStyles = tree.read(stylesPath).toString().trim();
      const updatedStylesContent = `${updatedStylesImports}\n\n${existingStyles}`;
      tree.write(stylesPath, updatedStylesContent);
      logger.info(`Updated styles.css for project ${projectName}`);
    } else {
      logger.info(`styles.css not found for project ${projectName}. Creating new styles file.`);
      tree.write(stylesPath, updatedStylesImports);
    }
  } catch (error) {
    logger.error(`Error updating styles for ${projectName}: ${error}`);
  }
}



export default tailwindCSSGenerator;
