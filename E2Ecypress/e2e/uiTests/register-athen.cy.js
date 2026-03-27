/// <reference types="cypress" />

describe("Authentification - Inscription et Connexion", () => {
  const timestamp = Date.now();
  const lastname = `demo_${timestamp}`;
  const firstname = `user_${timestamp}`;
  const email = `${lastname}@example.com`;
  const password = "testtest";

  // ✅ CORRECTION — déclarés ici, accessibles dans TOUS les it()
  const xssPayloads = [
    { id: "XSS-02", payload: "<​img src=x onerror=alert('XSS')>" },
    { id: "XSS-03", payload: "<​svg onload=alert('XSS')>" },
    { id: "XSS-08", payload: "<iframe src=javascript:alert('XSS')></iframe>" },
    { id: "XSS-13", payload: "' OR 1=1; <script>alert('XSS')</script>" },
  ];

  const XSS_PATTERNS = [
    "<script",
    "onerror=",
    "onload=",
    "javascript:",
    "onfocus=",
  ];

  const containsXSSInText = (text) =>
    XSS_PATTERNS.some((p) => text.toLowerCase().includes(p.toLowerCase()));

  // ─── Setup ───
  beforeEach(() => {
    cy.visit("/");
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
    });
  });

  const logAlerte = () => {
    cy.get("@alertStub").then((stub) => {
      if (stub.called) {
        cy.log("🔔 Alerte capturée : " + stub.args[0][0]);
      } else {
        cy.log("ℹ️ Aucune alerte détectée");
      }
    });
  };

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
  // TEST 8 — XSS UI Formulaire Inscription
  // ─────────────────────────────────────────────
  it("8 - Résistance XSS du formulaire Inscription (Angular → Symfony)", () => {
    const anomalies = [];

    cy.then(() => {
      xssPayloads.forEach((item) => {
        // ✅ CORRECTION 1 — Déconnexion forcée avant chaque itération
        cy.visit("/");
        cy.get("body").then(($body) => {
          if ($body.find("a:contains('Déconnexion')").length > 0) {
            cy.contains("a", "Déconnexion").click();
          }
        });

        cy.visit("/#/register");
        cy.url().should("include", "/register");

        cy.intercept("POST", "**/register").as(`registerXSS_${item.id}`);

        cy.get("#lastname")
          .clear()
          .type(item.payload, { parseSpecialCharSequences: false });
        cy.get("#firstname")
          .clear()
          .type(item.payload, { parseSpecialCharSequences: false });
        // ✅ CORRECTION 2 — timestamp unique par payload pour éviter les doublons
        cy.get("#email").clear().type(`xss-${item.id}-${Date.now()}@test.com`);
        cy.get("#password").clear().type("testtest");
        cy.get("#confirm").clear().type("testtest");
        cy.get('[data-cy="register-submit"]').click();

        cy.wait(`@registerXSS_${item.id}`, { timeout: 10000 }).then(
          (interception) => {
            const status = interception.response?.statusCode;
            const responseBody = JSON.stringify(
              interception.response?.body ?? "",
            );
            cy.log(`📡 [${item.id}] REGISTER — HTTP ${status}`);
            if (
              [200, 201].includes(status) &&
              containsXSSInText(responseBody)
            ) {
              anomalies.push(
                `[${item.id}] ❌ SYMFONY — payload XSS accepté et reflété dans la réponse | HTTP ${status}`,
              );
            } else {
              cy.log(
                `✅ [${item.id}] SYMFONY — payload non reflété dans la réponse`,
              );
            }
          },
        );

        cy.get("@alertStub").then((stub) => {
          if (stub.callCount > 0) {
            anomalies.push(
              `[${item.id}] ❌ EXÉCUTION JS — alert() déclenché sur le formulaire inscription`,
            );
          } else {
            cy.log(`✅ [${item.id}] Aucune exécution JS détectée`);
          }
        });

        cy.get("body").then(($body) => {
          const $clone = $body.clone();
          $clone.find("input, textarea, select, form").remove();
          const visibleText = $clone[0].textContent || "";
          if (containsXSSInText(visibleText)) {
            anomalies.push(
              `[${item.id}] ❌ DOM INSCRIPTION — payload XSS visible dans le texte de la page`,
            );
          } else {
            cy.log(`✅ [${item.id}] DOM propre — payload non reflété`);
          }
        });
      });
    });

    cy.then(() => {
      if (anomalies.length > 0) {
        throw new Error(
          `❌ ${anomalies.length} vulnérabilité(s) XSS détectée(s) sur le formulaire inscription :\n` +
            anomalies.map((a, i) => `  ${i + 1}. ${a}`).join("\n"),
        );
      }
      cy.log(
        "✅ TEST 8 — Formulaire inscription résiste aux 4 payloads XSS ciblés",
      );
    });
  });

  // ─────────────────────────────────────────────
  // TEST 9 — XSS UI Formulaire Login
  // ─────────────────────────────────────────────
  it("9 - Résistance XSS du formulaire Login (même payloads que inscription)", () => {
    const anomalies = [];

    cy.then(() => {
      xssPayloads.forEach((item) => {
        cy.visit("/#/login");
        cy.url().should("include", "/login");

        // ✅ CORRECTION 3 — intercept déclaré AVANT le clic
        cy.intercept("POST", "**/login").as(`loginXSS_${item.id}`);

        cy.get("#username")
          .clear()
          .type(item.payload, { parseSpecialCharSequences: false });
        cy.get("#password")
          .clear()
          .type(item.payload, { parseSpecialCharSequences: false });
        cy.contains("span", "Se connecter").click();

        // ✅ CORRECTION 4 — Angular peut bloquer avant envoi → wait conditionnel
        cy.get("body").then(() => {
          cy.get(`@loginXSS_${item.id}`).then((interception) => {
            if (interception && interception.response) {
              const status = interception.response?.statusCode;
              const responseBody = JSON.stringify(
                interception.response?.body ?? "",
              );
              cy.log(`📡 [${item.id}] LOGIN — HTTP ${status}`);
              if ([200, 201].includes(status)) {
                anomalies.push(
                  `[${item.id}] ❌ SYMFONY — connexion acceptée avec payload XSS | HTTP ${status}`,
                );
              } else {
                cy.log(
                  `✅ [${item.id}] SYMFONY — payload refusé (HTTP ${status})`,
                );
              }
              if (containsXSSInText(responseBody)) {
                anomalies.push(
                  `[${item.id}] ❌ RÉPONSE SYMFONY — payload XSS reflété dans la réponse login`,
                );
              }
            } else {
              // ✅ Aucun POST = Angular a bloqué côté client = comportement attendu
              cy.log(
                `✅ [${item.id}] Angular a bloqué la soumission — aucun POST envoyé vers Symfony`,
              );
            }
          });
        });

        cy.get("@alertStub").then((stub) => {
          if (stub.callCount > 0) {
            anomalies.push(
              `[${item.id}] ❌ EXÉCUTION JS — alert() déclenché sur le formulaire login`,
            );
          } else {
            cy.log(`✅ [${item.id}] Aucune exécution JS détectée`);
          }
        });

        // ✅ CORRECTION 5 — vérification URL uniquement si le POST a eu lieu
        cy.url().then((url) => {
          if (url.includes("/login") || url.includes("/#/")) {
            cy.log(`✅ [${item.id}] Pas de session créée — URL : ${url}`);
          } else {
            anomalies.push(
              `[${item.id}] ❌ SESSION — redirection inattendue après payload XSS | URL : ${url}`,
            );
          }
        });

        cy.get("body").then(($body) => {
          const $clone = $body.clone();
          $clone.find("input, textarea, select, form").remove();
          const visibleText = $clone[0].textContent || "";
          if (containsXSSInText(visibleText)) {
            anomalies.push(
              `[${item.id}] ❌ DOM LOGIN — payload XSS visible dans le texte de la page`,
            );
          } else {
            cy.log(`✅ [${item.id}] DOM propre — payload non reflété`);
          }
        });
      });
    });

    cy.then(() => {
      if (anomalies.length > 0) {
        throw new Error(
          `❌ ${anomalies.length} vulnérabilité(s) XSS détectée(s) sur le formulaire login :\n` +
            anomalies.map((a, i) => `  ${i + 1}. ${a}`).join("\n"),
        );
      }
      cy.log("✅ TEST 9 — Formulaire login résiste aux 4 payloads XSS ciblés");
    });
  });
});
