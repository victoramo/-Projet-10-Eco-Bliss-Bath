const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: "8whpgu",

  reporter: "mochawesome",
  reporterOptions: {
    reportDir: "E2Ecypress/reports",
    overwrite: false,
    json: true,
    html: false,
  },

  e2e: {
    setupNodeEvents(on, config) {},
    baseUrl: "http://localhost:4200/",

    specPattern: "E2Ecypress/e2e/**/*.cy.js",
    supportFile: "E2Ecypress/support/e2e.js",
    fixturesFolder: "E2Ecypress/fixtures",
    screenshotsFolder: "E2Ecypress/screenshots",
    videosFolder: "E2Ecypress/videos",
    viewportWidth: 1280,
    viewportHeight: 720,

    defaultCommandTimeout: 10000,
    pageLoadTimeout: 60000,
    requestTimeout: 15000,
    responseTimeout: 15000,

    retries: { runMode: 2, openMode: 0 },
    screenshotOnRunFailure: true,
    video: true,
    videoCompression: 32,
    trashAssetsBeforeRuns: true,

    experimentalMemoryManagement: true,
  },

  env: {
    apiUrl: "http://localhost:8081",
    username: "test2@test.fr",
    password: "testtest",
  },
});
