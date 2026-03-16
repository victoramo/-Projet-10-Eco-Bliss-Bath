/// <reference types="cypress" />
import { login, register } from "../../services/apiAuth";
import { faker } from "@faker-js/faker";

describe("API - Authentification", () => {
  // ─────────────────────────────────────────
  // TEST 1 — Register réussi
  // ─────────────────────────────────────────
  it("1 - API Register - Status 200/201", () => {
    const timestamp = Date.now();
    register(
      `demo_${timestamp}`,
      `user_${timestamp}`,
      `demo_${timestamp}@example.com`,
      "testtest",
      false,
    ).then((response) => {
      cy.log(`📡 Status : ${response.status}`);
      expect(response.status).to.be.oneOf([200, 201]);
    });
  });

  // ─────────────────────────────────────────
  // TEST 2 — Register email existant
  // ─────────────────────────────────────────
  it("2 - API Register - Email existant - Status 400/422", () => {
    register(
      "ramo",
      "victor",
      "ramoshippuden@gmail.com",
      "testtest",
      false,
    ).then((response) => {
      cy.log(`📡 Status : ${response.status}`);
      expect(response.status).to.be.oneOf([400, 422]);
    });
  });

  // ─────────────────────────────────────────
  // TEST 3 — Login réussi + token
  // ─────────────────────────────────────────
  it("3 - API Login - Status 200 + token", () => {
    login("ramoshippuden@gmail.com", "testtest", false).then((response) => {
      cy.log(`📡 Status : ${response.status}`);
      expect(response.status).to.eq(200);
      expect(response.body.token).to.exist;
      cy.log(`🔑 Token : ${response.body.token}`);
    });
  });

  // ─────────────────────────────────────────
  // TEST 4 — Login email invalide
  // ─────────────────────────────────────────
  it("4 - API Login - Email invalide - Status 401", () => {
    login("emailinvalide", "testtest", false).then((response) => {
      cy.log(`📡 Status : ${response.status}`);
      expect(response.status).to.eq(401);
    });
  });

  // ─────────────────────────────────────────
  // TEST 5 — Login email inexistant (faker)
  // ─────────────────────────────────────────
  it("5 - API Login - Email inexistant - Status 401", () => {
    const fakeEmail = faker.internet.email();
    const fakePassword = faker.internet.password();

    login(fakeEmail, fakePassword, false).then((response) => {
      cy.log(`📡 Status : ${response.status}`);
      expect(response.status).to.eq(401);
      cy.writeFile("E2Ecypress/logs/auth_failure.json", {
        username: fakeEmail,
        password: fakePassword,
        status: response.status,
        timestamp: new Date().toISOString(),
      });
    });
  });

  // ─────────────────────────────────────────
  // TEST 6 — Login mauvais mot de passe
  // ─────────────────────────────────────────
  it("6 - API Login - Mauvais mot de passe - Status 401", () => {
    login("ramoshippuden@gmail.com", "mauvaismdp", false).then((response) => {
      cy.log(`📡 Status : ${response.status}`);
      expect(response.status).to.eq(401);
    });
  });
});
