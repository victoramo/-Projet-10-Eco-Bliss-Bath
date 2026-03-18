// E2Ecypress/e2e/apiTests/api-xss-auth.cy.js

// Assertions XSS à vérifier dans la réponse backend
const XSS_PATTERNS = [
  "<​script>",
  "onerror=",
  "onload=",
  "onfocus=",
  "javascript:",
  "expression(",
];

describe("XSS API - Injection formulaire authentification", () => {
  const apiUrl = Cypress.env("apiUrl");

  // ── Chargement de la fixture avant tous les tests ─────────────────────
  before(function () {
    cy.fixture("xss-payloads").then((data) => {
      this.xssPayloads = data.payloads;
    });
  });

  // ── Itération dynamique sur les 15 payloads ───────────────────────────
  // Utilise beforeEach + context pour contourner la limite du forEach
  // avec cy.fixture() (this n'est pas disponible dans forEach au niveau describe)
  it("Vérifie que les 15 payloads XSS sont bloqués par l'API", function () {
    // On boucle dans un seul it() pour éviter le problème de this dans forEach
    this.xssPayloads.forEach((item) => {
      cy.request({
        method: "POST",
        url: `${apiUrl}/login`,
        headers: { "Content-Type": "application/json" },
        body: {
          username: item.payload,
          password: item.payload,
        },
        failOnStatusCode: false,
      }).then((res) => {
        // ── Le payload XSS ne doit jamais authentifier ────────────────
        expect(res.status, `${item.id} - statut doit être 401`).to.eq(401);

        // ── La réponse ne doit pas refléter le payload brut ───────────
        const body = JSON.stringify(res.body);
        XSS_PATTERNS.forEach((pattern) => {
          expect(
            body,
            `${item.id} - réponse ne doit pas contenir "${pattern}"`,
          ).to.not.include(pattern);
        });

        cy.log(
          `✅ ${item.id} (${item.description}) bloqué — HTTP ${res.status}`,
        );
      });
    });
  });
});
