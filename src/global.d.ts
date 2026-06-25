// Global module declarations for non-TypeScript imports
// This file allows importing .md, .lark, .jl, .py, .rb, .css, .js files as modules

declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.lark' {
  const content: string;
  export default content;
}

declare module '*.jl' {
  const content: string;
  export default content;
}

declare module '*.py' {
  const content: string;
  export default content;
}

declare module '*.rb' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.js' {
  const content: any;
  export default content;
}

declare module '@oh-my-pi/hashline/grammar.lark' {
  const content: string;
  export default content;
}

declare module '@oh-my-pi/hashline/prompt.md' {
  const content: string;
  export default content;
}

declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  type Plugin = (service: TurndownService) => void;
  export const gfm: Plugin;
  export const highlightedCodeBlock: Plugin;
  export const strikethrough: Plugin;
  export const tables: Plugin;
  export const taskListItems: Plugin;
}