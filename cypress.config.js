const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: "8whpgu",
  e2e: {
    setupNodeEvents(on, config) {},
    baseUrl: "http://localhost:4200",

    // ── Chemins — alignés sur la structure réelle E2Ecypress ──
    specPattern: "E2Ecypress/e2e/**/*.cy.js",
    supportFile: "E2Ecypress/support/e2e.js",
    fixturesFolder: "E2Ecypress/fixtures",
    screenshotsFolder: "E2Ecypress/screenshots",
    videosFolder: "E2Ecypress/videos",

    // ── Timeouts — adaptés Angular + Docker ──
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 60000,
    requestTimeout: 15000,
    responseTimeout: 15000,

    // ── Stabilité ──
    retries: { runMode: 2, openMode: 0 },
    screenshotOnRunFailure: true,
    video: false,

    // ── Sécurité Cypress v15 ──
    allowCypressEnv: true,
    experimentalMemoryManagement: true,
  },
  env: {
    apiUrl: "http://localhost:8081",
    username: "test2@test.fr",
    password: "testtest",
  },
});
