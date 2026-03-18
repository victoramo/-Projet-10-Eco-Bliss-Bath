// services/apiReviews.js
// Centralise toutes les requêtes API vers /reviews

const reviewsUrl = () => `${Cypress.env("apiUrl")}/reviews`;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// GET — Liste tous les avis
export const getReviews = () => {
  return cy.request({
    method: "GET",
    url: reviewsUrl(),
    failOnStatusCode: false,
  });
};

// POST — Crée un avis (authentifié)
export const addReview = (token, title, comment, rating) => {
  return cy.request({
    method: "POST",
    url: reviewsUrl(),
    headers: authHeader(token),
    body: { title, comment, rating },
    failOnStatusCode: false,
  });
};
