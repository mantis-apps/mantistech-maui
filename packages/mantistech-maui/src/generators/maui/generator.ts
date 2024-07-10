import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  addProjectConfiguration,
  updateJson,
  addDependenciesToPackageJson,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
  GeneratorCallback
} from '@nx/devkit';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MauiGeneratorSchema } from './schema';

const execAsync = promisify(exec);

export async function mauiGenerator(tree: Tree, options: MauiGeneratorSchema): Promise<GeneratorCallback> {
  const libName = 'maui';
  const projectNames = names(libName);
  const { libsDir } = getWorkspaceLayout(tree);
  const projectRoot = `${libsDir}/${projectNames.fileName}`;

  // Check if project already exists
  if (tree.exists(projectRoot)) {
    if (!options.overwrite) {
      console.log(`A project named "${libName}" already exists. Use --overwrite to override.`);
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {}; // Return an empty function as the callback
    }
    console.log(`Overriding existing project "${libName}"...`);
  }

  // 1. Install @spartan-ng/ui-core and @spartan-ng/cli
  addDependenciesToPackageJson(
    tree,
    {
      '@spartan-ng/ui-core': 'latest',
      '@swimlane/ngx-charts': '^20.5.0',
    },
    { '@spartan-ng/cli': 'latest' },

  );

  // 2. Create MAUI lib structure
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
    },
    tags: [],
  });

// 3. Generate basic library files
generateFiles(
  tree,
  path.join(__dirname, 'files', 'lib'),
  projectRoot,
  { ...options, ...projectNames, offsetFromRoot: offsetFromRoot(projectRoot) }
);

// 4. Generate MAUI components
generateFiles(
  tree,
  path.join(__dirname, 'files', 'maui'),
  `${projectRoot}/src/lib/maui`,
  { ...options, ...projectNames, offsetFromRoot: offsetFromRoot(projectRoot) }
);

  // 5. Update tsconfig paths for MAUI
  updateTsConfig(tree, projectRoot);

  // 6. Update project.json
  updateProjectJson(tree, libName, projectRoot);

  await formatFiles(tree);

  // 7. Run Spartan UI generator
  const installTask = async () => {
    try {
      const { stdout } = await execAsync(
        `nx g @spartan-ng/cli:ui --name=all --directory=${projectRoot}/src/lib/spartanui`
      );
      console.log(stdout);
    } catch (error) {
      console.error('Failed to run Spartan UI generator:', error);
      throw error;
    }
  };

  return async () => {
    await installPackagesTask(tree);
    await installTask();
  };
}

function updateTsConfig(tree: Tree, projectRoot: string) {
  const tsConfigPath = tree.exists('tsconfig.base.json')
    ? 'tsconfig.base.json'
    : 'tsconfig.json';

  updateJson(tree, tsConfigPath, (json) => {
    json.compilerOptions = json.compilerOptions || {};
    json.compilerOptions.paths = json.compilerOptions.paths || {};

    json.compilerOptions.paths["@mantistech/ui"] = [`${projectRoot}/src/index.ts`];
    json.compilerOptions.paths["@mantistech/ui/*"] = [`${projectRoot}/src/*`];

    return json;
  });
}

function updateProjectJson(tree: Tree, libName: string, projectRoot: string) {
  const projectJsonPath = `${projectRoot}/project.json`;

  if (tree.exists(projectJsonPath)) {
    updateJson(tree, projectJsonPath, (json) => {
      json.targets = json.targets || {};
      json.targets.build = json.targets.build || {};
      json.targets.build.options = json.targets.build.options || {};

      json.targets.build.options.tailwindConfig = `${projectRoot}/tailwind.config.js`;

      return json;
    });
  }
}

export default mauiGenerator;
