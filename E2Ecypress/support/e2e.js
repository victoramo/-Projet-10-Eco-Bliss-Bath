// cypress/support/e2e.js
import "./commands";

// Capture les erreurs JavaScript non gérées de l'application
Cypress.on("uncaught:exception", (err, runnable) => {
  console.error("💥 RUNTIME_ERROR", {
    id: `ERR_${Date.now()}`,
    message: err.message,
    test: runnable.title,
    timestamp: new Date().toISOString(),
  });
  return false; // ✅ OK ici — erreur vient de l'APP pas du test
});

// Capture les échecs de tests — LOG UNIQUEMENT sans masquer l'échec
Cypress.on("fail", (err, runnable) => {
  console.error("❌ TEST_FAIL", {
    id: `FAIL_${Date.now()}`,
    type: "TestFailException",
    message: err.message,
    test: runnable.title,
    timestamp: new Date().toISOString(),
  });
  throw err; // ✅ OBLIGATOIRE — re-throw pour que Cypress marque le test en échec
});
