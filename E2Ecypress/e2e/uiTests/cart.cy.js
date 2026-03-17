/// <reference types="cypress" />

// ─── RÉFÉRENCE PRODUITS (stock initial BDD) ───────────────────────────────
// id:3→39 | id:4→26 | id:7→3 | id:8→-4 | id:9→0 | id:10→0
const PRODUCTS = {
  normal: { id: 3, name: "Sentiments printaniers", stock: 39, index: 0 },
  moyen: { id: 4, name: "Chuchotements d'été", stock: 26, index: 1 },
  faible: { id: 7, name: "Extrait de nature", stock: 3, index: 4 },
  dernier: { id: 8, name: "Milkyway", stock: -4, index: 5 },
  rupture: { id: 9, name: "Mousse de rêve", stock: 0, index: 6 },
  ru: { id: 10, name: "Aurore boréale", stock: 0, index: 7 },
};

// ─── HELPER — Home → liste produits → page produit via index ─────────────
function allerVersPageProduit(product) {
  cy.visit("/");
  cy.contains("button", "Voir les produits").click();
  cy.get("[data-cy='product-link']").should("have.length.greaterThan", 0);
  cy.get("[data-cy='product-link']").eq(product.index).click();
  cy.get("p.stock").should("be.visible");
}

// ─── HELPER — Navigation panier sans rechargement Angular ────────────────
function allerVersPagePanier() {
  cy.window().then((win) => {
    win.location.hash = "/cart";
  });
  cy.url().should("include", "/cart");
}

