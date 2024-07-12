export interface TailwindCSSGeneratorSchema {
  project: string;
  skipTailwindConfig?: boolean;
  skipStylesUpdate?: boolean;
  colorMode?: 'light' | 'dark';
  uiThemeColor?: 'theme-green' | 'theme-blue' | 'theme-red' | 'theme-zinc' | 'theme-orange';
}
