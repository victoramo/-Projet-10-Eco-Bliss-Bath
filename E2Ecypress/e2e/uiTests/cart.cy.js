/// <reference types="cypress" />

// ─── RÉFÉRENCE PRODUITS (stock initial BDD) ───────────────────────────────
const PRODUCTS = {
  normal: { id: 3, name: "Sentiments printaniers", stock: 39, index: 0 },
  moyen: { id: 4, name: "Chuchotements d'été", stock: 26, index: 1 },
  faible: { id: 7, name: "Extrait de nature", stock: 3, index: 4 },
  dernier: { id: 8, name: "Milkyway", stock: -4, index: 5 },
  rupture: { id: 9, name: "Mousse de rêve", stock: 0, index: 6 },
  ru: { id: 10, name: "Aurore boréale", stock: 0, index: 7 },
};

function allerVersPageProduit(product) {
  cy.visit("/");
  cy.contains("button", "Voir les produits").click();
  cy.get("[data-cy='product-link']").should("have.length.greaterThan", 0);
  cy.get("[data-cy='product-link']").eq(product.index).click();
  cy.get("p.stock").should("be.visible");
}

function allerVersPagePanier() {
  cy.window().then((win) => {
    win.location.hash = "/cart";
  });
  cy.url().should("include", "/cart");
}

// ─── HELPER ANOMALIE — log + throw si règle non respectée ────────────────
function signalerAnomalie(code, message, details = "") {
  cy.log(`🚨 [${code}] ANOMALIE DÉTECTÉE`);
  cy.log(`📋 ${message}`);
  if (details) cy.log(`🔍 ${details}`);
  throw new Error(`❌ [${code}] ${message}${details ? " | " + details : ""}`);
}

