// E2Ecypress/e2e/apiTests/api-full-test.cy.js

describe("API Eco Bliss Bath — 6 routes", () => {
  const api = Cypress.env("apiUrl");
  let token;
  let productId; // ← ID récupéré dynamiquement

  before(() => {
    // Récupère le token
    cy.request("POST", `${api}/login`, {
      username: Cypress.env("username"),
      password: Cypress.env("password"),
    }).then((res) => {
      token = res.body.token;
    });

    // Récupère un ID produit réel
    cy.request("GET", `${api}/products`).then((res) => {
      productId = res.body[0].id;
    });
  });

  // ── 1. LOGIN ──────────────────────────────────────────────────────
  it("1 - POST /login — authentification réussie", () => {
    cy.request("POST", `${api}/login`, {
      username: Cypress.env("username"),
      password: Cypress.env("password"),
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("token");
    });
  });

  // ── 2. LISTE DES PRODUITS ─────────────────────────────────────────
  it("2 - GET /products — retourne une liste de produits", () => {
    cy.request("GET", `${api}/products`).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an("array").and.not.be.empty;
      // ✅ include.keys au lieu de have.keys
      expect(res.body[0]).to.include.keys(["id", "name", "price"]);
    });
  });

  // ── 3. DÉTAIL D'UN PRODUIT ────────────────────────────────────────
  it("3 - GET /products/:id — retourne le détail d'un produit", () => {
    // ✅ ID dynamique récupéré dans before()
    cy.request("GET", `${api}/products/${productId}`).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("id", productId);
      expect(res.body).to.have.property("name");
      expect(res.body).to.have.property("price");
    });
  });

  // ── 4. LISTE DES AVIS ─────────────────────────────────────────────
  it("4 - GET /reviews — retourne la liste des avis", () => {
    cy.request("GET", `${api}/reviews`).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an("array");
    });
  });

  // ── 5. CRÉER UN AVIS (auth requise) ──────────────────────────────
  it("5 - POST /reviews — création d'un avis avec token", () => {
    cy.request({
      method: "POST",
      url: `${api}/reviews`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        title: "Super produit",
        comment: "Très bonne qualité, je recommande.",
        rating: 5,
      },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("id");
    });
  });

  // ── 6. PANIER EN COURS (auth requise) ────────────────────────────
  it("6 - GET /orders — récupère le panier de l'utilisateur", () => {
    cy.request({
      method: "GET",
      url: `${api}/orders`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 404]);
    });
  });
});
