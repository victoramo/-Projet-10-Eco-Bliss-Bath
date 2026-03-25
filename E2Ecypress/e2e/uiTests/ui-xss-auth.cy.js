/// <reference types="cypress" />

import { selectors } from "../../support/selectors";

/*
  TESTS XSS UI - FORMULAIRE DE LOGIN
  Stratégie soft assert :
  - on log chaque anomalie immédiatement
  - on continue tous les payloads
  - on échoue une seule fois à la fin avec le bilan complet
*/

const XSS_PAYLOADS = [
  {
    id: "XSS-01",
    label: "Script basique",
    payload: "<script>alert('xss')</script>",
  },
  {
    id: "XSS-02",
    label: "Image onerror",
    payload: "<img src=x onerror=alert(1)>",
  },
  {
    id: "XSS-03",
    label: "Javascript URI",
    payload: "javascript:alert(document.cookie)",
  },
];

const XSS_PATTERNS = [
  "<script",
  "onerror=",
  "onload=",
  "onfocus=",
  "javascript:",
  "expression(",
];

// Nettoyage de session avant chaque test
function forceLogout() {
  cy.clearCookies();
  cy.clearLocalStorage();

  cy.window().then((win) => {
    win.sessionStorage.clear();
    win.localStorage.clear();
  });
}

// Ouvre la page de login proprement
function goToLoginPage() {
  cy.visit("/");
  forceLogout();

  cy.visit("/#/login");
  cy.url({ timeout: 10000 }).should("include", "/login");

  cy.get(selectors.usernameField, { timeout: 15000 }).should("be.visible");
  cy.get(selectors.passwordField, { timeout: 15000 }).should("be.visible");
  cy.get(selectors.submitButton, { timeout: 15000 }).should("be.visible");
}

// Remplit les 2 champs avec le payload
function fillLoginForm(payload) {
  cy.get(selectors.usernameField)
    .clear()
    .type(payload, { parseSpecialCharSequences: false });

  cy.get(selectors.passwordField)
    .clear()
    .type(payload, { parseSpecialCharSequences: false });
}

// Remplit un seul champ avec le payload
function fillOneField(fieldName, payload) {
  cy.get(selectors.usernameField).clear().type("test@test.com");
  cy.get(selectors.passwordField).clear().type("TestTest123!");

  if (fieldName === "username") {
    cy.get(selectors.usernameField)
      .clear()
      .type(payload, { parseSpecialCharSequences: false });
  }

  if (fieldName === "password") {
    cy.get(selectors.passwordField)
      .clear()
      .type(payload, { parseSpecialCharSequences: false });
  }
}

// Génère un log d'anomalie + stockage dans le tableau
function logAnomaly(message, anomalies) {
  anomalies.push(message);
  cy.log(`⚠️ ANOMALIE DÉTECTÉE : ${message}`);
}

// Cherche les patterns XSS dans le contenu HTML / JSON
function detectPatterns(content, itemId, source, anomalies) {
  XSS_PATTERNS.forEach((pattern) => {
    if (content.toLowerCase().includes(pattern.toLowerCase())) {
      logAnomaly(
        `[${itemId}] Pattern "${pattern}" retrouvé dans ${source}`,
        anomalies,
      );
    }
  });
}

// Soft assert : log sans casser immédiatement la boucle
function softAssert(condition, message, anomalies) {
  if (!condition) {
    logAnomaly(message, anomalies);
  }
}

// Vérifie qu'aucune session n'a été créée après soumission
function checkNoAuthenticatedSession(itemId, anomalies) {
  cy.url().then((url) => {
    const redirectedToHome =
      url.includes("/home") || url.endsWith("/#/") || url.endsWith("/");

    softAssert(
      !redirectedToHome,
      `[${itemId}] Connexion possiblement réussie avec payload XSS | URL : ${url}`,
      anomalies,
    );
  });

  cy.get("body").then(($body) => {
    const logoutVisible = $body.find(selectors.logoutButton).length > 0;

    softAssert(
      !logoutVisible,
      `[${itemId}] Bouton Déconnexion visible après soumission XSS`,
      anomalies,
    );
  });

  cy.window().then((win) => {
    const localToken = win.localStorage.getItem("token");
    const sessionToken = win.sessionStorage.getItem("token");

    softAssert(
      !localToken && !sessionToken,
      `[${itemId}] Token détecté dans le storage après soumission XSS`,
      anomalies,
    );
  });
}

