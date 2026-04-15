# Развёртывание на Vercel — пошагово

## Шаг 1. Подготовка репозитория (если ещё нет Git)

```bash
cd "c:\Users\Xarda\OneDrive\Рабочий стол\Проекты\УВК"
git init
git add .
git commit -m "Initial commit"
```

## Шаг 2. GitHub

1. Создайте репозиторий на [github.com](https://github.com) (New repository).
2. Подключите локальный проект:

```bash
git remote add origin https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПОЗИТОРИЯ.git
git branch -M main
git push -u origin main
```

## Шаг 3. Vercel

1. Зайдите на [vercel.com](https://vercel.com) и войдите (через GitHub).
2. Нажмите **Add New** → **Project**.
3. Импортируйте репозиторий с GitHub.
4. Vercel определит проект как Vite — оставьте настройки по умолчанию.
5. В разделе **Environment Variables** добавьте:

   | Имя                  | Значение                          |
   |----------------------|-----------------------------------|
   | `VITE_SUPABASE_URL`  | URL вашего Supabase-проекта       |
   | `VITE_SUPABASE_ANON_KEY` | Anon Key из Supabase         |

6. Нажмите **Deploy**.

## Шаг 4. Supabase

В Supabase → **Authentication** → **URL Configuration** добавьте в **Site URL** и **Redirect URLs** адрес вашего приложения на Vercel, например:

- `https://ваш-проект.vercel.app`

## Шаг 5. Обновления

При каждом `git push` в `main` Vercel будет автоматически пересобирать и обновлять приложение.
