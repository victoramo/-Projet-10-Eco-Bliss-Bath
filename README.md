# 🌿 Eco Bliss Bath — README

![QA Automation](https://img.shields.io/badge/QA-Automation-blueviolet?style=for-the-badge)
![Cypress](https://img.shields.io/badge/Cypress-17202C?style=for-the-badge&logo=cypress&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Tests-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-Frontend-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Symfony](https://img.shields.io/badge/Symfony-API-000000?style=for-the-badge&logo=symfony&logoColor=white)

> Projet QA Automation — OpenClassrooms  
> Application e-commerce de cosmétiques écoresponsables  
> **Auteur : Aomar Boukersi — QA Engineer**

---

## 📋 Table des matières

- [1. Présentation du projet](#1-présentation-du-projet)
- [2. Périmètre de la campagne](#2-périmètre-de-la-campagne)
- [3. Stack technique](#3-stack-technique)
- [4. Architecture du projet](#4-architecture-du-projet)
- [5. Prérequis](#5-prérequis)
- [6. Installation et démarrage](#6-installation-et-démarrage)
- [7. Exécution des tests Cypress](#7-exécution-des-tests-cypress)
- [8. Génération du rapport](#8-génération-du-rapport)
- [9. Résultats de la campagne](#9-résultats-de-la-campagne)
- [10. Anomalies majeures détectées](#10-anomalies-majeures-détectées)
- [11. Documents du projet](#11-documents-du-projet)
- [12. Auteur](#12-auteur)

---

## 1. Présentation du projet

**Eco Bliss Bath** est une application e-commerce dédiée à la vente de produits de beauté écoresponsables.  
L’objectif de cette campagne est d’automatiser les contrôles les plus sensibles de l’application afin de sécuriser les parcours critiques avant mise en production.

Cette automatisation s’inscrit dans la continuité du bilan manuel initial et couvre en priorité :

- les **tests API** ;
- les **smoke tests** ;
- les **tests de sécurité XSS** ;
- les **2 scénarios fonctionnels critiques retenus** : **authentification** et **panier**.

---

## 2. Périmètre de la campagne

Les choix d’automatisation ont été guidés par le risque métier et l’impact utilisateur :

- **Authentification** : point d’entrée de l’application, indispensable à l’accès aux fonctionnalités protégées et au tunnel d’achat.
- **Panier** : cœur du processus de commande, avec impact direct sur le stock, la cohérence des données et le chiffre d’affaires.
- **API** : validation des contrats fonctionnels et des règles métier côté back-end.
- **Smoke tests** : vérification rapide de la disponibilité des parcours essentiels.
- **XSS** : contrôle de sécurité sur les champs utilisateurs exposés.

---

## 3. Stack technique

| Outil                                  | Version / type                | Rôle                                       |
| -------------------------------------- | ----------------------------- | ------------------------------------------ |
| **Cypress**                            | Framework E2E                 | Exécution des tests automatisés            |
| **JavaScript**                         | Langage                       | Implémentation des scénarios de test       |
| **@faker-js/faker**                    | Librairie                     | Génération de données de test              |
| **cypress-mochawesome-reporter**       | Reporter                      | Génération des rapports d’exécution        |
| **mochawesome-merge**                  | Utilitaire                    | Fusion des rapports JSON                   |
| **Angular**                            | Frontend SPA                  | Interface utilisateur                      |
| **Symfony**                            | API REST                      | Logique métier et endpoints                |
| **Docker**                             | Conteneurisation              | Exécution locale de l’environnement        |
| **Node.js**                            | Runtime                       | Exécution des dépendances front et Cypress |
| **Edge**                               | Navigateur                    | Exécution principale des tests             |
| **https://cloud.cypress.io/projects/** | reporting and synchronisation | Historique des campagnes                   |

---

## 4. Architecture du projet

```text
cypress/
├── e2e/
│   ├── apiTests/
│   │   ├── api-auth.cy.js
│   │   ├── api-cart.cy.js
│   │   ├── api-products.cy.js
│   │   └── api-reviews.cy.js
│   ├── smokeTests/
│   │   ├── loginSmoke.cy.js
│   │   └── productSmoke.cy.js
│   └── uiTests/
│       ├── loginTest.cy.js
│       └── cartUiTest.cy.js
├── fixtures/
├── support/
├── reports/
│   ├── html/
│   └── json/
├── screenshots/
└── videos/

cypress.config.js
package.json
```

> L’arborescence ci-dessus reprend la logique de séparation la plus lisible : **API**, **smoke** et **UI fonctionnelle**.

---

## 5. Prérequis

Avant de lancer le projet, installer :

- **Node.js** 18 ou supérieur
- **Docker Desktop**
- **Git**
- **Angular CLI** (optionnel selon votre mode de lancement)

---

## 6. Installation et démarrage

### 1. Cloner le dépôt

```bash
git clone <url-du-repository>
cd <nom-du-projet>
```

### 2. Démarrer l’environnement Docker

```bash
docker compose up -d
```

### 3. Vérifier les conteneurs actifs

```bash
docker ps
```

### 4. Lancer le frontend

Selon votre configuration locale actuelle, le front est accessible sur **http://localhost:4200**.

```bash
cd frontend
npm install
ng serve
```

### 5. Mise en place environnement test "Cypress"

Installer Cypress:
-Ouvrez un terminal de commande.
-Accédez au répertoire du projet cloné.

```bash
npm install cypress --save-dev
```

### 6. Accès local

- **Frontend** : `http://localhost:4200`
- **API / Swagger** : `http://localhost:8081/api/doc`

---

## 7. Exécution des tests Cypress

### Mode interactif

```bash
npx cypress open
```

### Mode headless

```bash
npx cypress run
```

### Lancer une suite spécifique

```bash
# API
npx cypress run --spec "cypress/e2e/apiTests/**"

# Smoke tests
npx cypress run --spec "cypress/e2e/smokeTests/**"

# UI fonctionnelle
npx cypress run --spec "cypress/e2e/uiTests/**"

# XSS / reviews
npx cypress run --spec "cypress/e2e/apiTests/api-reviews.cy.js"
```

### Scripts npm recommandés

```json
{
  "scripts": {
    "test:full": "cypress run --reporter cypress-mochawesome-reporter && npm run report:merge && npm run report:generate",
    "test:api": "cypress run --spec 'cypress/e2e/apiTests/**'",
    "test:smoke": "cypress run --spec 'cypress/e2e/smokeTests/**'",
    "test:ui": "cypress run --spec 'cypress/e2e/uiTests/**'",
    "test:xss": "cypress run --spec 'cypress/e2e/apiTests/api-reviews.cy.js'",
    "report:merge": "mochawesome-merge cypress/reports/json/*.json -o cypress/reports/merged-report.json",
    "report:generate": "marge cypress/reports/merged-report.json -f report -o cypress/reports/html",
    "report:open": "start cypress/reports/html/report.html"
  }
}
```

---

## 8. Génération du rapport

### Étape 1 — Lancer la campagne complète

```bash
npm run test:full
```

### Étape 2 — Fusionner les rapports JSON

```bash
npm run report:merge
```

### Étape 3 — Générer le rapport HTML

```bash
npm run report:generate
```

### Étape 4 — Ouvrir le rapport

```bash
npm run report:open
```

### Dossiers utiles

- `cypress/reports/html/` → rapport HTML final
- `cypress/reports/json/` → rapports JSON bruts
- `cypress/screenshots/` → captures automatiques en cas d’échec
- `cypress/videos/` → vidéos d’exécution

---

## 9. Résultats de la campagne

### Résultats globaux

| Indicateur        |      Valeur |
| ----------------- | ----------: |
| Tests exécutés    |      **53** |
| Tests réussis     |      **45** |
| Tests échoués     |       **8** |
| Taux de réussite  |  **84,9 %** |
| Durée d’exécution | **181,9 s** |
| Suites            |      **10** |

### Lecture QA

La campagne confirme que les parcours nominaux principaux sont globalement exécutables, mais met en évidence plusieurs anomalies bloquantes sur le **panier** et la **sécurité des avis**.

### Statut qualité

> **Décision QA : NO GO**  
> Une mise en production n’est pas recommandée tant que les anomalies critiques P0/P1 ne sont pas corrigées, notamment la faille XSS sur `/reviews` et les défauts de validation métier sur le panier.

---

## 10. Anomalies majeures détectées

| ID                  | Description                                             | Gravité  | Impact principal                              |
| ------------------- | ------------------------------------------------------- | -------- | --------------------------------------------- |
| **ANO-REVIEW-XSS**  | Payload XSS accepté par `POST /reviews`                 | Critique | Risque de sécurité pour les utilisateurs      |
| **ANO-CART-06**     | Dépassement de stock accepté, stock observé à `-12`     | Critique | Survente et perte financière potentielle      |
| **ANO-CART-04**     | Quantité `0` acceptée par l’API                         | Haute    | Incohérence de données de commande            |
| **ANO-CART-08**     | Quantité `> 20` acceptée sans blocage                   | Haute    | Règle métier contournée                       |
| **ANO-BACK-03**     | Bouton “Ajouter au panier” actif sur produit en rupture | Haute    | UX trompeuse et commande impossible à honorer |
| **ANO-SMOKE-LOGIN** | Sélecteur `data-cy` absent sur la page login            | Moyenne  | Smoke tests partiellement bloqués             |

### Points positifs observés

- L’**API d’authentification** est stable sur les cas principaux.
- Le scénario **authentification UI** est robuste.
- Les opérations nominales du panier fonctionnent partiellement.
- La campagne permet de distinguer clairement les anomalies **front-end** et **back-end**.

### Priorités de correction

1. Corriger la **sanitisation / validation** sur `POST /reviews`.
2. Bloquer côté back-end les quantités invalides : `0`, `> stock`, `> 20`.
3. Empêcher le passage du stock en négatif.
4. Désactiver le bouton d’ajout pour les produits en rupture.
5. Stabiliser les sélecteurs `data-cy` pour fiabiliser les smoke tests.

---

## 11. Documents du projet

Le dépôt peut inclure les livrables suivants :

- `rapport_tests_manuels.pdf` → campagne manuelle initiale
- `bilan_campagne_eco_bliss_bath_v2_final.pdf` → bilan consolidé de la campagne automatisée
- `report_final.json` → résultats détaillés de Cypress
- `cypress/reports/html/` → rapport HTML généré

---

## 12. Auteur

**Aomar Boukersi**  
QA Engineer — orientation automatisation  
Projet de formation OpenClassrooms  
Mars 2026

---

## Licence

Projet réalisé dans le cadre d’une formation professionnelle. Utilisation pédagogique et démonstrative.
