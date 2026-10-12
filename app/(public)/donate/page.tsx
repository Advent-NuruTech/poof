"use client";

import Link from "next/link";

export default function DonatePage() {
return (
<main className="donate-page">
<section      className="donate-card"      aria-labelledby="donate-title"    >
<div className="donate-icon" aria-hidden="true">
<svg          viewBox="0 0 24 24"          width="36"          height="36"          fill="none"          stroke="currentColor"          strokeWidth="1.6"          strokeLinecap="round"          strokeLinejoin="round"        >
<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
</svg>
</div>

```
    <span className="donate-eyebrow">
      SUPPORT THE WORK
    </span>

    <h1 id="donate-title">
      Thank You for Your Interest in Supporting Our Work
    </h1>

    <p className="donate-description">
      We sincerely appreciate your willingness to support our
      work and mission. Your interest, encouragement, and
      generosity mean a great deal to us.
    </p>

    <div className="donate-notice" role="status">
      <span className="status-dot" aria-hidden="true" />
      <span>Our donation page is coming soon.</span>
    </div>

    <p className="donate-message">
      We are preparing a dedicated page to make supporting this
      work simple and secure. Thank you for your patience,
      prayers, and continued support.
    </p>

    <p className="donate-blessing">
      May God bless you abundantly.
    </p>

    <Link href="/" className="donate-home-link">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      Return Home
    </Link>
  </section>

  <style jsx>{`
    .donate-page {
      display: flex;
      min-height: 80vh;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      background: #f8fafc;
    }

    .donate-card {
      width: 100%;
      max-width: 760px;
      padding: 56px 48px;
      text-align: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      box-shadow: 0 16px 48px rgba(15, 23, 42, 0.06);
    }

    .donate-icon {
      display: flex;
      width: 76px;
      height: 76px;
      align-items: center;
      justify-content: center;
      margin: 0 auto 28px;
      color: #ffffff;
      background: #0b3d91;
      border-radius: 50%;
    }

    .donate-eyebrow {
      display: block;
      margin-bottom: 16px;
      color: #1d4ed8;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.16em;
    }

    .donate-card h1 {
      max-width: 620px;
      margin: 0 auto 20px;
      color: #0f172a;
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 750;
      letter-spacing: -0.045em;
      line-height: 1.15;
    }

    .donate-description {
      max-width: 590px;
      margin: 0 auto 28px;
      color: #475569;
      font-size: 1.05rem;
      line-height: 1.8;
    }

    .donate-notice {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 24px;
      padding: 12px 18px;
      color: #0b3d91;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 650;
    }

    .status-dot {
      width: 9px;
      height: 9px;
      flex-shrink: 0;
      background: #2563eb;
      border-radius: 50%;
    }

    .donate-message {
      max-width: 560px;
      margin: 0 auto 16px;
      color: #475569;
      font-size: 0.95rem;
      line-height: 1.8;
    }

    .donate-blessing {
      margin: 0 0 32px;
      color: #0b3d91;
      font-size: 1rem;
      font-weight: 600;
    }

    .donate-home-link {
      display: inline-flex;
      min-height: 48px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 22px;
      color: #ffffff;
      background: #0b3d91;
      border: 1px solid #0b3d91;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 650;
      text-decoration: none;
      transition: background-color 160ms ease;
    }

    .donate-home-link:hover {
      background: #174ea6;
    }

    .donate-home-link:focus-visible {
      outline: 3px solid #93c5fd;
      outline-offset: 4px;
    }

    @media (max-width: 600px) {
      .donate-page {
        min-height: 70vh;
        padding: 28px 16px;
      }

      .donate-card {
        padding: 40px 22px;
        border-radius: 14px;
      }

      .donate-icon {
        width: 64px;
        height: 64px;
        margin-bottom: 24px;
      }

      .donate-description {
        font-size: 1rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .donate-home-link {
        transition: none;
      }
    }
  `}</style>
</main>

);
}
