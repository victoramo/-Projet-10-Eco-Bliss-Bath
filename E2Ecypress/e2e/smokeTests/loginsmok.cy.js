// tests de fumée pour la page de connexion
// Vérifie les scénarios critiques de connexion (succès, échec, erreurs de validation)
// et signale les anomalies majeures (defect critical/high) en cas de problème
describe("Page de connexion", () => {
  it("Présence des champs de saisie et du bouton de connexion", () => {
    cy.visit("#/login");
    cy.getBySel("login-input-username").should("be.visible");
    cy.getBySel("login-input-password").should("be.visible");
    cy.getBySel("login-submit").should("be.visible");
  });

  // TEST 2 — Vérifie que la connexion échoue avec une tentative d'injection SQL

  it("2 - Résistance à l'injection SQL dans le formulaire de connexion", () => {
    cy.visit("/#/login");

    cy.getBySel("login-input-username").type("' OR 1=1#");
    cy.getBySel("login-input-password").type("' OR 1=1#");
    cy.getBySel("login-submit").click();

    // L'application ne doit PAS connecter l'utilisateur
    cy.getBySel("login-errors").should("be.visible");
    cy.url().should("include", "/login"); // on reste sur la page login
  });
});
