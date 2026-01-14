# System Architecture & Data Isolation

## Environments

We have established a strict separation of concerns between **Development** and **Production**.

| Feature | 💻 Local / Development | 🌍 Production / Live |
| :--- | :--- | :--- |
| **URL** | `http://localhost:3000` | `https://wot.money` |
| **Branch** | `dev` | `main` |
| **Database** | `wot-db-dev` | `wot-db` |
| **Data Scope** | Fake / Test Data | Real User Data |

## 1. Is there a connection?

### ❌ NO: Data is 100% Isolated
The **Data** (Users, Portfolios, Prices) is completely separate.
- If you delete a user in Local, nothing happens in Production.
- If you add a fake asset in Local, it does not appear in Production.
- They are like two different Excel files on two different computers.

### ✅ YES: Schema is Connected (via Git)
The **Structure** (Tables, Columns) is connected through your code deployment.
1.  You add a new column `nickname` to `schema.prisma` in Local.
2.  You run `prisma migrate dev`. Local DB gets the column.
3.  You push code to GitHub (`dev` -> `main`).
4.  Vercel deploys `main`.
5.  Vercel sees the migration and adds the `nickname` column to Production DB.

**Summary**: Code and Structure flow from Local to Prod. Data never does.

## 2. Testing Workflow

1.  **Develop Locally**: Break things, verify logic, check UI.
2.  **Push**: When code is pushed to `main`, it applies the *structure* changes to Production.
3.  **Data Safety**: Since data is isolated, your valid users in Production are safe from your "Delete All" experiments in Local.