// ─────────────────────────────────────────────────────────────────────────
describe("Panier - Tests UI", () => {
  beforeEach(() => {
    cy.session("userSession", () => {
      cy.visit("/");
      cy.contains("a", "Connexion").click();
      cy.get("#username").type("ramoshippuden@gmail.com");
      cy.get("#password").type("testtest");
      cy.contains("span", "Se connecter").click();
      cy.contains("a", "Déconnexion").should("be.visible");
    });
    cy.visit("/");
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1 — Ajouter un produit au panier avec une quantité de 3
  // ═══════════════════════════════════════════════════════════════════════════
  it("1 - Ajouter un produit au panier avec quantité 3 (stock:50)", () => {
    // On surveille la requête POST /login pour vérifier qu'elle répond 200
    cy.intercept("POST", "**/login").as("loginTest1");

    // On visite la page de connexion et on remplit le formulaire
    cy.visit("/#/login");
    cy.get("#username").type("ramoshippuden@gmail.com");
    cy.get("#password").type("testtest");
    cy.contains("span", "Se connecter").click();

    // On attend la réponse du serveur et on vérifie le code HTTP
    cy.wait("@loginTest1", { timeout: 5000 }).then((interception) => {
      cy.log(`📡 Status login : ${interception.response.statusCode}`);
      expect(interception.response.statusCode).to.eq(200);
    });

    // On vérifie que l'URL ne contient plus "/login" → connexion réussie
    cy.url({ timeout: 6000 }).should("not.include", "/login");
    cy.log("✅ Connecté avec ramoshippuden@gmail.com");

    // On surveille la requête GET /products pour valider le chargement
    cy.intercept("GET", "**/products").as("getProducts");

    // On clique sur le lien "Produits" dans la barre de navigation
    cy.get("a[data-cy='nav-link-products']").click();
    cy.wait("@getProducts", { timeout: 5000 }).then((interception) => {
      cy.log(`📡 Status produits : ${interception.response.statusCode}`);
      expect(interception.response.statusCode).to.eq(200);
    });

    // On clique sur le 1er produit de la liste
    cy.get("article.mini-product", { timeout: 6000 })
      .should("have.length.above", 0)
      .first()
      .find("button[data-cy='product-link']")
      .click();

    // On vérifie que la page détail du produit est bien chargée
    cy.get("#product-content", { timeout: 6000 }).should("be.visible");
    cy.get(".stock").should("be.visible");

    // On efface la valeur par défaut du champ quantité et on saisit 3
    cy.get("input[type='number']").clear().type("3").should("have.value", "3");

    // On surveille la requête PUT /orders/add — times:1 = capturée 1 seule fois
    cy.intercept({ method: "PUT", url: "**/orders/add", times: 1 }).as(
      "addToCart",
    );

    // On clique sur "Ajouter au panier"
    cy.get("button[data-cy='detail-product-add']").click();
    cy.wait("@addToCart", { timeout: 5000 }).then((interception) => {
      cy.log(`📡 Status ajout panier : ${interception.response.statusCode}`);
      expect(interception.response.statusCode).to.eq(200);
    });

    // On vérifie que l'app a redirigé vers le panier et qu'une ligne est présente
    cy.get("app-cart", { timeout: 6000 }).should("be.visible");
    cy.url({ timeout: 6000 }).should("include", "/cart");
    cy.get("[data-cy='cart-line']", { timeout: 6000 }).should(
      "have.length.above",
      0,
    );
    cy.log("✅ TEST 1 — Produit ajouté avec quantité 3, panier chargé");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Ajouter 2 produits différents puis vider le panier
  // ═══════════════════════════════════════════════════════════════════════════
  it("2 - Ajouter 2 produits différents puis vider le panier", () => {
    // ── PRÉ-CONDITION : Nettoyage du panier via API ───────────────────────────
    cy.request("POST", `${Cypress.env("apiUrl")}/login`, {
      username: "ramoshippuden@gmail.com",
      password: "testtest",
    }).then((loginResp) => {
      expect(loginResp.status).to.eq(200);

      // Le token JWT est nécessaire pour les appels API authentifiés
      const token = loginResp.body.token;

      // On récupère la liste des commandes de l'utilisateur
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/orders`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false, // ne pas faire échouer le test si 404
      }).then((ordersResp) => {
        if (ordersResp.status === 200) {
          // L'API peut retourner un objet ou un tableau → on normalise en tableau
          const orders = Array.isArray(ordersResp.body)
            ? ordersResp.body
            : [ordersResp.body];

          // On cherche la commande en cours (statut "cart" ou lignes non vides)
          const currentOrder = orders.find(
            (o) => o.status === "cart" || o.orderLines?.length > 0,
          );

          if (currentOrder?.orderLines?.length > 0) {
            // On supprime chaque ligne une par une via DELETE /orders/{id}/delete
            currentOrder.orderLines.forEach((line) => {
              cy.request({
                method: "DELETE",
                url: `${Cypress.env("apiUrl")}/orders/${line.id}/delete`,
                headers: { Authorization: `Bearer ${token}` },
                failOnStatusCode: false,
              }).then((del) =>
                cy.log(`🧹 Ligne ${line.id} supprimée — ${del.status}`),
              );
            });
          } else {
            cy.log("🧹 Panier déjà vide — aucune action nécessaire");
          }
        }
      });
    });

    // ── Reprise de session — accès direct à la liste produits ────────────────
    cy.intercept("GET", "**/products").as("getProducts1");
    cy.intercept({ method: "PUT", url: "**/orders/add", times: 1 }).as(
      "addCart1",
    );

    cy.visit("/#/products");
    cy.wait("@getProducts1", { timeout: 5000 }).then((interception) => {
      cy.log(`📡 Status produits : ${interception.response.statusCode}`);
      expect(interception.response.statusCode).to.eq(200);
    });

    // ── ÉTAPE 1 : Ajouter "Sentiments printaniers" (id:3, stock:50) ──────────
    cy.get("article.mini-product", { timeout: 6000 })
      .should("have.length.above", 0)
      .first()
      .find("button[data-cy='product-link']")
      .click();
    cy.get("#product-content", { timeout: 6000 }).should("be.visible");
    cy.get(".stock").should("be.visible");

    // On force qty:1 pour éviter toute valeur résiduelle négative héritée du TEST 1
    cy.get("input[type='number']")
      .should("be.visible")
      .clear()
      .type("1")
      .should("have.value", "1");

    cy.get("button[data-cy='detail-product-add']").click();
    cy.wait("@addCart1", { timeout: 5000 }).then((interception) => {
      cy.log(`📡 Status ajout produit 1 : ${interception.response.statusCode}`);
      expect(interception.response.statusCode).to.eq(200);
    });
    cy.log('✅ ÉTAPE 1 — "Sentiments printaniers" (id:3, stock:50) ajouté');

    // ── ÉTAPE 2 : Ajouter "Chuchotements d'été" (id:4, stock:25) ─────────────
    cy.intercept("GET", "**/products").as("getProducts2");
    cy.intercept({ method: "PUT", url: "**/orders/add", times: 1 }).as(
      "addCart2",
    );

    // On retourne sur la liste via la navbar
    cy.get("a[data-cy='nav-link-products']").click();
    cy.wait("@getProducts2", { timeout: 5000 }).then((interception) => {
      cy.log(`📡 Status produits : ${interception.response.statusCode}`);
      expect(interception.response.statusCode).to.eq(200);
    });

    // .eq(1) = 2ème produit affiché (index 0-based) → "Chuchotements d'été"
    cy.get("article.mini-product", { timeout: 6000 })
      .should("have.length.above", 0)
      .eq(1)
      .find("button[data-cy='product-link']")
      .click();
    cy.get("#product-content", { timeout: 6000 }).should("be.visible");
    cy.get(".stock").should("be.visible");

    // Même précaution : forcer qty:1 avant d'ajouter
    cy.get("input[type='number']")
      .should("be.visible")
      .clear()
      .type("1")
      .should("have.value", "1");

    cy.get("button[data-cy='detail-product-add']").click();
    cy.wait("@addCart2", { timeout: 5000 }).then((interception) => {
      cy.log(`📡 Status ajout produit 2 : ${interception.response.statusCode}`);
      expect(interception.response.statusCode).to.eq(200);
    });
    cy.log('✅ ÉTAPE 2 — "Chuchotements d\'été" (id:4, stock:25) ajouté');

    // ── ÉTAPE 3 : Vérifier la redirection automatique vers le panier ──────────
    cy.get("app-cart", { timeout: 6000 }).should("be.visible");
    cy.url({ timeout: 6000 }).should("include", "/cart");
    cy.log("✅ ÉTAPE 3 — Page panier chargée automatiquement");

    // ── ÉTAPE 4 : ❌ Le test échoue si moins de 2 lignes sont trouvées
    cy.get("[data-cy='cart-line']", { timeout: 6000 }).then(($lines) => {
      const total = $lines.length;
      cy.log(`📋 Nombre de lignes dans le panier : ${total}`);

      expect(
        total,
        `⚠️ ANO-UI-02 — Panier incomplet : ${total} ligne(s) trouvée(s), attendu ≥ 2`,
      ).to.be.at.least(2);

      cy.log(`✅ ÉTAPE 4 — ${total} ligne(s) confirmée(s) dans le panier`);
    });

    // ── ÉTAPES 5-N : Supprimer toutes les lignes une par une ─────────────────

    const supprimerToutesLesLignes = () => {
      cy.get("body").then(($body) => {
        if ($body.find("[data-cy='cart-line-delete']").length > 0) {
          // On surveille la requête DELETE avant de cliquer
          cy.intercept("DELETE", "**/orders/**/delete").as("deleteOneLine");

          cy.get("[data-cy='cart-line-delete']", { timeout: 6000 })
            .should("exist")
            .first()
            .click({ force: true }); // force:true au cas où le bouton est partiellement masqué

          cy.wait("@deleteOneLine", { timeout: 6000 }).then((interception) => {
            cy.log(`📡 Suppression : ${interception.response.statusCode}`);
            // 200 ou 204 sont tous les deux valides pour un DELETE réussi
            expect(interception.response.statusCode).to.be.oneOf([200, 204]);
          });

          // Pause courte pour laisser Angular mettre à jour le DOM
          cy.wait(500);

          // Rappel récursif : on recommence jusqu'à ce qu'il n'y ait plus de bouton
          supprimerToutesLesLignes();
        }
      });
    };
    supprimerToutesLesLignes();

    // ── ÉTAPE FINALE : Vérifier le message "panier vide" ─────────────────────
    cy.get("app-cart", { timeout: 6000 }).should("be.visible");
    cy.contains("h1", "Commande").should("be.visible");
    cy.contains("h2", "Panier").should("be.visible");
    cy.contains("p", "Votre panier est vide").should("be.visible");
    cy.get("section.cart-section p a")
      .should("be.visible")
      .and("contain", "Consultez nos produits");
    cy.log("✅ ÉTAPE FINALE — Message panier vide confirmé");

    // ── ÉTAPE 8 : Cliquer sur "Consultez nos produits" et vérifier la redirection
    cy.intercept("GET", "**/products").as("getProductsFinal");
    cy.get("section.cart-section p a").click();
    cy.wait("@getProductsFinal", { timeout: 5000 }).then((interception) => {
      cy.log(`📡 Redirection produits : ${interception.response.statusCode}`);
      expect(interception.response.statusCode).to.eq(200);
    });

    // On vérifie l'URL et que des produits sont bien affichés
    cy.url().should("include", "/products");
    cy.get("article.mini-product", { timeout: 6000 }).should(
      "have.length.above",
      0,
    );
    cy.log("✅ TEST 2 — Fin : redirection vers page produits confirmée");
  });
  // ─── TEST 4 — Quantité 0 refusée (stock:39) ─────────────────────────────
  it("4 - Ajouter au panier avec quantité 0 doit être refusé (stock:39)", () => {
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("0");
    cy.contains("button", "Ajouter au panier").click();
    cy.wait(3000);

    cy.url().then((url) => {
      if (url.includes("/cart")) {
        signalerAnomalie(
          "ANO-BACK-01",
          "DEFECT HIGH — qty=0 acceptée, redirection vers /cart",
          "Attendu : ajout refusé | Observé : commande créée avec qty=0",
        );
      }
      cy.log("✅ TEST 4 — qty=0 correctement refusée");
    });
  });

  // ─── TEST 6 — qty > stock refusée (stock:3, qty:5) ──────────────────────
  it("6 - Quantité supérieure au stock disponible doit être refusée (stock:3)", () => {
    allerVersPageProduit(PRODUCTS.faible);
    cy.get("input[type='number']").clear().type("5");
    cy.contains("button", "Ajouter au panier").click();
    cy.wait(3000);

    cy.url().then((url) => {
      if (url.includes("/cart")) {
        cy.request(
          "GET",
          `${Cypress.env("apiUrl")}/products/${PRODUCTS.faible.id}`,
        )
          .its("body.availableStock")
          .then((stock) => {
            signalerAnomalie(
              "ANO-BACK-02",
              `DEFECT HIGH — qty=5 acceptée alors que stock=${PRODUCTS.faible.stock}`,
              `Attendu : ajout refusé | Observé : stock après ajout = ${stock}`,
            );
          });
      } else {
        cy.log(`✅ TEST 6 — qty=5 refusée (stock:${PRODUCTS.faible.stock})`);
      }
    });
  });

  // ─── TEST 7 — Rupture de stock (stock:0) ────────────────────────────────
  it("7 - Produit en rupture de stock ne peut pas être ajouté au panier (stock:0)", () => {
    allerVersPageProduit(PRODUCTS.rupture);

    cy.get("body").then(($body) => {
      const btn = $body.find("button:contains('Ajouter au panier')");

      if (btn.length === 0) {
        cy.log("✅ TEST 7 — Bouton absent (stock:0)");
      } else if (btn.is(":disabled")) {
        cy.log("✅ TEST 7 — Bouton désactivé (stock:0)");
      } else {
        cy.contains("button", "Ajouter au panier").click();
        cy.wait(2000);
        cy.request(
          "GET",
          `${Cypress.env("apiUrl")}/products/${PRODUCTS.rupture.id}`,
        )
          .its("body.availableStock")
          .then((stock) => {
            signalerAnomalie(
              "ANO-BACK-03",
              "DEFECT HIGH — Bouton actif sur produit en rupture (stock:0)",
              `Attendu : bouton désactivé | Observé : ajout possible, stock = ${stock}`,
            );
          });
      }
    });
  });

  // ─── TEST 8 — Pas de duplication de ligne panier (stock:39) ─────────────
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
      .then(($els) => {
        if ($els.length > 1) {
          signalerAnomalie(
            "ANO-UI-04",
            `DEFECT MEDIUM — Duplication de ligne détectée pour ${PRODUCTS.normal.name}`,
            `Attendu : 1 ligne | Observé : ${$els.length} lignes`,
          );
        }
        cy.log(`✅ TEST 8 — Pas de duplication pour ${PRODUCTS.normal.name}`);
      });
  });

  // ─── TEST 9 — qty=0 dans le panier (stock:39) ───────────────────────────
  it("9 - Ajouter au panier avec quantité 0 doit être refusé", () => {
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("0");
    cy.contains("button", "Ajouter au panier").click();
    cy.wait(3000);

    cy.url().then((url) => {
      if (url.includes("/cart")) {
        signalerAnomalie(
          "ANO-BACK-01",
          "DEFECT HIGH — qty=0 acceptée, commande confirmable",
          "Attendu : ajout refusé | Observé : ligne qty=0 dans le panier",
        );
      }
      cy.log("✅ TEST 9 — qty=0 correctement refusée");
    });
  });

  // ─── TEST 10 — Quantité négative refusée (qty:-2, stock:39) ─────────────
  it("10 - Ajouter au panier avec quantité négative doit être refusé", () => {
    allerVersPageProduit(PRODUCTS.normal);
    cy.get("input[type='number']").clear().type("-2");
    cy.contains("button", "Ajouter au panier").click();
    cy.wait(3000);

    cy.url().then((url) => {
      if (url.includes("/cart")) {
        cy.request(
          "GET",
          `${Cypress.env("apiUrl")}/products/${PRODUCTS.normal.id}`,
        )
          .its("body.availableStock")
          .then((stock) => {
            const detail =
              stock > PRODUCTS.normal.stock
                ? `Stock crédité : ${stock} (augmenté)`
                : stock < 0
                  ? `Stock négatif : ${stock}`
                  : `Stock = ${stock}`;
            signalerAnomalie(
              "ANO-BACK-05",
              "DEFECT HIGH — qty=-2 acceptée par le système",
              `Attendu : ajout refusé | Observé : redirection /cart | ${detail}`,
            );
          });
      } else {
        cy.log("✅ TEST 10 — qty=-2 correctement refusée");
      }
    });
  });
});
