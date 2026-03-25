/// <reference types="cypress" />

/*
  ============================================================
  TESTS XSS UI - FORMULAIRE D'INSCRIPTION
   - Tous les payloads testés sans interruption
  - Anomalies loguées en temps réel dans le runner
  - Helper logAnomaly() centralisé (DRY)
    ============================================================
*/

// ─── CONSTANTES ─────────────────────────────────────────────

const XSS_PATTERNS = [
  "<script",
  "onerror=",
  "onload=",
  "onfocus=",
  "javascript:",
  "expression(",
];

const REGISTER = {
  link: "[data-cy='nav-link-register']",
  lastname: "#lastname",
  firstname: "#firstname",
  email: "#email",
  password: "#password",
  confirm: "#confirm",
  submit: "[data-cy='register-submit']",
};

let xssPayloads = [];

// ─── HELPERS ────────────────────────────────────────────────

/**
 * Centralise le log des anomalies dans le runner ET dans le tableau.
 * Principe DRY — un seul endroit à modifier si le format change.
 */
function logAnomaly(message, anomalies) {
  anomalies.push(message);
  cy.log(`⚠️ ANOMALIE DÉTECTÉE : ${message}`);
}

/**
 * Soft assert — évalue une condition sans stopper le test.
 * Si la condition est fausse, logAnomaly() est appelé.
 */
function softAssert(condition, message, anomalies) {
  if (!condition) {
    logAnomaly(message, anomalies);
  }
}

/**
 * Cherche les patterns XSS dans un contenu HTML ou JSON.
 * Log chaque pattern trouvé immédiatement via logAnomaly().
 */
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

// ─── UTILITAIRES ────────────────────────────────────────────

/** Navigue vers la page d'inscription */
function goToRegister() {
  cy.visit("/");
  cy.get(REGISTER.link, { timeout: 15000 }).should("be.visible").click();
  // FIX 2 — Attendre que le champ soit visible ET activé (pas disabled)
  cy.get(REGISTER.lastname, { timeout: 15000 })
    .should("be.visible")
    .and("not.be.disabled");
}

