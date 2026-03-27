import { faker } from "@faker-js/faker/locale/fr";

describe("Smoke UI - Page Avis (Reviews)", () => {
  beforeEach(() => {
    cy.visit("/#/login");
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
    });
    cy.getBySel("login-input-username").type("test2@test.fr");
    cy.getBySel("login-input-password").type("testtest");
    cy.getBySel("login-submit").click();
    cy.url().should("not.include", "/login");
    cy.get("a[data-cy='nav-link-reviews']").click();
    cy.url().should("include", "/reviews");
    cy.get("section.review-section h1").should("contain", "Votre avis");
    cy.get(".single-review").should("have.length.greaterThan", 0);
  });

  // ─────────────────────────────────────────────
  // CAS 1 — Avis satisfait 5 étoiles ✅ (cas passant)
  // ─────────────────────────────────────────────
  it("1 - Avis satisfait 5 étoiles - cas passant", () => {
    const titre = `[TEST] ${faker.commerce.productAdjective()} ${faker.commerce.product()}`;
    const commentaire = faker.lorem.sentences(2);
    cy.log(`📝 Titre généré : ${titre}`);
    cy.log(`📝 Commentaire généré : ${commentaire}`);

    cy.get("p.number-reviews")
      .invoke("text")
      .then((text) => {
        const reviewCount = parseInt(text);
        cy.log(`📊 Compteur initial : ${reviewCount}`);

        cy.get(
          "div[data-cy='review-input-rating-images'] img:nth-child(5)",
        ).click();
        cy.get("#title").type(titre);
        cy.get("#comment").type(commentaire);
        cy.get("button[data-cy='review-submit']").click();

        cy.wait(3000);

        cy.get("p.number-reviews")
          .invoke("text")
          .then((newText) => {
            const newCount = parseInt(newText);
            cy.log(`📊 Compteur après ajout : ${newCount}`);
            expect(newCount).to.eq(reviewCount + 1);
          });

        cy.get(".average").should("be.visible");

        cy.get(".single-review")
          .contains("h2", titre)
          .closest(".single-review")
          .within(() => {
            cy.get("h2").should("contain", titre);
            cy.get("p").should("contain", commentaire.substring(0, 30));
          });
      });
  });

  // ─────────────────────────────────────────────
  // CAS 2 — Avis médiocre 2 étoiles ⚠️ (cas passant)
  // ─────────────────────────────────────────────
  it("2 - Avis médiocre 2 étoiles - cas passant", () => {
    const titre = `[TEST] ${faker.commerce.productAdjective()} ${faker.commerce.product()}`;
    const commentaire = faker.lorem.sentence();
    cy.log(`📝 Titre généré : ${titre}`);
    cy.log(`📝 Commentaire généré : ${commentaire}`);

    cy.get("p.number-reviews")
      .invoke("text")
      .then((text) => {
        const reviewCount = parseInt(text);
        cy.log(`📊 Compteur initial : ${reviewCount}`);

        cy.get(
          "div[data-cy='review-input-rating-images'] img:nth-child(2)",
        ).click();
        cy.get("#title").type(titre);
        cy.get("#comment").type(commentaire);
        cy.get("button[data-cy='review-submit']").click();

        cy.wait(3000);

        cy.get("p.number-reviews")
          .invoke("text")
          .then((newText) => {
            const newCount = parseInt(newText);
            cy.log(`📊 Compteur après ajout : ${newCount}`);
            expect(newCount).to.eq(reviewCount + 1);
          });

        cy.get(".single-review")
          .contains("p", commentaire.substring(0, 30))
          .closest(".single-review")
          .within(() => {
            cy.get("p").should("contain", commentaire.substring(0, 30));
          });
      });
  });

  // ─────────────────────────────────────────────
  // CAS 3 — Commentaire violent/insulte 1 étoile ❌ (cas NON passant)
  // ─────────────────────────────────────────────
  it("3 - Commentaire violent et insulte - doit être bloqué ou signalé", () => {
    const titre = "arnaque";
    const commentaire =
      "Commande non livrée, service nul, je vous emmerde, arnaque totale ! Va crever espèce de voleur.";
    cy.log(`📝 Titre fixe : ${titre}`);
    cy.log(`📝 Commentaire fixe : ${commentaire}`);

    // Tableau d'accumulation — remplace les throw immédiats
    const anomalies = [];

    cy.get("p.number-reviews")
      .invoke("text")
      .then((text) => {
        const reviewCount = parseInt(text);
        cy.log(`📊 Compteur initial : ${reviewCount}`);

        cy.get(
          "div[data-cy='review-input-rating-images'] img:nth-child(1)",
        ).click();
        cy.get("#title").type(titre);
        cy.get("#comment").type(commentaire);
        cy.get("button[data-cy='review-submit']").click();

        // Vérification 1 : alerte navigateur
        cy.get("@alertStub").then((stub) => {
          if (stub.called) {
            cy.log("🔔 CAS 3 — Alerte déclenchée : " + stub.args[0][0]);
          } else {
            cy.log("⚠️ CAS 3 — Aucune alerte navigateur détectée");
          }
        });

        // Vérification 2 : message d'erreur ou modération
        // On accumule l'anomalie au lieu de throw immédiatement
        cy.get("body").then(($body) => {
          if ($body.find("p.error").length > 0) {
            cy.get("p.error").then(($el) => {
              cy.log(`✅ CAS 3 — Message de blocage affiché : ${$el.text()}`);
            });
          } else {
            cy.log(
              "🚨 [ANO-REVIEW-03] ANOMALIE DÉTECTÉE — sera reportée en fin de test",
            );
            anomalies.push(
              "ANO-REVIEW-03 | DEFECT CRITICAL — Commentaire violent/haineux accepté sans blocage ni alerte" +
                " | Attendu : p.error visible | Observé : aucun retour utilisateur",
            );
          }
        });

        // Vérification 3 : compteur INCHANGÉ
        cy.wait(3000);
        cy.get("p.number-reviews")
          .invoke("text")
          .then((newText) => {
            const newCount = parseInt(newText);
            cy.log(`📊 Compteur après tentative : ${newCount}`);
            if (newCount > reviewCount) {
              cy.log(
                "🚨 [ANO-REVIEW-03B] ANOMALIE DÉTECTÉE — sera reportée en fin de test",
              );
              anomalies.push(
                `ANO-REVIEW-03B | DEFECT CRITICAL — Commentaire violent publié : compteur a augmenté` +
                  ` | Attendu : ${reviewCount} | Observé : ${newCount}`,
              );
            } else {
              cy.log(
                `✅ CAS 3 — Compteur inchangé : ${newCount} — commentaire bloqué`,
              );
            }
          });

        // Assertion finale groupée — throw unique après toutes les vérifications
        cy.then(() => {
          if (anomalies.length > 0) {
            throw new Error(
              `❌ ${anomalies.length} anomalie(s) détectée(s) — CAS 3 :\n` +
                anomalies.map((a, i) => `  ${i + 1}. ${a}`).join("\n"),
            );
          }
          cy.log("✅ CAS 3 — Toutes les vérifications passées");
        });
      });
  });

  // ─────────────────────────────────────────────
  // CAS 4 — Injection XSS dans le formulaire avis ❌ (cas NON passant)
  // CORRECTION : it() au niveau du describe, pas imbriqué dans le cas 3
  // ─────────────────────────────────────────────
  it("4 - Injection XSS dans le formulaire avis - doit être bloqué", () => {
    const xssPayloads = [
      { id: "XSS-02", payload: "<​img src=x onerror=alert('XSS')>" },
      { id: "XSS-03", payload: "<​svg onload=alert('XSS')>" },
      {
        id: "XSS-08",
        payload: "<iframe src=javascript:alert('XSS')></iframe>",
      },
      { id: "XSS-13", payload: "' OR 1=1; <script>alert('XSS')</script>" },
    ];

    const XSS_PATTERNS = [
      "<script",
      "onerror=",
      "onload=",
      "javascript:",
      "onfocus=",
    ];

    // Scanne un texte brut à la recherche d'un pattern XSS connu
    function containsXSSInText(text) {
      return XSS_PATTERNS.some((p) =>
        text.toLowerCase().includes(p.toLowerCase()),
      );
    }

    // Accumulation des anomalies — même stratégie que le cas 3
    const anomalies = [];

    cy.then(() => {
      xssPayloads.forEach((item) => {
        cy.intercept("POST", "**/reviews").as(`reviewXSS_${item.id}`);

        cy.get("#title")
          .clear()
          .type(item.payload, { parseSpecialCharSequences: false });
        cy.get("#comment")
          .clear()
          .type(item.payload, { parseSpecialCharSequences: false });
        cy.get(
          "div[data-cy='review-input-rating-images'] img:nth-child(3)",
        ).click();
        cy.get("button[data-cy='review-submit']").click();

        // Vérification 1 : réponse Symfony
        cy.wait(`@reviewXSS_${item.id}`, { timeout: 10000 }).then(
          (interception) => {
            const status = interception.response?.statusCode;
            const responseBody = JSON.stringify(
              interception.response?.body ?? "",
            );
            cy.log(`📡 [${item.id}] REVIEW POST — HTTP ${status}`);

            if (
              [200, 201].includes(status) &&
              containsXSSInText(responseBody)
            ) {
              anomalies.push(
                `[${item.id}] ❌ SYMFONY — payload XSS accepté et reflété dans la réponse`,
              );
            } else {
              cy.log(`✅ [${item.id}] SYMFONY — payload non reflété`);
            }
          },
        );

        // Vérification 2 : exécution JS (alert stub)
        cy.get("@alertStub").then((stub) => {
          if (stub.callCount > 0) {
            anomalies.push(
              `[${item.id}] ❌ EXÉCUTION JS — alert() déclenché sur le formulaire avis`,
            );
          } else {
            cy.log(`✅ [${item.id}] Aucune exécution JS détectée`);
          }
        });

        // Vérification 3 : DOM visible propre (sans les champs de saisie)
        cy.get("body").then(($body) => {
          const $clone = $body.clone();
          $clone.find("input, textarea, select, form").remove();
          const visibleText = $clone[0].textContent || "";

          if (containsXSSInText(visibleText)) {
            anomalies.push(
              `[${item.id}] ❌ DOM AVIS — payload XSS visible dans le texte rendu de la page`,
            );
          } else {
            cy.log(`✅ [${item.id}] DOM propre — payload non reflété`);
          }
        });
      });
    });

    // Assertion finale groupée — un seul throw après les 4 payloads
    cy.then(() => {
      if (anomalies.length > 0) {
        throw new Error(
          `❌ ${anomalies.length} vulnérabilité(s) XSS détectée(s) sur le formulaire avis :\n` +
            anomalies.map((a, i) => `  ${i + 1}. ${a}`).join("\n"),
        );
      }
      cy.log(
        "✅ CAS 4 — Formulaire avis résiste aux 4 payloads XSS — aucune faille détectée",
      );
    });
  });
});
