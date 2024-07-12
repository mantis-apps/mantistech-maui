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
import { mergeConfigs } from './tailwind.config.utils';

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
        updateStyles(tree, targetProjectRoot, targetProject, options.uiThemeColor);
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
      const mergedConfig = mergeConfigs(existingConfig, newConfig, projectRoot);
      tree.write(tailwindConfigPath, mergedConfig);
    } else {
      logger.info(`tailwind.config.js not found for project ${projectName}. Creating new configuration.`);
      tree.write(tailwindConfigPath, newConfig);
    }
  } catch (error) {
    logger.error(`Error updating Tailwind config for ${projectName}: ${error}`);
  }
}

function updateStyles(tree: Tree, projectRoot: string, projectName: string, uiThemeColor: string) {
  const stylesPath = path.join(projectRoot, 'src', 'styles.css');
  const themeFilePath = path.join(__dirname, 'files', 'themes', `${uiThemeColor}.css.template`);

  try {
    if (!fs.existsSync(themeFilePath)) {
      throw new Error(`Theme file for ${uiThemeColor} not found`);
    }

    const newThemeContent = fs.readFileSync(themeFilePath, 'utf-8').trim();

    if (tree.exists(stylesPath)) {
      let existingStyles = tree.read(stylesPath).toString();

      // Ensure Angular CDK import is present
      const cdkImport = "@import '@angular/cdk/overlay-prebuilt.css';";
      if (!existingStyles.includes(cdkImport)) {
        existingStyles = `${cdkImport}\n${existingStyles}`;
      }

      // Check if there's an existing theme
      const themeRegex = /@layer\s+base\s+{[\s\S]*?}\s*}/;
      if (themeRegex.test(existingStyles)) {
        // Replace existing theme with new theme
        existingStyles = existingStyles.replace(themeRegex, newThemeContent);
      } else {
        // If no existing theme, append the new theme
        existingStyles += `\n\n${newThemeContent}`;
      }

      tree.write(stylesPath, existingStyles);
      logger.info(`Updated styles.css for project ${projectName}`);
    } else {
      // If styles.css doesn't exist, create it with the default imports and new theme
      const defaultImports = `@import '@angular/cdk/overlay-prebuilt.css';
      @import 'tailwindcss/base';
      @import 'tailwindcss/components';
      @import 'tailwindcss/utilities';`;

      const newStyles = `${defaultImports}\n\n${newThemeContent}`;
      tree.write(stylesPath, newStyles);
      logger.info(`Created styles.css for project ${projectName}`);
    }
  } catch (error) {
    logger.error(`Error updating styles for ${projectName}: ${error}`);
  }
}

export default tailwindCSSGenerator;