/** Génère un email unique pour éviter les conflits entre tests */
function buildEmail(prefix = "xss") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}@test.com`;
}

/** Remplit tout le formulaire avec le payload dans nom + prénom */
function fillRegisterForm(payload, email) {
  // FIX 2 — Vérifier que chaque champ est enabled avant de taper
  cy.get(REGISTER.lastname)
    .should("not.be.disabled")
    .clear()
    .type(payload, { parseSpecialCharSequences: false });
  cy.get(REGISTER.firstname)
    .should("not.be.disabled")
    .clear()
    .type(payload, { parseSpecialCharSequences: false });
  cy.get(REGISTER.email).should("not.be.disabled").clear().type(email);
  cy.get(REGISTER.password)
    .should("not.be.disabled")
    .clear()
    .type("TestTest123!");
  cy.get(REGISTER.confirm)
    .should("not.be.disabled")
    .clear()
    .type("TestTest123!");
}

/** Remplit le formulaire avec le payload dans un seul champ ciblé */
function fillOneField(fieldName, payload, email) {
  cy.get(REGISTER.lastname).clear().type("Dupont");
  cy.get(REGISTER.firstname).clear().type("Jean");
  cy.get(REGISTER.email).clear().type(email);
  cy.get(REGISTER.password).clear().type("TestTest123!");
  cy.get(REGISTER.confirm).clear().type("TestTest123!");

  if (fieldName === "lastname") {
    cy.get(REGISTER.lastname)
      .clear()
      .type(payload, { parseSpecialCharSequences: false });
  }
  if (fieldName === "firstname") {
    cy.get(REGISTER.firstname)
      .clear()
      .type(payload, { parseSpecialCharSequences: false });
  }
}

/** Assert final groupé — échoue une seule fois avec toutes les anomalies */
function finalAssert(anomalies, blocLabel) {
  cy.then(() => {
    if (anomalies.length > 0) {
      throw new Error(
        `❌ ${blocLabel} — ${anomalies.length} vulnérabilité(s) détectée(s) :\n` +
          anomalies.map((a, i) => `  ${i + 1}. ${a}`).join("\n"),
      );
    }
    cy.log(`✅ ${blocLabel} — Aucune vulnérabilité détectée`);
  });
}

// ─── TESTS ──────────────────────────────────────────────────

describe("XSS UI - Formulaire d'inscription", () => {
  before(() => {
    cy.fixture("xss-payloads").then((data) => {
      xssPayloads = data.payloads;
    });
  });

  // ── BLOC 1 ──────────────────────────────────────────────
  it("Bloc 1 - Le DOM ne doit pas refléter les payloads XSS", () => {
    const anomalies = [];

    cy.wrap(xssPayloads).each((item) => {
      goToRegister();
      fillRegisterForm(item.payload, buildEmail("dom"));
      cy.get(REGISTER.submit).click();

      // FIX 1 — Scanner le DOM en excluant les valeurs des champs <input>/<textarea>
      // Évite les faux positifs : la valeur tapée dans un input fait partie du DOM
      cy.get("body").then(($body) => {
        const $clone = $body.clone();
        $clone.find("input, textarea, select").remove();
        detectPatterns(
          $clone.html(),
          item.id,
          "le DOM (hors champs)",
          anomalies,
        );
      });

      // Vérifie que le compte n'a pas été créé (pas de redirection)
      cy.url().then((url) => {
        const redirected =
          url.includes("/confirmation") ||
          url.includes("/home") ||
          url.endsWith("/#/");

        softAssert(
          !redirected,
          `[${item.id}] Compte créé avec payload XSS | URL : ${url}`,
          anomalies,
        );
      });
    });

    finalAssert(anomalies, "BLOC 1 — DOM");
  });
  // ── BLOC 2 ──────────────────────────────────────────────
  it("Bloc 2 - Le backend doit refuser les payloads XSS", () => {
    const anomalies = [];

    cy.intercept("POST", "**/register").as("registerRequest");

    cy.wrap(xssPayloads).each((item) => {
      goToRegister();
      fillRegisterForm(item.payload, buildEmail(`api_${item.id}`));
      cy.get(REGISTER.submit).click();

      cy.wait("@registerRequest").then((interception) => {
        const status = interception.response?.statusCode;
        const body = JSON.stringify(interception.response?.body ?? "");

        // Le backend ne doit PAS accepter le payload (200/201 = anomalie)
        softAssert(
          ![200, 201].includes(status),
          `[${item.id}] Backend a accepté le payload | HTTP ${status}`,
          anomalies,
        );

        // La réponse API ne doit pas refléter les patterns XSS
        detectPatterns(body, item.id, "la réponse API", anomalies);
      });
    });

    finalAssert(anomalies, "BLOC 2 — Backend");
  });

  // ── BLOC 3 ──────────────────────────────────────────────
  it("Bloc 3 - Chaque champ texte doit résister au payload XSS-01", () => {
    const anomalies = [];
    const criticalPayload = xssPayloads.find((p) => p.id === "XSS-01");

    if (!criticalPayload) {
      throw new Error("❌ Payload XSS-01 introuvable dans la fixture");
    }

    const fields = [
      { key: "lastname", label: "Nom" },
      { key: "firstname", label: "Prénom" },
    ];

    cy.intercept("POST", "**/register").as("fieldRegister");

    cy.wrap(fields).each((field) => {
      goToRegister();
      fillOneField(field.key, criticalPayload.payload, buildEmail(field.key));
      cy.get(REGISTER.submit).click();

      cy.wait("@fieldRegister").then((interception) => {
        const status = interception.response?.statusCode;

        // Le backend ne doit PAS accepter XSS-01 (200/201 = anomalie)
        softAssert(
          ![200, 201].includes(status),
          `[${field.label}] Backend a accepté XSS-01 | HTTP ${status}`,
          anomalies,
        );
      });

      // Le DOM ne doit pas refléter XSS-01
      cy.get("body").then(($body) => {
        detectPatterns($body.html(), field.label, "le DOM", anomalies);
      });
    });

    finalAssert(anomalies, "BLOC 3 — Champ par champ");
  });
});
