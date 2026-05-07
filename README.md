# polinka

Статический React/Vite сайт для учета трат.

## Локально

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
```

Готовые файлы будут в `dist/`.

## GitHub Pages

В проект уже добавлен workflow для автодеплоя в GitHub Pages:

- [deploy.yml](./.github/workflows/deploy.yml)

После пуша в `main` сайт будет собираться и публиковаться автоматически.

### Быстрый запуск

1. Создай новый репозиторий на GitHub.
2. Запушь этот проект в ветку `main`.
3. На GitHub открой `Settings -> Pages`.
4. В `Build and deployment` выбери `Source -> GitHub Actions`.
5. Дождись завершения workflow `Deploy to GitHub Pages`.

Если репозиторий называется `<username>.github.io`, сайт откроется по:

- `https://<username>.github.io/`

Если репозиторий называется как угодно иначе, сайт откроется по:

- `https://<username>.github.io/<repo>/`
