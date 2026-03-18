import { login } from "../../services/apiAuth";
import { addReview } from "../../services/apiReviews";

describe("API - Tests sur les avis (Reviews)", () => {
  let authToken;

  beforeEach(() => {
    login("test2@test.fr", "testtest", 200).then((response) => {
      authToken = response.body.token; // ✅ fix : était Cypress.env("authToken")
    });
  });

  // ─────────────────────────────────────────────
  // GET — Liste des avis
  // ─────────────────────────────────────────────
  it("1 - GET /reviews - retourne la liste des avis", () => {
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/reviews`,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an("array");
      expect(response.body.length).to.be.greaterThan(0);
    });
  });

  // ─────────────────────────────────────────────
  // CAS 1 — Avis satisfait 5 étoiles ✅ (correspond UI cas 1)
  // ─────────────────────────────────────────────
  it("2 - POST /reviews - avis satisfait 5 étoiles accepté", () => {
    addReview(
      authToken,
      "savon doux",
      "Texture incroyable, parfum délicieux, et aucune réaction malgré ma peau sensible. J'en suis vraiment ravie.",
      5,
    ).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("title", "savon doux");
      expect(response.body).to.have.property("rating", 5);
    });
  });

  // ─────────────────────────────────────────────
  // CAS 2 — Avis médiocre 2 étoiles ⚠️ (correspond UI cas 2)
  // ─────────────────────────────────────────────
  it("3 - POST /reviews - avis médiocre 2 étoiles accepté", () => {
    addReview(authToken, "Déçu", "qualite prix au dessus du marche", 2).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property("rating", 2);
      },
    );
  });

  // ─────────────────────────────────────────────
  // CAS 3 — Commentaire violent 0 étoile ❌ (correspond UI cas 3)
  // ─────────────────────────────────────────────
  it("4 - POST /reviews - commentaire violent doit être refusé", () => {
    addReview(
      authToken,
      "arnaque",
      "Commande non livrée, service nul, je vous emmerde, arnaque totale, vous allez tous étre tuer !",
      0,
    ).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body).to.have.property("error");
    
      // ── Anomalie mineure : message d'erreur vide ──────────────────
      cy.log(`⚠️ error vide : ${JSON.stringify(response.body.error)}`);
      cy.log("✅ Contenu haineux + note 0 correctement rejeté par le backend");
    });
  });

  // ─────────────────────────────────────────────
  // Champs manquants ❌
  // ─────────────────────────────────────────────
  it("5 - POST /reviews - commentaire vide est refusé", () => {
    addReview(authToken, "chouette", "", 2).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body).to.have.property("error");
    });
  });

  // ─────────────────────────────────────────────
  // payload XSS ❌: une balise script qui tenterait d'exécuter du JavaScript
  //                  dans le navigateur si elle n'est pas filtrée.
  // ─────────────────────────────────────────────
  it("6 - POST /reviews - faille XSS doit être bloquée", () => {
    const testXSS = `<script>alert("XSS");</script>`;

    addReview(authToken, "test XSS", testXSS, 5).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body).to.have.property("error");
    });
  });
});
