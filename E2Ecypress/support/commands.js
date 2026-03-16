// cypress/support/commands.js

import { selectors } from "./selectors";
// Importe les sélecteurs data-cy centralisés depuis selectors.js

import credentials from "../fixtures/credentials.json";
// Importe les identifiants et URLs depuis credentials.json

// ─────────────────────────────────────────
// Commande raccourci — sélecteur data-cy
// ─────────────────────────────────────────
Cypress.Commands.add("getBySel", (selector, ...args) => {
  return cy.get(`[data-cy=${selector}]`, ...args);
  // Raccourci : cy.getBySel("login-submit") = cy.get("[data-cy=login-submit]")
});

// ─────────────────────────────────────────
// Commande — naviguer vers la page login
// ─────────────────────────────────────────
Cypress.Commands.add("goToLoginPage", () => {
  cy.get(selectors.loginButton).click();
  // Clique sur le bouton de navigation vers la page login
});

// ─────────────────────────────────────────
// Commande — login via UI (formulaire)
// Utilisée dans les tests UI (cart.cy.js, register-athen.cy.js)
// ─────────────────────────────────────────
Cypress.Commands.add("login", () => {
  cy.goToLoginPage();
  // Navigue vers la page login via le bouton de navigation

  cy.get(selectors.usernameField).type(credentials.user.username);
  // Saisit l'email depuis credentials.json → ramoshippuden@gmail.com

  cy.get(selectors.passwordField).type(credentials.user.password);
  // Saisit le mot de passe depuis credentials.json → testtest

  cy.get(selectors.submitButton).click();
  // Clique sur le bouton de soumission du formulaire
});

// ─────────────────────────────────────────
// Commande — login via API (rapide, sans UI)
// Utilisée dans les tests API pour éviter de passer par le formulaire
// ─────────────────────────────────────────
Cypress.Commands.add("loginByApi", () => {
  cy.request({
    method: "POST",
    url: `${credentials.apiURL}/login`,
    // URL = http://localhost:8081/login — backend Symfony

    body: {
      username: credentials.user.username,
      // Email récupéré depuis credentials.json

      password: credentials.user.password,
      // Mot de passe récupéré depuis credentials.json
    },
    failOnStatusCode: false,
    // Ne casse pas le test si le serveur répond une erreur HTTP
  }).then((response) => {
    expect(response.status).to.eq(200);
    // Vérifie que la connexion API a réussi

    window.localStorage.setItem("token", response.body.token);
    // Stocke le token JWT dans le localStorage du navigateur
    // Nécessaire pour que l'app Angular reconnaisse la session
  });
});
