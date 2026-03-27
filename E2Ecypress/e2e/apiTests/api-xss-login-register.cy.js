/// <reference types="cypress" />

/*
  ════════════════════════════════════════════════════════════════════
  TEST API CONSOLIDÉ — XSS + SQLi — Login & Inscription
  Fichier : cypress/e2e/apiTests/api-xss-auth.cy.js

  OBJECTIF :
  Vérifier que le backend Symfony résiste aux payloads malveillants
  envoyés directement via l'API sur les deux endpoints critiques :
    - POST /login      → authentification
    - POST /register   → création de compte

  STRATÉGIE :
  - Payloads XSS : sélection des 8 plus dangereux et les plus difficiles
    à détecter par Angular (sanitization) et Symfony (validation)
  - Payloads SQLi : 5 injections classiques ciblant l'ORM Doctrine
  - 3 vérifications par requête : statut HTTP, réponse backend, log Cypress
  ════════════════════════════════════════════════════════════════════
*/

// ─── PATTERNS DE DÉTECTION ──────────────────────────────────────────

// Patterns XSS : si l'un d'eux apparaît dans la réponse Symfony
// → le payload a été reflété brut → faille potentielle
const XSS_PATTERNS = [
  "<script", // balise script classique
  "onerror=", // handler d'événement sur balise img/input
  "onload=", // handler sur svg/body/iframe
  "onfocus=", // handler déclenché sans clic (autofocus)
  "javascript:", // pseudo-protocole dans href/src
  "expression(", // CSS expression() — vieux IE mais encore testé
  "data:text", // data URI pouvant embarquer du JS
  "vbscript:", // vecteur IE legacy encore présent dans certains WAF bypass
];

// Patterns SQL : si l'un d'eux apparaît dans la réponse Symfony
// → fuite d'information technique → erreur de configuration backend
const SQL_PATTERNS = [
  "syntax error",
  "sql",
  "mysql",
  "sqlite",
  "postgresql",
  "ora-",
  "uncaught exception",
  "doctrine", // fuite ORM Symfony spécifique
  "dbal", // fuite couche d'abstraction Doctrine
];

// ─── PAYLOADS XSS ───────────────────────────────────────────────────
/*
  Sélection des 8 payloads les plus dangereux et les plus difficiles
  à détecter par Angular DomSanitizer et Symfony validator :

  - XSS-A : <script> classique — détecté par Angular mais pas toujours
             par Symfony si le champ n'est pas validé côté serveur
  - XSS-B : <img onerror> — contourne les filtres qui bloquent <script>
             Angular échappe le innerHTML mais pas les attributs dynamiques
  - XSS-C : <svg onload> — vecteur SVG souvent ignoré par les WAF basiques
  - XSS-D : javascript: dans un attribut href — Angular le bloque en template
             mais pas forcément via l'API directe
  - XSS-E : <input autofocus onfocus> — s'exécute SANS interaction utilisateur
             très difficile à détecter car pas de clic requis
  - XSS-F : data URI base64 — encode le payload en base64 pour contourner
             les filtres textuels de Symfony (le pattern n'est pas lisible)
  - XSS-G : CSS expression() — vecteur legacy mais encore présent dans
             les tests de sécurité car certains backends ne le filtrent pas
  - XSS-H : Payload polyglotte — fonctionne dans plusieurs contextes
             (HTML, JS, attribut) simultanément → le plus difficile à bloquer
*/
const XSS_PAYLOADS = [
  {
    id: "XSS-A",
    description: "Script tag classique",
    payload: "<script>alert('XSS')</script>",
  },
  {
    id: "XSS-B",
    description: "Image onerror — contourne les filtres script",
    payload: "<​img src=x onerror=alert('XSS')>",
  },
  {
    id: "XSS-C",
    description: "SVG onload — vecteur SVG ignoré par WAF basiques",
    payload: "<​svg/onload=alert('XSS')>",
  },
  {
    id: "XSS-D",
    description: "javascript: URI — contourne Angular en appel API direct",
    payload: "javascript:alert('XSS')",
  },
  {
    id: "XSS-E",
    description: "Autofocus onfocus — exécution sans interaction utilisateur",
    payload: "<​input autofocus onfocus=alert('XSS')>",
  },
  {
    id: "XSS-F",
    description: "Data URI base64 — payload encodé, filtre textuel contourné",
    payload:
      "<iframe src='data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4='></iframe>",
  },
  {
    id: "XSS-G",
    description: "CSS expression() — vecteur legacy non filtré par Symfony",
    payload: "<​div style=\"width:expression(alert('XSS'))\">",
  },
  {
    id: "XSS-H",
    description:
      "Polyglotte — fonctionne en HTML, JS et attribut simultanément",
    payload: "'\"><img src=x onerror=alert('XSS')><!--",
  },
];

// ─── PAYLOADS SQLi ──────────────────────────────────────────────────
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

// ─── HELPERS ────────────────────────────────────────────────────────

/*
  buildRegisterBody() — construit le body pour POST /register
  Le payload est injecté dans lastname et firstname uniquement.
  Le mot de passe est volontairement valide pour que la requête
  atteigne réellement la validation des champs nom/prénom côté Symfony.
  Un email unique (timestamp) évite les conflits entre itérations.
*/
function buildRegisterBody(payload, prefix) {
  return {
    lastname: payload,
    firstname: payload,
    email: `${prefix}_${Date.now()}@test.com`,
    plainpassword: {
      first: "TestTest123!",
      second: "TestTest123!",
    },
  };
}

