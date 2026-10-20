const config = {
  "*.{ts,tsx,js,jsx,mjs,cjs}": "eslint --fix --max-warnings=0",
  // One typecheck for the whole project: tsc cannot check single files.
  "*.{ts,tsx}": () => "pnpm typecheck",
};

export default config;
