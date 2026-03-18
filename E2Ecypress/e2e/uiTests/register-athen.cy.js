/// <reference types="cypress" />

describe("Authentification - Inscription et Connexion", () => {
  const timestamp = Date.now();
  const lastname = `demo_${timestamp}`;
  const firstname = `user_${timestamp}`;
  const email = `${lastname}@example.com`;
  const password = "testtest";

  // ─── Setup : visite la page d'accueil + intercepte les alertes navigateur ───
  beforeEach(() => {
    cy.visit("/");
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
    });
  });

  // ─── Helper : log l'alerte navigateur si déclenchée ───
  const logAlerte = () => {
    cy.get("@alertStub").then((stub) => {
      if (stub.called) {
        cy.log("🔔 Alerte capturée : " + stub.args[0][0]);
      } else {
        cy.log("ℹ️ Aucune alerte détectée");
      }
    });
  };

  // ─── Helper : logue et fait échouer le test avec code anomalie ───
  const signalerAnomalie = (code, message, details = "") => {
    cy.log(`🚨 [${code}] ANOMALIE DÉTECTÉE`);
    cy.log(`📋 ${message}`);
    if (details) cy.log(`🔍 ${details}`);
    throw new Error(`❌ [${code}] ${message}${details ? " | " + details : ""}`);
  };

  // ─────────────────────────────────────────────
  // TEST 1 — Inscription d'un nouvel utilisateur + déconnexion
  // ─────────────────────────────────────────────
  it("1 - Créer un compte utilisateur avec succès", () => {
    cy.contains("a", "Inscription").click();
    cy.url().should("include", "/register");
    cy.get("#lastname").type(lastname);
    cy.get("#firstname").type(firstname);
    cy.get("#email").type(email);
    cy.get("#password").type(password);
    cy.get("#confirm").type(password);

    cy.intercept("POST", "**/register").as("registerRequest");
    cy.get('[data-cy="register-submit"]').click();
    logAlerte();

    cy.wait("@registerRequest", { timeout: 15000 }).then((interception) => {
      cy.log(`📡 Status inscription : ${interception.response.statusCode}`);
    });

    cy.url({ timeout: 15000 })
      .should("not.include", "/register")
      .then((url) => {
        cy.log(`✅ TEST 1 — Inscription réussie pour ${email} | URL : ${url}`);
      });

    cy.contains("a", "Déconnexion", { timeout: 10000 })
      .should("be.visible")
      .click();

    cy.url().should("include", "/");
  });

  // ─────────────────────────────────────────────
  // TEST 2 — Inscription bloquée si email déjà utilisé
  // ─────────────────────────────────────────────
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
    cy.get("p.error", { timeout: 8000 }).then(($el) => {
      if (!$el.is(":visible")) {
        signalerAnomalie(
          "ANO-AUTH-02",
          "DEFECT HIGH — Aucun message d'erreur affiché pour email déjà utilisé",
          "Attendu : p.error visible | Observé : élément absent ou masqué",
        );
      }
      if (!$el.text().includes("Cette adresse mail est déjà utilisée")) {
        signalerAnomalie(
          "ANO-AUTH-02",
          "DEFECT MEDIUM — Message d'erreur incorrect pour email déjà utilisé",
          `Attendu : "Cette adresse mail est déjà utilisée" | Observé : "${$el.text()}"`,
        );
      }
      cy.log(`✅ TEST 2 — Erreur correctement affichée : ${$el.text()}`);
    });
  });

  // ─────────────────────────────────────────────
  // TEST 3 — Connexion réussie avec un compte existant
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // TEST 4 — Connexion bloquée si format email invalide
  // ─────────────────────────────────────────────
  it("4 - Connexion échoue avec email au mauvais format", () => {
    cy.contains("a", "Connexion").click();
    cy.get("#username").type("emailinvalide");
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();
    logAlerte();
    cy.get("p.error", { timeout: 8000 }).then(($el) => {
      if (!$el.is(":visible")) {
        signalerAnomalie(
          "ANO-AUTH-04",
          "DEFECT HIGH — Aucun message d'erreur affiché pour email au mauvais format",
          "Attendu : p.error visible | Observé : élément absent ou masqué",
        );
      }
      cy.log(`✅ TEST 4 — Erreur format email affichée : ${$el.text()}`);
    });
  });

  // ─────────────────────────────────────────────
  // TEST 5 — Connexion bloquée si email inexistant en base
  // ─────────────────────────────────────────────
  it("5 - Connexion échoue avec email inexistant", () => {
    cy.contains("a", "Connexion").click();
    cy.get("#username").type("inexistant@example.com");
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();
    logAlerte();
    cy.get("p.error", { timeout: 8000 }).then(($el) => {
      if (!$el.is(":visible")) {
        signalerAnomalie(
          "ANO-AUTH-05",
          "DEFECT HIGH — Aucun message d'erreur affiché pour email inexistant",
          "Attendu : p.error visible | Observé : élément absent ou masqué",
        );
      }
      cy.log(`✅ TEST 5 — Erreur email inexistant affichée : ${$el.text()}`);
    });
  });

  // ─────────────────────────────────────────────
  // TEST 6 — Connexion bloquée si email vide + label rouge
  // ─────────────────────────────────────────────
  it("6 - Connexion échoue avec email vide", () => {
    cy.contains("a", "Connexion").click();
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();
    logAlerte();
    cy.get("p.error", { timeout: 8000 }).then(($el) => {
      if (!$el.is(":visible")) {
        signalerAnomalie(
          "ANO-AUTH-06",
          "DEFECT HIGH — Aucun message d'erreur affiché pour email vide",
          "Attendu : p.error visible | Observé : élément absent ou masqué",
        );
      }
      if (
        !$el.text().includes("Merci de remplir correctement tous les champs")
      ) {
        signalerAnomalie(
          "ANO-AUTH-06",
          "DEFECT MEDIUM — Message d'erreur incorrect pour email vide",
          `Attendu : "Merci de remplir correctement tous les champs" | Observé : "${$el.text()}"`,
        );
      }
      cy.log(`✅ TEST 6 — Erreur email vide affichée : ${$el.text()}`);
    });
    cy.get("label")
      .contains("Email")
      .then(($label) => {
        if (!$label.hasClass("error")) {
          signalerAnomalie(
            "ANO-AUTH-06",
            "DEFECT LOW — Label Email non mis en rouge (classe error absente)",
            "Attendu : label.error | Observé : classe error manquante",
          );
        }
        cy.log("✅ TEST 6 — Label Email en rouge (classe error présente)");
      });
  });

  // ─────────────────────────────────────────────
  // TEST 7 — Connexion bloquée si mot de passe incorrect
  // ─────────────────────────────────────────────
  it("7 - Connexion échoue avec mot de passe erroné", () => {
    cy.contains("a", "Connexion").click();
    cy.get("#username").type("ramoshippuden@gmail.com");
    cy.get("#password").type("mauvaismdp");
    cy.contains("span", "Se connecter").click();
    logAlerte();
    cy.get("p.error", { timeout: 8000 }).then(($el) => {
      if (!$el.is(":visible")) {
        signalerAnomalie(
          "ANO-AUTH-07",
          "DEFECT HIGH — Aucun message d'erreur affiché pour mot de passe erroné",
          "Attendu : p.error visible | Observé : élément absent ou masqué",
        );
      }
      cy.log(`✅ TEST 7 — Erreur mot de passe erroné affichée : ${$el.text()}`);
    });
  });

  // ─────────────────────────────────────────────
  // TEST 8 — Injection XSS dans le formulaire de connexion (cas NON passant)
  // ─────────────────────────────────────────────
  it("8 - Tentative d'injection XSS dans le formulaire de connexion", () => {
    const xssPayload = `<script>alert("XSS")</script>`;

    cy.contains("a", "Connexion").click();
    cy.get("#username").type(xssPayload);
    cy.get("#password").type(xssPayload);
    cy.contains("span", "Se connecter").click();
    logAlerte();

    // Vérification 1 : on reste sur la page login (pas de redirection non autorisée)
    cy.url().should("include", "/login");

    // Vérification 2 : le payload XSS ne s'exécute pas dans le DOM
    cy.document().then((doc) => {
      const body = doc.body.innerHTML;
      if (body.includes("<​script>")) {
        signalerAnomalie(
          "ANO-AUTH-08",
          "DEFECT CRITICAL — Faille XSS détectée dans le formulaire de connexion",
          "Attendu : payload XSS échappé ou refusé | Observé : balise <script> présente dans le DOM",
        );
      }
      cy.log("✅ TEST 8 — Payload XSS non exécuté dans le DOM");
    });

    // Vérification 3 : un message d'erreur s'affiche (champ invalide ou refus)
    cy.get("p.error", { timeout: 8000 }).then(($el) => {
      if (!$el.is(":visible")) {
        signalerAnomalie(
          "ANO-AUTH-08B",
          "DEFECT MEDIUM — Aucun message d'erreur affiché après injection XSS",
          "Attendu : p.error visible | Observé : élément absent ou masqué",
        );
      }
      cy.log(`✅ TEST 8 — Message d'erreur affiché : ${$el.text()}`);
    });
  });
});
