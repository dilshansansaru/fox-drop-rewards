# 🔥 Firebase Rules දාන විදිහ (FOXDROP)

App එක දැන් **online-only** — Firestore connect නොවුණොත් offline mode එකක් නෑ, error එකක් පේනවා.
ඒ නිසා rules deploy කරන එක අනිවාර්යයි.

## 1. Firestore Database එක සාදන්න (එක පාරක්)

1. <https://console.firebase.google.com> → project **foxdrop-e9cad**.
2. වම් පැත්තේ **Build → Firestore Database** → **Create database**.
3. **Start in production mode** තෝරන්න → location: `eur3` හෝ ඔබට ආසන්නම එක → **Enable**.

## 2. Rules paste කරන්න

1. Firestore Database → උඩ tab වලින් **Rules**.
2. එතන තියෙන සියල්ල **delete** කරන්න.
3. මේ repo එකේ `firestore.rules` file එකේ **සම්පූර්ණ content** copy කරලා paste කරන්න.
4. **Publish** click කරන්න. තත්පර 10-30කින් live වෙනවා.

## 3. Web app / API key එක නිවැරදිද බලන්න

Project Settings → General → Your apps → Web app එකේ config එක
`src/lib/firebase.ts` එකේ තියෙන එකට සමානද බලන්න (projectId = `foxdrop-e9cad`).

## 4. Mini App එකෙන් test කරන්න

1. Telegram එකේ mini app එක open කරන්න.
2. Home tab එකේ balance load වුණාද බලන්න.
3. Firebase Console → Firestore → **Data** → `users` collection එකේ ඔබේ Telegram id
   document එකක් හැදෙන්න ඕනේ.
4. Admin tab (id `5419054691`) එකේ Users / Stats counts පේනවා නම් සියල්ල online.

## 5. Error එකක් ආවොත්

| Error | හේතුව | විසඳුම |
| --- | --- | --- |
| `Missing or insufficient permissions` | rules publish වෙලා නෑ | Step 2 නැවත කරන්න |
| `Failed to get document because the client is offline` | Firestore database create වෙලා නෑ | Step 1 |
| `The query requires an index` | composite index එකක් අවශ්‍ය | error message එකේ link එක click කරලා **Create index** |

## 6. Collections

| Collection | Doc id | Purpose |
| --- | --- | --- |
| `users` | Telegram user id | balance, ads, tasks, referral state |
| `referrals` | referred user id | referral status + milestone payouts |
| `withdrawals` | auto id | USDT withdraw requests |
| `app_config` | `settings`, `tasks` | Admin panel live config |

> ⚠️ Production funds handle කරන්න යනවා නම්, admin writes (balance adjust, payout
> approve) Firebase **Admin SDK** එකක් සහිත server එකකට ගෙනියන්න — දැනට ඒවා
> client-side; rules වලින් shape validation විතරයි කරන්නේ.