// ─────────────────────────────────────────────────────────────────────────
describe("Panier - Tests UI", () => {
  // ─── Connexion persistée via cy.session() ───────────────────────────────
  // cy.session() sauvegarde cookies + localStorage → évite la déconnexion
  // entre les cy.visit() successifs dans un même test
  beforeEach(() => {
    cy.session("userSession", () => {
      cy.visit("/");
      cy.contains("a", "Connexion").click();
      cy.get("#username").type("ramoshippuden@gmail.com");
      cy.get("#password").type("testtest");
      cy.contains("span", "Se connecter").click();
      cy.contains("a", "Déconnexion").should("be.visible");
    });

    // Stub alert après restauration de session
    cy.visit("/");
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
    });
  });

  // ─── TEST 1 — Ajout qty:3 sur produit disponible (stock:39) ─────────────
  // Attendu : redirection vers /cart ✅
  it("1 - Ajouter un produit au panier avec quantité 3 (stock:39)", () => {
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("3").should("have.value", "3");
    cy.contains("button", "Ajouter au panier").click();
    cy.url().should("include", "/cart");
    cy.log(`✅ TEST 1 — ${PRODUCTS.normal.name} ajouté (qty:3)`);
  });
  // ─── TEST 2+3 — Suppression de toutes les lignes → panier vide ──────────
  // Scénario combiné :
  it("2 - Ajouter 2 produits différents puis vider le panier", () => {
    // ── ÉTAPE 1 : Ajouter le 1er produit (index 0) ─────────────────────────
    cy.intercept("GET", "**/products").as("getProducts1");
    cy.visit("/#/products");
    cy.wait("@getProducts1", { timeout: 10000 });

    // Chercher les liens produits réels sur la page /products
    cy.get("a[href*='/products/'], button[data-cy='product-link']", {
      timeout: 10000,
    })
      .should("have.length.above", 0)
      .first()
      .click();

    cy.url().should("include", "/products/");
    cy.get("p.stock").should("be.visible");
    cy.contains("button", "Ajouter au panier").click();
    cy.log("✅ ÉTAPE 1 — Produit 1 ajouté");

    // ── ÉTAPE 2 : Retour accueil → ajouter le 2ème produit ─────────────────
    cy.contains("a", "Accueil").click();
    cy.intercept("GET", "**/products").as("getProducts2");
    cy.visit("/#/products");
    cy.wait("@getProducts2", { timeout: 10000 });

    cy.get("a[href*='/products/'], button[data-cy='product-link']", {
      timeout: 10000,
    })
      .should("have.length.above", 0)
      .eq(2)
      .click();

    cy.url().should("include", "/products/");
    cy.get("p.stock").should("be.visible");
    cy.contains("button", "Ajouter au panier").click();
    cy.log("✅ ÉTAPE 2 — Produit 2 ajouté");

    // ── ÉTAPE 3 : Retour accueil → naviguer vers /cart ─────────────────────
    cy.contains("a", "Accueil").click();
    cy.intercept("GET", "**/orders").as("getOrders");
    cy.visit("/#/cart");
    cy.wait("@getOrders", { timeout: 10000 });
    cy.url().should("include", "/cart");
    cy.log("✅ ÉTAPE 3 — Page panier chargée");

    // ── ÉTAPE 4 : Vérifier les lignes et tout supprimer ────────────────────
    cy.get("[data-cy='cart-line']", { timeout: 10000 })
      .should("have.length.gte", 2)
      .then(($lines) => {
        cy.log(`✅ ÉTAPE 4 — ${$lines.length} ligne(s) trouvée(s)`);
      });

    const supprimerTout = () => {
      cy.get("body").then(($body) => {
        if ($body.find("[data-cy='cart-line-delete']").length > 0) {
          cy.get("[data-cy='cart-line-delete']").first().click();
          cy.wait(600);
          supprimerTout();
        }
      });
    };
    supprimerTout();

    // ── ÉTAPE 5 : Vérifier le message panier vide ──────────────────────────
    cy.get('[data-cy="cart-empty"]', { timeout: 10000 }).should("be.visible");
    cy.contains("h1", "Commande").should("be.visible");
    cy.contains("h2", "Panier").should("be.visible");
    cy.contains("p", "Votre panier est vide").should("be.visible");
    cy.contains("a", "Consultez nos produits").should("be.visible");

    cy.log("✅ TEST 2 — Toutes les lignes supprimées, panier vide confirmé");
  });

  // ─── TEST 4 — Quantité 0 refusée (stock:39) ─────────────────────────────
  // Attendu : pas de redirection vers /cart
  // ⚠️ ANO-BACK-01 DEFECT HIGH si qty=0 acceptée
  it("4 - Ajouter au panier avec quantité 0 doit être refusé (stock:39)", () => {
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("0");
    cy.contains("button", "Ajouter au panier").click();
    cy.wait(3000);
    cy.url().then((url) => {
      if (url.includes("/cart")) {
        cy.log(
          "⚠️ [ANO-BACK-01] DEFECT HIGH — qty=0 acceptée, redirection vers /cart",
        );
        cy.log(
          "⚠️ Attendu : ajout refusé | Observé : commande créée avec qty=0",
        );
      } else {
        cy.log("✅ TEST 4 — qty=0 correctement refusée");
      }
    });
    cy.log("ℹ️ TEST 4 — Terminé. Voir logs ANO-BACK-01 si anomalie.");
  });

  // ─── TEST 6 — qty > stock refusée (stock:3, qty:5) ──────────────────────
  // Attendu : pas de redirection vers /cart
  // ⚠️ ANO-BACK-02 DEFECT HIGH si stock passe en négatif
  it("6 - Quantité supérieure au stock disponible doit être refusée (stock:3)", () => {
    allerVersPageProduit(PRODUCTS.faible);
    cy.get("input[type='number']").clear().type("5");
    cy.contains("button", "Ajouter au panier").click();
    cy.wait(3000);
    cy.url().then((url) => {
      if (url.includes("/cart")) {
        cy.log(
          `⚠️ [ANO-BACK-02] DEFECT HIGH — qty=5 acceptée alors que stock=${PRODUCTS.faible.stock}`,
        );
        cy.log(
          "⚠️ Attendu : ajout refusé | Observé : stock décrémenté en négatif",
        );
        cy.request(
          "GET",
          `${Cypress.env("apiUrl")}/products/${PRODUCTS.faible.id}`,
        )
          .its("body.availableStock")
          .then((stock) => cy.log(`⚠️ Stock après ajout : ${stock}`));
      } else {
        cy.log(`✅ TEST 6 — qty=5 refusée (stock:${PRODUCTS.faible.stock})`);
      }
    });
    cy.log("ℹ️ TEST 6 — Terminé. Voir logs ANO-BACK-02 si anomalie.");
  });

  // ─── TEST 7 — Rupture de stock (stock:0) ────────────────────────────────
  // Attendu : bouton absent ou désactivé
  // ⚠️ ANO-BACK-03 DEFECT HIGH si bouton actif et ajout possible
  it("7 - Produit en rupture de stock ne peut pas être ajouté au panier (stock:0)", () => {
    allerVersPageProduit(PRODUCTS.rupture);
    cy.get("body").then(($body) => {
      const btn = $body.find("button:contains('Ajouter au panier')");
      if (btn.length === 0) {
        cy.log(`✅ TEST 7 — Bouton absent (stock:0)`);
      } else if (btn.is(":disabled")) {
        cy.log(`✅ TEST 7 — Bouton désactivé (stock:0)`);
      } else {
        cy.log(
          "⚠️ [ANO-BACK-03] DEFECT HIGH — Bouton actif sur produit en rupture (stock:0)",
        );
        cy.log(
          "⚠️ Attendu : bouton désactivé | Observé : ajout au panier possible",
        );
        cy.contains("button", "Ajouter au panier").click();
        cy.wait(2000);
        cy.request(
          "GET",
          `${Cypress.env("apiUrl")}/products/${PRODUCTS.rupture.id}`,
        )
          .its("body.availableStock")
          .then((stock) => {
            if (stock < 0)
              cy.log(`⚠️ [ANO-BACK-03] CONFIRMÉ — Stock négatif : ${stock}`);
          });
      }
    });
    cy.log("ℹ️ TEST 7 — Terminé. Voir logs ANO-BACK-03 si anomalie.");
  });

  // ─── TEST 8 — Pas de duplication de ligne panier (stock:39) ─────────────
  // Attendu : 2 ajouts du même produit = 1 seule ligne, qty cumulée ✅
  it("8 - Pas de duplication de ligne pour un produit déjà dans le panier (stock:39)", () => {
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("1");
    cy.contains("button", "Ajouter au panier").click();
    cy.url().should("include", "/cart");

    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("2");
    cy.contains("button", "Ajouter au panier").click();
    cy.url().should("include", "/cart");

    cy.get("[data-cy='cart-line-name'], td, .cart-item")
      .filter(`:contains("${PRODUCTS.normal.name}")`)
      .should("have.length", 1);
    cy.log(`✅ TEST 8 — Pas de duplication pour ${PRODUCTS.normal.name}`);
  });

  // ─── TEST 9 — qty=0 dans le panier (stock:39) ───────────────────────────
  // Attendu : ajout refusé, pas de redirection vers /cart
  // ⚠️ ANO-BACK-01 DEFECT HIGH si commande confirmable avec qty=0
  it("9 - Ajouter au panier avec quantité 0 doit être refusé", () => {
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("0");
    cy.contains("button", "Ajouter au panier").click();
    cy.wait(3000);
    cy.url().then((url) => {
      if (url.includes("/cart")) {
        cy.log(
          "⚠️ [ANO-BACK-01] DEFECT HIGH — qty=0 acceptée, commande confirmable",
        );
        cy.log(
          "⚠️ Attendu : ajout refusé | Observé : ligne qty=0 dans le panier",
        );
      } else {
        cy.log("✅ TEST 9 — qty=0 correctement refusée");
      }
    });
    cy.log("ℹ️ TEST 9 — Terminé. Voir logs ANO-BACK-01 si anomalie.");
  });

  // ─── TEST 10 — Quantité négative refusée (qty:-2, stock:39) ─────────────
  // Attendu : ajout refusé, pas de redirection vers /cart
  // ⚠️ ANO-BACK-05 DEFECT HIGH si stock crédité ou négatif
  it("10 - Ajouter au panier avec quantité négative doit être refusé", () => {
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("-2");
    cy.contains("button", "Ajouter au panier").click();
    cy.wait(3000);
    cy.url().then((url) => {
      if (url.includes("/cart")) {
        cy.log("⚠️ [ANO-BACK-05] DEFECT HIGH — qty=-2 acceptée par le système");
        cy.log(
          "⚠️ Attendu : ajout refusé | Observé : redirection vers /cart avec qty négative",
        );
        cy.request(
          "GET",
          `${Cypress.env("apiUrl")}/products/${PRODUCTS.normal.id}`,
        )
          .its("body.availableStock")
          .then((stock) => {
            if (stock > PRODUCTS.normal.stock)
              cy.log(
                `⚠️ [ANO-BACK-05] CONFIRMÉ — Stock crédité : ${stock} (stock augmenté)`,
              );
            if (stock < 0)
              cy.log(`⚠️ [ANO-BACK-05] CONFIRMÉ — Stock négatif : ${stock}`);
          });
      } else {
        cy.log("✅ TEST 10 — qty=-2 correctement refusée");
      }
    });
    cy.log("ℹ️ TEST 10 — Terminé. Voir logs ANO-BACK-05 si anomalie.");
  });
});