describe("🛡️ XSS UI+API — Formulaire de login", () => {
  beforeEach(() => {
    goToLoginPage();

    // Détection d'une éventuelle exécution JS côté front
    cy.window().then((win) => {
      cy.stub(win, "alert").as("alertStub");
      cy.stub(win, "confirm").as("confirmStub");
      cy.stub(win, "prompt").as("promptStub");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // BLOC 1 — Le front ne doit pas refléter ni exécuter le payload
  // ════════════════════════════════════════════════════════════════════════
  it("Bloc 1 - Le DOM du login ne doit pas refléter ni exécuter les payloads XSS", () => {
    const anomalies = [];

    cy.wrap(XSS_PAYLOADS).each((item) => {
      goToLoginPage();
      fillLoginForm(item.payload);
      cy.get(selectors.submitButton).click();

      // Vérifie qu'aucune popup JS ne s'est exécutée
      cy.get("@alertStub").then((stub) => {
        softAssert(
          stub.callCount === 0,
          `[${item.id}] alert() a été exécuté côté front`,
          anomalies,
        );
      });

      cy.get("@confirmStub").then((stub) => {
        softAssert(
          stub.callCount === 0,
          `[${item.id}] confirm() a été exécuté côté front`,
          anomalies,
        );
      });

      cy.get("@promptStub").then((stub) => {
        softAssert(
          stub.callCount === 0,
          `[${item.id}] prompt() a été exécuté côté front`,
          anomalies,
        );
      });

      // Vérifie que le DOM ne reflète pas de pattern dangereux
      cy.get("body").then(($body) => {
        const html = $body.html();
        detectPatterns(html, item.id, "le DOM", anomalies);
      });

      // Vérifie qu'aucune authentification n'a été créée
      checkNoAuthenticatedSession(item.id, anomalies);
    });

    cy.then(() => {
      if (anomalies.length > 0) {
        throw new Error(
          `❌ BLOC 1 — ${anomalies.length} vulnérabilité(s) front détectée(s) :\n` +
            anomalies.map((a, i) => `${i + 1}. ${a}`).join("\n"),
        );
      }

      cy.log("✅ BLOC 1 — Tous les payloads sont neutralisés côté front");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // BLOC 2 — Le backend doit rejeter les payloads XSS
  // ════════════════════════════════════════════════════════════════════════
  it("Bloc 2 - Le backend du login doit rejeter tous les payloads XSS", () => {
    const anomalies = [];

    cy.intercept("POST", "**/login").as("loginRequest");

    cy.wrap(XSS_PAYLOADS).each((item) => {
      goToLoginPage();
      fillLoginForm(item.payload);
      cy.get(selectors.submitButton).click();

      cy.wait("@loginRequest").then((interception) => {
        const status = interception.response?.statusCode;
        const body = JSON.stringify(interception.response?.body ?? "");

        // Le backend ne doit pas accepter le payload
        if ([200, 201].includes(status)) {
          logAnomaly(
            `[${item.id}] Backend a accepté le payload | HTTP ${status}`,
            anomalies,
          );
        }

        // La réponse API ne doit pas refléter de pattern dangereux
        detectPatterns(body, item.id, "la réponse API", anomalies);
      });
    });

    cy.then(() => {
      if (anomalies.length > 0) {
        throw new Error(
          `❌ BLOC 2 — ${anomalies.length} vulnérabilité(s) backend détectée(s) :\n` +
            anomalies.map((a, i) => `${i + 1}. ${a}`).join("\n"),
        );
      }

      cy.log("✅ BLOC 2 — Tous les payloads sont rejetés par le backend");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // BLOC 3 — Résistance champ par champ avec XSS-01
  // ════════════════════════════════════════════════════════════════════════
  it("Bloc 3 - Chaque champ du login doit résister individuellement au payload XSS-01", () => {
    const anomalies = [];
    const criticalPayload = XSS_PAYLOADS.find((p) => p.id === "XSS-01");

    if (!criticalPayload) {
      throw new Error("❌ Payload XSS-01 introuvable");
    }

    const fields = [
      { key: "username", label: "Email / Username" },
      { key: "password", label: "Mot de passe" },
    ];

    cy.intercept("POST", "**/login").as("fieldLoginRequest");

    cy.wrap(fields).each((field) => {
      goToLoginPage();
      fillOneField(field.key, criticalPayload.payload);
      cy.get(selectors.submitButton).click();

      cy.wait("@fieldLoginRequest").then((interception) => {
        const status = interception.response?.statusCode;
        const body = JSON.stringify(interception.response?.body ?? "");

        if ([200, 201].includes(status)) {
          logAnomaly(
            `[${field.label}] Backend a accepté XSS-01 | HTTP ${status}`,
            anomalies,
          );
        }

        detectPatterns(body, field.label, "la réponse API", anomalies);
      });

      cy.get("@alertStub").then((stub) => {
        softAssert(
          stub.callCount === 0,
          `[${field.label}] alert() a été exécuté côté front`,
          anomalies,
        );
      });

      cy.get("body").then(($body) => {
        const html = $body.html();
        detectPatterns(html, field.label, "le DOM", anomalies);
      });

      checkNoAuthenticatedSession(field.label, anomalies);
    });

    cy.then(() => {
      if (anomalies.length > 0) {
        throw new Error(
          `❌ BLOC 3 — ${anomalies.length} vulnérabilité(s) champ par champ détectée(s) :\n` +
            anomalies.map((a, i) => `${i + 1}. ${a}`).join("\n"),
        );
      }

      cy.log("✅ BLOC 3 — Les champs du login résistent à XSS-01");
    });
  });
});
