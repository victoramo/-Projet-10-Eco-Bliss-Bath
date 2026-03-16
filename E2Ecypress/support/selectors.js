export const selectors = {
  // Sélecteurs de la page de connexion
  loginButton: "[data-cy='nav-link-login']",
  usernameField: "[data-cy='login-input-username']",
  passwordField: "[data-cy='login-input-password']",
  submitButton: "[data-cy='login-submit']",
  logoutButton: "[data-cy='nav-link-logout']",

  // Sélecteurs du panier
  cartButton: "[data-cy='nav-link-cart']",
  cartLine: "[data-cy='cart-line']",
  cartLineName: "[data-cy='cart-line-name']",
  cartLineQuantity: "[data-cy='cart-line-quantity']",
  cartLineDelete: "[data-cy='cart-line-delete']",
  cartLineTotal: "[data-cy='cart-line-total']",

  // Sélecteurs page produit
  product: "[data-cy='product']",
  productButton: "[data-cy='nav-link-products']",
  productLink: "[data-cy='product-link']",
  addToCartButton: "[data-cy='detail-product-add']",
  quantityInput: "[data-cy='detail-product-quantity']",
  productStock: "[data-cy='detail-product-stock']",

  productName: "[data-cy='detail-product-name']",
};
