# DataFortress

A secure data management application.

## Live Site

🌐 https://ericriveraisme.github.io/DataFortress/

## Setup Instructions

### Enable GitHub Pages

To make the site accessible, you need to configure GitHub Pages in your repository settings:

1. Go to your repository on GitHub: https://github.com/ericriveraisme/DataFortress
2. Click on **Settings** tab
3. In the left sidebar, click on **Pages**
4. Under **Source**, select **GitHub Actions**
5. Save the changes

Once configured, the workflow will automatically deploy your site whenever you push to the `main` branch.

### Local Development

```bash
cd datafortress
npm install
npm run dev
```

### Build for Production

```bash
cd datafortress
npm run build
```

### Deploy Manually (if needed)

```bash
cd datafortress
npm run deploy
```

## Automatic Deployment

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the application to GitHub Pages whenever changes are pushed to the `main` branch.
