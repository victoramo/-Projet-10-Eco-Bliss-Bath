// E2Ecypress/e2e/uiTests/ui-xss-auth.cy.js

const XSS_PAYLOADS = [
  {
    id: "XSS-01",
    label: "Script basique",
    payload: "<script>alert('xss')</script>",
  },
  {
    id: "XSS-02",
    label: "Image onerror",
    payload: "<​img src=x onerror=alert(1)>",
  },
  {
    id: "XSS-03",
    label: "Javascript URI",
    payload: "javascript:alert(document.cookie)",
  },
];

function forceLogout() {
  cy.clearLocalStorage();
  cy.clearCookies();
  cy.window().then((win) => {
    win.sessionStorage.clear();
    win.localStorage.clear();
  });
}

describe("🛡️ XSS UI+API — Formulaire login", () => {
  beforeEach(() => {
    // ── ÉTAPE 1 : Vider le storage sur la page d'accueil ─────────────
    cy.visit("/");
    forceLogout();

    // ── ÉTAPE 2 : Tenter cy.visit('/login') ───────────────────────────
    cy.visit("/login");

    // ── ÉTAPE 3 : Vérifier l'URL réelle après visite ──────────────────
    cy.url({ timeout: 5000 }).then((url) => {
      if (url.includes("/login")) {
        // ✅ Cas normal : Angular a bien chargé /login
        cy.log("✅ Route /login accessible directement");
      } else {
        // ❌ Angular a redirigé (vers / ou autre)
        // → On cherche le lien "Connexion" dans la navbar pour naviguer
        cy.log("⚠️ Redirigé vers : " + url + " — navigation via navbar");

        // Cas 1 : utilisateur connecté → clic Déconnexion d'abord
        cy.get("body").then(($body) => {
          if ($body.find('a[data-cy="nav-link-logout"]').length > 0) {
            cy.get('a[data-cy="nav-link-logout"]').click();
            cy.wait(1500);
          }
        });

        // Cas 2 : cliquer sur "Connexion" dans la navbar
        cy.get('a[data-cy="nav-link-login"]', { timeout: 8000 })
          .should("be.visible")
          .click();
      }
    });

    // ── ÉTAPE 4 : Le formulaire doit être présent ─────────────────────
    cy.url({ timeout: 10000 }).should("include", "/login");
    cy.get('[data-cy="login-form"]', { timeout: 15000 }).should("exist");
  });

  XSS_PAYLOADS.forEach(({ id, label, payload }) => {
    it(`${id} - ${label}`, () => {
      cy.on("window:alert", (txt) => {
        throw new Error(`🚨 XSS exécuté côté front : ${txt}`);
      });

      cy.get('[data-cy="login-input-username"]')
        .clear()
        .type(payload, { parseSpecialCharSequences: false });

      cy.get('[data-cy="login-input-password"]')
        .clear()
        .type(payload, { parseSpecialCharSequences: false });

      cy.get('[data-cy="login-submit"]').click();

      // ── Vérification FRONT ────────────────────────────────────────
      cy.get("body").should("not.contain", "<​script>");
      cy.get("body").should("not.contain", "onerror=");
      cy.get("body").should("not.contain", "javascript:");

      // ── Vérification BACK ─────────────────────────────────────────
      cy.request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}/login`,
        headers: { "Content-Type": "application/json" },
        body: { username: payload, password: payload },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status, "Backend doit rejeter le payload XSS").to.eq(401);
        const body = JSON.stringify(res.body);
        expect(body).to.not.include("<​script>");
        expect(body).to.not.include("onerror=");
        expect(body).to.not.include("javascript:");
        cy.log(`✅ ${id} bloqué — Front ✔ | Back HTTP ${res.status} ✔`);
      });

      cy.screenshot(`${id}-bloque`, { capture: "runner" });
    });
  });
});
