# Сімейна дошка завдань

Мінімальний прототип для одного користувача з моделлю, підготовленою до БД.

## Що вже є

- користувач `admin`
- створення завдання з назвою, нагородою, деталями, дедлайном від створення, апрувом і повторюваністю
- стани `available`, `in_progress`, `done`, `approved`
- збереження того, хто взяв завдання і коли
- показ часу, скільки завдання вже в роботі
- автонарахування нагороди після апруву
- агрегати користувача: `completedTasksCount`, `balance`
- журнал нарахувань `rewardTransactions`
- магазин нагород з вартістю, запасом, доступністю за часом і лімітом на користувача
- історія користувача: завдання, покупки, рух валюти
- SQL-схема у `schema.sql`

## Як відкрити

Відкрий `index.html` у браузері. Дані зберігаються в `localStorage`.

Якщо заповнити `config.js`, дані зберігаються в Supabase і синхронізуються між пристроями.

## Користувач через URL

- Адмін: `?user=admin`
- Дитина або інший звичайний користувач: `?user=Марко`

`admin` зарезервований для адміна. Будь-яке інше значення створює або відкриває звичайного користувача з таким імʼям. У цьому статичному MVP дані все ще живуть у `localStorage` конкретного браузера, тому для спільних даних між планшетом і телефоном наступним кроком потрібен бекенд або hosted БД.

## GitHub Pages

Деплой налаштований через GitHub Actions у `.github/workflows/pages.yml`. Після пушу в `main` треба увімкнути Pages для репозиторію з джерелом `GitHub Actions`.

## Supabase

1. Створи Supabase project.
2. Виконай SQL з `schema.sql` у Supabase SQL Editor.
3. У `Authentication -> Users` створи адміна з email/password.
4. Додай email адміна в SQL Editor:

```sql
insert into app_admins (email)
values ('admin@example.com');
```

5. Заповни `config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://your-project-id.supabase.co",
  supabaseAnonKey: "your-anon-or-publishable-key",
};
```

`?user=admin` відкриває адмінський режим, але форми створення/апруву/редагування валюти доступні тільки після входу через Supabase Auth. `?user=Марко` створює або відкриває звичайного користувача без логіну.

Після вмикання авторизації виконай `migrations/001_require_auth.sql`, якщо схема вже була створена раніше. Вона закриває читання/запис для anonymous clients: без Supabase session дані не видно.

Якщо схема вже була створена до того, як дедлайн завдання став опціональним, також виконай `migrations/002_optional_task_deadline.sql`.

Для призначення завдань конкретним користувачам і складності виконай `migrations/003_task_assignment_and_difficulty.sql`.

Для дитячого планшета можна зробити Supabase Auth user і відкривати URL так:

```txt
https://vitaliykovshikov.github.io/family-task-board/?user=Марко&email=child@example.com&password=child-password
```

Це компроміс для MVP: пароль у URL видно в історії браузера. Зате планшет відкривається одразу в дитячому режимі без форми логіну.

`?user=admin` теж нічого не показує без входу. Якщо активна неадмінська session, адмінська сторінка все одно лишається закритою, доки не увійде email з `app_admins`.

## Наступний технічний крок

Перенести операції `complete -> approve -> reward transaction -> user balance update` та покупки нагород у Supabase RPC або бекенд і виконувати їх в одній транзакції БД.
