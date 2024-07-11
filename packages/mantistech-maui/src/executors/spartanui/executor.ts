import { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';

export interface SpartanUiExecutorSchema {
  name: string;
  directory: string;
}

export default async function spartanUiExecutor(
  options: SpartanUiExecutorSchema,
  context: ExecutorContext
) {
  console.log('Executing Spartan UI generator...');
  try {
    const command = `nx g @spartan-ng/cli:ui --name=${options.name} --directory=${options.directory}`;
    console.log(`Executing command: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      cwd: context.root,
    });
    console.log('Spartan UI generator executed successfully.');
    return { success: true };
  } catch (error) {
    // Don't log the error in the executor, let the caller handle it
    return { success: false, error };
  }
}
