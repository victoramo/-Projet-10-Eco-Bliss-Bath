/// <reference types="cypress" />

import { selectors } from "../../support/selectors";

const USER = {
  username: "ramoshippuden@gmail.com",
  password: "testtest",
};

const PRODUCTS = {
  normal: { id: 3, name: "Sentiments printaniers" },
  moyen: { id: 4, name: "Chuchotements d'été" },
  faible: { id: 7, name: "Extrait de nature" },
  dernier: { id: 8, name: "Milkyway" },
  rupture: { id: 9, name: "Mousse de rêve" },
  ru: { id: 10, name: "Aurore boréale" },
};

// Sélecteurs complémentaires non présents dans support/selectors.js
const DOM = {
  cartApp: "app-cart",
  productContent: "#product-content",
};

function signalerAnomalie(code, message, details = "") {
  cy.log(`🚨 [${code}] ANOMALIE DÉTECTÉE`);
  cy.log(`📋 ${message}`);
  if (details) {
    cy.log(`🔍 ${details}`);
  }
  throw new Error(`❌ [${code}] ${message}${details ? ` | ${details}` : ""}`);
}

function loginUi() {
  cy.visit("/#/login");

  cy.get(selectors.usernameField)
    .should("be.visible")
    .clear()
    .type(USER.username);

  cy.get(selectors.passwordField)
    .should("be.visible")
    .clear()
    .type(USER.password, { log: false });

  cy.get(selectors.submitButton).should("be.visible").click();

  cy.url().should("not.include", "/login");
  cy.get(selectors.logoutButton).should("be.visible");
}

function getAuthToken() {
  return cy
    .request("POST", `${Cypress.env("apiUrl")}/login`, USER)
    .its("body.token")
    .should("be.a", "string");
}

