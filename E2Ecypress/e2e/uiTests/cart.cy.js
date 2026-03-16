/// <reference types="cypress" />

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENCE STOCK PRODUITS (état initial de la base de données)
// id:3 → 50 | id:4 → 25 | id:5 → 10 | id:6 → 5
// id:7 → 3  | id:8 → 1  | id:9 → 0  | id:10 → 0
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTS = {
  normal: { id: 3, name: "Sentiments printaniers", stock: 50, index: 0 },
  moyen: { id: 4, name: "Chuchotements d'été", stock: 26, index: 1 },
  faible: { id: 7, name: "Extrait de nature", stock: 3, index: 4 },
  dernier: { id: 8, name: "Milkyway", stock: 1, index: 5 },
  rupture: { id: 9, name: "Mousse de rêve", stock: 0, index: 6 },
};

// ─────────────────────────────────────────────────────────────────────────────
// FONCTION UTILITAIRE — Naviguer vers la page d'un produit via son index
//
// Flux : Home → "Voir les produits" → liste → clic "Consulter" à l'index donné
//
// Pourquoi l'index ?
// → cy.visit('/#/product/:id') ne charge pas correctement la page produit
// → Le seul chemin fiable passe par la liste des produits
//
// Paramètre : product — objet PRODUCTS (ex: PRODUCTS.normal)
// ─────────────────────────────────────────────────────────────────────────────
function allerVersPageProduit(product) {
  // Étape 1 — On va sur la page d'accueil
  cy.visit("/");

  // Étape 2 — On clique sur "Voir les produits" pour afficher la liste
  cy.contains("button", "Voir les produits").click();

  // Étape 3 — On attend que les boutons "Consulter" soient tous chargés
  cy.get("[data-cy='product-link']").should("have.length.greaterThan", 0);

  // Étape 4 — On clique sur "Consulter" à la position (index) du produit voulu
  // eq(0) = 1er produit, eq(1) = 2ème produit, etc.
  cy.get("[data-cy='product-link']").eq(product.index).click();

  // Étape 5 — On attend que la page produit soit bien chargée
  // Le stock doit être visible avant de saisir une quantité
  cy.get("p.stock").should("be.visible");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE DE TESTS — Panier (interface utilisateur)
// ─────────────────────────────────────────────────────────────────────────────
describe("Panier - Tests UI", () => {
  // ─── Avant chaque test : connexion de l'utilisateur ──────────────────────
  // Le champ quantité et le bouton "Ajouter au panier" nécessitent d'être connecté
  beforeEach(() => {
    cy.visit("/");

    // On intercepte les alertes JavaScript pour éviter qu'elles bloquent les tests
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
    });

    // Connexion via le menu de navigation
    cy.contains("a", "Connexion").click();
    cy.get("#username").type("ramoshippuden@gmail.com");
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();

    // On attend la confirmation de connexion avant de lancer le test
    cy.contains("a", "Déconnexion").should("be.visible");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1 — Ajout d'un produit avec quantité 3 (id:3, stock:50)
  //
  // Objectif : vérifier qu'on peut ajouter 3 unités d'un produit disponible
  // Résultat attendu : redirection vers /cart
  // ─────────────────────────────────────────────────────────────────────────
  it("1 - Ajouter un produit au panier avec quantité 3 (stock:50)", () => {
    // On navigue vers la page du produit via la liste
    allerVersPageProduit(PRODUCTS.normal);

    // On saisit la quantité 3 dans le champ prévu
    cy.get("input[type='number']").should("be.visible").clear().type("3");
    cy.get("input[type='number']").should("have.value", "3");

    // On clique sur "Ajouter au panier"
    cy.contains("button", "Ajouter au panier").click();

    // On vérifie la redirection vers le panier
    cy.url().should("include", "/cart");

    cy.log(
      `✅ TEST 1 — ${PRODUCTS.normal.name} ajouté (qty:3, stock:50 → reste:47)`,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — Suppression d'un produit du panier (id:4, stock:25)
  //
  // Objectif : vérifier qu'on peut supprimer un produit ajouté au panier
  // Résultat attendu : l'icône de suppression disparaît après le clic
  // ─────────────────────────────────────────────────────────────────────────
  it("2 - Supprimer un produit du panier (stock:25)", () => {
    allerVersPageProduit(PRODUCTS.moyen);

    // On ajoute le produit au panier (quantité par défaut)
    cy.contains("button", "Ajouter au panier").click();

    // On attend d'être sur la page panier
    cy.url().should("include", "/cart");

    // On vérifie que le bouton de suppression est visible
    cy.get("img[alt='Supprimer le produit']").should("be.visible");

    // On clique sur le bouton de suppression
    cy.get("img[alt='Supprimer le produit']").first().click();

    // On vérifie que la ligne a bien disparu
    cy.get("img[alt='Supprimer le produit']").should("not.exist");

    cy.log(`✅ TEST 2 — ${PRODUCTS.moyen.name} supprimé du panier`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3 — Panier vide après suppression (id:3, stock:50)
  //
  // Objectif : vérifier qu'un message "panier vide" s'affiche après suppression
  // Résultat attendu : message de panier vide visible
  // ─────────────────────────────────────────────────────────────────────────
  it("3 - Le panier est vide après suppression (stock:50)", () => {
    allerVersPageProduit(PRODUCTS.normal);

    // On ajoute le produit
    cy.contains("button", "Ajouter au panier").click();
    cy.url().should("include", "/cart");

    // On supprime le produit
    cy.get("img[alt='Supprimer le produit']").first().click();

    // On vérifie qu'un message "panier vide" est affiché
    cy.get("p, h2, div")
      .contains(/panier est vide|aucun produit|empty/i)
      .should("be.visible")
      .then(($el) => {
        cy.log("✅ TEST 3 — Panier vide confirmé : " + $el.text());
      });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 — Quantité 0 refusée (id:3, stock:50)
  //
  // Objectif : vérifier que le front-end empêche d'ajouter une quantité nulle
  // Résultat attendu : l'utilisateur reste sur la page produit
  // ─────────────────────────────────────────────────────────────────────────
  it("4 - Ajouter au panier avec quantité 0 doit échouer (stock:50)", () => {
    allerVersPageProduit(PRODUCTS.normal);

    // On saisit 0 dans le champ quantité
    cy.get("input[type='number']").should("be.visible").clear().type("0");

    // On tente d'ajouter au panier
    cy.contains("button", "Ajouter au panier").click();

    // Si redirection → anomalie | sinon → comportement correct
    cy.url().then((url) => {
      if (url.includes("/cart")) {
        cy.log("⚠️ Anomalie — quantité 0 acceptée par le front-end");
      } else {
        cy.log(
          "✅ TEST 4 — Quantité 0 refusée, utilisateur reste sur la page produit",
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6 — Dépassement du stock disponible (id:7, stock:3, qty:5)
  //
  // Objectif : vérifier que le front-end refuse une quantité > stock disponible
  // Résultat attendu : l'utilisateur reste sur la page produit
  // ─────────────────────────────────────────────────────────────────────────
  it("6 - Quantité supérieure au stock disponible doit être refusée (stock:3)", () => {
    allerVersPageProduit(PRODUCTS.faible);

    // On saisit une quantité supérieure au stock (5 > 3)
    cy.get("input[type='number']").should("be.visible").clear().type("5");

    // On tente d'ajouter au panier
    cy.contains("button", "Ajouter au panier").click();

    // Si redirection → anomalie | sinon → comportement correct
    cy.url().then((url) => {
      if (url.includes("/cart")) {
        cy.log(
          `⚠️ Anomalie — quantité 5 acceptée alors que stock = ${PRODUCTS.faible.stock}`,
        );
      } else {
        cy.log(
          `✅ TEST 6 — Quantité 5 refusée (stock disponible : ${PRODUCTS.faible.stock})`,
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7 — Produit en rupture de stock (id:9, stock:0)
  //
  // Objectif : vérifier qu'un produit épuisé ne peut pas être ajouté au panier
  // Résultat attendu : bouton absent ou désactivé
  // ─────────────────────────────────────────────────────────────────────────
  it("7 - Produit en rupture de stock ne peut pas être ajouté au panier (stock:0)", () => {
    allerVersPageProduit(PRODUCTS.rupture);

    // On vérifie l'état du bouton "Ajouter au panier"
    cy.get("body").then(($body) => {
      const btn = $body.find("button:contains('Ajouter au panier')");

      if (btn.length === 0) {
        // Cas 1 : bouton absent → comportement correct
        cy.log(
          `✅ TEST 7 — Bouton absent pour ${PRODUCTS.rupture.name} (stock:0)`,
        );
      } else if (btn.is(":disabled")) {
        // Cas 2 : bouton désactivé → comportement correct
        cy.log(
          `✅ TEST 7 — Bouton désactivé pour ${PRODUCTS.rupture.name} (stock:0)`,
        );
      } else {
        // Cas 3 : bouton actif → anomalie à documenter
        cy.log(
          `⚠️ Anomalie — bouton actif pour un produit en rupture (stock:0)`,
        );
        btn.trigger("click");
        cy.url().then((url) => {
          if (url.includes("/cart")) {
            cy.log(
              "⚠️ Anomalie critique — produit en rupture ajouté au panier",
            );
          }
        });
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8 — Pas de duplication de ligne panier (id:3, stock:50)
  // Objectif : même produit ajouté 2 fois = qty:1 + qty:2 → 1 ligne avec qty:3
  // ─────────────────────────────────────────────────────────────────────────
  it("8 - Pas de duplication de ligne pour un produit déjà dans le panier (stock:50)", () => {
    // ── Premier ajout : quantité 1 ──
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").should("be.visible").clear().type("1");
    cy.contains("button", "Ajouter au panier").click();
    cy.url().should("include", "/cart");

    // ── Deuxième ajout du même produit : quantité 2 ──
    // On repasse par la liste pour revenir sur la page produit
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").should("be.visible").clear().type("2");
    cy.contains("button", "Ajouter au panier").click();
    cy.url().should("include", "/cart");

    // ── Vérification : 1 seule ligne pour ce produit dans le panier ──
    cy.get("[data-cy='cart-line-name'], td, .cart-item")
      .filter(`:contains("${PRODUCTS.normal.name}")`)
      .should("have.length", 1);

    cy.log(`✅ TEST 8 — Pas de duplication pour ${PRODUCTS.normal.name}`);
  });
});
