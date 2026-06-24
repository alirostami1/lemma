/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: [
        "(^|/)dist/",
        "(^|/)generated/",
        "(^|/)node_modules/",
        "(^|/)openapi/",
        "(^|/)__snapshots__/",
      ].join("|"),
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
