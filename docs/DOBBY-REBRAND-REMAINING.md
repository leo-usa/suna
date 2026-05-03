# Dobby rebrand — remaining work

This checklist covers what was **not** fully switched (often on purpose, to avoid breaking builds, stores, or production URLs). Tick items as you complete them.

## Environment & secrets

- [ ] Set **`DOBBY_ADMIN_API_KEY`** in backend and any deployment secrets; remove or stop using **`KORTIX_ADMIN_API_KEY`** when everything reads the new name.
- [ ] SDK / examples: prefer **`DOBBY_API_KEY`**; old **`KORTIX_API_KEY`** may still work in examples as a fallback—standardize when convenient.

## Visual assets (replace file contents or paths)

Filenames were renamed in many places; **graphics may still show the old brand.**

- [ ] **Web** (`apps/frontend/public/`): `dobby-*.svg` (brandmark, logomark, symbol, computer icons), plus any campaign art (`banner.png`, favicons, PWA icons in `manifest.json` if you add new files).
- [ ] **Mobile** (`apps/mobile/assets/`): `dobby-symbol*.svg`, `dobby-reusables-*.png`, `AppIcon-Light.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`.
- [ ] **iOS** (`apps/mobile/ios/Kortix/Images.xcassets/`): app icon, splash images—folder/target may still be named **Kortix** until you rename in Xcode.
- [ ] **Android**: launcher mipmaps after `expo prebuild` if you rely on generated icons.

## Native app identifiers & Expo

- [ ] **`apps/mobile/app.json`**: `bundleIdentifier` / `package` are still **`com.kortix.app`** in many forks—change to **`com.dobby.app`** (or your id) when ready; then move Android Kotlin package from `com/kortix/app` to match and run a clean prebuild.
- [ ] **`owner`** in `app.json` may still point at the old Expo org—update if you publish under a new account.
- [ ] **`android:emulator`** script references **`Dobby_Dev`** AVD—create it or rename to match your setup.

## Domains, org URLs, and analytics

- [ ] Replace remaining **`kortix.com`**, **`api.kortix.com`**, **`@kortix`**, **`linkedin.com/company/kortix`**, etc., where you own the new domain and accounts (many files still point at the old URLs/links).
- [ ] **`x.com/kortix`** and similar social links in footer/marketing pages.
- [ ] **`github.com/kortix-ai/suna`** (and **`.github/`** workflows referencing **kortix** APIs)—update when the repository or CI targets move.

## Billing & mobile storefronts

- [ ] **RevenueCat** / store product IDs may still use prefixes like **`kortix_plus`** in `apps/mobile/lib/billing/pricing.ts`—align with App Store / Play Console when you create Dobby products.

## Backend / API compatibility

- [ ] Some APIs and types still use **`is_kortix_team`**, **`include_kortix`**, **`kortix_template_id`**—renaming requires coordinated DB migrations and client changes; leave until you plan a breaking migration.

## SDK distribution

- [ ] PyPI / install instructions: package name is **`dobby`** in `sdk/pyproject.toml`; update READMEs and `pip install` / `uv add` lines that still say **`kortix`**.
- [ ] Any external consumers importing **`kortix`** must switch to **`dobby`** (or your published package name).

## Desktop

- [ ] **`apps/desktop/.env.example`**: signing cert path may still reference **`Kortix-Signing.p12`**—update when you have Dobby certs.
- [ ] **`package-lock.json`** may still mention old desktop package name until you run `npm install` and commit.

## Optional cleanup

- [ ] Remove or archive **`scripts/rebrand_kortix_to_dobby.py`** once you no longer need it.
- [ ] Search the repo for **`kortix`** / **`Kortix`** (case variants) and drive remaining hits to zero where appropriate—respect migrations and third-party URLs you cannot change.

---

*Generated as a follow-up to the Kortix → Dobby codebase rebrand. Adjust paths and names to match your fork.*
