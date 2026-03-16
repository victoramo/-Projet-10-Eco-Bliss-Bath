// ─────────────────────────────────────────────────────
// URL de base de l'API panier — récupérée depuis cypress.config.js
// Cypress.env("apiUrl") = "http://localhost:8081"
// apiOrders = "http://localhost:8081/orders"
// ─────────────────────────────────────────────────────
const apiOrders = `${Cypress.env("apiUrl")}/orders`;

// ─────────────────────────────────────────────────────
// FONCTION 1 — getCart()
// Récupère le contenu du panier via GET /orders
// Paramètre : token (optionnel) — si null = requête sans authentification
// Rôle dans api-cart.cy.js : tester GET avec et sans token
// ─────────────────────────────────────────────────────
export const getCart = (token = null) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return cy.request({
    method: "GET",
    url: apiOrders,
    headers: headers,
    failOnStatusCode: false,
  });
};

// ─────────────────────────────────────────────────────
// FONCTION 2 — addToCart()
// Ajoute un produit au panier via PUT /orders/add
// Paramètres :
//   token     = JWT récupéré après login
//   productId = identifiant du produit à ajouter
//   quantity  = quantité (1 par défaut si non précisé)
// ─────────────────────────────────────────────────────
export const addToCart = (token, productId, quantity = 1) => {
  return cy.request({
    method: "PUT",
    url: `${apiOrders}/add`,
    headers: { Authorization: `Bearer ${token}` },
    body: { product: productId, quantity },
    failOnStatusCode: false,
  });
};

// ─────────────────────────────────────────────────────
// FONCTION 3 — updateCart()
// Met à jour la quantité d'une ligne panier via PUT /orders/{id}/update
// Paramètres :
//   token       = JWT récupéré après login
//   orderLineId = identifiant de la ligne panier à modifier
//   quantity    = nouvelle quantité (peut être 0 ou -1 pour tester les cas limites)
// Rôle dans api-cart.cy.js :
//   - Cas passant  : quantité 3 → 1 (mise à jour normale)
//   - Cas limite   : quantité → 0 (le serveur doit refuser ou vider le panier)
//   - Cas invalide : quantité → -1 (le serveur doit retourner une erreur 400/422)
// ─────────────────────────────────────────────────────
export const updateCart = (token, orderLineId, quantity) => {
  return cy.request({
    method: "PUT", // PUT = mise à jour
    url: `${apiOrders}/${orderLineId}/update`, // URL dynamique avec l'ID de la ligne
    headers: { Authorization: `Bearer ${token}` }, // Token obligatoire
    body: { quantity }, // Nouvelle quantité envoyée au serveur
    failOnStatusCode: false, // Ne casse pas le test — on teste les cas d'erreur
  });
};

// ─────────────────────────────────────────────────────
// FONCTION 4 — clearCart()
// Supprime une ligne du panier via DELETE /orders/{id}/delete
// Paramètres :
//   token       = JWT récupéré après login
//   orderLineId = identifiant de la ligne panier à supprimer
// ─────────────────────────────────────────────────────
export const clearCart = (token, orderLineId) => {
  return cy
    .request({
      method: "DELETE",
      url: `${Cypress.env("apiUrl")}/orders/${orderLineId}/delete`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    })
    .then((response) => {
      expect(response.status).to.eq(200); // 200 = suppression confirmée
      return response.body;
    });
};
