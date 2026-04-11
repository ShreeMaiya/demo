# Cloudflare Proof of Concepts

A full-stack demo app built with HTML, CSS, and JavaScript, deployed on Cloudflare Pages with Pages Functions, D1, Cloudflare Queues, and a separate Durable Object-backed counter.

## Features

- ✅ Add todos
- ✅ Mark todos as complete/incomplete
- ✅ Delete todos
- ✅ Persistent storage with Cloudflare D1
- ✅ Queue-backed activity dashboard
- ✅ Durable Object counter 

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Cloudflare Pages Functions 
- **Database:** Cloudflare D1 
- **Async pipeline:** Cloudflare Queues
- **Stateful counter:** Cloudflare Durable Objects
- **Hosting:** Cloudflare Pages


## Setup

### Local Development

1. **Install Wrangler** (Cloudflare CLI)
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Create the Cloudflare resources in your account**
   - Create a D1 database named `todo-db`
   - Create a queue named `todo-analytics-queue`
   - Deploy the separate `counter-worker` project that exports the `Counter` Durable Object
   - In the Pages dashboard, add bindings for `DB`, `ANALYTICS_QUEUE`, and `COUNTER`

4. **Use `wrangler.toml` for local development or as a config reference** 
   ```toml
   name = "todo-pages-app"
   compatibility_date = "2026-03-21"
   pages_build_output_dir = "."

   [[d1_databases]]
   binding = "DB"
   database_name = "todo-db"
   database_id = "YOUR_D1_DATABASE_ID_HERE"
    ```

   Replace the placeholder only if you are using Wrangler config-driven deployment. If your collaborator uses the Cloudflare dashboard, they should add the bindings there instead.

5. **Create the queue**
   ```bash
   wrangler queues create todo-analytics-queue
   ```

6. **Create the counter Durable Object worker**
   ```bash
   cd counter-worker
   wrangler deploy
   ```

   This deploys the separate worker that exports the `Counter` Durable Object class.

7. **Initialize local D1 with schema**
   ```bash
   wrangler d1 execute DB --local --file=schema.sql
   ```

8. **Run locally**
   ```bash
   wrangler pages dev .
   ```
   Opens at `http://127.0.0.1:8788`

   To test the Durable Object binding locally, run the counter worker in another terminal with `wrangler dev` from the `counter-worker` folder, then start Pages with `wrangler pages dev . --do COUNTER=Counter@counter-worker`.

9. **Deploy the analytics consumer worker**
   ```bash
   cd analytics-consumer
   wrangler deploy
   ```

   The consumer listens to `todo-analytics-queue` and writes events into the same D1 database.

### Production Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Create D1 Database in Cloudflare**
   - Go to Cloudflare Dashboard → Storage & Databases → D1
   - Create database named `todo-db`
   - Run the SQL from `schema.sql` in the Console


3. **Connect GitHub to Cloudflare Pages**
   - Cloudflare Dashboard → Workers & Pages → Create → Pages
   - Select "Connect to Git"
   - Choose your repository
   - Build settings:
     - Framework preset: **None**
     - Build command: **(leave empty)**
     - Build output directory: **.**
   - Click **Save and Deploy**

4. **Bind D1 to Pages**
   - Open your Pages project
   - Go to **Settings** → **Functions** → **D1 bindings**
   - Click **Add binding**
   - Variable name: `DB`
   - Select your D1 database (`todo-db`)
   - Save and redeploy

5. **Bind the queue producer to Pages**
   - Open your Pages project
   - Go to **Settings** → **Functions** → **Queue bindings**
   - Click **Add binding**
   - Variable name: `ANALYTICS_QUEUE`
   - Select `todo-analytics-queue`
   - Save and redeploy

6. **Bind the Durable Object counter to Pages**
   - Open your Pages project
   - Go to **Settings** → **Functions** → **Durable Object bindings**
   - Click **Add binding**
   - Variable name: `COUNTER`
   - Durable Object namespace: the `Counter` class from the separate `counter-worker`
   - Save and redeploy

7. **Deploy the analytics consumer worker**
   - Open the `analytics-consumer` folder
   - Deploy it with Wrangler or connect it to your CI pipeline
   - Make sure it uses the same D1 database as the Pages app

## Database Schema

```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE todo_analytics_events (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   event_id TEXT NOT NULL UNIQUE,
   event_type TEXT NOT NULL,
   todo_id INTEGER,
   todo_title TEXT,
   todo_completed INTEGER,
   payload TEXT NOT NULL,
   occurred_at DATETIME NOT NULL,
   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- `id`: Unique identifier (auto-increment)
- `title`: Todo text (required)
- `completed`: Status flag (0 = incomplete, 1 = complete)
- `created_at`: Timestamp when todo was created
- `todo_analytics_events`: Queue-ingested activity log for the dashboard
- `event_id`: Unique queue event id for idempotent writes
- `event_type`: Queue event name such as `todo.created`
- `todo_id`: Todo id attached to the event
- `payload`: JSON snapshot of the event body
- `occurred_at`: Timestamp generated by the producer when the event happened

## Queue Flow

1. A todo mutation succeeds in `functions/api/todos.js`.
2. The API publishes an event to `todo-analytics-queue`.
3. The consumer worker in `analytics-consumer/src/index.js` writes the event into D1.
4. `functions/api/analytics.js` reads the aggregated activity data for the dashboard.
5. The frontend polls `/api/analytics` and shows the queue-backed activity stream.

## Counter Flow

1. The frontend calls `/api/counter` for read, increment, and reset actions.
2. `functions/api/counter.js` forwards those requests to the `COUNTER` Durable Object binding.
3. The `counter-worker` project owns the `Counter` Durable Object class and persists the counter value in its own storage.
4. The todo data path stays in D1 and the counter stays isolated in Durable Object storage.


## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Pages Functions](https://developers.cloudflare.com/pages/platform/functions/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
