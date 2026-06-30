/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "questions-not-to-workbook",
      severity: "error",
      comment:
        "@lemma/questions owns question source-edit decisions and must not import workbook bounded-context code directly.",
      from: { path: "^packages/questions/src/" },
      to: { path: "^(packages/workbook/|@lemma/workbook(?:/|$))" },
    },
  ],
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
