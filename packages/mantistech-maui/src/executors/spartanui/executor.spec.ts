import { ExecutorContext } from '@nx/devkit';
import executor from './executor';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('SpartanUi Executor', () => {
  let context: ExecutorContext;

  beforeEach(() => {
    context = {
      root: '/fake/root',
      projectName: 'test-project',
      targetName: 'generate-spartan-ui',
      workspace: {
        version: 2,
        projects: {},
      },
      isVerbose: false,
    } as ExecutorContext;
  });

  it('should run successfully', async () => {
    const options = {
      name: 'all',
      directory: 'maui/src/lib/spartanui'
    };

    const output = await executor(options, context);
    expect(output.success).toBe(true);
    expect(execSync).toHaveBeenCalledWith(
      'nx g @spartan-ng/cli:ui --name=all --directory=maui/src/lib/spartanui',
      expect.objectContaining({
        stdio: 'inherit',
        cwd: '/fake/root',
      })
    );
  });

  it('should fail when command throws', async () => {
    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error('Command failed');
    });

    const options = {
      name: 'all',
      directory: 'maui/src/lib/spartanui'
    };

    const output = await executor(options, context);
    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
  });
});
