# BookSmart: Alpha Launch Playbook (100-200 Users)

This document provides a step-by-step playbook for launching BookSmart to early alpha/beta users. It details domain setup, feedback loops, onboarding, and the rollout timeline.

---

## 🗺️ Step 1: Branding & Custom Domain Setup
To build user trust and secure authentication loops, move away from raw Cloud Run URLs.

1. **Domain Registration**:
   * Secure a clean domain (e.g. `getbooksmart.com`, `usebooksmart.com`, or `booksmart.app`).
2. **Cloud Run Mapping**:
   * Map the custom domain to your Cloud Run services via Google Cloud Console:
     * `usebooksmart.com` -> Point to `booksmart-manager` container.
     * `api.usebooksmart.com` -> Point to `booksmart-backend` container.
3. **SSL Certificate**:
   * Google Cloud Run manages SSL certification automatically once CNAME records are set up in your registrar.

---

## 💬 Step 2: High-Engagement Feedback Loop
Early feedback is the most valuable asset during this alpha phase.

1. **VIP Community Space**:
   * Create a **Discord Server** or **Slack Workspace** dedicated to alpha testers.
   * Channels to create:
     * `#announcements` - Product releases, server status, updates.
     * `#bug-reports` - Reporting glitches, visual issues.
     * `#feature-requests` - Ideation and feedback on AI summaries, context capture.
     * `#general-chat` - Tester discussions.
2. **Discord Feedback Webhook Integration**:
   * You can configure a Discord Webhook in your backend. Every time a user submits feedback via the **in-app Feedback Widget** we created, the backend sends a JSON payload to the webhook, instantly posting the bug details (and a link to the screenshot) in your `#feedback-logs` channel.

---

## 📖 Step 3: Onboarding & User Manuals
Keep the installation friction as close to zero as possible.

1. **Single-Page Landing Website**:
   * A clean, landing page on your main domain with:
     * **Hero Hook**: *"Your web bookmarks, indexed and searchable by AI."*
     * **Call to Action (CTA)**: A prominent link to install the unlisted Chrome Extension.
     * **3-Step Visual Guide**: GIF loops showing:
       1. How to add a bookmark via the extension.
       2. Checking details/AI summaries on the manager dashboard.
       3. Performing instant search queries.
2. **Notion Documentation**:
   * Publish a public Notion page or GitBook for detailed documentation (e.g. `docs.usebooksmart.com`) containing installation steps, keyboard shortcuts, and FAQs.

---

## 📅 Step 4: Rollout Timeline

| Phase | Timeline | Target Group | Key Objectives |
| :--- | :--- | :--- | :--- |
| **Phase 1: Internal Testing** | Week 1 | 3-5 Close Friends / Coworkers | Test end-to-end user registration, extension login sync, and PDF extraction. |
| **Phase 2: VIP Cohort** | Week 2 | 20-30 Early Tech Users | Validate basic operations, Qdrant indices load speeds, and fix initial bugs. |
| **Phase 3: Rollout Scale** | Week 3-4 | 100-200 Target Beta Users | Evaluate concurrency limits, database locks, and gather feature feedback. |
| **Phase 4: Public Prep** | Week 5+ | General Audience | Package the extension for public listings on Chrome Web Store. |
