import { Tree } from '@nx/devkit';
import * as path from 'path';
import { JSDOM } from 'jsdom';

export function updateRootTags(tree: Tree, projectRoot: string, colorMode: string, uiThemeColor: string) {
  const indexPath = path.join(projectRoot, 'src', 'index.html');

  if (!tree.exists(indexPath)) {
    throw new Error(`index.html not found at ${indexPath}`);
  }

  const indexContent = tree.read(indexPath, 'utf-8');
  const dom = new JSDOM(indexContent);
  const document = dom.window.document;

  // Update html tag
  const htmlTag = document.querySelector('html');
  if (htmlTag) {
    const htmlClasses = new Set(htmlTag.classList);
    htmlClasses.add('h-full');
    htmlClasses.add('scroll-smooth');
    htmlClasses.add(uiThemeColor);
    htmlTag.className = Array.from(htmlClasses).join(' ');
  }

  // Update body tag
  const bodyTag = document.querySelector('body');
  if (bodyTag) {
    const bodyClasses = new Set(bodyTag.classList);
    bodyClasses.add('bg-background');
    bodyClasses.add('text-foreground');
    if (colorMode === 'dark') {
      bodyClasses.add('dark');
    }
    bodyTag.className = Array.from(bodyClasses).join(' ');
  }

  // Write the updated content back to the file
  const updatedContent = dom.serialize();
  tree.write(indexPath, updatedContent);
}
