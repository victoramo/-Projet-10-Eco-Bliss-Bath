const apiUrl = Cypress.env("apiUrl");

export const login = (username, password, failOnStatusCode = false) => {
  return cy.request({
    method: "POST",
    url: `${apiUrl}/login`,
    body: { username, password },
    failOnStatusCode: failOnStatusCode,
  });
};

export const register = (
  lastname,
  firstname,
  email,
  password,
  failOnStatusCode = false,
) => {
  return cy.request({
    method: "POST",
    url: `${apiUrl}/register`,
    body: {
      lastname,
      firstname,
      email,
      plainPassword: { first: password, second: password },
    },
    failOnStatusCode: failOnStatusCode,
  });
};
