# Diario UT

Local development:

```sh
npm ci
npm run dev
```

GitHub Actions runs TypeScript checks, tests, and a production build on every push to `main`. To deploy with GitHub Pages, the repository must have Pages enabled with **GitHub Actions** as its source and the repository variable `ENABLE_GITHUB_PAGES` set to `true`.

GitHub Pages is not available for this private repository on its current plan. The deploy job therefore remains skipped while CI continues to build and test the app. Enable Pages and set the variable after the account plan supports private Pages.