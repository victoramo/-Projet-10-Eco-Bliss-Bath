import { login } from "../../services/apiAuth";
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

  const signalerAnomalie = (code, message, details = "") => {
    cy.log(`🚨 [${code}] ANOMALIE DÉTECTÉE`);
    cy.log(`📋 ${message}`);
    if (details) cy.log(`🔍 ${details}`);
    throw new Error(`❌ [${code}] ${message}${details ? " | " + details : ""}`);
  };

  // ─────────────────────────────────────────────
  // CAS 1 — Avis satisfait 5 étoiles ✅ (cas passant)
  // ─────────────────────────────────────────────
  it("1 - Avis satisfait 5 étoiles - cas passant", () => {
    // ✅ Données aléatoires Faker
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

        // ✅ Vérification compteur +1
        cy.get("p.number-reviews")
          .invoke("text")
          .then((newText) => {
            const newCount = parseInt(newText);
            cy.log(`📊 Compteur après ajout : ${newCount}`);
            expect(newCount).to.eq(reviewCount + 1);
          });

        cy.get(".average").should("be.visible");

        // ✅ Vérification affichage par contenu Faker unique
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
    // ✅ Données aléatoires Faker
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

        // ✅ Vérification compteur +1
        cy.get("p.number-reviews")
          .invoke("text")
          .then((newText) => {
            const newCount = parseInt(newText);
            cy.log(`📊 Compteur après ajout : ${newCount}`);
            expect(newCount).to.eq(reviewCount + 1);
          });

        // ✅ Vérification affichage par contenu Faker unique
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
    // ⚠️ Données fixes volontaires — contenu haineux à détecter
    const titre = "arnaque";
    const commentaire =
      "Commande non livrée, service nul, je vous emmerde, arnaque totale ! Va crever espèce de voleur.";
    cy.log(`📝 Titre fixe : ${titre}`);
    cy.log(`📝 Commentaire fixe : ${commentaire}`);

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
        cy.get("body").then(($body) => {
          if ($body.find("p.error").length > 0) {
            cy.get("p.error").then(($el) => {
              cy.log(`✅ CAS 3 — Message de blocage affiché : ${$el.text()}`);
            });
          } else {
            signalerAnomalie(
              "ANO-REVIEW-03",
              "DEFECT CRITICAL — Commentaire violent/haineux accepté sans blocage ni alerte",
              "Attendu : message d'erreur ou alerte modération | Observé : aucun retour utilisateur",
            );
          }
        });

        // ✅ Attente 3 secondes puis vérification compteur INCHANGÉ
        cy.wait(3000);
        cy.get("p.number-reviews")
          .invoke("text")
          .then((newText) => {
            const newCount = parseInt(newText);
            cy.log(`📊 Compteur après tentative : ${newCount}`);
            if (newCount > reviewCount) {
              signalerAnomalie(
                "ANO-REVIEW-03B",
                "DEFECT CRITICAL — Commentaire violent publié : compteur a augmenté",
                `Attendu : compteur inchangé (${reviewCount}) | Observé : ${newCount} — signalement admin requis`,
              );
            }
            cy.log(
              `✅ CAS 3 — Compteur inchangé : ${newCount} — commentaire bloqué`,
            );
          });
      });
  });
});
