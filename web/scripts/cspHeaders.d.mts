export interface BuildContentRouteHeaderBlockInput {
  path: string;
  jsonLdScripts: string[];
  baseHeadersFileContent: string;
}

export function buildContentRouteHeaderBlock(input: BuildContentRouteHeaderBlockInput): string;
