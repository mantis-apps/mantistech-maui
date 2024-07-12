import * as path from 'path';

// Function to extract the object literal from module.exports
function extractConfigObject(config: string): string {
  const match = config.match(/module\.exports\s*=\s*(\{[\s\S]*\})/);
  return match ? match[1] : '{}';
}

function stringifyConfig(obj, indent = 0) {
  const spaces = ' '.repeat(indent * 2);
  let result = '{\n';
  for (const [key, value] of Object.entries(obj)) {
    result += `${spaces}  ${key}: `;
    if (key === 'content' && Array.isArray(value)) {
      result += '[\n';
      result += value.map(item => `${spaces}    ${item}`).join(',\n');
      result += `\n${spaces}  ]`;
    } else if (Array.isArray(value)) {
      result += '[\n';
      result += value.map(item => {
        if (typeof item === 'string' && item.includes('"')) {
          return `${spaces}    '${item}'`;
        }
        return `${spaces}    ${JSON.stringify(item)}`;
      }).join(',\n');
      result += `\n${spaces}  ]`;
    } else if (typeof value === 'object' && value !== null) {
      result += stringifyConfig(value, indent + 1);
    } else if (typeof value === 'function') {
      result += value.toString();
    } else {
      result += JSON.stringify(value);
    }
    result += ',\n';
  }
  result = result.slice(0, -2); // Remove last comma and newline
  result += `\n${spaces}}`;
  return result;
}

export function mergeConfigs(existingConfig: string, newConfig: string, projectRoot: string): string {
  try {
    // Extract config objects
    const existingConfigObject = extractConfigObject(existingConfig);
    const newConfigObject = extractConfigObject(newConfig);

    // Create a context for evaluation
    const context = {
      require: (module: string) => {
        if (module === '@nx/angular/tailwind') {
          return { createGlobPatternsForDependencies: (dir) => [`${dir}/**/*.{html,ts}`] };
        }
        if (module === 'path') {
          return path;
        }
        if (module === '@spartan-ng/ui-core/hlm-tailwind-preset') {
          return {};
        }
        throw new Error(`Unexpected require: ${module}`);
      },
      __dirname: projectRoot,
      join: path.join,
      createGlobPatternsForDependencies: (dir) => [`${dir}/**/*.{html,ts}`]
    };

    // Parse config objects
    const existing = eval(`(function(require, __dirname, join, createGlobPatternsForDependencies) { return ${existingConfigObject}; })`)(
      context.require,
      context.__dirname,
      context.join,
      context.createGlobPatternsForDependencies
    );
    const newConf = eval(`(function(require, __dirname, join, createGlobPatternsForDependencies) { return ${newConfigObject}; })`)(
      context.require,
      context.__dirname,
      context.join,
      context.createGlobPatternsForDependencies
    );

    // Define the desired order of keys
    const orderedConfig = {
      darkMode: undefined,
      presets: undefined,
      content: undefined,
      theme: undefined,
      plugins: undefined,
      variants: undefined,
    };

    // Merge configurations
    const merged = {
      ...orderedConfig,
      darkMode: ['class', '[data-mode="dark"]'],
      presets: [
        `require('@spartan-ng/ui-core/hlm-tailwind-preset')`,
        ...(existing.presets || []),
        ...(newConf.presets || []),
      ].filter((preset, index, self) => self.indexOf(preset) === index), // Remove duplicates
      content: [
        `join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}')`,
        `...createGlobPatternsForDependencies(__dirname)`,
      ],
      theme: {
        ...(existing.theme || {}),
        ...(newConf.theme || {}),
        extend: {
          ...(existing.theme?.extend || {}),
          ...(newConf.theme?.extend || {}),
        },
      },
      plugins: [...new Set([...(existing.plugins || []), ...(newConf.plugins || [])])],
      variants: {
        ...(existing.variants || {}),
        ...(newConf.variants || {}),
        extend: {
          ...(existing.variants?.extend || {}),
          ...(newConf.variants?.extend || {}),
        },
      },
    };

    // Remove any undefined keys
    Object.keys(merged).forEach(key => merged[key] === undefined && delete merged[key]);


    // Reconstruct the config file
    const header = existingConfig.split('module.exports =')[0];

    const mergedConfigString = stringifyConfig(merged)
      .replace(/"require\([^)]+\)"/g, match => match.replace(/"/g, ''))
      .replace(/"createGlobPatternsForDependencies\(__dirname\)"/g, 'createGlobPatternsForDependencies(__dirname)')
      .replace(/"join\(__dirname,/g, 'join(__dirname,')
      .replace(/"\)"/g, ')')
      .replace(/\\"/g, '"');

    return `${header}module.exports = ${mergedConfigString};`;
  } catch (error) {
    console.error('Error merging Tailwind configs:', error);
    return newConfig;
  }
}
