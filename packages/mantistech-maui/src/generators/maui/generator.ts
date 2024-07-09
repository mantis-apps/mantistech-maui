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
  const isNewWorkspace = options.newWorkspace;
  const projectName = options.project || 'maui-app';
  const useStandalone = options.standalone;

  if (isNewWorkspace) {
    console.log('Creating a new workspace is not implemented in this generator. Please create a workspace first.');
    return;
  }

  // Read existing project configuration or create a new one
  let projectConfig;
  try {
    projectConfig = readProjectConfiguration(tree, projectName);
  } catch {
    projectConfig = {
      root: `apps/${projectName}`,
      sourceRoot: `apps/${projectName}/src`,
      projectType: 'application',
      targets: {},
    };
    addProjectConfiguration(tree, projectName, projectConfig);
  }

  const projectRoot = projectConfig.root;
  const featureRoot = `${projectRoot}/feature`;

  // 1. Install dependencies
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

  // 2. Copy Spartan UI helm components
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'spartanui'),
    `${featureRoot}/spartanui`,
    {
      ...options,
      template: '',
      standalone: useStandalone,
    }
  );

  // 3. Update tsconfig.base.json
  updateJson(tree, 'tsconfig.base.json', (json) => {
    json.compilerOptions = json.compilerOptions || {};
    json.compilerOptions.paths = json.compilerOptions.paths || {};

    const helmComponents = tree.children(`${__dirname}/files/spartanui`);
    helmComponents.forEach(component => {
      json.compilerOptions.paths[`@spartan-ng/${component}`] = [`${featureRoot}/spartanui/${component}/src/index.ts`];
    });

    return json;
  });

  // 4. Set up Tailwind CSS configuration
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

  // 5. Generate MAUI components
  generateFiles(
    tree,
    path.join(__dirname, 'files', 'maui'),
    `${featureRoot}/ui/src/lib/ui/components`,
    {
      ...options,
      template: '',
      standalone: useStandalone,
    }
  );

  // 6. Update main.ts or app.module.ts based on standalone option
  if (useStandalone) {
    updateStandaloneApp(tree, projectConfig);
  } else {
    updateModularApp(tree, projectConfig);
  }

  await formatFiles(tree);

  return () => {
    installPackagesTask(tree);
    console.log('After installation, run: npx nx g @spartan-ng/cli:ui-theme');
    console.log('Then run: npx nx g @spartan-ng/cli:ui');
  };
}

function updateStandaloneApp(tree: Tree, projectConfig: any) {
  const mainPath = `${projectConfig.sourceRoot}/main.ts`;
  if (tree.exists(mainPath)) {
    let mainContent = tree.read(mainPath, 'utf-8');
    if (mainContent.includes('bootstrapApplication')) {
      mainContent = mainContent.replace(
        /bootstrapApplication\((.*?),\s*{/s,
        `bootstrapApplication($1, {\n  imports: [MauiModule],`
      );
      mainContent = `import { MauiModule } from './app/maui.module';\n${mainContent}`;
      tree.write(mainPath, mainContent);
    }
  }
}

function updateModularApp(tree: Tree, projectConfig: any) {
  const appModulePath = `${projectConfig.sourceRoot}/app/app.module.ts`;
  if (tree.exists(appModulePath)) {
    let appModuleContent = tree.read(appModulePath, 'utf-8');
    appModuleContent = appModuleContent.replace(
      'imports: [',
      'imports: [\n    MauiModule,'
    );
    appModuleContent = `import { MauiModule } from './maui.module';\n${appModuleContent}`;
    tree.write(appModulePath, appModuleContent);
  }
}

export default mauiGenerator;
