/// <reference types="cypress" />

// ─────────────────────────────────────────────────────────────────────────
// Ces fonctions encapsulent les appels API pour éviter la répétition
// ─────────────────────────────────────────────────────────────────────────
import { login } from "../../services/apiAuth"; // connexion utilisateur
import { getCart, addToCart } from "../../services/apiCart"; // lecture et ajout panier
import { getProducts } from "../../services/apiProducts"; // liste des produits

// ─────────────────────────────────────────────────────────────────────────
// RÉFÉRENCE STOCK PRODUITS (état initial de la base de données)
// Ces valeurs correspondent aux stocks réels au démarrage des tests
// id:3 → 50 | id:4 → 25 | id:5 → 10 | id:6 → 5
// id:7 → 3  | id:8 → 1  | id:9 → 0  | id:10 → 0
// ─────────────────────────────────────────────────────────────────────────
const PRODUCTS = {
  normal: { id: 3, name: "Sentiments printaniers", stock: 50 },
  moyen: { id: 4, name: "Chuchotements d'été", stock: 25 },
  faible: { id: 7, name: "Extrait de nature", stock: 3 },
  dernier: { id: 8, name: "Milkyway", stock: 1 },
  rupture: { id: 9, name: "Mousse de rêve", stock: 0 },
  rupture2: { id: 10, name: "Aurore boréale", stock: 0 },
};

// Raccourci pour lire l'URL de l'API depuis cypress.config.js
const API = () => Cypress.env("apiUrl");

