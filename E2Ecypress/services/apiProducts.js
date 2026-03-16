const apiProducts = `${Cypress.env("apiUrl")}/products`;

export const getProducts = (token) => {
  return cy.request({
    method: "GET",
    url: apiProducts,
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getRandomProduct = (token) => {
  return cy.request({
    method: "GET",
    url: `${apiProducts}/random`,
    headers: { Authorization: `Bearer ${token}` },
  });
};
