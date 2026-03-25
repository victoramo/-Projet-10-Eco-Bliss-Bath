/// <reference types="cypress" />

/*
  ════════════════════════════════════════════════════════════
  TEST API — XSS + SQLi — Formulaire d'inscription
  
  OBJECTIF RÉEL DE CE TEST :
  Vérifier que l'API backend Symfony ne fuit pas d'informations
  techniques dangereuses (erreurs SQL, stack traces) en réponse
  à des payloads malveillants.
  
  COMPLÉMENTARITÉ API + UI :
  - Test API  → vérifie que le backend ne fuit pas d'infos sensibles
  - Test UI   → vérifie que le frontend ne reflète pas les payloads
  ════════════════════════════════════════════════════════════
*/

// ─── PATTERNS DANGEREUX À DÉTECTER ──────────────────────────

// Si ces mots apparaissent dans la réponse → fuite d'info technique
const XSS_PATTERNS = [
  "<script",
  "onerror=",
  "onload=",
  "onfocus=",
  "javascript:",
  "expression(",
];

const SQL_PATTERNS = [
  "syntax error",
  "sql",
  "mysql",
  "sqlite",
  "postgresql",
  "ora-",
  "uncaught exception",
];

// ─── PAYLOADS SQL ────────────────────────────────────────────

const SQL_PAYLOADS = [
  { id: "SQL-01", description: "Classic OR bypass", payload: "' OR '1'='1" },
  {
    id: "SQL-02",
    description: "Drop table",
    payload: "'; DROP TABLE users;--",
  },
  { id: "SQL-03", description: "Comment bypass", payload: "admin'--" },
  {
    id: "SQL-04",
    description: "Union select",
    payload: "' UNION SELECT null,null,null--",
  },
  { id: "SQL-05", description: "Blind boolean", payload: "' AND 1=1--" },
];

// ─── HELPER : vérifier la réponse ───────────────────────────

/*
  On vérifie 2 choses :
  1. Le backend répond bien avec une erreur (pas 200/201)
  2. La réponse ne contient aucun mot-clé technique dangereux
     → pas de fuite de stack trace, pas de message SQL exposé
*/
function checkResponse(res, item, patterns) {
  // Le compte ne doit pas être créé
  expect(
    res.status,
    `${item.id} — ne doit pas créer de compte`,
  ).to.not.be.oneOf([200, 201]);

  // La réponse ne doit pas exposer d'informations techniques sensibles
  const body = JSON.stringify(res.body).toLowerCase();
  patterns.forEach((pattern) => {
    expect(
      body,
      `${item.id} — réponse ne doit pas contenir "${pattern}"`,
    ).to.not.include(pattern.toLowerCase());
  });

  cy.log(
    `✅ ${item.id} (${item.description}) — HTTP ${res.status} — Aucune fuite détectée`,
  );
}

// ─── TESTS ──────────────────────────────────────────────────

describe("XSS + SQLi API — Sécurité du backend Symfony", () => {
  const apiUrl = Cypress.env("apiUrl"); // http://localhost:8081

  // ══ BLOC 1 — XSS ══════════════════════════════════════════
  context("BLOC 1 — XSS : le backend ne doit pas refléter les payloads", () => {
    let xssPayloads = [];

    before(() => {
      cy.fixture("xss-payloads").then((data) => {
        xssPayloads = data.payloads;
      });
    });

    it("Vérifie que les 15 payloads XSS ne fuient pas dans la réponse API", () => {
      xssPayloads.forEach((item) => {
        cy.request({
          method: "POST",
          url: `${apiUrl}/register`,
          headers: { "Content-Type": "application/json" },
          body: {
            lastname: item.payload,
            firstname: item.payload,
            email: `xss_${item.id}_${Date.now()}@test.com`,
            plainpassword: {
              first: item.payload, // payload aussi dans le mot de passe
              second: item.payload,
            },
          },
          failOnStatusCode: false,
        }).then((res) => {
          checkResponse(res, item, XSS_PATTERNS);
        });
      });
    });
  });

  // ══ BLOC 2 — SQLi ═════════════════════════════════════════
  context(
    "BLOC 2 — SQLi : le backend ne doit pas exposer d'erreurs SQL",
    () => {
      it("Vérifie que les 5 payloads SQL ne provoquent pas de fuite technique", () => {
        SQL_PAYLOADS.forEach((item) => {
          cy.request({
            method: "POST",
            url: `${apiUrl}/register`,
            headers: { "Content-Type": "application/json" },
            body: {
              lastname: item.payload,
              firstname: item.payload,
              email: `sqli_${item.id}_${Date.now()}@test.com`,
              plainpassword: {
                first: item.payload,
                second: item.payload,
              },
            },
            failOnStatusCode: false,
          }).then((res) => {
            checkResponse(res, item, SQL_PATTERNS);
          });
        });
      });
    },
  );
});