/*
  buildLoginBody() — construit le body pour POST /login
  Le payload est injecté dans username ET password.
  Objectif : vérifier que Symfony retourne 401 sans refléter le payload.
*/
function buildLoginBody(payload) {
  return {
    username: payload,
    password: payload,
  };
}

/*
  checkResponse() — vérifications communes à tous les tests
  1. Le statut HTTP ne doit pas être 200 ou 201 (pas de succès)
  2. La réponse sérialisée ne doit contenir aucun pattern dangereux
  3. Un log Cypress confirme le résultat pour le rapport
*/
function checkResponse(
  res,
  item,
  patterns,
  expectedStatuses = [401, 400, 422],
) {
  // Vérification 1 — statut HTTP : doit être un refus explicite
  expect(
    res.status,
    `${item.id} — statut attendu parmi ${expectedStatuses.join("/")}`,
  ).to.be.oneOf(expectedStatuses);

  // Vérification 2 — la réponse ne doit pas refléter de pattern dangereux
  const body = JSON.stringify(res.body).toLowerCase();
  patterns.forEach((pattern) => {
    expect(
      body,
      `${item.id} — réponse ne doit pas contenir "${pattern}"`,
    ).to.not.include(pattern.toLowerCase());
  });

  // Log de résultat dans le runner Cypress
  cy.log(
    `✅ ${item.id} (${item.description}) — HTTP ${res.status} — Aucune fuite`,
  );
}

// ─── SUITE DE TESTS ─────────────────────────────────────────────────

describe("API Sécurité — XSS + SQLi — Login & Inscription (Symfony)", () => {
  const apiUrl = Cypress.env("apiUrl"); // http://localhost:8081

  // ══════════════════════════════════════════════════════════════════
  // BLOC 1 — XSS sur POST /login
  // Vérifie que les 8 payloads XSS sont refusés par Symfony
  // et ne sont pas reflétés dans la réponse
  // ══════════════════════════════════════════════════════════════════
  context("BLOC 1 — XSS Login : POST /login doit refuser les payloads", () => {
    it("Les 8 payloads XSS sont bloqués sur /login (HTTP 401)", () => {
      XSS_PAYLOADS.forEach((item) => {
        cy.request({
          method: "POST",
          url: `${apiUrl}/login`,
          headers: { "Content-Type": "application/json" },
          body: buildLoginBody(item.payload),
          // failOnStatusCode: false → Cypress ne crash pas sur 4xx/5xx
          // indispensable ici car on attend volontairement des erreurs
          failOnStatusCode: false,
        }).then((res) => {
          // Login avec payload XSS → toujours 401 (jamais authentifié)
          checkResponse(res, item, XSS_PATTERNS, [401]);
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // BLOC 2 — XSS sur POST /register
  // Vérifie que les 8 payloads XSS dans lastname/firstname
  // ne créent pas de compte et ne fuient pas dans la réponse
  // ══════════════════════════════════════════════════════════════════
  context(
    "BLOC 2 — XSS Register : POST /register doit refuser les payloads",
    () => {
      it("Les 8 payloads XSS sont bloqués sur /register (HTTP 400/422)", () => {
        XSS_PAYLOADS.forEach((item) => {
          cy.request({
            method: "POST",
            url: `${apiUrl}/register`,
            headers: { "Content-Type": "application/json" },
            body: buildRegisterBody(item.payload, `xss_${item.id}`),
            failOnStatusCode: false,
          }).then((res) => {
            // Register avec payload XSS → 400 ou 422 (validation refusée)
            // 201 serait une anomalie critique (compte créé avec payload XSS)
            checkResponse(res, item, XSS_PATTERNS, [400, 422, 500]);
          });
        });
      });
    },
  );

  // ══════════════════════════════════════════════════════════════════
  // BLOC 3 — SQLi sur POST /login
  // Vérifie que les injections SQL ne bypassent pas l'authentification
  // et ne provoquent pas de fuite d'erreur Doctrine/MySQL
  // ══════════════════════════════════════════════════════════════════
  context(
    "BLOC 3 — SQLi Login : POST /login doit résister aux injections SQL",
    () => {
      it("Les 5 payloads SQLi sont bloqués sur /login (HTTP 401)", () => {
        SQL_PAYLOADS.forEach((item) => {
          cy.request({
            method: "POST",
            url: `${apiUrl}/login`,
            headers: { "Content-Type": "application/json" },
            body: buildLoginBody(item.payload),
            failOnStatusCode: false,
          }).then((res) => {
            // SQLi sur login → 401 attendu, jamais 200 (bypass interdit)
            checkResponse(res, item, SQL_PATTERNS, [401]);
          });
        });
      });
    },
  );

  // ══════════════════════════════════════════════════════════════════
  // BLOC 4 — SQLi sur POST /register
  // Vérifie que les injections SQL dans les champs nom/prénom
  // ne provoquent pas de fuite Doctrine ni de création de compte
  // ══════════════════════════════════════════════════════════════════
  context(
    "BLOC 4 — SQLi Register : POST /register doit résister aux injections SQL",
    () => {
      it("Les 5 payloads SQLi sont bloqués sur /register (HTTP 400/422)", () => {
        SQL_PAYLOADS.forEach((item) => {
          cy.request({
            method: "POST",
            url: `${apiUrl}/register`,
            headers: { "Content-Type": "application/json" },
            body: buildRegisterBody(item.payload, `sqli_${item.id}`),
            failOnStatusCode: false,
          }).then((res) => {
            checkResponse(res, item, SQL_PATTERNS, [400, 422, 500]);
          });
        });
      });
    },
  );
});
