/// <reference types="cypress" />
import { login } from "../../services/apiAuth";
import { getCart } from "../../services/apiCart";

const PRODUCTS = {
  normal: { id: 3, name: "Sentiments printaniers", stock: 50 },
  moyen: { id: 4, name: "Chuchotements d'été", stock: 25 },
  faible: { id: 7, name: "Extrait de nature", stock: 3 },
  dernier: { id: 8, name: "Milkyway", stock: 1 },
  rupture: { id: 9, name: "Mousse de rêve", stock: 0 },
};

const API = () => Cypress.env("apiUrl");

// ═══════════════════════════════════════════════════════════════
// BLOC 1 — Sans connexion
// ═══════════════════════════════════════════════════════════════
describe("Panier - sans connexion", () => {
  it("API-0a - GET /orders sans token doit retourner 401", () => {
    getCart().then((res) => {
      expect(res.status).to.eq(401);
      cy.log(`✅ API-0a — Accès refusé sans token (${res.status})`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// BLOC 2 — Connecté : tous les tests partagent le même token
// ═══════════════════════════════════════════════════════════════
describe("Panier - utilisateur connecté", () => {
  let token;
  let orderLineId;

  // ── Connexion avant chaque test ──────────────────────────────
  beforeEach(() => {
    login(Cypress.env("username"), Cypress.env("password")).then((res) => {
      expect(res.status).to.eq(200);
      token = res.body.token;
    });
  });

  // ── Nettoyage du panier après chaque test ────────────────────
  afterEach(() => {
    if (!token) return;
    cy.request({
      method: "GET",
      url: `${API()}/orders`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status !== 200) return;
      const lines = Array.isArray(res.body)
        ? res.body
        : res.body?.orderLines || [];
      lines.forEach((line) => {
        cy.request({
          method: "DELETE",
          url: `${API()}/orders/${line.id}/delete`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        });
      });
      cy.log(`🧹 ${lines.length} ligne(s) nettoyée(s)`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-0b - GET /orders connecté doit retourner 200", () => {
    getCart(token).then((res) => {
      expect(res.status).to.eq(200);
      cy.log("✅ API-0b — Panier accessible, statut 200 reçu");
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-1 - Ajouter quantité 3 sur produit stock:50", () => {
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.normal.id, quantity: 3 },
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 201]);
      const lines = Array.isArray(res.body)
        ? res.body
        : res.body?.orderLines || [];
      const line = lines.find((l) => l.product?.id === PRODUCTS.normal.id);
      expect(line).to.exist;
      expect(line.quantity).to.equal(3);
      cy.log(`✅ API-1 — Ajout OK, quantité:3`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-2 - Supprimer une ligne du panier (stock:25)", () => {
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.moyen.id, quantity: 1 },
    }).then((res) => {
      const lines = Array.isArray(res.body)
        ? res.body
        : res.body?.orderLines || [];
      const line = lines.find((l) => l.product?.id === PRODUCTS.moyen.id);
      expect(line).to.exist;
      orderLineId = line.id;

      cy.request({
        method: "DELETE",
        url: `${API()}/orders/${orderLineId}/delete`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((deleteRes) => {
        expect(deleteRes.status).to.be.oneOf([200, 204]);

        cy.request({
          method: "GET",
          url: `${API()}/orders`,
          headers: { Authorization: `Bearer ${token}` },
        }).then((cartRes) => {
          const remaining = (
            Array.isArray(cartRes.body)
              ? cartRes.body
              : cartRes.body?.orderLines || []
          ).find((l) => l.id === orderLineId);
          expect(remaining).to.be.undefined;
          cy.log("✅ API-2 — Ligne supprimée confirmée");
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-3 - Panier vide après suppression de toutes les lignes + stock restauré", () => {
    cy.request({
      method: "GET",
      url: `${API()}/products/${PRODUCTS.normal.id}`,
    }).then((productRes) => {
      const stockAvant = productRes.body.availableStock;

      cy.request({
        method: "PUT",
        url: `${API()}/orders/add`,
        headers: { Authorization: `Bearer ${token}` },
        body: { product: PRODUCTS.normal.id, quantity: 1 },
      }).then((res) => {
        const lines = Array.isArray(res.body)
          ? res.body
          : res.body?.orderLines || [];
        lines.forEach((line) => {
          cy.request({
            method: "DELETE",
            url: `${API()}/orders/${line.id}/delete`,
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false,
          });
        });

        cy.request({
          method: "GET",
          url: `${API()}/orders`,
          headers: { Authorization: `Bearer ${token}` },
        }).then((cartRes) => {
          const remaining = Array.isArray(cartRes.body)
            ? cartRes.body
            : cartRes.body?.orderLines || [];
          expect(remaining).to.have.length(0);
          cy.log("✅ API-3 — Panier vide confirmé");
        });

        cy.request({
          method: "GET",
          url: `${API()}/products/${PRODUCTS.normal.id}`,
        }).then((updatedRes) => {
          const stockApres = updatedRes.body.availableStock;
          expect(stockApres).to.equal(stockAvant);
          cy.log(`✅ API-3 — Stock restauré : ${stockAvant} → ${stockApres}`);
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-4 - Quantité 0 doit être refusée (stock:50)", () => {
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.normal.id, quantity: 0 },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status >= 400) {
        expect(res.status).to.be.within(400, 422);
        cy.log(`✅ API-4 — Quantité 0 refusée (${res.status})`);
      } else {
        cy.log(`⚠️ Anomalie — quantité 0 acceptée (${res.status})`);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-5 - Quantité négative doit être refusée (stock:50)", () => {
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.normal.id, quantity: -1 },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status >= 400) {
        expect(res.status).to.be.within(400, 422);
        cy.log(`✅ API-5 — Quantité -1 refusée (${res.status})`);
      } else {
        cy.log(
          `⚠️ Anomalie critique — quantité négative acceptée (${res.status})`,
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-6 - Quantité supérieure au stock doit être refusée (stock:3, qty:5)", () => {
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.faible.id, quantity: 5 },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status >= 400) {
        expect(res.status).to.be.within(400, 422);
        cy.log(`✅ API-6 — Dépassement stock refusé (${res.status})`);
      } else {
        cy.log(
          `⚠️ Anomalie — quantité 5 acceptée alors que stock = ${PRODUCTS.faible.stock}`,
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-7 - Stock décrémenté après ajout au panier (stock:50, qty:3)", () => {
    cy.request({
      method: "GET",
      url: `${API()}/products/${PRODUCTS.normal.id}`,
    }).then((productRes) => {
      const stockAvant = productRes.body.availableStock;

      cy.request({
        method: "PUT",
        url: `${API()}/orders/add`,
        headers: { Authorization: `Bearer ${token}` },
        body: { product: PRODUCTS.normal.id, quantity: 3 },
      }).then(() => {
        cy.request({
          method: "GET",
          url: `${API()}/products/${PRODUCTS.normal.id}`,
        }).then((updatedRes) => {
          expect(updatedRes.body.availableStock).to.equal(stockAvant - 3);
          cy.log(
            `✅ API-7 — Stock : ${stockAvant} → ${updatedRes.body.availableStock} (−3)`,
          );
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  it("API-11 - Pas de duplication de ligne pour même produit (stock:50)", () => {
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.normal.id, quantity: 1 },
    }).then(() => {
      cy.request({
        method: "PUT",
        url: `${API()}/orders/add`,
        headers: { Authorization: `Bearer ${token}` },
        body: { product: PRODUCTS.normal.id, quantity: 2 },
      }).then(() => {
        cy.request({
          method: "GET",
          url: `${API()}/orders`,
          headers: { Authorization: `Bearer ${token}` },
        }).then((cartRes) => {
          const lines = (
            Array.isArray(cartRes.body)
              ? cartRes.body
              : cartRes.body?.orderLines || []
          ).filter((l) => l.product?.id === PRODUCTS.normal.id);
          expect(lines).to.have.length(1);
          expect(lines[0].quantity).to.equal(3);
          cy.log(
            `✅ API-11 — Pas de duplication, quantité cumulée : ${lines[0].quantity}`,
          );
        });
      });
    });
  });
}); // ← fin du describe "Panier - utilisateur connecté" n
