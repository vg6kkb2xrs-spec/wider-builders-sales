# 🚀 מדריך פריסה — Brooklyn Sales App

## מה בנינו
PWA (אפליקציה שנפתחת בדפדפן כמו אפליקציה native) עם:
- מסך סוכן: לידים, יעדים, בר התקדמות
- הוספת ליד: שם, כתובת, טלפון, סכום, תיאור
- קביעת ביקור → נכנס אוטומטית לגוגל קלנדר
- עדכון שלב עם dropdown פשוט
- כניסה עם Google (אוטומטית מחבר גוגל קלנדר)

---

## שלב 1 — Supabase (בסיס נתונים חינמי)

1. פתח חשבון ב־ https://supabase.com (חינמי)
2. צור Project חדש, שמור את הסיסמה
3. לך ל-SQL Editor → הדבק את כל התוכן מ-`supabase_schema.sql` → הרץ
4. לך ל-Settings → API → העתק:
   - `Project URL` → זה `VITE_SUPABASE_URL`
   - `anon public` key → זה `VITE_SUPABASE_ANON_KEY`

### הגדרת Google OAuth ב-Supabase
1. Authentication → Providers → Google → Enable
2. תצטרך ליצור Google OAuth App ב- https://console.cloud.google.com
   - APIs & Services → Credentials → Create OAuth Client ID
   - Application type: Web application
   - Authorized redirect URIs: `https://xxxx.supabase.co/auth/v1/callback`
3. הכנס Client ID ו-Secret ב-Supabase

### הוסף סוכנים ידנית (פעם אחת)
אחרי שכל סוכן נכנס לראשונה, הרץ ב-SQL Editor:
```sql
-- שנה את ה-id ל-uuid האמיתי מ-Authentication → Users
insert into agents (id, name, email, monthly_target, annual_target)
values
  ('uuid-של-סוכן-1', 'יוסי כהן', 'yossi@example.com', 150000, 1800000),
  ('uuid-של-סוכן-2', 'מיכל לוי', 'michal@example.com', 120000, 1440000),
  ('uuid-של-סוכן-3', 'דוד ישראלי', 'david@example.com', 100000, 1200000);
```

---

## שלב 2 — GitHub (אחסון קוד חינמי)

1. פתח חשבון ב- https://github.com
2. צור Repository חדש → `brooklyn-sales` → Public
3. הורד GitHub Desktop: https://desktop.github.com
4. Clone את ה-repo
5. העתק את כל הקבצים מהתיקייה `sales-app` לתוך ה-repo
6. Commit + Push

---

## שלב 3 — Vercel (פריסה חינמית)

1. פתח חשבון ב- https://vercel.com עם GitHub
2. New Project → בחר את `brooklyn-sales`
3. Framework: Vite (אוטומטי)
4. Environment Variables — הוסף:
   - `VITE_SUPABASE_URL` = הערך שהעתקת
   - `VITE_SUPABASE_ANON_KEY` = הערך שהעתקת
5. Deploy!

האפליקציה תקבל כתובת כמו `brooklyn-sales.vercel.app`

---

## שלב 4 — התקנה על iPhone

שלח ללינק לסוכנים בוואטסאפ:
1. פתח Safari (חייב Safari, לא Chrome)
2. לחץ על כפתור השיתוף ↑
3. "הוסף למסך הבית"
4. האפליקציה מופיעה כאייקון על המסך

---

## עלויות
| שירות | עלות |
|--------|------|
| Supabase | חינם (עד 500MB, 50K requests/month) |
| Vercel | חינם (עד 100GB bandwidth) |
| GitHub | חינם |
| דומיין (אופציונלי) | ~$10/שנה |

---

## עדכוני יעדים
כל פעם שרוצים לשנות יעד של סוכן, Supabase SQL Editor:
```sql
update agents set monthly_target = 200000, annual_target = 2400000
where name = 'יוסי כהן';
```

---

## תמיכה
כל שאלה — שלח לי screenshot ואעזור.
