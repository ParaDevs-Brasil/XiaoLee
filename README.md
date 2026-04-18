# Xiaolee

Xiaolee is a multi-service assistant project that combines a Next.js front end with Python services for automation, monitoring, and backend workflows.

## Stack

- Next.js 15 with React 19
- TypeScript
- Python services and scripts
- Tailwind CSS

## Development

Install dependencies:

```bash
npm install
pip install -r requirements.txt
```

Run the web app:

```bash
npm run dev
```

Common scripts:

```bash
npm run build
npm run start
npm run lint
```

## Project Layout

- src/ contains the Next.js UI
- flask_api/ and server/ contain Python backend services
- services/, swaps/, blockchain/, and user_management/ hold domain logic
- scripts/ contains utility and maintenance scripts
- tests/ contains automated checks

## Notes

The repository is intended to be committed from the project root, and .gitignore excludes the usual local build and environment artifacts.
