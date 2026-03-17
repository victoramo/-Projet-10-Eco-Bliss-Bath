/// <reference types="cypress" />
import { login, register } from "../../services/apiAuth";
import { faker } from "@faker-js/faker";

// Logue et fait échouer le test avec le code anomalie et le détail
const anomalie = (code, message, details = "") => {
  cy.log(`🚨 [${code}] ${message}`);
  if (details) cy.log(`🔍 ${details}`);
  throw new Error(`❌ [${code}] ${message}${details ? " | " + details : ""}`);
};

describe("API - Authentification", () => {
  // Vérifie qu'un nouvel utilisateur peut s'inscrire avec succès
  it("1 - API Register - Status 200/201", () => {
    const timestamp = Date.now();
    register(
      `demo_${timestamp}`,
      `user_${timestamp}`,
      `demo_${timestamp}@example.com`,
      "testtest",
      false,
    ).then((res) => {
      cy.log(`📡 Status : ${res.status}`);
      if (![200, 201].includes(res.status)) {
        anomalie(
          "ANO-AUTH-01",
          "DEFECT HIGH — Inscription refusée pour un nouvel utilisateur",
          `Attendu : 200 ou 201 | Observé : ${res.status}`,
        );
      }
      cy.log("✅ AUTH-1 — Inscription réussie");
    });
  });

  // Vérifie que l'inscription est refusée si l'email est déjà utilisé
  it("2 - API Register - Email existant - Status 400/422", () => {
    register(
      "ramo",
      "victor",
      "ramoshippuden@gmail.com",
      "testtest",
      false,
    ).then((res) => {
      cy.log(`📡 Status : ${res.status}`);
      if (![400, 422].includes(res.status)) {
        anomalie(
          "ANO-AUTH-02",
          "DEFECT HIGH — Email existant accepté à l'inscription",
          `Attendu : 400 ou 422 | Observé : ${res.status}`,
        );
      }
      cy.log(`✅ AUTH-2 — Email existant refusé (${res.status})`);
    });
  });

  // Vérifie qu'un utilisateur valide reçoit un token JWT à la connexion
  it("3 - API Login - Status 200 + token", () => {
    login("ramoshippuden@gmail.com", "testtest", false).then((res) => {
      cy.log(`📡 Status : ${res.status}`);
      if (res.status !== 200) {
        anomalie(
          "ANO-AUTH-03",
          "DEFECT CRITICAL — Connexion refusée pour un utilisateur valide",
          `Attendu : 200 | Observé : ${res.status}`,
        );
      }
      if (!res.body.token) {
        anomalie(
          "ANO-AUTH-03",
          "DEFECT CRITICAL — Token absent dans la réponse de connexion",
          `Body reçu : ${JSON.stringify(res.body)}`,
        );
      }
      cy.log(`✅ AUTH-3 — Connexion OK, token reçu`);
    });
  });

  // Vérifie que la connexion est refusée avec un format d'email invalide
  it("4 - API Login - Email invalide - Status 401", () => {
    login("emailinvalide", "testtest", false).then((res) => {
      cy.log(`📡 Status : ${res.status}`);
      if (res.status !== 401) {
        anomalie(
          "ANO-AUTH-04",
          "DEFECT HIGH — Email invalide accepté à la connexion",
          `Attendu : 401 | Observé : ${res.status}`,
        );
      }
      cy.log(`✅ AUTH-4 — Email invalide refusé (${res.status})`);
    });
  });

  // Vérifie que la connexion est refusée avec un email inexistant généré aléatoirement
  it("5 - API Login - Email inexistant - Status 401", () => {
    const fakeEmail = faker.internet.email();
    const fakePassword = faker.internet.password();

    login(fakeEmail, fakePassword, false).then((res) => {
      cy.log(`📡 Status : ${res.status}`);
      if (res.status !== 401) {
        anomalie(
          "ANO-AUTH-05",
          "DEFECT HIGH — Email inexistant accepté à la connexion",
          `Email : ${fakeEmail} | Attendu : 401 | Observé : ${res.status}`,
        );
      }
      cy.writeFile("cypress/logs/auth_failure.json", {
        username: fakeEmail,
        password: fakePassword,
        status: res.status,
        timestamp: new Date().toISOString(),
      });
      cy.log(`✅ AUTH-5 — Email inexistant refusé (${res.status})`);
    });
  });

  // Vérifie que la connexion est refusée avec un mot de passe incorrect
  it("6 - API Login - Mauvais mot de passe - Status 401", () => {
    login("ramoshippuden@gmail.com", "mauvaismdp", false).then((res) => {
      cy.log(`📡 Status : ${res.status}`);
      if (res.status !== 401) {
        anomalie(
          "ANO-AUTH-06",
          "DEFECT HIGH — Mauvais mot de passe accepté à la connexion",
          `Attendu : 401 | Observé : ${res.status}`,
        );
      }
      cy.log(`✅ AUTH-6 — Mauvais mot de passe refusé (${res.status})`);
    });
  });
});
