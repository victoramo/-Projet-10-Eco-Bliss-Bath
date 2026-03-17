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

// Logue et fait échouer le test avec le code anomalie et le détail
const anomalie = (code, message, details = "") => {
  cy.log(`🚨 [${code}] ${message}`);
  if (details) cy.log(`🔍 ${details}`);
  throw new Error(`❌ [${code}] ${message}${details ? " | " + details : ""}`);
};

// ═══════════════════════════════════════════════════════════════
// BLOC 1 — Accès panier sans authentification
// ═══════════════════════════════════════════════════════════════
describe("Panier - sans connexion", () => {
  // Vérifie que l'API rejette toute requête sans token
  it("API-0a - GET /orders sans token doit retourner 401", () => {
    getCart().then((res) => {
      if (res.status !== 401) {
        anomalie(
          "ANO-CART-0a",
          "DEFECT HIGH — Accès /orders autorisé sans token",
          `Attendu : 401 | Observé : ${res.status}`,
        );
      }
      cy.log(`✅ API-0a — Accès refusé sans token (${res.status})`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// BLOC 2 — Opérations panier avec utilisateur connecté
// ═══════════════════════════════════════════════════════════════
describe("Panier - utilisateur connecté", () => {
  let token;
  let orderLineId;

  // Authentification avant chaque test — récupère le token JWT
  beforeEach(() => {
    login(Cypress.env("username"), Cypress.env("password")).then((res) => {
      if (res.status !== 200) {
        anomalie(
          "ANO-AUTH-LOGIN",
          "DEFECT CRITICAL — Connexion échouée en beforeEach",
          `Attendu : 200 | Observé : ${res.status}`,
        );
      }
      token = res.body.token;
    });
  });

  // Supprime toutes les lignes du panier après chaque test pour isoler les cas
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

  // Vérifie que le panier est accessible avec un token valide
  it("API-0b - GET /orders connecté doit retourner 200", () => {
    getCart(token).then((res) => {
      if (res.status !== 200) {
        anomalie(
          "ANO-CART-0b",
          "DEFECT HIGH — Panier inaccessible avec token valide",
          `Attendu : 200 | Observé : ${res.status}`,
        );
      }
      cy.log(`✅ API-0b — Panier accessible (${res.status})`);
    });
  });

  // Vérifie qu'un produit est ajouté au panier avec la bonne quantité
  it("API-1 - Ajouter quantité 3 sur produit stock:50", () => {
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.normal.id, quantity: 3 },
    }).then((res) => {
      if (![200, 201].includes(res.status)) {
        anomalie(
          "ANO-CART-01",
          "DEFECT HIGH — Ajout au panier refusé",
          `Attendu : 200 ou 201 | Observé : ${res.status}`,
        );
      }
      const lines = Array.isArray(res.body)
        ? res.body
        : res.body?.orderLines || [];
      const line = lines.find((l) => l.product?.id === PRODUCTS.normal.id);
      if (!line) {
        anomalie(
          "ANO-CART-01",
          "DEFECT HIGH — Ligne produit absente du panier après ajout",
          `Produit attendu : id=${PRODUCTS.normal.id}`,
        );
      }
      if (line.quantity !== 3) {
        anomalie(
          "ANO-CART-01",
          "DEFECT MEDIUM — Quantité incorrecte après ajout",
          `Attendu : 3 | Observé : ${line.quantity}`,
        );
      }
      cy.log(`✅ API-1 — Ajout OK, quantité : ${line.quantity}`);
    });
  });

  // Vérifie qu'une ligne peut être supprimée et qu'elle disparaît du panier
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
      if (!line) {
        anomalie(
          "ANO-CART-02",
          "DEFECT HIGH — Ligne introuvable avant suppression",
          `Produit attendu : id=${PRODUCTS.moyen.id}`,
        );
      }
      orderLineId = line.id;
      cy.request({
        method: "DELETE",
        url: `${API()}/orders/${orderLineId}/delete`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((deleteRes) => {
        if (![200, 204].includes(deleteRes.status)) {
          anomalie(
            "ANO-CART-02",
            "DEFECT HIGH — Suppression de ligne refusée",
            `Attendu : 200 ou 204 | Observé : ${deleteRes.status}`,
          );
        }
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
          if (remaining) {
            anomalie(
              "ANO-CART-02",
              "DEFECT HIGH — Ligne toujours présente après suppression",
              `id ligne : ${orderLineId}`,
            );
          }
          cy.log(`✅ API-2 — Ligne ${orderLineId} supprimée confirmée`);
        });
      });
    });
  });

  // Vérifie que le panier est vide et le stock restauré après suppression totale
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
          if (remaining.length !== 0) {
            anomalie(
              "ANO-CART-03",
              "DEFECT HIGH — Panier non vide après suppression totale",
              `Attendu : 0 ligne | Observé : ${remaining.length} ligne(s)`,
            );
          }
          cy.log("✅ API-3 — Panier vide confirmé");
        });
        cy.request({
          method: "GET",
          url: `${API()}/products/${PRODUCTS.normal.id}`,
        }).then((updatedRes) => {
          const stockApres = updatedRes.body.availableStock;
          if (stockApres !== stockAvant) {
            anomalie(
              "ANO-CART-03",
              "DEFECT HIGH — Stock non restauré après suppression du panier",
              `Attendu : ${stockAvant} | Observé : ${stockApres}`,
            );
          }
          cy.log(`✅ API-3 — Stock restauré : ${stockAvant} → ${stockApres}`);
        });
      });
    });
  });

  // Vérifie que l'API refuse quantité 0 et que le stock reste intact
  it("API-4 - Quantité 0 doit être refusée (stock:50)", () => {
    cy.request({
      method: "GET",
      url: `${API()}/products/${PRODUCTS.normal.id}`,
    }).then((before) => {
      const stockAvant = before.body.availableStock;
      cy.request({
        method: "PUT",
        url: `${API()}/orders/add`,
        headers: { Authorization: `Bearer ${token}` },
        body: { product: PRODUCTS.normal.id, quantity: 0 },
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status < 400) {
          anomalie(
            "ANO-CART-04",
            "DEFECT HIGH — Quantité 0 acceptée par l'API",
            `Attendu : 400-422 | Observé : ${res.status}`,
          );
        }
        cy.request({
          method: "GET",
          url: `${API()}/products/${PRODUCTS.normal.id}`,
        }).then((after) => {
          if (after.body.availableStock !== stockAvant) {
            anomalie(
              "ANO-CART-04",
              "DEFECT HIGH — Stock altéré malgré quantité 0",
              `Attendu : ${stockAvant} | Observé : ${after.body.availableStock}`,
            );
          }
          cy.log(`✅ API-4 — Quantité 0 refusée, stock intact (${stockAvant})`);
        });
      });
    });
  });

  // Vérifie que l'API refuse une quantité négative et que le stock reste intact
  it("API-5 - Quantité négative doit être refusée (stock:50)", () => {
    cy.request({
      method: "GET",
      url: `${API()}/products/${PRODUCTS.normal.id}`,
    }).then((before) => {
      const stockAvant = before.body.availableStock;
      cy.request({
        method: "PUT",
        url: `${API()}/orders/add`,
        headers: { Authorization: `Bearer ${token}` },
        body: { product: PRODUCTS.normal.id, quantity: -1 },
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status < 400) {
          anomalie(
            "ANO-CART-05",
            "DEFECT CRITICAL — Quantité négative acceptée par l'API",
            `Attendu : 400-422 | Observé : ${res.status}`,
          );
        }
        cy.request({
          method: "GET",
          url: `${API()}/products/${PRODUCTS.normal.id}`,
        }).then((after) => {
          if (after.body.availableStock !== stockAvant) {
            anomalie(
              "ANO-CART-05",
              "DEFECT CRITICAL — Stock altéré malgré quantité négative",
              `Attendu : ${stockAvant} | Observé : ${after.body.availableStock}`,
            );
          }
          cy.log(
            `✅ API-5 — Quantité -1 refusée, stock intact (${stockAvant})`,
          );
        });
      });
    });
  });

  // Vérifie que l'API refuse un dépassement de stock et que le stock ne passe pas en négatif
  it("API-6 - Quantité supérieure au stock doit être refusée (stock:3, qty:5)", () => {
    cy.request({
      method: "GET",
      url: `${API()}/products/${PRODUCTS.faible.id}`,
    }).then((before) => {
      const stockAvant = before.body.availableStock;
      cy.request({
        method: "PUT",
        url: `${API()}/orders/add`,
        headers: { Authorization: `Bearer ${token}` },
        body: { product: PRODUCTS.faible.id, quantity: 5 },
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status < 400) {
          anomalie(
            "ANO-CART-06",
            "DEFECT HIGH — Dépassement de stock accepté par l'API",
            `Stock disponible : ${stockAvant} | Quantité demandée : 5 | Statut reçu : ${res.status}`,
          );
        }
        cy.request({
          method: "GET",
          url: `${API()}/products/${PRODUCTS.faible.id}`,
        }).then((after) => {
          if (after.body.availableStock < 0) {
            anomalie(
              "ANO-CART-06",
              "DEFECT CRITICAL — Stock passé en négatif après dépassement",
              `Attendu : ≥ 0 | Observé : ${after.body.availableStock}`,
            );
          }
          if (after.body.availableStock !== stockAvant) {
            anomalie(
              "ANO-CART-06",
              "DEFECT HIGH — Stock altéré malgré refus de dépassement",
              `Attendu : ${stockAvant} | Observé : ${after.body.availableStock}`,
            );
          }
          cy.log(
            `✅ API-6 — Dépassement refusé, stock intact (${after.body.availableStock})`,
          );
        });
      });
    });
  });

  // Vérifie que le stock est bien décrémenté du bon montant après ajout au panier
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
          const stockApres = updatedRes.body.availableStock;
          if (stockApres !== stockAvant - 3) {
            anomalie(
              "ANO-CART-07",
              "DEFECT HIGH — Stock non décrémenté correctement après ajout",
              `Attendu : ${stockAvant - 3} | Observé : ${stockApres}`,
            );
          }
          cy.log(`✅ API-7 — Stock : ${stockAvant} → ${stockApres} (−3)`);
        });
      });
    });
  });

  // Vérifie que l'API refuse une quantité > 20 et que le stock reste intact
  it("API-8 - Quantité > 20 doit être refusée (stock:50, qty:21)", () => {
    cy.request({
      method: "GET",
      url: `${API()}/products/${PRODUCTS.normal.id}`,
    }).then((before) => {
      const stockAvant = before.body.availableStock;
      cy.request({
        method: "PUT",
        url: `${API()}/orders/add`,
        headers: { Authorization: `Bearer ${token}` },
        body: { product: PRODUCTS.normal.id, quantity: 21 },
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status < 400) {
          anomalie(
            "ANO-CART-08",
            "DEFECT HIGH — Quantité 21 acceptée sans limite par l'API",
            `Attendu : 400-422 | Observé : ${res.status}`,
          );
        }
        cy.request({
          method: "GET",
          url: `${API()}/products/${PRODUCTS.normal.id}`,
        }).then((after) => {
          if (after.body.availableStock < 0) {
            anomalie(
              "ANO-CART-08",
              "DEFECT CRITICAL — Stock passé en négatif après qty:21",
              `Attendu : ≥ 0 | Observé : ${after.body.availableStock}`,
            );
          }
          if (after.body.availableStock !== stockAvant) {
            anomalie(
              "ANO-CART-08",
              "DEFECT HIGH — Stock altéré malgré refus de qty:21",
              `Attendu : ${stockAvant} | Observé : ${after.body.availableStock}`,
            );
          }
          cy.log(
            `✅ API-8 — Quantité 21 refusée, stock intact (${after.body.availableStock})`,
          );
        });
      });
    });
  });

  // Vérifie qu'ajouter deux fois le même produit cumule la quantité sans dupliquer la ligne
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
          if (lines.length !== 1) {
            anomalie(
              "ANO-CART-11",
              "DEFECT HIGH — Duplication de ligne détectée pour le même produit",
              `Attendu : 1 ligne | Observé : ${lines.length} ligne(s)`,
            );
          }
          if (lines[0].quantity !== 3) {
            anomalie(
              "ANO-CART-11",
              "DEFECT MEDIUM — Quantité cumulée incorrecte",
              `Attendu : 3 | Observé : ${lines[0].quantity}`,
            );
          }
          cy.log(
            `✅ API-11 — Pas de duplication, quantité cumulée : ${lines[0].quantity}`,
          );
        });
      });
    });
  });
});
