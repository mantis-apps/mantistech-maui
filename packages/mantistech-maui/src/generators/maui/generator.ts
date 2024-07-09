import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  addProjectConfiguration,
  updateJson,
  addDependenciesToPackageJson,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import * as path from 'path';
import { MauiGeneratorSchema } from './schema';

export async function mauiGenerator(tree: Tree, options: MauiGeneratorSchema) {
  const projectName = options.project || 'maui-app';
  const libName = 'maui';
  const libRoot = `libs/${libName}`;

  // 1. Create MAUI lib
  addProjectConfiguration(tree, libName, {
    root: libRoot,
    projectType: 'library',
    sourceRoot: `${libRoot}/src`,
    targets: {
      build: {
        executor: '@nx/angular:package',
        outputs: ['{workspaceRoot}/dist/{projectRoot}'],
        options: {
          project: `${libRoot}/ng-package.json`
        }
      }
    }
  });

  // 2. Copy MAUI components
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'maui'),
    `${libRoot}/src/lib`,
    options
  );

  // 3. Copy Spartan UI helm components
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'spartanui'),
    `${libRoot}/src/lib/spartanui`,
    options
  );

  // 4. Install dependencies
  const spartanDependencies = {
    "@spartan-ng/ui-accordion-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-alertdialog-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-avatar-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-checkbox-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-collapsible-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-command-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-core": "^0.0.1-alpha.352",
    "@spartan-ng/ui-dialog-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-hovercard-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-label-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-menu-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-popover-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-progress-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-radiogroup-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-select-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-separator-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-sheet-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-switch-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-table-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-tabs-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-toggle-brain": "0.0.1-alpha.352",
    "@spartan-ng/ui-tooltip-brain": "0.0.1-alpha.352",
    "@swimlane/ngx-charts": "^20.5.0",
  };

  addDependenciesToPackageJson(tree, spartanDependencies, {
    '@spartan-ng/cli': 'latest',
    '@angular/cdk': 'latest',
  });

  // 5. Update tsconfig
  updateTsConfig(tree, libRoot);

  // 6. Handle Tailwind CSS
  handleTailwindCSS(tree, projectName);

  await formatFiles(tree);

  return () => {
    installPackagesTask(tree);
    console.log('MAUI lib has been generated successfully.');
    console.log('After installation, run: npx nx g @spartan-ng/cli:ui-theme');
    console.log('Then run: npx nx g @spartan-ng/cli:ui');
  };
}

function updateTsConfig(tree: Tree, libRoot: string) {
  const tsConfigPath = tree.exists('tsconfig.base.json')
    ? 'tsconfig.base.json'
    : 'tsconfig.json';

  updateJson(tree, tsConfigPath, (json) => {
    json.compilerOptions = json.compilerOptions || {};
    json.compilerOptions.paths = json.compilerOptions.paths || {};

    json.compilerOptions.paths["@mantistech/ui"] = [`${libRoot}/src/index.ts`];
    json.compilerOptions.paths["@mantistech/ui/schematics"] = [`${libRoot}/schematics/src/index.ts`];

    const helmComponents = tree.children(`${libRoot}/src/lib/spartanui`);
    helmComponents.forEach(component => {
      json.compilerOptions.paths[`@spartan-ng/${component}`] = [`${libRoot}/src/lib/spartanui/${component}/src/index.ts`];
    });

    return json;
  });
}

function handleTailwindCSS(tree: Tree, projectName: string) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  const projectRoot = projectConfig.root;

  // Check if Tailwind is already installed
  const packageJsonPath = 'package.json';
  const packageJson = JSON.parse(tree.read(packageJsonPath).toString());
  const hasTailwind = packageJson.dependencies['tailwindcss'] || packageJson.devDependencies['tailwindcss'];

  if (!hasTailwind) {
    // Install Tailwind CSS
    addDependenciesToPackageJson(tree, {}, {
      'tailwindcss': '^3.0.0',
      'postcss': '^8.4.5',
      'autoprefixer': '^10.4.0'
    });

    // Create Tailwind config
    const tailwindConfig = `
      const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
      const { join } = require('path');

      /** @type {import('tailwindcss').Config} */
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

    tree.write(`${projectRoot}/tailwind.config.js`, tailwindConfig);

    // Update styles.css
    const stylesPath = `${projectRoot}/src/styles.css`;
    const stylesContent = tree.read(stylesPath).toString();
    const updatedStylesContent = `
      @import 'tailwindcss/base';
      @import 'tailwindcss/components';
      @import 'tailwindcss/utilities';
      ${stylesContent}
    `;
    tree.write(stylesPath, updatedStylesContent);

  } else {
    // Update existing Tailwind config
    const tailwindConfigPath = `${projectRoot}/tailwind.config.js`;
    if (tree.exists(tailwindConfigPath)) {
      const tailwindConfig = tree.read(tailwindConfigPath).toString();
      const updatedConfig = tailwindConfig.replace(
        'module.exports = {',
        `module.exports = {
          presets: [require('@spartan-ng/ui-core/hlm-tailwind-preset')],`
      );
      tree.write(tailwindConfigPath, updatedConfig);
    }
  }
}

export default mauiGenerator;
