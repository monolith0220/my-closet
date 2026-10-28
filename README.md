# My Closet

Vue 3 + TypeScript + Vite で作った、スマートフォン向けの洋服管理 PWA です。メール認証、写真付きの登録・編集・削除、検索と絞り込みに対応します。AI コーデ画面は今後の開発用プレースホルダーです。ユニクロ・GU の商品情報取得や非公式スクレイピングは行いません。商品番号と商品 URL は手入力で保存できます。

## 必要なもの

- Node.js 22.18 以上の 22 系、または 24.11 以上と npm
- Supabase プロジェクト（ローカルで試す場合は Docker と Supabase CLI）

## 起動

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShell の場合、コピーは `Copy-Item .env.example .env.local` を使えます。Vite が表示する URL（通常 `http://localhost:5173`）を開いてください。`npm run build` で型チェックと本番ビルド、`npm run preview` でビルド結果の確認ができます。

`.env.local` が空でも開発サーバーとビルドは動きます。その場合、画面に Supabase の設定手順が表示され、ログインやデータ保存はできません。ダミーの認証成功や架空の洋服データは表示しません。

洋服の写真は JPEG・PNG・WebP（最大 10 MB）に対応します。

## Supabase の設定

1. [Supabase](https://supabase.com/dashboard) でプロジェクトを作成します。
2. SQL マイグレーション `supabase/migrations/` を適用します。Supabase CLI を使う場合は次のコマンドで接続・反映できます。

   ```bash
   npx supabase login
   npx supabase link --project-ref <Project ID>
   npx supabase db push
   ```

3. Dashboard の **Project Settings → API** にある Project URL と公開用 `anon` / publishable key を `.env.local` に設定します。

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<public-anon-or-publishable-key>
   ```

4. Supabase Dashboard の **Authentication → Providers** で Email を有効にします。アプリの新規登録フォームからメールアドレスとパスワードでアカウントを作れます。メール確認を有効にしている場合は、届いた確認リンクを開いてからログインしてください。必要に応じて **Authentication → URL Configuration** に開発時の `http://localhost:5173` と公開先 URL を追加します。
5. 開発サーバーを再起動し、ログインして洋服を登録してください。

**秘密情報:** `VITE_` で始まる環境変数はブラウザーのバンドルに含まれます。ここには公開用キーだけを入れ、`service_role` キー、DB パスワード、個人トークンは絶対に設定しないでください。`.env.local` は Git 対象外です。

### ローカル Supabase で試す

Docker を起動してから、次を実行します。

```bash
npx supabase start
npx supabase status
```

`status` の API URL と `anon key` を `.env.local` の値に使います。`supabase start` 時にマイグレーションが適用され、`clothing-images` という**非公開** Storage バケットが作成されます。画像パスは `<user_id>/<uuid>.<拡張子>` 形式で、自分のフォルダー以外への操作は RLS で拒否されます。画像表示には短時間有効な署名付き URL を使います。

## データとアクセス制御

- `clothing_items`: 洋服、画像パス、商品番号・URL、シーズンなど
- `outfits`: 将来のコーデ提案データ
- `outfit_items`: コーデと洋服の関連

主キーは UUID、`user_id` は Supabase Auth のユーザー ID を参照します。各テーブルで RLS を有効にし、所有者の行だけが読み書きできます。`outfit_items` には関連元・関連先と同じユーザーであることを保証する制約もあります。

## アクセス制御テスト

Supabase CLI と Docker が使える環境で実行します。

```bash
npx supabase start
npx supabase test db
```

`supabase/tests/` の pgTAP 統合テストで、異なる 2 ユーザー間の `SELECT`、`INSERT`、`UPDATE`、`DELETE`、コーデ関連付け、Storage オブジェクトへのアクセス拒否を確認します。これは実際の PostgreSQL/RLS に対するテストです。Docker や CLI がない環境ではこのテストは実行できません。

## PWA

本番ビルドには Web App Manifest と Service Worker が含まれます。HTTPS で配信するとホーム画面に追加できます。アプリの静的ファイルはキャッシュされますが、認証・洋服データ・非公開画像の読み書きには接続が必要です。