function viderPanierApi() {
  return getAuthToken().then((token) => {
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/orders`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then((ordersResp) => {
      if (ordersResp.status !== 200 || !ordersResp.body) {
        cy.log("🧹 Aucune commande exploitable trouvée");
        return;
      }

      const orders = Array.isArray(ordersResp.body)
        ? ordersResp.body
        : [ordersResp.body];

      const currentOrder = orders.find(
        (o) => o?.status === "cart" || (o?.orderLines ?? []).length > 0,
      );

      const lines = currentOrder?.orderLines ?? [];

      if (!lines.length) {
        cy.log("🧹 Panier déjà vide");
        return;
      }

      cy.wrap(lines).each((line) => {
        cy.request({
          method: "DELETE",
          url: `${Cypress.env("apiUrl")}/orders/${line.id}/delete`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        })
          .its("status")
          .should("be.oneOf", [200, 204]);
      });
    });
  });
}

function ouvrirListeProduits() {
  cy.intercept("GET", "**/products*").as("getProducts");
  cy.visit("/#/products");
  cy.wait("@getProducts").its("response.statusCode").should("eq", 200);
  cy.get(selectors.product).should("have.length.greaterThan", 0);
}

function allerVersPageProduitParNom(productName) {
  ouvrirListeProduits();

  cy.contains(selectors.product, productName)
    .should("be.visible")
    .within(() => {
      cy.get(selectors.productLink).click();
    });

  cy.get(DOM.productContent).should("be.visible");
  cy.get(selectors.productStock).should("be.visible");
  cy.get(selectors.productName).should("contain", productName);
}

function saisirQuantite(value) {
  cy.get(selectors.quantityInput)
    .should("be.visible")
    .clear()
    .type(String(value))
    .should("have.value", String(value));
}

function ajouterAuPanierEtAttendre(alias = "addToCart") {
  cy.intercept("PUT", "**/orders/add").as(alias);
  cy.get(selectors.addToCartButton).should("be.visible").click();
  return cy.wait(`@${alias}`);
}

function lireStockProduit(productId) {
  return cy
    .request("GET", `${Cypress.env("apiUrl")}/products/${productId}`)
    .its("body.availableStock");
}

function lireStockProduitUI() {
  return cy
    .get(selectors.productStock)
    .invoke("text")
    .then((text) => {
      const stock = Number(text.match(/-?\d+/)?.[0]);
      expect(stock, `Stock illisible depuis : "${text}"`).to.not.be.NaN;
      return stock;
    });
}

function allerVersPanier() {
  cy.visit("/#/cart");
  cy.url().should("include", "/cart");
  cy.get("body").should("be.visible");
  cy.get(DOM.cartApp).should("be.visible");
}

function supprimerToutesLesLignesDuPanierUI() {
  cy.intercept("DELETE", "**/orders/**/delete").as("deleteLine");

  cy.get("body").then(($body) => {
    const totalBoutons = $body.find(selectors.cartLineDelete).length;

    if (totalBoutons === 0) {
      cy.log("🧹 Panier déjà vide côté UI");
      return;
    }

    function supprimerUneLigne() {
      cy.get("body").then(($currentBody) => {
        const total = $currentBody.find(selectors.cartLineDelete).length;

        if (total === 0) {
          return;
        }

        cy.get(selectors.cartLineDelete).first().click({ force: true });

        cy.wait("@deleteLine")
          .its("response.statusCode")
          .should("be.oneOf", [200, 204]);

        supprimerUneLigne();
      });
    }

    supprimerUneLigne();
  });
}

describe("Panier - Tests UI stabilisés", () => {
  beforeEach(() => {
    cy.visit("/");

    // Si une ancienne session UI existe encore, on se déconnecte proprement
    cy.get("body").then(($body) => {
      if ($body.find(selectors.logoutButton).length > 0) {
        cy.get(selectors.logoutButton).click();
      }
    });

    // Reconnexion UI fraîche pour chaque test
    loginUi();

    // Pré-condition technique : panier vide
    viderPanierApi();

    // Retour page d'accueil après préparation
    cy.visit("/");
  });
  // ════════════════════════════════════════════════════════════════════════
  // TEST 1 — Ajouter un produit au panier avec quantité 3
  // ════════════════════════════════════════════════════════════════════════
  it("1 - Ajouter un produit au panier avec quantité 3", () => {
    allerVersPageProduitParNom(PRODUCTS.normal.name);
    saisirQuantite(3);

    ajouterAuPanierEtAttendre("addCartTest1")
      .its("response.statusCode")
      .should("eq", 200);

    cy.url().should("include", "/cart");
    cy.get(DOM.cartApp).should("be.visible");
    cy.get(selectors.cartLine).should("have.length.at.least", 1);

    cy.log("✅ TEST 1 — Produit ajouté avec quantité 3");
  });

  // ════════════════════════════════════════════════════════════════════════
  // TEST 2 — Ajouter 2 produits différents puis vider le panier
  // ════════════════════════════════════════════════════════════════════════
  it("2 - Ajouter 2 produits différents puis vider le panier", () => {
    // Étape 1 : ouvrir le produit 1 et mémoriser son stock
    allerVersPageProduitParNom(PRODUCTS.normal.name);
    lireStockProduitUI().then((stock) => {
      cy.wrap(stock).as("stockProduit1");
    });

    saisirQuantite(1);

    ajouterAuPanierEtAttendre("addCart1")
      .its("response.statusCode")
      .should("eq", 200);

    // Étape 2 : ouvrir le produit 2 et mémoriser son stock
    ouvrirListeProduits();

    cy.contains(selectors.product, PRODUCTS.moyen.name)
      .should("be.visible")
      .within(() => {
        cy.get(selectors.productLink).click();
      });

    cy.get(DOM.productContent).should("be.visible");
    cy.get(selectors.productStock).should("be.visible");
    cy.get(selectors.productName).should("contain", PRODUCTS.moyen.name);

    lireStockProduitUI().then((stock) => {
      cy.wrap(stock).as("stockProduit2");
    });

    saisirQuantite(1);

    ajouterAuPanierEtAttendre("addCart2")
      .its("response.statusCode")
      .should("eq", 200);

    // Étape 3 : vérifier la présence des 2 produits dans le panier
    cy.url().should("include", "/cart");
    cy.get(DOM.cartApp).should("be.visible");
    cy.get(selectors.cartLine).should("have.length.at.least", 2);

    cy.contains(selectors.cartLine, PRODUCTS.normal.name).should("be.visible");
    cy.contains(selectors.cartLine, PRODUCTS.moyen.name).should("be.visible");

    cy.log("✅ ÉTAPE 3 — Les 2 produits sont bien présents dans le panier");

    // Étape 4 : supprimer toutes les lignes du panier via l'UI
    supprimerToutesLesLignesDuPanierUI();

    // Étape 5 : vérifier le message panier vide
    cy.get(DOM.cartApp).should("be.visible");
    cy.contains("h1", "Commande").should("be.visible");
    cy.contains("h2", "Panier").should("be.visible");
    cy.contains(/votre panier est vide/i).should("be.visible");
    cy.contains("a", "Consultez nos produits").should("be.visible");

    cy.log("✅ ÉTAPE 5 — Panier vide confirmé");

    // Étape 6 : retour vers les produits
    cy.intercept("GET", "**/products*").as("getProductsFinal");
    cy.contains("a", "Consultez nos produits").click();

    cy.wait("@getProductsFinal").its("response.statusCode").should("eq", 200);

    cy.url().should("include", "/products");
    cy.get(selectors.product).should("have.length.greaterThan", 0);

    // Étape 7 : vérifier le stock du produit 1
    allerVersPageProduitParNom(PRODUCTS.normal.name);
    cy.get("@stockProduit1").then((stockInitial1) => {
      lireStockProduitUI().then((stockActuel1) => {
        expect(stockActuel1).to.eq(stockInitial1);
      });
    });

    // Étape 8 : vérifier le stock du produit 2
    allerVersPageProduitParNom(PRODUCTS.moyen.name);
    cy.get("@stockProduit2").then((stockInitial2) => {
      lireStockProduitUI().then((stockActuel2) => {
        expect(stockActuel2).to.eq(stockInitial2);
      });
    });

    cy.log("✅ TEST 2 — Retour produits et stocks remis à jour confirmés");
  });

  // ─── TEST 4 — Quantité 0 refusée ───────────────────────────────────────
  it("4 - Ajouter au panier avec quantité 0 doit être refusé", () => {
    allerVersPageProduitParNom(PRODUCTS.normal.name);
    saisirQuantite(0);

    ajouterAuPanierEtAttendre("addQtyZero").then(({ response }) => {
      const status = response?.statusCode;

      if (status === 200) {
        signalerAnomalie(
          "ANO-BACK-01",
          "DEFECT HIGH — qty=0 acceptée par le système",
          "Attendu : ajout refusé | Observé : HTTP 200",
        );
      }

      expect(status).to.be.oneOf([400, 401, 403, 409, 422]);
    });

    cy.url().should("not.include", "/cart");
    cy.log("✅ TEST 4 — qty=0 refusée");
  });

  // ─── TEST 6 — quantité > stock refusée ─────────────────────────────────
  it("6 - Quantité supérieure au stock disponible doit être refusée", () => {
    allerVersPageProduitParNom(PRODUCTS.faible.name);

    lireStockProduitUI().then((stockAvant) => {
      const quantiteTropGrande = stockAvant + 2;

      saisirQuantite(quantiteTropGrande);

      ajouterAuPanierEtAttendre("addTooMuch").then(({ response }) => {
        const status = response?.statusCode;

        if (status === 200) {
          lireStockProduit(PRODUCTS.faible.id).then((stockApres) => {
            signalerAnomalie(
              "ANO-BACK-02",
              "DEFECT HIGH — quantité supérieure au stock acceptée",
              `Attendu : ajout refusé | Observé : HTTP 200 | Stock avant = ${stockAvant} | Stock après = ${stockApres}`,
            );
          });
          return;
        }

        expect(status).to.be.oneOf([400, 401, 403, 409, 422]);
      });

      cy.url().should("not.include", "/cart");
      cy.log("✅ TEST 6 — quantité supérieure au stock refusée");
    });
  });

  // ─── TEST 7 — rupture de stock ──────────────────────────────────────────
  it("7 - Produit en rupture de stock ne peut pas être ajouté au panier", () => {
    allerVersPageProduitParNom(PRODUCTS.rupture.name);

    cy.get("body").then(($body) => {
      const boutonExiste = $body.find(selectors.addToCartButton).length > 0;

      if (!boutonExiste) {
        cy.log("✅ TEST 7 — Bouton absent pour produit en rupture");
        return;
      }

      cy.get(selectors.addToCartButton).then(($btn) => {
        if ($btn.is(":disabled")) {
          cy.log("✅ TEST 7 — Bouton désactivé pour produit en rupture");
          return;
        }

        cy.wrap($btn).click();

        lireStockProduit(PRODUCTS.rupture.id).then((stock) => {
          signalerAnomalie(
            "ANO-BACK-03",
            "DEFECT HIGH — produit en rupture toujours ajoutable",
            `Attendu : bouton absent ou désactivé | Observé : bouton actif, stock = ${stock}`,
          );
        });
      });
    });
  });

  // ─── TEST 8 — pas de duplication de ligne panier ────────────────────────
  it("8 - Pas de duplication de ligne pour un produit déjà dans le panier", () => {
    allerVersPageProduitParNom(PRODUCTS.normal.name);
    saisirQuantite(1);

    ajouterAuPanierEtAttendre("addFirstTime")
      .its("response.statusCode")
      .should("eq", 200);

    allerVersPageProduitParNom(PRODUCTS.normal.name);
    saisirQuantite(2);

    ajouterAuPanierEtAttendre("addSecondTime")
      .its("response.statusCode")
      .should("eq", 200);

    cy.url().should("include", "/cart");
    cy.get(DOM.cartApp).should("be.visible");

    cy.get(selectors.cartLineName)
      .filter(`:contains("${PRODUCTS.normal.name}")`)
      .then(($lines) => {
        if ($lines.length > 1) {
          signalerAnomalie(
            "ANO-UI-04",
            `DEFECT MEDIUM — duplication de ligne détectée pour ${PRODUCTS.normal.name}`,
            `Attendu : 1 ligne | Observé : ${$lines.length} lignes`,
          );
        }

        cy.log(`✅ TEST 8 — Pas de duplication pour ${PRODUCTS.normal.name}`);
      });
  });

  // ─── TEST 9 — quantité négative refusée ─────────────────────────────────
  it("9 - Ajouter au panier avec quantité négative doit être refusé", () => {
    allerVersPageProduitParNom(PRODUCTS.normal.name);

    cy.intercept("PUT", "**/orders/add").as("addNegative");

    saisirQuantite(-2);

    cy.get(selectors.quantityInput).should("have.class", "ng-invalid");
    cy.get(selectors.addToCartButton).should("be.visible").click();

    cy.url().should("not.include", "/cart");
    cy.get("@addNegative.all").should("have.length", 0);

    cy.log("✅ TEST 9 — qty négative refusée");
  });
});