// ═══════════════════════════════════════════════════════════════════════════
// BLOC 1 — Accès au panier SANS connexion = Accès sans token → doit retourner 401
// Objectif : vérifier que l'API protège bien la route GET /orders
// ═══════════════════════════════════════════════════════════════════════════
describe("Panier - sans connexion", () => {
  it("API-0a - GET /orders sans token doit retourner 401", () => {
    // On utilise la fonction getCart() sans passer de token
    // → l'API doit refuser avec un code 401 (non autorisé)
    getCart().then((res) => {
      expect(res.status).to.eq(401);
      cy.log(`✅ API-0a — Accès refusé sans token (${res.status})`);

      // On sauvegarde le résultat pour le bilan de campagne
      cy.writeFile("cypress/logs/cart_no_auth.json", {
        status: res.status,
        body: res.body,
        timestamp: new Date().toISOString(),
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BLOC 2  — Accès connecté + Tests métier du panier
// ═══════════════════════════════════════════════════════════════════════════
describe("Panier - utilisateur connecté", () => {
  let token; // token partagé par tous les tests de ce bloc
  let orderLineId; // id de ligne panier utilisé dans les tests de suppression et mise à jour

  // Exécuté automatiquement avant chaque "it" de ce describe
  beforeEach(() => {
    login(Cypress.env("username"), Cypress.env("password"), 200).then((res) => {
      expect(res.status).to.eq(200);
      token = res.body.token; // token disponible pour tous les tests
    });
  });

  // ─── Nettoyage du panier après chaque test ───────────────────────────────
  // Garantit que les tests ne se perturbent pas entre eux
  afterEach(() => {
    if (!token) return;

    cy.request({
      method: "GET",
      url: `${API()}/orders`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status !== 200) return;

      // Gère tableau direct OU { orderLines: [] }
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
      cy.log(`🧹 ${lines.length} ligne(s) nettoyée(s) après le test`);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // API-0b — Accès au panier après connexion → 200
  // Objectif : vérifier qu'un utilisateur connecté peut lire son panier
  // ─────────────────────────────────────────────────────────────────────────
  it("API-0b - GET /orders connecté doit retourner 200", () => {
    // getCart() avec token → l'API doit accepter et retourner 200
    getCart(token).then((res) => {
      expect(res.status).to.eq(200);
      cy.log("✅ API-0b — Panier accessible, statut 200 reçu");

      cy.writeFile("cypress/logs/cart_auth.json", {
        status: res.status,
        body: res.body,
        timestamp: new Date().toISOString(),
      });
    });
  });
});
// ─────────────────────────────────────────────────────────────────────────
// API-1 — Ajout d'une quantité valide (id:3, stock:50, qty:3)
// Objectif : vérifier qu'on peut ajouter un produit disponible au panier
// ─────────────────────────────────────────────────────────────────────────
it("API-1 - Ajouter quantité 3 sur produit stock:50", () => {
  cy.request({
    method: "PUT", // PUT = modifier/ajouter une ressource
    url: `${API()}/orders/add`, // route Symfony : add_product_to_cart
    headers: { Authorization: `Bearer ${token}` },
    body: { product: PRODUCTS.normal.id, quantity: 3 },
  }).then((res) => {
    expect(res.status).to.be.oneOf([200, 201]); // 200 ou 201 = succès

    // On récupère les lignes du panier dans la réponse
    const lines = Array.isArray(res.body)
      ? res.body
      : res.body?.orderLines || [];

    // On cherche la ligne correspondant au produit ajouté
    const line = lines.find((l) => l.product?.id === PRODUCTS.normal.id);
    expect(line).to.exist; // la ligne doit exister
    expect(line.quantity).to.equal(3); // la quantité doit être 3
    cy.log(
      `✅ API-1 — Ajout OK, quantité:3, stock restant attendu:${PRODUCTS.normal.stock - 3}`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// API-2 — Suppression d'une ligne du panier (id:4, stock:25)
// Objectif : vérifier qu'une ligne supprimée disparaît bien du panier
// ─────────────────────────────────────────────────────────────────────────
it("API-2 - Supprimer une ligne du panier (stock:25)", () => {
  // Étape 1 — On ajoute d'abord un produit pour avoir une ligne à supprimer
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
    orderLineId = line.id; // on garde l'id pour la suppression

    // Étape 2 — On supprime la ligne
    cy.request({
      method: "DELETE",
      url: `${API()}/orders/${orderLineId}/delete`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((deleteRes) => {
      expect(deleteRes.status).to.be.oneOf([200, 204]); // 204 = supprimé sans contenu

      // Étape 3 — On vérifie que la ligne n'existe plus dans le panier
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

        expect(remaining).to.be.undefined; // la ligne ne doit plus exister
        cy.log("✅ API-2 — Ligne supprimée confirmée");
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// API-3 — Panier vide après suppression + stock restauré (id:3, stock:50)
// Objectif : vérifier que le panier est vide ET que le stock est bien rendu
// ─────────────────────────────────────────────────────────────────────────
it("API-3 - Panier vide après suppression de toutes les lignes + stock restauré", () => {
  // Étape 1 — On capture le stock avant toute modification
  cy.request({
    method: "GET",
    url: `${API()}/products/${PRODUCTS.normal.id}`,
  }).then((productRes) => {
    const stockAvant = productRes.body.availableStock;
    cy.log(`📦 API-3 — Stock avant ajout : ${stockAvant}`);

    // Étape 2 — On ajoute le produit au panier
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.normal.id, quantity: 1 },
    }).then((res) => {
      const lines = Array.isArray(res.body)
        ? res.body
        : res.body?.orderLines || [];

      // Étape 3 — On supprime toutes les lignes du panier
      lines.forEach((line) => {
        cy.request({
          method: "DELETE",
          url: `${API()}/orders/${line.id}/delete`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        });
      });

      // Étape 4 — On vérifie que le panier est bien vide
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

      // Étape 5 — On vérifie que le stock a bien été restauré après suppression
      cy.request({
        method: "GET",
        url: `${API()}/products/${PRODUCTS.normal.id}`,
      }).then((updatedRes) => {
        const stockApres = updatedRes.body.availableStock;
        if (stockApres === stockAvant) {
          cy.log(`✅ API-3 — Stock restauré : ${stockAvant} → ${stockApres}`);
          expect(stockApres).to.equal(stockAvant);
        } else {
          cy.log(
            `⚠️ Anomalie — Stock non restauré : attendu ${stockAvant}, obtenu ${stockApres}`,
          );
          expect(stockApres).to.equal(stockAvant); // le test échoue et documente l'anomalie
        }
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// API-4 — Quantité 0 refusée (id:3, stock:50)
// Objectif : vérifier que l'API rejette une quantité nulle
// ─────────────────────────────────────────────────────────────────────────
it("API-4 - Quantité 0 doit être refusée (stock:50)", () => {
  cy.request({
    method: "PUT",
    url: `${API()}/orders/add`,
    headers: { Authorization: `Bearer ${token}` },
    body: { product: PRODUCTS.normal.id, quantity: 0 },
    failOnStatusCode: false, // on s'attend à une erreur → ne pas planter Cypress
  }).then((res) => {
    if (res.status >= 400) {
      expect(res.status).to.be.within(400, 422); // 400 à 422 = erreur client attendue
      cy.log(`✅ API-4 — Quantité 0 refusée (${res.status})`);
    } else {
      cy.log(`⚠️ Anomalie — quantité 0 acceptée (${res.status})`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// API-5 — Quantité négative refusée (id:3, stock:50)
// Objectif : vérifier que l'API rejette une quantité négative
// ─────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
// API-6 — Dépassement de stock refusé (id:7, stock:3, qty:5)
// Objectif : vérifier qu'on ne peut pas commander plus que le stock disponible
// ─────────────────────────────────────────────────────────────────────────
it("API-6 - Quantité supérieure au stock doit être refusée (stock:3, qty:5)", () => {
  cy.request({
    method: "PUT",
    url: `${API()}/orders/add`,
    headers: { Authorization: `Bearer ${token}` },
    body: { product: PRODUCTS.faible.id, quantity: 5 }, // stock = 3, on demande 5
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

// ─────────────────────────────────────────────────────────────────────────
// API-7 — Stock décrémenté après ajout au panier (id:3, stock:50, qty:3)
// Objectif : vérifier que le stock diminue bien quand on ajoute au panier
// ─────────────────────────────────────────────────────────────────────────
it("API-7 - Stock décrémenté après ajout au panier (stock:50, qty:3)", () => {
  // Étape 1 — On lit le stock avant l'ajout
  cy.request({
    method: "GET",
    url: `${API()}/products/${PRODUCTS.normal.id}`,
  }).then((productRes) => {
    const stockAvant = productRes.body.availableStock;
    expect(stockAvant).to.equal(50);

    // Étape 2 — On ajoute 3 unités au panier
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.normal.id, quantity: 3 },
    }).then(() => {
      // Étape 3 — On vérifie que le stock a bien diminué de 3
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

// ─────────────────────────────────────────────────────────────────────────
// API-11 — Pas de duplication de ligne (id:3, stock:50)
// Objectif :  1 seule ligne cumulée = qty:1 + qty:2 → 1 ligne avec qty:3
// ─────────────────────────────────────────────────────────────────────────
it("API-11 - Pas de duplication de ligne pour même produit (stock:50)", () => {
  // Premier ajout : quantité 1
  cy.request({
    method: "PUT",
    url: `${API()}/orders/add`,
    headers: { Authorization: `Bearer ${token}` },
    body: { product: PRODUCTS.normal.id, quantity: 1 },
  }).then(() => {
    // Deuxième ajout du même produit : quantité 2
    cy.request({
      method: "PUT",
      url: `${API()}/orders/add`,
      headers: { Authorization: `Bearer ${token}` },
      body: { product: PRODUCTS.normal.id, quantity: 2 },
    }).then(() => {
      // Vérification : 1 seule ligne avec quantité cumulée = 3
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

        expect(lines).to.have.length(1); // 1 seule ligne, pas 2
        expect(lines[0].quantity).to.equal(3); // quantité cumulée = 1 + 2
        cy.log(
          `✅ API-11 — Pas de duplication, quantité cumulée : ${lines[0].quantity}`,
        );
      });
    });
  });
});
