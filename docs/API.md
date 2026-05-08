# Dobby API — How to use it

**Production web app:** [https://dobby.now](https://dobby.now)  

**This guide on the site:** [https://dobby.now/docs/api](https://dobby.now/docs/api)

You can also use a locale prefix (for example [https://dobby.now/zh/docs/api](https://dobby.now/zh/docs/api))—the page follows your language preference from the app as well.

There is no implementation detail here—only how to call the HTTP API.

---

## Mental model (like OpenAI)

| | OpenAI | Dobby |
|---|--------|--------|
| Base | `https://api.openai.com/v1` | **`https://dobby.now/v1`** (production) |
| Typical script auth | `Authorization: Bearer sk-…` | **`X-API-Key: pk_…:sk_…`** or **`Authorization: Bearer <access_token>`** |
| Bodies | Usually JSON | Usually JSON; **some** routes use **form** fields |

---

## Base URL

Every integration path is under **`/v1`**.

**Production integrations:** **`https://dobby.now/v1`** — use this prefix for every snippet below.

**Local development:** if you run the API on your machine, point curl or fetch at your local **`/v1`** URL (often **`http://localhost:8000/v1`**) instead—the documented URLs intentionally stay on **dobby.now**.

---

## Authentication

Use **one** method per request:

### API key (integrations)

- Header: **`X-API-Key`**
- Value: **`pk_<public>:sk_<secret>`** (one string, colon in the middle)

```bash
curl -sS -H "X-API-Key: pk_xxx:sk_yyy" \
  "https://dobby.now/v1/threads"
```

Create keys after signing in at **https://dobby.now** → **Settings → API keys**.

### Bearer token (signed-in app)

- Header: **`Authorization: Bearer <access_token>`**

Use the access token from signing in to the web app.

---

## Request format

- **GET** — query parameters only; include auth headers.
- **POST / PATCH with JSON** — `Content-Type: application/json` + UTF-8 JSON body.
- **POST with form** — e.g. **`POST /v1/threads`** sends field **`name`** as form data (use `curl -F` or `FormData` in JS).

Responses are normally JSON with **200** / **201** on success.

---

## Examples

Production **`/v1`** base: **`https://dobby.now/v1`**. For local development only, substitute your local **`/v1`** URL.

### List threads

```bash
curl -sS -H "X-API-Key: pk_xxx:sk_yyy" \
  "https://dobby.now/v1/threads"
```

### Create a message (JSON body)

Fields: **`type`**, **`content`**, optional **`is_llm_message`** (boolean).

```bash
curl -sS -X POST "https://dobby.now/v1/threads/THREAD_ID/messages" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_xxx:sk_yyy" \
  -d '{"type":"user","content":"Hello","is_llm_message":true}'
```

### Create a thread (form field `name`)

```bash
curl -sS -X POST "https://dobby.now/v1/threads" \
  -H "X-API-Key: pk_xxx:sk_yyy" \
  -F 'name=My conversation'
```

### JavaScript (`fetch`)

```javascript
const apiBase = 'https://dobby.now/v1';
const apiKey = process.env.DOBBY_API_KEY;

const res = await fetch(`${apiBase}/threads`, {
  method: 'GET',
  headers: { 'X-API-Key': apiKey },
});

const data = await res.json();
if (!res.ok) throw new Error(JSON.stringify(data));
```

---

## Errors

Failures return JSON with a 4xx or 5xx status, often:

```json
{ "detail": "…" }
```

or structured `detail` objects (for example limits or billing). Check **`response.ok`** / status before assuming success.

---

## Interactive docs (optional)

When exposed on **https://dobby.now**:

- **Swagger UI:** [https://dobby.now/docs](https://dobby.now/docs)
- **OpenAPI JSON:** [https://dobby.now/openapi.json](https://dobby.now/openapi.json)

Those URLs may return errors if only **`/v1`** is published publicly—integrations should rely on the **`/v1`** paths above.
