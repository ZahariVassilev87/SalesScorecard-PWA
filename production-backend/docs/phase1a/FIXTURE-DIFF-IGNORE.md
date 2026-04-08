# Volatile fields — ignore when diffing baseline fixtures

When comparing two JSON fixture snapshots, **strip or ignore** these so you do not get false failures.

## Always ignore (timing / entropy)

| Path / pattern | Reason |
|----------------|--------|
| `response.token`, `response.refreshToken` | JWTs change every request (stored fixtures use `<REDACTED_*>`) |
| `request.visitDate` if it embeds `Date.now()` or ISO “now” | Intentionally unique per run |
| `request.customerName` if it contains a timestamp | Same |
| `response.*.iat`, `response.*.exp` inside decoded JWT | Not exported in API JSON; N/A unless someone decodes tokens |

## Often ignore (data-dependent)

| Path / pattern | Reason |
|----------------|--------|
| `response.id` on `POST /evaluations` success | Server-generated `eval_*` id |
| `evaluations.my.success.response[*].id` | DB-dependent ordering and ids |
| `evaluations.my.success.response[*].createdAt` | Timestamps |
| `analytics.dashboard.success.response.totalEvaluations` | Depends on how many evaluations exist |
| `analytics.dashboard.success.response.evaluationsCompleted` | Month-bound counts |
| `analytics.dashboard.success.response.averageScore` | Derived from DB state |
| Any list **length** or **order** where the API does not guarantee sort order | Compare presence of key fields instead |

## Do not ignore (parity signals)

- HTTP **status** code in the fixture wrapper (`status: 200`, etc.)
- **Error** payloads: `message`, `error`, `statusCode`, `error` codes like `INVALID_SCORE`, `Unauthorized`
- **User** object shape on login (id, email, role, companyId) for fixed seed users
- **Validation** failure fields: `itemId`, `score` on invalid evaluation item

## Suggested diff command (conceptual)

```bash
# Example: jq drop known volatile keys before diff
jq 'del(.request.visitDate, .response.id)' a.json > a.norm.json
diff -u a.norm.json b.norm.json
```

Adjust drops per endpoint.
