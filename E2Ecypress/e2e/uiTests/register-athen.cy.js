/// <reference types="cypress" />

describe("Authentification - Inscription et Connexion", () => {
  const timestamp = Date.now();
  const lastname = `demo_${timestamp}`;
  const firstname = `user_${timestamp}`;
  const email = `${lastname}@example.com`;
  const password = "testtest";

  beforeEach(() => {
    cy.visit("/");
    // Stub alerte global pour TOUS les tests
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
    });
  });

  // Helper réutilisable pour logger l'alerte
  const logAlerte = () => {
    cy.get("@alertStub").then((stub) => {
      if (stub.called) {
        cy.log("🔔 Alerte capturée : " + stub.args[0][0]);
      } else {
        cy.log("⚠️ Aucune alerte détectée");
      }
    });
  };

  // ─────────────────────────────────────────
  // TEST 1 — Inscription réussie
  // ─────────────────────────────────────────
  it("1 - Créer un compte utilisateur avec succès", () => {
    cy.contains("a", "Inscription").click();
    cy.url().should("include", "/register");

    cy.get("#lastname").type(lastname);
    cy.get("#firstname").type(firstname);
    cy.get("#email").type(email);
    cy.get("#password").type(password);
    cy.get("#confirm").type(password);

    cy.get('[data-cy="register-submit"]').click();

    logAlerte();

    cy.url().should("not.include", "/register");
    cy.contains("a", "Déconnexion").click();
    cy.url().should("include", "/");
  });

  // ─────────────────────────────────────────
  // TEST 2 — Email déjà utilisé
  // ─────────────────────────────────────────
  it("2 - Affiche une erreur si l'adresse mail est déjà utilisée", () => {
    cy.contains("a", "Inscription").click();
    cy.url().should("include", "/register");

    cy.get("#lastname").type("ramo");
    cy.get("#firstname").type("victor");
    cy.get("#email").type("ramoshippuden@gmail.com");
    cy.get("#password").type("testtest");
    cy.get("#confirm").type("testtest");

    cy.get('[data-cy="register-submit"]').click();

    logAlerte();

    cy.get("p.error")
      .should("be.visible")
      .and("contain", "Cette adresse mail est déjà utilisée")
      .then(($el) => cy.log("❌ Erreur affichée : " + $el.text()));
  });

  // ─────────────────────────────────────────
  // TEST 3 — Connexion réussie
  // ─────────────────────────────────────────
  it("3 - Connexion avec un compte existant", () => {
    cy.contains("a", "Accueil").click();
    cy.contains("a", "Connexion").click();
    cy.url().should("include", "/login");

    cy.get("#username").type("ramoshippuden@gmail.com");
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();

    logAlerte();

    cy.url().should("not.include", "/login");
    cy.contains("a", "Déconnexion").should("be.visible");
  });

  // ─────────────────────────────────────────
  // TEST 4 — Email mauvais format
  // ─────────────────────────────────────────
  it("4 - Connexion échoue avec email au mauvais format", () => {
    cy.contains("a", "Connexion").click();

    cy.get("#username").type("emailinvalide");
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();

    logAlerte();

    cy.get("p.error")
      .should("be.visible")
      .then(($el) => cy.log("❌ Erreur affichée : " + $el.text()));
  });

  // ─────────────────────────────────────────
  // TEST 5 — Email inexistant
  // ─────────────────────────────────────────
  it("5 - Connexion échoue avec email inexistant", () => {
    cy.contains("a", "Connexion").click();

    cy.get("#username").type("inexistant@example.com");
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();

    logAlerte();

    cy.get("p.error")
      .should("be.visible")
      .then(($el) => cy.log("❌ Erreur affichée : " + $el.text()));
  });

  // ─────────────────────────────────────────
  // TEST 6 — Email vide
  // ─────────────────────────────────────────
  it("6 - Connexion échoue avec email vide", () => {
    cy.contains("a", "Connexion").click();

    // Ne pas remplir l'email — juste le mot de passe
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();

    logAlerte();

    // Vérifier le message d'erreur
    cy.get("p.error")
      .should("be.visible")
      .and("contain", "Merci de remplir correctement tous les champs")
      .then(($el) => cy.log("❌ Erreur affichée : " + $el.text()));

    // Vérifier que le label Email passe en rouge (classe error)
    cy.get("label")
      .contains("Email")
      .should("have.class", "error")
      .then(($label) =>
        cy.log("🔴 Label Email en rouge — classe error détectée"),
      );
  });

  // ─────────────────────────────────────────
  // TEST 7 — Mot de passe erroné
  // ─────────────────────────────────────────
  it("7 - Connexion échoue avec mot de passe erroné", () => {
    cy.contains("a", "Connexion").click();

    cy.get("#username").type("ramoshippuden@gmail.com");
    cy.get("#password").type("mauvaismdp");
    cy.contains("span", "Se connecter").click();

    logAlerte();

    cy.get("p.error")
      .should("be.visible")
      .then(($el) => cy.log("❌ Erreur affichée : " + $el.text()));
  });
});
